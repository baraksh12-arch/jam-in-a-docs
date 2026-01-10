import * as Tone from 'tone';

/**
 * Guitar Instrument with Professional Sound Design
 * 
 * Two modes for versatile playing:
 * 1. Electric Guitar - Karplus-Strong plucked string model with amp simulation
 * 2. Nylon Guitar - Warm acoustic nylon string with body resonance
 * 
 * Uses Tone.PluckSynth for realistic plucked string sounds (Google Shared Piano quality).
 */

// Guitar mode constants
export const GUITAR_MODE_ELECTRIC = 'electric';
export const GUITAR_MODE_NYLON = 'nylon';

let electricSynth = null;
let electricChorus = null;
let electricDistortion = null;
let electricReverb = null;
let electricCompressor = null;

let nylonSynth = null;
let nylonReverb = null;
let nylonEQ = null;

let currentGuitarMode = GUITAR_MODE_ELECTRIC;
let masterVolume = 0.7;
let isInitialized = false;

/**
 * Initialize both guitar synthesizers (Electric and Nylon)
 * Uses Tone.PluckSynth for realistic Karplus-Strong plucked string synthesis
 * 
 * @returns {Promise<void>}
 */
export async function initGuitar() {
  if (isInitialized) {
    return;
  }

  try {
    // === ELECTRIC GUITAR ===
    // PluckSynth uses Karplus-Strong algorithm for realistic plucked strings
    electricSynth = new Tone.PluckSynth({
      attackNoise: 2,      // Amount of attack "pick" noise
      dampening: 4000,     // Higher = brighter sustain (4kHz cutoff)
      resonance: 0.98,     // String resonance (higher = longer sustain)
      release: 1,          // Release time
      volume: Tone.gainToDb(masterVolume),
    });
    
    // Compressor for consistent dynamics (like a real amp)
    electricCompressor = new Tone.Compressor({
      threshold: -20,
      ratio: 4,
      attack: 0.003,
      release: 0.25,
    });
    
    // Subtle chorus for width (like a JC-120 clean tone)
    electricChorus = new Tone.Chorus({
      frequency: 1.5,
      delayTime: 3.5,
      depth: 0.3,
      wet: 0.15,
      spread: 180,
    }).start();

    // Overdrive for grit (tube amp simulation)
    electricDistortion = new Tone.Distortion({
      distortion: 0.25,   // Subtle crunch
      wet: 0.4,
    });

    // Reverb for space (spring reverb character)
    electricReverb = new Tone.Reverb({
      decay: 1.5,
      wet: 0.15,
    });

    // Signal chain: synth -> compressor -> chorus -> distortion -> reverb -> out
    electricSynth.connect(electricCompressor);
    electricCompressor.connect(electricChorus);
    electricChorus.connect(electricDistortion);
    electricDistortion.connect(electricReverb);
    electricReverb.toDestination();

    // === NYLON GUITAR ===
    // Warmer, softer attack for classical/acoustic feel
    nylonSynth = new Tone.PluckSynth({
      attackNoise: 1,      // Less pick attack for finger-style
      dampening: 2500,     // Lower cutoff for warmer tone
      resonance: 0.96,     // Slightly less sustain
      release: 1.5,        // Longer release for body resonance
      volume: Tone.gainToDb(masterVolume),
    });
    
    // EQ to shape the body resonance
    nylonEQ = new Tone.EQ3({
      low: 2,              // Boost lows for body
      mid: -1,             // Slight mid cut
      high: -2,            // Roll off highs for warmth
      lowFrequency: 200,
      highFrequency: 2500,
    });

    // Larger reverb for acoustic space
    nylonReverb = new Tone.Reverb({
      decay: 2.5,
      wet: 0.3,
    });

    // Signal chain: synth -> EQ -> reverb -> out
    nylonSynth.connect(nylonEQ);
    nylonEQ.connect(nylonReverb);
    nylonReverb.toDestination();

    // Generate reverb impulse responses
    await Promise.all([
      electricReverb.generate(),
      nylonReverb.generate()
    ]);

    isInitialized = true;
    console.log('[Guitar] Initialized with PluckSynth (Karplus-Strong) for realistic guitar sounds');
  } catch (error) {
    console.error('[Guitar] Failed to initialize:', error);
    throw error;
  }
}

/**
 * Trigger a guitar note using the current mode (Electric or Nylon)
 * PluckSynth uses triggerAttack with frequency - it's a one-shot pluck
 * 
 * @param {number} note - MIDI note number (0-127)
 * @param {number} time - Time in Tone.Transport time (seconds) or AudioContext time
 * @param {number} [velocity=100] - MIDI velocity (0-127), defaults to 100
 */
export function triggerNote(note, time, velocity = 100) {
  if (!isInitialized) {
    console.warn('[Guitar] Not initialized, cannot trigger note');
    return;
  }

  // Validate MIDI note range
  if (note < 0 || note > 127) {
    console.warn(`[Guitar] Invalid MIDI note: ${note}`);
    return;
  }

  // Get the active synth based on current mode
  const activeSynth = currentGuitarMode === GUITAR_MODE_ELECTRIC ? electricSynth : nylonSynth;
  
  if (!activeSynth) {
    console.warn(`[Guitar] Synth not available for mode: ${currentGuitarMode}`);
    return;
  }

  // Convert MIDI note to note name for PluckSynth
  const noteName = Tone.Frequency(note, 'midi').toNote();

  // Enhanced velocity mapping: use exponential curve for more natural response
  // Guitar dynamics: soft picking vs hard attack
  const normalizedVelocity = Math.max(0, Math.min(127, velocity)) / 127;
  const velocityGain = Math.pow(normalizedVelocity, 0.6); // 0.6 curve for expressive dynamics
  
  // Set volume based on velocity
  const currentVolume = Tone.gainToDb(masterVolume * velocityGain);
  activeSynth.volume.value = currentVolume;
  
  // Adjust attack noise based on velocity (harder = more pick attack)
  if (currentGuitarMode === GUITAR_MODE_ELECTRIC) {
    activeSynth.attackNoise = 1 + normalizedVelocity * 2; // 1-3 range
  } else {
    activeSynth.attackNoise = 0.5 + normalizedVelocity * 1; // 0.5-1.5 range
  }

  // PluckSynth uses triggerAttack with note name
  // It's inherently a one-shot (plucked string decays naturally)
  if (time !== undefined && time !== null) {
    activeSynth.triggerAttack(noteName, time);
  } else {
    activeSynth.triggerAttack(noteName, Tone.now());
  }
}

/**
 * Set the guitar mode (Electric or Nylon)
 * Stops all active notes before switching to prevent stuck notes
 * 
 * @param {string} mode - GUITAR_MODE_ELECTRIC or GUITAR_MODE_NYLON
 */
export function setGuitarMode(mode) {
  if (mode !== GUITAR_MODE_ELECTRIC && mode !== GUITAR_MODE_NYLON) {
    console.warn(`[Guitar] Invalid guitar mode: ${mode}`);
    return;
  }

  // Stop all active notes before switching
  stopAllNotes();

  currentGuitarMode = mode;
  console.log(`[Guitar] Guitar mode switched to: ${mode}`);
}

/**
 * Get the current guitar mode
 * 
 * @returns {string} Current mode (GUITAR_MODE_ELECTRIC or GUITAR_MODE_NYLON)
 */
export function getGuitarMode() {
  return currentGuitarMode;
}

/**
 * Stop all active notes on both synths
 * PluckSynth doesn't need explicit release (decays naturally)
 * But we can dispose and recreate if needed
 */
export function stopAllNotes() {
  // PluckSynth sounds decay naturally, no explicit stop needed
  // This is a no-op for plucked string synths
}

/**
 * Set master volume for guitar (both synths)
 * 
 * @param {number} volume - Volume (0-1)
 */
export function setVolume(volume) {
  masterVolume = Math.max(0, Math.min(1, volume));
  if (electricSynth) {
    electricSynth.volume.value = Tone.gainToDb(masterVolume);
  }
  if (nylonSynth) {
    nylonSynth.volume.value = Tone.gainToDb(masterVolume);
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
 * Set distortion amount (Electric guitar only)
 * 
 * @param {number} amount - Distortion amount (0-1)
 */
export function setDistortion(amount) {
  if (electricDistortion) {
    electricDistortion.distortion = Math.max(0, Math.min(1, amount));
  }
}

/**
 * Set reverb amount (applies to current mode's reverb)
 * 
 * @param {number} amount - Reverb wet amount (0-1)
 */
export function setReverb(amount) {
  if (currentGuitarMode === GUITAR_MODE_ELECTRIC && electricReverb) {
    electricReverb.wet.value = Math.max(0, Math.min(1, amount));
  } else if (currentGuitarMode === GUITAR_MODE_NYLON && nylonReverb) {
    nylonReverb.wet.value = Math.max(0, Math.min(1, amount));
  }
}

/**
 * Cleanup and dispose of both synthesizers and effects
 */
export function dispose() {
  // Dispose electric guitar chain
  if (electricSynth) {
    electricSynth.dispose();
    electricSynth = null;
  }
  if (electricCompressor) {
    electricCompressor.dispose();
    electricCompressor = null;
  }
  if (electricChorus) {
    electricChorus.dispose();
    electricChorus = null;
  }
  if (electricDistortion) {
    electricDistortion.dispose();
    electricDistortion = null;
  }
  if (electricReverb) {
    electricReverb.dispose();
    electricReverb = null;
  }
  
  // Dispose nylon guitar chain
  if (nylonSynth) {
    nylonSynth.dispose();
    nylonSynth = null;
  }
  if (nylonEQ) {
    nylonEQ.dispose();
    nylonEQ = null;
  }
  if (nylonReverb) {
    nylonReverb.dispose();
    nylonReverb = null;
  }
  
  isInitialized = false;
}

/**
 * Check if guitar is initialized
 * 
 * @returns {boolean}
 */
export function isReady() {
  return isInitialized && (electricSynth !== null || nylonSynth !== null);
}

