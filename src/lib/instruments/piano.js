import * as Tone from 'tone';

/**
 * Electric Piano Instrument using Tone.Sampler
 * 
 * Uses high-quality piano/Wurlitzer samples for realistic EP sound.
 * Supports full MIDI note range with proper velocity response.
 */

// Sample URLs for piano notes
// Using a multi-sample approach: C2, C3, C4, C5, C6 as base samples
// Tone.Sampler will automatically pitch-shift between samples
// NOTE: These are placeholder URLs. In production, replace with your own hosted samples
// or use a reliable CDN. Tone.js will handle missing samples gracefully.
const PIANO_SAMPLES = {
  C2: 'https://tonejs.github.io/audio/salamander/C2.mp3',
  C3: 'https://tonejs.github.io/audio/salamander/C3.mp3',
  C4: 'https://tonejs.github.io/audio/salamander/C4.mp3',
  C5: 'https://tonejs.github.io/audio/salamander/C5.mp3',
  C6: 'https://tonejs.github.io/audio/salamander/C6.mp3',
};

let sampler = null;
let masterVolume = 0.7;
let isInitialized = false;

/**
 * Initialize the piano sampler
 * Preloads all samples for zero-latency playback
 * 
 * @returns {Promise<void>}
 */
export async function initPiano() {
  if (isInitialized) {
    return;
  }

  try {
    // Create sampler with piano samples
    sampler = new Tone.Sampler({
      urls: PIANO_SAMPLES,
      release: 1.5, // Longer release for sustained piano sound
      attack: 0.01, // Slight attack for natural feel
      volume: Tone.gainToDb(masterVolume),
      onerror: (error) => {
        console.warn('[Piano] Sample loading error (non-fatal):', error);
        // Continue even if some samples fail to load
      },
    }).toDestination();

    // Preload samples (with timeout to prevent hanging)
    const loadPromise = Tone.loaded();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Sample loading timeout')), 10000)
    );
    
    try {
      await Promise.race([loadPromise, timeoutPromise]);
    } catch (error) {
      console.warn('[Piano] Sample loading timeout or error (continuing anyway):', error);
      // Continue initialization even if samples aren't fully loaded
    }

    isInitialized = true;
    console.log('[Piano] Initialized with Tone.Sampler');
  } catch (error) {
    console.error('[Piano] Failed to initialize:', error);
    throw error;
  }
}

/**
 * Trigger a piano note
 * 
 * @param {number} note - MIDI note number (0-127)
 * @param {number} time - Time in Tone.Transport time (seconds) or AudioContext time
 * @param {number} [velocity=100] - MIDI velocity (0-127), defaults to 100
 */
export function triggerNote(note, time, velocity = 100) {
  if (!isInitialized || !sampler) {
    console.warn('[Piano] Not initialized, cannot trigger note');
    return;
  }

  // Validate MIDI note range
  if (note < 0 || note > 127) {
    console.warn(`[Piano] Invalid MIDI note: ${note}`);
    return;
  }

  // Convert MIDI note to note name (e.g., 60 -> "C4")
  const noteName = Tone.Frequency(note, 'midi').toNote();

  // Convert velocity to gain (0-127 -> 0-1)
  const velocityGain = velocity / 127;

  // Trigger the note
  // If time is provided, schedule it; otherwise play immediately
  if (time !== undefined && time !== null) {
    sampler.triggerAttackRelease(noteName, '2n', time, velocityGain);
  } else {
    sampler.triggerAttackRelease(noteName, '2n', Tone.now(), velocityGain);
  }
}

/**
 * Set master volume for piano
 * 
 * @param {number} volume - Volume (0-1)
 */
export function setVolume(volume) {
  masterVolume = Math.max(0, Math.min(1, volume));
  if (sampler) {
    sampler.volume.value = Tone.gainToDb(masterVolume);
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
 * Cleanup and dispose of the sampler
 */
export function dispose() {
  if (sampler) {
    sampler.dispose();
    sampler = null;
    isInitialized = false;
  }
}

/**
 * Check if piano is initialized
 * 
 * @returns {boolean}
 */
export function isReady() {
  return isInitialized && sampler !== null;
}

