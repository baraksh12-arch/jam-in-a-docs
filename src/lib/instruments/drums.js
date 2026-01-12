import * as Tone from 'tone';
import { getDrumSynth, disposeDrumSynth } from './drumSynth';

/**
 * Drum Kit Instrument with three sound engines:
 * 1. Tone.Sampler - Uses local samples from /samples/drums/ for sampled/acoustic drum sounds
 * 2. Synth-based - Uses Tone.MembraneSynth, NoiseSynth, etc. for basic electronic drum sounds
 * 3. Physics-based - Uses DrumSynth with modal synthesis for realistic drum sounds (DEFAULT)
 * 
 * Maps drum pad IDs (kick, snare, etc.) to note names (C1, D1, etc.) for Tone.Sampler.
 * Tone.js v15 Sampler requires note names or MIDI numbers as keys.
 * Each note gets its own file, so triggering the exact note plays the file at original pitch (no pitch-shifting).
 * Uses Tone.Transport for synchronized timing.
 */

// Drum kit mode constants
export const DRUM_KIT_MODE_SAMPLED = 'sampled';
export const DRUM_KIT_MODE_ELECTRONIC = 'electronic';
export const DRUM_KIT_MODE_PHYSICS = 'physics'; // New: physically-modeled synthesis

// Drum pad ID to note name mapping
// Maps UI names (kick, snare, etc.) to note names (C1, D1, etc.) for Tone.Sampler
const DRUM_NOTE_MAP = {
  'kick': 'C1',
  'snare': 'D1',
  'hihat': 'E1',
  'clap': 'F1',
  'tom1': 'G1',
  'tom2': 'A1',
  'ride': 'B1',
  'crash': 'C2',
};

// MIDI note number to drum name mapping (General MIDI drum standard)
// This allows DrumSetView to pass MIDI note numbers that get converted to drum names
const MIDI_TO_DRUM_MAP = {
  36: 'kick',     // GM Bass Drum 1
  38: 'snare',    // GM Acoustic Snare
  39: 'clap',     // GM Hand Clap
  42: 'hihat',    // GM Closed Hi-Hat
  46: 'hihat',    // GM Open Hi-Hat (mapped to hihat for now)
  45: 'tom2',     // GM Low Tom (Floor Tom - mapped to tom2)
  47: 'tom2',     // GM Low-Mid Tom
  48: 'tom1',     // GM Hi-Mid Tom
  49: 'crash',    // GM Crash Cymbal 1
  51: 'ride',     // GM Ride Cymbal 1
};

// Sample URLs - using local drum samples from /samples/drums/
// Tone.js v15 Sampler requires note names (C1, D1, etc.) or MIDI numbers as keys
// Each note gets its own file, so triggering the exact note plays the file at original pitch (no pitch-shifting)
const DRUM_SAMPLES = {
  'C1': 'kick.mp3',
  'D1': 'snare.mp3',
  'E1': 'hihat.mp3',
  'F1': 'clap.mp3',
  'G1': 'tom1.mp3',
  'A1': 'tom2.mp3',
  'B1': 'ride.mp3',
  'C2': 'crash.mp3',
};

let sampledDrumKit = null; // Sampler using local samples
let electronicDrumKit = null; // Object with synth voices for electronic sounds
let physicsDrumKit = null; // DrumSynth instance for physics-based sounds
let masterVolume = 0.8;
let isInitialized = false;
let currentDrumKitMode = DRUM_KIT_MODE_PHYSICS; // Default to physics-based for realistic sound

/**
 * Create electronic drum kit using synth-based voices
 * Uses Tone.MembraneSynth for kick/toms, NoiseSynth for snare/hihat/cymbals
 */
function createElectronicKit() {
  const volume = Tone.gainToDb(masterVolume);
  
  electronicDrumKit = {
    kick: new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 10,
      oscillator: {
        type: 'sine'
      },
      envelope: {
        attack: 0.001,
        decay: 0.4,
        sustain: 0.01,
        release: 0.8,
        attackCurve: 'exponential'
      },
      volume: volume
    }).toDestination(),
    
    snare: new Tone.NoiseSynth({
      noise: {
        type: 'white',
        playbackRate: 1
      },
      envelope: {
        attack: 0.005,
        decay: 0.1,
        sustain: 0,
        release: 0.1
      },
      volume: volume
    }).toDestination(),
    
    hihat: new Tone.NoiseSynth({
      noise: {
        type: 'white',
        playbackRate: 3
      },
      envelope: {
        attack: 0.001,
        decay: 0.05,
        sustain: 0,
        release: 0.03
      },
      volume: volume - 3 // Slightly quieter
    }).toDestination(),
    
    clap: new Tone.NoiseSynth({
      noise: {
        type: 'white',
        playbackRate: 1.5
      },
      envelope: {
        attack: 0.001,
        decay: 0.2,
        sustain: 0,
        release: 0.1
      },
      volume: volume
    }).toDestination(),
    
    tom1: new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 8,
      oscillator: {
        type: 'sine'
      },
      envelope: {
        attack: 0.001,
        decay: 0.3,
        sustain: 0.01,
        release: 0.5,
        attackCurve: 'exponential'
      },
      volume: volume
    }).toDestination(),
    
    tom2: new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 8,
      oscillator: {
        type: 'sine'
      },
      envelope: {
        attack: 0.001,
        decay: 0.3,
        sustain: 0.01,
        release: 0.5,
        attackCurve: 'exponential'
      },
      volume: volume
    }).toDestination(),
    
    ride: new Tone.NoiseSynth({
      noise: {
        type: 'white',
        playbackRate: 2
      },
      envelope: {
        attack: 0.001,
        decay: 0.3,
        sustain: 0,
        release: 0.5
      },
      volume: volume - 2
    }).toDestination(),
    
    crash: new Tone.NoiseSynth({
      noise: {
        type: 'white',
        playbackRate: 2.5
      },
      envelope: {
        attack: 0.001,
        decay: 0.4,
        sustain: 0,
        release: 0.6
      },
      volume: volume
    }).toDestination()
  };
  
  console.log('[Drums] Electronic kit ready (synth-based)');
}

/**
 * Initialize the drum instrument (all three engines: sampled, electronic, and physics)
 * Preloads all samples for zero-latency playback
 * 
 * @returns {Promise<void>}
 */
export async function initDrums() {
  if (isInitialized) {
    return;
  }

  try {
    // Create physics-based drum kit (DrumSynth - modal synthesis)
    physicsDrumKit = getDrumSynth();
    await physicsDrumKit.init();
    physicsDrumKit.setVolume(masterVolume);
    console.log('[Drums] Physics kit ready (modal synthesis)');

    // Create sampled drum kit with local samples (fallback)
    sampledDrumKit = new Tone.Sampler({
      urls: DRUM_SAMPLES,
      baseUrl: '/samples/drums/',
      release: 0.1, // Short release for punchy drums
      attack: 0,    // Instant attack
      volume: Tone.gainToDb(masterVolume),
      onload: () => {
        console.log('[Drums] Sampled kit ready (local)');
      },
      onerror: (error) => {
        console.warn('[Drums] Sample loading error (non-fatal, will continue with available samples):', error);
        // Continue even if some samples fail to load
      },
    }).toDestination();

    // Create electronic drum kit (synth-based, legacy)
    createElectronicKit();

    // Preload samples (with timeout to prevent hanging)
    const loadPromise = Tone.loaded();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Sample loading timeout')), 10000)
    );
    
    try {
      await Promise.race([loadPromise, timeoutPromise]);
    } catch (error) {
      console.warn('[Drums] Sample loading timeout or error (continuing anyway):', error);
      // Continue initialization even if samples aren't fully loaded
    }

    isInitialized = true;
    console.log('[Drums] Initialized with physics (default), sampled, and electronic kits');
  } catch (error) {
    console.error('[Drums] Failed to initialize:', error);
    throw error;
  }
}

/**
 * Set the drum kit mode (sampled, electronic, or physics)
 * Stops all active notes before switching to prevent stuck notes
 * 
 * @param {string} mode - 'sampled' | 'electronic' | 'physics'
 */
export function setDrumKitMode(mode) {
  if (mode !== DRUM_KIT_MODE_SAMPLED && mode !== DRUM_KIT_MODE_ELECTRONIC && mode !== DRUM_KIT_MODE_PHYSICS) {
    console.warn(`[Drums] Invalid kit mode: ${mode}. Use '${DRUM_KIT_MODE_SAMPLED}', '${DRUM_KIT_MODE_ELECTRONIC}', or '${DRUM_KIT_MODE_PHYSICS}'`);
    return;
  }
  
  // Stop all active notes before switching
  stopAllNotes();
  
  console.log('[Drums] Switching kit mode to:', mode);
  currentDrumKitMode = mode;
}

/**
 * Stop all active notes on both sampled and electronic kits
 * Prevents stuck notes when switching modes
 */
export function stopAllNotes() {
  // Stop sampled kit
  if (sampledDrumKit) {
    sampledDrumKit.releaseAll();
  }
  
  // Stop electronic kit (all voices)
  if (electronicDrumKit) {
    Object.values(electronicDrumKit).forEach(voice => {
      if (voice && typeof voice.triggerRelease === 'function') {
        voice.triggerRelease();
      }
    });
  }
}

/**
 * Get the current drum kit mode
 * 
 * @returns {string} Current mode ('sampled' | 'electronic')
 */
export function getDrumKitMode() {
  return currentDrumKitMode;
}

/**
 * Trigger a drum sound
 * Routes to the appropriate engine based on current kit mode
 * 
 * @param {string|number} nameOrMidi - Drum pad ID (e.g., 'kick', 'snare') OR MIDI note number (36, 38, etc.)
 * @param {number} time - Time in Tone.Transport time (seconds) or AudioContext time
 * @param {number} [velocity=100] - MIDI velocity (0-127), defaults to 100
 * @param {Object} [options={}] - Additional options for physics-based synthesis
 * @param {number} [options.position=0.5] - Hit position (0=center, 1=edge)
 * @param {string} [options.articulation='tip'] - Articulation type (tip, edge, rim, rimshot, ghost, bell, foot)
 */
export async function triggerNote(nameOrMidi, time, velocity = 100, options = {}) {
  if (!isInitialized) {
    console.warn('[Drums] Not initialized, cannot trigger note');
    return;
  }

  // Convert MIDI note number to drum name if needed
  let drumName = nameOrMidi;
  if (typeof nameOrMidi === 'number') {
    drumName = MIDI_TO_DRUM_MAP[nameOrMidi];
    if (!drumName) {
      console.warn(`[Drums] Unknown MIDI note: ${nameOrMidi}`);
      return;
    }
  }

  // Ensure AudioContext is running (critical for iOS/Android)
  // This must be called from a user gesture handler
  const context = Tone.getContext();
  if (context.state !== 'running') {
    try {
      await Tone.start();
      console.log('[Drums] AudioContext resumed via Tone.start()');
    } catch (e) {
      console.warn('[Drums] Failed to resume AudioContext:', e);
      return;
    }
  }

  // Enhanced velocity mapping for drums: use exponential curve for more dynamic response
  // Drums respond well to velocity with a moderate curve (velocity^0.7)
  // This makes soft hits quieter and hard hits louder in a more natural way
  const normalizedVelocity = Math.max(0, Math.min(127, velocity)) / 127;
  const velocityGain = Math.pow(normalizedVelocity, 0.7); // Moderate curve for drums (0.7)

  // Extract physics options
  const { position = 0.5, articulation = 'tip' } = options;

  // Route to appropriate engine based on kit mode
  if (currentDrumKitMode === DRUM_KIT_MODE_PHYSICS) {
    // Physics kit: use DrumSynth with modal synthesis
    if (!physicsDrumKit || !physicsDrumKit.isReady()) {
      console.warn('[Drums] Physics kit not ready, cannot trigger note');
      return;
    }

    const triggerTime = time !== undefined && time !== null ? time : Tone.now();
    
    // Trigger the physics-based voice with full parameters
    physicsDrumKit.trigger(drumName, {
      velocity: normalizedVelocity,
      position: position,
      articulation: articulation,
      time: triggerTime,
    });
    
  } else if (currentDrumKitMode === DRUM_KIT_MODE_SAMPLED) {
    // Sampled kit: use Tone.Sampler with local samples
    if (!sampledDrumKit) {
      console.warn('[Drums] Sampled kit not ready, cannot trigger note');
      return;
    }

    // Map drum pad ID to note name (C1, D1, etc.) for Tone.Sampler
    const note = DRUM_NOTE_MAP[drumName];
    if (!note) {
      console.warn(`[Drums] Unknown drum pad ID: ${drumName}`);
      return;
    }

    // Trigger the note using the note name (C1, D1, etc.)
    // Each note has its own file, so triggering the exact note plays the file at original pitch (no pitch-shifting)
    if (time !== undefined && time !== null) {
      sampledDrumKit.triggerAttackRelease(note, '8n', time, velocityGain);
    } else {
      sampledDrumKit.triggerAttackRelease(note, '8n', Tone.now(), velocityGain);
    }
  } else if (currentDrumKitMode === DRUM_KIT_MODE_ELECTRONIC) {
    // Electronic kit: use synth-based voices
    if (!electronicDrumKit) {
      console.warn('[Drums] Electronic kit not ready, cannot trigger note');
      return;
    }

    const voice = electronicDrumKit[drumName];
    if (!voice) {
      console.warn(`[Drums] Electronic kit: unknown voice: ${drumName}`);
      return;
    }

    // Electronic voices use different frequencies for different sounds
    const frequencies = {
      kick: 'C1',
      snare: 'C2',
      hihat: 'C3',
      clap: 'C2',
      tom1: 'G1',
      tom2: 'A1',
      ride: 'C4',
      crash: 'C5'
    };

    const frequency = frequencies[drumName] || 'C2';
    const triggerTime = time !== undefined && time !== null ? time : Tone.now();

    // Trigger the synth voice
    voice.triggerAttackRelease(frequency, '8n', triggerTime, velocityGain);
  }
}

/**
 * Set hi-hat pedal openness (physics mode only)
 * @param {number} amount - 0-1 (0=closed, 1=open)
 */
export function setHiHatOpen(amount) {
  if (physicsDrumKit && physicsDrumKit.isReady()) {
    physicsDrumKit.setHiHatOpen(amount);
  }
}

/**
 * Choke a cymbal (physics mode only)
 * @param {string} voiceName - 'crash', 'ride', or 'hihat'
 * @param {number} time - AudioContext time
 */
export function chokeCymbal(voiceName, time) {
  if (physicsDrumKit && physicsDrumKit.isReady()) {
    physicsDrumKit.choke(voiceName, time);
  }
}

/**
 * Set master volume for drums
 * Updates volume on all kit modes (physics, sampled, electronic)
 * 
 * @param {number} volume - Volume (0-1)
 */
export function setVolume(volume) {
  masterVolume = Math.max(0, Math.min(1, volume));
  const volumeDb = Tone.gainToDb(masterVolume);
  
  // Update physics kit volume
  if (physicsDrumKit && physicsDrumKit.isReady()) {
    physicsDrumKit.setVolume(masterVolume);
  }
  
  if (sampledDrumKit) {
    sampledDrumKit.volume.value = volumeDb;
  }
  
  if (electronicDrumKit) {
    // Update volume on all electronic voices
    Object.values(electronicDrumKit).forEach(voice => {
      if (voice && voice.volume) {
        // Adjust relative volumes (hihat and ride are slightly quieter)
        if (voice === electronicDrumKit.hihat) {
          voice.volume.value = volumeDb - 3;
        } else if (voice === electronicDrumKit.ride) {
          voice.volume.value = volumeDb - 2;
        } else {
          voice.volume.value = volumeDb;
        }
      }
    });
  }
}

/**
 * Get current volume
 * 
 * @returns {number} Volume (0-1)
 */
export function getVolume() {
  return masterVolume;
}

/**
 * Cleanup and dispose of all drum kits
 */
export function dispose() {
  // Dispose physics kit
  if (physicsDrumKit) {
    disposeDrumSynth();
    physicsDrumKit = null;
  }
  
  if (sampledDrumKit) {
    sampledDrumKit.dispose();
    sampledDrumKit = null;
  }
  
  if (electronicDrumKit) {
    // Dispose all electronic voices
    Object.values(electronicDrumKit).forEach(voice => {
      if (voice && voice.dispose) {
        voice.dispose();
      }
    });
    electronicDrumKit = null;
  }
  
  isInitialized = false;
}

/**
 * Check if drums are initialized
 * 
 * @returns {boolean}
 */
export function isReady() {
  return isInitialized && (
    (physicsDrumKit !== null && physicsDrumKit.isReady()) || 
    sampledDrumKit !== null || 
    electronicDrumKit !== null
  );
}

/**
 * Debug helper functions for manual testing in browser console
 * Usage: window.__debugDrumsKick(), window.__debugDrumsSnare(), etc.
 */
if (typeof window !== 'undefined') {
  window.__debugDrumsKick = async () => {
    await Tone.start();
    console.log('[Drums] __debugDrumsKick()');
    triggerNote('kick');
  };

  window.__debugDrumsSnare = async () => {
    await Tone.start();
    console.log('[Drums] __debugDrumsSnare()');
    triggerNote('snare');
  };

  window.__debugDrumsHihat = async () => {
    await Tone.start();
    console.log('[Drums] __debugDrumsHihat()');
    triggerNote('hihat');
  };

  window.__debugDrumsAll = async () => {
    await Tone.start();
    console.log('[Drums] __debugDrumsAll() - testing all pads');
    const pads = ['kick', 'snare', 'hihat', 'clap', 'tom1', 'tom2', 'ride', 'crash'];
    pads.forEach((pad, i) => {
      setTimeout(() => {
        console.log(`[Drums] Testing ${pad}`);
        triggerNote(pad);
      }, i * 200);
    });
  };
}

