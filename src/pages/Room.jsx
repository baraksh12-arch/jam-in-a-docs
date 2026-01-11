import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useUserIdentity } from '../components/hooks/useUserIdentity';
import { useRoomState } from '../components/hooks/useRoomState';
import { useAudioEngine } from '../components/hooks/useAudioEngine';
import { useNoteEvents } from '../components/hooks/useNoteEvents';
import { useWebRTC } from '../components/hooks/useWebRTC';
import { useWebRTCCrowd } from '../components/hooks/useWebRTCCrowd';
import { createRoom, joinRoomAsPlayer, joinRoomAsCrowd, getRoom, subscribeToCrowdMembers } from '../components/firebaseClient';
import RoomTopBar from '../components/RoomTopBar';
import InstrumentSlot from '../components/InstrumentSlot';
import InstrumentGrid from '../components/InstrumentGrid';
import ChatPanel from '../components/ChatPanel';
import CrowdPanel from '../components/crowd/CrowdPanel';
import CrowdViewer from '../components/crowd/CrowdViewer';
import { FocusModeView, MobileFocusView } from '../components/focus';
import AudioUnlock from '../components/audio/AudioUnlock';
import { useMIDIInstrument } from '../hooks/useMIDI';
import { Loader2, AlertCircle, Music, Wifi, WifiOff, Users, Volume2, Eye, Video, Expand } from 'lucide-react';
import { useOrientation } from '../hooks/use-orientation';
import { useIsMobile } from '../hooks/use-mobile';
import { useToast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

export default function Room() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const roomId = urlParams.get('id');
  const mode = urlParams.get('mode'); // 'crowd' or null (player)
  const isCrowdMode = mode === 'crowd';
  
  const { userId, displayName, color, isReady: userReady } = useUserIdentity();
  const { isPortrait } = useOrientation();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  
  const audioEngine = useAudioEngine();
  const activityTriggersRef = useRef({});
  
  const { 
    room, 
    players,
    crowdMembers: wsCrowdMembers,
    peers,
    currentPlayer, 
    loading: roomLoading,
    error: roomError,
    wsConnected,
    joinWsRoom,
    ...roomControls 
  } = useRoomState(roomId, userId);

  // Crowd members state - merge from WebSocket and Supabase
  const [supabaseCrowdMembers, setSupabaseCrowdMembers] = useState([]);
  
  // Use WebSocket crowd members if available, otherwise use Supabase
  const crowdMembers = (wsCrowdMembers && wsCrowdMembers.length > 0) 
    ? wsCrowdMembers 
    : supabaseCrowdMembers;
  
  const handleNoteActivity = React.useCallback(({ source, instrument, note, velocity }) => {
    const trigger = activityTriggersRef.current[instrument];
    if (trigger) {
      trigger();
    }
  }, []);
  
  const safePeers = Array.isArray(peers) ? peers : [];
  const webrtc = useWebRTC({ roomId, userId, peers: safePeers, room });
  
  // Crowd WebRTC for video streaming
  const crowdWebRTC = useWebRTCCrowd({
    roomId,
    userId,
    isCrowd: isCrowdMode,
    crowdMembers
  });
  
  useEffect(() => {
    if (webrtc && roomControls.setWebRTC) {
      roomControls.setWebRTC(webrtc);
    }
  }, [webrtc, roomControls]);

  const { sendNote } = useNoteEvents(roomId, userId, audioEngine, peers, room, handleNoteActivity, webrtc);

  const [initializing, setInitializing] = useState(true);
  const [showInstruments, setShowInstruments] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [showAudioUnlock, setShowAudioUnlock] = useState(false);
  
  // MIDI support for instrument
  const midi = useMIDIInstrument({
    instrument: currentPlayer?.instrument,
    audioEngine,
    sendNote,
    enabled: !!currentPlayer?.instrument && audioUnlocked
  });

  useEffect(() => {
    const initRoom = async () => {
      if (!roomId || !userReady || !userId) return;

      try {
        const existingRoom = await getRoom(roomId);
        
        if (!existingRoom) {
          if (isCrowdMode) {
            // Crowd members cannot create rooms
            toast({
              title: 'Room Not Found',
              description: 'This room does not exist. Ask the host for the correct room code.',
              variant: 'destructive',
              duration: 5000,
            });
            navigate(createPageUrl('Landing'));
            return;
          }
          await createRoom(roomId);
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        // Join based on mode
        if (isCrowdMode) {
          await joinRoomAsCrowd(roomId, userId, displayName, color);
        } else {
          await joinRoomAsPlayer(roomId, userId, displayName, color);
        }
        setInitializing(false);
      } catch (error) {
        setInitializing(false);
        toast({
          title: 'Unable to Join Room',
          description: error.message || 'Failed to join room. Please try again.',
          variant: 'destructive',
          duration: 5000,
        });
      }
    };

    initRoom();
  }, [roomId, userId, displayName, color, userReady, toast, isCrowdMode, navigate]);

  // Subscribe to crowd members (Supabase fallback)
  useEffect(() => {
    if (!roomId) return;
    
    const unsubscribe = subscribeToCrowdMembers(roomId, (members) => {
      setSupabaseCrowdMembers(members);
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [roomId]);

  // Join WebSocket room when user info is ready
  useEffect(() => {
    if (!roomId || !userId || !displayName || !color || !userReady) return;
    
    // Join WebSocket room for real-time updates
    if (joinWsRoom) {
      joinWsRoom(displayName, color, isCrowdMode);
    }
  }, [roomId, userId, displayName, color, userReady, isCrowdMode, joinWsRoom]);

  useEffect(() => {
    setShowInstruments(!!currentPlayer?.instrument);
  }, [currentPlayer]);

  useEffect(() => {
    if (!room) return;
    if (room.isPlaying && room.metronomeOn) {
      audioEngine.startMetronome(room.bpm);
    } else {
      audioEngine.stopMetronome();
    }
  }, [room?.isPlaying, room?.metronomeOn, room?.bpm, audioEngine]);

  // Check audio context state - show unlock screen if needed (especially on iOS/Android)
  useEffect(() => {
    // On mobile, we need user interaction to unlock audio
    if (isMobile && !audioUnlocked && !isCrowdMode) {
      setShowAudioUnlock(true);
    }
  }, [isMobile, audioUnlocked, isCrowdMode]);

  // Handle audio unlock completion
  const handleAudioUnlocked = useCallback(() => {
    setAudioUnlocked(true);
    setShowAudioUnlock(false);
    console.log('[Room] Audio unlocked successfully');
  }, []);

  // Auto-enter focus mode on mobile when instrument is selected
  useEffect(() => {
    if (isMobile && currentPlayer?.instrument && audioUnlocked && !focusMode) {
      // Small delay to ensure everything is ready
      const timer = setTimeout(() => {
        setFocusMode(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isMobile, currentPlayer?.instrument, audioUnlocked, focusMode]);

  // ESC key to exit focus mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && focusMode) {
        setFocusMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusMode]);

  // Focus Mode handler - must be defined before any conditional returns
  const handleEnterFocusMode = useCallback(() => {
    if (currentPlayer?.instrument) {
      setFocusMode(true);
    }
  }, [currentPlayer?.instrument]);

  // Premium loading screen component
  const LoadingScreen = ({ message, subMessage }) => (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] bg-cyan-500/15 rounded-full blur-[80px]" />
      </div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 text-center"
      >
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 mx-auto mb-6"
        >
          <div className="w-full h-full rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Music className="w-8 h-8 text-white" />
          </div>
        </motion.div>
        <h2 className="text-xl font-bold text-white mb-2">{message}</h2>
        {subMessage && <p className="text-gray-500 text-sm">{subMessage}</p>}
        
        {/* Loading dots */}
        <div className="flex justify-center gap-1 mt-4">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
              className="w-2 h-2 bg-purple-500 rounded-full"
            />
          ))}
        </div>
      </motion.div>
    </div>
  );

  if (!roomId) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10"
        >
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">No Room ID</h2>
          <p className="text-gray-400 mb-6">Please create or join a room from the home page.</p>
          <button
            onClick={() => navigate(createPageUrl('Landing'))}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl hover:opacity-90 transition-opacity"
          >
            Go to Home
          </button>
        </motion.div>
      </div>
    );
  }

  if (initializing || roomLoading || !userReady) {
    return <LoadingScreen message="Joining room..." subMessage="Setting up your session" />;
  }

  if (roomError) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-red-500/30"
        >
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Room Error</h2>
          <p className="text-red-400 mb-6">{roomError}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl hover:opacity-90 transition-opacity"
            >
              Retry
            </button>
            <button
              onClick={() => navigate(createPageUrl('Landing'))}
              className="px-6 py-3 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-colors"
            >
              Back to Home
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!room || !players || !Array.isArray(players) || (!isCrowdMode && !audioEngine.isReady)) {
    return <LoadingScreen message={isCrowdMode ? "Joining crowd..." : "Initializing audio..."} subMessage={isCrowdMode ? "Getting ready" : "Loading instruments"} />;
  }

  // Render crowd viewer for crowd mode users
  if (isCrowdMode) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] relative">
        {/* Subtle background gradient */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-fuchsia-500/10 rounded-full blur-[100px]" />
        </div>

        <div className="relative z-10">
          <RoomTopBar 
            room={room}
            roomId={roomId}
            playerCount={players.length}
            crowdCount={crowdMembers.length}
            isCrowdMode={true}
            {...roomControls}
          />

          <CrowdViewer
            room={room}
            roomId={roomId}
            userId={userId}
            displayName={displayName}
            color={color}
            players={players}
            crowdMembers={crowdMembers}
            crowdWebRTC={crowdWebRTC}
            isMobile={isMobile}
            isPortrait={isPortrait}
          />
        </div>
      </div>
    );
  }

  const handleClaimInstrument = async (instrument) => {
    // Prevent claiming if user already has an instrument
    if (currentPlayer?.instrument && currentPlayer.instrument !== instrument) {
      toast({
        title: 'Already Have Instrument',
        description: `You already have ${currentPlayer.instrument}. Release it first to claim a different instrument.`,
        variant: 'destructive',
        duration: 5000,
      });
      return;
    }

    // Prevent claiming if instrument is already taken
    if (!roomControls.isInstrumentAvailable(instrument)) {
      toast({
        title: 'Instrument Unavailable',
        description: 'This instrument is already claimed by another player.',
        variant: 'destructive',
        duration: 5000,
      });
      return;
    }

    try {
      await roomControls.claimMyInstrument(instrument);
      // No toast - silent claim for better UX
    } catch (error) {
      toast({
        title: 'Failed to Claim Instrument',
        description: error.message || 'Unable to claim instrument. Please try again.',
        variant: 'destructive',
        duration: 5000,
      });
    }
  };

  // Connection status indicator
  const ConnectionIndicator = () => {
    const connectedPeers = peers.filter(p => webrtc?.connectionStates?.[p.userId] === 'connected').length;
    const totalPeers = peers.length;
    const isConnected = connectedPeers > 0 || totalPeers === 0;
    
    return (
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
          isConnected ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
        }`}
      >
        {isConnected ? (
          <>
            <Wifi className="w-3.5 h-3.5" />
            <span>{totalPeers === 0 ? 'Ready' : `${connectedPeers}/${totalPeers} connected`}</span>
          </>
        ) : (
          <>
            <WifiOff className="w-3.5 h-3.5" />
            <span>Connecting...</span>
          </>
        )}
      </motion.div>
    );
  };

  // Show audio unlock screen for mobile
  if (showAudioUnlock && !audioUnlocked && !isCrowdMode) {
    return (
      <AudioUnlock 
        onUnlocked={handleAudioUnlocked}
        isMobile={isMobile}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] relative">
      {/* Focus Mode Overlay - Use MobileFocusView on mobile for premium experience */}
      <AnimatePresence>
        {focusMode && currentPlayer?.instrument && (
          isMobile ? (
            <MobileFocusView
              instrument={currentPlayer.instrument}
              player={currentPlayer}
              audioEngine={audioEngine}
              sendNote={sendNote}
              onExit={() => setFocusMode(false)}
              roomId={roomId}
              userId={userId}
              displayName={displayName}
              color={color}
              players={players}
              crowdMembers={crowdMembers}
              localStream={crowdWebRTC.localStream}
              remoteStreams={crowdWebRTC.remoteStreams}
              isBroadcasting={crowdWebRTC.isBroadcasting}
              onStartBroadcast={crowdWebRTC.startBroadcast}
              onStopBroadcast={crowdWebRTC.stopBroadcast}
              cameraError={crowdWebRTC.cameraError}
            />
          ) : (
            <FocusModeView
              instrument={currentPlayer.instrument}
              player={currentPlayer}
              audioEngine={audioEngine}
              sendNote={sendNote}
              onExit={() => setFocusMode(false)}
              roomId={roomId}
              userId={userId}
              displayName={displayName}
              crowdMembers={crowdMembers}
              localStream={crowdWebRTC.localStream}
              remoteStreams={crowdWebRTC.remoteStreams}
              isBroadcasting={crowdWebRTC.isBroadcasting}
              onStartBroadcast={crowdWebRTC.startBroadcast}
              onStopBroadcast={crowdWebRTC.stopBroadcast}
              isMobile={isMobile}
            />
          )
        )}
      </AnimatePresence>

      {/* Subtle background gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10">
        <RoomTopBar 
          room={room}
          roomId={roomId}
          playerCount={players.length}
          crowdCount={crowdMembers.length}
          wsConnected={wsConnected}
          onEnterFocusMode={handleEnterFocusMode}
          canEnterFocusMode={!!currentPlayer?.instrument}
          {...roomControls}
        />

        {/* Connection status bar - mobile only shows connection indicator */}
        <div className="container mx-auto px-4 py-2 flex items-center justify-between sm:hidden">
          <div className="flex items-center gap-4">
            <ConnectionIndicator />
          </div>
        </div>

        <div className="container mx-auto px-4 py-4 pb-safe">
          <AnimatePresence mode="wait">
            {!showInstruments ? (
              <motion.div 
                key="instrument-selection"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-6xl mx-auto"
              >
                <div className="text-center mb-8">
                  <motion.h2 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-3xl md:text-4xl font-black text-white mb-3"
                  >
                    Choose Your Instrument
                  </motion.h2>
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="text-gray-400"
                  >
                    Select an available instrument to start jamming
                  </motion.p>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                  {['DRUMS', 'BASS', 'EP', 'GUITAR'].map((inst, i) => (
                    <motion.div
                      key={inst}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.05 }}
                    >
                      <InstrumentSlot
                        instrument={inst}
                        player={roomControls.getPlayerByInstrument(inst)}
                        isAvailable={roomControls.isInstrumentAvailable(inst)}
                        onClaim={() => handleClaimInstrument(inst)}
                        currentUserId={userId}
                        currentPlayerInstrument={currentPlayer?.instrument}
                      />
                    </motion.div>
                  ))}
                </div>

                {/* Players list */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="mt-8 bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="w-5 h-5 text-purple-400" />
                    <h3 className="text-lg font-semibold text-white">Players in Room</h3>
                  </div>
                  
                  {players.length === 0 ? (
                    <div className="text-center py-6">
                      <div className="text-gray-500 text-sm">Waiting for players to join...</div>
                      <div className="text-gray-600 text-xs mt-2">Share the room code to invite friends</div>
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {players.map(player => (
                        <motion.div 
                          key={player.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center gap-3 bg-white/5 rounded-lg p-3"
                        >
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                            style={{ backgroundColor: player.color }}
                          >
                            {player.displayName?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-medium text-sm truncate">{player.displayName}</div>
                            {player.instrument ? (
                              <div className="text-purple-400 text-xs">{player.instrument}</div>
                            ) : (
                              <div className="text-gray-500 text-xs">Choosing...</div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              </motion.div>
            ) : (
              <motion.div 
                key="instruments"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`
                  ${isMobile && isPortrait 
                    ? 'flex flex-col gap-4' 
                    : 'grid lg:grid-cols-4 gap-4 sm:gap-6'
                  }
                `}
              >
                <div className={isMobile && isPortrait ? 'order-1' : 'lg:col-span-3 order-1'}>
                  <InstrumentGrid
                    players={players}
                    currentPlayer={currentPlayer}
                    audioEngine={audioEngine}
                    sendNote={sendNote}
                    room={room}
                    activityTriggersRef={activityTriggersRef}
                    focusModeActive={focusMode}
                  />
                </div>

                <div className={isMobile && isPortrait ? 'order-2' : 'lg:col-span-1 order-2 lg:order-2'}>
                  <div className="space-y-4">
                    <ChatPanel
                      roomId={roomId}
                      userId={userId}
                      displayName={displayName}
                      isMobile={isMobile}
                      isPortrait={isPortrait}
                    />
                    
                    {/* Crowd Panel - shows all crowd members' video feeds */}
                    <CrowdPanel
                      roomId={roomId}
                      userId={userId}
                      displayName={displayName}
                      color={color}
                      isCrowd={isCrowdMode}
                      crowdMembers={crowdMembers}
                      localStream={crowdWebRTC.localStream}
                      remoteStreams={crowdWebRTC.remoteStreams}
                      isBroadcasting={crowdWebRTC.isBroadcasting}
                      cameraError={crowdWebRTC.cameraError}
                      onStartBroadcast={crowdWebRTC.startBroadcast}
                      onStopBroadcast={crowdWebRTC.stopBroadcast}
                      isMobile={isMobile}
                      isPortrait={isPortrait}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
