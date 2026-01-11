/**
 * Chord Pad Presets
 * 
 * Pre-configured scale/chord/voicing combinations for quick setup.
 * Users can save and load custom presets.
 */

import { buildScale, type ScaleDefinition } from './scale';
import type { VoicingType } from './voicing';

/**
 * Chord Pad Preset Interface
 */
export interface ChordPadPreset {
  name: string;
  description: string;
  scale: ScaleDefinition;
  use7thChords: boolean;
  voicing: {
    voicingType: VoicingType;
    addBass: boolean;
    voiceLeading: boolean;
  };
  strumTime: number;
  humanize: number;
  sustain: boolean;
}

/**
 * Built-in Presets
 */
export const CHORD_PAD_PRESETS: ChordPadPreset[] = [
  // Pop & Contemporary
  {
    name: 'C Major Pop',
    description: 'Classic pop progression in C major. Great for singer-songwriters.',
    scale: buildScale('C', 'Major'),
    use7thChords: false,
    voicing: {
      voicingType: 'close',
      addBass: false,
      voiceLeading: false,
    },
    strumTime: 0,
    humanize: 0,
    sustain: true,
  },
  {
    name: 'G Major Acoustic',
    description: 'Strummed acoustic feel in G. Perfect for folk and country.',
    scale: buildScale('G', 'Major'),
    use7thChords: false,
    voicing: {
      voicingType: 'close',
      addBass: true,
      voiceLeading: false,
    },
    strumTime: 40,
    humanize: 0.3,
    sustain: false,
  },
  
  // Jazz & Neo-Soul
  {
    name: 'C Major Jazz',
    description: 'Smooth jazz voicings with 7th chords and voice leading.',
    scale: buildScale('C', 'Major'),
    use7thChords: true,
    voicing: {
      voicingType: 'drop2',
      addBass: true,
      voiceLeading: true,
    },
    strumTime: 0,
    humanize: 0.2,
    sustain: true,
  },
  {
    name: 'D Dorian Funk',
    description: 'Funky minor groove. Ideal for neo-soul and R&B.',
    scale: buildScale('D', 'Dorian'),
    use7thChords: true,
    voicing: {
      voicingType: 'close',
      addBass: true,
      voiceLeading: true,
    },
    strumTime: 15,
    humanize: 0.4,
    sustain: false,
  },
  {
    name: 'F Lydian Dream',
    description: 'Ethereal, floating quality. Great for ambient and cinematic.',
    scale: buildScale('F', 'Lydian'),
    use7thChords: true,
    voicing: {
      voicingType: 'open',
      addBass: false,
      voiceLeading: true,
    },
    strumTime: 60,
    humanize: 0.5,
    sustain: true,
  },
  
  // Cinematic & Emotional
  {
    name: 'A Minor Cinematic',
    description: 'Emotional minor key. Perfect for film scores and ballads.',
    scale: buildScale('A', 'Natural Minor'),
    use7thChords: false,
    voicing: {
      voicingType: 'open',
      addBass: true,
      voiceLeading: true,
    },
    strumTime: 30,
    humanize: 0.3,
    sustain: true,
  },
  {
    name: 'E Harmonic Minor',
    description: 'Dramatic and mysterious. Classical meets modern.',
    scale: buildScale('E', 'Harmonic Minor'),
    use7thChords: false,
    voicing: {
      voicingType: 'close',
      addBass: true,
      voiceLeading: false,
    },
    strumTime: 0,
    humanize: 0.1,
    sustain: true,
  },
  {
    name: 'B♭ Blues',
    description: 'Classic blues scale for soulful progressions.',
    scale: buildScale('A#', 'Blues'),
    use7thChords: true,
    voicing: {
      voicingType: 'close',
      addBass: true,
      voiceLeading: false,
    },
    strumTime: 20,
    humanize: 0.5,
    sustain: false,
  },
  
  // Electronic & Modern
  {
    name: 'F# Pentatonic Ambient',
    description: 'Minimalist pentatonic. Safe and always consonant.',
    scale: buildScale('F#', 'Pentatonic Major'),
    use7thChords: false,
    voicing: {
      voicingType: 'open',
      addBass: false,
      voiceLeading: true,
    },
    strumTime: 70,
    humanize: 0.6,
    sustain: true,
  },
  {
    name: 'A Mixolydian Rock',
    description: 'Classic rock sound with flat 7th. Bluesy and driving.',
    scale: buildScale('A', 'Mixolydian'),
    use7thChords: false,
    voicing: {
      voicingType: 'close',
      addBass: true,
      voiceLeading: false,
    },
    strumTime: 25,
    humanize: 0.3,
    sustain: false,
  },
  {
    name: 'D Minor Lo-Fi',
    description: 'Chill lo-fi beats vibe with 7ths and gentle strum.',
    scale: buildScale('D', 'Natural Minor'),
    use7thChords: true,
    voicing: {
      voicingType: 'close',
      addBass: true,
      voiceLeading: true,
    },
    strumTime: 35,
    humanize: 0.7,
    sustain: true,
  },
  {
    name: 'E Phrygian Flamenco',
    description: 'Spanish/Middle Eastern flavor with the Phrygian mode.',
    scale: buildScale('E', 'Phrygian'),
    use7thChords: false,
    voicing: {
      voicingType: 'close',
      addBass: true,
      voiceLeading: false,
    },
    strumTime: 50,
    humanize: 0.4,
    sustain: false,
  },
];

/**
 * Serialize a preset to JSON string
 */
export function serializePreset(preset: ChordPadPreset): string {
  return JSON.stringify({
    name: preset.name,
    description: preset.description,
    scale: {
      root: preset.scale.root,
      type: preset.scale.type,
      isCustom: preset.scale.isCustom,
      customName: preset.scale.customName,
      intervals: preset.scale.isCustom ? preset.scale.intervals : undefined,
    },
    use7thChords: preset.use7thChords,
    voicing: preset.voicing,
    strumTime: preset.strumTime,
    humanize: preset.humanize,
    sustain: preset.sustain,
  }, null, 2);
}

/**
 * Deserialize a preset from JSON string
 */
export function deserializePreset(json: string): ChordPadPreset | null {
  try {
    const data = JSON.parse(json);
    
    // Rebuild scale from serialized data
    let scale: ScaleDefinition;
    if (data.scale.isCustom) {
      // Custom scale - would need to rebuild with intervals
      // For now, fall back to major
      scale = buildScale(data.scale.root, 'Major');
    } else {
      scale = buildScale(data.scale.root, data.scale.type);
    }
    
    return {
      name: data.name || 'Unnamed Preset',
      description: data.description || '',
      scale,
      use7thChords: data.use7thChords ?? false,
      voicing: {
        voicingType: data.voicing?.voicingType || 'close',
        addBass: data.voicing?.addBass ?? false,
        voiceLeading: data.voicing?.voiceLeading ?? false,
      },
      strumTime: data.strumTime ?? 0,
      humanize: data.humanize ?? 0,
      sustain: data.sustain ?? true,
    };
  } catch (error) {
    console.error('Failed to deserialize preset:', error);
    return null;
  }
}

/**
 * Save presets to localStorage
 */
export function saveUserPresets(presets: ChordPadPreset[]): void {
  try {
    const serialized = presets.map(serializePreset);
    localStorage.setItem('chord-pad-user-presets', JSON.stringify(serialized));
  } catch (error) {
    console.error('Failed to save presets:', error);
  }
}

/**
 * Load presets from localStorage
 */
export function loadUserPresets(): ChordPadPreset[] {
  try {
    const stored = localStorage.getItem('chord-pad-user-presets');
    if (!stored) return [];
    
    const serialized = JSON.parse(stored) as string[];
    return serialized
      .map(deserializePreset)
      .filter((p): p is ChordPadPreset => p !== null);
  } catch (error) {
    console.error('Failed to load presets:', error);
    return [];
  }
}

export default {
  CHORD_PAD_PRESETS,
  serializePreset,
  deserializePreset,
  saveUserPresets,
  loadUserPresets,
};
