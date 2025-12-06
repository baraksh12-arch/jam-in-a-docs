import * as Tone from 'tone';

/**
 * Guitar Instrument using Tone.Synth with Distortion and Reverb
 * 
 * Creates a plucked string sound with effects for realistic guitar tone.
 * Uses Karplus-Strong inspired synthesis with distortion and reverb.
 */

let synth = null;
let distortion = null;
let reverb = null;
let masterVolume = 0.7;
let isInitialized = false;

/**
 * Initialize the guitar synthesizer with effects
 * 
 * @returns {Promise<void>}
 */
export async function initGuitar() {
  if (isInitialized) {
    return;
  }

  try {
    // Create synth with plucked string characteristics
    synth = new Tone.Synth({
      oscillator: {
        type: 'sawtooth',
      },
      envelope: {
        attack: 0.005,  // Very fast attack for pluck
        decay: 0.3,
        sustain: 0.15,
        release: 0.5,
      },
      volume: Tone.gainToDb(masterVolume),
    });

    // Create distortion effect
    distortion = new Tone.Distortion({
      distortion: 0.4,  // Moderate distortion
      wet: 0.3,         // 30% wet signal
    });

    // Create reverb effect
    reverb = new Tone.Reverb({
      roomSize: 0.5,
      wet: 0.2,         // 20% wet signal
    });

    // Connect: synth -> distortion -> reverb -> destination
    synth.connect(distortion);
    distortion.connect(reverb);
    reverb.toDestination();

    // Generate reverb impulse response (required for reverb to work)
    await reverb.generate();

    // Store effects references for cleanup
    synth._distortion = distortion;
    synth._reverb = reverb;

    isInitialized = true;
    console.log('[Guitar] Initialized with Tone.Synth + Distortion + Reverb');
  } catch (error) {
    console.error('[Guitar] Failed to initialize:', error);
    throw error;
  }
}

/**
 * Trigger a guitar note
 * 
 * @param {number} note - MIDI note number (0-127)
 * @param {number} time - Time in Tone.Transport time (seconds) or AudioContext time
 * @param {number} [velocity=100] - MIDI velocity (0-127), defaults to 100
 */
export function triggerNote(note, time, velocity = 100) {
  if (!isInitialized || !synth) {
    console.warn('[Guitar] Not initialized, cannot trigger note');
    return;
  }

  // Validate MIDI note range
  if (note < 0 || note > 127) {
    console.warn(`[Guitar] Invalid MIDI note: ${note}`);
    return;
  }

  // Convert MIDI note to frequency
  const frequency = Tone.Frequency(note, 'midi').toFrequency();

  // Convert velocity to gain (0-127 -> 0-1)
  const velocityGain = velocity / 127;

  // Set volume based on velocity
  const currentVolume = Tone.gainToDb(masterVolume * velocityGain);
  synth.volume.value = currentVolume;

  // Trigger the note
  // If time is provided, schedule it; otherwise play immediately
  if (time !== undefined && time !== null) {
    synth.triggerAttackRelease(frequency, '8n', time);
  } else {
    synth.triggerAttackRelease(frequency, '8n', Tone.now());
  }
}

/**
 * Set master volume for guitar
 * 
 * @param {number} volume - Volume (0-1)
 */
export function setVolume(volume) {
  masterVolume = Math.max(0, Math.min(1, volume));
  if (synth) {
    // Preserve velocity scaling when setting volume
    synth.volume.value = Tone.gainToDb(masterVolume);
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
 * Set distortion amount
 * 
 * @param {number} amount - Distortion amount (0-1)
 */
export function setDistortion(amount) {
  if (distortion) {
    distortion.distortion = Math.max(0, Math.min(1, amount));
  }
}

/**
 * Set reverb amount
 * 
 * @param {number} amount - Reverb wet amount (0-1)
 */
export function setReverb(amount) {
  if (reverb) {
    reverb.wet.value = Math.max(0, Math.min(1, amount));
  }
}

/**
 * Cleanup and dispose of the synthesizer and effects
 */
export function dispose() {
  if (synth) {
    if (synth._distortion) {
      synth._distortion.dispose();
    }
    if (synth._reverb) {
      synth._reverb.dispose();
    }
    synth.dispose();
    synth = null;
    distortion = null;
    reverb = null;
    isInitialized = false;
  }
}

/**
 * Check if guitar is initialized
 * 
 * @returns {boolean}
 */
export function isReady() {
  return isInitialized && synth !== null;
}

