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
  Music,
  Share2,
  Copy,
  Check,
  Eye,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import FullscreenDrumPad from './FullscreenDrumPad';
import BassGuitarView from './BassGuitarView';
import GuitarNeckView from './GuitarNeckView';
import PianoWithPadsView from './PianoWithPadsView';
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
 * UnifiedFocusView - Premium Unified Instrument Experience
 * 
 * Features:
 * - Single mode per instrument (no mode switching)
 * - 4 instrument tabs with all musicians visible
 * - Click on player to watch their live display
 * - Settings wheel for all controls
 * - Works on both mobile and desktop
 */

const INSTRUMENT_CONFIG = {
  DRUMS: {
    name: 'Drums',
    icon: '🥁',
    gradient: 'from-rose-500/30 via-orange-500/20 to-amber-500/10',
    accentColor: '#f43f5e',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/30',
  },
  BASS: {
    name: 'Bass',
    icon: '🎸',
    gradient: 'from-cyan-500/30 via-blue-500/20 to-indigo-500/10',
    accentColor: '#06b6d4',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
  },
  EP: {
    name: 'Piano',
    icon: '🎹',
    gradient: 'from-violet-500/30 via-purple-500/20 to-fuchsia-500/10',
    accentColor: '#8b5cf6',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/30',
  },
  GUITAR: {
    name: 'Guitar',
    icon: '🎸',
    gradient: 'from-emerald-500/30 via-green-500/20 to-teal-500/10',
    accentColor: '#10b981',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
  }
};

const INSTRUMENT_ORDER = ['DRUMS', 'BASS', 'GUITAR', 'EP'];

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

// Settings Panel
const SettingsPanel = ({ isOpen, onClose, volume, onVolumeChange, isMuted, onToggleMute }) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 10 }}
        className="absolute bottom-full right-0 mb-2 w-72 bg-[#1a1a24]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50"
      >
        <div className="p-4 border-b border-white/10">
          <h3 className="text-white font-semibold text-sm">Settings</h3>
        </div>
        <div className="p-4 space-y-4">
          {/* Volume Control */}
          <div>
            <label className="text-white/60 text-xs uppercase tracking-wider mb-2 block">Volume</label>
            <div className="flex items-center gap-3">
              <button
                onClick={onToggleMute}
                className={`p-2 rounded-lg transition-colors ${
                  isMuted ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white/70 hover:text-white'
                }`}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <Slider
                value={[isMuted ? 0 : volume]}
                onValueChange={onVolumeChange}
                max={1}
                step={0.01}
                className="flex-1"
              />
            </div>
          </div>
        </div>
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

export default function UnifiedFocusView({
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
  room,
  roomControls,
  // Camera props
  localStream,
  remoteStreams = {},
  isBroadcasting,
  onStartBroadcast,
  onStopBroadcast,
  cameraError,
  // Mobile props
  isMobile = false,
  // Note events for activity indicators
  noteEvents = {}
}) {
  const [selectedTab, setSelectedTab] = useState(instrument);
  const [watchingPlayer, setWatchingPlayer] = useState(null); // Player we're watching
  const [showChat, setShowChat] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [showCameras, setShowCameras] = useState(false);
  const [cameraPosition, setCameraPosition] = useState('top');
  const [showSettings, setShowSettings] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);

  const config = INSTRUMENT_CONFIG[selectedTab] || INSTRUMENT_CONFIG.DRUMS;

  // Get players for each instrument
  const getPlayerForInstrument = (inst) => {
    return players.find(p => p.instrument === inst);
  };

  // Ensure audio context is resumed
  const ensureAudioContext = useCallback(async () => {
    try {
      const Tone = await import('tone');
      if (Tone.getContext().state !== 'running') {
        await Tone.start();
        console.log('[UnifiedFocusView] AudioContext resumed');
      }
    } catch (e) {
      console.warn('[UnifiedFocusView] Failed to resume AudioContext:', e);
    }
  }, []);

  // NOTE_ON handler
  const handleNoteOn = useCallback(async (note, velocity = 100) => {
    await ensureAudioContext();
    
    // Only play sounds for MY instrument
    if (audioEngine && selectedTab === instrument) {
      audioEngine.playNote(instrument, note, velocity);
    }
    if (sendNote && selectedTab === instrument) {
      sendNote(instrument, note, 'NOTE_ON', velocity);
    }
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  }, [instrument, selectedTab, audioEngine, sendNote, ensureAudioContext]);

  // NOTE_OFF handler
  const handleNoteOff = useCallback((note) => {
    if (audioEngine && selectedTab === instrument) {
      audioEngine.stopNote(instrument, note);
    }
    if (sendNote && selectedTab === instrument) {
      sendNote(instrument, note, 'NOTE_OFF', 0);
    }
  }, [instrument, selectedTab, audioEngine, sendNote]);

  // Guitar-specific handlers
  const handleBend = useCallback((note, semitones) => {
    if (selectedTab === 'GUITAR' && selectedTab === instrument) {
      bendNote(note, semitones);
    }
  }, [selectedTab, instrument]);

  const handleVibrato = useCallback((note, depth, rate) => {
    if (selectedTab === 'GUITAR' && selectedTab === instrument) {
      applyVibrato(note, depth, rate);
    }
  }, [selectedTab, instrument]);

  const handleSlide = useCallback((fromNote, toNote, duration) => {
    if (selectedTab === 'GUITAR' && selectedTab === instrument) {
      slideToNote(fromNote, toNote, duration);
    }
  }, [selectedTab, instrument]);

  const handleHammerOn = useCallback((note, velocity) => {
    if (selectedTab === 'GUITAR' && selectedTab === instrument) {
      hammerOn(note, velocity);
    }
    handleNoteOn(note, velocity);
  }, [selectedTab, instrument, handleNoteOn]);

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

  // Toggle cameras
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
    window.location.href = '/';
  };

  // Check if viewing own instrument
  const isViewingOwnInstrument = selectedTab === instrument;

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowShareMenu(false);
      setShowSettings(false);
    };
    if (showShareMenu || showSettings) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showShareMenu, showSettings]);

  // Render the instrument view based on selected tab
  const renderInstrumentView = () => {
    const isOwnInstrument = selectedTab === instrument;
    
    switch (selectedTab) {
      case 'DRUMS':
        return (
          <FullscreenDrumPad
            onNoteOn={handleNoteOn}
            onNoteOff={handleNoteOff}
            focusModeActive={isOwnInstrument}
            viewOnly={!isOwnInstrument}
          />
        );
      
      case 'BASS':
        return (
          <BassGuitarView
            onNoteOn={handleNoteOn}
            onNoteOff={handleNoteOff}
            viewOnly={!isOwnInstrument}
          />
        );
      
      case 'GUITAR':
        return (
          <GuitarNeckView
            onNoteOn={handleNoteOn}
            onNoteOff={handleNoteOff}
            onBend={handleBend}
            onVibrato={handleVibrato}
            onSlide={handleSlide}
            onHammerOn={handleHammerOn}
            viewOnly={!isOwnInstrument}
          />
        );
      
      case 'EP':
        return (
          <PianoWithPadsView
            instrument={selectedTab}
            onNoteOn={handleNoteOn}
            onNoteOff={handleNoteOff}
            focusModeActive={isOwnInstrument}
            viewOnly={!isOwnInstrument}
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
          className={`absolute top-[-30%] left-[-30%] w-[600px] h-[600px] bg-gradient-radial ${config.gradient} rounded-full blur-[100px]`}
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

        {/* Center - Room code */}
        <div className="flex items-center gap-2">
          <span className="text-white/50 text-xs">Room:</span>
          <span className="text-white font-mono font-bold">{roomId?.toUpperCase()}</span>
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

      {/* Instrument Tabs with Players */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="relative z-10 px-4 py-2 bg-black/20 backdrop-blur-sm border-b border-white/5"
      >
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {INSTRUMENT_ORDER.map((inst) => {
            const instConfig = INSTRUMENT_CONFIG[inst];
            const instPlayer = getPlayerForInstrument(inst);
            const isSelected = selectedTab === inst;
            const isMyInstrument = inst === instrument;
            
            return (
              <button
                key={inst}
                onClick={() => setSelectedTab(inst)}
                className={`
                  flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl
                  font-semibold text-sm transition-all duration-200
                  ${isSelected 
                    ? 'bg-white text-black shadow-lg' 
                    : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                  }
                  ${isMyInstrument && !isSelected ? 'ring-2 ring-violet-500/50' : ''}
                `}
              >
                <span className="text-lg">{instConfig.icon}</span>
                <span className="hidden sm:inline">{instConfig.name}</span>
                
                {/* Player indicator */}
                {instPlayer ? (
                  <div 
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: instPlayer.color }}
                    title={instPlayer.displayName}
                  >
                    {instPlayer.displayName?.[0]?.toUpperCase() || '?'}
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                    <span className="text-white/30 text-xs">-</span>
                  </div>
                )}
                
                {/* "You" indicator */}
                {isMyInstrument && (
                  <span className="px-2 py-0.5 rounded-full bg-violet-500/30 text-violet-300 text-xs">
                    You
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* View Mode Indicator */}
      {!isViewingOwnInstrument && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-2 px-4 py-2 bg-cyan-500/20 border border-cyan-500/30 rounded-xl flex items-center justify-center gap-2"
        >
          <Eye className="w-4 h-4 text-cyan-400" />
          <span className="text-cyan-300 text-sm font-medium">
            Watching {getPlayerForInstrument(selectedTab)?.displayName || 'Empty'}'s {INSTRUMENT_CONFIG[selectedTab].name}
          </span>
          <button
            onClick={() => setSelectedTab(instrument)}
            className="ml-2 px-3 py-1 bg-cyan-500/30 hover:bg-cyan-500/40 rounded-lg text-xs text-cyan-200 font-medium transition-colors"
          >
            Back to My {INSTRUMENT_CONFIG[instrument].name}
          </button>
        </motion.div>
      )}

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
            key={selectedTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className={`
              w-full h-full
              ${showCameras ? (cameraPosition === 'top' ? 'pt-[120px]' : 'pb-[120px]') : ''}
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
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSettings(!showSettings);
              }}
              className={`p-2.5 rounded-xl transition-colors ${
                showSettings ? 'bg-white/20 text-white' : 'bg-white/10 text-white/70 hover:text-white'
              }`}
            >
              <Settings className="w-5 h-5" />
            </button>
            <SettingsPanel
              isOpen={showSettings}
              onClose={() => setShowSettings(false)}
              volume={volume}
              onVolumeChange={handleVolumeChange}
              isMuted={isMuted}
              onToggleMute={toggleMute}
            />
          </div>
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
