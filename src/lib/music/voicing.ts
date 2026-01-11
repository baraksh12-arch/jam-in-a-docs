/**
 * Voicing Engine - Chord Inversions and Voice Leading
 * 
 * Handles:
 * - Chord inversions (root position, 1st, 2nd, 3rd)
 * - Open voicings (spread voicings)
 * - Drop-2 voicings (jazz standard)
 * - Voice leading (closest notes algorithm)
 * - Range clamping for playability
 */

import { ChordDefinition, getChordMidiNotes } from './chords';
import { midiToNoteClass, midiToNoteName } from './scale';

/**
 * Voicing types
 */
export type VoicingType = 'close' | 'open' | 'drop2';

/**
 * Voicing state for the chord pad system
 */
export interface VoicingState {
  inversion: number;               // 0 = root, 1 = 1st, 2 = 2nd, etc.
  voicingType: VoicingType;        // close, open, or drop2
  extensionLevel: number;          // 0 = triad, 1 = 7th, 2 = 9th, etc.
  addBass: boolean;                // Add root in lower octave
  voiceLeading: boolean;           // Use voice leading
  range: {                         // Playable range limits
    min: number;                   // Lowest MIDI note
    max: number;                   // Highest MIDI note
  };
  previousChord: number[] | null;  // For voice leading calculation
}

/**
 * Default voicing state
 */
export const DEFAULT_VOICING_STATE: VoicingState = {
  inversion: 0,
  voicingType: 'close',
  extensionLevel: 0,
  addBass: false,
  voiceLeading: false,
  range: { min: 48, max: 84 }, // C3 to C6
  previousChord: null,
};

/**
 * Apply inversion to chord notes
 * Moves bottom note(s) up an octave
 * 
 * @param midiNotes - Original MIDI notes
 * @param inversion - Inversion number (0 = root, 1 = 1st, etc.)
 * @returns Inverted MIDI notes
 */
export function applyInversion(midiNotes: number[], inversion: number): number[] {
  if (midiNotes.length === 0 || inversion === 0) {
    return [...midiNotes];
  }
  
  const notes = [...midiNotes].sort((a, b) => a - b);
  const effectiveInversion = inversion % notes.length;
  
  // Move bottom notes up an octave
  for (let i = 0; i < effectiveInversion; i++) {
    notes.push(notes.shift()! + 12);
  }
  
  return notes.sort((a, b) => a - b);
}

/**
 * Create open voicing (spread notes across wider range)
 * Alternates notes between high and low registers
 * 
 * @param midiNotes - Original MIDI notes
 * @returns Open voiced MIDI notes
 */
export function createOpenVoicing(midiNotes: number[]): number[] {
  if (midiNotes.length <= 2) return [...midiNotes];
  
  const notes = [...midiNotes].sort((a, b) => a - b);
  const result: number[] = [];
  
  // Keep root and 5th in place, move other notes up an octave
  for (let i = 0; i < notes.length; i++) {
    if (i % 2 === 0) {
      result.push(notes[i]);
    } else {
      result.push(notes[i] + 12);
    }
  }
  
  return result.sort((a, b) => a - b);
}

/**
 * Create Drop-2 voicing
 * Takes 2nd note from top and drops it an octave
 * Standard jazz voicing technique
 * 
 * @param midiNotes - Original MIDI notes (should be 4+ notes for best results)
 * @returns Drop-2 voiced MIDI notes
 */
export function createDrop2Voicing(midiNotes: number[]): number[] {
  if (midiNotes.length < 4) {
    // Not enough notes for drop-2, return open voicing instead
    return createOpenVoicing(midiNotes);
  }
  
  const notes = [...midiNotes].sort((a, b) => a - b);
  
  // Take 2nd from top and drop it an octave
  const secondFromTop = notes[notes.length - 2];
  const result = notes.filter((_, i) => i !== notes.length - 2);
  result.unshift(secondFromTop - 12);
  
  return result.sort((a, b) => a - b);
}

/**
 * Clamp chord notes to a specific range
 * Shifts octaves to keep notes within range
 * 
 * @param midiNotes - MIDI notes to clamp
 * @param min - Minimum MIDI note
 * @param max - Maximum MIDI note
 * @returns Range-clamped MIDI notes
 */
export function clampToRange(midiNotes: number[], min: number, max: number): number[] {
  return midiNotes.map(note => {
    while (note < min) note += 12;
    while (note > max) note -= 12;
    return note;
  }).sort((a, b) => a - b);
}

/**
 * Find closest voicing using voice leading principles
 * Minimizes total movement from previous chord
 * 
 * @param targetChord - Target chord MIDI notes
 * @param previousChord - Previous chord MIDI notes
 * @param range - Valid note range
 * @returns Optimally voiced MIDI notes
 */
export function findClosestVoicing(
  targetChord: number[],
  previousChord: number[],
  range: { min: number; max: number }
): number[] {
  if (!previousChord || previousChord.length === 0) {
    return clampToRange(targetChord, range.min, range.max);
  }
  
  const target = [...targetChord];
  const result: number[] = [];
  
  // For each target note, find the closest octave to previous chord center
  const prevCenter = previousChord.reduce((a, b) => a + b, 0) / previousChord.length;
  
  for (const note of target) {
    const noteClass = note % 12;
    
    // Find all octave options within range
    const options: number[] = [];
    for (let octave = Math.floor(range.min / 12); octave <= Math.ceil(range.max / 12); octave++) {
      const candidate = octave * 12 + noteClass;
      if (candidate >= range.min && candidate <= range.max) {
        options.push(candidate);
      }
    }
    
    if (options.length === 0) {
      // Fallback: use original note clamped
      result.push(Math.max(range.min, Math.min(range.max, note)));
    } else {
      // Choose option closest to previous chord center
      const closest = options.reduce((best, opt) => 
        Math.abs(opt - prevCenter) < Math.abs(best - prevCenter) ? opt : best
      );
      result.push(closest);
    }
  }
  
  return result.sort((a, b) => a - b);
}

/**
 * Add bass note (root in low octave)
 * 
 * @param midiNotes - Chord MIDI notes
 * @param rootNote - Root note MIDI number
 * @param bassOctave - Octave for bass (default 2)
 * @returns MIDI notes with added bass
 */
export function addBassNote(
  midiNotes: number[], 
  rootNote: number,
  bassOctave: number = 2
): number[] {
  const rootClass = rootNote % 12;
  const bassNote = (bassOctave + 1) * 12 + rootClass;
  
  // Don't add if already in chord
  if (midiNotes.some(n => n % 12 === rootClass && n <= bassNote)) {
    return [...midiNotes];
  }
  
  return [bassNote, ...midiNotes].sort((a, b) => a - b);
}

/**
 * Apply complete voicing transformation to chord
 * 
 * @param chord - Chord definition
 * @param state - Voicing state
 * @returns Transformed MIDI notes
 */
export function applyVoicing(
  chord: ChordDefinition,
  state: VoicingState
): number[] {
  // Start with base MIDI notes
  let notes = [...chord.midiNotes];
  
  // Apply inversion first
  notes = applyInversion(notes, state.inversion);
  
  // Apply voicing type
  switch (state.voicingType) {
    case 'open':
      notes = createOpenVoicing(notes);
      break;
    case 'drop2':
      notes = createDrop2Voicing(notes);
      break;
    // 'close' keeps notes as-is
  }
  
  // Apply voice leading if enabled and we have previous chord
  if (state.voiceLeading && state.previousChord) {
    notes = findClosestVoicing(notes, state.previousChord, state.range);
  } else {
    // Just clamp to range
    notes = clampToRange(notes, state.range.min, state.range.max);
  }
  
  // Add bass note if enabled
  if (state.addBass) {
    notes = addBassNote(notes, chord.midiNotes[0]);
  }
  
  return notes;
}

/**
 * Get all available inversions for a chord
 * 
 * @param chord - Chord definition
 * @returns Array of inversion descriptions
 */
export function getAvailableInversions(chord: ChordDefinition): string[] {
  const inversions = ['Root Position'];
  const numNotes = chord.midiNotes.length;
  
  for (let i = 1; i < numNotes; i++) {
    const bassNote = midiToNoteClass(chord.midiNotes[i % numNotes]);
    inversions.push(`${ordinal(i)} Inversion (${bassNote} bass)`);
  }
  
  return inversions;
}

/**
 * Helper to get ordinal string
 */
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Strum timing calculation
 * Returns delay for each note in chord
 * 
 * @param numNotes - Number of notes in chord
 * @param strumTime - Total strum time in ms (0 = simultaneous)
 * @param direction - 'up' or 'down'
 * @returns Array of delays in ms for each note
 */
export function calculateStrumTiming(
  numNotes: number,
  strumTime: number,
  direction: 'up' | 'down' = 'down'
): number[] {
  if (strumTime <= 0 || numNotes <= 1) {
    return Array(numNotes).fill(0);
  }
  
  const interval = strumTime / (numNotes - 1);
  const delays = Array.from({ length: numNotes }, (_, i) => i * interval);
  
  return direction === 'up' ? delays.reverse() : delays;
}

/**
 * Calculate humanized timing and velocity variations
 * 
 * @param numNotes - Number of notes
 * @param humanizeAmount - 0-1 amount of humanization
 * @returns Object with timing and velocity variations
 */
export function calculateHumanization(
  numNotes: number,
  humanizeAmount: number
): { timingOffsets: number[]; velocityScales: number[] } {
  const maxTimingOffset = 15 * humanizeAmount; // Up to 15ms timing variation
  const maxVelocityVariation = 0.15 * humanizeAmount; // Up to 15% velocity variation
  
  const timingOffsets = Array.from({ length: numNotes }, () => 
    (Math.random() - 0.5) * 2 * maxTimingOffset
  );
  
  const velocityScales = Array.from({ length: numNotes }, () => 
    1 + (Math.random() - 0.5) * 2 * maxVelocityVariation
  );
  
  return { timingOffsets, velocityScales };
}

/**
 * Get notes that changed between two chords (for legato transitions)
 * 
 * @param prevNotes - Previous chord MIDI notes
 * @param newNotes - New chord MIDI notes
 * @returns Object with notes to release and notes to trigger
 */
export function getChangedNotes(
  prevNotes: number[],
  newNotes: number[]
): { toRelease: number[]; toTrigger: number[] } {
  // Convert to note classes for comparison (octave-agnostic for common tones)
  const prevClasses = new Set(prevNotes.map(n => n % 12));
  const newClasses = new Set(newNotes.map(n => n % 12));
  
  // Find common tone classes
  const commonClasses = new Set(
    [...prevClasses].filter(pc => newClasses.has(pc))
  );
  
  // Notes to release: prev notes whose class is not common
  const toRelease = prevNotes.filter(n => !commonClasses.has(n % 12));
  
  // Notes to trigger: new notes whose class is not common
  const toTrigger = newNotes.filter(n => !commonClasses.has(n % 12));
  
  return { toRelease, toTrigger };
}

/**
 * Calculate crossfade envelope times for smooth transitions
 * 
 * @param transitionSpeed - 0-1 speed (0 = slow crossfade, 1 = fast)
 * @returns Object with attack and release times in seconds
 */
export function getCrossfadeEnvelope(
  transitionSpeed: number = 0.5
): { attack: number; release: number } {
  const minTime = 0.005; // 5ms minimum
  const maxTime = 0.05;  // 50ms maximum
  
  const time = minTime + (1 - transitionSpeed) * (maxTime - minTime);
  
  return {
    attack: time,
    release: time,
  };
}

export default {
  DEFAULT_VOICING_STATE,
  applyInversion,
  createOpenVoicing,
  createDrop2Voicing,
  clampToRange,
  findClosestVoicing,
  addBassNote,
  applyVoicing,
  getAvailableInversions,
  calculateStrumTiming,
  calculateHumanization,
  getChangedNotes,
  getCrossfadeEnvelope,
};
