import * as Tone from "tone";

/**
 * Bass Instrument with dual sound engines:
 * 1. Tone.MonoSynth - Creates a fat, analog-style bass sound
 * 2. Tone.Sampler - Uses WAV samples from /samples/bass/ for sampled bass sounds
 */

// Bass mode constants
export const BASS_MODE_SYNTH = "synth";
export const BASS_MODE_SAMPLED = "sampled";

let currentBassMode = BASS_MODE_SYNTH;
let synth = null;
let sampledBass = null;
let isInitialized = false;
let volume = 0.8;

// Optional transpose – start with 0
let SAMPLED_BASS_TRANSPOSE = 0;

/**
 * Normalize velocity to 0-1 range with enhanced mapping
 * Uses exponential curve for more natural bass response
 */
function normalizeVelocity(velocity) {
  if (velocity == null) return 0.8;
  
  // Convert to 0-1 range
  let normalized;
  if (velocity > 1) {
    normalized = Math.min(1, velocity / 127);
  } else {
    normalized = Math.max(0, Math.min(1, velocity));
  }
  
  // Apply exponential curve for more natural bass response (velocity^0.65)
  // Bass benefits from a softer curve to make velocity changes more noticeable
  return Math.pow(normalized, 0.65);
}

/**
 * Transpose a note by semitones
 */
function transposeNote(note, semitones) {
  if (!semitones || semitones === 0) return note;
  const freq = Tone.Frequency(note);
  const transposed = freq.transpose(semitones);
  return transposed.toNote();
}

/**
 * Initialize the bass instrument (both synth and sampled engines)
 * Professional bass sound with sub-oscillator and filtering
 */
export async function initBass() {
  if (isInitialized) {
    return;
  }

  try {
    // Create professional synth bass with sub-oscillator feel
    // Inspired by classic P-Bass and synth bass tones
    synth = new Tone.MonoSynth({
      oscillator: {
        type: "fatsawtooth",  // Fat sawtooth for rich harmonics
        count: 3,             // 3 slightly detuned oscillators
        spread: 20,           // Subtle detune spread
      },
      envelope: {
        attack: 0.005,        // Fast attack for punchy bass
        decay: 0.2,
        sustain: 0.5,
        release: 0.3,
      },
      filter: {
        type: "lowpass",
        frequency: 600,       // Lower cutoff for deep bass
        Q: 3,                 // Resonance for character
        rolloff: -24,         // Steeper rolloff
      },
      filterEnvelope: {
        attack: 0.01,
        decay: 0.15,
        sustain: 0.2,
        release: 0.3,
        baseFrequency: 150,   // Deep bass foundation
        octaves: 2.5,         // Filter sweep range
      },
      volume: Tone.gainToDb(volume),
    }).toDestination();

    // Create Sampler-based sampled bass using local WAVs
    sampledBass = new Tone.Sampler({
      urls: {
        E2: "bass_e2.wav",
        A2: "bass_a2.wav",
        D3: "bass_d.wav",
      },
      baseUrl: "/samples/bass/",
      attack: 0.005,
      release: 0.4,
      curve: "linear",
      volume: Tone.gainToDb(volume),
      onload: () => {
        console.log("[Bass] Sampled bass ready");
        isInitialized = true;
      },
      onerror: (error) => {
        console.warn("[Bass] Sample loading error (non-fatal):", error);
        isInitialized = true;
      },
    }).toDestination();

    isInitialized = true;
    console.log("[Bass] Initialized with professional MonoSynth and Sampler");
  } catch (error) {
    console.error("[Bass] Failed to initialize:", error);
    throw error;
  }
}

/**
 * Set the bass mode (synth or sampled)
 * Stops all active notes before switching to prevent stuck notes
 */
export function setBassMode(mode) {
  if (mode !== BASS_MODE_SYNTH && mode !== BASS_MODE_SAMPLED) {
    console.warn("[Bass] Invalid bass mode:", mode);
    return;
  }
  
  // Stop all active notes before switching
  stopAllNotes();
  
  currentBassMode = mode;
  console.log(`[Bass] Bass mode switched to: ${mode}`);
}

/**
 * Stop all active notes on both synth and sampled bass
 * Prevents stuck notes when switching modes
 */
export function stopAllNotes() {
  if (synth) {
    synth.triggerRelease();
  }
  if (sampledBass) {
    sampledBass.releaseAll();
  }
}

/**
 * Get the current bass mode
 */
export function getBassMode() {
  return currentBassMode;
}

/**
 * Set the global transpose for sampled bass in semitones
 */
export function setSampledBassTranspose(semitones) {
  if (typeof semitones !== "number" || !Number.isFinite(semitones)) {
    console.warn("[Bass] Invalid transpose value:", semitones);
    return;
  }
  SAMPLED_BASS_TRANSPOSE = semitones;
}

/**
 * Play a bass note with sustain - note will hold until released
 * Perfect for expressive bass playing like Jacob Collier
 */
export async function playBass(note, time, velocity) {
  if (!isInitialized) {
    return;
  }
  
  // Ensure AudioContext is running (critical for iOS/Android)
  const context = Tone.getContext();
  if (context.state !== "running") {
    try {
      await Tone.start();
      console.log("[Bass] AudioContext resumed via Tone.start()");
    } catch (e) {
      console.warn("[Bass] Failed to resume AudioContext:", e);
      return;
    }
  }

  const v = normalizeVelocity(velocity);

  // Convert MIDI number to note name for consistency
  let targetNote = note;
  if (typeof note === "number") {
    targetNote = Tone.Frequency(note, "midi").toNote();
  }

  if (currentBassMode === BASS_MODE_SAMPLED && sampledBass) {
    const finalNote = transposeNote(targetNote, SAMPLED_BASS_TRANSPOSE);
    if (time !== undefined && time !== null) {
      sampledBass.triggerAttack(finalNote, time, v);
    } else {
      sampledBass.triggerAttack(finalNote, Tone.now(), v);
    }
  } else if (currentBassMode === BASS_MODE_SYNTH && synth) {
    if (time !== undefined && time !== null) {
      synth.triggerAttack(targetNote, time, v);
    } else {
      synth.triggerAttack(targetNote, Tone.now(), v);
    }
  }
}

/**
 * Release a bass note - natural sustain release
 */
export function releaseBass(note, time) {
  if (!isInitialized) return;

  let targetNote = note;
  if (typeof note === "number") {
    targetNote = Tone.Frequency(note, "midi").toNote();
  }

  if (currentBassMode === BASS_MODE_SAMPLED && sampledBass) {
    const finalNote = transposeNote(targetNote, SAMPLED_BASS_TRANSPOSE);
    if (time !== undefined && time !== null) {
      sampledBass.triggerRelease(finalNote, time);
    } else {
      sampledBass.triggerRelease(finalNote, Tone.now());
    }
  } else if (currentBassMode === BASS_MODE_SYNTH && synth) {
    if (time !== undefined && time !== null) {
      synth.triggerRelease(time);
    } else {
      synth.triggerRelease(Tone.now());
    }
  }
}

/**
 * Backwards-compatible API - trigger attack
 */
export function triggerNote(note, time, velocity) {
  playBass(note, time, velocity);
}

/**
 * Release note - backwards compatible
 */
export function releaseNote(note, time) {
  releaseBass(note, time);
}

/**
 * Set master volume for bass
 */
export function setVolume(newVolume) {
  volume = Math.max(0, Math.min(1, newVolume));
  if (synth) {
    synth.volume.value = Tone.gainToDb(volume);
  }
  if (sampledBass) {
    sampledBass.volume.value = Tone.gainToDb(volume);
  }
}

/**
 * Get current volume
 */
export function getVolume() {
  return volume;
}

/**
 * Check if bass is initialized and ready
 */
export function isReady() {
  return isInitialized && (synth !== null || sampledBass !== null);
}

/**
 * Cleanup and dispose of the bass instruments
 */
export function dispose() {
  if (synth) {
    synth.dispose();
    synth = null;
  }
  if (sampledBass) {
    sampledBass.dispose();
    sampledBass = null;
  }
  isInitialized = false;
}
