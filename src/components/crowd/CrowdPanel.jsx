import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Video, 
  VideoOff, 
  ChevronDown, 
  ChevronUp, 
  Maximize2,
  Minimize2,
  Eye,
  Camera,
  UserCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * CrowdVideoTile - Individual video tile for a crowd member
 */
const CrowdVideoTile = React.memo(({ 
  stream, 
  displayName, 
  color, 
  isLocal = false,
  onExpand,
  isExpanded = false 
}) => {
  const videoRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      setHasError(false);
    }
  }, [stream]);

  const handleLoadedData = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
  };

  const initial = displayName?.[0]?.toUpperCase() || '?';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`
        relative aspect-square rounded-xl overflow-hidden
        bg-gradient-to-br from-slate-800/80 to-slate-900/80
        border border-white/10 backdrop-blur-sm
        group cursor-pointer
        ${isExpanded ? 'col-span-2 row-span-2' : ''}
        ${isLocal ? 'ring-2 ring-cyan-400/50' : ''}
      `}
      onClick={onExpand}
    >
      {/* Video element */}
      {stream && !hasError ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedData={handleLoadedData}
          onError={handleError}
          className={`
            absolute inset-0 w-full h-full object-cover
            transition-opacity duration-300
            ${isLoaded ? 'opacity-100' : 'opacity-0'}
            ${isLocal ? 'transform scale-x-[-1]' : ''}
          `}
        />
      ) : null}

      {/* Placeholder when no stream or loading */}
      {(!stream || !isLoaded || hasError) && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg"
            style={{ backgroundColor: color || '#6366f1' }}
          >
            {initial}
          </div>
        </div>
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Name badge */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`
          absolute bottom-0 left-0 right-0 p-1.5
          bg-gradient-to-t from-black/80 to-transparent
        `}
      >
        <div className="flex items-center gap-1.5">
          {isLocal && (
            <span className="px-1.5 py-0.5 bg-cyan-500/30 text-cyan-300 text-[9px] font-bold rounded-full uppercase tracking-wide">
              You
            </span>
          )}
          <span className="text-white text-[10px] font-medium truncate">
            {displayName || 'Viewer'}
          </span>
        </div>
      </motion.div>

      {/* Live indicator for local stream */}
      {isLocal && stream && (
        <div className="absolute top-1.5 right-1.5">
          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-red-500/90 rounded-full">
            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            <span className="text-[9px] font-bold text-white uppercase tracking-wider">Live</span>
          </div>
        </div>
      )}

      {/* Expand button on hover */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onExpand?.();
        }}
        className="absolute top-1.5 left-1.5 p-1 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-black/60"
      >
        {isExpanded ? (
          <Minimize2 className="w-3 h-3 text-white" />
        ) : (
          <Maximize2 className="w-3 h-3 text-white" />
        )}
      </button>
    </motion.div>
  );
});

CrowdVideoTile.displayName = 'CrowdVideoTile';

/**
 * CrowdPanel - Main component showing all crowd video feeds
 */
export default function CrowdPanel({
  roomId,
  userId,
  displayName,
  color,
  isCrowd = false,
  crowdMembers = [],
  localStream,
  remoteStreams = {},
  isBroadcasting,
  cameraError,
  onStartBroadcast,
  onStopBroadcast,
  isMobile = false,
  isPortrait = false
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedUser, setExpandedUser] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'focus'

  const isMobilePortrait = isMobile && isPortrait;
  const totalCount = crowdMembers.length + (isCrowd && localStream ? 1 : 0);
  const hasMembers = totalCount > 0 || isCrowd;

  // Toggle expanded user
  const handleExpandUser = useCallback((userId) => {
    setExpandedUser(prev => prev === userId ? null : userId);
  }, []);

  // Calculate grid columns based on member count
  const getGridCols = () => {
    if (expandedUser) return 'grid-cols-3 sm:grid-cols-4';
    if (totalCount <= 4) return 'grid-cols-2';
    if (totalCount <= 9) return 'grid-cols-3';
    if (totalCount <= 16) return 'grid-cols-4';
    if (totalCount <= 36) return 'grid-cols-6';
    return 'grid-cols-8 sm:grid-cols-10';
  };

  if (!hasMembers && !isCrowd) {
    return null;
  }

  return (
    <Card className={`
      bg-slate-800/60 border-white/10 flex flex-col backdrop-blur-sm
      ${isMobilePortrait ? 'rounded-t-xl rounded-b-none' : 'rounded-xl'}
    `}>
      <CardHeader 
        className="border-b border-white/10 pb-3 cursor-pointer select-none"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 rounded-xl">
              <Users className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">Crowd</h3>
              <p className="text-gray-500 text-xs">
                {totalCount > 0 ? `${totalCount} viewer${totalCount !== 1 ? 's' : ''} live` : 'No viewers yet'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Live count badge */}
            {totalCount > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-violet-500/20 rounded-full">
                <Eye className="w-3 h-3 text-violet-400" />
                <span className="text-violet-300 text-xs font-medium">{totalCount}</span>
              </div>
            )}
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsCollapsed(!isCollapsed);
              }}
              className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            >
              {isCollapsed ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </CardHeader>

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <CardContent className="p-3">
              {/* Camera controls for crowd members */}
              {isCrowd && (
                <div className="mb-3">
                  {cameraError ? (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                      <div className="flex items-center gap-2 text-red-400">
                        <VideoOff className="w-4 h-4" />
                        <span className="text-sm">{cameraError}</span>
                      </div>
                      <Button
                        onClick={onStartBroadcast}
                        size="sm"
                        className="mt-2 w-full bg-red-500/20 hover:bg-red-500/30 text-red-300"
                      >
                        Try Again
                      </Button>
                    </div>
                  ) : !isBroadcasting ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="relative"
                    >
                      <Button
                        onClick={onStartBroadcast}
                        className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium py-5 rounded-xl shadow-lg shadow-violet-500/25 transition-all hover:shadow-violet-500/40"
                      >
                        <Camera className="w-4 h-4 mr-2" />
                        Start Camera
                      </Button>
                      <p className="text-center text-gray-500 text-xs mt-2">
                        Share your reaction with the jam session
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between p-3 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 rounded-xl border border-violet-500/20"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                          <span className="text-violet-300 text-sm font-medium">Broadcasting</span>
                        </div>
                      </div>
                      <Button
                        onClick={onStopBroadcast}
                        size="sm"
                        variant="ghost"
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <VideoOff className="w-4 h-4 mr-1.5" />
                        Stop
                      </Button>
                    </motion.div>
                  )}
                </div>
              )}

              {/* Video grid */}
              {totalCount > 0 ? (
                <div className={`
                  grid gap-2
                  ${getGridCols()}
                  max-h-[300px] overflow-y-auto
                  scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent
                `}>
                  {/* Local stream first (if crowd and broadcasting) */}
                  {isCrowd && localStream && (
                    <CrowdVideoTile
                      stream={localStream}
                      displayName={displayName}
                      color={color}
                      isLocal={true}
                      isExpanded={expandedUser === userId}
                      onExpand={() => handleExpandUser(userId)}
                    />
                  )}
                  
                  {/* Remote streams */}
                  {crowdMembers
                    .filter(member => {
                      const memberId = member.userId || member.oduserId;
                      return memberId !== userId;
                    })
                    .map(member => {
                      const memberId = member.userId || member.oduserId;
                      const stream = remoteStreams[memberId];
                      
                      return (
                        <CrowdVideoTile
                          key={memberId}
                          stream={stream}
                          displayName={member.displayName}
                          color={member.color}
                          isExpanded={expandedUser === memberId}
                          onExpand={() => handleExpandUser(memberId)}
                        />
                      );
                    })
                  }
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="p-4 bg-white/5 rounded-2xl mb-3">
                    <UserCircle className="w-8 h-8 text-gray-600" />
                  </div>
                  <p className="text-gray-500 text-sm">No one in the crowd yet</p>
                  <p className="text-gray-600 text-xs mt-1">
                    {isCrowd ? 'Start your camera to be the first!' : 'Invite friends to watch'}
                  </p>
                </div>
              )}

              {/* Crowd stats footer */}
              {totalCount > 0 && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-3 pt-3 border-t border-white/5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-500 text-xs">
                      <Video className="w-3 h-3" />
                      <span>{totalCount} live feed{totalCount !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="text-gray-600 text-xs">
                      Video only • No audio
                    </div>
                  </div>
                </motion.div>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
