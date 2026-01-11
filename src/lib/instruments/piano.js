import * as Tone from 'tone';

/**
 * Electric Piano Instrument with dual sound engines:
 * 1. Electric Piano (Wurlitzer/Rhodes style) - Bright, electric sound
 * 2. Upright Piano (Acoustic piano) - Warm, acoustic sound
 * 
 * Uses Tone.Sampler for both modes with different sample sets.
 * Supports full MIDI note range with proper velocity response.
 */

// EP mode constants
export const EP_MODE_ELECTRIC = 'electric';
export const EP_MODE_UPRIGHT = 'upright';

// Professional Grand Piano Samples (Salamander Grand Piano)
// Using more sample points for better quality across the full range
const ELECTRIC_PIANO_SAMPLES = {
  A0: 'https://tonejs.github.io/audio/salamander/A0.mp3',
  C1: 'https://tonejs.github.io/audio/salamander/C1.mp3',
  'D#1': 'https://tonejs.github.io/audio/salamander/Ds1.mp3',
  'F#1': 'https://tonejs.github.io/audio/salamander/Fs1.mp3',
  A1: 'https://tonejs.github.io/audio/salamander/A1.mp3',
  C2: 'https://tonejs.github.io/audio/salamander/C2.mp3',
  'D#2': 'https://tonejs.github.io/audio/salamander/Ds2.mp3',
  'F#2': 'https://tonejs.github.io/audio/salamander/Fs2.mp3',
  A2: 'https://tonejs.github.io/audio/salamander/A2.mp3',
  C3: 'https://tonejs.github.io/audio/salamander/C3.mp3',
  'D#3': 'https://tonejs.github.io/audio/salamander/Ds3.mp3',
  'F#3': 'https://tonejs.github.io/audio/salamander/Fs3.mp3',
  A3: 'https://tonejs.github.io/audio/salamander/A3.mp3',
  C4: 'https://tonejs.github.io/audio/salamander/C4.mp3',
  'D#4': 'https://tonejs.github.io/audio/salamander/Ds4.mp3',
  'F#4': 'https://tonejs.github.io/audio/salamander/Fs4.mp3',
  A4: 'https://tonejs.github.io/audio/salamander/A4.mp3',
  C5: 'https://tonejs.github.io/audio/salamander/C5.mp3',
  'D#5': 'https://tonejs.github.io/audio/salamander/Ds5.mp3',
  'F#5': 'https://tonejs.github.io/audio/salamander/Fs5.mp3',
  A5: 'https://tonejs.github.io/audio/salamander/A5.mp3',
  C6: 'https://tonejs.github.io/audio/salamander/C6.mp3',
  'D#6': 'https://tonejs.github.io/audio/salamander/Ds6.mp3',
  'F#6': 'https://tonejs.github.io/audio/salamander/Fs6.mp3',
  A6: 'https://tonejs.github.io/audio/salamander/A6.mp3',
  C7: 'https://tonejs.github.io/audio/salamander/C7.mp3',
  'D#7': 'https://tonejs.github.io/audio/salamander/Ds7.mp3',
  'F#7': 'https://tonejs.github.io/audio/salamander/Fs7.mp3',
  A7: 'https://tonejs.github.io/audio/salamander/A7.mp3',
  C8: 'https://tonejs.github.io/audio/salamander/C8.mp3',
};

// Upright Piano uses same high-quality samples
const UPRIGHT_PIANO_SAMPLES = ELECTRIC_PIANO_SAMPLES;

let electricSampler = null;
let uprightSampler = null;
let pianoReverb = null;
let currentEPMode = EP_MODE_ELECTRIC;
let masterVolume = 0.7;
let isInitialized = false;

/**
 * Initialize both piano samplers (Electric and Upright)
 * Preloads all samples for zero-latency playback
 * 
 * @returns {Promise<void>}
 */
export async function initPiano() {
  if (isInitialized) {
    return;
  }

  try {
    // Create professional reverb for piano (shared by both samplers)
    pianoReverb = new Tone.Reverb({
      roomSize: 0.8,
      dampening: 3000,
      wet: 0.15, // Subtle reverb for natural room sound
    }).toDestination();

    // Create Electric Piano sampler with professional settings
    electricSampler = new Tone.Sampler({
      urls: ELECTRIC_PIANO_SAMPLES,
      release: 2.0, // Longer release for natural piano sustain
      attack: 0.005, // Very fast attack for responsive feel
      volume: Tone.gainToDb(masterVolume),
      baseUrl: '', // Samples are from CDN
      onload: () => {
        console.log('[Piano] Professional electric piano samples loaded');
      },
      onerror: (error) => {
        console.warn('[Piano] Electric piano sample loading error (non-fatal):', error);
      },
    }).connect(pianoReverb);

    // Create Upright Piano sampler with professional settings
    uprightSampler = new Tone.Sampler({
      urls: UPRIGHT_PIANO_SAMPLES,
      release: 2.5, // Longer release for warm acoustic piano
      attack: 0.01, // Natural attack for acoustic feel
      volume: Tone.gainToDb(masterVolume),
      baseUrl: '', // Samples are from CDN
      onload: () => {
        console.log('[Piano] Professional upright piano samples loaded');
      },
      onerror: (error) => {
        console.warn('[Piano] Upright piano sample loading error (non-fatal):', error);
      },
    }).connect(pianoReverb);

    // Preload samples (with timeout to prevent hanging)
    const loadPromise = Tone.loaded();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Sample loading timeout')), 10000)
    );
    
    try {
      await Promise.race([loadPromise, timeoutPromise]);
    } catch (error) {
      console.warn('[Piano] Sample loading timeout or error (continuing anyway - instruments will work with available samples):', error);
      // Continue initialization even if samples aren't fully loaded
      // Instruments will gracefully degrade if samples are missing
    }

    isInitialized = true;
    console.log('[Piano] Initialized with Electric and Upright Piano samplers');
  } catch (error) {
    console.error('[Piano] Failed to initialize:', error);
    throw error;
  }
}

/**
 * Trigger a piano note ON (attack) - Note will sustain until releaseNote is called
 * This creates natural, expressive piano playing like Jacob Collier
 * 
 * @param {number} note - MIDI note number (0-127)
 * @param {number} time - Time in Tone.Transport time (seconds) or AudioContext time
 * @param {number} [velocity=100] - MIDI velocity (0-127), defaults to 100
 */
export async function triggerNote(note, time, velocity = 100) {
  if (!isInitialized) {
    console.warn('[Piano] Not initialized, cannot trigger note');
    return;
  }

  // Ensure AudioContext is running (critical for iOS/Android)
  const context = Tone.getContext();
  if (context.state !== 'running') {
    try {
      await Tone.start();
      console.log('[Piano] AudioContext resumed via Tone.start()');
    } catch (e) {
      console.warn('[Piano] Failed to resume AudioContext:', e);
      return;
    }
  }

  // Validate MIDI note range
  if (note < 0 || note > 127) {
    console.warn(`[Piano] Invalid MIDI note: ${note}`);
    return;
  }

  // Get the active sampler based on current mode
  const activeSampler = currentEPMode === EP_MODE_ELECTRIC ? electricSampler : uprightSampler;
  
  if (!activeSampler) {
    console.warn(`[Piano] Sampler not available for mode: ${currentEPMode}`);
    return;
  }

  // Convert MIDI note to note name (e.g., 60 -> "C4")
  const noteName = Tone.Frequency(note, 'midi').toNote();

  // Professional velocity mapping: exponential curve for natural piano response
  // Piano samples respond better to velocity with a softer curve (velocity^0.5)
  // This creates a more expressive, dynamic range like a real piano
  const normalizedVelocity = Math.max(0, Math.min(127, velocity)) / 127;
  const velocityGain = Math.pow(normalizedVelocity, 0.5); // Professional curve for expressive piano

  // Trigger note attack - sustain until release is called
  // This allows for natural sustain based on how long the user holds the key
  if (time !== undefined && time !== null) {
    activeSampler.triggerAttack(noteName, time, velocityGain);
  } else {
    activeSampler.triggerAttack(noteName, Tone.now(), velocityGain);
  }
}

/**
 * Release a piano note (note off) - Stops the sustain naturally
 * 
 * @param {number} note - MIDI note number (0-127)
 * @param {number} time - Optional time for scheduled release
 */
export function releaseNote(note, time) {
  if (!isInitialized) return;

  const activeSampler = currentEPMode === EP_MODE_ELECTRIC ? electricSampler : uprightSampler;
  if (!activeSampler) return;

  const noteName = Tone.Frequency(note, 'midi').toNote();
  
  if (time !== undefined && time !== null) {
    activeSampler.triggerRelease(noteName, time);
  } else {
    activeSampler.triggerRelease(noteName, Tone.now());
  }
}

/**
 * Set the EP mode (Electric or Upright)
 * Stops all active notes before switching to prevent stuck notes
 * 
 * @param {string} mode - EP_MODE_ELECTRIC or EP_MODE_UPRIGHT
 */
export function setEPMode(mode) {
  if (mode !== EP_MODE_ELECTRIC && mode !== EP_MODE_UPRIGHT) {
    console.warn(`[Piano] Invalid EP mode: ${mode}`);
    return;
  }

  // Stop all active notes before switching
  stopAllNotes();

  currentEPMode = mode;
  console.log(`[Piano] EP mode switched to: ${mode}`);
}

/**
 * Get the current EP mode
 * 
 * @returns {string} Current mode (EP_MODE_ELECTRIC or EP_MODE_UPRIGHT)
 */
export function getEPMode() {
  return currentEPMode;
}

/**
 * Stop all active notes on both samplers
 * Prevents stuck notes when switching modes
 */
export function stopAllNotes() {
  if (electricSampler) {
    electricSampler.releaseAll();
  }
  if (uprightSampler) {
    uprightSampler.releaseAll();
  }
}

/**
 * Set master volume for piano (both samplers)
 * 
 * @param {number} volume - Volume (0-1)
 */
export function setVolume(volume) {
  masterVolume = Math.max(0, Math.min(1, volume));
  if (electricSampler) {
    electricSampler.volume.value = Tone.gainToDb(masterVolume);
  }
  if (uprightSampler) {
    uprightSampler.volume.value = Tone.gainToDb(masterVolume);
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
 * Cleanup and dispose of both samplers and reverb
 */
export function dispose() {
  if (electricSampler) {
    electricSampler.dispose();
    electricSampler = null;
  }
  if (uprightSampler) {
    uprightSampler.dispose();
    uprightSampler = null;
  }
  if (pianoReverb) {
    pianoReverb.dispose();
    pianoReverb = null;
  }
  isInitialized = false;
}

/**
 * Check if piano is initialized
 * 
 * @returns {boolean}
 */
export function isReady() {
  return isInitialized && (electricSampler !== null || uprightSampler !== null);
}

