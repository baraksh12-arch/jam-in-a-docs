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
import CrowdViewer from '../components/crowd/CrowdViewer';
import { UnifiedFocusView } from '../components/focus';
import AudioUnlock from '../components/audio/AudioUnlock';
import { useMIDIInstrument } from '../hooks/useMIDI';
import { AlertCircle, Music, Wifi, WifiOff, Users, Share2, Check } from 'lucide-react';
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
  const [focusMode, setFocusMode] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [showAudioUnlock, setShowAudioUnlock] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Copy room link function for instrument selection page
  const handleCopyLink = useCallback(() => {
    const url = `${window.location.origin}${window.location.pathname}?id=${roomId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [roomId]);
  
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

  // Auto-enter focus mode when instrument is selected (both mobile AND desktop)
  useEffect(() => {
    if (currentPlayer?.instrument && audioUnlocked && !focusMode) {
      // Enter focus mode immediately
      setFocusMode(true);
    }
  }, [currentPlayer?.instrument, audioUnlocked, focusMode]);

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

  // If focus mode is active, ONLY render the UnifiedFocusView (nothing else)
  if (focusMode && currentPlayer?.instrument) {
    return (
      <UnifiedFocusView
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
        isMobile={isMobile}
        room={room}
        roomControls={roomControls}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] relative">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10">
        <div className="container mx-auto px-4 py-4 pb-safe">
          {/* Instrument Selection Page - shown when no instrument is selected */}
          <AnimatePresence mode="wait">
            {!currentPlayer?.instrument && (
              <motion.div 
                key="instrument-selection"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-3xl mx-auto min-h-screen flex flex-col justify-center py-8"
              >
                {/* Header with Title */}
                <div className="text-center mb-8">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center justify-center gap-3 mb-4"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
                      <Music className="w-6 h-6 text-white" />
                    </div>
                  </motion.div>
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

                {/* Instrument Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
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

                {/* Ready Status & Share Row - Combined in one clean row */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mb-8"
                >
                  {/* Ready indicator */}
                  <div className="flex items-center gap-3 px-6 py-3 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10">
                    <motion.div 
                      animate={{ scale: [1, 1.2, 1], opacity: [1, 0.6, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-3 h-3 bg-emerald-400 rounded-full shadow-lg shadow-emerald-400/50"
                    />
                    <span className="text-white font-semibold">Ready to Play</span>
                  </div>

                  {/* Room code & Share button */}
                  <div className="flex items-center gap-3 px-4 py-3 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10">
                    <div className="flex flex-col">
                      <span className="text-white/50 text-xs uppercase tracking-wider">Room</span>
                      <span className="text-white font-mono font-bold text-lg">{roomId?.toUpperCase()}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyLink}
                      className={`
                        relative overflow-hidden rounded-xl px-4 py-2 text-sm font-medium transition-all duration-300
                        ${copied 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                          : 'bg-white/10 text-white border border-white/20 hover:bg-white/20'
                        }
                      `}
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Share2 className="w-4 h-4 mr-2" />
                          Share
                        </>
                      )}
                    </Button>
                  </div>
                </motion.div>

                {/* Compact Players list */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-purple-400" />
                      <h3 className="text-sm font-semibold text-white">Players ({players.length})</h3>
                    </div>
                    <ConnectionIndicator />
                  </div>
                  
                  {players.length === 0 ? (
                    <div className="text-center py-4">
                      <div className="text-gray-500 text-sm">Waiting for players to join...</div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {players.map(player => (
                        <motion.div 
                          key={player.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="flex items-center gap-2 bg-white/5 rounded-full px-3 py-1.5"
                        >
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs"
                            style={{ backgroundColor: player.color }}
                          >
                            {player.displayName?.[0]?.toUpperCase() || '?'}
                          </div>
                          <span className="text-white text-sm font-medium">{player.displayName}</span>
                          {player.instrument && (
                            <span className="text-purple-400 text-xs">• {player.instrument}</span>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
