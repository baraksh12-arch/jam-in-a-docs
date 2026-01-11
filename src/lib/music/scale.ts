/**
 * Scale Definitions and Music Theory Utilities
 * 
 * Core music theory for building scales, generating notes,
 * and understanding interval relationships.
 */

// All 12 chromatic note names
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

// Enharmonic equivalents for display
export const NOTE_DISPLAY: Record<string, string> = {
  'C#': 'C♯/D♭',
  'D#': 'D♯/E♭',
  'F#': 'F♯/G♭',
  'G#': 'G♯/A♭',
  'A#': 'A♯/B♭',
};

// Scale type definitions as interval patterns from root (semitones)
export const SCALE_INTERVALS: Record<string, number[]> = {
  'Major':           [0, 2, 4, 5, 7, 9, 11],           // Ionian
  'Natural Minor':   [0, 2, 3, 5, 7, 8, 10],           // Aeolian
  'Harmonic Minor':  [0, 2, 3, 5, 7, 8, 11],           // Raised 7th
  'Melodic Minor':   [0, 2, 3, 5, 7, 9, 11],           // Jazz melodic (ascending)
  'Dorian':          [0, 2, 3, 5, 7, 9, 10],           // Minor with raised 6th
  'Phrygian':        [0, 1, 3, 5, 7, 8, 10],           // Minor with flat 2nd
  'Lydian':          [0, 2, 4, 6, 7, 9, 11],           // Major with raised 4th
  'Mixolydian':      [0, 2, 4, 5, 7, 9, 10],           // Major with flat 7th
  'Locrian':         [0, 1, 3, 5, 6, 8, 10],           // Diminished scale
  'Pentatonic Major':[0, 2, 4, 7, 9],                  // 5-note major
  'Pentatonic Minor':[0, 3, 5, 7, 10],                 // 5-note minor
  'Blues':           [0, 3, 5, 6, 7, 10],              // Minor pentatonic + b5
  'Whole Tone':      [0, 2, 4, 6, 8, 10],              // Symmetric scale
  'Diminished HW':   [0, 1, 3, 4, 6, 7, 9, 10],        // Half-Whole diminished
  'Diminished WH':   [0, 2, 3, 5, 6, 8, 9, 11],        // Whole-Half diminished
};

// Roman numeral representations for scale degrees
export const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const;

// Degree quality patterns for diatonic chords (Major scale reference)
// 'M' = Major, 'm' = minor, 'd' = diminished, 'A' = Augmented
export const DIATONIC_QUALITIES: Record<string, string[]> = {
  'Major':           ['M', 'm', 'm', 'M', 'M', 'm', 'd'],
  'Natural Minor':   ['m', 'd', 'M', 'm', 'm', 'M', 'M'],
  'Harmonic Minor':  ['m', 'd', 'A', 'm', 'M', 'M', 'd'],
  'Melodic Minor':   ['m', 'm', 'A', 'M', 'M', 'd', 'd'],
  'Dorian':          ['m', 'm', 'M', 'M', 'm', 'd', 'M'],
  'Phrygian':        ['m', 'M', 'M', 'm', 'd', 'M', 'm'],
  'Lydian':          ['M', 'M', 'm', 'd', 'M', 'm', 'm'],
  'Mixolydian':      ['M', 'm', 'd', 'M', 'm', 'm', 'M'],
  'Locrian':         ['d', 'M', 'm', 'm', 'M', 'M', 'm'],
};

// 7th chord quality patterns (for diatonic 7th chords)
export const DIATONIC_7TH_QUALITIES: Record<string, string[]> = {
  'Major':           ['maj7', 'm7', 'm7', 'maj7', '7', 'm7', 'm7b5'],
  'Natural Minor':   ['m7', 'm7b5', 'maj7', 'm7', 'm7', 'maj7', '7'],
  'Harmonic Minor':  ['mMaj7', 'm7b5', 'maj7#5', 'm7', '7', 'maj7', 'dim7'],
  'Melodic Minor':   ['mMaj7', 'm7', 'maj7#5', '7', '7', 'm7b5', 'm7b5'],
  'Dorian':          ['m7', 'm7', 'maj7', '7', 'm7', 'm7b5', 'maj7'],
  'Phrygian':        ['m7', 'maj7', '7', 'm7', 'm7b5', 'maj7', 'm7'],
  'Lydian':          ['maj7', '7', 'm7', 'm7b5', 'maj7', 'm7', 'm7'],
  'Mixolydian':      ['7', 'm7', 'm7b5', 'maj7', 'm7', 'm7', 'maj7'],
  'Locrian':         ['m7b5', 'maj7', 'm7', 'm7', 'maj7', '7', 'm7'],
};

/**
 * Scale definition interface
 */
export interface ScaleDefinition {
  root: string;                    // Root note (C, C#, D, etc.)
  type: string;                    // Scale type name
  intervals: number[];             // Intervals from root in semitones
  notes: string[];                 // Actual note names in the scale
  midiRoot: number;                // MIDI note number of root (default octave 4)
  isCustom?: boolean;              // Whether this is a custom scale
  customName?: string;             // Optional custom name
}

/**
 * Convert note name to MIDI note number
 * @param noteName - Note name with octave (e.g., "C4", "F#3")
 * @returns MIDI note number (0-127)
 */
export function noteNameToMidi(noteName: string): number {
  const match = noteName.match(/^([A-G]#?)(\d+)$/);
  if (!match) {
    // Try without octave, default to octave 4
    const noteIndex = NOTE_NAMES.indexOf(noteName as typeof NOTE_NAMES[number]);
    if (noteIndex === -1) return 60; // Default to C4
    return 60 + noteIndex; // C4 = 60
  }
  
  const [, note, octaveStr] = match;
  const octave = parseInt(octaveStr, 10);
  const noteIndex = NOTE_NAMES.indexOf(note as typeof NOTE_NAMES[number]);
  
  return (octave + 1) * 12 + noteIndex;
}

/**
 * Convert MIDI note number to note name
 * @param midi - MIDI note number
 * @returns Note name with octave (e.g., "C4")
 */
export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

/**
 * Get just the note name without octave
 * @param midi - MIDI note number
 * @returns Note name (e.g., "C", "F#")
 */
export function midiToNoteClass(midi: number): string {
  return NOTE_NAMES[midi % 12];
}

/**
 * Build a scale from root note and scale type
 * @param root - Root note name (e.g., "C", "F#")
 * @param scaleType - Scale type name from SCALE_INTERVALS
 * @returns ScaleDefinition object
 */
export function buildScale(root: string, scaleType: string): ScaleDefinition {
  const rootIndex = NOTE_NAMES.indexOf(root as typeof NOTE_NAMES[number]);
  if (rootIndex === -1) {
    throw new Error(`Invalid root note: ${root}`);
  }
  
  const intervals = SCALE_INTERVALS[scaleType];
  if (!intervals) {
    throw new Error(`Invalid scale type: ${scaleType}`);
  }
  
  const notes = intervals.map(interval => {
    const noteIndex = (rootIndex + interval) % 12;
    return NOTE_NAMES[noteIndex];
  });
  
  return {
    root,
    type: scaleType,
    intervals,
    notes,
    midiRoot: 48 + rootIndex, // C3 + root offset (nice playing range)
    isCustom: false,
  };
}

/**
 * Build a custom scale from selected semitones
 * @param root - Root note name
 * @param selectedSemitones - Array of booleans for each of 12 semitones (0 = root always included)
 * @param customName - Optional name for the custom scale
 * @returns ScaleDefinition object
 */
export function buildCustomScale(
  root: string,
  selectedSemitones: boolean[],
  customName?: string
): ScaleDefinition {
  const rootIndex = NOTE_NAMES.indexOf(root as typeof NOTE_NAMES[number]);
  if (rootIndex === -1) {
    throw new Error(`Invalid root note: ${root}`);
  }
  
  // Build intervals from selected semitones (always include root)
  const intervals: number[] = [0];
  selectedSemitones.forEach((selected, index) => {
    if (selected && index > 0) {
      intervals.push(index);
    }
  });
  
  const notes = intervals.map(interval => {
    const noteIndex = (rootIndex + interval) % 12;
    return NOTE_NAMES[noteIndex];
  });
  
  return {
    root,
    type: 'Custom',
    intervals,
    notes,
    midiRoot: 48 + rootIndex,
    isCustom: true,
    customName: customName || 'Custom Scale',
  };
}

/**
 * Get the scale degree for a given note in a scale
 * @param scale - Scale definition
 * @param noteName - Note name to check
 * @returns Scale degree (1-7) or null if not in scale
 */
export function getScaleDegree(scale: ScaleDefinition, noteName: string): number | null {
  const noteClass = noteName.replace(/\d+$/, ''); // Remove octave if present
  const index = scale.notes.indexOf(noteClass);
  return index === -1 ? null : index + 1;
}

/**
 * Transpose a note by a given number of semitones
 * @param noteName - Note name (with or without octave)
 * @param semitones - Number of semitones to transpose
 * @returns Transposed note name
 */
export function transposeNote(noteName: string, semitones: number): string {
  const hasOctave = /\d+$/.test(noteName);
  const midi = noteNameToMidi(noteName);
  const transposed = midi + semitones;
  
  if (hasOctave) {
    return midiToNoteName(transposed);
  }
  return midiToNoteClass(transposed);
}

/**
 * Get all available scale types
 * @returns Array of scale type names
 */
export function getScaleTypes(): string[] {
  return Object.keys(SCALE_INTERVALS);
}

/**
 * Check if a note is in a scale
 * @param scale - Scale definition
 * @param noteName - Note to check
 * @returns true if note is in scale
 */
export function isNoteInScale(scale: ScaleDefinition, noteName: string): boolean {
  const noteClass = noteName.replace(/\d+$/, '');
  return scale.notes.includes(noteClass);
}

/**
 * Get display name for a scale
 * @param scale - Scale definition
 * @returns Human-readable scale name
 */
export function getScaleDisplayName(scale: ScaleDefinition): string {
  if (scale.isCustom && scale.customName) {
    return `${scale.root} ${scale.customName}`;
  }
  return `${scale.root} ${scale.type}`;
}

export default {
  NOTE_NAMES,
  SCALE_INTERVALS,
  ROMAN_NUMERALS,
  DIATONIC_QUALITIES,
  DIATONIC_7TH_QUALITIES,
  buildScale,
  buildCustomScale,
  noteNameToMidi,
  midiToNoteName,
  midiToNoteClass,
  getScaleDegree,
  transposeNote,
  getScaleTypes,
  isNoteInScale,
  getScaleDisplayName,
};
