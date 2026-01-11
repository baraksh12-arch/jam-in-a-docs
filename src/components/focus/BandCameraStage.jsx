import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Video, 
  VideoOff, 
  Users, 
  Mic,
  MicOff,
  Music,
  Eye,
  Camera,
  Maximize2
} from 'lucide-react';

/**
 * BandCameraStage - Full Stage View with Band & Crowd Cameras
 * 
 * Premium Apple-style camera stage showing:
 * - 8 camera slots per side (left: band, right: crowd)
 * - Real-time video feeds
 * - Instrument indicators for band members
 * - Professional broadcast aesthetic
 */

// Instrument icons for band members
const INSTRUMENT_ICONS = {
  DRUMS: '🥁',
  BASS: '🎸',
  EP: '🎹',
  GUITAR: '🎸'
};

// Camera tile component
const CameraTile = ({ 
  stream, 
  displayName, 
  color, 
  instrument,
  isLocal = false,
  isBand = false,
  placeholder = false
}) => {
  const videoRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);

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
      exit={{ scale: 0.9, opacity: 0 }}
      className={`
        relative aspect-[4/3] rounded-xl overflow-hidden
        ${placeholder 
          ? 'bg-white/5 border border-dashed border-white/10' 
          : 'bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-white/10'
        }
        ${isLocal ? 'ring-2 ring-cyan-400/50' : ''}
      `}
    >
      {/* Video stream */}
      {stream && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`
            absolute inset-0 w-full h-full object-cover
            ${isLocal ? 'transform scale-x-[-1]' : ''}
            ${isLoaded ? 'opacity-100' : 'opacity-0'}
            transition-opacity duration-300
          `}
        />
      )}

      {/* Placeholder content */}
      {(!stream || placeholder) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {placeholder ? (
            <Camera className="w-6 h-6 text-white/20" />
          ) : (
            <>
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-lg mb-2"
                style={{ backgroundColor: color || '#6366f1' }}
              >
                {displayName?.[0]?.toUpperCase() || '?'}
              </div>
              {isBand && instrument && (
                <span className="text-lg">{INSTRUMENT_ICONS[instrument]}</span>
              )}
            </>
          )}
        </div>
      )}

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

      {/* Name badge */}
      {!placeholder && (
        <div className="absolute bottom-0 left-0 right-0 p-2">
          <div className="flex items-center gap-1.5">
            {isLocal && (
              <span className="px-1.5 py-0.5 bg-cyan-500/30 text-cyan-300 text-[8px] font-bold rounded uppercase">
                You
              </span>
            )}
            <span className="text-white text-[10px] font-medium truncate">
              {displayName || (isBand ? 'Band' : 'Viewer')}
            </span>
            {isBand && instrument && (
              <span className="text-[10px]">{INSTRUMENT_ICONS[instrument]}</span>
            )}
          </div>
        </div>
      )}

      {/* Live indicator */}
      {stream && !placeholder && (
        <div className="absolute top-2 right-2">
          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-red-500/90 rounded-full">
            <div className="w-1 h-1 bg-white rounded-full animate-pulse" />
            <span className="text-[8px] font-bold text-white">LIVE</span>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default function BandCameraStage({
  players = [],
  crowdMembers = [],
  localStream,
  remoteStreams = {},
  userId,
  displayName,
  color,
  isBroadcasting,
  onStartBroadcast,
  onStopBroadcast,
  onClose
}) {
  // Prepare band members (players with instruments)
  const bandMembers = players.filter(p => p.instrument).slice(0, 8);
  const bandSlots = 8;
  
  // Prepare crowd members
  const crowdSlots = 8;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 bg-black/90 backdrop-blur-xl"
    >
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-violet-600/10 to-transparent rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-black/40 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-500/20 rounded-xl">
            <Video className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h2 className="text-white font-bold">Stage View</h2>
            <p className="text-white/50 text-xs">Band & Crowd Cameras</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Main content */}
      <div className="absolute inset-0 top-16 bottom-20 flex gap-4 p-4">
        {/* Left side - Band cameras */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <Music className="w-4 h-4 text-purple-400" />
            <span className="text-white/80 text-sm font-medium">Band</span>
            <span className="text-white/40 text-xs">({bandMembers.length})</span>
          </div>
          
          <div className="flex-1 grid grid-cols-2 gap-2 auto-rows-fr">
            {Array.from({ length: bandSlots }).map((_, idx) => {
              const member = bandMembers[idx];
              const memberId = member?.userId || member?.id;
              const stream = memberId === userId ? localStream : remoteStreams[memberId];
              
              return (
                <CameraTile
                  key={memberId || `band-slot-${idx}`}
                  stream={stream}
                  displayName={member?.displayName}
                  color={member?.color}
                  instrument={member?.instrument}
                  isLocal={memberId === userId}
                  isBand={true}
                  placeholder={!member}
                />
              );
            })}
          </div>
        </div>

        {/* Center divider */}
        <div className="w-px bg-gradient-to-b from-transparent via-white/20 to-transparent" />

        {/* Right side - Crowd cameras */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <Eye className="w-4 h-4 text-cyan-400" />
            <span className="text-white/80 text-sm font-medium">Crowd</span>
            <span className="text-white/40 text-xs">({crowdMembers.length})</span>
          </div>
          
          <div className="flex-1 grid grid-cols-2 gap-2 auto-rows-fr">
            {Array.from({ length: crowdSlots }).map((_, idx) => {
              const member = crowdMembers[idx];
              const memberId = member?.userId || member?.oduserId;
              const stream = memberId === userId ? localStream : remoteStreams[memberId];
              
              return (
                <CameraTile
                  key={memberId || `crowd-slot-${idx}`}
                  stream={stream}
                  displayName={member?.displayName}
                  color={member?.color}
                  isLocal={memberId === userId}
                  isBand={false}
                  placeholder={!member}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-4 px-4 py-4 bg-black/60 backdrop-blur-sm border-t border-white/10">
        {/* Camera control */}
        {isBroadcasting ? (
          <button
            onClick={onStopBroadcast}
            className="flex items-center gap-2 px-6 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl text-red-400 font-medium transition-colors"
          >
            <VideoOff className="w-5 h-5" />
            <span>Stop Camera</span>
          </button>
        ) : (
          <button
            onClick={onStartBroadcast}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 rounded-xl text-white font-medium shadow-lg shadow-violet-500/25 transition-all"
          >
            <Video className="w-5 h-5" />
            <span>Start Camera</span>
          </button>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 px-4 py-2 bg-white/5 rounded-xl">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-purple-400" />
            <span className="text-white text-sm">{bandMembers.length}</span>
          </div>
          <div className="w-px h-4 bg-white/20" />
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-400" />
            <span className="text-white text-sm">{crowdMembers.length}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
