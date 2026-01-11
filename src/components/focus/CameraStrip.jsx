import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, VideoOff, Camera, User } from 'lucide-react';

/**
 * CameraStrip - Compact camera display for Focus Mode
 * 
 * Shows band member cameras in a slim strip above or below the instrument
 * Rotates through cameras or shows all in a compact grid
 */

const CameraFeed = ({ stream, name, color, isLocal = false, isMuted = false }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative aspect-video bg-black/50 rounded-xl overflow-hidden group">
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal || isMuted}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${color}40` }}
          >
            <User className="w-6 h-6" style={{ color }} />
          </div>
        </div>
      )}

      {/* Name label */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
        <div className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="text-white text-[10px] font-medium truncate">
            {name} {isLocal && '(You)'}
          </span>
        </div>
      </div>

      {/* Live indicator */}
      {stream && (
        <div className="absolute top-2 right-2">
          <motion.div
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex items-center gap-1 px-1.5 py-0.5 bg-red-500/80 rounded-full"
          >
            <div className="w-1.5 h-1.5 bg-white rounded-full" />
            <span className="text-white text-[8px] font-bold">LIVE</span>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default function CameraStrip({
  players = [],
  localStream,
  remoteStreams = {},
  userId,
  displayName,
  color,
  position = 'top', // 'top' or 'bottom'
  onClose,
  autoRotate = true
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState('single'); // 'single' or 'grid'

  // Get all camera feeds
  const allFeeds = [
    // Local user first
    ...(localStream ? [{
      id: userId,
      stream: localStream,
      name: displayName,
      color: color,
      isLocal: true
    }] : []),
    // Remote feeds
    ...players
      .filter(p => p.userId !== userId && remoteStreams[p.userId])
      .map(p => ({
        id: p.userId,
        stream: remoteStreams[p.userId],
        name: p.displayName,
        color: p.color || '#8b5cf6',
        isLocal: false
      }))
  ];

  // Auto-rotate through feeds in single view
  useEffect(() => {
    if (!autoRotate || viewMode !== 'single' || allFeeds.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % allFeeds.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRotate, viewMode, allFeeds.length]);

  if (allFeeds.length === 0) {
    return null;
  }

  const positionClass = position === 'top'
    ? 'top-0 left-0 right-0'
    : 'bottom-0 left-0 right-0';

  return (
    <motion.div
      initial={{ opacity: 0, y: position === 'top' ? -50 : 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: position === 'top' ? -50 : 50 }}
      className={`absolute ${positionClass} z-20 p-2`}
    >
      <div className="bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-cyan-400" />
            <span className="text-white/70 text-xs font-medium">
              Band Cameras ({allFeeds.length})
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            {allFeeds.length > 1 && (
              <div className="flex gap-1 p-0.5 bg-white/10 rounded-lg">
                <button
                  onClick={() => setViewMode('single')}
                  className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                    viewMode === 'single' 
                      ? 'bg-white text-black' 
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  Single
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                    viewMode === 'grid' 
                      ? 'bg-white text-black' 
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  Grid
                </button>
              </div>
            )}

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <VideoOff className="w-3 h-3 text-white/50" />
            </button>
          </div>
        </div>

        {/* Camera feeds */}
        <div className="p-2">
          <AnimatePresence mode="wait">
            {viewMode === 'single' ? (
              // Single camera view with rotation
              <motion.div
                key={allFeeds[currentIndex]?.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-xs mx-auto"
              >
                {allFeeds[currentIndex] && (
                  <CameraFeed
                    stream={allFeeds[currentIndex].stream}
                    name={allFeeds[currentIndex].name}
                    color={allFeeds[currentIndex].color}
                    isLocal={allFeeds[currentIndex].isLocal}
                  />
                )}

                {/* Navigation dots */}
                {allFeeds.length > 1 && (
                  <div className="flex justify-center gap-1.5 mt-2">
                    {allFeeds.map((feed, idx) => (
                      <button
                        key={feed.id}
                        onClick={() => setCurrentIndex(idx)}
                        className={`
                          w-2 h-2 rounded-full transition-all
                          ${idx === currentIndex 
                            ? 'bg-white scale-110' 
                            : 'bg-white/30 hover:bg-white/50'
                          }
                        `}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            ) : (
              // Grid view
              <motion.div
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`
                  grid gap-2
                  ${allFeeds.length <= 2 ? 'grid-cols-2' : 
                    allFeeds.length <= 4 ? 'grid-cols-2 sm:grid-cols-4' : 
                    'grid-cols-3 sm:grid-cols-4'
                  }
                `}
                style={{ maxHeight: 200 }}
              >
                {allFeeds.slice(0, 8).map((feed) => (
                  <div key={feed.id} className="min-w-[100px]">
                    <CameraFeed
                      stream={feed.stream}
                      name={feed.name}
                      color={feed.color}
                      isLocal={feed.isLocal}
                    />
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
