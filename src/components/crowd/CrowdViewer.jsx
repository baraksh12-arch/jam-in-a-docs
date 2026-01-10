import React, { useState, useEffect } from 'react';
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
  MessageCircle,
  Camera,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import CrowdPanel from './CrowdPanel';
import ChatPanel from '../ChatPanel';

/**
 * CrowdViewer - Main view for crowd members watching a jam session
 * 
 * Features:
 * - Watch live performance (audio)
 * - Broadcast camera (video only, no audio)
 * - See other crowd members
 * - Chat with everyone
 */
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

  const isMobilePortrait = isMobile && isPortrait;
  const totalViewers = crowdMembers.length;
  const activePlayers = players.filter(p => p.instrument);

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col">
      {/* Main content area */}
      <div className={`
        flex-1 container mx-auto px-4 py-4
        ${isMobilePortrait ? 'flex flex-col gap-4' : 'grid lg:grid-cols-3 gap-6'}
      `}>
        {/* Left/Main: Performance View */}
        <div className={isMobilePortrait ? 'order-1' : 'lg:col-span-2'}>
          {/* Crowd Welcome Banner */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card className="bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20 border-violet-500/30 overflow-hidden relative">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
              <CardContent className="p-6 relative">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-violet-500/20 rounded-2xl">
                      <Eye className="w-8 h-8 text-violet-400" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white mb-1">
                        You're in the Crowd
                      </h2>
                      <p className="text-violet-300/80 text-sm">
                        Watch the performance • Share your reaction • Vibe together
                      </p>
                    </div>
                  </div>
                  
                  {/* Live indicator */}
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-full">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-red-400 text-sm font-medium">LIVE</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Performance Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
          >
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-4 text-center">
                <Users className="w-5 h-5 text-cyan-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">{activePlayers.length}</div>
                <div className="text-gray-500 text-xs">Playing Now</div>
              </CardContent>
            </Card>
            
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-4 text-center">
                <Eye className="w-5 h-5 text-violet-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">{totalViewers}</div>
                <div className="text-gray-500 text-xs">Watching</div>
              </CardContent>
            </Card>
            
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-4 text-center">
                <Music className="w-5 h-5 text-pink-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">{room?.bpm || 120}</div>
                <div className="text-gray-500 text-xs">BPM</div>
              </CardContent>
            </Card>
            
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-4 text-center">
                <Sparkles className="w-5 h-5 text-amber-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">{room?.key || 'C'}</div>
                <div className="text-gray-500 text-xs">Key</div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Active Players Display */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-slate-800/60 border-white/10">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Music className="w-5 h-5 text-cyan-400" />
                    <h3 className="text-white font-semibold">Live Performance</h3>
                  </div>
                  
                  {room?.isPlaying && (
                    <div className="flex items-center gap-2 text-green-400">
                      <Play className="w-4 h-4" />
                      <span className="text-sm font-medium">Playing</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {activePlayers.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {activePlayers.map((player, index) => (
                      <motion.div
                        key={player.userId || player.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 * index }}
                        className="bg-white/5 rounded-xl p-4 text-center border border-white/5 hover:border-white/20 transition-colors"
                      >
                        <div 
                          className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center text-white font-bold text-lg shadow-lg"
                          style={{ backgroundColor: player.color }}
                        >
                          {player.displayName?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="text-white font-medium text-sm truncate mb-1">
                          {player.displayName}
                        </div>
                        <div className="text-xs px-2 py-1 bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 rounded-full inline-block">
                          {player.instrument}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Music className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500">Waiting for musicians to join...</p>
                    <p className="text-gray-600 text-sm mt-1">The jam session will start soon</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Right Sidebar: Crowd + Chat */}
        <div className={isMobilePortrait ? 'order-2' : 'lg:col-span-1'}>
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
                  {crowdWebRTC.cameraError ? (
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
                  ) : crowdWebRTC.isBroadcasting ? (
                    <div className="space-y-3">
                      {/* Local video preview */}
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
                        onClick={crowdWebRTC.startBroadcast}
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

            {/* Crowd Panel */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <CrowdPanel
                roomId={roomId}
                userId={userId}
                displayName={displayName}
                color={color}
                isCrowd={true}
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
            </motion.div>

            {/* Chat */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              <ChatPanel
                roomId={roomId}
                userId={userId}
                displayName={displayName}
                isMobile={isMobile}
                isPortrait={isPortrait}
              />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
