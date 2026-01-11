import * as Tone from 'tone';

/**
 * Guitar Instrument with John Mayer-Level Sound Design
 * 
 * Features:
 * - Karplus-Strong plucked string synthesis with pitch bending
 * - Real-time vibrato, bends, slides, hammer-ons
 * - Electric and Nylon guitar modes
 * - Professional amp simulation chain
 * 
 * Pitch bending uses detune for real-time pitch manipulation
 */

// Guitar mode constants
export const GUITAR_MODE_ELECTRIC = 'electric';
export const GUITAR_MODE_NYLON = 'nylon';

// Active voices for polyphonic pitch bending
let activeVoices = new Map(); // note -> { synth, oscillator, filter, envelope, gainNode }
let effectsChain = null;
let masterGain = null;

// Effects
let chorus = null;
let distortion = null;
let reverb = null;
let compressor = null;
let eq = null;
let delay = null;

let currentGuitarMode = GUITAR_MODE_ELECTRIC;
let masterVolume = 0.7;
let isInitialized = false;

// Voice pool for polyphony
const MAX_VOICES = 6; // Guitar has 6 strings
let voicePool = [];

/**
 * Create a single guitar voice using subtractive synthesis
 * More controllable than PluckSynth for bends/vibrato
 */
function createGuitarVoice() {
  const context = Tone.getContext();
  
  // Oscillator with sawtooth for rich harmonics (guitar-like)
  const osc = new Tone.Oscillator({
    type: 'sawtooth',
    frequency: 440,
  });
  
  // Secondary oscillator for thickness
  const osc2 = new Tone.Oscillator({
    type: 'triangle',
    frequency: 440,
  });
  
  // Low-pass filter simulates string dampening
  const filter = new Tone.Filter({
    type: 'lowpass',
    frequency: 3000,
    Q: 2,
    rolloff: -24,
  });
  
  // Envelope for pluck dynamics
  const envelope = new Tone.AmplitudeEnvelope({
    attack: 0.002,
    decay: 0.3,
    sustain: 0.4,
    release: 0.8,
    attackCurve: 'exponential',
    releaseCurve: 'exponential',
  });
  
  // Gain for mixing
  const gain = new Tone.Gain(0);
  
  // Connect: osc -> filter -> envelope -> gain
  osc.connect(filter);
  osc2.connect(filter);
  filter.connect(envelope);
  envelope.connect(gain);
  
  return {
    osc,
    osc2,
    filter,
    envelope,
    gain,
    isPlaying: false,
    currentNote: null,
    currentFreq: 440,
    targetFreq: 440,
    bendAmount: 0,
    vibratoLFO: null,
  };
}

/**
 * Initialize guitar synthesizer with professional signal chain
 */
export async function initGuitar() {
  if (isInitialized) {
    return;
  }

  try {
    // Create master gain
    masterGain = new Tone.Gain(masterVolume);
    
    // Compressor for consistent dynamics
    compressor = new Tone.Compressor({
      threshold: -18,
      ratio: 4,
      attack: 0.003,
      release: 0.25,
    });
    
    // EQ for tone shaping
    eq = new Tone.EQ3({
      low: 0,
      mid: 2,
      high: 1,
      lowFrequency: 200,
      highFrequency: 3000,
    });
    
    // Chorus for width (JC-120 style clean)
    chorus = new Tone.Chorus({
      frequency: 1.5,
      delayTime: 3.5,
      depth: 0.4,
      wet: 0.2,
      spread: 180,
    }).start();
    
    // Overdrive for tube warmth
    distortion = new Tone.Distortion({
      distortion: 0.15,
      wet: 0.3,
    });
    
    // Delay for ambience
    delay = new Tone.FeedbackDelay({
      delayTime: '8n',
      feedback: 0.2,
      wet: 0.15,
    });
    
    // Reverb for space
    reverb = new Tone.Reverb({
      decay: 2,
      wet: 0.2,
    });
    
    // Create voice pool
    voicePool = [];
    for (let i = 0; i < MAX_VOICES; i++) {
      const voice = createGuitarVoice();
      // Connect voice to effects chain
      voice.gain.connect(compressor);
      voicePool.push(voice);
    }
    
    // Signal chain: compressor -> eq -> chorus -> distortion -> delay -> reverb -> master -> out
    compressor.connect(eq);
    eq.connect(chorus);
    chorus.connect(distortion);
    distortion.connect(delay);
    delay.connect(reverb);
    reverb.connect(masterGain);
    masterGain.toDestination();
    
    // Generate reverb impulse
    await reverb.generate();
    
    isInitialized = true;
    console.log('[Guitar] Initialized with advanced synthesis for bends/vibrato/slides');
  } catch (error) {
    console.error('[Guitar] Failed to initialize:', error);
    throw error;
  }
}

/**
 * Get an available voice from the pool
 */
function getAvailableVoice() {
  // First try to find a non-playing voice
  for (const voice of voicePool) {
    if (!voice.isPlaying) {
      return voice;
    }
  }
  // If all voices are playing, steal the oldest one
  return voicePool[0];
}

/**
 * Convert MIDI note to frequency
 */
function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Trigger a guitar note with velocity
 * 
 * @param {number} note - MIDI note number
 * @param {number} time - Optional time
 * @param {number} velocity - MIDI velocity (0-127)
 * @returns {object} Voice object for manipulation (bends, vibrato)
 */
export async function triggerNote(note, time, velocity = 100) {
  if (!isInitialized) {
    console.warn('[Guitar] Not initialized');
    return null;
  }

  // Ensure AudioContext is running
  const context = Tone.getContext();
  if (context.state !== 'running') {
    try {
      await Tone.start();
    } catch (e) {
      console.warn('[Guitar] Failed to resume AudioContext:', e);
      return null;
    }
  }

  const voice = getAvailableVoice();
  if (!voice) return null;
  
  // Stop if already playing
  if (voice.isPlaying) {
    voice.osc.stop();
    voice.osc2.stop();
    voice.envelope.triggerRelease();
  }
  
  const freq = midiToFreq(note);
  const normalizedVelocity = Math.min(127, Math.max(0, velocity)) / 127;
  const velocityGain = Math.pow(normalizedVelocity, 0.6);
  
  // Set frequency
  voice.osc.frequency.value = freq;
  voice.osc2.frequency.value = freq * 1.002; // Slight detune for thickness
  voice.currentFreq = freq;
  voice.targetFreq = freq;
  voice.currentNote = note;
  voice.bendAmount = 0;
  
  // Adjust filter based on velocity (harder pick = brighter)
  const filterFreq = currentGuitarMode === GUITAR_MODE_ELECTRIC 
    ? 2000 + (normalizedVelocity * 4000)
    : 1500 + (normalizedVelocity * 2000);
  voice.filter.frequency.value = filterFreq;
  
  // Adjust envelope for mode
  if (currentGuitarMode === GUITAR_MODE_NYLON) {
    voice.envelope.attack = 0.005;
    voice.envelope.decay = 0.4;
    voice.envelope.sustain = 0.3;
    voice.envelope.release = 1.2;
  } else {
    voice.envelope.attack = 0.002;
    voice.envelope.decay = 0.25;
    voice.envelope.sustain = 0.5;
    voice.envelope.release = 0.8;
  }
  
  // Set gain based on velocity
  voice.gain.gain.value = velocityGain * 0.3;
  
  // Start oscillators and trigger envelope
  const triggerTime = time || Tone.now();
  voice.osc.start(triggerTime);
  voice.osc2.start(triggerTime);
  voice.envelope.triggerAttack(triggerTime);
  voice.isPlaying = true;
  
  // Store active voice
  activeVoices.set(note, voice);
  
  // Filter decay for natural string dampening
  voice.filter.frequency.rampTo(filterFreq * 0.3, voice.envelope.decay + voice.envelope.release);
  
  return voice;
}

/**
 * Release a guitar note
 */
export function releaseNote(note, time) {
  const voice = activeVoices.get(note);
  if (voice && voice.isPlaying) {
    const releaseTime = time || Tone.now();
    voice.envelope.triggerRelease(releaseTime);
    
    // Schedule voice cleanup
    setTimeout(() => {
      if (voice.isPlaying) {
        voice.osc.stop();
        voice.osc2.stop();
        voice.isPlaying = false;
      }
      activeVoices.delete(note);
    }, (voice.envelope.release + 0.1) * 1000);
  }
}

/**
 * Apply pitch bend to a note (for bends and vibrato)
 * 
 * @param {number} note - MIDI note being bent
 * @param {number} semitones - Bend amount in semitones (-12 to +12)
 */
export function bendNote(note, semitones) {
  const voice = activeVoices.get(note);
  if (voice && voice.isPlaying) {
    const bentFreq = voice.currentFreq * Math.pow(2, semitones / 12);
    voice.osc.frequency.rampTo(bentFreq, 0.05);
    voice.osc2.frequency.rampTo(bentFreq * 1.002, 0.05);
    voice.bendAmount = semitones;
  }
}

/**
 * Apply vibrato to a note
 * 
 * @param {number} note - MIDI note
 * @param {number} depth - Vibrato depth in semitones (0-1)
 * @param {number} rate - Vibrato rate in Hz (4-8 typical)
 */
export function applyVibrato(note, depth = 0.3, rate = 5) {
  const voice = activeVoices.get(note);
  if (voice && voice.isPlaying) {
    // Create LFO for vibrato if not exists
    if (!voice.vibratoLFO) {
      voice.vibratoLFO = new Tone.LFO({
        frequency: rate,
        min: -depth,
        max: depth,
      });
      voice.vibratoLFO.connect(voice.osc.detune);
      voice.vibratoLFO.connect(voice.osc2.detune);
    }
    
    voice.vibratoLFO.frequency.value = rate;
    voice.vibratoLFO.min = -depth * 100; // Convert to cents
    voice.vibratoLFO.max = depth * 100;
    voice.vibratoLFO.start();
  }
}

/**
 * Stop vibrato on a note
 */
export function stopVibrato(note) {
  const voice = activeVoices.get(note);
  if (voice && voice.vibratoLFO) {
    voice.vibratoLFO.stop();
    voice.vibratoLFO.dispose();
    voice.vibratoLFO = null;
  }
}

/**
 * Slide from one note to another
 * 
 * @param {number} fromNote - Starting MIDI note
 * @param {number} toNote - Target MIDI note
 * @param {number} duration - Slide duration in seconds
 */
export function slideToNote(fromNote, toNote, duration = 0.1) {
  const voice = activeVoices.get(fromNote);
  if (voice && voice.isPlaying) {
    const targetFreq = midiToFreq(toNote);
    voice.osc.frequency.rampTo(targetFreq, duration);
    voice.osc2.frequency.rampTo(targetFreq * 1.002, duration);
    voice.currentFreq = targetFreq;
    voice.currentNote = toNote;
    
    // Update the active voices map
    activeVoices.delete(fromNote);
    activeVoices.set(toNote, voice);
  }
}

/**
 * Hammer-on: Play a note with reduced attack (no pick)
 */
export async function hammerOn(note, velocity = 80) {
  const voice = await triggerNote(note, undefined, velocity);
  if (voice) {
    // Softer attack for hammer-on
    voice.envelope.attack = 0.01;
    voice.filter.frequency.value *= 0.7; // Slightly darker
  }
  return voice;
}

/**
 * Pull-off: Similar to hammer-on but triggered differently
 */
export async function pullOff(note, velocity = 70) {
  return hammerOn(note, velocity);
}

/**
 * Set guitar mode
 */
export function setGuitarMode(mode) {
  if (mode !== GUITAR_MODE_ELECTRIC && mode !== GUITAR_MODE_NYLON) {
    return;
  }
  
  stopAllNotes();
  currentGuitarMode = mode;
  
  // Adjust effects for mode
  if (mode === GUITAR_MODE_NYLON) {
    if (distortion) distortion.wet.value = 0;
    if (chorus) chorus.wet.value = 0.1;
    if (reverb) reverb.wet.value = 0.35;
    if (eq) {
      eq.low.value = 3;
      eq.mid.value = 0;
      eq.high.value = -2;
    }
  } else {
    if (distortion) distortion.wet.value = 0.3;
    if (chorus) chorus.wet.value = 0.2;
    if (reverb) reverb.wet.value = 0.2;
    if (eq) {
      eq.low.value = 0;
      eq.mid.value = 2;
      eq.high.value = 1;
    }
  }
  
  console.log(`[Guitar] Mode switched to: ${mode}`);
}

export function getGuitarMode() {
  return currentGuitarMode;
}

export function stopAllNotes() {
  activeVoices.forEach((voice, note) => {
    releaseNote(note);
  });
  activeVoices.clear();
}

export function setVolume(volume) {
  masterVolume = Math.max(0, Math.min(1, volume));
  if (masterGain) {
    masterGain.gain.value = masterVolume;
  }
}

export function getVolume() {
  return masterVolume;
}

export function setDistortion(amount) {
  if (distortion) {
    distortion.distortion = Math.max(0, Math.min(1, amount));
  }
}

export function setReverb(amount) {
  if (reverb) {
    reverb.wet.value = Math.max(0, Math.min(1, amount));
  }
}

export function dispose() {
  stopAllNotes();
  
  voicePool.forEach(voice => {
    voice.osc?.dispose();
    voice.osc2?.dispose();
    voice.filter?.dispose();
    voice.envelope?.dispose();
    voice.gain?.dispose();
    voice.vibratoLFO?.dispose();
  });
  voicePool = [];
  
  compressor?.dispose();
  eq?.dispose();
  chorus?.dispose();
  distortion?.dispose();
  delay?.dispose();
  reverb?.dispose();
  masterGain?.dispose();
  
  isInitialized = false;
}

export function isReady() {
  return isInitialized;
}

// Export for advanced control
export function getActiveVoice(note) {
  return activeVoices.get(note);
}
