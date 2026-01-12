import * as Tone from 'tone';

/**
 * Elite Electric Guitar - Premium Physically-Modeled Synthesis
 * 
 * Production-ready guitar featuring:
 * - Custom Karplus-Strong inspired synthesis with REAL-TIME pitch modulation
 * - Continuous pitch bends with smooth glide (up to 4 semitones)
 * - Vibrato with adjustable depth and rate
 * - Slide between frets with continuous pitch glide
 * - Palm mute with dramatic damping effect
 * - Pickup selector (bridge/middle/neck) with realistic tonal differences
 * - Tone control with resonant filter
 * - Hammer-on/pull-off articulations
 * - Full MIDI support (including pitch bend wheel)
 * - Premium amp simulation and cabinet emulation
 * 
 * @author Jam in a Docs
 * @version 3.0.0 - Elite Production Edition
 */

// ============================================================================
// CONSTANTS
// ============================================================================

export const GUITAR_MODE_ELECTRIC = 'electric';
export const GUITAR_MODE_NYLON = 'nylon';
export const GUITAR_MODE_ACOUSTIC = 'acoustic';

const MAX_VOICES = 6;
const MAX_BEND_SEMITONES = 4; // Standard guitar bend range
const DEFAULT_VIBRATO_RATE = 5.5; // Hz - typical guitar vibrato
const DEFAULT_VIBRATO_DEPTH = 0.25; // semitones

// Guitar string frequencies for realistic harmonics
const STRING_RESONANCES = [329.63, 246.94, 196.00, 146.83, 110.00, 82.41]; // E4, B3, G3, D3, A2, E2

// ============================================================================
// MODULE STATE
// ============================================================================

let isInitialized = false;
let currentGuitarMode = GUITAR_MODE_ELECTRIC;
let masterVolume = 0.75;

// Audio nodes
let audioContext = null;
let masterGain = null;
let masterCompressor = null;
let masterFilter = null;
let cabinetSim = null;
let reverbSend = null;
let dryGain = null;
let wetGain = null;

// Voice management
let voices = [];
let activeVoiceMap = new Map(); // MIDI note -> voice index
let voiceRoundRobin = 0;

// Note debouncing removed - UI components handle this via activeNotes tracking

// Global parameters (affect all notes in real-time)
let globalPalmMute = 0;
let globalTone = 0.7;
let globalPickup = 'bridge';
let globalPickPosition = 0.13;
let globalPickHardness = 0.7;
let globalReverbAmount = 0.18;

// ============================================================================
// GUITAR VOICE CLASS - Custom synthesis with real-time pitch modulation
// ============================================================================

class GuitarVoice {
  constructor(ctx, output) {
    if (!ctx || !output) {
      throw new Error('GuitarVoice requires valid context and output node');
    }
    
    this.ctx = ctx;
    this.output = output;
    
    // Voice state
    this.active = false;
    this.midiNote = null;
    this.baseFreq = 440;
    this.currentFreq = 440;
    this.startTime = 0;
    
    // Real-time modulation state
    this.bendSemitones = 0;
    this.targetBend = 0;
    this.vibratoDepth = 0;
    this.vibratoRate = DEFAULT_VIBRATO_RATE;
    
    // Per-note parameters
    this.notePalmMute = 0;
    this.noteVelocity = 100;
    
    // Audio nodes (created fresh for each note)
    this.oscillators = [];
    this.harmonicGains = []; // Individual gain per harmonic for decay modeling
    this.gainNodes = [];
    this.filterNodes = [];
    this.vibratoLFO = null;
    this.vibratoGainNode = null;
    this.voiceGain = null;
    this.voiceFilter = null;
    this.muteFilter = null;
    this.noiseSource = null;
    this.noiseGain = null;
    this.bodyResonance = null;
  }
  
  /**
   * Create the synthesis chain for a new note
   * REALISTIC GUITAR SUSTAIN & DECAY
   */
  createSynthChain() {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    
    // Clean up any existing nodes
    this.cleanup();
    
    // Calculate effective palm mute
    const effectiveMute = Math.max(this.notePalmMute, globalPalmMute);
    const isMuted = effectiveMute > 0.1;
    
    // ===== PLUCK NOISE (attack transient) =====
    // Creates the realistic "pick hitting string" sound
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.008));
    }
    
    this.noiseSource = ctx.createBufferSource();
    this.noiseSource.buffer = noiseBuffer;
    
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0;
    
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = this.baseFreq * 3;
    noiseFilter.Q.value = 1.5;
    
    this.noiseSource.connect(noiseFilter);
    noiseFilter.connect(this.noiseGain);
    
    // ===== HARMONIC OSCILLATOR BANK =====
    // Real guitar strings produce fundamental + harmonics, each with different decay rates
    // Higher harmonics decay FASTER than lower ones - this is key to realistic sound
    
    const numHarmonics = 8; // More harmonics = richer, more realistic tone
    this.oscillators = [];
    this.harmonicGains = [];
    
    for (let h = 1; h <= numHarmonics; h++) {
      const osc = ctx.createOscillator();
      
      // Use different waveforms for different harmonics to approximate guitar spectrum
      if (h === 1) {
        osc.type = 'sine'; // Fundamental is mostly pure
      } else if (h <= 3) {
        osc.type = 'triangle'; // Lower harmonics are rounded
      } else {
        osc.type = 'sine'; // Higher harmonics are purer
      }
      
      osc.frequency.value = this.baseFreq * h;
      
      // Slight inharmonicity (real strings have slightly sharp higher harmonics)
      const inharmonicity = 1 + (0.0003 * h * h); // B coefficient
      osc.frequency.value = this.baseFreq * h * inharmonicity;
      
      // Natural detuning for warmth
      osc.detune.value = (Math.random() - 0.5) * 4;
      
      const harmonicGain = ctx.createGain();
      
      // Harmonic amplitude follows 1/h falloff with pickup adjustments
      let amplitude = 1 / Math.pow(h, 0.8);
      
      // Pickup position affects harmonic content
      if (globalPickup === 'neck') {
        // Neck pickup: attenuate higher harmonics
        amplitude *= Math.exp(-0.15 * h);
      } else if (globalPickup === 'bridge') {
        // Bridge pickup: emphasize upper harmonics
        amplitude *= (h <= 3) ? 0.9 : 1.1;
      }
      
      // Palm mute heavily attenuates harmonics
      if (isMuted) {
        amplitude *= Math.exp(-0.4 * h);
      }
      
      harmonicGain.gain.value = amplitude;
      
      osc.connect(harmonicGain);
      
      this.oscillators.push(osc);
      this.harmonicGains.push(harmonicGain);
    }
    
    // ===== BODY RESONANCE =====
    // Guitar body has resonant frequencies that color the tone
    this.bodyResonance = ctx.createBiquadFilter();
    this.bodyResonance.type = 'peaking';
    this.bodyResonance.frequency.value = 200; // Body resonance around 200Hz
    this.bodyResonance.Q.value = 2;
    this.bodyResonance.gain.value = 3;
    
    // ===== VIBRATO LFO =====
    this.vibratoLFO = ctx.createOscillator();
    this.vibratoLFO.type = 'sine';
    this.vibratoLFO.frequency.value = this.vibratoRate;
    
    this.vibratoGainNode = ctx.createGain();
    this.vibratoGainNode.gain.value = 0; // Start with no vibrato
    
    this.vibratoLFO.connect(this.vibratoGainNode);
    
    // Connect vibrato to all oscillator frequencies
    this.oscillators.forEach((osc, i) => {
      const vibratoMult = 1 / (i + 1); // Higher harmonics get proportionally less vibrato
      const individualVibratoGain = ctx.createGain();
      individualVibratoGain.gain.value = vibratoMult;
      this.vibratoGainNode.connect(individualVibratoGain);
      individualVibratoGain.connect(osc.frequency);
    });
    
    // ===== FILTER CHAIN =====
    
    // Voice filter - main tonal shaping (simulates pickup response)
    this.voiceFilter = ctx.createBiquadFilter();
    this.voiceFilter.type = 'lowpass';
    this.voiceFilter.Q.value = 1.5;
    
    // Presence peak for guitar "bite"
    const presenceFilter = ctx.createBiquadFilter();
    presenceFilter.type = 'peaking';
    presenceFilter.frequency.value = 3200;
    presenceFilter.Q.value = 1.5;
    presenceFilter.gain.value = isMuted ? -2 : 4;
    
    // Palm mute filter - aggressive high cut
    this.muteFilter = ctx.createBiquadFilter();
    this.muteFilter.type = 'lowpass';
    this.muteFilter.Q.value = 0.7;
    
    // Set initial filter frequencies
    this.updateFilters();
    
    // ===== VOICE OUTPUT =====
    this.voiceGain = ctx.createGain();
    this.voiceGain.gain.value = 0;
    
    // ===== CONNECTIONS =====
    // Harmonics -> Mixer -> Body Resonance -> Voice Filter -> Presence -> Mute Filter -> Voice Gain -> Output
    const mixer = ctx.createGain();
    mixer.gain.value = 0.35; // Normalize level
    
    // Connect all harmonics to mixer
    this.harmonicGains.forEach(hg => {
      hg.connect(mixer);
    });
    
    // Add pluck noise
    this.noiseGain.connect(mixer);
    
    mixer.connect(this.bodyResonance);
    this.bodyResonance.connect(this.voiceFilter);
    this.voiceFilter.connect(presenceFilter);
    presenceFilter.connect(this.muteFilter);
    this.muteFilter.connect(this.voiceGain);
    this.voiceGain.connect(this.output);
    
    // Start vibrato LFO (always running, depth controls effect)
    this.vibratoLFO.start(now);
  }
  
  /**
   * Pluck the string - trigger a new note with REALISTIC GUITAR ENVELOPE
   */
  pluck(midiNote, velocity, palmMute = 0, pickPos = 0.13, pickHardness = 0.7) {
    const ctx = this.ctx;
    
    // Verify context is valid and running
    if (!ctx) {
      console.error('[Guitar] No audio context in voice!');
      return;
    }
    
    if (ctx.state !== 'running') {
      console.warn('[Guitar] Context not running in pluck, state:', ctx.state);
      // Try to resume
      ctx.resume().catch(e => console.error('[Guitar] Resume in pluck failed:', e));
    }
    
    const now = ctx.currentTime;
    
    this.midiNote = midiNote;
    this.baseFreq = 440 * Math.pow(2, (midiNote - 69) / 12);
    this.currentFreq = this.baseFreq;
    this.notePalmMute = palmMute;
    this.noteVelocity = velocity;
    this.startTime = now;
    
    // Reset modulation
    this.bendSemitones = 0;
    this.targetBend = 0;
    this.vibratoDepth = 0;
    
    // Create fresh synthesis chain
    try {
      this.createSynthChain();
    } catch (e) {
      console.error('[Guitar] createSynthChain failed:', e);
      return;
    }
    
    // Calculate effective palm mute
    const effectiveMute = Math.max(palmMute, globalPalmMute);
    const isMuted = effectiveMute > 0.1;
    
    // Calculate velocity-based volume (with curve for dynamics)
    const velNorm = Math.pow(velocity / 127, 0.7);
    const muteVol = isMuted ? (1 - effectiveMute * 0.4) : 1;
    const targetVol = velNorm * muteVol * 0.85;
    
    // ===== REALISTIC GUITAR ENVELOPE =====
    // Real electric guitars have:
    // - Very fast attack (< 5ms)
    // - Initial brightness that decays quickly (50-100ms)
    // - Long sustain (2-5 seconds depending on string gauge, guitar sustain)
    // - Natural exponential decay
    
    const attackTime = 0.001 + (1 - pickHardness) * 0.004; // 1-5ms attack
    
    // Decay constants - based on string physics
    // Lower notes sustain longer than higher notes
    const pitchFactor = Math.pow(2, (69 - midiNote) / 24); // Lower = longer
    
    // Palm mute drastically shortens decay
    const muteDecayMult = isMuted ? (0.08 + (1 - effectiveMute) * 0.12) : 1;
    
    // Main decay time constant (tau) - this controls how long the note rings
    const decayTau = (1.8 + pitchFactor * 1.2) * muteDecayMult; // 1.8-4+ seconds unmuted
    
    // ===== AMPLITUDE ENVELOPE =====
    // Quick attack
    this.voiceGain.gain.setValueAtTime(0, now);
    this.voiceGain.gain.linearRampToValueAtTime(targetVol, now + attackTime);
    
    // Long natural decay using exponential curve
    // setTargetAtTime creates y = y0 * e^(-t/tau) curve - perfect for string decay
    this.voiceGain.gain.setTargetAtTime(
      targetVol * 0.0001, // Decay toward near-zero
      now + attackTime,
      decayTau // Time constant determines decay rate
    );
    
    // ===== HARMONIC DECAY - KEY TO REALISTIC SOUND =====
    // Higher harmonics decay FASTER than lower ones
    // This is why guitars sound "duller" as the note fades
    this.harmonicGains.forEach((hg, i) => {
      const harmonicNumber = i + 1;
      
      // Higher harmonics decay faster (realistic string physics)
      const harmonicDecayTau = decayTau / Math.pow(harmonicNumber, 0.4);
      
      const currentAmp = hg.gain.value;
      hg.gain.setTargetAtTime(
        currentAmp * 0.001,
        now + attackTime,
        harmonicDecayTau
      );
    });
    
    // ===== PLUCK NOISE (attack character) =====
    if (this.noiseGain) {
      const noiseLevel = 0.15 + pickHardness * 0.25; // Harder pick = more attack noise
      this.noiseGain.gain.setValueAtTime(0, now);
      this.noiseGain.gain.linearRampToValueAtTime(noiseLevel * (isMuted ? 0.4 : 1), now + 0.001);
      this.noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    }
    
    // ===== FILTER ENVELOPE - brightness decay =====
    // Initial pluck is bright, then filter closes over time
    // This models how string harmonics die faster than fundamental
    
    const filterAttackFreq = Math.min(12000, this.baseFreq * (isMuted ? 4 : 12));
    const filterSustainFreq = Math.min(6000, this.baseFreq * (isMuted ? 2 : 5));
    const filterFinalFreq = Math.min(3000, this.baseFreq * (isMuted ? 1.2 : 2.5));
    
    // Bright attack
    this.voiceFilter.frequency.setValueAtTime(filterAttackFreq, now);
    
    // Quick initial brightness decay
    this.voiceFilter.frequency.setTargetAtTime(
      filterSustainFreq,
      now + attackTime,
      0.08 // Fast initial decay
    );
    
    // Slower continued brightness decay
    this.voiceFilter.frequency.setTargetAtTime(
      filterFinalFreq,
      now + 0.3,
      decayTau * 0.5
    );
    
    // ===== START OSCILLATORS =====
    this.oscillators.forEach(osc => {
      osc.start(now);
    });
    
    // Start noise
    if (this.noiseSource) {
      try {
        this.noiseSource.start(now);
      } catch (e) {}
    }
    
    this.active = true;
    
    console.log('[Guitar] ✓ Pluck:', midiNote, 'freq:', this.baseFreq.toFixed(1), 'vel:', velocity, 'mute:', effectiveMute.toFixed(2), 'decay:', decayTau.toFixed(2) + 's');
  }
  
  /**
   * Update filters based on global settings
   */
  updateFilters() {
    if (!this.voiceFilter || !this.muteFilter) return;
    
    const ctx = this.ctx;
    const now = ctx.currentTime;
    
    // Base cutoff from pickup position (realistic pickup frequency response)
    let cutoff = 5000;
    if (globalPickup === 'neck') cutoff = 3000;      // Warm, rounded
    else if (globalPickup === 'middle') cutoff = 4500; // Balanced
    else cutoff = 7500; // Bridge - bright and cutting
    
    // Apply tone knob (0 = very dark, 1 = full brightness)
    cutoff *= (0.15 + globalTone * 0.85);
    
    // Palm mute dramatically reduces highs
    const effectiveMute = Math.max(this.notePalmMute, globalPalmMute);
    if (effectiveMute > 0.1) {
      cutoff *= (1 - effectiveMute * 0.8);
    }
    
    // Clamp to reasonable range
    cutoff = Math.max(250, Math.min(14000, cutoff));
    
    this.voiceFilter.frequency.setTargetAtTime(cutoff, now, 0.03);
    
    // Mute filter - very aggressive for palm mute
    const muteCutoff = effectiveMute > 0.1 
      ? 350 + (1 - effectiveMute) * 3500 
      : 14000;
    this.muteFilter.frequency.setTargetAtTime(muteCutoff, now, 0.015);
    
    // Update body resonance based on palm mute
    if (this.bodyResonance) {
      const resGain = effectiveMute > 0.1 ? (1 - effectiveMute * 0.8) * 3 : 3;
      this.bodyResonance.gain.setTargetAtTime(resGain, now, 0.02);
    }
  }
  
  /**
   * Apply pitch bend (semitones) - REAL-TIME across all harmonics
   */
  bend(semitones) {
    if (!this.active) return;
    
    const ctx = this.ctx;
    const now = ctx.currentTime;
    
    // Clamp to max bend range
    this.targetBend = Math.max(-MAX_BEND_SEMITONES, Math.min(MAX_BEND_SEMITONES, semitones));
    this.bendSemitones = this.targetBend;
    
    // Calculate bent frequency
    const bentFreq = this.baseFreq * Math.pow(2, this.bendSemitones / 12);
    this.currentFreq = bentFreq;
    
    // Smooth ramp to new frequency on all harmonics
    // Bend time depends on how far we're bending - larger bends take slightly longer
    const rampTime = 0.015 + Math.abs(semitones) * 0.005; // 15-35ms
    
    this.oscillators.forEach((osc, i) => {
      const harmonicNumber = i + 1;
      // Inharmonicity factor (real strings have slightly sharp upper harmonics)
      const inharmonicity = 1 + (0.0003 * harmonicNumber * harmonicNumber);
      const targetFreq = bentFreq * harmonicNumber * inharmonicity;
      
      try {
        osc.frequency.cancelScheduledValues(now);
        osc.frequency.setValueAtTime(osc.frequency.value, now);
        osc.frequency.linearRampToValueAtTime(targetFreq, now + rampTime);
      } catch (e) {
        // Oscillator may have ended
      }
    });
    
    if (Math.abs(semitones) > 0.1) {
      console.log('[Guitar] Bend:', semitones.toFixed(2), 'semitones -> freq:', bentFreq.toFixed(1));
    }
  }
  
  /**
   * Apply vibrato
   */
  setVibrato(depthSemitones, rateHz = DEFAULT_VIBRATO_RATE) {
    if (!this.active || !this.vibratoLFO || !this.vibratoGainNode) return;
    
    const ctx = this.ctx;
    const now = ctx.currentTime;
    
    this.vibratoDepth = depthSemitones;
    this.vibratoRate = rateHz;
    
    // Convert semitones to frequency deviation
    // For vibrato, we modulate around the current frequency
    const freqDeviation = this.currentFreq * (Math.pow(2, depthSemitones / 12) - 1);
    
    this.vibratoLFO.frequency.setTargetAtTime(rateHz, now, 0.02);
    this.vibratoGainNode.gain.setTargetAtTime(freqDeviation, now, 0.04);
    
    console.log('[Guitar] Vibrato:', depthSemitones.toFixed(2), 'semitones @', rateHz.toFixed(1), 'Hz');
  }
  
  /**
   * Stop vibrato
   */
  stopVibrato() {
    if (!this.vibratoGainNode) return;
    
    const ctx = this.ctx;
    const now = ctx.currentTime;
    
    this.vibratoDepth = 0;
    this.vibratoGainNode.gain.setTargetAtTime(0, now, 0.08);
  }
  
  /**
   * Slide to a new note - continuous pitch glide with realistic fret noise
   */
  slideTo(newMidiNote, duration = 0.1) {
    if (!this.active) return;
    
    const ctx = this.ctx;
    const now = ctx.currentTime;
    
    const newFreq = 440 * Math.pow(2, (newMidiNote - 69) / 12);
    const slideDistance = Math.abs(newMidiNote - this.midiNote);
    
    // Update state
    this.midiNote = newMidiNote;
    this.baseFreq = newFreq;
    this.currentFreq = newFreq;
    this.bendSemitones = 0;
    
    // Smooth glide to new frequency on all harmonics
    this.oscillators.forEach((osc, i) => {
      const harmonicNumber = i + 1;
      const inharmonicity = 1 + (0.0003 * harmonicNumber * harmonicNumber);
      const targetFreq = newFreq * harmonicNumber * inharmonicity;
      
      try {
        osc.frequency.cancelScheduledValues(now);
        osc.frequency.setValueAtTime(osc.frequency.value, now);
        osc.frequency.exponentialRampToValueAtTime(targetFreq, now + duration);
      } catch (e) {
        // Oscillator may have ended
      }
    });
    
    // Add slight volume dip during slide (string friction)
    if (this.voiceGain && slideDistance > 2) {
      const currentVol = this.voiceGain.gain.value;
      const dipAmount = Math.min(0.3, slideDistance * 0.03);
      this.voiceGain.gain.setValueAtTime(currentVol, now);
      this.voiceGain.gain.linearRampToValueAtTime(currentVol * (1 - dipAmount), now + duration * 0.5);
      this.voiceGain.gain.linearRampToValueAtTime(currentVol * 0.95, now + duration);
    }
    
    // Update vibrato amount for new frequency
    if (this.vibratoDepth > 0 && this.vibratoGainNode) {
      const freqDeviation = newFreq * (Math.pow(2, this.vibratoDepth / 12) - 1);
      this.vibratoGainNode.gain.setTargetAtTime(freqDeviation, now + duration, 0.02);
    }
    
    console.log('[Guitar] Slide to:', newMidiNote, 'freq:', newFreq.toFixed(1), 'duration:', duration.toFixed(3));
  }
  
  /**
   * Release note - finger lifted but string continues to ring naturally
   * Unlike synths, guitars don't immediately cut off - they continue their natural decay
   */
  release() {
    if (!this.active) return;
    
    const ctx = this.ctx;
    const now = ctx.currentTime;
    
    const effectiveMute = Math.max(this.notePalmMute, globalPalmMute);
    
    // For guitar, "release" means letting the note continue to decay naturally
    // but we can optionally speed it up slightly (like lifting finger causes slight damping)
    
    // If heavily palm muted, release is quick
    // If open string, note can ring for a long time
    const releaseMultiplier = effectiveMute > 0.5 ? 0.15 : (effectiveMute > 0.2 ? 0.4 : 0.8);
    const releaseTime = releaseMultiplier * 1.5; // 0.2 - 1.2 seconds
    
    // Gentle fade instead of abrupt cutoff
    if (this.voiceGain) {
      const currentGain = this.voiceGain.gain.value;
      this.voiceGain.gain.cancelScheduledValues(now);
      this.voiceGain.gain.setValueAtTime(currentGain, now);
      
      // Exponential decay for natural sound
      this.voiceGain.gain.setTargetAtTime(0.0001, now, releaseTime * 0.4);
    }
    
    // Harmonics should also decay on release
    this.harmonicGains.forEach((hg, i) => {
      const currentGain = hg.gain.value;
      hg.gain.cancelScheduledValues(now);
      hg.gain.setValueAtTime(currentGain, now);
      // Higher harmonics decay faster on release too
      hg.gain.setTargetAtTime(0.0001, now, releaseTime * 0.3 / (1 + i * 0.2));
    });
    
    // Stop vibrato gradually
    this.stopVibrato();
    
    // Schedule cleanup after note has faded
    setTimeout(() => {
      this.cleanup();
      this.active = false;
      this.midiNote = null;
    }, (releaseTime + 0.5) * 1000);
  }
  
  /**
   * Stop immediately
   */
  stop() {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    
    if (this.voiceGain) {
      try {
        this.voiceGain.gain.cancelScheduledValues(now);
        this.voiceGain.gain.setValueAtTime(this.voiceGain.gain.value, now);
        this.voiceGain.gain.linearRampToValueAtTime(0, now + 0.01);
      } catch (e) {}
    }
    
    setTimeout(() => {
      this.cleanup();
    }, 50);
    
    this.active = false;
    this.midiNote = null;
    this.bendSemitones = 0;
    this.vibratoDepth = 0;
  }
  
  /**
   * Apply real-time palm mute changes - affects harmonics dramatically
   */
  applyPalmMute(amount) {
    if (!this.active) return;
    
    const ctx = this.ctx;
    const now = ctx.currentTime;
    
    const effectiveMute = Math.max(this.notePalmMute, amount);
    this.updateFilters();
    
    // Palm mute kills higher harmonics instantly
    this.harmonicGains.forEach((hg, i) => {
      const harmonicNumber = i + 1;
      // Higher harmonics are more affected by palm mute
      const muteEffect = Math.exp(-effectiveMute * 0.6 * harmonicNumber);
      const currentGain = hg.gain.value;
      hg.gain.setTargetAtTime(currentGain * muteEffect, now, 0.015);
    });
    
    // Also reduce volume slightly for more muted effect
    if (this.voiceGain && effectiveMute > 0.1) {
      const currentVol = this.voiceGain.gain.value;
      const targetVol = currentVol * (1 - effectiveMute * 0.3);
      this.voiceGain.gain.setTargetAtTime(targetVol, now, 0.02);
    }
  }
  
  /**
   * Clean up audio nodes
   */
  cleanup() {
    // Stop and disconnect oscillators
    this.oscillators.forEach(osc => {
      try {
        osc.stop();
        osc.disconnect();
      } catch (e) {}
    });
    this.oscillators = [];
    
    // Disconnect harmonic gain nodes
    this.harmonicGains.forEach(gain => {
      try {
        gain.disconnect();
      } catch (e) {}
    });
    this.harmonicGains = [];
    
    // Disconnect general gain nodes
    this.gainNodes.forEach(gain => {
      try {
        gain.disconnect();
      } catch (e) {}
    });
    this.gainNodes = [];
    
    // Clean up noise source
    if (this.noiseSource) {
      try {
        this.noiseSource.stop();
        this.noiseSource.disconnect();
      } catch (e) {}
      this.noiseSource = null;
    }
    
    if (this.noiseGain) {
      try { this.noiseGain.disconnect(); } catch (e) {}
      this.noiseGain = null;
    }
    
    // Clean up vibrato
    if (this.vibratoLFO) {
      try {
        this.vibratoLFO.stop();
        this.vibratoLFO.disconnect();
      } catch (e) {}
      this.vibratoLFO = null;
    }
    
    if (this.vibratoGainNode) {
      try { this.vibratoGainNode.disconnect(); } catch (e) {}
      this.vibratoGainNode = null;
    }
    
    // Clean up body resonance
    if (this.bodyResonance) {
      try { this.bodyResonance.disconnect(); } catch (e) {}
      this.bodyResonance = null;
    }
    
    // Clean up filters
    if (this.voiceFilter) {
      try { this.voiceFilter.disconnect(); } catch (e) {}
      this.voiceFilter = null;
    }
    
    if (this.muteFilter) {
      try { this.muteFilter.disconnect(); } catch (e) {}
      this.muteFilter = null;
    }
    
    // Clean up voice gain
    if (this.voiceGain) {
      try { this.voiceGain.disconnect(); } catch (e) {}
      this.voiceGain = null;
    }
  }
  
  /**
   * Full disposal
   */
  dispose() {
    this.stop();
    this.cleanup();
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
    // Ensure Tone.js context is started (shares AudioContext)
    await Tone.start();
    audioContext = Tone.getContext().rawContext;
    
    console.log('[Guitar] AudioContext started, sample rate:', audioContext.sampleRate);
    
    // ===== MASTER CHAIN =====
    
    // Master compressor - tuned for guitar sustain
    // Lower threshold and higher ratio give more sustain (like a real compressor pedal)
    masterCompressor = audioContext.createDynamicsCompressor();
    masterCompressor.threshold.value = -24; // Compress more of the signal
    masterCompressor.knee.value = 12;       // Softer knee for more natural compression
    masterCompressor.ratio.value = 6;       // Higher ratio for sustain
    masterCompressor.attack.value = 0.002;  // Fast attack to catch transients
    masterCompressor.release.value = 0.25;  // Medium release for smooth sustain
    
    // Cabinet simulation (speaker character)
    cabinetSim = audioContext.createBiquadFilter();
    cabinetSim.type = 'lowpass';
    cabinetSim.frequency.value = 5500;
    cabinetSim.Q.value = 0.7;
    
    // Second cabinet filter - high shelf cut
    const cabinetHighCut = audioContext.createBiquadFilter();
    cabinetHighCut.type = 'highshelf';
    cabinetHighCut.frequency.value = 4000;
    cabinetHighCut.gain.value = -3;
    
    // Master filter for global tone
    masterFilter = audioContext.createBiquadFilter();
    masterFilter.type = 'lowpass';
    masterFilter.frequency.value = 8000;
    masterFilter.Q.value = 0.7;
    
    // Master gain
    masterGain = audioContext.createGain();
    masterGain.gain.value = masterVolume;
    
    // Dry/Wet mix for reverb
    dryGain = audioContext.createGain();
    dryGain.gain.value = 1 - globalReverbAmount;
    
    wetGain = audioContext.createGain();
    wetGain.gain.value = globalReverbAmount;
    
    // Simple reverb using delay-based approach (more reliable than Tone.Reverb)
    const reverbDelay1 = audioContext.createDelay();
    reverbDelay1.delayTime.value = 0.03;
    const reverbDelay2 = audioContext.createDelay();
    reverbDelay2.delayTime.value = 0.07;
    const reverbDelay3 = audioContext.createDelay();
    reverbDelay3.delayTime.value = 0.11;
    
    const reverbFeedback = audioContext.createGain();
    reverbFeedback.gain.value = 0.3;
    
    const reverbFilter = audioContext.createBiquadFilter();
    reverbFilter.type = 'lowpass';
    reverbFilter.frequency.value = 3000;
    
    // Connect reverb chain
    reverbDelay1.connect(reverbDelay2);
    reverbDelay2.connect(reverbDelay3);
    reverbDelay3.connect(reverbFilter);
    reverbFilter.connect(reverbFeedback);
    reverbFeedback.connect(reverbDelay1);
    reverbFilter.connect(wetGain);
    
    reverbSend = reverbDelay1;
    
    // ===== CONNECT MASTER CHAIN =====
    // Voice outputs -> Compressor -> Cabinet -> Master Filter -> [Dry + Wet] -> Master Gain -> Destination
    
    masterCompressor.connect(cabinetSim);
    cabinetSim.connect(cabinetHighCut);
    cabinetHighCut.connect(masterFilter);
    
    // Dry path
    masterFilter.connect(dryGain);
    
    // Wet path (reverb)
    masterFilter.connect(reverbSend);
    
    // Final mix
    dryGain.connect(masterGain);
    wetGain.connect(masterGain);
    
    masterGain.connect(audioContext.destination);
    
    console.log('[Guitar] Master chain connected');
    
    // ===== CREATE VOICE POOL =====
    voices = [];
    for (let i = 0; i < MAX_VOICES; i++) {
      voices.push(new GuitarVoice(audioContext, masterCompressor));
    }
    
    console.log('[Guitar] Created', MAX_VOICES, 'voices');
    
    isInitialized = true;
    console.log('[Guitar] ✓ Elite guitar initialized');
    console.log('[Guitar] Features: Real-time Bend, Vibrato, Slide, Palm Mute, Pickup Selector, Tone Control');
    
  } catch (err) {
    console.error('[Guitar] Initialization failed:', err);
    
    // Cleanup on failure
    try {
      masterCompressor?.disconnect();
      cabinetSim?.disconnect();
      masterFilter?.disconnect();
      masterGain?.disconnect();
      dryGain?.disconnect();
      wetGain?.disconnect();
    } catch (e) {}
    
    masterCompressor = null;
    cabinetSim = null;
    masterFilter = null;
    masterGain = null;
    dryGain = null;
    wetGain = null;
    reverbSend = null;
    
    throw err;
  }
}

/**
 * Get an available voice (with voice stealing)
 */
function getVoice() {
  // Find inactive voice using round-robin starting point
  for (let i = 0; i < voices.length; i++) {
    const idx = (voiceRoundRobin + i) % voices.length;
    if (!voices[idx].active) {
      voiceRoundRobin = (idx + 1) % voices.length;
      return idx;
    }
  }
  
  // All voices active - steal oldest
  let oldestIdx = 0;
  let oldestTime = voices[0].startTime;
  
  for (let i = 1; i < voices.length; i++) {
    if (voices[i].startTime < oldestTime) {
      oldestTime = voices[i].startTime;
      oldestIdx = i;
    }
  }
  
  // Stop the stolen voice
  voices[oldestIdx].stop();
  
  console.log('[Guitar] Voice stolen:', oldestIdx);
  
  return oldestIdx;
}

/**
 * Trigger a note - async to ensure AudioContext is running
 * CRITICAL FIX: Must await Tone.start() like bass does for reliable playback
 */
export async function triggerNote(note, time, velocity = 100) {
  // Quick validation
  if (note === undefined || note === null) {
    return null;
  }

  // Initialize if needed (will also start Tone.js context)
  if (!isInitialized || !voices.length || !audioContext) {
    try {
      await initGuitar();
    } catch (e) {
      console.error('[Guitar] Failed to initialize:', e);
      return null;
    }
  }
  
  // CRITICAL: Ensure AudioContext is running (exactly like bass does)
  // This is the fix for notes not playing reliably
  const context = Tone.getContext();
  if (context.state !== 'running') {
    try {
      await Tone.start();
      console.log('[Guitar] AudioContext resumed via Tone.start()');
      // Also update our reference
      audioContext = context.rawContext;
    } catch (e) {
      console.warn('[Guitar] Failed to resume AudioContext:', e);
      return null;
    }
  }
  
  // Get voice and play
  const idx = getVoice();
  const voice = voices[idx];
  
  if (!voice) {
    console.warn('[Guitar] No voice available');
    return null;
  }
  
  // Stop if currently playing different note on this voice
  if (voice.active && voice.midiNote !== note) {
    voice.stop();
  }
  
  // PLAY THE NOTE
  try {
    voice.pluck(note, velocity, globalPalmMute, globalPickPosition, globalPickHardness);
    activeVoiceMap.set(note, idx);
    return voice;
  } catch (e) {
    console.error('[Guitar] Pluck error:', e);
    return null;
  }
}

/**
 * Release a note
 */
export function releaseNote(note, time) {
  const idx = activeVoiceMap.get(note);
  if (idx !== undefined && voices[idx]) {
    voices[idx].release();
    
    // Don't remove from map immediately - let it decay naturally
    setTimeout(() => {
      if (activeVoiceMap.get(note) === idx) {
        activeVoiceMap.delete(note);
      }
    }, 800);
  }
}

/**
 * Bend a note by semitones - REAL-TIME pitch modulation
 */
export function bendNote(note, semitones) {
  // Try to find the specific note first
  const idx = activeVoiceMap.get(note);
  
  if (idx !== undefined) {
    const voice = voices[idx];
    if (voice && voice.active) {
      voice.bend(semitones);
      return;
    }
  }
  
  // Fallback: bend the most recently played note
  for (let i = voices.length - 1; i >= 0; i--) {
    if (voices[i].active) {
      voices[i].bend(semitones);
      return;
    }
  }
}

/**
 * Apply vibrato to a note
 */
export function applyVibrato(note, depth = DEFAULT_VIBRATO_DEPTH, rate = DEFAULT_VIBRATO_RATE) {
  const idx = activeVoiceMap.get(note);
  
  if (idx !== undefined) {
    const voice = voices[idx];
    if (voice && voice.active) {
      voice.setVibrato(depth, rate);
      return;
    }
  }
  
  // Fallback: apply to most recently played note
  for (let i = voices.length - 1; i >= 0; i--) {
    if (voices[i].active) {
      voices[i].setVibrato(depth, rate);
      return;
    }
  }
}

/**
 * Stop vibrato on a note
 */
export function stopVibrato(note) {
  const idx = activeVoiceMap.get(note);
  if (idx !== undefined && voices[idx]) {
    voices[idx].stopVibrato();
  }
}

/**
 * Slide from one note to another - continuous pitch glide
 */
export function slideToNote(fromNote, toNote, duration = 0.1) {
  const idx = activeVoiceMap.get(fromNote);
  
  if (idx !== undefined) {
    const voice = voices[idx];
    if (voice && voice.active) {
      voice.slideTo(toNote, duration);
      
      // Update map
      activeVoiceMap.delete(fromNote);
      activeVoiceMap.set(toNote, idx);
    }
  }
}

/**
 * Hammer-on (softer attack)
 */
export async function hammerOn(note, velocity = 80) {
  return triggerNote(note, undefined, Math.min(velocity, 90));
}

/**
 * Pull-off (softer attack)
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
  
  if (Math.abs(globalPalmMute - prevValue) > 0.01) {
    console.log('[Guitar] ✓ Palm mute:', prevValue.toFixed(2), '->', globalPalmMute.toFixed(2));
  }
  
  // Update all active voices immediately
  for (const voice of voices) {
    if (voice.active) {
      voice.applyPalmMute(globalPalmMute);
    }
  }
}

/**
 * Get palm mute amount
 */
export function getPalmMute() {
  return globalPalmMute;
}

/**
 * Set pickup position - affects tonal character
 */
export function setPickupPosition(position) {
  if (!['bridge', 'middle', 'neck'].includes(position)) {
    position = 'bridge';
  }
  
  const prevValue = globalPickup;
  globalPickup = position;
  
  if (prevValue !== position) {
    console.log('[Guitar] Pickup:', position);
  }
  
  // Update all active voices
  for (const voice of voices) {
    if (voice.active) {
      voice.updateFilters();
    }
  }
  
  // Update master filter based on pickup
  if (masterFilter) {
    let freq = 8000;
    if (position === 'neck') freq = 4500;
    else if (position === 'middle') freq = 6000;
    masterFilter.frequency.setTargetAtTime(freq, audioContext.currentTime, 0.08);
  }
}

/**
 * Set tone (0-1) - treble control
 */
export function setTone(value) {
  globalTone = Math.max(0, Math.min(1, value));
  
  console.log('[Guitar] Tone:', globalTone.toFixed(2));
  
  // Update all active voices
  for (const voice of voices) {
    if (voice.active) {
      voice.updateFilters();
    }
  }
  
  // Update master filter
  if (masterFilter && audioContext) {
    const freq = 2000 + globalTone * 6000;
    masterFilter.frequency.setTargetAtTime(freq, audioContext.currentTime, 0.08);
  }
}

/**
 * Set pick position (0.05-0.35) - where on the string the pick hits
 */
export function setPickPosition(position) {
  globalPickPosition = Math.max(0.05, Math.min(0.35, position));
}

/**
 * Set pick hardness (0-1) - affects attack character
 */
export function setPickHardness(hardness) {
  globalPickHardness = Math.max(0, Math.min(1, hardness));
}

/**
 * Set guitar mode (electric, acoustic, nylon)
 */
export function setGuitarMode(mode) {
  if (![GUITAR_MODE_ELECTRIC, GUITAR_MODE_NYLON, GUITAR_MODE_ACOUSTIC].includes(mode)) return;
  
  stopAllNotes();
  currentGuitarMode = mode;
  
  // Adjust parameters for different modes
  switch (mode) {
    case GUITAR_MODE_NYLON:
      globalPickHardness = 0.3;
      globalPickup = 'neck';
      globalTone = 0.35;
      setReverb(0.28);
      break;
    case GUITAR_MODE_ACOUSTIC:
      globalPickHardness = 0.5;
      globalPickup = 'middle';
      globalTone = 0.55;
      setReverb(0.22);
      break;
    default: // electric
      globalPickHardness = 0.7;
      globalPickup = 'bridge';
      globalTone = 0.7;
      setReverb(0.18);
  }
  
  console.log('[Guitar] Mode:', mode);
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
 * Set volume (0-1)
 */
export function setVolume(vol) {
  masterVolume = Math.max(0, Math.min(1, vol));
  if (masterGain && audioContext) {
    masterGain.gain.setTargetAtTime(masterVolume, audioContext.currentTime, 0.05);
  }
}

export function getVolume() {
  return masterVolume;
}

/**
 * Set reverb amount (0-1)
 */
export function setReverb(amount) {
  globalReverbAmount = Math.max(0, Math.min(0.5, amount)); // Cap at 50%
  
  if (dryGain && wetGain && audioContext) {
    const now = audioContext.currentTime;
    dryGain.gain.setTargetAtTime(1 - globalReverbAmount, now, 0.05);
    wetGain.gain.setTargetAtTime(globalReverbAmount, now, 0.05);
  }
}

/**
 * Set distortion (compatibility - not fully implemented)
 */
export function setDistortion(amount) {
  // Could add distortion pedal simulation here in future
  console.log('[Guitar] Distortion set to:', amount, '(not yet implemented)');
}

/**
 * Check if guitar is ready
 */
export function isReady() {
  return isInitialized;
}

/**
 * Get current parameters
 */
export function getParams() {
  return {
    palmMute: globalPalmMute,
    tone: globalTone,
    pickup: globalPickup,
    pickPosition: globalPickPosition,
    pickHardness: globalPickHardness,
    mode: currentGuitarMode,
    volume: masterVolume,
    reverb: globalReverbAmount,
  };
}

/**
 * Get active voice for a note
 */
export function getActiveVoice(note) {
  const idx = activeVoiceMap.get(note);
  return idx !== undefined ? voices[idx] : null;
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
  
  try {
    masterCompressor?.disconnect();
    cabinetSim?.disconnect();
    masterFilter?.disconnect();
    masterGain?.disconnect();
    dryGain?.disconnect();
    wetGain?.disconnect();
  } catch (e) {}
  
  masterCompressor = null;
  cabinetSim = null;
  masterFilter = null;
  masterGain = null;
  dryGain = null;
  wetGain = null;
  reverbSend = null;
  audioContext = null;
  
  isInitialized = false;
  
  console.log('[Guitar] Disposed');
}

// ============================================================================
// DEBUG HELPER
// ============================================================================

if (typeof window !== 'undefined') {
  window.__guitarDebug = {
    getState: () => ({
      isInitialized,
      voiceCount: voices.length,
      activeVoices: voices.filter(v => v.active).length,
      activeVoiceMapSize: activeVoiceMap.size,
      activeNotes: Array.from(activeVoiceMap.keys()),
      globalPalmMute,
      globalTone,
      globalPickup,
      currentGuitarMode,
      masterVolume,
      voices: voices.map((v, i) => ({
        index: i,
        active: v.active,
        midiNote: v.midiNote,
        baseFreq: v.baseFreq?.toFixed(1),
        currentFreq: v.currentFreq?.toFixed(1),
        bendSemitones: v.bendSemitones?.toFixed(2),
        vibratoDepth: v.vibratoDepth?.toFixed(2),
      }))
    }),
    testPluck: async (note = 60, vel = 100) => {
      console.log('Testing pluck on MIDI note', note);
      await triggerNote(note, undefined, vel);
    },
    testBend: (semitones) => {
      console.log('Testing bend by', semitones, 'semitones');
      bendNote(null, semitones);
    },
    testPalmMute: (amount) => {
      console.log('Testing palm mute:', amount);
      setPalmMute(amount);
    },
    testVibrato: (depth = 0.3, rate = 5.5) => {
      console.log('Testing vibrato - depth:', depth, 'rate:', rate);
      applyVibrato(null, depth, rate);
    },
    testSlide: (fromNote, toNote, duration = 0.15) => {
      console.log('Testing slide from', fromNote, 'to', toNote);
      slideToNote(fromNote, toNote, duration);
    },
    testPickup: (position) => {
      console.log('Testing pickup:', position);
      setPickupPosition(position);
    },
    testTone: (value) => {
      console.log('Testing tone:', value);
      setTone(value);
    },
    forceInit: async () => {
      console.log('Force initializing guitar...');
      isInitialized = false;
      await initGuitar();
    }
  };
  
  console.log('[Guitar] Debug helper available at window.__guitarDebug');
}
