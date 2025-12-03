import { useState, useEffect, useRef, useCallback } from 'react';

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
   * Enhanced Drum Synthesis - More realistic drum sounds
   * 
   * @param {string} drumType - Drum type ('kick', 'snare', 'hihat', 'crash', etc.)
   * @param {number} [when] - Optional scheduled time in AudioContext time (defaults to now)
   */
  const playDrumSound = useCallback((drumType, when = null) => {
    if (!audioContextRef.current) return;

    const ctx = audioContextRef.current;
    const now = when !== null ? when : ctx.currentTime;
    const volume = instrumentVolumesRef.current.DRUMS || 0.8;

    switch (drumType) {
      case 'kick': {
        // Two-stage kick: punch + sub bass
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        const gain2 = ctx.createGain();
        
        osc1.frequency.setValueAtTime(150, now);
        osc1.frequency.exponentialRampToValueAtTime(40, now + 0.15);
        osc2.frequency.setValueAtTime(80, now);
        osc2.frequency.exponentialRampToValueAtTime(30, now + 0.2);
        
        gain1.gain.setValueAtTime(volume * 0.9, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        gain2.gain.setValueAtTime(volume * 0.7, now);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        
        osc1.connect(gain1).connect(masterGainRef.current);
        osc2.connect(gain2).connect(masterGainRef.current);
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.3);
        osc2.stop(now + 0.4);
        break;
      }
      case 'snare': {
        // Tone + noise for realistic snare
        const osc = ctx.createOscillator();
        const noise = ctx.createBufferSource();
        const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        noise.buffer = noiseBuffer;
        
        const gainTone = ctx.createGain();
        const gainNoise = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        
        osc.type = 'triangle';
        osc.frequency.value = 180;
        filter.type = 'highpass';
        filter.frequency.value = 1000;
        
        gainTone.gain.setValueAtTime(volume * 0.4, now);
        gainTone.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        gainNoise.gain.setValueAtTime(volume * 0.6, now);
        gainNoise.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        
        osc.connect(gainTone).connect(masterGainRef.current);
        noise.connect(filter).connect(gainNoise).connect(masterGainRef.current);
        osc.start(now);
        noise.start(now);
        osc.stop(now + 0.2);
        noise.stop(now + 0.2);
        break;
      }
      case 'hihat': {
        // Filtered white noise for hi-hat
        const noise = ctx.createBufferSource();
        const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
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
        
        gain.gain.setValueAtTime(volume * 0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        
        noise.connect(filter).connect(gain).connect(masterGainRef.current);
        noise.start(now);
        noise.stop(now + 0.1);
        break;
      }
      case 'crash': {
        // Long filtered noise
        const noise = ctx.createBufferSource();
        const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
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
        
        gain.gain.setValueAtTime(volume * 0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
        
        noise.connect(filter).connect(gain).connect(masterGainRef.current);
        noise.start(now);
        noise.stop(now + 2);
        break;
      }
      default:
        // Tom sound
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
        gain.gain.setValueAtTime(volume * 0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain).connect(masterGainRef.current);
        osc.start(now);
        osc.stop(now + 0.4);
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

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * 0.4, now + 0.01);
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

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * 0.5, now + 0.01);
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

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * 0.4, now + 0.005);
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
  }, [resumeAudioContext, playDrumSound, playBassSynth, playEPianoSynth, playGuitarSynth]);

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
  }, [resumeAudioContext, playDrumSound, playBassSynth, playEPianoSynth, playGuitarSynth]);

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