import { useState, useEffect, useRef, useCallback } from 'react';
import { CURRENT_LATENCY_MODE, LATENCY_MODES } from '@/config/latencyMode';

/**
 * Debug flag for latency mode logging
 */
const DEBUG_LATENCY = false;

/**
 * Debug flag for drum polyphony logging
 * Set to true to inspect voice creation and stealing
 */
const DEBUG_DRUMS = false;

/**
 * Maximum number of simultaneous drum voices (polyphony limit)
 * Prevents unbounded node growth during fast patterns
 */
const MAX_DRUM_VOICES = 32;

/**
 * Enhanced Web Audio Engine Hook
 * Implements realistic synthesis for Drums, Bass, Electric Piano, and Guitar
 */

export function useAudioEngine() {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const audioContextRef = useRef(null);
  const masterGainRef = useRef(null);
  const instrumentVolumesRef = useRef({
    DRUMS: 0.8,
    BASS: 0.7,
    EP: 0.7,
    GUITAR: 0.7
  });
  const activeNotesRef = useRef(new Map());
  const metronomeIntervalRef = useRef(null);
  const nextMetronomeTimeRef = useRef(0);
  const hasWarmedUpRef = useRef(false);
  
  // Drum voice tracking for polyphony management
  // Each voice is { nodes: [...], stopTime: number, drumType: string }
  const drumVoicesRef = useRef([]);

  useEffect(() => {
    const initAudio = async () => {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioContext();
        
        masterGainRef.current = audioContextRef.current.createGain();
        masterGainRef.current.connect(audioContextRef.current.destination);
        
        setTimeout(() => {
          setIsReady(true);
          setIsLoading(false);
        }, 300);
        
      } catch (error) {
        console.error('Failed to initialize audio:', error);
        setIsLoading(false);
      }
    };

    initAudio();

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (metronomeIntervalRef.current) {
        clearInterval(metronomeIntervalRef.current);
      }
    };
  }, []);

  const resumeAudioContext = useCallback(async () => {
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
  }, []);

  /**
   * Warmup audio engine for ULTRA_LOW_LATENCY mode
   * Pre-creates nodes and triggers very low-level sounds to wake up the audio graph
   * This ensures the first real note doesn't incur node creation or context resume latency
   */
  const warmupAudioEngine = useCallback(() => {
    if (!audioContextRef.current || hasWarmedUpRef.current) return;
    
    const ctx = audioContextRef.current;
    const now = ctx.currentTime;
    const warmupGain = 0.0001; // Very low, inaudible level
    const warmupDuration = 0.005; // Very short duration (5ms)

    try {
      // Ensure context is resumed
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Warm up drums - trigger a very quiet kick
      const kickOsc = ctx.createOscillator();
      const kickGain = ctx.createGain();
      kickOsc.frequency.setValueAtTime(150, now);
      kickGain.gain.setValueAtTime(warmupGain, now);
      kickGain.gain.exponentialRampToValueAtTime(0.00001, now + warmupDuration);
      kickOsc.connect(kickGain).connect(masterGainRef.current);
      kickOsc.start(now);
      kickOsc.stop(now + warmupDuration);

      // Warm up BASS - trigger a very quiet note
      const bassFreq = 440 * Math.pow(2, (60 - 69) / 12); // C4
      const bassOsc1 = ctx.createOscillator();
      const bassGain = ctx.createGain();
      bassOsc1.type = 'sawtooth';
      bassOsc1.frequency.value = bassFreq;
      bassGain.gain.setValueAtTime(warmupGain, now);
      bassGain.gain.exponentialRampToValueAtTime(0.00001, now + warmupDuration);
      bassOsc1.connect(bassGain).connect(masterGainRef.current);
      bassOsc1.start(now);
      bassOsc1.stop(now + warmupDuration);

      // Warm up EP - trigger a very quiet note
      const epFreq = 440 * Math.pow(2, (60 - 69) / 12); // C4
      const epCarrier = ctx.createOscillator();
      const epGain = ctx.createGain();
      epCarrier.type = 'sine';
      epCarrier.frequency.value = epFreq;
      epGain.gain.setValueAtTime(warmupGain, now);
      epGain.gain.exponentialRampToValueAtTime(0.00001, now + warmupDuration);
      epCarrier.connect(epGain).connect(masterGainRef.current);
      epCarrier.start(now);
      epCarrier.stop(now + warmupDuration);

      // Warm up GUITAR - trigger a very quiet note
      const guitarFreq = 440 * Math.pow(2, (60 - 69) / 12); // C4
      const guitarOsc = ctx.createOscillator();
      const guitarGain = ctx.createGain();
      guitarOsc.type = 'sawtooth';
      guitarOsc.frequency.value = guitarFreq;
      guitarGain.gain.setValueAtTime(warmupGain, now);
      guitarGain.gain.exponentialRampToValueAtTime(0.00001, now + warmupDuration);
      guitarOsc.connect(guitarGain).connect(masterGainRef.current);
      guitarOsc.start(now);
      guitarOsc.stop(now + warmupDuration);

      hasWarmedUpRef.current = true;
      
      if (DEBUG_LATENCY) {
        console.log('[AudioEngine] Warmup completed (ULTRA_LOW_LATENCY).');
      }
    } catch (error) {
      console.warn('[AudioEngine] Warmup error (non-fatal):', error);
    }
  }, []);

  /**
   * Enhanced Drum Synthesis - More realistic drum sounds
   * 
   * Optimized for fast patterns (16th notes and denser):
   * - Per-hit voices (no shared source nodes)
   * - Polyphony management with voice stealing
   * - Short, punchy envelopes for fast patterns
   * - ULTRA mode uses fastest possible attack/decay
   * 
   * @param {string} drumType - Drum type ('kick', 'snare', 'hihat', 'crash', etc.)
   * @param {number} [when] - Optional scheduled time in AudioContext time (defaults to now)
   */
  const playDrumSound = useCallback((drumType, when = null) => {
    if (!audioContextRef.current) return;

    const ctx = audioContextRef.current;
    const now = when !== null ? when : ctx.currentTime;
    const volume = instrumentVolumesRef.current.DRUMS || 0.8;
    const isUltraMode = CURRENT_LATENCY_MODE === LATENCY_MODES.ULTRA;

    // Polyphony management: check if we need to steal a voice
    const activeVoices = drumVoicesRef.current.filter(v => v.stopTime > now);
    if (activeVoices.length >= MAX_DRUM_VOICES) {
      // Voice stealing: find the oldest voice (earliest stopTime) and stop it
      const oldestVoice = activeVoices.reduce((oldest, current) => 
        current.stopTime < oldest.stopTime ? current : oldest
      );
      
      // Stop and disconnect all nodes in the stolen voice
      oldestVoice.nodes.forEach(node => {
        try {
          if (node.stop) node.stop();
          if (node.disconnect) node.disconnect();
        } catch (e) {
          // Node may already be stopped/disconnected, ignore
        }
      });
      
      // Remove from tracking
      drumVoicesRef.current = drumVoicesRef.current.filter(v => v !== oldestVoice);
      
      if (DEBUG_DRUMS) {
        console.log('[Drums] Voice stolen', { 
          type: oldestVoice.drumType, 
          activeVoices: activeVoices.length - 1 
        });
      }
    }

    // Track all nodes created for this voice
    const voiceNodes = [];
    let stopTime = now;

    // ULTRA mode: ultra-fast attack (0.001s), optimized decay for fast patterns
    // SYNCED mode: slightly longer attack/decay for smoother sound
    const attackTime = isUltraMode ? 0.001 : 0.001; // Both use fast attack
    const masterGain = masterGainRef.current;

    switch (drumType) {
      case 'kick': {
        // Two-stage kick: punch + sub bass
        // Optimized for fast patterns: shorter decay
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        const gain2 = ctx.createGain();
        voiceNodes.push(osc1, osc2, gain1, gain2);
        
        osc1.frequency.setValueAtTime(150, now);
        osc1.frequency.exponentialRampToValueAtTime(40, now + 0.1); // Shorter: 0.1s (was 0.15s)
        osc2.frequency.setValueAtTime(80, now);
        osc2.frequency.exponentialRampToValueAtTime(30, now + 0.15); // Shorter: 0.15s (was 0.2s)
        
        gain1.gain.setValueAtTime(volume * 0.9, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.1); // Shorter decay
        gain2.gain.setValueAtTime(volume * 0.7, now);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.2); // Shorter: 0.2s (was 0.3s)
        
        osc1.connect(gain1).connect(masterGain);
        osc2.connect(gain2).connect(masterGain);
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.2);
        osc2.stop(now + 0.25);
        stopTime = now + 0.25;
        break;
      }
      case 'snare': {
        // Tone + noise for realistic snare
        // Optimized for fast rolls: shorter decay
        const osc = ctx.createOscillator();
        const noise = ctx.createBufferSource();
        const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate); // Shorter: 0.1s (was 0.2s)
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        noise.buffer = noiseBuffer;
        
        const gainTone = ctx.createGain();
        const gainNoise = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        voiceNodes.push(osc, noise, gainTone, gainNoise, filter);
        
        osc.type = 'triangle';
        osc.frequency.value = 180;
        filter.type = 'highpass';
        filter.frequency.value = 1000;
        
        gainTone.gain.setValueAtTime(volume * 0.4, now);
        gainTone.gain.exponentialRampToValueAtTime(0.001, now + 0.1); // Shorter: 0.1s (was 0.15s)
        gainNoise.gain.setValueAtTime(volume * 0.6, now);
        gainNoise.gain.exponentialRampToValueAtTime(0.001, now + 0.1); // Shorter: 0.1s (was 0.15s)
        
        osc.connect(gainTone).connect(masterGain);
        noise.connect(filter).connect(gainNoise).connect(masterGain);
        osc.start(now);
        noise.start(now);
        osc.stop(now + 0.1);
        noise.stop(now + 0.1);
        stopTime = now + 0.1;
        break;
      }
      case 'hihat': {
        // Filtered white noise for hi-hat
        // Already short, but ensure it's optimized for 16th notes
        const noise = ctx.createBufferSource();
        const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.03, ctx.sampleRate); // Shorter: 0.03s (was 0.05s)
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        noise.buffer = noiseBuffer;
        
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 7000;
        filter.Q.value = 1;
        voiceNodes.push(noise, gain, filter);
        
        gain.gain.setValueAtTime(volume * 0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03); // Shorter: 0.03s (was 0.05s)
        
        noise.connect(filter).connect(gain).connect(masterGain);
        noise.start(now);
        noise.stop(now + 0.05);
        stopTime = now + 0.05;
        break;
      }
      case 'crash': {
        // Long filtered noise (crash needs longer decay for realism)
        // Keep longer but still allow overlapping hits
        const noise = ctx.createBufferSource();
        const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate); // Slightly shorter: 1.5s (was 2s)
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        noise.buffer = noiseBuffer;
        
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 5000;
        filter.Q.value = 0.5;
        voiceNodes.push(noise, gain, filter);
        
        gain.gain.setValueAtTime(volume * 0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2); // Slightly shorter: 1.2s (was 1.5s)
        
        noise.connect(filter).connect(gain).connect(masterGain);
        noise.start(now);
        noise.stop(now + 1.5);
        stopTime = now + 1.5;
        break;
      }
      default:
        // Tom sound (tom1, tom2, ride, clap, etc.)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        voiceNodes.push(osc, gain);
        
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.1); // Shorter: 0.1s (was 0.15s)
        gain.gain.setValueAtTime(volume * 0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2); // Shorter: 0.2s (was 0.3s)
        
        osc.connect(gain).connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.25);
        stopTime = now + 0.25;
    }

    // Track this voice for polyphony management
    const voice = {
      nodes: voiceNodes,
      stopTime: stopTime,
      drumType: drumType
    };
    drumVoicesRef.current.push(voice);

    // Cleanup: remove voice from tracking after it stops
    const cleanupDelay = (stopTime - now) * 1000 + 100; // Add 100ms buffer
    setTimeout(() => {
      drumVoicesRef.current = drumVoicesRef.current.filter(v => v !== voice);
    }, Math.max(0, cleanupDelay));

    if (DEBUG_DRUMS) {
      console.log('[Drums] New voice', { 
        type: drumType, 
        activeVoices: activeVoices.length + 1,
        stopTime: stopTime.toFixed(3)
      });
    }
  }, []);

  /**
   * Enhanced Bass Synthesis - Fat analog-style bass
   * 
   * @param {number} frequency - Frequency in Hz
   * @param {number} duration - Duration in seconds
   * @param {number} [when] - Optional scheduled time in AudioContext time (defaults to now)
   */
  const playBassSynth = useCallback((frequency, duration, when = null) => {
    if (!audioContextRef.current) return;

    const ctx = audioContextRef.current;
    const now = when !== null ? when : ctx.currentTime;
    const volume = instrumentVolumesRef.current.BASS || 0.7;
    const isUltraMode = CURRENT_LATENCY_MODE === LATENCY_MODES.ULTRA;

    // Dual oscillators for fat bass
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const osc3 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc1.type = 'sawtooth';
    osc1.frequency.value = frequency;
    osc2.type = 'square';
    osc2.frequency.value = frequency * 0.5; // Sub-oscillator
    osc3.type = 'sawtooth';
    osc3.frequency.value = frequency * 1.01; // Slight detune
    osc3.detune.value = 10;

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(frequency * 4, now);
    filter.frequency.exponentialRampToValueAtTime(frequency * 1.5, now + 0.1);
    filter.Q.value = 3;

    // ULTRA mode: ultra-fast attack (0.001s), SYNCED mode: normal attack (0.01s)
    const attackTime = isUltraMode ? 0.001 : 0.01;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * 0.4, now + attackTime);
    gain.gain.exponentialRampToValueAtTime(volume * 0.1, now + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    osc3.connect(filter);
    filter.connect(gain);
    gain.connect(masterGainRef.current);

    osc1.start(now);
    osc2.start(now);
    osc3.start(now);
    osc1.stop(now + duration);
    osc2.stop(now + duration);
    osc3.stop(now + duration);
  }, []);

  /**
   * Enhanced Electric Piano Synthesis - Bell-like EP sound
   * 
   * @param {number} frequency - Frequency in Hz
   * @param {number} duration - Duration in seconds
   * @param {number} [when] - Optional scheduled time in AudioContext time (defaults to now)
   */
  const playEPianoSynth = useCallback((frequency, duration, when = null) => {
    if (!audioContextRef.current) return;

    const ctx = audioContextRef.current;
    const now = when !== null ? when : ctx.currentTime;
    const volume = instrumentVolumesRef.current.EP || 0.7;
    const isUltraMode = CURRENT_LATENCY_MODE === LATENCY_MODES.ULTRA;

    // FM-style electric piano
    const carrier = ctx.createOscillator();
    const modulator = ctx.createOscillator();
    const modulatorGain = ctx.createGain();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    carrier.type = 'sine';
    carrier.frequency.value = frequency;
    modulator.type = 'sine';
    modulator.frequency.value = frequency * 3.5;

    modulatorGain.gain.setValueAtTime(200, now);
    modulatorGain.gain.exponentialRampToValueAtTime(1, now + 0.3);

    filter.type = 'lowpass';
    filter.frequency.value = frequency * 8;

    // ULTRA mode: ultra-fast attack (0.001s), SYNCED mode: normal attack (0.01s)
    const attackTime = isUltraMode ? 0.001 : 0.01;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * 0.5, now + attackTime);
    gain.gain.exponentialRampToValueAtTime(volume * 0.2, now + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    modulator.connect(modulatorGain);
    modulatorGain.connect(carrier.frequency);
    carrier.connect(filter);
    filter.connect(gain);
    gain.connect(masterGainRef.current);

    carrier.start(now);
    modulator.start(now);
    carrier.stop(now + duration);
    modulator.stop(now + duration);
  }, []);

  /**
   * Enhanced Guitar Synthesis - Plucked string sound
   * 
   * @param {number} frequency - Frequency in Hz
   * @param {number} duration - Duration in seconds
   * @param {number} [when] - Optional scheduled time in AudioContext time (defaults to now)
   */
  const playGuitarSynth = useCallback((frequency, duration, when = null) => {
    if (!audioContextRef.current) return;

    const ctx = audioContextRef.current;
    const now = when !== null ? when : ctx.currentTime;
    const volume = instrumentVolumesRef.current.GUITAR || 0.7;
    const isUltraMode = CURRENT_LATENCY_MODE === LATENCY_MODES.ULTRA;

    // Karplus-Strong inspired guitar synthesis
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const osc3 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const distortion = ctx.createWaveShaper();

    // Multiple harmonics
    osc1.type = 'sawtooth';
    osc1.frequency.value = frequency;
    osc2.type = 'square';
    osc2.frequency.value = frequency * 2;
    osc3.type = 'triangle';
    osc3.frequency.value = frequency * 0.5;

    // Light distortion
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i - 128) / 128;
      curve[i] = Math.tanh(x * 2);
    }
    distortion.curve = curve;

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(frequency * 6, now);
    filter.frequency.exponentialRampToValueAtTime(frequency * 2, now + 0.2);
    filter.Q.value = 1;

    // ULTRA mode: ultra-fast attack (0.001s), SYNCED mode: normal attack (0.005s)
    const attackTime = isUltraMode ? 0.001 : 0.005;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * 0.4, now + attackTime);
    gain.gain.exponentialRampToValueAtTime(volume * 0.15, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    osc3.connect(filter);
    filter.connect(distortion);
    distortion.connect(gain);
    gain.connect(masterGainRef.current);

    osc1.start(now);
    osc2.start(now);
    osc3.start(now);
    osc1.stop(now + duration);
    osc2.stop(now + duration);
    osc3.stop(now + duration);
  }, []);

  /**
   * Main playNote function (immediate playback)
   */
  const playNote = useCallback((instrument, note, velocity = 100) => {
    resumeAudioContext();

    // ULTRA mode: Warm up audio engine on first real note
    if (CURRENT_LATENCY_MODE === LATENCY_MODES.ULTRA && !hasWarmedUpRef.current) {
      warmupAudioEngine();
    }

    if (instrument === 'DRUMS') {
      playDrumSound(note);
    } else {
      const frequency = 440 * Math.pow(2, (note - 69) / 12);
      const duration = 1.5;
      
      switch (instrument) {
        case 'BASS':
          playBassSynth(frequency, duration);
          break;
        case 'EP':
          playEPianoSynth(frequency, duration);
          break;
        case 'GUITAR':
          playGuitarSynth(frequency, duration);
          break;
      }
      
      const noteKey = `${instrument}_${note}`;
      activeNotesRef.current.set(noteKey, { frequency, instrument });
    }
  }, [resumeAudioContext, playDrumSound, playBassSynth, playEPianoSynth, playGuitarSynth, warmupAudioEngine]);

  /**
   * Play note at a specific AudioContext time (for scheduled remote notes)
   * 
   * @param {string} instrument - Instrument name
   * @param {number|string} note - MIDI note (0-127) or drum pad ID
   * @param {number} velocity - MIDI velocity (0-127)
   * @param {number} whenInSeconds - Target time in AudioContext time (seconds)
   */
  const playNoteAt = useCallback((instrument, note, velocity, whenInSeconds) => {
    if (!audioContextRef.current) return;
    
    resumeAudioContext();
    
    // ULTRA mode: Warm up audio engine on first real note
    if (CURRENT_LATENCY_MODE === LATENCY_MODES.ULTRA && !hasWarmedUpRef.current) {
      warmupAudioEngine();
    }
    
    // Ensure we're not scheduling in the past
    const ctx = audioContextRef.current;
    const now = ctx.currentTime;
    const when = Math.max(whenInSeconds, now);

    if (instrument === 'DRUMS') {
      playDrumSound(note, when);
    } else {
      const frequency = 440 * Math.pow(2, (note - 69) / 12);
      const duration = 1.5;
      
      switch (instrument) {
        case 'BASS':
          playBassSynth(frequency, duration, when);
          break;
        case 'EP':
          playEPianoSynth(frequency, duration, when);
          break;
        case 'GUITAR':
          playGuitarSynth(frequency, duration, when);
          break;
      }
      
      const noteKey = `${instrument}_${note}`;
      activeNotesRef.current.set(noteKey, { frequency, instrument });
    }
  }, [resumeAudioContext, playDrumSound, playBassSynth, playEPianoSynth, playGuitarSynth, warmupAudioEngine]);

  const stopNote = useCallback((instrument, note) => {
    const noteKey = `${instrument}_${note}`;
    activeNotesRef.current.delete(noteKey);
  }, []);

  /**
   * Stop note at a specific AudioContext time (for scheduled remote notes)
   * 
   * @param {string} instrument - Instrument name
   * @param {number|string} note - MIDI note (0-127) or drum pad ID
   * @param {number} whenInSeconds - Target time in AudioContext time (seconds)
   */
  const stopNoteAt = useCallback((instrument, note, whenInSeconds) => {
    if (!audioContextRef.current) return;
    
    const ctx = audioContextRef.current;
    const now = ctx.currentTime;
    const when = Math.max(whenInSeconds, now);
    
    // For now, just remove from active notes at the scheduled time
    // Most notes are short-lived, so this is mainly for cleanup
    const noteKey = `${instrument}_${note}`;
    setTimeout(() => {
      activeNotesRef.current.delete(noteKey);
    }, Math.max(0, (when - now) * 1000));
  }, []);

  const setInstrumentVolume = useCallback((instrument, value) => {
    instrumentVolumesRef.current[instrument] = Math.max(0, Math.min(1, value));
  }, []);

  const playMetronomeClick = useCallback((isDownbeat = false) => {
    if (!audioContextRef.current) return;

    const ctx = audioContextRef.current;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.frequency.value = isDownbeat ? 1200 : 800;
    osc.type = 'sine';
    gainNode.gain.value = 0.3;
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gainNode);
    gainNode.connect(masterGainRef.current);
    osc.start(now);
    osc.stop(now + 0.05);
  }, []);

  const startMetronome = useCallback((bpm) => {
    if (!audioContextRef.current) return;

    const beatInterval = 60 / bpm;
    let beatCount = 0;

    const scheduleMetronome = () => {
      const ctx = audioContextRef.current;
      const now = ctx.currentTime;

      while (nextMetronomeTimeRef.current < now + 0.1) {
        playMetronomeClick(beatCount % 4 === 0);
        nextMetronomeTimeRef.current += beatInterval;
        beatCount++;
      }
    };

    nextMetronomeTimeRef.current = audioContextRef.current.currentTime;
    metronomeIntervalRef.current = setInterval(scheduleMetronome, 25);
    scheduleMetronome();
  }, [playMetronomeClick]);

  const stopMetronome = useCallback(() => {
    if (metronomeIntervalRef.current) {
      clearInterval(metronomeIntervalRef.current);
      metronomeIntervalRef.current = null;
    }
  }, []);

  /**
   * Get AudioContext (for scheduling remote notes)
   * 
   * @returns {AudioContext|null} AudioContext or null if not initialized
   */
  const getAudioContext = useCallback(() => {
    return audioContextRef.current;
  }, []);

  return {
    isReady,
    isLoading,
    playNote,
    playNoteAt,
    stopNote,
    stopNoteAt,
    setInstrumentVolume,
    startMetronome,
    stopMetronome,
    getAudioContext
  };
}