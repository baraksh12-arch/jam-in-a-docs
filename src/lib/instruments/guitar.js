import * as Tone from 'tone';

/**
 * Electric Guitar - Karplus-Strong Synthesis
 * 
 * Production-ready physically-modeled electric guitar:
 * - True Karplus-Strong string synthesis
 * - Fractional delay for accurate tuning
 * - Real-time pitch bends and vibrato
 * - Palm mute with dramatic effect
 * - Pickup and tone simulation
 */

// ============================================================================
// CONSTANTS
// ============================================================================

export const GUITAR_MODE_ELECTRIC = 'electric';
export const GUITAR_MODE_NYLON = 'nylon';

const MAX_VOICES = 6;
const BUFFER_SIZE = 512; // Larger buffer for stability

// ============================================================================
// MODULE STATE
// ============================================================================

let audioContext = null;
let masterGain = null;
let isInitialized = false;
let currentGuitarMode = GUITAR_MODE_ELECTRIC;
let masterVolume = 0.7;

// Voice management
let voices = [];
let activeVoiceMap = new Map(); // MIDI note -> voice index

// Global parameters that affect ALL notes (including currently playing ones)
let globalPalmMute = 0;
let globalTone = 0.7;
let globalPickup = 'bridge';
let globalPickPosition = 0.13;
let globalPickHardness = 0.7;

// ============================================================================
// KARPLUS-STRONG VOICE CLASS
// ============================================================================

class KSVoice {
  constructor(ctx, output) {
    this.ctx = ctx;
    this.sampleRate = ctx.sampleRate;
    this.output = output;
    
    // Voice state
    this.active = false;
    this.midiNote = null;
    this.baseFreq = 440;
    
    // Real-time modulation (these change during playback)
    this.bendSemitones = 0;
    this.vibratoDepth = 0; // cents
    this.vibratoRate = 5;
    this.vibratoPhase = 0;
    
    // KS delay line
    this.maxDelay = Math.ceil(this.sampleRate / 20); // lowest freq ~20Hz
    this.delayLine = new Float32Array(this.maxDelay);
    this.delayLength = 100;
    this.writePtr = 0;
    this.fracDelay = 0;
    
    // Filter states
    this.lpState = 0;
    this.dcBlock = 0;
    this.prevSample = 0;
    
    // Envelope
    this.amplitude = 0;
    this.targetAmp = 0;
    
    // Per-note palm mute (captured at pluck time + real-time global)
    this.notePalmMute = 0;
    
    // Damping
    this.baseDamping = 0.998;
    
    // Create audio nodes
    this.processor = ctx.createScriptProcessor(BUFFER_SIZE, 0, 1);
    this.processor.onaudioprocess = (e) => this.render(e);
    
    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = 1;
    
    // Filters for tone shaping
    this.lpFilter = ctx.createBiquadFilter();
    this.lpFilter.type = 'lowpass';
    this.lpFilter.frequency.value = 5000;
    this.lpFilter.Q.value = 1;
    
    this.hpFilter = ctx.createBiquadFilter();
    this.hpFilter.type = 'highpass';
    this.hpFilter.frequency.value = 60;
    this.hpFilter.Q.value = 0.7;
    
    // Connect: processor -> gain -> lp -> hp -> output
    this.processor.connect(this.gainNode);
    this.gainNode.connect(this.lpFilter);
    this.lpFilter.connect(this.hpFilter);
    this.hpFilter.connect(output);
  }
  
  /**
   * Pluck the string
   */
  pluck(midiNote, velocity, palmMute, pickPos, pickHardness) {
    this.midiNote = midiNote;
    this.baseFreq = 440 * Math.pow(2, (midiNote - 69) / 12);
    this.notePalmMute = palmMute;
    
    // Reset modulation
    this.bendSemitones = 0;
    this.vibratoDepth = 0;
    this.vibratoPhase = 0;
    
    // Calculate delay length
    const freq = this.baseFreq;
    const totalDelay = this.sampleRate / freq;
    this.delayLength = Math.floor(totalDelay);
    this.fracDelay = totalDelay - this.delayLength;
    
    // Clamp delay length
    if (this.delayLength < 2) this.delayLength = 2;
    if (this.delayLength > this.maxDelay - 2) this.delayLength = this.maxDelay - 2;
    
    // Calculate damping (palm mute = much more damping)
    const effectivePalmMute = Math.max(palmMute, globalPalmMute);
    this.baseDamping = 0.9985 - (freq * 0.000012);
    if (effectivePalmMute > 0.1) {
      this.baseDamping -= effectivePalmMute * 0.008; // Significant damping increase
    }
    this.baseDamping = Math.max(0.95, Math.min(0.9995, this.baseDamping));
    
    // Clear delay line and fill with shaped noise burst
    this.delayLine.fill(0);
    this.writePtr = 0;
    this.lpState = 0;
    this.dcBlock = 0;
    this.prevSample = 0;
    
    // Generate excitation (noise burst)
    const velNorm = Math.pow(velocity / 127, 0.7);
    const burstLen = Math.min(this.delayLength, Math.floor(80 * (this.sampleRate / 44100)));
    
    // Palm mute makes burst shorter and darker
    const actualBurstLen = effectivePalmMute > 0.1 
      ? Math.floor(burstLen * (1 - effectivePalmMute * 0.6))
      : burstLen;
    
    let prev = 0;
    const lpCoeff = 0.3 + pickHardness * 0.6; // Harder pick = brighter
    
    for (let i = 0; i < actualBurstLen; i++) {
      let noise = Math.random() * 2 - 1;
      
      // Low-pass for pick softness
      noise = prev + lpCoeff * (noise - prev);
      prev = noise;
      
      // Envelope
      const env = 1 - (i / actualBurstLen);
      
      // Palm mute darkens the excitation
      if (effectivePalmMute > 0.1) {
        noise *= (1 - effectivePalmMute * 0.4);
      }
      
      this.delayLine[i] = noise * env * velNorm * 0.8;
    }
    
    // Set amplitude
    this.targetAmp = effectivePalmMute > 0.1 ? 0.7 : 0.85;
    this.amplitude = this.targetAmp;
    this.active = true;
    
    // Update filter based on pickup/tone
    this.updateFilters();
  }
  
  /**
   * Update filters based on global settings
   */
  updateFilters() {
    // Pickup position affects brightness
    let cutoff = 5000;
    if (globalPickup === 'neck') cutoff = 2500;
    else if (globalPickup === 'middle') cutoff = 3500;
    
    // Tone knob
    cutoff *= (0.3 + globalTone * 0.7);
    
    // Palm mute dramatically reduces highs
    const effectiveMute = Math.max(this.notePalmMute, globalPalmMute);
    if (effectiveMute > 0.1) {
      cutoff *= (1 - effectiveMute * 0.6);
    }
    
    this.lpFilter.frequency.setValueAtTime(
      Math.max(500, Math.min(10000, cutoff)), 
      this.ctx.currentTime
    );
  }
  
  /**
   * Apply pitch bend (semitones)
   */
  bend(semitones) {
    this.bendSemitones = semitones;
  }
  
  /**
   * Apply vibrato
   */
  setVibrato(depthCents, rateHz) {
    this.vibratoDepth = depthCents;
    this.vibratoRate = rateHz;
  }
  
  /**
   * Release note (natural decay)
   */
  release() {
    this.targetAmp = 0;
  }
  
  /**
   * Stop immediately
   */
  stop() {
    this.active = false;
    this.amplitude = 0;
    this.targetAmp = 0;
    this.midiNote = null;
  }
  
  /**
   * Audio processing callback
   */
  render(e) {
    const out = e.outputBuffer.getChannelData(0);
    const len = out.length;
    
    if (!this.active) {
      for (let i = 0; i < len; i++) out[i] = 0;
      return;
    }
    
    // Get current palm mute (combine note-level and global) - REAL TIME!
    const effectivePalmMute = Math.max(this.notePalmMute, globalPalmMute);
    
    // Recalculate damping based on palm mute - DRAMATIC EFFECT
    let damping = this.baseDamping;
    if (effectivePalmMute > 0.05) {
      // Palm mute DRAMATICALLY increases damping (shorter sustain)
      damping = this.baseDamping - (effectivePalmMute * 0.015);
      damping = Math.max(0.92, damping); // Can go quite low for heavy muting
    }
    
    // Pre-calculate vibrato increment
    const vibratoInc = (this.vibratoRate * 2 * Math.PI) / this.sampleRate;
    
    for (let i = 0; i < len; i++) {
      // === CALCULATE CURRENT FREQUENCY ===
      let freq = this.baseFreq;
      
      // Apply bend - THIS CHANGES THE PITCH!
      if (Math.abs(this.bendSemitones) > 0.001) {
        freq *= Math.pow(2, this.bendSemitones / 12);
      }
      
      // Apply vibrato - OSCILLATES THE PITCH!
      if (this.vibratoDepth > 0.1) {
        this.vibratoPhase += vibratoInc;
        if (this.vibratoPhase > 6.283185) this.vibratoPhase -= 6.283185;
        const vibCents = Math.sin(this.vibratoPhase) * this.vibratoDepth;
        freq *= Math.pow(2, vibCents / 1200);
      }
      
      // Update delay length for new frequency - THIS IS HOW PITCH CHANGES
      const totalDelay = this.sampleRate / freq;
      const newDelayLen = Math.floor(totalDelay);
      
      if (newDelayLen !== this.delayLength && newDelayLen >= 2 && newDelayLen < this.maxDelay - 2) {
        this.delayLength = newDelayLen;
      }
      this.fracDelay = totalDelay - this.delayLength;
      
      // === KARPLUS-STRONG ALGORITHM ===
      
      // Read from delay line with linear interpolation
      let readPtr = this.writePtr - this.delayLength;
      if (readPtr < 0) readPtr += this.maxDelay;
      
      let readPtrPrev = readPtr - 1;
      if (readPtrPrev < 0) readPtrPrev += this.maxDelay;
      
      const s0 = this.delayLine[readPtr];
      const s1 = this.delayLine[readPtrPrev];
      
      // Linear interpolation for fractional delay
      let sample = s0 + this.fracDelay * (s1 - s0);
      
      // KS averaging filter (the core of Karplus-Strong)
      sample = 0.5 * (sample + this.prevSample);
      this.prevSample = this.delayLine[readPtr];
      
      // Brightness filter - PALM MUTE MAKES IT VERY DARK
      const brightness = effectivePalmMute > 0.05 
        ? Math.max(0.08, 0.35 - effectivePalmMute * 0.4) // Gets very dark with mute
        : 0.35;
      this.lpState = this.lpState + brightness * (sample - this.lpState);
      sample = this.lpState;
      
      // Apply damping (energy loss) - palm mute makes it decay FAST
      sample *= damping;
      
      // Additional palm mute amplitude reduction
      if (effectivePalmMute > 0.05) {
        sample *= (1 - effectivePalmMute * 0.4);
      }
      
      // DC blocking
      const dcOut = sample - this.dcBlock + 0.995 * this.dcBlock;
      this.dcBlock = sample;
      sample = dcOut;
      
      // Write back to delay line
      this.delayLine[this.writePtr] = sample;
      this.writePtr = (this.writePtr + 1) % this.maxDelay;
      
      // Amplitude envelope
      this.amplitude += (this.targetAmp - this.amplitude) * 0.001;
      
      // Output
      out[i] = sample * this.amplitude;
      
      // Check if died out
      if (this.targetAmp < 0.001 && Math.abs(sample) < 0.00005) {
        this.active = false;
        this.midiNote = null;
        for (let j = i + 1; j < len; j++) out[j] = 0;
        break;
      }
    }
    
    // Update filters each buffer (for real-time parameter changes)
    this.updateFilters();
  }
  
  dispose() {
    this.stop();
    this.processor.disconnect();
    this.gainNode.disconnect();
    this.lpFilter.disconnect();
    this.hpFilter.disconnect();
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Initialize the guitar instrument
 */
export async function initGuitar() {
  if (isInitialized) return;
  
  try {
    audioContext = Tone.getContext().rawContext;
    
    // Master gain
    masterGain = audioContext.createGain();
    masterGain.gain.value = masterVolume;
    masterGain.connect(audioContext.destination);
    
    // Create voices
    voices = [];
    for (let i = 0; i < MAX_VOICES; i++) {
      voices.push(new KSVoice(audioContext, masterGain));
    }
    
    isInitialized = true;
    console.log('[Guitar] Initialized with Karplus-Strong synthesis');
  } catch (err) {
    console.error('[Guitar] Init failed:', err);
    throw err;
  }
}

/**
 * Get an available voice
 */
function getVoice() {
  // Find inactive voice
  for (let i = 0; i < voices.length; i++) {
    if (!voices[i].active) return i;
  }
  // Steal quietest voice
  let minIdx = 0;
  let minAmp = voices[0].amplitude;
  for (let i = 1; i < voices.length; i++) {
    if (voices[i].amplitude < minAmp) {
      minAmp = voices[i].amplitude;
      minIdx = i;
    }
  }
  return minIdx;
}

/**
 * Trigger a note
 */
export async function triggerNote(note, time, velocity = 100) {
  if (!isInitialized) {
    console.warn('[Guitar] Not initialized');
    return null;
  }
  
  // Ensure audio context is running
  if (audioContext.state !== 'running') {
    try {
      await Tone.start();
      console.log('[Guitar] Audio context started');
    } catch (e) {
      console.warn('[Guitar] Could not start audio:', e);
    }
  }
  
  const idx = getVoice();
  const voice = voices[idx];
  
  // Stop if currently playing different note
  if (voice.active && voice.midiNote !== note) {
    voice.stop();
  }
  
  // Pluck with current global params
  voice.pluck(note, velocity, globalPalmMute, globalPickPosition, globalPickHardness);
  
  // Track in map - IMPORTANT: This is how bend/vibrato find the voice
  activeVoiceMap.set(note, idx);
  
  console.log('[Guitar] ✓ Pluck note:', note, 'voiceIdx:', idx, 'velocity:', velocity, 'palmMute:', globalPalmMute);
  console.log('[Guitar] activeVoiceMap now has', activeVoiceMap.size, 'entries:', Array.from(activeVoiceMap.keys()));
  
  return voice;
}

/**
 * Release a note
 */
export function releaseNote(note, time) {
  const idx = activeVoiceMap.get(note);
  if (idx !== undefined && voices[idx]) {
    voices[idx].release();
  }
}

/**
 * Bend a note by semitones
 */
export function bendNote(note, semitones) {
  console.log('[Guitar] bendNote called:', note, 'semitones:', semitones, 'activeVoiceMap size:', activeVoiceMap.size);
  
  const idx = activeVoiceMap.get(note);
  console.log('[Guitar] Voice index for note', note, ':', idx);
  
  if (idx !== undefined) {
    const voice = voices[idx];
    if (voice && voice.active) {
      voice.bend(semitones);
      console.log('[Guitar] ✓ Bend applied! Voice baseFreq:', voice.baseFreq, 'bendSemitones now:', voice.bendSemitones);
    } else {
      console.log('[Guitar] ✗ Voice not active or missing');
    }
  } else {
    console.log('[Guitar] ✗ Note not found in activeVoiceMap. Keys:', Array.from(activeVoiceMap.keys()));
  }
}

/**
 * Apply vibrato to a note
 */
export function applyVibrato(note, depth = 0.3, rate = 5) {
  console.log('[Guitar] applyVibrato called:', note, 'depth:', depth, 'rate:', rate);
  
  const idx = activeVoiceMap.get(note);
  if (idx !== undefined) {
    const voice = voices[idx];
    if (voice && voice.active) {
      // Convert semitones to cents
      const cents = depth * 100;
      voice.setVibrato(cents, rate);
      console.log('[Guitar] ✓ Vibrato applied! depthCents:', cents, 'rate:', rate);
    } else {
      console.log('[Guitar] ✗ Voice not active for vibrato');
    }
  } else {
    console.log('[Guitar] ✗ Note not found for vibrato:', note);
  }
}

/**
 * Stop vibrato
 */
export function stopVibrato(note) {
  const idx = activeVoiceMap.get(note);
  if (idx !== undefined && voices[idx]) {
    voices[idx].setVibrato(0, 5);
  }
}

/**
 * Slide from one note to another
 */
export function slideToNote(fromNote, toNote, duration = 0.1) {
  console.log('[Guitar] slideToNote called:', fromNote, '->', toNote);
  
  const idx = activeVoiceMap.get(fromNote);
  if (idx !== undefined) {
    const voice = voices[idx];
    if (voice && voice.active) {
      voice.baseFreq = 440 * Math.pow(2, (toNote - 69) / 12);
      voice.midiNote = toNote;
      voice.bendSemitones = 0;
      
      // Update map - CRITICAL for bend/vibrato to work on new note
      activeVoiceMap.delete(fromNote);
      activeVoiceMap.set(toNote, idx);
      
      console.log('[Guitar] ✓ Slide applied! New baseFreq:', voice.baseFreq);
    } else {
      console.log('[Guitar] ✗ Voice not active for slide');
    }
  } else {
    console.log('[Guitar] ✗ fromNote not found for slide:', fromNote);
  }
}

/**
 * Hammer-on
 */
export async function hammerOn(note, velocity = 80) {
  return triggerNote(note, undefined, velocity * 0.75);
}

/**
 * Pull-off
 */
export async function pullOff(note, velocity = 70) {
  return hammerOn(note, velocity);
}

/**
 * Set palm mute (0-1) - affects ALL currently playing and future notes
 */
export function setPalmMute(amount) {
  const prevValue = globalPalmMute;
  globalPalmMute = Math.max(0, Math.min(1, amount));
  console.log('[Guitar] ✓ Palm mute changed:', prevValue, '->', globalPalmMute);
  
  // Update all active voices immediately
  let activeCount = 0;
  for (const voice of voices) {
    if (voice.active) {
      voice.updateFilters();
      activeCount++;
    }
  }
  console.log('[Guitar] Updated filters on', activeCount, 'active voices');
}

/**
 * Get palm mute amount
 */
export function getPalmMute() {
  return globalPalmMute;
}

/**
 * Set pickup position
 */
export function setPickupPosition(position) {
  if (!['bridge', 'middle', 'neck'].includes(position)) {
    position = 'bridge';
  }
  globalPickup = position;
  console.log('[Guitar] Pickup:', position);
  
  // Update all active voices
  for (const voice of voices) {
    if (voice.active) {
      voice.updateFilters();
    }
  }
}

/**
 * Set tone (0-1)
 */
export function setTone(value) {
  globalTone = Math.max(0, Math.min(1, value));
  
  // Update all active voices
  for (const voice of voices) {
    if (voice.active) {
      voice.updateFilters();
    }
  }
}

/**
 * Set pick position
 */
export function setPickPosition(position) {
  globalPickPosition = Math.max(0.05, Math.min(0.35, position));
}

/**
 * Set pick hardness
 */
export function setPickHardness(hardness) {
  globalPickHardness = Math.max(0, Math.min(1, hardness));
}

/**
 * Set guitar mode
 */
export function setGuitarMode(mode) {
  if (mode !== GUITAR_MODE_ELECTRIC && mode !== GUITAR_MODE_NYLON) return;
  
  stopAllNotes();
  currentGuitarMode = mode;
  
  if (mode === GUITAR_MODE_NYLON) {
    globalPickHardness = 0.35;
    globalPickup = 'neck';
    globalTone = 0.45;
  } else {
    globalPickHardness = 0.7;
    globalPickup = 'bridge';
    globalTone = 0.7;
  }
}

export function getGuitarMode() {
  return currentGuitarMode;
}

/**
 * Stop all notes
 */
export function stopAllNotes() {
  for (const voice of voices) {
    voice.stop();
  }
  activeVoiceMap.clear();
}

/**
 * Set volume
 */
export function setVolume(vol) {
  masterVolume = Math.max(0, Math.min(1, vol));
  if (masterGain) {
    masterGain.gain.value = masterVolume;
  }
}

export function getVolume() {
  return masterVolume;
}

/**
 * Cleanup
 */
export function dispose() {
  stopAllNotes();
  for (const voice of voices) {
    voice.dispose();
  }
  voices = [];
  activeVoiceMap.clear();
  masterGain?.disconnect();
  isInitialized = false;
}

export function isReady() {
  return isInitialized;
}

// Compatibility exports
export function setDistortion(amount) {}
export function setReverb(amount) {}
export function getActiveVoice(note) {
  const idx = activeVoiceMap.get(note);
  return idx !== undefined ? voices[idx] : null;
}
export function getParams() {
  return {
    palmMute: globalPalmMute,
    tone: globalTone,
    pickup: globalPickup,
    pickPosition: globalPickPosition,
    pickHardness: globalPickHardness
  };
}

// Debug helper - expose to window for console debugging
if (typeof window !== 'undefined') {
  window.__guitarDebug = {
    getState: () => ({
      isInitialized,
      voiceCount: voices.length,
      activeVoiceMapSize: activeVoiceMap.size,
      activeVoiceMapKeys: Array.from(activeVoiceMap.keys()),
      globalPalmMute,
      globalTone,
      globalPickup,
      voices: voices.map((v, i) => ({
        index: i,
        active: v.active,
        midiNote: v.midiNote,
        baseFreq: v.baseFreq,
        bendSemitones: v.bendSemitones,
        vibratoDepth: v.vibratoDepth,
        amplitude: v.amplitude
      }))
    }),
    testBend: (note, semitones) => {
      console.log('Testing bend on note', note, 'by', semitones, 'semitones');
      bendNote(note, semitones);
    },
    testPalmMute: (amount) => {
      console.log('Testing palm mute:', amount);
      setPalmMute(amount);
    },
    testVibrato: (note, depth, rate) => {
      console.log('Testing vibrato on note', note);
      applyVibrato(note, depth, rate);
    }
  };
  console.log('[Guitar] Debug helper available at window.__guitarDebug');
}
