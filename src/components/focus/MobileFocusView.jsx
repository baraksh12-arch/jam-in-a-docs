import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ArrowLeft,
  Volume2,
  VolumeX,
  Settings,
  Video,
  VideoOff,
  Users,
  MessageCircle,
  LayoutGrid,
  Music,
  Disc,
  Zap,
  Guitar,
  Piano,
  ChevronUp,
  ChevronDown,
  Share2,
  Copy,
  Check
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import FullscreenDrumPad from './FullscreenDrumPad';
import DrumSetView from './DrumSetView';
import FullscreenKeyboard from './FullscreenKeyboard';
import ChordPadView from './ChordPadView';
import BassGuitarView from './BassGuitarView';
import GuitarNeckView from './GuitarNeckView';
import BandMemberIndicators from './BandMemberIndicators';
import CameraStrip from './CameraStrip';
import CompactChatBar from './CompactChatBar';
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

/**
 * MobileFocusView - Premium Mobile Instrument Experience
 * 
 * Apple-tier VST-quality interface with:
 * - Dual modes per instrument (Pads vs Realistic Views)
 * - Guitar neck with bends, slides, vibrato, hammer-ons
 * - Premium drum set with realistic visuals
 * - Real-time camera feeds with toggle
 * - Share/copy room code functionality
 * - Logo-based exit with confirmation
 */

// Instrument mode configurations
const INSTRUMENT_MODES = {
  DRUMS: [
    { id: 'pad', label: 'Drum Pad', icon: LayoutGrid, description: '8-pad MPC style' },
    { id: 'kit', label: 'Drum Set', icon: Disc, description: 'Visual drum kit' }
  ],
  EP: [
    { id: 'keyboard', label: 'Keyboard', icon: Piano, description: 'Piano keys' },
    { id: 'chordpad', label: 'Chord Pad', icon: LayoutGrid, description: 'One-touch chords' }
  ],
  BASS: [
    { id: 'keyboard', label: 'Bass Keys', icon: Piano, description: 'Keyboard layout' },
    { id: 'fretboard', label: 'Bass Guitar', icon: Guitar, description: 'String slide' }
  ],
  GUITAR: [
    { id: 'keyboard', label: 'Guitar Keys', icon: Piano, description: 'Keyboard layout' },
    { id: 'fretboard', label: 'Guitar Neck', icon: Guitar, description: 'Bends & slides' }
  ]
};

const INSTRUMENT_THEMES = {
  DRUMS: {
    name: 'Drums',
    gradient: 'from-rose-500/30 via-orange-500/20 to-amber-500/10',
    accent: 'rose',
    icon: '🥁',
    color: '#f43f5e'
  },
  BASS: {
    name: 'Bass',
    gradient: 'from-cyan-500/30 via-blue-500/20 to-indigo-500/10',
    accent: 'cyan',
    icon: '🎸',
    color: '#06b6d4'
  },
  EP: {
    name: 'Piano',
    gradient: 'from-violet-500/30 via-purple-500/20 to-fuchsia-500/10',
    accent: 'violet',
    icon: '🎹',
    color: '#8b5cf6'
  },
  GUITAR: {
    name: 'Guitar',
    gradient: 'from-emerald-500/30 via-green-500/20 to-teal-500/10',
    accent: 'emerald',
    icon: '🎸',
    color: '#10b981'
  }
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
          className="absolute top-full right-0 mt-2 w-64 bg-[#1a1a24] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
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

export default function MobileFocusView({
  instrument,
  player,
  audioEngine,
  sendNote,
  onExit,
  // Room props
  roomId,
  userId,
  displayName,
  color,
  players = [],
  crowdMembers = [],
  // Camera props
  localStream,
  remoteStreams = {},
  isBroadcasting,
  onStartBroadcast,
  onStopBroadcast,
  cameraError,
  // Note events for activity indicators
  noteEvents = {}
}) {
  const [currentMode, setCurrentMode] = useState(INSTRUMENT_MODES[instrument]?.[0]?.id || 'pad');
  const [showChat, setShowChat] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [showCameras, setShowCameras] = useState(false);
  const [cameraPosition, setCameraPosition] = useState('top');
  const [showSettings, setShowSettings] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);

  const theme = INSTRUMENT_THEMES[instrument] || INSTRUMENT_THEMES.DRUMS;
  const modes = INSTRUMENT_MODES[instrument] || INSTRUMENT_MODES.DRUMS;

  // NOTE_ON handler
  const handleNoteOn = useCallback((note, velocity = 100) => {
    if (audioEngine) {
      audioEngine.playNote(instrument, note, velocity);
    }
    if (sendNote) {
      sendNote(instrument, note, 'NOTE_ON', velocity);
    }
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  }, [instrument, audioEngine, sendNote]);

  // NOTE_OFF handler
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

  // Volume control
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

  // Toggle camera with position cycling
  const toggleCameras = useCallback(() => {
    if (showCameras) {
      if (cameraPosition === 'top') {
        setCameraPosition('bottom');
      } else {
        setShowCameras(false);
        setCameraPosition('top');
      }
    } else {
      setShowCameras(true);
    }
  }, [showCameras, cameraPosition]);

  // Toggle chat
  const toggleChat = useCallback(() => {
    if (showChat) {
      if (chatExpanded) {
        setChatExpanded(false);
      } else {
        setShowChat(false);
      }
    } else {
      setShowChat(true);
    }
  }, [showChat, chatExpanded]);

  // Handle exit with confirmation
  const handleLogoClick = () => {
    setShowExitDialog(true);
  };

  const handleConfirmExit = () => {
    setShowExitDialog(false);
    onExit?.();
    // Navigate to landing page
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

  // Render the instrument view based on mode
  const renderInstrumentView = () => {
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
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      style={{ 
        background: '#0a0a0f',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: showChat ? 0 : 'env(safe-area-inset-bottom)'
      }}
    >
      {/* Animated background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.4, 0.2]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className={`absolute top-[-30%] left-[-30%] w-[600px] h-[600px] bg-gradient-radial ${theme.gradient} rounded-full blur-[100px]`}
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.15, 0.3, 0.15]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-[-20%] right-[-20%] w-[500px] h-[500px] bg-gradient-radial from-white/10 to-transparent rounded-full blur-[80px]"
        />
      </div>

      {/* Top Header Bar */}
      <motion.div
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="relative z-20 flex items-center justify-between px-4 py-3 bg-black/40 backdrop-blur-xl border-b border-white/10"
      >
        {/* Logo button (replaces Back) */}
        <button
          onClick={handleLogoClick}
          className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Music className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-semibold text-sm hidden sm:block">Jam in a Docs</span>
        </button>

        {/* Center - Instrument info */}
        <div className="flex items-center gap-3">
          <span className="text-2xl">{theme.icon}</span>
          <div className="text-center">
            <h1 className="text-white font-bold text-lg">{theme.name}</h1>
            <p className="text-white/50 text-xs">{player?.displayName || 'Focus Mode'}</p>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {/* Share button */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowShareMenu(!showShareMenu);
              }}
              className="p-2.5 rounded-xl bg-white/10 text-white/70 hover:text-white hover:bg-white/20 transition-colors"
            >
              <Share2 className="w-5 h-5" />
            </button>
            <ShareMenu 
              isOpen={showShareMenu} 
              roomId={roomId} 
              onClose={() => setShowShareMenu(false)} 
            />
          </div>
          
          <button
            onClick={toggleCameras}
            className={`relative p-2.5 rounded-xl transition-colors ${
              showCameras ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/10 text-white/70 hover:text-white'
            }`}
          >
            <Video className="w-5 h-5" />
            {showCameras && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-cyan-500 rounded-full flex items-center justify-center">
                {cameraPosition === 'top' ? (
                  <ChevronUp className="w-3 h-3 text-white" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-white" />
                )}
              </span>
            )}
          </button>
          <button
            onClick={toggleChat}
            className={`p-2.5 rounded-xl transition-colors ${
              showChat ? 'bg-violet-500/20 text-violet-400' : 'bg-white/10 text-white/70 hover:text-white'
            }`}
          >
            <MessageCircle className="w-5 h-5" />
          </button>
        </div>
      </motion.div>

      {/* Mode Switcher */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="relative z-10 px-4 py-3 bg-black/20 backdrop-blur-sm"
      >
        <div className="flex gap-2">
          {modes.map((mode) => {
            const Icon = mode.icon;
            const isActive = currentMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => setCurrentMode(mode.id)}
                className={`
                  flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl
                  font-semibold text-sm transition-all duration-200
                  ${isActive 
                    ? 'bg-white text-black shadow-lg' 
                    : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Band Member Activity Indicators */}
      <BandMemberIndicators
        players={players}
        currentUserId={userId}
        noteEvents={noteEvents}
        position="top"
      />

      {/* Main Instrument Area with Camera Overlays */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex-1 relative z-10 overflow-hidden"
      >
        {/* Camera Strip - Top Position */}
        <AnimatePresence>
          {showCameras && cameraPosition === 'top' && (
            <CameraStrip
              players={players}
              localStream={localStream}
              remoteStreams={remoteStreams}
              userId={userId}
              displayName={displayName}
              color={color}
              position="top"
              onClose={() => setShowCameras(false)}
            />
          )}
        </AnimatePresence>

        {/* Instrument View */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentMode}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className={`
              w-full h-full
              ${showCameras ? (cameraPosition === 'top' ? 'pt-[200px]' : 'pb-[200px]') : ''}
            `}
            style={{
              transition: 'padding 0.3s ease-in-out'
            }}
          >
            {renderInstrumentView()}
          </motion.div>
        </AnimatePresence>

        {/* Camera Strip - Bottom Position */}
        <AnimatePresence>
          {showCameras && cameraPosition === 'bottom' && (
            <CameraStrip
              players={players}
              localStream={localStream}
              remoteStreams={remoteStreams}
              userId={userId}
              displayName={displayName}
              color={color}
              position="bottom"
              onClose={() => setShowCameras(false)}
            />
          )}
        </AnimatePresence>
      </motion.div>

      {/* Bottom Control Bar */}
      {!showChat && (
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="relative z-20 flex items-center justify-between px-4 py-3 bg-black/60 backdrop-blur-xl border-t border-white/10"
        >
          {/* Volume control */}
          <div className="flex items-center gap-3 flex-1 max-w-[200px]">
            <button
              onClick={toggleMute}
              className={`p-2 rounded-lg transition-colors ${
                isMuted ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white/70 hover:text-white'
              }`}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <Slider
              value={[isMuted ? 0 : volume]}
              onValueChange={handleVolumeChange}
              max={1}
              step={0.01}
              className="flex-1"
            />
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full">
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-2 h-2 bg-green-400 rounded-full"
            />
            <span className="text-white/60 text-sm font-medium">LIVE</span>
          </div>

          {/* Settings */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2.5 rounded-xl transition-colors ${
              showSettings ? 'bg-white/20 text-white' : 'bg-white/10 text-white/70 hover:text-white'
            }`}
          >
            <Settings className="w-5 h-5" />
          </button>
        </motion.div>
      )}

      {/* Compact Chat Bar */}
      <AnimatePresence>
        {showChat && (
          <CompactChatBar
            roomId={roomId}
            userId={userId}
            displayName={displayName}
            isExpanded={chatExpanded}
            onToggleExpand={() => setChatExpanded(!chatExpanded)}
            onClose={() => {
              setShowChat(false);
              setChatExpanded(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* Exit Confirmation Dialog */}
      <ExitDialog
        isOpen={showExitDialog}
        onConfirm={handleConfirmExit}
        onCancel={() => setShowExitDialog(false)}
      />
    </motion.div>
  );
}
