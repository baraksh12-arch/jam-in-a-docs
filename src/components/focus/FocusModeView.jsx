import React, { useState, useCallback, useEffect } from 'react';
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
  Sparkles,
  Music,
  Share2,
  Copy,
  Check,
  LayoutGrid,
  Disc,
  Piano,
  Guitar as GuitarIcon
} from 'lucide-react';
import FullscreenDrumPad from './FullscreenDrumPad';
import DrumSetView from './DrumSetView';
import FullscreenKeyboard from './FullscreenKeyboard';
import ChordPadView from './ChordPadView';
import BassGuitarView from './BassGuitarView';
import GuitarNeckView from './GuitarNeckView';
import FloatingChatWidget from './FloatingChatWidget';
import FloatingCrowdWidget from './FloatingCrowdWidget';
import { Slider } from '@/components/ui/slider';
import { 
  bendNote, 
  applyVibrato, 
  slideToNote, 
  hammerOn,
  setPalmMute,
  setPickPosition,
  setPickupPosition,
  setTone
} from '@/lib/instruments/guitar';

// Instrument mode configurations
const INSTRUMENT_MODES = {
  DRUMS: [
    { id: 'pad', label: 'Drum Pad', icon: LayoutGrid },
    { id: 'kit', label: 'Drum Set', icon: Disc }
  ],
  EP: [
    { id: 'keyboard', label: 'Keyboard', icon: Piano },
    { id: 'chordpad', label: 'Chord Pad', icon: LayoutGrid }
  ],
  BASS: [
    { id: 'keyboard', label: 'Bass Keys', icon: Piano },
    { id: 'fretboard', label: 'Bass Guitar', icon: GuitarIcon }
  ],
  GUITAR: [
    { id: 'keyboard', label: 'Guitar Keys', icon: Piano },
    { id: 'fretboard', label: 'Guitar Neck', icon: GuitarIcon }
  ]
};

// Exit confirmation dialog
const ExitDialog = ({ isOpen, onConfirm, onCancel }) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[#1a1a24] border border-white/10 rounded-2xl p-6 max-w-sm mx-4 shadow-2xl"
        >
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Music className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Leave Room?</h3>
            <p className="text-white/60 text-sm">
              Are you sure you want to leave this jam session?
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-colors"
            >
              Stay
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
            >
              Leave
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

// Share menu component
const ShareMenu = ({ isOpen, roomId, onClose }) => {
  const [copied, setCopied] = useState(false);
  
  const copyToClipboard = async () => {
    try {
      const shareUrl = `${window.location.origin}/Room?id=${roomId}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };
  
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };
  
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute top-full right-0 mt-2 w-72 bg-[#1a1a24] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
        >
          <div className="p-4 border-b border-white/10">
            <p className="text-white/60 text-xs mb-2">Room Code</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-black/40 rounded-lg text-white font-mono text-lg">
                {roomId}
              </code>
              <button
                onClick={copyCode}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-white" />}
              </button>
            </div>
          </div>
          
          <div className="p-2">
            <button
              onClick={copyToClipboard}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <Share2 className="w-4 h-4 text-purple-400" />
              <span className="text-white text-sm">Copy Invite Link</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

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
  color,
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
  const [currentMode, setCurrentMode] = useState(INSTRUMENT_MODES[instrument]?.[0]?.id || 'pad');
  const [showChat, setShowChat] = useState(true);
  const [showCrowd, setShowCrowd] = useState(true);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const modes = INSTRUMENT_MODES[instrument] || INSTRUMENT_MODES.DRUMS;

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

  // Ensure audio context is resumed (critical for iOS/Android)
  const ensureAudioContext = useCallback(async () => {
    try {
      const Tone = await import('tone');
      if (Tone.getContext().state !== 'running') {
        await Tone.start();
      }
    } catch (e) {
      console.warn('[FocusModeView] Could not resume Tone.js context:', e);
    }
  }, []);

  // NOTE_ON - called when key is pressed
  const handleNoteOn = useCallback(async (note, velocity = 100) => {
    await ensureAudioContext();
    
    if (audioEngine) {
      audioEngine.playNote(instrument, note, velocity);
    }
    if (sendNote) {
      sendNote(instrument, note, 'NOTE_ON', velocity);
    }
    
    if (navigator.vibrate) {
      navigator.vibrate(8);
    }
  }, [instrument, audioEngine, sendNote, ensureAudioContext]);

  // NOTE_OFF - called when key is released
  const handleNoteOff = useCallback((note) => {
    if (audioEngine) {
      audioEngine.stopNote(instrument, note);
    }
    if (sendNote) {
      sendNote(instrument, note, 'NOTE_OFF', 0);
    }
  }, [instrument, audioEngine, sendNote]);

  // Guitar-specific handlers
  const handleBend = useCallback((note, semitones) => {
    if (instrument === 'GUITAR') {
      bendNote(note, semitones);
    }
  }, [instrument]);

  const handleVibrato = useCallback((note, depth, rate) => {
    if (instrument === 'GUITAR') {
      applyVibrato(note, depth, rate);
    }
  }, [instrument]);

  const handleSlide = useCallback((fromNote, toNote, duration) => {
    if (instrument === 'GUITAR') {
      slideToNote(fromNote, toNote, duration);
    }
  }, [instrument]);

  const handleHammerOn = useCallback((note, velocity) => {
    if (instrument === 'GUITAR') {
      hammerOn(note, velocity);
    }
    handleNoteOn(note, velocity);
  }, [instrument, handleNoteOn]);

  // Guitar-specific parameter handlers
  const handlePalmMuteChange = useCallback((amount) => {
    if (instrument === 'GUITAR') {
      setPalmMute(amount);
    }
  }, [instrument]);

  const handlePickPositionChange = useCallback((position) => {
    if (instrument === 'GUITAR') {
      setPickPosition(position);
    }
  }, [instrument]);

  const handlePickupChange = useCallback((position) => {
    if (instrument === 'GUITAR') {
      setPickupPosition(position);
    }
  }, [instrument]);

  const handleToneChange = useCallback((value) => {
    if (instrument === 'GUITAR') {
      setTone(value);
    }
  }, [instrument]);

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

  // Handle logo click - show exit confirmation
  const handleLogoClick = () => {
    setShowExitDialog(true);
  };

  const handleConfirmExit = () => {
    setShowExitDialog(false);
    onExit?.();
    window.location.href = '/';
  };

  // Close share menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowShareMenu(false);
    if (showShareMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showShareMenu]);

  // Render instrument based on mode
  const renderInstrument = () => {
    switch (instrument) {
      case 'DRUMS':
        return currentMode === 'pad' ? (
          <FullscreenDrumPad 
            onNoteOn={handleNoteOn}
            onNoteOff={handleNoteOff}
            focusModeActive={true} 
          />
        ) : (
          <DrumSetView
            onNoteOn={handleNoteOn}
            onNoteOff={handleNoteOff}
          />
        );
      
      case 'EP':
        return currentMode === 'keyboard' ? (
          <FullscreenKeyboard 
            instrument={instrument} 
            onNoteOn={handleNoteOn}
            onNoteOff={handleNoteOff}
            focusModeActive={true}
          />
        ) : (
          <ChordPadView
            instrument={instrument}
            onNoteOn={handleNoteOn}
            onNoteOff={handleNoteOff}
            proMode={true}
          />
        );
      
      case 'BASS':
        return currentMode === 'keyboard' ? (
          <FullscreenKeyboard 
            instrument={instrument} 
            onNoteOn={handleNoteOn}
            onNoteOff={handleNoteOff}
            focusModeActive={true}
          />
        ) : (
          <BassGuitarView
            onNoteOn={handleNoteOn}
            onNoteOff={handleNoteOff}
          />
        );
      
      case 'GUITAR':
        return currentMode === 'keyboard' ? (
          <FullscreenKeyboard 
            instrument={instrument} 
            onNoteOn={handleNoteOn}
            onNoteOff={handleNoteOff}
            focusModeActive={true}
          />
        ) : (
          <GuitarNeckView
            onNoteOn={handleNoteOn}
            onNoteOff={handleNoteOff}
            onBend={handleBend}
            onVibrato={handleVibrato}
            onSlide={handleSlide}
            onHammerOn={handleHammerOn}
            onPalmMuteChange={handlePalmMuteChange}
            onPickPositionChange={handlePickPositionChange}
            onPickupChange={handlePickupChange}
            onToneChange={handleToneChange}
          />
        );
      
      default:
        return (
          <FullscreenKeyboard 
            instrument={instrument} 
            onNoteOn={handleNoteOn}
            onNoteOff={handleNoteOff}
            focusModeActive={true}
          />
        );
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
          {/* Left side - Logo (clickable to exit) */}
          <div className="flex items-center gap-4">
            <motion.button
              onClick={handleLogoClick}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              className={`
                w-12 h-12 rounded-2xl flex items-center justify-center
                bg-gradient-to-br from-purple-500 to-pink-500
                shadow-2xl hover:scale-105 transition-transform
                cursor-pointer
              `}
            >
              <Music className="w-6 h-6 text-white" />
            </motion.button>
            <div>
              <h1 className="text-white font-bold text-xl tracking-tight flex items-center gap-2">
                {theme.icon} {theme.name}
              </h1>
              <p className="text-white/40 text-sm font-medium">{player?.displayName || 'Focus Mode'}</p>
            </div>
          </div>

          {/* Center - Mode switcher */}
          <div className="flex items-center gap-2 px-2 py-1 bg-white/5 backdrop-blur-xl rounded-xl border border-white/10">
            {modes.map((mode) => {
              const Icon = mode.icon;
              const isActive = currentMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => setCurrentMode(mode.id)}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
                    transition-all duration-200
                    ${isActive 
                      ? 'bg-white text-black' 
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{mode.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right side - Controls */}
          <div className="flex items-center gap-3">
            {/* Share button */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowShareMenu(!showShareMenu);
                }}
                className="p-3 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 backdrop-blur-xl border border-white/10 transition-all"
              >
                <Share2 className="w-5 h-5" />
              </button>
              <ShareMenu 
                isOpen={showShareMenu} 
                roomId={roomId} 
                onClose={() => setShowShareMenu(false)} 
              />
            </div>

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

            {/* Live indicator */}
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 backdrop-blur-xl rounded-full border border-white/10">
              <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-2 h-2 bg-green-400 rounded-full"
              />
              <span className="text-white/70 text-sm font-medium">LIVE</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main instrument area */}
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        className="absolute inset-0 flex items-center justify-center pt-24 pb-8 px-8"
      >
        <div className="w-full h-full max-w-[1600px] relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentMode}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full"
            >
              {renderInstrument()}
            </motion.div>
          </AnimatePresence>
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
              ESC to exit • Click logo to leave room
            </p>
          </div>
        </motion.div>
      )}

      {/* Exit Confirmation Dialog */}
      <ExitDialog
        isOpen={showExitDialog}
        onConfirm={handleConfirmExit}
        onCancel={() => setShowExitDialog(false)}
      />
    </motion.div>
  );
}
