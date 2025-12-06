import * as Tone from 'tone';

/**
 * Drum Kit Instrument with dual sound engines:
 * 1. Tone.Sampler - Uses local samples from /samples/drums/ for sampled/acoustic drum sounds
 * 2. Synth-based - Uses Tone.MembraneSynth, NoiseSynth, etc. for electronic drum sounds
 * 
 * Maps drum pad IDs (kick, snare, etc.) to note names (C1, D1, etc.) for Tone.Sampler.
 * Tone.js v15 Sampler requires note names or MIDI numbers as keys.
 * Each note gets its own file, so triggering the exact note plays the file at original pitch (no pitch-shifting).
 * Uses Tone.Transport for synchronized timing.
 */

// Drum kit mode constants
export const DRUM_KIT_MODE_SAMPLED = 'sampled';
export const DRUM_KIT_MODE_ELECTRONIC = 'electronic';

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
let masterVolume = 0.8;
let isInitialized = false;
let currentDrumKitMode = DRUM_KIT_MODE_SAMPLED; // 'sampled' | 'electronic'

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
 * Initialize the drum instrument (both sampled and electronic engines)
 * Preloads all samples for zero-latency playback
 * 
 * @returns {Promise<void>}
 */
export async function initDrums() {
  if (isInitialized) {
    return;
  }

  try {
    // Create sampled drum kit with local samples
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
        console.warn('[Drums] Sample loading error (non-fatal):', error);
        // Continue even if some samples fail to load
      },
    }).toDestination();

    // Create electronic drum kit (synth-based)
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
    console.log('[Drums] Loaded from local samples');
    console.log('[Drums] Initialized with sampled and electronic kits');
  } catch (error) {
    console.error('[Drums] Failed to initialize:', error);
    throw error;
  }
}

/**
 * Set the drum kit mode (sampled or electronic)
 * 
 * @param {string} mode - 'sampled' | 'electronic'
 */
export function setDrumKitMode(mode) {
  if (mode !== DRUM_KIT_MODE_SAMPLED && mode !== DRUM_KIT_MODE_ELECTRONIC) {
    console.warn(`[Drums] Invalid kit mode: ${mode}. Use '${DRUM_KIT_MODE_SAMPLED}' or '${DRUM_KIT_MODE_ELECTRONIC}'`);
    return;
  }
  console.log('[Drums] Switching kit mode to:', mode);
  currentDrumKitMode = mode;
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
 * @param {string} name - Drum pad ID (e.g., 'kick', 'snare', 'hihat', etc.)
 * @param {number} time - Time in Tone.Transport time (seconds) or AudioContext time
 * @param {number} [velocity=100] - MIDI velocity (0-127), defaults to 100
 */
export function triggerNote(name, time, velocity = 100) {
  if (!isInitialized) {
    console.warn('[Drums] Not initialized, cannot trigger note');
    return;
  }

  // Check if AudioContext is running (required for Tone.js)
  if (Tone.getContext().state !== 'running') {
    console.warn('[Drums] AudioContext not running, cannot trigger note');
    return;
  }

  // Convert velocity to gain (0-127 -> 0-1)
  const velocityGain = velocity / 127;

  // Route to appropriate engine based on kit mode
  if (currentDrumKitMode === DRUM_KIT_MODE_SAMPLED) {
    // Sampled kit: use Tone.Sampler with local samples
    if (!sampledDrumKit) {
      console.warn('[Drums] Sampled kit not ready, cannot trigger note');
      return;
    }

    // Map drum pad ID to note name (C1, D1, etc.) for Tone.Sampler
    const note = DRUM_NOTE_MAP[name];
    if (!note) {
      console.warn(`[Drums] Unknown drum pad ID: ${name}`);
      return;
    }

    console.log(`[Drums] Sampled kit: ${name} → ${note}`);

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

    const voice = electronicDrumKit[name];
    if (!voice) {
      console.warn(`[Drums] Electronic kit: unknown voice: ${name}`);
      return;
    }

    console.log(`[Drums] Electronic kit: ${name}`);

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

    const frequency = frequencies[name] || 'C2';
    const triggerTime = time !== undefined && time !== null ? time : Tone.now();

    // Trigger the synth voice
    voice.triggerAttackRelease(frequency, '8n', triggerTime, velocityGain);
  }
}

/**
 * Set master volume for drums
 * Updates volume on both sampled and electronic kits
 * 
 * @param {number} volume - Volume (0-1)
 */
export function setVolume(volume) {
  masterVolume = Math.max(0, Math.min(1, volume));
  const volumeDb = Tone.gainToDb(masterVolume);
  
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
 * Cleanup and dispose of both drum kits
 */
export function dispose() {
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
  return isInitialized && (sampledDrumKit !== null || electronicDrumKit !== null);
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

