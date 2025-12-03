import { useState, useEffect, useRef } from 'react';
import { 
  subscribeToRoom, 
  subscribeToPlayers,
  updateRoom,
  claimInstrument,
  releaseInstrument
} from '../firebaseClient';

export function useRoomState(roomId, userId) {
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!roomId) return;

    setLoading(true);
    let unsubscribeRoom;
    let unsubscribePlayers;

    unsubscribeRoom = subscribeToRoom(roomId, (roomData) => {
      if (roomData) {
        setRoom(roomData);
        setError(null);
      } else {
        setError('Room not found');
      }
      setLoading(false);
    });

    unsubscribePlayers = subscribeToPlayers(roomId, (playersData) => {
      console.log('[useRoomState] Players updated from subscription:', playersData.length, 'players');
      setPlayers(playersData);
    });

    return () => {
      if (unsubscribeRoom) unsubscribeRoom();
      if (unsubscribePlayers) unsubscribePlayers();
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

  const claimMyInstrument = async (instrument) => {
    if (!userId) return;
    await claimInstrument(roomId, userId, instrument);
  };

  const releaseMyInstrument = async () => {
    if (!userId) return;
    await releaseInstrument(roomId, userId);
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
    releaseMyInstrument
  };
}