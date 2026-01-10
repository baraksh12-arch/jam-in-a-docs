import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  subscribeToRoom, 
  subscribeToPlayers,
  subscribeToCrowdMembers,
  updateRoom as updateRoomSupabase,
  claimInstrument as claimInstrumentSupabase,
  releaseInstrument as releaseInstrumentSupabase
} from '../firebaseClient';
import { getClaimSyncManager } from '@/lib/instruments/claimSync';

export function useRoomState(roomId, userId) {
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [crowdMembers, setCrowdMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [wsConnected, setWsConnected] = useState(true); // Supabase realtime acts as "connected"
  
  const claimSyncManagerRef = useRef(null);
  const previousInstrumentRef = useRef(null);
  const webrtcRef = useRef(null);
  const [optimisticInstrument, setOptimisticInstrument] = useState(null);
  const updateTimeoutRef = useRef(null);

  // Supabase Realtime subscriptions for room and players
  useEffect(() => {
    if (!roomId) return;

    console.log('[useRoomState] Setting up Supabase subscriptions for room:', roomId);
    setLoading(true);
    setError(null);
    
    // Subscribe to room changes
    const unsubscribeRoom = subscribeToRoom(roomId, (roomData) => {
      if (roomData) {
        console.log('[useRoomState] Room data received:', roomData);
        setRoom(roomData);
        setError(null);
        setWsConnected(true);
      } else {
        setError('Room not found');
        setWsConnected(false);
      }
      setLoading(false);
    });

    // Subscribe to players changes
    const unsubscribePlayers = subscribeToPlayers(roomId, (playersData) => {
      const safePlayers = Array.isArray(playersData) ? playersData : [];
      console.log('[useRoomState] Players data received:', safePlayers.length, 'players');
      setPlayers(safePlayers);
      
      if (claimSyncManagerRef.current) {
        claimSyncManagerRef.current.initializeFromPlayers(safePlayers);
      }
    });

    // Subscribe to crowd members
    const unsubscribeCrowd = subscribeToCrowdMembers(roomId, (crowdData) => {
      const safeCrowd = Array.isArray(crowdData) ? crowdData : [];
      console.log('[useRoomState] Crowd data received:', safeCrowd.length, 'members');
      setCrowdMembers(safeCrowd);
    });

    return () => {
      console.log('[useRoomState] Cleaning up subscriptions');
      unsubscribeRoom();
      unsubscribePlayers();
      unsubscribeCrowd();
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [roomId]);

  const currentPlayer = players.find(p => {
    const playerUserId = p.userId || p.user_id || p.id;
    return playerUserId === userId;
  });
  
  const effectiveInstrument = optimisticInstrument || currentPlayer?.instrument;
  
  const playersWithOptimistic = optimisticInstrument
    ? (() => {
        const existingPlayerIndex = players.findIndex(p => {
          const playerUserId = p.userId || p.user_id || p.id;
          return playerUserId === userId;
        });
        
        if (existingPlayerIndex >= 0) {
          return players.map((p, index) => 
            index === existingPlayerIndex ? { ...p, instrument: optimisticInstrument } : p
          );
        } else if (currentPlayer) {
          return [...players, { ...currentPlayer, instrument: optimisticInstrument }];
        }
        return players;
      })()
    : players;
  
  // Clear optimistic update when real data arrives
  useEffect(() => {
    if (currentPlayer?.instrument === optimisticInstrument) {
      setOptimisticInstrument(null);
    }
  }, [currentPlayer?.instrument, optimisticInstrument]);

  const peers = players
    .filter(p => {
      const playerUserId = p.userId || p.user_id || p.id;
      const isPlayer = p.isPlayer !== false && p.is_player !== false;
      return playerUserId && playerUserId !== userId && isPlayer;
    })
    .map(p => ({
      userId: p.userId || p.user_id || p.id,
      user_id: p.user_id || p.userId,
      id: p.id,
      displayName: p.displayName || p.display_name,
      instrument: p.instrument,
      isPlayer: p.isPlayer !== false && p.is_player !== false,
      is_player: p.is_player !== false,
      color: p.color
    }));

  const isInstrumentAvailable = useCallback((instrument) => {
    return !playersWithOptimistic.some(p => p.instrument === instrument);
  }, [playersWithOptimistic]);

  const getPlayerByInstrument = useCallback((instrument) => {
    return playersWithOptimistic.find(p => p.instrument === instrument);
  }, [playersWithOptimistic]);

  // Room controls with optimistic updates
  const setBpm = useCallback(async (bpm) => {
    const clampedBpm = Math.max(40, Math.min(240, bpm));
    // Optimistic update
    setRoom(prev => prev ? { ...prev, bpm: clampedBpm } : null);
    
    try {
      await updateRoomSupabase(roomId, { bpm: clampedBpm });
    } catch (err) {
      console.error('[useRoomState] Error updating BPM:', err);
      // The subscription will correct if there's a mismatch
    }
  }, [roomId]);

  const setKey = useCallback(async (key) => {
    // Optimistic update
    setRoom(prev => prev ? { ...prev, key } : null);
    
    try {
      await updateRoomSupabase(roomId, { key });
    } catch (err) {
      console.error('[useRoomState] Error updating key:', err);
    }
  }, [roomId]);

  const setScale = useCallback(async (scale) => {
    // Optimistic update
    setRoom(prev => prev ? { ...prev, scale } : null);
    
    try {
      await updateRoomSupabase(roomId, { scale });
    } catch (err) {
      console.error('[useRoomState] Error updating scale:', err);
    }
  }, [roomId]);

  const togglePlay = useCallback(async () => {
    const newPlaying = !room?.isPlaying;
    // Optimistic update
    setRoom(prev => prev ? { ...prev, isPlaying: newPlaying } : null);
    
    try {
      await updateRoomSupabase(roomId, { isPlaying: newPlaying });
    } catch (err) {
      console.error('[useRoomState] Error toggling play:', err);
    }
  }, [roomId, room?.isPlaying]);

  const toggleMetronome = useCallback(async () => {
    const newMetronome = !room?.metronomeOn;
    // Optimistic update
    setRoom(prev => prev ? { ...prev, metronomeOn: newMetronome } : null);
    
    try {
      await updateRoomSupabase(roomId, { metronomeOn: newMetronome });
    } catch (err) {
      console.error('[useRoomState] Error toggling metronome:', err);
    }
  }, [roomId, room?.metronomeOn]);

  // Initialize ClaimSyncManager when WebRTC becomes available
  useEffect(() => {
    if (!roomId || !userId || !webrtcRef.current) return;

    const webrtc = webrtcRef.current;
    const claimSyncManager = getClaimSyncManager(roomId, userId);
    claimSyncManagerRef.current = claimSyncManager;

    const sendClaimEvent = (event) => {
      if (webrtc.sendClaimEvent) {
        webrtc.sendClaimEvent(event);
      }
    };

    const onClaimEvent = (event) => {
      if (claimSyncManagerRef.current) {
        claimSyncManagerRef.current.handleClaimEvent(event);
      }
    };

    claimSyncManager.start(sendClaimEvent, onClaimEvent);
    const unsubscribe = webrtc.onClaimEvent?.(onClaimEvent);

    return () => {
      if (unsubscribe) unsubscribe();
      claimSyncManager.stop();
    };
  }, [roomId, userId]);

  // Update claim map when players change
  useEffect(() => {
    if (!claimSyncManagerRef.current || !players.length) return;
    
    claimSyncManagerRef.current.initializeFromPlayers(players);

    const cp = players.find(p => {
      const playerUserId = p.userId || p.user_id || p.id;
      return playerUserId === userId;
    });
    
    if (cp?.instrument) {
      previousInstrumentRef.current = cp.instrument;
    } else if (previousInstrumentRef.current && claimSyncManagerRef.current) {
      claimSyncManagerRef.current.restoreClaim(previousInstrumentRef.current);
    }
  }, [players, userId]);
  
  const setWebRTC = useCallback((webrtc) => {
    webrtcRef.current = webrtc;
  }, []);

  const claimMyInstrument = useCallback(async (instrument) => {
    if (!userId) return;
    
    // Optimistic update for instant feedback
    setOptimisticInstrument(instrument);
    previousInstrumentRef.current = instrument;
    
    try {
      await claimInstrumentSupabase(roomId, userId, instrument);
      console.log('[useRoomState] Instrument claimed successfully:', instrument);
      
      if (claimSyncManagerRef.current) {
        claimSyncManagerRef.current.broadcastClaim(instrument, true);
      }
    } catch (err) {
      console.error('[useRoomState] Error claiming instrument:', err);
      setOptimisticInstrument(null);
      throw err;
    }
  }, [roomId, userId]);

  const releaseMyInstrument = useCallback(async () => {
    if (!userId) return;
    
    const previousInstrument = effectiveInstrument;
    setOptimisticInstrument(null);
    previousInstrumentRef.current = null;
    
    try {
      await releaseInstrumentSupabase(roomId, userId);
      
      if (claimSyncManagerRef.current && previousInstrument) {
        claimSyncManagerRef.current.broadcastClaim(previousInstrument, false);
      }
    } catch (err) {
      console.error('[useRoomState] Error releasing instrument:', err);
    }
  }, [roomId, userId, effectiveInstrument]);

  // joinWsRoom is a no-op since we use Supabase realtime
  // But we keep it for API compatibility
  const joinWsRoom = useCallback((displayName, color, asCrowd = false) => {
    console.log('[useRoomState] joinWsRoom called (using Supabase realtime):', { displayName, asCrowd });
    setWsConnected(true);
  }, []);

  const getSocket = useCallback(() => null, []);

  const currentPlayerWithInstrument = currentPlayer 
    ? { ...currentPlayer, instrument: effectiveInstrument }
    : (effectiveInstrument ? { userId, user_id: userId, id: userId, instrument: effectiveInstrument } : null);
  
  return {
    room,
    players: playersWithOptimistic,
    crowdMembers,
    peers,
    currentPlayer: currentPlayerWithInstrument,
    loading,
    error,
    wsConnected,
    isInstrumentAvailable,
    getPlayerByInstrument,
    setBpm,
    setKey,
    setScale,
    togglePlay,
    toggleMetronome,
    claimMyInstrument,
    releaseMyInstrument,
    setWebRTC,
    joinWsRoom,
    getSocket,
  };
}
