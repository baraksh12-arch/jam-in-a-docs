import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  subscribeToRoom, 
  subscribeToPlayers,
  updateRoom,
  claimInstrument,
  releaseInstrument
} from '../firebaseClient';
import { getClaimSyncManager } from '@/lib/instruments/claimSync';

export function useRoomState(roomId, userId) {
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Claim sync manager ref
  const claimSyncManagerRef = useRef(null);
  const previousInstrumentRef = useRef(null); // Track previous instrument for reconnect
  const webrtcRef = useRef(null); // WebRTC instance (set via setWebRTC)

  useEffect(() => {
    if (!roomId) return;

    setLoading(true);
    setError(null);
    let unsubscribeRoom;
    let unsubscribePlayers;

    // PHASE 2: Add error handling for subscriptions
    try {
      unsubscribeRoom = subscribeToRoom(roomId, (roomData) => {
        try {
          if (roomData) {
            setRoom(roomData);
            setError(null);
          } else {
            setError('Room not found');
          }
          setLoading(false);
        } catch (error) {
          console.error('[useRoomState] Error in room subscription callback:', error);
          setError('Error loading room data');
          setLoading(false);
        }
      });

      unsubscribePlayers = subscribeToPlayers(roomId, (playersData) => {
        try {
          console.log('[useRoomState] Players updated from subscription:', playersData.length, 'players');
          // PHASE 2: Ensure playersData is always an array
          const safePlayers = Array.isArray(playersData) ? playersData : [];
          setPlayers(safePlayers);
          
          // Initialize claim sync manager from players data
          if (claimSyncManagerRef.current) {
            claimSyncManagerRef.current.initializeFromPlayers(safePlayers);
          }
        } catch (error) {
          console.error('[useRoomState] Error in players subscription callback:', error);
          setPlayers([]); // Set empty array on error
        }
      });
    } catch (error) {
      console.error('[useRoomState] Error setting up subscriptions:', error);
      setError('Failed to subscribe to room data');
      setLoading(false);
    }

    return () => {
      try {
        if (unsubscribeRoom) unsubscribeRoom();
        if (unsubscribePlayers) unsubscribePlayers();
      } catch (error) {
        console.error('[useRoomState] Error cleaning up subscriptions:', error);
      }
    };
  }, [roomId]);

  const currentPlayer = players.find(p => {
    const playerUserId = p.userId || p.user_id || p.id;
    return playerUserId === userId;
  });

  // Build peers array for useWebRTC (exclude self, only players)
  const peers = players
    .filter(p => {
      const playerUserId = p.userId || p.user_id || p.id;
      const isPlayer = p.isPlayer !== false && p.is_player !== false; // Check both formats
      return playerUserId && playerUserId !== userId && isPlayer;
    })
    .map(p => ({
      userId: p.userId || p.user_id || p.id,
      user_id: p.user_id || p.userId, // Include both for compatibility
      id: p.id,
      displayName: p.displayName || p.display_name,
      instrument: p.instrument,
      isPlayer: p.isPlayer !== false && p.is_player !== false,
      is_player: p.is_player !== false,
      color: p.color
    }));

  // Debug log when peers change (only in dev, and not too spammy)
  // Use a ref to track previous peer count to avoid spam
  const prevPeerCountRef = useRef(0);
  useEffect(() => {
    if (import.meta.env.DEV && peers.length !== prevPeerCountRef.current) {
      const peerSummary = peers.map(p => `${p.userId}:${p.instrument || 'none'}`).join(', ');
      if (peerSummary || peers.length > 0) {
        console.log('[useRoomState] Peers derived from players:', peerSummary || 'none');
      }
      prevPeerCountRef.current = peers.length;
    }
  }, [peers.length, peers]);

  const isInstrumentAvailable = (instrument) => {
    return !players.some(p => p.instrument === instrument);
  };

  const getPlayerByInstrument = (instrument) => {
    return players.find(p => p.instrument === instrument);
  };

  const setBpm = async (bpm) => {
    await updateRoom(roomId, { bpm: Math.max(40, Math.min(240, bpm)) });
  };

  const setKey = async (key) => {
    await updateRoom(roomId, { key });
  };

  const setScale = async (scale) => {
    await updateRoom(roomId, { scale });
  };

  const togglePlay = async () => {
    await updateRoom(roomId, { isPlaying: !room?.isPlaying });
  };

  const toggleMetronome = async () => {
    await updateRoom(roomId, { metronomeOn: !room?.metronomeOn });
  };

  // Initialize claim sync manager when webrtc is available
  useEffect(() => {
    if (!roomId || !userId || !webrtcRef.current) return;

    // PHASE 2: Wrap initialization in try-catch to prevent crashes
    try {
      const webrtc = webrtcRef.current;
      const claimSyncManager = getClaimSyncManager(roomId, userId);
      claimSyncManagerRef.current = claimSyncManager;

      // Set up send function (via WebRTC)
      const sendClaimEvent = (event) => {
        if (webrtc.sendClaimEvent) {
          webrtc.sendClaimEvent(event);
        }
      };

      // Set up receive function (via WebRTC)
      const onClaimEvent = (event) => {
        if (claimSyncManagerRef.current) {
          claimSyncManagerRef.current.handleClaimEvent(event);
        }
      };

      // Start claim sync manager
      claimSyncManager.start(sendClaimEvent, onClaimEvent);

      // Register for claim events from WebRTC
      const unsubscribe = webrtc.onClaimEvent?.(onClaimEvent);

      // Initialize from current players
      if (players.length > 0) {
        claimSyncManager.initializeFromPlayers(players);
      }

      // Restore previous claim on reconnect
      const currentPlayer = players.find(p => {
        const playerUserId = p.userId || p.user_id || p.id;
        return playerUserId === userId;
      });
      if (currentPlayer?.instrument) {
        previousInstrumentRef.current = currentPlayer.instrument;
      } else if (previousInstrumentRef.current) {
        // Try to restore previous claim
        claimSyncManager.restoreClaim(previousInstrumentRef.current);
      }

      console.log('[useRoomState] ClaimSyncManager initialized successfully');

      return () => {
        if (unsubscribe) unsubscribe();
        claimSyncManager.stop();
      };
    } catch (error) {
      console.error('[useRoomState] Error initializing ClaimSyncManager:', error);
      // Don't throw - allow component to render with degraded functionality
    }
  }, [roomId, userId, players]);
  
  // Setter function to provide webrtc instance (called from Room.jsx)
  const setWebRTC = useCallback((webrtc) => {
    webrtcRef.current = webrtc;
  }, []);

  const claimMyInstrument = async (instrument) => {
    if (!userId) return;
    
    // Update database (existing behavior)
    await claimInstrument(roomId, userId, instrument);
    
    // Broadcast claim event via WebRTC (Phase 6)
    if (claimSyncManagerRef.current) {
      claimSyncManagerRef.current.broadcastClaim(instrument, true);
      previousInstrumentRef.current = instrument;
    }
  };

  const releaseMyInstrument = async () => {
    if (!userId) return;
    
    // Get current instrument before releasing
    const currentPlayer = players.find(p => {
      const playerUserId = p.userId || p.user_id || p.id;
      return playerUserId === userId;
    });
    const previousInstrument = currentPlayer?.instrument;
    
    // Update database (existing behavior)
    await releaseInstrument(roomId, userId);
    
    // Broadcast release event via WebRTC (Phase 6)
    if (claimSyncManagerRef.current && previousInstrument) {
      claimSyncManagerRef.current.broadcastClaim(previousInstrument, false);
      previousInstrumentRef.current = null;
    }
  };

  return {
    room,
    players,
    peers, // Exposed for useWebRTC (filtered, excludes self)
    currentPlayer,
    loading,
    error,
    isInstrumentAvailable,
    getPlayerByInstrument,
    setBpm,
    setKey,
    setScale,
    togglePlay,
    toggleMetronome,
    claimMyInstrument,
    releaseMyInstrument,
    setWebRTC // Expose setter for webrtc instance
  };
}