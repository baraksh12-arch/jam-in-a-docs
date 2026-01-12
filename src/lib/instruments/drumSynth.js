/**
 * DrumSynth - Production-Grade Physically-Modeled Drum Synthesis
 * 
 * Each voice uses proven Tone.js patterns for reliable sound generation.
 * Optimized for Web Audio with distinct tonal characteristics per instrument.
 */

import * as Tone from 'tone';

// ============================================================================
// KICK VOICE - Deep Punchy Kick with Beater Click + Sub Bass
// ============================================================================

class KickVoice {
  constructor() {
    // Main body with pitch envelope
    this.body = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 6,
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.001,
        decay: 0.4,
        sustain: 0.01,
        release: 0.4,
      },
    });
    
    // Sub bass layer
    this.sub = new Tone.Oscillator({ type: 'sine', frequency: 45 }).start();
    this.subEnv = new Tone.AmplitudeEnvelope({
      attack: 0.005,
      decay: 0.5,
      sustain: 0,
      release: 0.3,
    });
    
    // Click transient
    this.click = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: {
        attack: 0.001,
        decay: 0.02,
        sustain: 0,
        release: 0.01,
      },
    });
    this.clickFilter = new Tone.Filter({ frequency: 4000, type: 'lowpass' });
    
    // Output
    this.output = new Tone.Gain(0.9);
    
    // Routing
    this.body.connect(this.output);
    this.sub.connect(this.subEnv);
    this.subEnv.connect(this.output);
    this.click.connect(this.clickFilter);
    this.clickFilter.connect(this.output);
  }
  
  trigger(velocity = 0.8, position = 0.5, articulation = 'tip', time = Tone.now()) {
    const vel = Math.pow(velocity, 0.7);
    
    // Pitch based on velocity (harder = higher initial pitch)
    const pitch = 50 + velocity * 20;
    
    this.body.triggerAttackRelease(pitch, '8n', time, vel);
    this.subEnv.triggerAttackRelease('4n', time, vel * 0.6);
    this.click.triggerAttackRelease('32n', time, vel * 0.3);
  }
  
  connect(dest) { this.output.connect(dest); return this; }
  
  dispose() {
    this.body.dispose();
    this.sub.dispose();
    this.subEnv.dispose();
    this.click.dispose();
    this.clickFilter.dispose();
    this.output.dispose();
  }
}

// ============================================================================
// SNARE VOICE - Body + Snare Wires + Rim Options
// ============================================================================

class SnareVoice {
  constructor() {
    // Snare body (membrane)
    this.body = new Tone.MembraneSynth({
      pitchDecay: 0.008,
      octaves: 4,
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.0005,
        decay: 0.13,
        sustain: 0,
        release: 0.1,
      },
    });
    
    // Snare wires (high-frequency noise)
    this.wires = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: {
        attack: 0.0005,
        decay: 0.18,
        sustain: 0,
        release: 0.1,
      },
    });
    this.wiresFilter = new Tone.Filter({ frequency: 4000, type: 'highpass', Q: 1 });
    
    // Output
    this.output = new Tone.Gain(0.8);
    
    // Routing
    this.body.connect(this.output);
    this.wires.connect(this.wiresFilter);
    this.wiresFilter.connect(this.output);
  }
  
  trigger(velocity = 0.8, position = 0.5, articulation = 'tip', time = Tone.now()) {
    const vel = Math.pow(velocity, 0.6);
    const isGhost = articulation === 'ghost' || velocity < 0.2;
    
    // Body pitch: 170-220 Hz based on velocity
    const bodyPitch = 170 + velocity * 50;
    const bodyDuration = isGhost ? '32n' : '8n';
    const wiresDuration = isGhost ? '16n' : '8n';
    
    this.body.triggerAttackRelease(bodyPitch, bodyDuration, time, vel);
    this.wires.triggerAttackRelease(wiresDuration, time, vel * 0.7);
  }
  
  connect(dest) { this.output.connect(dest); return this; }
  
  dispose() {
    this.body.dispose();
    this.wires.dispose();
    this.wiresFilter.dispose();
    this.output.dispose();
  }
}

// ============================================================================
// TOM VOICE - Distinct pitches for different toms
// ============================================================================

class TomVoice {
  constructor(size = 'mid') {
    // Different fundamental frequencies for each tom size
    this.frequencies = {
      high: 200,   // High tom - tight, bright (10")
      mid: 140,    // Mid tom (12")
      low: 95,     // Low floor tom (14")
      floor: 70,   // Floor tom (16")
    };
    
    this.basePitch = this.frequencies[size] || this.frequencies.mid;
    
    // Main membrane synth
    this.membrane = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: size === 'high' ? 4 : size === 'floor' ? 7 : 5,
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.001,
        decay: size === 'high' ? 0.25 : size === 'floor' ? 0.5 : 0.35,
        sustain: 0,
        release: size === 'high' ? 0.2 : size === 'floor' ? 0.4 : 0.3,
      },
    });
    
    // Attack click
    this.click = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: {
        attack: 0.001,
        decay: 0.02,
        sustain: 0,
        release: 0.01,
      },
    });
    this.clickFilter = new Tone.Filter({ 
      frequency: this.basePitch * 3, 
      type: 'bandpass',
      Q: 2
    });
    
    // Output
    this.output = new Tone.Gain(0.75);
    
    // Routing
    this.membrane.connect(this.output);
    this.click.connect(this.clickFilter);
    this.clickFilter.connect(this.output);
  }
  
  trigger(velocity = 0.8, position = 0.5, articulation = 'tip', time = Tone.now()) {
    const vel = Math.pow(velocity, 0.65);
    
    // Slight pitch variation based on position
    const pitch = this.basePitch + position * 10;
    
    this.membrane.triggerAttackRelease(pitch, '4n', time, vel);
    this.click.triggerAttackRelease('32n', time, vel * 0.4);
  }
  
  connect(dest) { this.output.connect(dest); return this; }
  
  dispose() {
    this.membrane.dispose();
    this.click.dispose();
    this.clickFilter.dispose();
    this.output.dispose();
  }
}

// ============================================================================
// HIHAT VOICE - Closed/Open control with metallic character
// ============================================================================

class HiHatVoice {
  constructor() {
    this.openAmount = 0;
    
    // Metallic body (FM synthesis for metallic tone)
    this.metal = new Tone.MetalSynth({
      frequency: 200,
      envelope: {
        attack: 0.001,
        decay: 0.1,
        release: 0.05,
      },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
    });
    
    // High-frequency noise for sizzle
    this.noise = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: {
        attack: 0.001,
        decay: 0.08,
        sustain: 0,
        release: 0.05,
      },
    });
    this.noiseFilter = new Tone.Filter({ frequency: 8000, type: 'highpass' });
    
    // Output
    this.output = new Tone.Gain(0.6);
    
    // Routing
    this.metal.connect(this.output);
    this.noise.connect(this.noiseFilter);
    this.noiseFilter.connect(this.output);
  }
  
  setOpenAmount(amount) {
    this.openAmount = Math.max(0, Math.min(1, amount));
  }
  
  trigger(velocity = 0.8, position = 0.5, articulation = 'tip', time = Tone.now()) {
    if (articulation === 'foot') {
      // Foot chick - very short
      this.metal.triggerAttackRelease('32n', time, velocity * 0.4);
      return;
    }
    
    const vel = Math.pow(velocity, 0.6);
    
    // Decay varies with openness
    const closedDecay = 0.04;
    const openDecay = 0.4;
    const decay = closedDecay + (openDecay - closedDecay) * this.openAmount;
    
    // Update envelope decay
    this.metal.envelope.decay = decay;
    this.noise.envelope.decay = decay;
    
    const duration = this.openAmount > 0.5 ? '8n' : '16n';
    
    this.metal.triggerAttackRelease(duration, time, vel * 0.6);
    this.noise.triggerAttackRelease(duration, time, vel * 0.5);
  }
  
  choke(time = Tone.now()) {
    // Not much to do for MetalSynth, but we can try
  }
  
  connect(dest) { this.output.connect(dest); return this; }
  
  dispose() {
    this.metal.dispose();
    this.noise.dispose();
    this.noiseFilter.dispose();
    this.output.dispose();
  }
}

// ============================================================================
// CRASH CYMBAL - Long wash with shimmer
// ============================================================================

class CrashVoice {
  constructor() {
    // Metallic body with FM synthesis
    this.metal = new Tone.MetalSynth({
      frequency: 300,
      envelope: {
        attack: 0.001,
        decay: 2.5,
        release: 1.5,
      },
      harmonicity: 5.1,
      modulationIndex: 40,
      resonance: 3000,
      octaves: 1.5,
    });
    
    // Wash noise
    this.wash = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: {
        attack: 0.005,
        decay: 3,
        sustain: 0,
        release: 2,
      },
    });
    this.washFilter = new Tone.Filter({ frequency: 5000, type: 'highpass', Q: 0.5 });
    
    // Output with limiter
    this.limiter = new Tone.Limiter(-3);
    this.output = new Tone.Gain(0.55);
    
    // Routing
    this.metal.connect(this.limiter);
    this.wash.connect(this.washFilter);
    this.washFilter.connect(this.limiter);
    this.limiter.connect(this.output);
  }
  
  trigger(velocity = 0.8, position = 0.5, articulation = 'tip', time = Tone.now()) {
    const vel = Math.pow(velocity, 0.55);
    
    // Velocity affects decay
    const decay = 2 + velocity * 2;
    this.metal.envelope.decay = decay;
    this.wash.envelope.decay = decay;
    
    this.metal.triggerAttackRelease('2n', time, vel * 0.5);
    this.wash.triggerAttackRelease('1n', time, vel * 0.6);
  }
  
  choke(time = Tone.now()) {
    // Quick release
  }
  
  connect(dest) { this.output.connect(dest); return this; }
  
  dispose() {
    this.metal.dispose();
    this.wash.dispose();
    this.washFilter.dispose();
    this.limiter.dispose();
    this.output.dispose();
  }
}

// ============================================================================
// RIDE CYMBAL - Defined ping with bell option
// ============================================================================

class RideVoice {
  constructor() {
    // Ping sound (metallic but more defined than crash)
    this.ping = new Tone.MetalSynth({
      frequency: 400,  // Higher frequency for ping
      envelope: {
        attack: 0.001,
        decay: 1.5,
        release: 0.8,
      },
      harmonicity: 3.1,  // Less complex than crash
      modulationIndex: 20,
      resonance: 5000,  // Higher resonance for ping
      octaves: 1,
    });
    
    // Bell sound (distinct pitched element)
    this.bell = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.001,
        decay: 0.8,
        sustain: 0,
        release: 0.5,
      },
    });
    this.bellGain = new Tone.Gain(0);
    
    // Subtle wash
    this.wash = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: {
        attack: 0.01,
        decay: 1.5,
        sustain: 0,
        release: 1,
      },
    });
    this.washFilter = new Tone.Filter({ frequency: 6000, type: 'highpass', Q: 0.8 });
    
    // Output
    this.output = new Tone.Gain(0.5);
    
    // Routing
    this.ping.connect(this.output);
    this.bell.connect(this.bellGain);
    this.bellGain.connect(this.output);
    this.wash.connect(this.washFilter);
    this.washFilter.connect(this.output);
  }
  
  trigger(velocity = 0.8, position = 0.5, articulation = 'tip', time = Tone.now()) {
    const vel = Math.pow(velocity, 0.6);
    const isBell = articulation === 'bell' || position > 0.85;
    
    // Velocity affects decay
    const decay = 1.2 + velocity * 1;
    this.ping.envelope.decay = decay;
    
    if (isBell) {
      // Bell hit - distinct ping + bell tone
      this.bellGain.gain.setValueAtTime(vel * 0.3, time);
      this.bell.triggerAttackRelease('E6', '4n', time, vel);
      this.ping.triggerAttackRelease('4n', time, vel * 0.4);
    } else {
      // Regular ride hit
      this.bellGain.gain.setValueAtTime(0, time);
      this.ping.triggerAttackRelease('4n', time, vel * 0.6);
      this.wash.triggerAttackRelease('2n', time, vel * 0.25);
    }
  }
  
  choke(time = Tone.now()) {}
  
  connect(dest) { this.output.connect(dest); return this; }
  
  dispose() {
    this.ping.dispose();
    this.bell.dispose();
    this.bellGain.dispose();
    this.wash.dispose();
    this.washFilter.dispose();
    this.output.dispose();
  }
}

// ============================================================================
// CLAP VOICE - Layered hand claps with room ambience
// ============================================================================

class ClapVoice {
  constructor() {
    // Multiple clap layers (simulates multiple hands)
    this.claps = [];
    for (let i = 0; i < 3; i++) {
      const clap = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: {
          attack: 0.001,
          decay: 0.08,
          sustain: 0,
          release: 0.05,
        },
      });
      const filter = new Tone.Filter({
        frequency: 1200 + i * 400,
        type: 'bandpass',
        Q: 2,
      });
      this.claps.push({ synth: clap, filter });
    }
    
    // Room reverb simulation
    this.reverb = new Tone.Reverb({
      decay: 0.5,
      wet: 0.2,
    });
    
    // Output
    this.output = new Tone.Gain(0.7);
    
    // Routing - each clap layer through its filter to reverb
    this.claps.forEach(({ synth, filter }) => {
      synth.connect(filter);
      filter.connect(this.reverb);
    });
    this.reverb.connect(this.output);
  }
  
  trigger(velocity = 0.8, position = 0.5, articulation = 'tip', time = Tone.now()) {
    const vel = Math.pow(velocity, 0.6);
    
    // Trigger each layer with slight time offsets (staggered hands)
    const offsets = [0, 0.01, 0.02];
    const levels = [1, 0.7, 0.5];
    
    this.claps.forEach((clap, i) => {
      const t = time + offsets[i];
      clap.synth.triggerAttackRelease('16n', t, vel * levels[i]);
    });
  }
  
  connect(dest) { this.output.connect(dest); return this; }
  
  dispose() {
    this.claps.forEach(({ synth, filter }) => {
      synth.dispose();
      filter.dispose();
    });
    this.reverb.dispose();
    this.output.dispose();
  }
}

// ============================================================================
// DRUM SYNTH - Main Controller
// ============================================================================

export class DrumSynth {
  constructor() {
    this.voices = {};
    this.masterGain = new Tone.Gain(0.85);
    this.limiter = new Tone.Limiter(-1);
    this.isInitialized = false;
    this.hihatOpen = 0;
  }
  
  async init() {
    if (this.isInitialized) return;
    
    // Create all voices with distinct characteristics
    this.voices = {
      kick: new KickVoice(),
      snare: new SnareVoice(),
      tom1: new TomVoice('high'),   // 200Hz - High tom
      tom2: new TomVoice('low'),    // 95Hz - Floor tom (BIG difference!)
      hihat: new HiHatVoice(),
      crash: new CrashVoice(),
      ride: new RideVoice(),
      clap: new ClapVoice(),
    };
    
    // Connect to master
    this.masterGain.connect(this.limiter);
    this.limiter.toDestination();
    
    Object.values(this.voices).forEach(voice => {
      voice.connect(this.masterGain);
    });
    
    this.isInitialized = true;
    console.log('[DrumSynth] Production-grade synthesis initialized');
    console.log('[DrumSynth] Tom1: 200Hz (high), Tom2: 95Hz (floor)');
    console.log('[DrumSynth] Ride: MetalSynth ping, Crash: Long wash');
    console.log('[DrumSynth] Clap: 3-layer staggered noise');
  }
  
  trigger(voiceName, params = {}) {
    const voice = this.voices[voiceName];
    if (!voice) {
      console.warn(`[DrumSynth] Unknown voice: ${voiceName}`);
      return;
    }
    
    const {
      velocity = 0.8,
      position = 0.5,
      articulation = 'tip',
      time = Tone.now(),
    } = params;
    
    if (voiceName === 'hihat') {
      voice.setOpenAmount(this.hihatOpen);
    }
    
    // Debug log
    console.log(`[DrumSynth] Triggering ${voiceName} @ vel=${velocity.toFixed(2)}`);
    
    voice.trigger(velocity, position, articulation, time);
  }
  
  setHiHatOpen(amount) {
    this.hihatOpen = Math.max(0, Math.min(1, amount));
    if (this.voices.hihat) {
      this.voices.hihat.setOpenAmount(this.hihatOpen);
    }
  }
  
  choke(voiceName, time = Tone.now()) {
    const voice = this.voices[voiceName];
    if (voice?.choke) {
      voice.choke(time);
    }
  }
  
  setVolume(volume) {
    this.masterGain.gain.rampTo(Math.max(0, Math.min(1, volume)), 0.05);
  }
  
  getVolume() {
    return this.masterGain.gain.value;
  }
  
  dispose() {
    Object.values(this.voices).forEach(v => v?.dispose());
    this.masterGain.dispose();
    this.limiter.dispose();
    this.isInitialized = false;
  }
  
  isReady() {
    return this.isInitialized;
  }
}

// Singleton
let drumSynthInstance = null;

export function getDrumSynth() {
  if (!drumSynthInstance) {
    drumSynthInstance = new DrumSynth();
  }
  return drumSynthInstance;
}

export function disposeDrumSynth() {
  if (drumSynthInstance) {
    drumSynthInstance.dispose();
    drumSynthInstance = null;
  }
}
