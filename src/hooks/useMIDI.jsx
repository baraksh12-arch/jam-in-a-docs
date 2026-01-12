import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useMIDI Hook - Web MIDI API Integration
 * 
 * Premium MIDI controller support for both desktop and mobile with:
 * - Auto-detection of MIDI devices
 * - Real-time note input
 * - Velocity sensitivity
 * - Controller mapping (mod wheel, pitch bend, etc.)
 * - iOS/Android Bluetooth MIDI support
 */

// MIDI message types
const MIDI_NOTE_ON = 0x90;
const MIDI_NOTE_OFF = 0x80;
const MIDI_CONTROL_CHANGE = 0xB0;
const MIDI_PITCH_BEND = 0xE0;

// Common CC numbers
const CC_MOD_WHEEL = 1;
const CC_VOLUME = 7;
const CC_EXPRESSION = 11;
const CC_SUSTAIN = 64;

export function useMIDI({ onNoteOn, onNoteOff, onControlChange, enabled = true }) {
  const [isSupported, setIsSupported] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [devices, setDevices] = useState([]);
  const [activeDevice, setActiveDevice] = useState(null);
  const [error, setError] = useState(null);
  
  const midiAccessRef = useRef(null);
  const inputsRef = useRef([]);

  // Check MIDI support
  useEffect(() => {
    setIsSupported('requestMIDIAccess' in navigator);
  }, []);

  // Handle MIDI message
  const handleMIDIMessage = useCallback((event) => {
    const [status, data1, data2] = event.data;
    const channel = status & 0x0F;
    const messageType = status & 0xF0;

    switch (messageType) {
      case MIDI_NOTE_ON:
        // Note on with velocity 0 is treated as note off
        if (data2 > 0) {
          onNoteOn?.(data1, data2, channel);
        } else {
          onNoteOff?.(data1, channel);
        }
        break;
        
      case MIDI_NOTE_OFF:
        onNoteOff?.(data1, channel);
        break;
        
      case MIDI_CONTROL_CHANGE:
        onControlChange?.({
          controller: data1,
          value: data2,
          channel,
          // Named controllers
          isSustain: data1 === CC_SUSTAIN,
          isModWheel: data1 === CC_MOD_WHEEL,
          isVolume: data1 === CC_VOLUME,
          isExpression: data1 === CC_EXPRESSION
        });
        break;
        
      case MIDI_PITCH_BEND:
        // Pitch bend is 14-bit value (data1 = LSB, data2 = MSB)
        const bendValue = (data2 << 7) | data1;
        const normalizedBend = (bendValue - 8192) / 8192; // -1 to 1
        onControlChange?.({
          controller: 'pitchBend',
          value: normalizedBend,
          rawValue: bendValue,
          channel
        });
        break;
    }
  }, [onNoteOn, onNoteOff, onControlChange]);

  // Connect to a specific input
  const connectInput = useCallback((input) => {
    if (!input) return;
    
    input.onmidimessage = handleMIDIMessage;
    input.onstatechange = (e) => {
      console.log(`[MIDI] Input ${e.port.name} state: ${e.port.state}`);
      if (e.port.state === 'disconnected') {
        updateDevices();
      }
    };
    
    console.log(`[MIDI] Connected to: ${input.name}`);
  }, [handleMIDIMessage]);

  // Update device list
  const updateDevices = useCallback(() => {
    if (!midiAccessRef.current) return;
    
    const newDevices = [];
    const inputs = midiAccessRef.current.inputs.values();
    
    for (let input of inputs) {
      newDevices.push({
        id: input.id,
        name: input.name,
        manufacturer: input.manufacturer,
        state: input.state,
        connection: input.connection
      });
      
      // Auto-connect to all available inputs
      if (input.state === 'connected') {
        connectInput(input);
      }
    }
    
    setDevices(newDevices);
    setIsConnected(newDevices.length > 0);
    
    if (newDevices.length > 0 && !activeDevice) {
      setActiveDevice(newDevices[0]);
    }
  }, [connectInput, activeDevice]);

  // Initialize MIDI
  const initMIDI = useCallback(async () => {
    if (!isSupported || !enabled) return;
    
    try {
      setError(null);
      
      const access = await navigator.requestMIDIAccess({ sysex: false });
      midiAccessRef.current = access;
      
      // Handle device changes
      access.onstatechange = (e) => {
        console.log(`[MIDI] Port ${e.port.name} state changed: ${e.port.state}`);
        updateDevices();
      };
      
      updateDevices();
      console.log('[MIDI] Initialized successfully');
      
    } catch (err) {
      console.error('[MIDI] Initialization error:', err);
      setError(err.message || 'Failed to access MIDI devices');
      setIsConnected(false);
    }
  }, [isSupported, enabled, updateDevices]);

  // Initialize on mount
  useEffect(() => {
    if (enabled) {
      initMIDI();
    }
    
    return () => {
      // Cleanup
      inputsRef.current.forEach(input => {
        if (input) {
          input.onmidimessage = null;
          input.onstatechange = null;
        }
      });
    };
  }, [initMIDI, enabled]);

  // Select a specific device
  const selectDevice = useCallback((deviceId) => {
    if (!midiAccessRef.current) return;
    
    const input = midiAccessRef.current.inputs.get(deviceId);
    if (input) {
      setActiveDevice({
        id: input.id,
        name: input.name,
        manufacturer: input.manufacturer
      });
    }
  }, []);

  // Refresh device list
  const refreshDevices = useCallback(() => {
    updateDevices();
  }, [updateDevices]);

  return {
    isSupported,
    isConnected,
    devices,
    activeDevice,
    error,
    selectDevice,
    refreshDevices,
    initMIDI
  };
}

/**
 * useMIDIInstrument - Higher-level hook for instrument-specific MIDI handling
 * 
 * Enhanced for guitar with pitch bend and modulation support
 */
export function useMIDIInstrument({ 
  instrument, 
  audioEngine, 
  sendNote,
  onPitchBend,
  onModWheel,
  enabled = true 
}) {
  const [midiEnabled, setMidiEnabled] = useState(true);
  const activeNotesRef = useRef(new Set());
  const lastNoteRef = useRef(null);

  const handleNoteOn = useCallback((note, velocity, channel) => {
    if (!midiEnabled) return;
    
    // Play locally
    if (audioEngine) {
      audioEngine.playNote(instrument, note, velocity);
    }
    
    // Send to network
    if (sendNote) {
      sendNote(instrument, note, 'NOTE_ON', velocity);
    }
    
    activeNotesRef.current.add(note);
    lastNoteRef.current = note;
    
    // Haptic feedback on mobile
    if (navigator.vibrate) {
      navigator.vibrate(5);
    }
  }, [instrument, audioEngine, sendNote, midiEnabled]);

  const handleNoteOff = useCallback((note, channel) => {
    if (!midiEnabled) return;
    
    // Stop locally
    if (audioEngine) {
      audioEngine.stopNote(instrument, note);
    }
    
    // Send to network
    if (sendNote) {
      sendNote(instrument, note, 'NOTE_OFF', 0);
    }
    
    activeNotesRef.current.delete(note);
    
    // Clear last note if it was this one
    if (lastNoteRef.current === note) {
      lastNoteRef.current = null;
    }
  }, [instrument, audioEngine, sendNote, midiEnabled]);

  const handleControlChange = useCallback((cc) => {
    // Handle pitch bend - critical for guitar expression
    if (cc.controller === 'pitchBend') {
      // Convert -1 to 1 range to semitones (standard is ±2 semitones)
      const bendSemitones = cc.value * 2;
      
      if (onPitchBend) {
        onPitchBend(lastNoteRef.current, bendSemitones);
      }
      
      // For guitar, apply bend directly
      if (instrument === 'GUITAR') {
        import('@/lib/instruments/guitar').then(guitar => {
          guitar.bendNote(lastNoteRef.current, bendSemitones);
        });
      }
      return;
    }
    
    // Handle sustain pedal
    if (cc.isSustain) {
      console.log(`[MIDI] Sustain: ${cc.value > 63 ? 'ON' : 'OFF'}`);
    }
    
    // Handle mod wheel for vibrato (guitar) or expression
    if (cc.isModWheel) {
      const normalizedMod = cc.value / 127;
      
      if (onModWheel) {
        onModWheel(normalizedMod);
      }
      
      // For guitar, mod wheel controls vibrato
      if (instrument === 'GUITAR' && normalizedMod > 0.1) {
        import('@/lib/instruments/guitar').then(guitar => {
          const vibratoDepth = normalizedMod * 0.5; // 0 to 0.5 semitones
          const vibratoRate = 4 + normalizedMod * 4; // 4 to 8 Hz
          guitar.applyVibrato(lastNoteRef.current, vibratoDepth, vibratoRate);
        });
      } else if (instrument === 'GUITAR') {
        import('@/lib/instruments/guitar').then(guitar => {
          guitar.stopVibrato(lastNoteRef.current);
        });
      }
    }
    
    // Handle volume
    if (cc.isVolume && audioEngine) {
      const normalizedVolume = cc.value / 127;
      audioEngine.setInstrumentVolume(instrument, normalizedVolume);
    }
    
    // Handle expression (CC11) - can be used for guitar tone
    if (cc.isExpression && instrument === 'GUITAR') {
      const normalizedExp = cc.value / 127;
      import('@/lib/instruments/guitar').then(guitar => {
        guitar.setTone(normalizedExp);
      });
    }
  }, [instrument, audioEngine, onPitchBend, onModWheel]);

  const midi = useMIDI({
    onNoteOn: handleNoteOn,
    onNoteOff: handleNoteOff,
    onControlChange: handleControlChange,
    enabled: enabled && midiEnabled
  });

  // Panic function - stop all notes
  const panic = useCallback(() => {
    activeNotesRef.current.forEach(note => {
      handleNoteOff(note, 0);
    });
    activeNotesRef.current.clear();
    lastNoteRef.current = null;
  }, [handleNoteOff]);

  return {
    ...midi,
    midiEnabled,
    setMidiEnabled,
    panic,
    lastNote: lastNoteRef.current
  };
}
