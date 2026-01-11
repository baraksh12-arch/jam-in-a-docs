/**
 * ChordPadGrid - Responsive Grid of Chord Pads
 * 
 * Features:
 * - Adaptive layout (2x4, 3x4, or 4x3 based on screen)
 * - Keyboard shortcuts for desktop
 * - MIDI/Audio integration
 * - Strum and humanization
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import ChordPad from './ChordPad';
import type { ChordPadAssignment, ChordDefinition } from '@/lib/music/chords';
import { getChordExtensions } from '@/lib/music/chords';
import { 
  applyVoicing, 
  VoicingState, 
  calculateStrumTiming, 
  calculateHumanization,
  getChangedNotes,
  getCrossfadeEnvelope,
} from '@/lib/music/voicing';

// Keyboard mapping for pads (desktop)
const KEYBOARD_MAP: Record<string, number> = {
  '1': 0, '2': 1, '3': 2, '4': 3,
  'q': 4, 'w': 5, 'e': 6, 'r': 7,
  'a': 8, 's': 9, 'd': 10, 'f': 11,
};

const KEYBOARD_DISPLAY: string[] = [
  '1', '2', '3', '4',
  'Q', 'W', 'E', 'R',
  'A', 'S', 'D', 'F',
];

interface ChordPadGridProps {
  assignments: ChordPadAssignment[];
  voicingState: VoicingState;
  onVoicingStateChange: (state: Partial<VoicingState>) => void;
  
  // Playback settings
  strumTime: number;             // 0-80ms
  humanize: number;              // 0-1
  sustain: boolean;              // Whether to sustain chords
  
  // Audio callbacks
  onNoteOn: (note: number, velocity: number, time?: number) => void;
  onNoteOff: (note: number, time?: number) => void;
  onAllNotesOff: () => void;
  
  // Lock mode
  lockMode: 'none' | 'per-pad' | 'global';
  globalInversion: number;
  onGlobalInversionChange: (inv: number) => void;
  
  disabled?: boolean;
}

interface PadState {
  isActive: boolean;
  currentInversion: number;
  currentExtension: number;
  activeNotes: number[];
}

export default function ChordPadGrid({
  assignments,
  voicingState,
  onVoicingStateChange,
  strumTime,
  humanize,
  sustain,
  onNoteOn,
  onNoteOff,
  onAllNotesOff,
  lockMode,
  globalInversion,
  onGlobalInversionChange,
  disabled = false,
}: ChordPadGridProps) {
  // Track state for each pad
  const [padStates, setPadStates] = useState<Map<string, PadState>>(new Map());
  const activeNotesRef = useRef<Set<number>>(new Set());
  const sustainedNotesRef = useRef<Map<string, number[]>>(new Map());
  const prevChordRef = useRef<number[] | null>(null);
  
  // Initialize pad states
  useEffect(() => {
    const initial = new Map<string, PadState>();
    assignments.forEach((a) => {
      initial.set(a.id, {
        isActive: false,
        currentInversion: a.lockedInversion ?? 0,
        currentExtension: a.lockedExtension ?? 0,
        activeNotes: [],
      });
    });
    setPadStates(initial);
  }, [assignments]);
  
  // Get current chord with extensions applied
  const getChordWithExtension = useCallback((
    assignment: ChordPadAssignment,
    extensionLevel: number
  ): ChordDefinition => {
    const extensions = getChordExtensions(assignment.chord);
    return extensions[Math.min(extensionLevel, extensions.length - 1)];
  }, []);
  
  // Play chord with all voicing/strum/humanize settings
  const playChord = useCallback((
    assignment: ChordPadAssignment,
    velocity: number,
    inversion: number,
    extension: number
  ) => {
    const chord = getChordWithExtension(assignment, extension);
    
    // Apply voicing
    const voicedNotes = applyVoicing(chord, {
      ...voicingState,
      inversion,
      previousChord: voicingState.voiceLeading ? prevChordRef.current : null,
    });
    
    // If voice leading is enabled, handle legato transitions
    if (voicingState.voiceLeading && prevChordRef.current && prevChordRef.current.length > 0) {
      const { toRelease, toTrigger } = getChangedNotes(prevChordRef.current, voicedNotes);
      const envelope = getCrossfadeEnvelope(0.7);
      
      // Release changed notes with fade
      toRelease.forEach(note => {
        if (activeNotesRef.current.has(note)) {
          onNoteOff(note);
          activeNotesRef.current.delete(note);
        }
      });
      
      // Trigger new notes (common tones stay)
      const strumDelays = calculateStrumTiming(toTrigger.length, strumTime, 'down');
      const { timingOffsets, velocityScales } = calculateHumanization(toTrigger.length, humanize);
      
      toTrigger.forEach((note, i) => {
        const delay = strumDelays[i] + timingOffsets[i];
        const vel = Math.round(velocity * velocityScales[i]);
        
        setTimeout(() => {
          onNoteOn(note, vel);
          activeNotesRef.current.add(note);
        }, Math.max(0, delay));
      });
    } else {
      // Standard chord trigger (release previous, play new)
      // Release all active notes first
      activeNotesRef.current.forEach(note => {
        onNoteOff(note);
      });
      activeNotesRef.current.clear();
      
      // Calculate strum timing and humanization
      const strumDelays = calculateStrumTiming(voicedNotes.length, strumTime, 'down');
      const { timingOffsets, velocityScales } = calculateHumanization(voicedNotes.length, humanize);
      
      // Trigger notes with strum timing
      voicedNotes.forEach((note, i) => {
        const delay = strumDelays[i] + timingOffsets[i];
        const vel = Math.round(velocity * velocityScales[i]);
        
        setTimeout(() => {
          onNoteOn(note, vel);
          activeNotesRef.current.add(note);
        }, Math.max(0, delay));
      });
    }
    
    // Update previous chord for voice leading
    prevChordRef.current = voicedNotes;
    
    return voicedNotes;
  }, [voicingState, strumTime, humanize, onNoteOn, onNoteOff, getChordWithExtension]);
  
  // Release chord notes
  const releaseChord = useCallback((padId: string) => {
    const sustained = sustainedNotesRef.current.get(padId);
    if (sustained) {
      sustained.forEach(note => {
        if (activeNotesRef.current.has(note)) {
          onNoteOff(note);
          activeNotesRef.current.delete(note);
        }
      });
      sustainedNotesRef.current.delete(padId);
    }
  }, [onNoteOff]);
  
  // Handle pad trigger
  const handlePadTrigger = useCallback((assignment: ChordPadAssignment, velocity: number) => {
    const state = padStates.get(assignment.id);
    if (!state) return;
    
    const inversion = lockMode === 'global' ? globalInversion : state.currentInversion;
    const notes = playChord(assignment, velocity, inversion, state.currentExtension);
    
    // Store notes for this pad
    sustainedNotesRef.current.set(assignment.id, notes);
    
    // Update pad state
    setPadStates(prev => {
      const next = new Map(prev);
      next.set(assignment.id, { ...state, isActive: true, activeNotes: notes });
      return next;
    });
  }, [padStates, lockMode, globalInversion, playChord]);
  
  // Handle pad release
  const handlePadRelease = useCallback((assignment: ChordPadAssignment) => {
    if (!sustain) {
      releaseChord(assignment.id);
    }
    
    setPadStates(prev => {
      const next = new Map(prev);
      const state = prev.get(assignment.id);
      if (state) {
        next.set(assignment.id, { ...state, isActive: false });
      }
      return next;
    });
  }, [sustain, releaseChord]);
  
  // Handle inversion change (via slide)
  const handleInversionChange = useCallback((assignment: ChordPadAssignment, delta: number) => {
    if (lockMode === 'global') {
      const maxInv = assignment.chord.midiNotes.length - 1;
      const newInv = Math.max(0, Math.min(maxInv, globalInversion + delta));
      onGlobalInversionChange(newInv);
    } else {
      setPadStates(prev => {
        const next = new Map(prev);
        const state = prev.get(assignment.id);
        if (state) {
          const maxInv = assignment.chord.midiNotes.length - 1;
          const newInv = Math.max(0, Math.min(maxInv, state.currentInversion + delta));
          next.set(assignment.id, { ...state, currentInversion: newInv });
          
          // Re-trigger chord if active
          if (state.isActive) {
            const chord = getChordWithExtension(assignment, state.currentExtension);
            const voicedNotes = applyVoicing(chord, { ...voicingState, inversion: newInv });
            
            // Smooth transition
            activeNotesRef.current.forEach(note => onNoteOff(note));
            activeNotesRef.current.clear();
            voicedNotes.forEach(note => {
              onNoteOn(note, 90);
              activeNotesRef.current.add(note);
            });
            sustainedNotesRef.current.set(assignment.id, voicedNotes);
          }
        }
        return next;
      });
    }
  }, [lockMode, globalInversion, onGlobalInversionChange, voicingState, onNoteOn, onNoteOff, getChordWithExtension]);
  
  // Handle extension change (via slide)
  const handleExtensionChange = useCallback((assignment: ChordPadAssignment, delta: number) => {
    setPadStates(prev => {
      const next = new Map(prev);
      const state = prev.get(assignment.id);
      if (state) {
        const extensions = getChordExtensions(assignment.chord);
        const newExt = Math.max(0, Math.min(extensions.length - 1, state.currentExtension + delta));
        next.set(assignment.id, { ...state, currentExtension: newExt });
        
        // Re-trigger chord if active
        if (state.isActive) {
          const chord = getChordWithExtension(assignment, newExt);
          const inversion = lockMode === 'global' ? globalInversion : state.currentInversion;
          const voicedNotes = applyVoicing(chord, { ...voicingState, inversion });
          
          // Smooth transition
          activeNotesRef.current.forEach(note => onNoteOff(note));
          activeNotesRef.current.clear();
          voicedNotes.forEach(note => {
            onNoteOn(note, 90);
            activeNotesRef.current.add(note);
          });
          sustainedNotesRef.current.set(assignment.id, voicedNotes);
        }
      }
      return next;
    });
  }, [lockMode, globalInversion, voicingState, onNoteOn, onNoteOff, getChordWithExtension]);
  
  // Keyboard shortcuts
  useEffect(() => {
    if (disabled) return;
    
    const pressedKeys = new Set<string>();
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      const key = e.key.toLowerCase();
      if (KEYBOARD_MAP[key] !== undefined && !pressedKeys.has(key)) {
        pressedKeys.add(key);
        const index = KEYBOARD_MAP[key];
        const assignment = assignments[index];
        if (assignment) {
          handlePadTrigger(assignment, 100);
        }
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (KEYBOARD_MAP[key] !== undefined) {
        pressedKeys.delete(key);
        const index = KEYBOARD_MAP[key];
        const assignment = assignments[index];
        if (assignment) {
          handlePadRelease(assignment);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [disabled, assignments, handlePadTrigger, handlePadRelease]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      onAllNotesOff();
    };
  }, [onAllNotesOff]);
  
  return (
    <div className="w-full h-full flex items-center justify-center p-3 sm:p-4">
      <motion.div
        className={cn(
          'grid gap-2 sm:gap-3 w-full max-w-2xl',
          // Responsive grid: 2 cols on mobile, 4 cols on larger screens
          'grid-cols-2 sm:grid-cols-4',
        )}
        initial="hidden"
        animate="visible"
        variants={{
          visible: {
            transition: {
              staggerChildren: 0.03,
            },
          },
        }}
      >
        {assignments.slice(0, 12).map((assignment, index) => {
          const state = padStates.get(assignment.id);
          const extensions = getChordExtensions(assignment.chord);
          
          return (
            <motion.div
              key={assignment.id}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 },
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <ChordPad
                assignment={assignment}
                isActive={state?.isActive ?? false}
                currentInversion={
                  lockMode === 'global' 
                    ? globalInversion 
                    : (state?.currentInversion ?? 0)
                }
                currentExtension={state?.currentExtension ?? 0}
                maxInversions={assignment.chord.midiNotes.length - 1}
                maxExtensions={extensions.length - 1}
                onTrigger={(velocity) => handlePadTrigger(assignment, velocity)}
                onRelease={() => handlePadRelease(assignment)}
                onInversionChange={(delta) => handleInversionChange(assignment, delta)}
                onExtensionChange={(delta) => handleExtensionChange(assignment, delta)}
                keyboardShortcut={KEYBOARD_DISPLAY[index]}
                disabled={disabled}
              />
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
