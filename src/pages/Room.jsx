/**
 * Room Page
 * Fixed: Added defensive logging and improved error handling for room ID from URL
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useUserIdentity } from '../components/hooks/useUserIdentity';
import { useRoomState } from '../components/hooks/useRoomState';
import { useAudioEngine } from '../components/hooks/useAudioEngine';
import { useNoteEvents } from '../components/hooks/useNoteEvents';
import { createRoom, joinRoomAsPlayer, getRoom } from '../components/firebaseClient';
import RoomTopBar from '../components/RoomTopBar';
import InstrumentSlot from '../components/InstrumentSlot';
import InstrumentGrid from '../components/InstrumentGrid';
import ChatPanel from '../components/ChatPanel';
import { Loader2 } from 'lucide-react';

export default function Room() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const roomId = urlParams.get('id');
  
  // Fixed: Add defensive logging for room ID
  console.log('[Room] roomId from route/query:', roomId);

  const { userId, displayName, color, isReady: userReady } = useUserIdentity();
  const { 
    room, 
    players,
    peers, // Filtered peers for useWebRTC (excludes self, only players)
    currentPlayer, 
    loading: roomLoading,
    error: roomError,
    ...roomControls 
  } = useRoomState(roomId, userId);

  const audioEngine = useAudioEngine();
  
  // Create activity trigger functions for each instrument
  const activityTriggersRef = useRef({});
  
  const handleNoteActivity = useCallback(({ source, instrument, note, velocity }) => {
    const trigger = activityTriggersRef.current[instrument];
    if (trigger) {
      trigger();
    }
  }, []);
  
  const { sendNote } = useNoteEvents(roomId, userId, audioEngine, peers, room, handleNoteActivity);

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
        
        if (!existingRoom) {
          // Room doesn't exist - create it (fallback for manual room code entry)
          console.log('[Room] Room not found, creating new room:', roomId);
          await createRoom(roomId);
        } else {
          console.log('[Room] Room found:', existingRoom.id);
        }

        // Join as player (creates or updates player record)
        console.log('[Room] Joining room as player:', { roomId, userId, displayName });
        await joinRoomAsPlayer(roomId, userId, displayName, color);
        
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
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