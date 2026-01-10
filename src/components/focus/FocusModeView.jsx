import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Minimize2, 
  MessageCircle, 
  Users, 
  Volume2, 
  VolumeX,
  Expand,
  Settings,
  Sparkles
} from 'lucide-react';
import FullscreenDrumPad from './FullscreenDrumPad';
import FullscreenKeyboard from './FullscreenKeyboard';
import FloatingChatWidget from './FloatingChatWidget';
import FloatingCrowdWidget from './FloatingCrowdWidget';
import { Slider } from '@/components/ui/slider';

/**
 * FocusModeView - Premium fullscreen instrument experience
 * Apple-level design with floating mini-widgets for chat & crowd
 */
export default function FocusModeView({
  instrument,
  player,
  audioEngine,
  sendNote,
  onExit,
  // Chat props
  roomId,
  userId,
  displayName,
  // Crowd props
  crowdMembers = [],
  localStream,
  remoteStreams = {},
  isBroadcasting,
  onStartBroadcast,
  onStopBroadcast,
  // Mobile props
  isMobile = false
}) {
  const [showChat, setShowChat] = useState(true);
  const [showCrowd, setShowCrowd] = useState(true);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Instrument config for styling
  const INSTRUMENT_THEMES = {
    DRUMS: {
      name: 'Drums',
      gradient: 'from-rose-500/20 via-orange-500/10 to-amber-500/5',
      accent: 'rose',
      glow: 'shadow-rose-500/20',
      icon: '🥁'
    },
    BASS: {
      name: 'Bass',
      gradient: 'from-cyan-500/20 via-blue-500/10 to-indigo-500/5',
      accent: 'cyan',
      glow: 'shadow-cyan-500/20',
      icon: '🎸'
    },
    EP: {
      name: 'Electric Piano',
      gradient: 'from-violet-500/20 via-purple-500/10 to-fuchsia-500/5',
      accent: 'violet',
      glow: 'shadow-violet-500/20',
      icon: '🎹'
    },
    GUITAR: {
      name: 'Guitar',
      gradient: 'from-emerald-500/20 via-green-500/10 to-teal-500/5',
      accent: 'emerald',
      glow: 'shadow-emerald-500/20',
      icon: '🎸'
    }
  };

  const theme = INSTRUMENT_THEMES[instrument] || INSTRUMENT_THEMES.DRUMS;

  // NOTE_ON - called when key is pressed
  const handleNoteOn = useCallback((note) => {
    if (audioEngine) {
      audioEngine.playNote(instrument, note, 100);
    }
    if (sendNote) {
      sendNote(instrument, note, 'NOTE_ON', 100);
    }
  }, [instrument, audioEngine, sendNote]);

  // NOTE_OFF - called when key is released (for natural sustain)
  const handleNoteOff = useCallback((note) => {
    if (audioEngine) {
      audioEngine.stopNote(instrument, note);
    }
    if (sendNote) {
      sendNote(instrument, note, 'NOTE_OFF', 0);
    }
  }, [instrument, audioEngine, sendNote]);

  const handleVolumeChange = (value) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (audioEngine) {
      audioEngine.setInstrumentVolume(instrument, newVolume);
    }
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (audioEngine) {
      audioEngine.setInstrumentVolume(instrument, newMuted ? 0 : volume);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      className="fixed inset-0 z-50 overflow-hidden"
    >
      {/* iOS Glass Effect Background */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-3xl">
        {/* Animated gradient orbs */}
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className={`absolute top-[-30%] left-[-20%] w-[800px] h-[800px] bg-gradient-radial ${theme.gradient} rounded-full blur-[120px]`}
        />
        <motion.div 
          animate={{ 
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[-20%] right-[-15%] w-[600px] h-[600px] bg-gradient-radial from-white/5 to-transparent rounded-full blur-[100px]"
        />
        
        {/* Subtle grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      {/* Top control bar */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="absolute top-0 left-0 right-0 z-20"
      >
        <div className="flex items-center justify-between px-6 py-4">
          {/* Left side - Instrument info */}
          <div className="flex items-center gap-4">
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              className={`
                w-12 h-12 rounded-2xl flex items-center justify-center text-2xl
                bg-white/5 backdrop-blur-xl border border-white/10
                shadow-2xl ${theme.glow}
              `}
            >
              {theme.icon}
            </motion.div>
            <div>
              <h1 className="text-white font-bold text-xl tracking-tight">{theme.name}</h1>
              <p className="text-white/40 text-sm font-medium">{player?.displayName || 'Focus Mode'}</p>
            </div>
          </div>

          {/* Center - Live indicator */}
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4 }}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 backdrop-blur-xl rounded-full border border-white/10"
          >
            <motion.div 
              animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-2 h-2 bg-green-400 rounded-full"
            />
            <span className="text-white/70 text-sm font-medium tracking-wide">FOCUS MODE</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </motion.div>

          {/* Right side - Controls */}
          <div className="flex items-center gap-3">
            {/* Volume control */}
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 backdrop-blur-xl rounded-xl border border-white/10">
              <button
                onClick={toggleMute}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4 text-white/50" />
                ) : (
                  <Volume2 className="w-4 h-4 text-white/70" />
                )}
              </button>
              <Slider
                value={[isMuted ? 0 : volume]}
                onValueChange={handleVolumeChange}
                max={1}
                step={0.01}
                className="w-24"
              />
            </div>

            {/* Settings toggle */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`
                p-3 rounded-xl transition-all duration-300
                ${showSettings 
                  ? 'bg-white/20 text-white' 
                  : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70'
                }
                backdrop-blur-xl border border-white/10
              `}
            >
              <Settings className="w-5 h-5" />
            </button>

            {/* Exit button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onExit}
              className="
                flex items-center gap-2 px-5 py-3 
                bg-white/10 hover:bg-white/20 
                backdrop-blur-xl rounded-xl border border-white/20
                text-white font-medium text-sm
                transition-all duration-300
                shadow-lg shadow-black/20
              "
            >
              <Minimize2 className="w-4 h-4" />
              <span>Exit Focus</span>
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Main instrument area */}
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        className="absolute inset-0 flex items-center justify-center pt-20 pb-8 px-8"
      >
        <div className="w-full h-full max-w-[1600px] relative">
          {instrument === 'DRUMS' ? (
            <FullscreenDrumPad 
              onNoteOn={handleNoteOn}
              onNoteOff={handleNoteOff}
              focusModeActive={true} 
            />
          ) : (
            <FullscreenKeyboard 
              instrument={instrument} 
              onNoteOn={handleNoteOn}
              onNoteOff={handleNoteOff}
              focusModeActive={true}
            />
          )}
        </div>
      </motion.div>

      {/* Floating widgets container - bottom right */}
      <div className="absolute bottom-6 right-6 z-30 flex flex-col gap-3 items-end">
        <AnimatePresence>
          {showCrowd && (
            <FloatingCrowdWidget
              key="crowd"
              crowdMembers={crowdMembers}
              localStream={localStream}
              remoteStreams={remoteStreams}
              userId={userId}
              displayName={displayName}
              isBroadcasting={isBroadcasting}
              onStartBroadcast={onStartBroadcast}
              onStopBroadcast={onStopBroadcast}
              onClose={() => setShowCrowd(false)}
            />
          )}
        </AnimatePresence>
        
        <AnimatePresence>
          {showChat && (
            <FloatingChatWidget
              key="chat"
              roomId={roomId}
              userId={userId}
              displayName={displayName}
              onClose={() => setShowChat(false)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Toggle buttons for hidden widgets - bottom left */}
      <div className="absolute bottom-6 left-6 z-30 flex gap-2">
        <AnimatePresence>
          {!showChat && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowChat(true)}
              className="
                relative p-3 rounded-2xl
                bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20
                backdrop-blur-xl border border-violet-500/30
                text-violet-300 hover:text-violet-200
                transition-all duration-300
                shadow-lg shadow-violet-500/10
              "
            >
              <MessageCircle className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-violet-500 rounded-full animate-pulse" />
            </motion.button>
          )}
        </AnimatePresence>
        
        <AnimatePresence>
          {!showCrowd && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowCrowd(true)}
              className="
                relative p-3 rounded-2xl
                bg-gradient-to-br from-cyan-500/20 to-blue-500/20
                backdrop-blur-xl border border-cyan-500/30
                text-cyan-300 hover:text-cyan-200
                transition-all duration-300
                shadow-lg shadow-cyan-500/10
              "
            >
              <Users className="w-5 h-5" />
              {crowdMembers.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 flex items-center justify-center bg-cyan-500 rounded-full text-[10px] font-bold text-white">
                  {crowdMembers.length}
                </span>
              )}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Keyboard hint - desktop only */}
      {!isMobile && (
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20"
        >
          <div className="px-4 py-2 bg-white/5 backdrop-blur-xl rounded-full border border-white/10">
            <p className="text-white/30 text-xs font-medium tracking-wider">
              ESC to exit • Use keyboard shortcuts for fast play
            </p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
