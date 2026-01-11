import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Eye, 
  Video, 
  VideoOff, 
  Users, 
  Music, 
  Play, 
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  MessageCircle,
  Camera,
  Sparkles,
  ArrowLeft,
  Disc
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import CrowdPanel from './CrowdPanel';
import ChatPanel from '../ChatPanel';

/**
 * CrowdViewer - Main view for crowd members watching a jam session
 * 
 * Premium Apple-style viewer experience with:
 * - Full stage view showing band cameras and instruments
 * - Real-time instrument display showing what players are doing
 * - 8 camera slots per side for crowd/band
 * - Floating chat and controls
 */

// Instrument visualization data
const INSTRUMENT_VISUALS = {
  DRUMS: { icon: '🥁', color: 'from-rose-500 to-orange-500', label: 'Drums' },
  BASS: { icon: '🎸', color: 'from-cyan-500 to-blue-500', label: 'Bass' },
  EP: { icon: '🎹', color: 'from-violet-500 to-purple-500', label: 'Piano' },
  GUITAR: { icon: '🎸', color: 'from-emerald-500 to-green-500', label: 'Guitar' }
};

// Band Member Video Card for stage view
const BandMemberCard = ({ player, stream, isActive }) => {
  const videoRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const instrument = INSTRUMENT_VISUALS[player?.instrument];

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      setIsLoaded(true);
    }
  }, [stream]);

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`
        relative aspect-video rounded-2xl overflow-hidden
        bg-gradient-to-br from-slate-800/90 to-slate-900/90
        border-2 ${isActive ? 'border-green-400/50' : 'border-white/10'}
        shadow-2xl
      `}
    >
      {/* Video feed */}
      {stream && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity`}
        />
      )}

      {/* Placeholder when no stream */}
      {!stream && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.div
            animate={isActive ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.5, repeat: Infinity }}
            className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${instrument?.color || 'from-gray-600 to-gray-700'} flex items-center justify-center shadow-2xl mb-4`}
          >
            <span className="text-4xl">{instrument?.icon || '🎵'}</span>
          </motion.div>
          <span className="text-white font-bold text-lg">{player?.displayName}</span>
          <span className="text-white/60 text-sm">{instrument?.label || 'Musician'}</span>
        </div>
      )}

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

      {/* Player info */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-lg"
              style={{ backgroundColor: player?.color || '#6366f1' }}
            >
              {player?.displayName?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <span className="text-white font-semibold block">{player?.displayName}</span>
              <span className="text-white/60 text-sm flex items-center gap-1">
                <span className="text-lg">{instrument?.icon}</span>
                {instrument?.label}
              </span>
            </div>
          </div>
          
          {/* Activity indicator */}
          {isActive && (
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 rounded-full"
            >
              <div className="w-2 h-2 bg-green-400 rounded-full" />
              <span className="text-green-400 text-xs font-medium">Playing</span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Live badge */}
      {stream && (
        <div className="absolute top-3 right-3">
          <div className="flex items-center gap-1 px-2 py-1 bg-red-500/90 rounded-full">
            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-white">LIVE</span>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default function CrowdViewer({
  room,
  roomId,
  userId,
  displayName,
  color,
  players = [],
  crowdMembers = [],
  crowdWebRTC,
  isMobile = false,
  isPortrait = false
}) {
  const [showChat, setShowChat] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const isMobilePortrait = isMobile && isPortrait;
  const totalViewers = crowdMembers.length;
  const activePlayers = players.filter(p => p.instrument);

  // Auto-hide controls after inactivity
  useEffect(() => {
    let timeout;
    if (isFullscreen) {
      timeout = setTimeout(() => setShowControls(false), 3000);
    }
    return () => clearTimeout(timeout);
  }, [isFullscreen, showControls]);

  // Show controls on touch/mouse movement
  const handleInteraction = () => {
    setShowControls(true);
  };

  return (
    <div 
      className="min-h-[calc(100vh-80px)] flex flex-col"
      onMouseMove={handleInteraction}
      onTouchStart={handleInteraction}
    >
      {/* Main Stage View - Full width band display */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative flex-1"
      >
        {/* Stage background */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-800/50 to-black">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMiI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')]" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-radial from-violet-600/20 to-transparent rounded-full blur-[100px]" />
        </div>

        {/* Stage header with stats */}
        <div className="relative z-10 px-4 py-4">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            {/* Left: Live indicator */}
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="flex items-center gap-4"
            >
              <div className="flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-full">
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-2.5 h-2.5 bg-red-500 rounded-full"
                />
                <span className="text-red-400 font-bold text-sm tracking-wider">LIVE</span>
              </div>
              <div className="text-white/60 text-sm">
                <span className="text-white font-bold">{activePlayers.length}</span> musicians
                <span className="mx-2">•</span>
                <span className="text-white font-bold">{totalViewers}</span> watching
              </div>
            </motion.div>

            {/* Center: Room info */}
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-3"
            >
              <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10">
                <span className="text-white/60 text-xs">BPM</span>
                <span className="text-white font-bold ml-2">{room?.bpm || 120}</span>
              </div>
              <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10">
                <span className="text-white/60 text-xs">Key</span>
                <span className="text-white font-bold ml-2">{room?.key || 'C'}</span>
              </div>
            </motion.div>

            {/* Right: Controls */}
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-2"
            >
              <Button
                onClick={() => setShowChat(!showChat)}
                variant="ghost"
                className={`${showChat ? 'bg-violet-500/20 text-violet-400' : 'text-white/60 hover:text-white'}`}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Chat
              </Button>
            </motion.div>
          </div>
        </div>

        {/* Main stage with band members */}
        <div className="relative z-10 px-4 pb-8">
          <div className="max-w-7xl mx-auto">
            {activePlayers.length > 0 ? (
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className={`
                  grid gap-4
                  ${activePlayers.length === 1 ? 'grid-cols-1 max-w-2xl mx-auto' : ''}
                  ${activePlayers.length === 2 ? 'grid-cols-2 max-w-4xl mx-auto' : ''}
                  ${activePlayers.length === 3 ? 'grid-cols-3' : ''}
                  ${activePlayers.length >= 4 ? 'grid-cols-2 md:grid-cols-4' : ''}
                `}
              >
                {activePlayers.map((player, index) => (
                  <BandMemberCard
                    key={player.userId || player.id}
                    player={player}
                    stream={crowdWebRTC?.remoteStreams?.[player.userId]}
                    isActive={room?.isPlaying}
                  />
                ))}
              </motion.div>
            ) : (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center justify-center py-20"
              >
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center mb-6"
                >
                  <Disc className="w-12 h-12 text-violet-400" />
                </motion.div>
                <h3 className="text-2xl font-bold text-white mb-2">Waiting for the show</h3>
                <p className="text-white/50 text-center max-w-md">
                  Musicians are getting ready. The jam session will start soon!
                </p>
              </motion.div>
            )}
          </div>
        </div>

        {/* Crowd Camera Strip - 8 slots at bottom */}
        <div className="relative z-10 px-4 pb-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-2 mb-3">
              <Eye className="w-4 h-4 text-cyan-400" />
              <span className="text-white/60 text-sm">Crowd Reactions</span>
              <span className="text-cyan-400 text-sm font-medium">({totalViewers})</span>
            </div>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
              {/* Local camera first */}
              {crowdWebRTC?.localStream && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="relative aspect-square rounded-xl overflow-hidden bg-slate-800 ring-2 ring-cyan-400/50"
                >
                  <video
                    autoPlay
                    playsInline
                    muted
                    ref={el => { if (el && crowdWebRTC.localStream) el.srcObject = crowdWebRTC.localStream; }}
                    className="w-full h-full object-cover transform scale-x-[-1]"
                  />
                  <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-cyan-500/90 rounded text-[8px] font-bold text-white">
                    YOU
                  </div>
                </motion.div>
              )}
              
              {/* Other crowd members */}
              {crowdMembers.filter(m => (m.userId || m.oduserId) !== userId).slice(0, 7).map((member, idx) => {
                const memberId = member.userId || member.oduserId;
                const stream = crowdWebRTC?.remoteStreams?.[memberId];
                
                return (
                  <motion.div
                    key={memberId}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    className="relative aspect-square rounded-xl overflow-hidden bg-slate-800/50 border border-white/10"
                  >
                    {stream ? (
                      <video
                        autoPlay
                        playsInline
                        muted
                        ref={el => { if (el) el.srcObject = stream; }}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs"
                          style={{ backgroundColor: member.color || '#6366f1' }}
                        >
                          {member.displayName?.[0]?.toUpperCase() || '?'}
                        </div>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-black/80 to-transparent">
                      <span className="text-white text-[8px] truncate block">{member.displayName}</span>
                    </div>
                  </motion.div>
                );
              })}
              
              {/* Empty slots */}
              {Array.from({ length: Math.max(0, 8 - (crowdWebRTC?.localStream ? 1 : 0) - crowdMembers.filter(m => (m.userId || m.oduserId) !== userId).length) }).map((_, idx) => (
                <div 
                  key={`empty-${idx}`}
                  className="aspect-square rounded-xl bg-white/5 border border-dashed border-white/10 flex items-center justify-center"
                >
                  <Camera className="w-4 h-4 text-white/20" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Side panels */}
      <div className={`
        ${isMobilePortrait ? 'fixed bottom-0 left-0 right-0 z-20' : 'container mx-auto px-4 pb-4'}
        ${isMobilePortrait ? '' : 'grid lg:grid-cols-4 gap-4'}
      `}>
        {/* Left/Main: Hidden on mobile portrait (stage is full view) */}
        {!isMobilePortrait && <div className="lg:col-span-3" />}

        {/* Right Sidebar: Camera + Chat */}
        <div className={`${isMobilePortrait ? 'order-2' : 'lg:col-span-1'}`}>
          <div className="space-y-4">
            {/* Your Camera - Prominent */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="bg-gradient-to-br from-violet-600/10 to-fuchsia-600/10 border-violet-500/20">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Camera className="w-5 h-5 text-violet-400" />
                    <h3 className="text-white font-semibold">Your Camera</h3>
                  </div>
                </CardHeader>
                <CardContent>
                  {crowdWebRTC?.cameraError ? (
                    <div className="text-center py-4">
                      <VideoOff className="w-8 h-8 text-red-400 mx-auto mb-2" />
                      <p className="text-red-400 text-sm mb-3">{crowdWebRTC.cameraError}</p>
                      <Button
                        onClick={crowdWebRTC.startBroadcast}
                        variant="outline"
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                      >
                        Try Again
                      </Button>
                    </div>
                  ) : crowdWebRTC?.isBroadcasting ? (
                    <div className="space-y-3">
                      <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-900">
                        <video
                          autoPlay
                          playsInline
                          muted
                          ref={(video) => {
                            if (video && crowdWebRTC.localStream) {
                              video.srcObject = crowdWebRTC.localStream;
                            }
                          }}
                          className="w-full h-full object-cover transform scale-x-[-1]"
                        />
                        <div className="absolute top-2 right-2">
                          <div className="flex items-center gap-1 px-2 py-1 bg-red-500/90 rounded-full">
                            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                            <span className="text-[10px] font-bold text-white">LIVE</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick={crowdWebRTC.stopBroadcast}
                        variant="outline"
                        className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10"
                      >
                        <VideoOff className="w-4 h-4 mr-2" />
                        Stop Camera
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-gray-400 text-sm mb-4">
                        Share your reaction with everyone watching!
                      </p>
                      <Button
                        onClick={crowdWebRTC?.startBroadcast}
                        className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium shadow-lg shadow-violet-500/25"
                      >
                        <Video className="w-4 h-4 mr-2" />
                        Start Camera
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

                    {/* Chat */}
            <AnimatePresence>
              {showChat && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: 0.4 }}
                >
                  <ChatPanel
                    roomId={roomId}
                    userId={userId}
                    displayName={displayName}
                    isMobile={isMobile}
                    isPortrait={isPortrait}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
