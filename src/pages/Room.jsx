/**
 * Room Page
 * Production-ready version with proper React imports
 * Fixed: useCallback import issue - using React.useCallback to avoid module resolution problems
 */
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useUserIdentity } from '../components/hooks/useUserIdentity';
import { useRoomState } from '../components/hooks/useRoomState';
import { useAudioEngine } from '../components/hooks/useAudioEngine';
import { useNoteEvents } from '../components/hooks/useNoteEvents';
import { useWebRTC } from '../components/hooks/useWebRTC';
import { createRoom, joinRoomAsPlayer, getRoom } from '../components/firebaseClient';
import RoomTopBar from '../components/RoomTopBar';
import InstrumentSlot from '../components/InstrumentSlot';
import InstrumentGrid from '../components/InstrumentGrid';
import ChatPanel from '../components/ChatPanel';
import { Loader2 } from 'lucide-react';

export default function Room() {
  // EMERGENCY DEBUG: Log immediately to verify component is loading
  console.log('[Room.jsx] Component rendering - React available:', typeof React !== 'undefined');
  
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const roomId = urlParams.get('id');
  
  // PHASE 2: Track last roomId to prevent issues when switching rooms
  const lastRoomIdRef = useRef(null);
  
  // Fixed: Add defensive logging for room ID
  console.log('[Room] roomId from route/query:', roomId);
  
  // PHASE 3: Log roomId changes
  useEffect(() => {
    if (roomId !== lastRoomIdRef.current) {
      console.log('[Room] Room ID changed:', { from: lastRoomIdRef.current, to: roomId });
      lastRoomIdRef.current = roomId;
    }
  }, [roomId]);

  const { userId, displayName, color, isReady: userReady } = useUserIdentity();
  
  const audioEngine = useAudioEngine();
  
  // Create activity trigger functions for each instrument
  const activityTriggersRef = useRef({});
  
  // Use React.useCallback directly to avoid import issues
  const handleNoteActivity = React.useCallback(({ source, instrument, note, velocity }) => {
    const trigger = activityTriggersRef.current[instrument];
    if (trigger) {
      trigger();
    }
  }, []);
  
  // Get room state first (needed for peers and room data)
  const { 
    room, 
    players,
    peers, // Filtered peers for useWebRTC (excludes self, only players)
    currentPlayer, 
    loading: roomLoading,
    error: roomError,
    ...roomControls 
  } = useRoomState(roomId, userId, null); // Pass null initially, will be set after webrtc is created
  
  // PHASE 3: Log room state at mount
  useEffect(() => {
    console.log('[Room] Room state update:', {
      roomId,
      room: !!room,
      playersCount: players?.length || 0,
      peersCount: peers?.length || 0,
      currentPlayer: !!currentPlayer,
      roomLoading,
      roomError
    });
  }, [roomId, room, players, peers, currentPlayer, roomLoading, roomError]);
  
  // Initialize WebRTC with peers and room (needed for claim sync and note events)
  // PHASE 2: Ensure peers is always an array (even if empty)
  const safePeers = Array.isArray(peers) ? peers : [];
  const webrtc = useWebRTC({ roomId, userId, peers: safePeers, room });
  
  // PHASE 3: Log WebRTC initialization
  useEffect(() => {
    if (webrtc) {
      console.log('[Room] WebRTC initialized:', {
        ready: webrtc.ready,
        connectionStates: webrtc.connectionStates
      });
    }
  }, [webrtc]);
  
  // Update useRoomState with webrtc instance for claim sync
  // This is a bit of a hack - we need webrtc in useRoomState but it depends on peers
  // So we update it after both are created
  useEffect(() => {
    if (webrtc && roomControls.setWebRTC) {
      try {
        roomControls.setWebRTC(webrtc);
        console.log('[Room] WebRTC instance set in useRoomState');
      } catch (error) {
        console.error('[Room] Error setting WebRTC in useRoomState:', error);
      }
    }
  }, [webrtc, roomControls]);
  
  // PHASE 3: Log claim events and WebRTC errors
  useEffect(() => {
    if (!webrtc) return;
    
    // Log WebRTC connection state changes
    const connectionStates = webrtc.connectionStates || {};
    console.log('[Room] WebRTC connection states:', connectionStates);
    
    // Register for claim events (if available)
    if (webrtc.onClaimEvent) {
      const unsubscribe = webrtc.onClaimEvent((event) => {
        console.log('[Room] Received claim event:', event);
      });
      return unsubscribe;
    }
  }, [webrtc]);

  const { sendNote } = useNoteEvents(roomId, userId, audioEngine, peers, room, handleNoteActivity, webrtc);

  const [initializing, setInitializing] = useState(true);
  const [showInstruments, setShowInstruments] = useState(false);

  useEffect(() => {
    const initRoom = async () => {
      if (!roomId) {
        console.warn('[Room] No roomId provided in URL');
        setInitializing(false);
        return;
      }

      if (!userReady || !userId) {
        console.log('[Room] Waiting for userReady or userId:', { userReady, userId });
        return;
      }

      try {
        console.log('[Room] Initializing room:', roomId);
        
        // Check if room exists
        const existingRoom = await getRoom(roomId);
        
        let roomJustCreated = false;
        if (!existingRoom) {
          // Room doesn't exist - create it (fallback for manual room code entry)
          console.log('[Room] Room not found, creating new room:', roomId);
          await createRoom(roomId);
          roomJustCreated = true;
        } else {
          console.log('[Room] Room found:', existingRoom.id);
        }

        // PHASE 2: Add delay after room creation to allow Supabase to propagate
        if (roomJustCreated) {
          console.log('[Room] Room just created, waiting for Supabase propagation...');
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        // Join as player (creates or updates player record)
        console.log('[Room] Joining room as player:', { roomId, userId, displayName });
        await joinRoomAsPlayer(roomId, userId, displayName, color);
        
        // PHASE 2: Additional delay after joining to ensure subscriptions are ready
        if (roomJustCreated) {
          console.log('[Room] Waiting for player subscription to propagate...');
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        setInitializing(false);
        console.log('[Room] Room initialization complete');
      } catch (error) {
        console.error('[Room] Failed to initialize room:', error);
        setInitializing(false);
        // Show user-friendly error
        alert(`Failed to join room: ${error.message || 'Unknown error'}. Please try again.`);
      }
    };

    initRoom();
  }, [roomId, userId, displayName, color, userReady]);

  useEffect(() => {
    if (currentPlayer?.instrument) {
      setShowInstruments(true);
    } else {
      setShowInstruments(false);
    }
  }, [currentPlayer]);

  useEffect(() => {
    if (!room) return;

    if (room.isPlaying && room.metronomeOn) {
      audioEngine.startMetronome(room.bpm);
    } else {
      audioEngine.stopMetronome();
    }
  }, [room?.isPlaying, room?.metronomeOn, room?.bpm, audioEngine]);

  if (!roomId) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-white">No room ID provided</p>
      </div>
    );
  }

  // PHASE 2: Add comprehensive guards for missing state
  // Guard: Check initializing, loading states, and user readiness
  if (initializing || roomLoading || !userReady) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading room...</p>
        </div>
      </div>
    );
  }

  // Guard: Handle errors
  if (roomError) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{roomError}</p>
          <button
            onClick={() => navigate(createPageUrl('Landing'))}
            className="text-purple-400 hover:text-purple-300"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Guard: Ensure room and players are available (even if roomLoading is false, room might still be null)
  // PHASE 2: More robust guard - check roomLoading OR room null
  if (!room || !players || !Array.isArray(players)) {
    console.log('[Room] Waiting for room and players:', { 
      room: !!room, 
      players: !!players, 
      playersIsArray: Array.isArray(players),
      roomLoading,
      initializing,
      userReady
    });
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Waiting for room state...</p>
        </div>
      </div>
    );
  }

  // Guard: Ensure roomControls methods are available
  if (!roomControls || typeof roomControls.getPlayerByInstrument !== 'function' || typeof roomControls.isInstrumentAvailable !== 'function') {
    console.log('[Room] Waiting for roomControls:', { 
      roomControls: !!roomControls, 
      hasGetPlayerByInstrument: typeof roomControls?.getPlayerByInstrument === 'function',
      hasIsInstrumentAvailable: typeof roomControls?.isInstrumentAvailable === 'function'
    });
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Initializing room controls...</p>
        </div>
      </div>
    );
  }

  if (!audioEngine.isReady) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading audio engine...</p>
        </div>
      </div>
    );
  }

  // PHASE 3: Debugging helpers (only in dev mode)
  const debugInfo = import.meta.env.DEV ? {
    roomId,
    room: room ? { id: room.id, bpm: room.bpm, isPlaying: room.isPlaying } : null,
    players: players?.length || 0,
    peers: peers?.length || 0,
    loading: { initializing, roomLoading, userReady, audioReady: audioEngine.isReady },
    webrtc: webrtc ? { ready: webrtc.ready, connectionStates: Object.keys(webrtc.connectionStates || {}).length } : null
  } : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* PHASE 3: Debug info panel (dev only) */}
      {import.meta.env.DEV && (
        <div className="fixed bottom-4 right-4 bg-black/80 text-white text-xs p-3 rounded-lg max-w-md max-h-64 overflow-auto z-50 border border-purple-500/50">
          <div className="font-bold mb-2 text-purple-400">Debug Info</div>
          <pre className="whitespace-pre-wrap break-words">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      )}

      <RoomTopBar 
        room={room}
        roomId={roomId}
        {...roomControls}
      />

      <div className="container mx-auto px-4 py-6">
        {!showInstruments ? (
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-2">Choose Your Instrument</h2>
              <p className="text-gray-400">Select an available instrument to start jamming</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <InstrumentSlot
                instrument="DRUMS"
                player={roomControls.getPlayerByInstrument('DRUMS')}
                isAvailable={roomControls.isInstrumentAvailable('DRUMS')}
                onClaim={() => roomControls.claimMyInstrument('DRUMS')}
                currentUserId={userId}
              />
              <InstrumentSlot
                instrument="BASS"
                player={roomControls.getPlayerByInstrument('BASS')}
                isAvailable={roomControls.isInstrumentAvailable('BASS')}
                onClaim={() => roomControls.claimMyInstrument('BASS')}
                currentUserId={userId}
              />
              <InstrumentSlot
                instrument="EP"
                player={roomControls.getPlayerByInstrument('EP')}
                isAvailable={roomControls.isInstrumentAvailable('EP')}
                onClaim={() => roomControls.claimMyInstrument('EP')}
                currentUserId={userId}
              />
              <InstrumentSlot
                instrument="GUITAR"
                player={roomControls.getPlayerByInstrument('GUITAR')}
                isAvailable={roomControls.isInstrumentAvailable('GUITAR')}
                onClaim={() => roomControls.claimMyInstrument('GUITAR')}
                currentUserId={userId}
              />
            </div>

            <div className="mt-8 bg-white/5 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Players in Room</h3>
              {players.length === 0 ? (
                <p className="text-gray-400">Waiting for players...</p>
              ) : (
                <div className="space-y-2">
                  {players.map(player => (
                    <div key={player.id} className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: player.color }}
                      />
                      <span className="text-white">{player.displayName}</span>
                      {player.instrument && (
                        <span className="text-gray-400 text-sm">
                          • {player.instrument}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <InstrumentGrid
                players={players}
                currentPlayer={currentPlayer}
                audioEngine={audioEngine}
                sendNote={sendNote}
                room={room}
                activityTriggersRef={activityTriggersRef}
              />
            </div>

            <div className="lg:col-span-1">
              <ChatPanel
                roomId={roomId}
                userId={userId}
                displayName={displayName}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}