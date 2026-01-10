/**
 * useSocketRoom - Real-time WebSocket connection for room sync
 * Provides instant updates for players, room state, and presence
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3001';

export function useSocketRoom(roomId, userId, displayName, color, isCrowd = false) {
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [crowdMembers, setCrowdMembers] = useState([]);
  const [error, setError] = useState(null);
  
  const socketRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;

  // Initialize socket connection
  useEffect(() => {
    if (!roomId || !userId) return;

    console.log('[useSocketRoom] Connecting to', WS_URL);
    
    const socket = io(`${WS_URL}/rooms`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('[useSocketRoom] Connected:', socket.id);
      setConnected(true);
      setError(null);
      reconnectAttempts.current = 0;

      // Join room immediately on connect
      socket.emit('room:join', {
        roomCode: roomId.toUpperCase(),
        userId,
        displayName,
        color,
        asCrowd: isCrowd,
      });
    });

    socket.on('disconnect', (reason) => {
      console.log('[useSocketRoom] Disconnected:', reason);
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('[useSocketRoom] Connection error:', err.message);
      reconnectAttempts.current++;
      if (reconnectAttempts.current >= maxReconnectAttempts) {
        setError('Unable to connect to real-time server');
      }
    });

    // Room state events
    socket.on('room:state', (data) => {
      console.log('[useSocketRoom] Received room state:', data);
      if (data.room) {
        setRoom({
          id: roomId,
          bpm: data.room.bpm,
          key: data.room.musicalKey,
          scale: data.room.scale,
          isPlaying: data.room.isPlaying,
          metronomeOn: data.room.metronomeOn,
          startTime: data.room.startTime,
        });
      }
      if (data.players) {
        setPlayers(data.players.map(p => ({
          id: p.id,
          oderId: p.userId,
          userId: p.userId,
          displayName: p.displayName,
          color: p.color,
          instrument: p.instrument,
          isConnected: p.isConnected,
          isPlayer: true,
        })));
      }
      if (data.crowdMembers) {
        setCrowdMembers(data.crowdMembers.map(c => ({
          id: c.id,
          userId: c.userId,
          displayName: c.displayName,
          color: c.color,
          isBroadcasting: c.isBroadcasting,
          isCrowd: true,
        })));
      }
    });

    // User joined
    socket.on('room:user_joined', (data) => {
      console.log('[useSocketRoom] User joined:', data);
      if (data.isCrowd) {
        setCrowdMembers(prev => {
          if (prev.some(c => c.userId === data.userId)) return prev;
          return [...prev, {
            userId: data.userId,
            displayName: data.displayName,
            color: data.color,
            isCrowd: true,
          }];
        });
      } else {
        setPlayers(prev => {
          if (prev.some(p => p.userId === data.userId)) return prev;
          return [...prev, {
            userId: data.userId,
            displayName: data.displayName,
            color: data.color,
            instrument: null,
            isPlayer: true,
          }];
        });
      }
    });

    // User left
    socket.on('room:user_left', (data) => {
      console.log('[useSocketRoom] User left:', data.userId);
      setPlayers(prev => prev.filter(p => p.userId !== data.userId));
      setCrowdMembers(prev => prev.filter(c => c.userId !== data.userId));
    });

    // BPM changed
    socket.on('room:bpm_changed', (data) => {
      console.log('[useSocketRoom] BPM changed:', data.bpm);
      setRoom(prev => prev ? { ...prev, bpm: data.bpm } : null);
    });

    // Key changed
    socket.on('room:key_changed', (data) => {
      console.log('[useSocketRoom] Key changed:', data.key);
      setRoom(prev => prev ? { ...prev, key: data.key } : null);
    });

    // Scale changed
    socket.on('room:scale_changed', (data) => {
      console.log('[useSocketRoom] Scale changed:', data.scale);
      setRoom(prev => prev ? { ...prev, scale: data.scale } : null);
    });

    // Play state changed
    socket.on('room:play_changed', (data) => {
      console.log('[useSocketRoom] Play state changed:', data.isPlaying);
      setRoom(prev => prev ? { 
        ...prev, 
        isPlaying: data.isPlaying,
        startTime: data.startTime,
      } : null);
    });

    // Metronome changed
    socket.on('room:metronome_changed', (data) => {
      console.log('[useSocketRoom] Metronome changed:', data.metronomeOn);
      setRoom(prev => prev ? { ...prev, metronomeOn: data.metronomeOn } : null);
    });

    // Instrument claimed
    socket.on('instrument:claimed', (data) => {
      console.log('[useSocketRoom] Instrument claimed:', data);
      setPlayers(prev => prev.map(p => 
        p.userId === data.player.userId
          ? { ...p, instrument: data.instrument, displayName: data.player.displayName, color: data.player.color }
          : p
      ));
    });

    // Instrument released
    socket.on('instrument:released', (data) => {
      console.log('[useSocketRoom] Instrument released:', data);
      setPlayers(prev => prev.map(p =>
        p.userId === data.userId ? { ...p, instrument: null } : p
      ));
    });

    // Instrument claim failed
    socket.on('instrument:claim_failed', (data) => {
      console.error('[useSocketRoom] Instrument claim failed:', data);
      setError(`Failed to claim ${data.instrument}: ${data.reason}`);
      setTimeout(() => setError(null), 3000);
    });

    // Error
    socket.on('error', (data) => {
      console.error('[useSocketRoom] Error:', data);
      setError(data.message);
    });

    // Pong for latency measurement
    socket.on('pong', () => {
      // Could track latency here if needed
    });

    // Ping every 25 seconds for presence
    const pingInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('ping');
      }
    }, 25000);

    return () => {
      console.log('[useSocketRoom] Cleaning up socket');
      clearInterval(pingInterval);
      socket.emit('room:leave');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId, userId, displayName, color, isCrowd]);

  // Control functions
  const setBpm = useCallback((bpm) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('room:bpm', { bpm });
    }
  }, []);

  const setKey = useCallback((key) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('room:key', { key });
    }
  }, []);

  const setScale = useCallback((scale) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('room:scale', { scale });
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (socketRef.current?.connected) {
      const isPlaying = !room?.isPlaying;
      socketRef.current.emit('room:play', { isPlaying });
    }
  }, [room?.isPlaying]);

  const toggleMetronome = useCallback(() => {
    if (socketRef.current?.connected) {
      const metronomeOn = !room?.metronomeOn;
      socketRef.current.emit('room:metronome', { metronomeOn });
    }
  }, [room?.metronomeOn]);

  const claimInstrument = useCallback((instrument) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('instrument:claim', { instrument });
    }
  }, []);

  const releaseInstrument = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('instrument:release');
    }
  }, []);

  const sendNote = useCallback((instrument, note, velocity = 100, eventType = 'NOTE_ON', scheduledAt = null) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('note', {
        instrument,
        note,
        velocity,
        eventType,
        scheduledAt,
      });
    }
  }, []);

  const sendChatMessage = useCallback((content, type = 'TEXT') => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('chat:message', { content, type });
    }
  }, []);

  // Get socket for direct event subscription
  const getSocket = useCallback(() => socketRef.current, []);

  // Helper functions
  const currentPlayer = players.find(p => p.userId === userId);
  
  const isInstrumentAvailable = useCallback((instrument) => {
    return !players.some(p => p.instrument === instrument);
  }, [players]);

  const getPlayerByInstrument = useCallback((instrument) => {
    return players.find(p => p.instrument === instrument);
  }, [players]);

  return {
    connected,
    room,
    players,
    crowdMembers,
    currentPlayer,
    error,
    
    // Controls
    setBpm,
    setKey,
    setScale,
    togglePlay,
    toggleMetronome,
    claimInstrument,
    releaseInstrument,
    sendNote,
    sendChatMessage,
    
    // Helpers
    isInstrumentAvailable,
    getPlayerByInstrument,
    getSocket,
  };
}

export default useSocketRoom;
