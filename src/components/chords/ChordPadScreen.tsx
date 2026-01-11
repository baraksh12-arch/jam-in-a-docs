/**
 * ChordPadScreen - Main Chord Pad Instrument Screen
 * 
 * Premium GarageBand-quality chord pad interface with:
 * - Responsive desktop/mobile layouts
 * - Full scale & chord configuration
 * - Voicing controls with inversions & extensions
 * - Audio integration with Tone.js piano sampler
 * - Preset save/load functionality
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import ChordPadGrid from './ChordPadGrid';
import ScaleChordSetup from './ScaleChordSetup';
import VoicingControls from './VoicingControls';
import MobileBottomSheet from './MobileBottomSheet';
import { buildScale, type ScaleDefinition } from '@/lib/music/scale';
import { 
  createDiatonicPadAssignments, 
  type ChordPadAssignment,
} from '@/lib/music/chords';
import { 
  DEFAULT_VOICING_STATE, 
  type VoicingState,
} from '@/lib/music/voicing';
import { CHORD_PAD_PRESETS, type ChordPadPreset } from '@/lib/music/presets';

// Import piano audio engine
import { initPiano, triggerNote, releaseNote, stopAllNotes, isReady } from '@/lib/instruments/piano';

interface ChordPadScreenProps {
  onNoteOn?: (note: number, velocity?: number) => void;
  onNoteOff?: (note: number) => void;
}

export default function ChordPadScreen({
  onNoteOn,
  onNoteOff,
}: ChordPadScreenProps) {
  const isMobile = useIsMobile();
  
  // Scale & Chord State
  const [currentScale, setCurrentScale] = useState<ScaleDefinition>(() => 
    buildScale('C', 'Major')
  );
  const [chordAssignments, setChordAssignments] = useState<ChordPadAssignment[]>(() =>
    createDiatonicPadAssignments(buildScale('C', 'Major'), false)
  );
  const [use7thChords, setUse7thChords] = useState(false);
  
  // Voicing State
  const [voicingState, setVoicingState] = useState<VoicingState>(DEFAULT_VOICING_STATE);
  
  // Playback Settings
  const [strumTime, setStrumTime] = useState(0);
  const [humanize, setHumanize] = useState(0);
  const [sustain, setSustain] = useState(true);
  
  // Lock Mode
  const [lockMode, setLockMode] = useState<'none' | 'per-pad' | 'global'>('none');
  const [globalInversion, setGlobalInversion] = useState(0);
  
  // Presets
  const [showPresets, setShowPresets] = useState(false);
  const [currentPresetName, setCurrentPresetName] = useState('C Major Pop');
  
  // Audio initialization
  const audioInitializedRef = useRef(false);
  const [audioReady, setAudioReady] = useState(false);
  
  // Initialize audio on first user interaction
  const initAudio = useCallback(async () => {
    if (audioInitializedRef.current) return;
    audioInitializedRef.current = true;
    
    try {
      await initPiano();
      setAudioReady(true);
      console.log('[ChordPadScreen] Audio initialized');
    } catch (error) {
      console.error('[ChordPadScreen] Audio init failed:', error);
    }
  }, []);
  
  // Handle note on
  const handleNoteOn = useCallback(async (note: number, velocity: number = 100) => {
    if (!audioReady) {
      await initAudio();
    }
    
    // Trigger internal piano
    triggerNote(note, undefined, velocity);
    
    // Also call external callback if provided (for MIDI out, etc.)
    onNoteOn?.(note, velocity);
  }, [audioReady, initAudio, onNoteOn]);
  
  // Handle note off
  const handleNoteOff = useCallback((note: number) => {
    releaseNote(note);
    onNoteOff?.(note);
  }, [onNoteOff]);
  
  // Handle all notes off
  const handleAllNotesOff = useCallback(() => {
    stopAllNotes();
  }, []);
  
  // Update voicing state partially
  const handleVoicingStateChange = useCallback((partial: Partial<VoicingState>) => {
    setVoicingState(prev => ({ ...prev, ...partial }));
  }, []);
  
  // Load preset
  const loadPreset = useCallback((preset: ChordPadPreset) => {
    setCurrentScale(preset.scale);
    setChordAssignments(createDiatonicPadAssignments(preset.scale, preset.use7thChords));
    setUse7thChords(preset.use7thChords);
    setVoicingState(prev => ({ ...prev, ...preset.voicing }));
    setStrumTime(preset.strumTime);
    setHumanize(preset.humanize);
    setSustain(preset.sustain);
    setCurrentPresetName(preset.name);
    setShowPresets(false);
  }, []);
  
  // Calculate max inversion based on first chord
  const maxInversion = useMemo(() => {
    const firstChord = chordAssignments[0]?.chord;
    return firstChord ? firstChord.midiNotes.length - 1 : 2;
  }, [chordAssignments]);
  
  // Click anywhere to initialize audio
  useEffect(() => {
    const handler = () => {
      if (!audioInitializedRef.current) {
        initAudio();
      }
    };
    
    document.addEventListener('pointerdown', handler, { once: true });
    return () => document.removeEventListener('pointerdown', handler);
  }, [initAudio]);
  
  return (
    <div className="relative w-full h-full min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 overflow-hidden">
      {/* Ambient background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-radial from-violet-500/10 via-transparent to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-radial from-cyan-500/10 via-transparent to-transparent rounded-full blur-3xl" />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-gradient-radial from-rose-500/5 via-transparent to-transparent rounded-full blur-2xl" />
      </div>
      
      {/* Grid pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />
      
      {/* Main Content */}
      <div className={cn(
        'relative z-10 flex h-full',
        isMobile ? 'flex-col' : 'flex-row',
      )}>
        {/* Header (Mobile) */}
        {isMobile && (
          <header className="flex-shrink-0 px-4 pt-safe">
            <div className="flex items-center justify-between py-3">
              <div>
                <h1 className="text-lg font-black text-white tracking-tight">
                  Chord Pad
                </h1>
                <p className="text-xs text-white/40">{currentPresetName}</p>
              </div>
              <button
                onClick={() => setShowPresets(true)}
                className="px-3 py-1.5 rounded-lg bg-white/10 text-xs font-medium text-white/70 hover:bg-white/20 transition-colors"
              >
                Presets
              </button>
            </div>
          </header>
        )}
        
        {/* Chord Pad Grid Area */}
        <main className={cn(
          'flex-1 flex items-center justify-center',
          isMobile ? 'pb-32' : 'pb-4',
        )}>
          <ChordPadGrid
            assignments={chordAssignments}
            voicingState={voicingState}
            onVoicingStateChange={handleVoicingStateChange}
            strumTime={strumTime}
            humanize={humanize}
            sustain={sustain}
            onNoteOn={handleNoteOn}
            onNoteOff={handleNoteOff}
            onAllNotesOff={handleAllNotesOff}
            lockMode={lockMode}
            globalInversion={globalInversion}
            onGlobalInversionChange={setGlobalInversion}
          />
        </main>
        
        {/* Desktop Side Panel */}
        {!isMobile && (
          <aside className="w-80 flex-shrink-0 border-l border-white/5 bg-black/30 backdrop-blur-xl overflow-y-auto scrollbar-hide">
            <div className="p-4 space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-black text-white tracking-tight">
                    Chord Pad
                  </h1>
                  <p className="text-xs text-white/40 mt-0.5">{currentPresetName}</p>
                </div>
                <button
                  onClick={() => setShowPresets(true)}
                  className="px-3 py-1.5 rounded-lg bg-white/10 text-xs font-medium text-white/70 hover:bg-white/20 transition-colors"
                >
                  Presets
                </button>
              </div>
              
              {/* Scale Setup */}
              <section>
                <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">
                  Scale & Chords
                </h2>
                <ScaleChordSetup
                  currentScale={currentScale}
                  use7thChords={use7thChords}
                  onScaleChange={setCurrentScale}
                  onChordSetChange={setChordAssignments}
                  onUse7thChordsChange={setUse7thChords}
                />
              </section>
              
              {/* Voicing Controls */}
              <section>
                <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">
                  Voicing & Playback
                </h2>
                <VoicingControls
                  voicingState={voicingState}
                  onVoicingStateChange={handleVoicingStateChange}
                  strumTime={strumTime}
                  humanize={humanize}
                  sustain={sustain}
                  onStrumTimeChange={setStrumTime}
                  onHumanizeChange={setHumanize}
                  onSustainChange={setSustain}
                  lockMode={lockMode}
                  globalInversion={globalInversion}
                  maxInversion={maxInversion}
                  onLockModeChange={setLockMode}
                  onGlobalInversionChange={setGlobalInversion}
                />
              </section>
              
              {/* Keyboard Shortcuts */}
              <section className="p-4 rounded-xl bg-white/5">
                <h3 className="text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
                  Keyboard Shortcuts
                </h3>
                <div className="grid grid-cols-4 gap-1 font-mono text-xs text-white/40">
                  <span>1</span><span>2</span><span>3</span><span>4</span>
                  <span>Q</span><span>W</span><span>E</span><span>R</span>
                  <span>A</span><span>S</span><span>D</span><span>F</span>
                </div>
              </section>
            </div>
          </aside>
        )}
        
        {/* Mobile Bottom Sheet */}
        {isMobile && (
          <MobileBottomSheet
            currentScale={currentScale}
            use7thChords={use7thChords}
            onScaleChange={setCurrentScale}
            onChordSetChange={setChordAssignments}
            onUse7thChordsChange={setUse7thChords}
            voicingState={voicingState}
            onVoicingStateChange={handleVoicingStateChange}
            strumTime={strumTime}
            humanize={humanize}
            sustain={sustain}
            onStrumTimeChange={setStrumTime}
            onHumanizeChange={setHumanize}
            onSustainChange={setSustain}
            lockMode={lockMode}
            globalInversion={globalInversion}
            maxInversion={maxInversion}
            onLockModeChange={setLockMode}
            onGlobalInversionChange={setGlobalInversion}
          />
        )}
      </div>
      
      {/* Preset Modal */}
      <AnimatePresence>
        {showPresets && (
          <PresetModal
            presets={CHORD_PAD_PRESETS}
            currentPresetName={currentPresetName}
            onSelect={loadPreset}
            onClose={() => setShowPresets(false)}
          />
        )}
      </AnimatePresence>
      
      {/* Audio Status Indicator */}
      {!audioReady && (
        <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-full bg-yellow-500/20 text-yellow-300 text-xs font-medium backdrop-blur-sm">
          Tap anywhere to enable audio
        </div>
      )}
    </div>
  );
}

/**
 * Preset Modal Component
 */
interface PresetModalProps {
  presets: ChordPadPreset[];
  currentPresetName: string;
  onSelect: (preset: ChordPadPreset) => void;
  onClose: () => void;
}

function PresetModal({ presets, currentPresetName, onSelect, onClose }: PresetModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      
      {/* Modal */}
      <motion.div
        className="relative bg-gradient-to-br from-gray-900 to-gray-950 rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden border border-white/10"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">Chord Presets</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-colors"
          >
            ✕
          </button>
        </div>
        
        {/* Preset List */}
        <div className="p-4 space-y-2 overflow-y-auto max-h-[60vh] scrollbar-hide">
          {presets.map((preset) => (
            <button
              key={preset.name}
              onClick={() => onSelect(preset)}
              className={cn(
                'w-full p-4 rounded-xl text-left transition-all',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
                currentPresetName === preset.name
                  ? 'bg-gradient-to-br from-violet-500/30 to-purple-600/20 border border-violet-500/30'
                  : 'bg-white/5 hover:bg-white/10 border border-transparent'
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">{preset.name}</h3>
                  <p className="text-xs text-white/50 mt-0.5">{preset.description}</p>
                </div>
                {currentPresetName === preset.name && (
                  <span className="text-violet-400 text-xs font-medium">Active</span>
                )}
              </div>
              <div className="flex gap-2 mt-2">
                <span className="px-2 py-0.5 rounded bg-white/10 text-[10px] text-white/60">
                  {preset.scale.root} {preset.scale.type}
                </span>
                {preset.use7thChords && (
                  <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-[10px] text-cyan-300">
                    7th chords
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
