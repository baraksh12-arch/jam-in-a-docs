/**
 * Chord Definitions and Chord Building Utilities
 * 
 * Comprehensive chord system supporting:
 * - Standard triads and extensions
 * - Chord parsing from symbol notation
 * - Diatonic chord generation from scales
 * - Custom chord modifications
 */

import {
  ScaleDefinition,
  NOTE_NAMES,
  noteNameToMidi,
  midiToNoteClass,
  DIATONIC_QUALITIES,
  DIATONIC_7TH_QUALITIES,
  ROMAN_NUMERALS,
} from './scale';

/**
 * Chord interval definitions (semitones from root)
 * Comprehensive list covering jazz and modern chord types
 */
export const CHORD_INTERVALS: Record<string, number[]> = {
  // Basic triads
  'maj':      [0, 4, 7],           // Major triad
  'min':      [0, 3, 7],           // Minor triad (also 'm')
  'm':        [0, 3, 7],           // Minor alias
  'dim':      [0, 3, 6],           // Diminished triad
  'aug':      [0, 4, 8],           // Augmented triad
  '+':        [0, 4, 8],           // Augmented alias
  
  // Suspended chords
  'sus2':     [0, 2, 7],           // Suspended 2nd
  'sus4':     [0, 5, 7],           // Suspended 4th
  'sus':      [0, 5, 7],           // Sus4 alias
  
  // 6th chords
  '6':        [0, 4, 7, 9],        // Major 6th
  'm6':       [0, 3, 7, 9],        // Minor 6th
  
  // 7th chords
  '7':        [0, 4, 7, 10],       // Dominant 7th
  'maj7':     [0, 4, 7, 11],       // Major 7th
  'M7':       [0, 4, 7, 11],       // Major 7th alias
  'm7':       [0, 3, 7, 10],       // Minor 7th
  'min7':     [0, 3, 7, 10],       // Minor 7th alias
  'mMaj7':    [0, 3, 7, 11],       // Minor-Major 7th
  'mM7':      [0, 3, 7, 11],       // Minor-Major 7th alias
  'dim7':     [0, 3, 6, 9],        // Diminished 7th (fully diminished)
  'm7b5':     [0, 3, 6, 10],       // Half-diminished (min7 flat 5)
  'ø7':       [0, 3, 6, 10],       // Half-diminished alias
  'aug7':     [0, 4, 8, 10],       // Augmented 7th
  '+7':       [0, 4, 8, 10],       // Augmented 7th alias
  'augMaj7':  [0, 4, 8, 11],       // Augmented Major 7th
  'maj7#5':   [0, 4, 8, 11],       // Augmented Major 7th alias
  '7sus4':    [0, 5, 7, 10],       // Dominant 7th sus4
  '7sus2':    [0, 2, 7, 10],       // Dominant 7th sus2
  
  // Extended chords (9th, 11th, 13th)
  '9':        [0, 4, 7, 10, 14],   // Dominant 9th
  'maj9':     [0, 4, 7, 11, 14],   // Major 9th
  'M9':       [0, 4, 7, 11, 14],   // Major 9th alias
  'm9':       [0, 3, 7, 10, 14],   // Minor 9th
  'add9':     [0, 4, 7, 14],       // Add 9 (no 7th)
  'madd9':    [0, 3, 7, 14],       // Minor add 9
  '11':       [0, 4, 7, 10, 14, 17], // Dominant 11th
  'm11':      [0, 3, 7, 10, 14, 17], // Minor 11th
  '13':       [0, 4, 7, 10, 14, 21], // Dominant 13th (omit 11)
  'maj13':    [0, 4, 7, 11, 14, 21], // Major 13th
  'm13':      [0, 3, 7, 10, 14, 21], // Minor 13th
  
  // Altered chords
  '7b5':      [0, 4, 6, 10],       // Dominant 7 flat 5
  '7#5':      [0, 4, 8, 10],       // Dominant 7 sharp 5
  '7b9':      [0, 4, 7, 10, 13],   // Dominant 7 flat 9
  '7#9':      [0, 4, 7, 10, 15],   // Dominant 7 sharp 9 (Hendrix chord)
  '7#11':     [0, 4, 7, 10, 18],   // Dominant 7 sharp 11
  '7b13':     [0, 4, 7, 10, 20],   // Dominant 7 flat 13
  '7alt':     [0, 4, 8, 10, 13],   // Altered dominant
  '9#11':     [0, 4, 7, 10, 14, 18], // 9 sharp 11
  '13#11':    [0, 4, 7, 10, 18, 21], // 13 sharp 11
  
  // Power chords
  '5':        [0, 7],              // Power chord (no 3rd)
  'power':    [0, 7],              // Power chord alias
};

/**
 * Quality abbreviation to full type mapping
 */
const QUALITY_TO_TYPE: Record<string, string> = {
  'M': 'maj',
  'm': 'min',
  'd': 'dim',
  'A': 'aug',
};

/**
 * Chord definition interface
 */
export interface ChordDefinition {
  root: string;                    // Root note name
  type: string;                    // Chord type (maj, min7, etc.)
  name: string;                    // Display name (e.g., "Cmaj7")
  symbol: string;                  // Chord symbol
  intervals: number[];             // Intervals in semitones
  notes: string[];                 // Note names in the chord
  midiNotes: number[];             // MIDI note numbers (default voicing)
  scaleDegree?: number;            // Scale degree (1-7) if from a scale
  romanNumeral?: string;           // Roman numeral representation
}

/**
 * Chord pad assignment for the grid
 */
export interface ChordPadAssignment {
  id: string;                      // Unique pad ID
  chord: ChordDefinition;          // Assigned chord
  color: string;                   // Display color (tailwind gradient class)
  locked?: boolean;                // Whether voicing is locked
  lockedInversion?: number;        // Locked inversion index (0 = root)
  lockedExtension?: number;        // Locked extension level
}

/**
 * Build a chord from root and type
 * @param root - Root note name (e.g., "C", "F#")
 * @param type - Chord type from CHORD_INTERVALS
 * @param baseOctave - Base octave for MIDI notes (default 4)
 * @returns ChordDefinition object
 */
export function buildChord(
  root: string,
  type: string,
  baseOctave: number = 4
): ChordDefinition {
  const rootIndex = NOTE_NAMES.indexOf(root as typeof NOTE_NAMES[number]);
  if (rootIndex === -1) {
    throw new Error(`Invalid root note: ${root}`);
  }
  
  const intervals = CHORD_INTERVALS[type];
  if (!intervals) {
    throw new Error(`Invalid chord type: ${type}`);
  }
  
  const baseMidi = (baseOctave + 1) * 12 + rootIndex;
  const midiNotes = intervals.map(interval => baseMidi + interval);
  const notes = midiNotes.map(midi => midiToNoteClass(midi));
  
  // Build display name
  let displayType = type;
  if (type === 'maj') displayType = '';
  if (type === 'min' || type === 'm') displayType = 'm';
  
  return {
    root,
    type,
    name: `${root}${displayType}`,
    symbol: `${root}${displayType}`,
    intervals,
    notes,
    midiNotes,
  };
}

/**
 * Parse a chord symbol string into a ChordDefinition
 * Supports formats like: C, Cm, Cmaj7, C#m7b5, Dsus4, etc.
 * @param symbol - Chord symbol string
 * @param baseOctave - Base octave for MIDI notes
 * @returns ChordDefinition object
 */
export function parseChordSymbol(symbol: string, baseOctave: number = 4): ChordDefinition {
  // Extract root note (handles sharps)
  const rootMatch = symbol.match(/^([A-G]#?)/);
  if (!rootMatch) {
    throw new Error(`Invalid chord symbol: ${symbol}`);
  }
  
  const root = rootMatch[1];
  let remainder = symbol.slice(root.length);
  
  // Determine chord type from remainder
  let type = 'maj'; // Default to major
  
  // Check for specific patterns (order matters - check longer patterns first)
  const typePatterns = [
    'mMaj7', 'mM7', 'maj7#5', 'augMaj7', 'm7b5', 'ø7', 'dim7', 'aug7', '+7',
    '7sus4', '7sus2', '7#11', '7b13', '7#9', '7b9', '7#5', '7b5', '7alt',
    '13#11', '9#11', 'maj13', 'maj9', 'm13', 'm11', 'm9', 'add9', 'madd9',
    'maj7', 'min7', 'sus4', 'sus2', 'aug', 'dim', 'm7', 'M7', 'M9', '13', '11', '9', '7', '6', 'm6', 'm',
    'sus', '+', '5',
  ];
  
  for (const pattern of typePatterns) {
    if (remainder.toLowerCase() === pattern.toLowerCase() || 
        remainder === pattern) {
      type = pattern;
      break;
    }
  }
  
  // Handle bare major (no suffix)
  if (remainder === '' || remainder === 'maj') {
    type = 'maj';
  }
  
  // Normalize type
  if (type === 'M7') type = 'maj7';
  if (type === 'M9') type = 'maj9';
  if (type === 'min7') type = 'm7';
  if (type === '+') type = 'aug';
  
  return buildChord(root, type, baseOctave);
}

/**
 * Generate diatonic chords from a scale
 * @param scale - Scale definition
 * @param use7ths - Whether to generate 7th chords (default: false for triads)
 * @param baseOctave - Base octave for MIDI notes
 * @returns Array of ChordDefinition objects for each scale degree
 */
export function generateDiatonicChords(
  scale: ScaleDefinition,
  use7ths: boolean = false,
  baseOctave: number = 4
): ChordDefinition[] {
  const qualities = use7ths 
    ? DIATONIC_7TH_QUALITIES[scale.type] 
    : DIATONIC_QUALITIES[scale.type];
  
  if (!qualities) {
    // For custom or unsupported scales, generate basic major/minor based on 3rd
    return scale.notes.map((root, index) => {
      // Check interval to 3rd degree
      const thirdInterval = scale.intervals[(index + 2) % scale.intervals.length] - 
                           scale.intervals[index];
      const normalizedThird = thirdInterval < 0 ? thirdInterval + 12 : thirdInterval;
      
      const type = normalizedThird === 3 ? 'min' : normalizedThird === 4 ? 'maj' : 'dim';
      const chord = buildChord(root, type, baseOctave);
      
      return {
        ...chord,
        scaleDegree: index + 1,
        romanNumeral: ROMAN_NUMERALS[index],
      };
    });
  }
  
  return scale.notes.map((root, index) => {
    const quality = qualities[index];
    
    // Map quality to chord type
    let type: string;
    if (use7ths) {
      type = quality; // Already a 7th chord type
    } else {
      type = QUALITY_TO_TYPE[quality] || quality;
    }
    
    const chord = buildChord(root, type, baseOctave);
    
    // Format roman numeral (lowercase for minor/dim)
    let roman = ROMAN_NUMERALS[index];
    if (quality === 'm' || quality === 'd' || 
        quality.startsWith('m') || quality === 'dim7' || quality === 'm7b5') {
      roman = roman.toLowerCase();
    }
    if (quality === 'd' || quality === 'dim7' || quality === 'm7b5') {
      roman += '°';
    }
    if (quality === 'A' || quality.includes('#5') || quality === 'aug') {
      roman += '+';
    }
    
    return {
      ...chord,
      scaleDegree: index + 1,
      romanNumeral: roman,
    };
  });
}

/**
 * Get MIDI notes for a chord at a specific octave
 * @param chord - Chord definition
 * @param octave - Target octave
 * @returns Array of MIDI note numbers
 */
export function getChordMidiNotes(chord: ChordDefinition, octave: number): number[] {
  const rootIndex = NOTE_NAMES.indexOf(chord.root as typeof NOTE_NAMES[number]);
  const baseMidi = (octave + 1) * 12 + rootIndex;
  return chord.intervals.map(interval => baseMidi + interval);
}

/**
 * Get extension variants of a chord (triad → 7 → 9 → 11 → 13)
 * @param chord - Base chord definition
 * @returns Array of chord definitions at each extension level
 */
export function getChordExtensions(chord: ChordDefinition): ChordDefinition[] {
  const extensions: ChordDefinition[] = [chord];
  
  // Determine base quality
  const isMinor = chord.type.includes('m') && !chord.type.includes('maj');
  const isDim = chord.type.includes('dim');
  const isAug = chord.type.includes('aug') || chord.type.includes('+');
  
  if (isDim) {
    // Diminished extensions
    extensions.push(buildChord(chord.root, 'dim7', 4));
    // Dim doesn't have standard 9/11/13 extensions
  } else if (isAug) {
    // Augmented extensions
    extensions.push(buildChord(chord.root, 'aug7', 4));
    extensions.push(buildChord(chord.root, 'augMaj7', 4));
  } else if (isMinor) {
    // Minor extensions
    extensions.push(buildChord(chord.root, 'm7', 4));
    extensions.push(buildChord(chord.root, 'm9', 4));
    extensions.push(buildChord(chord.root, 'm11', 4));
    extensions.push(buildChord(chord.root, 'm13', 4));
  } else {
    // Major/Dominant extensions
    if (chord.type === 'maj' || chord.type === '') {
      extensions.push(buildChord(chord.root, 'maj7', 4));
      extensions.push(buildChord(chord.root, 'maj9', 4));
      extensions.push(buildChord(chord.root, 'maj13', 4));
    } else {
      // Dominant extensions
      extensions.push(buildChord(chord.root, '7', 4));
      extensions.push(buildChord(chord.root, '9', 4));
      extensions.push(buildChord(chord.root, '11', 4));
      extensions.push(buildChord(chord.root, '13', 4));
    }
  }
  
  return extensions;
}

/**
 * Get all available chord types
 * @returns Array of chord type names
 */
export function getChordTypes(): string[] {
  return Object.keys(CHORD_INTERVALS);
}

/**
 * Color palette for chord pads based on scale degree
 */
export const DEGREE_COLORS: string[] = [
  'from-rose-500 to-rose-600',      // I   - Tonic (warm, grounded)
  'from-amber-500 to-amber-600',    // II  - Supertonic
  'from-emerald-500 to-emerald-600', // III - Mediant  
  'from-cyan-500 to-cyan-600',      // IV  - Subdominant
  'from-blue-500 to-blue-600',      // V   - Dominant
  'from-violet-500 to-violet-600',  // VI  - Submediant
  'from-fuchsia-500 to-fuchsia-600', // VII - Leading tone
  'from-orange-500 to-orange-600',  // Extended
];

/**
 * Create chord pad assignments from diatonic chords
 * @param scale - Scale definition
 * @param use7ths - Whether to use 7th chords
 * @returns Array of ChordPadAssignment objects
 */
export function createDiatonicPadAssignments(
  scale: ScaleDefinition,
  use7ths: boolean = false
): ChordPadAssignment[] {
  const chords = generateDiatonicChords(scale, use7ths);
  
  return chords.map((chord, index) => ({
    id: `pad-${index}`,
    chord,
    color: DEGREE_COLORS[index % DEGREE_COLORS.length],
    locked: false,
  }));
}

export default {
  CHORD_INTERVALS,
  DEGREE_COLORS,
  buildChord,
  parseChordSymbol,
  generateDiatonicChords,
  getChordMidiNotes,
  getChordExtensions,
  getChordTypes,
  createDiatonicPadAssignments,
};
