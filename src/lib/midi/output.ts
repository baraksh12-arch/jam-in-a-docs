/**
 * MIDI Output Manager
 * 
 * Handles MIDI output to external devices via Web MIDI API.
 * Provides fallback when MIDI is not available.
 */

// MIDI message types
const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;
const CONTROL_CHANGE = 0xB0;

// Common CC messages
export const CC = {
  SUSTAIN: 64,
  MODULATION: 1,
  VOLUME: 7,
  PAN: 10,
  EXPRESSION: 11,
  ALL_NOTES_OFF: 123,
  ALL_SOUND_OFF: 120,
};

/**
 * MIDI Output interface for external control
 */
export interface MIDIOutputDevice {
  id: string;
  name: string;
  manufacturer: string;
  send: (data: number[], timestamp?: number) => void;
}

/**
 * MIDI Output Manager State
 */
interface MIDIState {
  isSupported: boolean;
  isConnected: boolean;
  outputs: MIDIOutputDevice[];
  selectedOutput: MIDIOutputDevice | null;
  channel: number; // 0-15
}

let midiState: MIDIState = {
  isSupported: false,
  isConnected: false,
  outputs: [],
  selectedOutput: null,
  channel: 0,
};

let midiAccess: MIDIAccess | null = null;

/**
 * Initialize MIDI access
 * @returns Promise that resolves when MIDI is ready
 */
export async function initMIDI(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('requestMIDIAccess' in navigator)) {
    console.warn('[MIDI] Web MIDI API not supported');
    midiState.isSupported = false;
    return false;
  }
  
  try {
    midiAccess = await navigator.requestMIDIAccess({ sysex: false });
    midiState.isSupported = true;
    midiState.isConnected = true;
    
    // Populate outputs
    updateOutputs();
    
    // Listen for device changes
    midiAccess.onstatechange = () => {
      updateOutputs();
    };
    
    console.log('[MIDI] Initialized successfully');
    return true;
  } catch (error) {
    console.error('[MIDI] Failed to initialize:', error);
    midiState.isSupported = false;
    return false;
  }
}

/**
 * Update available MIDI outputs
 */
function updateOutputs(): void {
  if (!midiAccess) return;
  
  const outputs: MIDIOutputDevice[] = [];
  
  midiAccess.outputs.forEach((output) => {
    outputs.push({
      id: output.id,
      name: output.name || 'Unknown Device',
      manufacturer: output.manufacturer || 'Unknown',
      send: (data, timestamp) => output.send(data, timestamp),
    });
  });
  
  midiState.outputs = outputs;
  
  // Auto-select first output if none selected
  if (!midiState.selectedOutput && outputs.length > 0) {
    midiState.selectedOutput = outputs[0];
  }
}

/**
 * Get available MIDI outputs
 */
export function getOutputs(): MIDIOutputDevice[] {
  return midiState.outputs;
}

/**
 * Select a MIDI output device
 */
export function selectOutput(deviceId: string): boolean {
  const device = midiState.outputs.find(o => o.id === deviceId);
  if (device) {
    midiState.selectedOutput = device;
    console.log(`[MIDI] Selected output: ${device.name}`);
    return true;
  }
  return false;
}

/**
 * Set MIDI channel (1-16, will be converted to 0-15)
 */
export function setChannel(channel: number): void {
  midiState.channel = Math.max(0, Math.min(15, channel - 1));
}

/**
 * Send MIDI Note On
 * @param note MIDI note number (0-127)
 * @param velocity Velocity (0-127)
 * @param timestamp Optional timestamp for scheduling
 */
export function sendNoteOn(note: number, velocity: number = 100, timestamp?: number): void {
  if (!midiState.selectedOutput) return;
  
  const status = NOTE_ON | midiState.channel;
  const data = [status, note & 0x7F, velocity & 0x7F];
  
  try {
    midiState.selectedOutput.send(data, timestamp);
  } catch (error) {
    console.error('[MIDI] Failed to send Note On:', error);
  }
}

/**
 * Send MIDI Note Off
 * @param note MIDI note number (0-127)
 * @param velocity Release velocity (0-127)
 * @param timestamp Optional timestamp for scheduling
 */
export function sendNoteOff(note: number, velocity: number = 64, timestamp?: number): void {
  if (!midiState.selectedOutput) return;
  
  const status = NOTE_OFF | midiState.channel;
  const data = [status, note & 0x7F, velocity & 0x7F];
  
  try {
    midiState.selectedOutput.send(data, timestamp);
  } catch (error) {
    console.error('[MIDI] Failed to send Note Off:', error);
  }
}

/**
 * Send Control Change message
 * @param controller CC number (0-127)
 * @param value CC value (0-127)
 * @param timestamp Optional timestamp
 */
export function sendCC(controller: number, value: number, timestamp?: number): void {
  if (!midiState.selectedOutput) return;
  
  const status = CONTROL_CHANGE | midiState.channel;
  const data = [status, controller & 0x7F, value & 0x7F];
  
  try {
    midiState.selectedOutput.send(data, timestamp);
  } catch (error) {
    console.error('[MIDI] Failed to send CC:', error);
  }
}

/**
 * Send sustain pedal (CC 64)
 * @param on True for sustain on, false for off
 */
export function sendSustain(on: boolean): void {
  sendCC(CC.SUSTAIN, on ? 127 : 0);
}

/**
 * Send All Notes Off message
 */
export function sendAllNotesOff(): void {
  sendCC(CC.ALL_NOTES_OFF, 0);
}

/**
 * Send All Sound Off message
 */
export function sendAllSoundOff(): void {
  sendCC(CC.ALL_SOUND_OFF, 0);
}

/**
 * Play a chord (multiple notes)
 * @param notes Array of MIDI note numbers
 * @param velocity Velocity (0-127)
 * @param strumDelay Delay between notes in ms (0 for simultaneous)
 */
export function playChord(
  notes: number[],
  velocity: number = 100,
  strumDelay: number = 0
): void {
  const now = performance.now();
  
  notes.forEach((note, index) => {
    const timestamp = strumDelay > 0 ? now + (index * strumDelay) : undefined;
    sendNoteOn(note, velocity, timestamp);
  });
}

/**
 * Release a chord (multiple notes)
 * @param notes Array of MIDI note numbers
 * @param releaseDelay Delay between releases in ms (0 for simultaneous)
 */
export function releaseChord(notes: number[], releaseDelay: number = 0): void {
  const now = performance.now();
  
  notes.forEach((note, index) => {
    const timestamp = releaseDelay > 0 ? now + (index * releaseDelay) : undefined;
    sendNoteOff(note, 64, timestamp);
  });
}

/**
 * Check if MIDI is supported and connected
 */
export function isMIDIAvailable(): boolean {
  return midiState.isSupported && midiState.isConnected;
}

/**
 * Get current MIDI state
 */
export function getMIDIState(): Readonly<MIDIState> {
  return { ...midiState };
}

/**
 * Cleanup and close MIDI connections
 */
export function closeMIDI(): void {
  if (midiAccess) {
    midiAccess.onstatechange = null;
  }
  midiState = {
    isSupported: false,
    isConnected: false,
    outputs: [],
    selectedOutput: null,
    channel: 0,
  };
  midiAccess = null;
}

export default {
  initMIDI,
  getOutputs,
  selectOutput,
  setChannel,
  sendNoteOn,
  sendNoteOff,
  sendCC,
  sendSustain,
  sendAllNotesOff,
  sendAllSoundOff,
  playChord,
  releaseChord,
  isMIDIAvailable,
  getMIDIState,
  closeMIDI,
  CC,
};
