/**
 * VoicingControls - Playback & Voicing Settings Panel
 * 
 * Features:
 * - Voicing type selector (close, open, drop-2)
 * - Strum time control
 * - Humanize amount
 * - Sustain toggle
 * - Bass note toggle
 * - Voice leading toggle
 * - Attack/Release envelope
 * - Lock mode selection
 */

import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import type { VoicingState, VoicingType } from '@/lib/music/voicing';

interface VoicingControlsProps {
  voicingState: VoicingState;
  onVoicingStateChange: (state: Partial<VoicingState>) => void;
  
  // Playback settings
  strumTime: number;
  humanize: number;
  sustain: boolean;
  onStrumTimeChange: (value: number) => void;
  onHumanizeChange: (value: number) => void;
  onSustainChange: (value: boolean) => void;
  
  // Lock mode
  lockMode: 'none' | 'per-pad' | 'global';
  globalInversion: number;
  maxInversion: number;
  onLockModeChange: (mode: 'none' | 'per-pad' | 'global') => void;
  onGlobalInversionChange: (inv: number) => void;
}

const VOICING_TYPES: { value: VoicingType; label: string; desc: string }[] = [
  { value: 'close', label: 'Close', desc: 'Tight voicing' },
  { value: 'open', label: 'Open', desc: 'Spread voicing' },
  { value: 'drop2', label: 'Drop 2', desc: 'Jazz voicing' },
];

const LOCK_MODES: { value: 'none' | 'per-pad' | 'global'; label: string; desc: string }[] = [
  { value: 'none', label: 'Free', desc: 'Slide to change' },
  { value: 'per-pad', label: 'Per-Pad', desc: 'Lock each pad' },
  { value: 'global', label: 'Global', desc: 'Same for all' },
];

export default function VoicingControls({
  voicingState,
  onVoicingStateChange,
  strumTime,
  humanize,
  sustain,
  onStrumTimeChange,
  onHumanizeChange,
  onSustainChange,
  lockMode,
  globalInversion,
  maxInversion,
  onLockModeChange,
  onGlobalInversionChange,
}: VoicingControlsProps) {
  
  // Toggle functions for cleaner button handlers
  const toggleVoicingType = useCallback((type: VoicingType) => {
    onVoicingStateChange({ voicingType: type });
  }, [onVoicingStateChange]);
  
  const toggleAddBass = useCallback(() => {
    onVoicingStateChange({ addBass: !voicingState.addBass });
  }, [voicingState.addBass, onVoicingStateChange]);
  
  const toggleVoiceLeading = useCallback(() => {
    onVoicingStateChange({ voiceLeading: !voicingState.voiceLeading });
  }, [voicingState.voiceLeading, onVoicingStateChange]);
  
  return (
    <div className="space-y-5">
      {/* Voicing Type */}
      <div>
        <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
          Voicing Type
        </label>
        <div className="grid grid-cols-3 gap-2">
          {VOICING_TYPES.map(({ value, label, desc }) => (
            <button
              key={value}
              onClick={() => toggleVoicingType(value)}
              className={cn(
                'p-3 rounded-xl text-center transition-all',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500',
                voicingState.voicingType === value
                  ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
              )}
            >
              <span className="block text-sm font-bold">{label}</span>
              <span className="block text-[10px] opacity-60">{desc}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Lock Mode */}
      <div>
        <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
          Inversion Lock
        </label>
        <div className="grid grid-cols-3 gap-2">
          {LOCK_MODES.map(({ value, label, desc }) => (
            <button
              key={value}
              onClick={() => onLockModeChange(value)}
              className={cn(
                'p-3 rounded-xl text-center transition-all',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500',
                lockMode === value
                  ? 'bg-gradient-to-br from-yellow-500 to-orange-500 text-black shadow-lg shadow-yellow-500/20'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
              )}
            >
              <span className="block text-sm font-bold">{label}</span>
              <span className="block text-[10px] opacity-60">{desc}</span>
            </button>
          ))}
        </div>
        
        {/* Global inversion selector */}
        {lockMode === 'global' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-yellow-300">Global Inversion</span>
              <span className="text-sm font-bold text-white">
                {globalInversion === 0 ? 'Root' : `${globalInversion}${['st', 'nd', 'rd'][globalInversion - 1] || 'th'}`}
              </span>
            </div>
            <div className="flex gap-2">
              {Array.from({ length: maxInversion + 1 }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => onGlobalInversionChange(i)}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-xs font-bold transition-all',
                    globalInversion === i
                      ? 'bg-yellow-500 text-black'
                      : 'bg-white/10 text-white/60 hover:bg-white/20'
                  )}
                >
                  {i === 0 ? 'R' : i}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </div>
      
      {/* Strum Time */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">
            Strum Spread
          </label>
          <span className="text-xs font-mono text-white/40">{strumTime}ms</span>
        </div>
        <Slider
          value={[strumTime]}
          onValueChange={([v]) => onStrumTimeChange(v)}
          min={0}
          max={80}
          step={5}
          className="w-full"
        />
        <div className="flex justify-between text-[10px] text-white/30 mt-1">
          <span>Instant</span>
          <span>Strummed</span>
        </div>
      </div>
      
      {/* Humanize */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">
            Humanize
          </label>
          <span className="text-xs font-mono text-white/40">{Math.round(humanize * 100)}%</span>
        </div>
        <Slider
          value={[humanize * 100]}
          onValueChange={([v]) => onHumanizeChange(v / 100)}
          min={0}
          max={100}
          step={5}
          className="w-full"
        />
        <div className="flex justify-between text-[10px] text-white/30 mt-1">
          <span>Precise</span>
          <span>Human</span>
        </div>
      </div>
      
      {/* Toggle Options */}
      <div className="space-y-2">
        {/* Sustain */}
        <button
          onClick={() => onSustainChange(!sustain)}
          className={cn(
            'w-full flex items-center justify-between p-3 rounded-xl transition-all',
            sustain
              ? 'bg-emerald-500/20 border border-emerald-500/30'
              : 'bg-white/5 hover:bg-white/10'
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center text-lg',
              sustain ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/40'
            )}>
              ♫
            </div>
            <div className="text-left">
              <span className="block text-sm font-medium text-white">Sustain</span>
              <span className="block text-[10px] text-white/40">Hold chords until next</span>
            </div>
          </div>
          <div className={cn(
            'w-10 h-6 rounded-full transition-colors relative',
            sustain ? 'bg-emerald-500' : 'bg-white/20'
          )}>
            <motion.div
              className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
              animate={{ left: sustain ? 'calc(100% - 20px)' : '4px' }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </div>
        </button>
        
        {/* Bass Note */}
        <button
          onClick={toggleAddBass}
          className={cn(
            'w-full flex items-center justify-between p-3 rounded-xl transition-all',
            voicingState.addBass
              ? 'bg-purple-500/20 border border-purple-500/30'
              : 'bg-white/5 hover:bg-white/10'
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center text-lg',
              voicingState.addBass ? 'bg-purple-500 text-white' : 'bg-white/10 text-white/40'
            )}>
              🎸
            </div>
            <div className="text-left">
              <span className="block text-sm font-medium text-white">Bass Note</span>
              <span className="block text-[10px] text-white/40">Add root in low octave</span>
            </div>
          </div>
          <div className={cn(
            'w-10 h-6 rounded-full transition-colors relative',
            voicingState.addBass ? 'bg-purple-500' : 'bg-white/20'
          )}>
            <motion.div
              className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
              animate={{ left: voicingState.addBass ? 'calc(100% - 20px)' : '4px' }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </div>
        </button>
        
        {/* Voice Leading */}
        <button
          onClick={toggleVoiceLeading}
          className={cn(
            'w-full flex items-center justify-between p-3 rounded-xl transition-all',
            voicingState.voiceLeading
              ? 'bg-cyan-500/20 border border-cyan-500/30'
              : 'bg-white/5 hover:bg-white/10'
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center text-lg',
              voicingState.voiceLeading ? 'bg-cyan-500 text-white' : 'bg-white/10 text-white/40'
            )}>
              🎹
            </div>
            <div className="text-left">
              <span className="block text-sm font-medium text-white">Voice Leading</span>
              <span className="block text-[10px] text-white/40">Smooth chord transitions</span>
            </div>
          </div>
          <div className={cn(
            'w-10 h-6 rounded-full transition-colors relative',
            voicingState.voiceLeading ? 'bg-cyan-500' : 'bg-white/20'
          )}>
            <motion.div
              className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
              animate={{ left: voicingState.voiceLeading ? 'calc(100% - 20px)' : '4px' }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </div>
        </button>
      </div>
      
      {/* Range Display */}
      <div className="p-3 rounded-xl bg-white/5">
        <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
          Note Range
        </h4>
        <div className="flex items-center justify-between text-sm text-white/70">
          <span className="font-mono">{midiToName(voicingState.range.min)}</span>
          <div className="flex-1 mx-3 h-1 rounded-full bg-white/10 relative">
            <div 
              className="absolute inset-y-0 bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full"
              style={{
                left: `${((voicingState.range.min - 24) / 72) * 100}%`,
                right: `${100 - ((voicingState.range.max - 24) / 72) * 100}%`,
              }}
            />
          </div>
          <span className="font-mono">{midiToName(voicingState.range.max)}</span>
        </div>
      </div>
    </div>
  );
}

// Helper to convert MIDI to note name
function midiToName(midi: number): string {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const note = notes[midi % 12];
  return `${note}${octave}`;
}
