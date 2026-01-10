import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, X, Video, VideoOff, Minimize2, Maximize2, Eye } from 'lucide-react';

/**
 * MiniVideoTile - Compact video tile for floating widget
 */
const MiniVideoTile = React.memo(({ stream, displayName, color, isLocal = false }) => {
  const videoRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const initial = displayName?.[0]?.toUpperCase() || '?';

  return (
    <div className={`
      relative aspect-square rounded-xl overflow-hidden
      bg-gradient-to-br from-slate-700/80 to-slate-800/80
      ${isLocal ? 'ring-2 ring-cyan-400/50' : ''}
    `}>
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedData={() => setIsLoaded(true)}
          className={`
            absolute inset-0 w-full h-full object-cover
            ${isLoaded ? 'opacity-100' : 'opacity-0'}
            ${isLocal ? 'transform scale-x-[-1]' : ''}
          `}
        />
      ) : null}

      {/* Placeholder */}
      {(!stream || !isLoaded) && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div 
            className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs"
            style={{ backgroundColor: color || '#6366f1' }}
          >
            {initial}
          </div>
        </div>
      )}

      {/* Name badge */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-1">
        <div className="flex items-center gap-1">
          {isLocal && (
            <span className="px-1 py-0.5 bg-cyan-500/50 text-[8px] text-cyan-200 font-bold rounded uppercase">
              You
            </span>
          )}
          <span className="text-white text-[9px] truncate">{displayName || 'Viewer'}</span>
        </div>
      </div>

      {/* Live indicator for local */}
      {isLocal && stream && (
        <div className="absolute top-1 right-1 flex items-center gap-0.5 px-1 py-0.5 bg-red-500/90 rounded-full">
          <div className="w-1 h-1 bg-white rounded-full animate-pulse" />
          <span className="text-[7px] font-bold text-white">LIVE</span>
        </div>
      )}
    </div>
  );
});

MiniVideoTile.displayName = 'MiniVideoTile';

/**
 * FloatingCrowdWidget - Compact crowd viewer for Focus Mode
 * Premium glass morphism with minimal footprint
 */
export default function FloatingCrowdWidget({
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
  const [isExpanded, setIsExpanded] = useState(false);
  
  const totalCount = crowdMembers.length + (localStream ? 1 : 0);

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.9, opacity: 0, y: 20 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className={`
        relative overflow-hidden
        backdrop-blur-2xl bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90
        border border-white/10 rounded-2xl
        shadow-2xl shadow-black/40
        transition-all duration-300 ease-out
        ${isExpanded ? 'w-80' : 'w-72 h-14'}
      `}
    >
      {/* Gradient border effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-transparent to-blue-500/20 pointer-events-none opacity-50" />
      
      {/* Header */}
      <div 
        className="relative flex items-center justify-between px-4 py-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/30">
              <Users className="w-4 h-4 text-white" />
            </div>
            {totalCount > 0 && !isExpanded && (
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center"
              >
                <span className="text-[10px] font-bold text-white">{totalCount}</span>
              </motion.div>
            )}
          </div>
          <div>
            <span className="text-white font-semibold text-sm">Crowd</span>
            {!isExpanded && (
              <span className="text-white/40 text-xs ml-2">
                {totalCount > 0 ? `${totalCount} live` : 'No viewers'}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-all"
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose?.();
            }}
            className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="px-3 pb-3"
          >
            {/* Camera control */}
            {!isBroadcasting ? (
              <button
                onClick={onStartBroadcast}
                className="
                  w-full mb-3 py-2.5 rounded-xl
                  bg-gradient-to-r from-cyan-500/20 to-blue-500/20
                  hover:from-cyan-500/30 hover:to-blue-500/30
                  border border-cyan-500/30
                  text-cyan-300 text-sm font-medium
                  flex items-center justify-center gap-2
                  transition-all
                "
              >
                <Video className="w-4 h-4" />
                Start Camera
              </button>
            ) : (
              <div className="flex items-center justify-between mb-3 px-3 py-2 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-cyan-300 text-sm font-medium">Broadcasting</span>
                </div>
                <button
                  onClick={onStopBroadcast}
                  className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
                >
                  <VideoOff className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Video grid */}
            {totalCount > 0 ? (
              <div className="grid grid-cols-3 gap-2 max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                {/* Local stream */}
                {localStream && (
                  <MiniVideoTile
                    stream={localStream}
                    displayName={displayName}
                    color={color}
                    isLocal={true}
                  />
                )}
                
                {/* Remote streams */}
                {crowdMembers
                  .filter(member => {
                    const memberId = member.userId || member.oduserId;
                    return memberId !== userId;
                  })
                  .slice(0, 8) // Limit to 8 for compact view
                  .map(member => {
                    const memberId = member.userId || member.oduserId;
                    const stream = remoteStreams[memberId];
                    
                    return (
                      <MiniVideoTile
                        key={memberId}
                        stream={stream}
                        displayName={member.displayName}
                        color={member.color}
                      />
                    );
                  })
                }
              </div>
            ) : (
              <div className="py-6 text-center">
                <Eye className="w-8 h-8 mx-auto text-white/20 mb-2" />
                <p className="text-white/30 text-sm">No viewers yet</p>
              </div>
            )}

            {/* Stats footer */}
            {totalCount > 0 && (
              <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-white/30">
                <span>{totalCount} viewer{totalCount !== 1 ? 's' : ''}</span>
                <span>Video only</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
