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
 * Normalize velocity to 0-1 range
 */
function normalizeVelocity(velocity) {
  if (velocity == null) return 0.8;
  if (velocity > 1) return Math.min(1, velocity / 127);
  return Math.max(0, Math.min(1, velocity));
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
 */
export async function initBass() {
  if (isInitialized) {
    return;
  }

  try {
    // Create MonoSynth-based synth bass
    synth = new Tone.MonoSynth({
      oscillator: {
        type: "sawtooth",
      },
      envelope: {
        attack: 0.01,
        decay: 0.3,
        sustain: 0.4,
        release: 0.5,
      },
      filter: {
        type: "lowpass",
        frequency: 800,
        Q: 2,
      },
      filterEnvelope: {
        attack: 0.1,
        decay: 0.2,
        sustain: 0.3,
        release: 0.4,
        baseFrequency: 200,
        octaves: 3,
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
      attack: 0.01,
      release: 0.6,
      curve: "linear",
      volume: Tone.gainToDb(volume),
      onload: () => {
        console.log("[Bass] Sampled bass ready");
        isInitialized = true;
      },
      onerror: (error) => {
        console.warn("[Bass] Sample loading error (non-fatal):", error);
        // Still mark as ready even if samples fail to load
        isInitialized = true;
      },
    }).toDestination();

    isInitialized = true;
    console.log("[Bass] Initialized with Tone.MonoSynth and Tone.Sampler");
  } catch (error) {
    console.error("[Bass] Failed to initialize:", error);
    throw error;
  }
}

/**
 * Set the bass mode (synth or sampled)
 */
export function setBassMode(mode) {
  if (mode !== BASS_MODE_SYNTH && mode !== BASS_MODE_SAMPLED) {
    console.warn("[Bass] Invalid bass mode:", mode);
    return;
  }
  currentBassMode = mode;
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
 * Play a bass note by note name or MIDI note number
 */
export function playBass(note, time, velocity) {
  if (!isInitialized || Tone.getContext().state !== "running") {
    return;
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
      sampledBass.triggerAttackRelease(finalNote, "8n", time, v);
    } else {
      sampledBass.triggerAttackRelease(finalNote, "8n", Tone.now(), v);
    }
  } else if (currentBassMode === BASS_MODE_SYNTH && synth) {
    if (time !== undefined && time !== null) {
      synth.triggerAttackRelease(targetNote, "8n", time, v);
    } else {
      synth.triggerAttackRelease(targetNote, "8n", Tone.now(), v);
    }
  }
}

/**
 * Backwards-compatible API
 */
export function triggerNote(note, time, velocity) {
  playBass(note, time, velocity);
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
