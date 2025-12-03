/**
 * Jam Event Protocol
 * 
 * Defines message types and serialization for jam events sent over WebRTC DataChannels
 * and Supabase Realtime (for crowd distribution).
 * 
 * Events are small JSON objects for now. Can be swapped to binary later if needed.
 */

/**
 * @typedef {Object} JamEventBase
 * @property {string} type - Event type: 'noteOn', 'noteOff', 'controlChange', 'tempo', 'pitchBend'
 * @property {string} instrument - Instrument: 'DRUMS', 'BASS', 'EP', 'GUITAR'
 * @property {number} roomTime - Synchronized room time (seconds since room start)
 * @property {string} senderId - User ID of sender
 * @property {number} timestamp - Local timestamp (ms) for debugging
 */

/**
 * @typedef {Object} NoteOnEvent
 * @property {'noteOn'} type
 * @property {string} instrument
 * @property {number|string} note - MIDI note (0-127) for instruments, or drum pad ID (e.g., "kick", "snare") for DRUMS
 * @property {number} velocity - MIDI velocity (0-127)
 * @property {number} roomTime
 * @property {string} senderId
 * @property {number} timestamp
 */

/**
 * @typedef {Object} NoteOffEvent
 * @property {'noteOff'} type
 * @property {string} instrument
 * @property {number|string} note - MIDI note (0-127) for instruments, or drum pad ID (e.g., "kick", "snare") for DRUMS
 * @property {number} roomTime
 * @property {string} senderId
 * @property {number} timestamp
 */

/**
 * @typedef {Object} ControlChangeEvent
 * @property {'controlChange'} type
 * @property {string} instrument
 * @property {number} cc - MIDI CC number (0-127)
 * @property {number} value - CC value (0-127)
 * @property {number} roomTime
 * @property {string} senderId
 * @property {number} timestamp
 */

/**
 * @typedef {Object} TempoEvent
 * @property {'tempo'} type
 * @property {number} bpm - New BPM value
 * @property {number} roomTime
 * @property {string} senderId
 * @property {number} timestamp
 */

/**
 * @typedef {Object} PitchBendEvent
 * @property {'pitchBend'} type
 * @property {string} instrument
 * @property {number} value - Pitch bend value (-8192 to 8191)
 * @property {number} roomTime
 * @property {string} senderId
 * @property {number} timestamp
 */

/**
 * @typedef {NoteOnEvent|NoteOffEvent|ControlChangeEvent|TempoEvent|PitchBendEvent} JamEvent
 */

const VALID_EVENT_TYPES = ['noteOn', 'noteOff', 'controlChange', 'tempo', 'pitchBend'];
const VALID_INSTRUMENTS = ['DRUMS', 'BASS', 'EP', 'GUITAR'];

/**
 * Serialize a jam event to JSON string
 * 
 * @param {JamEvent} event - Jam event object
 * @returns {string} JSON string
 */
export function serializeEvent(event) {
  if (!isJamEvent(event)) {
    throw new Error('Invalid jam event: ' + JSON.stringify(event));
  }
  
  return JSON.stringify(event);
}

/**
 * Deserialize a JSON string to jam event
 * 
 * @param {string} raw - JSON string
 * @returns {JamEvent|null} Parsed event or null if invalid
 */
export function deserializeEvent(raw) {
  try {
    const event = JSON.parse(raw);
    
    if (isJamEvent(event)) {
      return event;
    }
    
    console.warn('Invalid jam event structure:', event);
    return null;
  } catch (error) {
    console.error('Error deserializing jam event:', error);
    return null;
  }
}

/**
 * Type guard: Check if object is a valid jam event
 * 
 * @param {any} obj - Object to check
 * @returns {obj is JamEvent} True if valid jam event
 */
export function isJamEvent(obj) {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  // Check required base fields
  if (typeof obj.type !== 'string' || !VALID_EVENT_TYPES.includes(obj.type)) {
    return false;
  }

  if (typeof obj.roomTime !== 'number' || obj.roomTime < 0) {
    return false;
  }

  if (typeof obj.senderId !== 'string' || obj.senderId.length === 0) {
    return false;
  }

  if (typeof obj.timestamp !== 'number') {
    return false;
  }

  // Type-specific validation
  switch (obj.type) {
    case 'noteOn':
      if (typeof obj.instrument !== 'string' || !VALID_INSTRUMENTS.includes(obj.instrument)) {
        return false;
      }
      // Note can be number (MIDI 0-127) or string (drum pad ID like "kick", "snare")
      const noteTypeOn = typeof obj.note;
      if (noteTypeOn === 'number') {
        // Validate numeric note range
        if (obj.note < 0 || obj.note > 127) {
          return false;
        }
      } else if (noteTypeOn === 'string') {
        // Validate string note (for drums) - must be non-empty
        if (obj.note.length === 0) {
          return false;
        }
      } else {
        // Invalid note type
        return false;
      }
      if (typeof obj.velocity !== 'number' || obj.velocity < 0 || obj.velocity > 127) {
        return false;
      }
      return true;

    case 'noteOff':
      if (typeof obj.instrument !== 'string' || !VALID_INSTRUMENTS.includes(obj.instrument)) {
        return false;
      }
      // Note can be number (MIDI 0-127) or string (drum pad ID like "kick", "snare")
      const noteTypeOff = typeof obj.note;
      if (noteTypeOff === 'number') {
        // Validate numeric note range
        if (obj.note < 0 || obj.note > 127) {
          return false;
        }
      } else if (noteTypeOff === 'string') {
        // Validate string note (for drums) - must be non-empty
        if (obj.note.length === 0) {
          return false;
        }
      } else {
        // Invalid note type
        return false;
      }
      return true;

    case 'controlChange':
      if (typeof obj.instrument !== 'string' || !VALID_INSTRUMENTS.includes(obj.instrument)) {
        return false;
      }
      if (typeof obj.cc !== 'number' || obj.cc < 0 || obj.cc > 127) {
        return false;
      }
      if (typeof obj.value !== 'number' || obj.value < 0 || obj.value > 127) {
        return false;
      }
      return true;

    case 'tempo':
      if (typeof obj.bpm !== 'number' || obj.bpm < 40 || obj.bpm > 240) {
        return false;
      }
      return true;

    case 'pitchBend':
      if (typeof obj.instrument !== 'string' || !VALID_INSTRUMENTS.includes(obj.instrument)) {
        return false;
      }
      if (typeof obj.value !== 'number' || obj.value < -8192 || obj.value > 8191) {
        return false;
      }
      return true;

    default:
      return false;
  }
}

/**
 * Create a noteOn event
 * 
 * @param {Object} params
 * @param {string} params.instrument
 * @param {number|string} params.note - MIDI note (0-127) or drum pad ID (e.g., "kick", "snare")
 * @param {number} params.velocity
 * @param {number} params.roomTime
 * @param {string} params.senderId
 * @returns {NoteOnEvent}
 */
export function createNoteOnEvent({ instrument, note, velocity, roomTime, senderId }) {
  return {
    type: 'noteOn',
    instrument,
    note,
    velocity,
    roomTime,
    senderId,
    timestamp: Date.now()
  };
}

/**
 * Create a noteOff event
 * 
 * @param {Object} params
 * @param {string} params.instrument
 * @param {number|string} params.note - MIDI note (0-127) or drum pad ID (e.g., "kick", "snare")
 * @param {number} params.roomTime
 * @param {string} params.senderId
 * @returns {NoteOffEvent}
 */
export function createNoteOffEvent({ instrument, note, roomTime, senderId }) {
  return {
    type: 'noteOff',
    instrument,
    note,
    roomTime,
    senderId,
    timestamp: Date.now()
  };
}

