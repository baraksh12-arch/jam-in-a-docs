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

const VALID_EVENT_TYPES = [
  'noteOn', 
  'noteOff', 
  'controlChange', 
  'tempo', 
  'pitchBend',
  // Guitar-specific events for physically-informed synthesis
  'guitarPluck',
  'guitarSlide',
  'guitarBend',
  'guitarVibrato',
  'guitarMute',
  'guitarParam'
];
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
 * Deserialize a JSON string or already-parsed object to jam event
 * STEP 2.4: Accepts either string or object to avoid double parsing
 * 
 * @param {string|Object} raw - JSON string or already-parsed object
 * @returns {JamEvent|null} Parsed event or null if invalid
 */
export function deserializeEvent(raw) {
  try {
    let event;
    
    // If already an object, use it directly (avoids double parsing)
    if (typeof raw === 'object' && raw !== null) {
      event = raw;
    } else if (typeof raw === 'string') {
      // Parse JSON string
      event = JSON.parse(raw);
    } else {
      console.warn('Invalid input type for deserializeEvent:', typeof raw);
      return null;
    }
    
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

    // Guitar-specific event types for physically-informed collaboration
    case 'guitarPluck':
      // { stringIndex, fret, velocity, pickPos, pickHardness, palmMute }
      if (typeof obj.stringIndex !== 'number' || obj.stringIndex < 0 || obj.stringIndex > 5) {
        return false;
      }
      if (typeof obj.fret !== 'number' || obj.fret < 0 || obj.fret > 24) {
        return false;
      }
      if (typeof obj.velocity !== 'number' || obj.velocity < 0 || obj.velocity > 127) {
        return false;
      }
      return true;

    case 'guitarSlide':
      // { stringIndex, fretFrom, fretTo, durationMs }
      if (typeof obj.stringIndex !== 'number' || obj.stringIndex < 0 || obj.stringIndex > 5) {
        return false;
      }
      if (typeof obj.fretFrom !== 'number' || typeof obj.fretTo !== 'number') {
        return false;
      }
      if (typeof obj.durationMs !== 'number' || obj.durationMs < 0) {
        return false;
      }
      return true;

    case 'guitarBend':
      // { stringIndex, cents }
      if (typeof obj.stringIndex !== 'number' || obj.stringIndex < 0 || obj.stringIndex > 5) {
        return false;
      }
      if (typeof obj.cents !== 'number') {
        return false;
      }
      return true;

    case 'guitarVibrato':
      // { stringIndex, depthCents, rateHz }
      if (typeof obj.stringIndex !== 'number' || obj.stringIndex < 0 || obj.stringIndex > 5) {
        return false;
      }
      if (typeof obj.depthCents !== 'number' || typeof obj.rateHz !== 'number') {
        return false;
      }
      return true;

    case 'guitarMute':
      // { stringIndex, amount } or { amount } for global palm mute
      if (typeof obj.amount !== 'number' || obj.amount < 0 || obj.amount > 1) {
        return false;
      }
      return true;

    case 'guitarParam':
      // { param, value } for pickup position, tone, etc.
      if (typeof obj.param !== 'string') {
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
 * @param {number} [params.timestamp] - Optional server-aligned timestamp (uses syncedNow() if not provided)
 * @returns {NoteOnEvent}
 */
export function createNoteOnEvent({ instrument, note, velocity, roomTime, senderId, timestamp }) {
  // Use syncedNow() for server-aligned timestamp if not provided
  let eventTimestamp = timestamp;
  if (eventTimestamp === undefined || eventTimestamp === null) {
    // Try to use syncedNow() if available (via global window reference)
    if (typeof window !== 'undefined' && window.__syncedNow) {
      try {
        eventTimestamp = window.__syncedNow();
      } catch (error) {
        eventTimestamp = Date.now();
      }
    } else {
      // Fallback to Date.now() if syncedNow not available
      eventTimestamp = Date.now();
    }
  }

  return {
    type: 'noteOn',
    instrument,
    note,
    velocity,
    roomTime,
    senderId,
    timestamp: eventTimestamp
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
 * @param {number} [params.timestamp] - Optional server-aligned timestamp (uses syncedNow() if not provided)
 * @returns {NoteOffEvent}
 */
export function createNoteOffEvent({ instrument, note, roomTime, senderId, timestamp }) {
  // Use syncedNow() for server-aligned timestamp if not provided
  let eventTimestamp = timestamp;
  if (eventTimestamp === undefined || eventTimestamp === null) {
    // Try to use syncedNow() if available (via global window reference)
    if (typeof window !== 'undefined' && window.__syncedNow) {
      try {
        eventTimestamp = window.__syncedNow();
      } catch (error) {
        eventTimestamp = Date.now();
      }
    } else {
      // Fallback to Date.now() if syncedNow not available
      eventTimestamp = Date.now();
    }
  }

  return {
    type: 'noteOff',
    instrument,
    note,
    roomTime,
    senderId,
    timestamp: eventTimestamp
  };
}

/**
 * Create a guitarPluck event
 * 
 * @param {Object} params
 * @param {number} params.stringIndex - String index (0-5, 0=high E)
 * @param {number} params.fret - Fret number (0-24)
 * @param {number} params.velocity - MIDI velocity (0-127)
 * @param {number} [params.pickPos] - Pick position (0-1, 0=bridge)
 * @param {number} [params.pickHardness] - Pick hardness (0-1)
 * @param {number} [params.palmMute] - Palm mute amount (0-1)
 * @param {number} params.roomTime
 * @param {string} params.senderId
 * @returns {Object}
 */
export function createGuitarPluckEvent({ stringIndex, fret, velocity, pickPos = 0.13, pickHardness = 0.7, palmMute = 0, roomTime, senderId }) {
  const timestamp = getTimestamp();
  return {
    type: 'guitarPluck',
    instrument: 'GUITAR',
    stringIndex,
    fret,
    velocity,
    pickPos,
    pickHardness,
    palmMute,
    roomTime,
    senderId,
    timestamp
  };
}

/**
 * Create a guitarSlide event
 * 
 * @param {Object} params
 * @param {number} params.stringIndex - String index (0-5)
 * @param {number} params.fretFrom - Starting fret
 * @param {number} params.fretTo - Ending fret
 * @param {number} params.durationMs - Slide duration in milliseconds
 * @param {number} params.roomTime
 * @param {string} params.senderId
 * @returns {Object}
 */
export function createGuitarSlideEvent({ stringIndex, fretFrom, fretTo, durationMs, roomTime, senderId }) {
  const timestamp = getTimestamp();
  return {
    type: 'guitarSlide',
    instrument: 'GUITAR',
    stringIndex,
    fretFrom,
    fretTo,
    durationMs,
    roomTime,
    senderId,
    timestamp
  };
}

/**
 * Create a guitarBend event
 * 
 * @param {Object} params
 * @param {number} params.stringIndex - String index (0-5)
 * @param {number} params.cents - Bend amount in cents
 * @param {number} params.roomTime
 * @param {string} params.senderId
 * @returns {Object}
 */
export function createGuitarBendEvent({ stringIndex, cents, roomTime, senderId }) {
  const timestamp = getTimestamp();
  return {
    type: 'guitarBend',
    instrument: 'GUITAR',
    stringIndex,
    cents,
    roomTime,
    senderId,
    timestamp
  };
}

/**
 * Create a guitarVibrato event
 * 
 * @param {Object} params
 * @param {number} params.stringIndex - String index (0-5)
 * @param {number} params.depthCents - Vibrato depth in cents
 * @param {number} params.rateHz - Vibrato rate in Hz
 * @param {number} params.roomTime
 * @param {string} params.senderId
 * @returns {Object}
 */
export function createGuitarVibratoEvent({ stringIndex, depthCents, rateHz, roomTime, senderId }) {
  const timestamp = getTimestamp();
  return {
    type: 'guitarVibrato',
    instrument: 'GUITAR',
    stringIndex,
    depthCents,
    rateHz,
    roomTime,
    senderId,
    timestamp
  };
}

/**
 * Create a guitarMute event (palm mute)
 * 
 * @param {Object} params
 * @param {number} [params.stringIndex] - Optional string index for per-string mute
 * @param {number} params.amount - Mute amount (0-1)
 * @param {number} params.roomTime
 * @param {string} params.senderId
 * @returns {Object}
 */
export function createGuitarMuteEvent({ stringIndex, amount, roomTime, senderId }) {
  const timestamp = getTimestamp();
  return {
    type: 'guitarMute',
    instrument: 'GUITAR',
    ...(stringIndex !== undefined && { stringIndex }),
    amount,
    roomTime,
    senderId,
    timestamp
  };
}

/**
 * Create a guitarParam event for parameter changes (pickup, tone, etc.)
 * 
 * @param {Object} params
 * @param {string} params.param - Parameter name ('pickupPosition', 'tone', 'pickPosition', 'pickHardness')
 * @param {any} params.value - Parameter value
 * @param {number} params.roomTime
 * @param {string} params.senderId
 * @returns {Object}
 */
export function createGuitarParamEvent({ param, value, roomTime, senderId }) {
  const timestamp = getTimestamp();
  return {
    type: 'guitarParam',
    instrument: 'GUITAR',
    param,
    value,
    roomTime,
    senderId,
    timestamp
  };
}

/**
 * Helper to get timestamp using syncedNow if available
 */
function getTimestamp() {
  if (typeof window !== 'undefined' && window.__syncedNow) {
    try {
      return window.__syncedNow();
    } catch (error) {
      return Date.now();
    }
  }
  return Date.now();
}

/**
 * Normalize incoming jam payload to an array of validated jam events
 * 
 * Handles three formats for backwards compatibility:
 * 1. Single event object (existing behavior)
 * 2. Array of events: [ { ... }, { ... } ]
 * 3. Bundle object: { kind: 'bundle', events: [ { ... }, ... ] }
 * 
 * @param {any} payload - Incoming payload (already parsed JSON)
 * @returns {JamEvent[]} Array of validated jam events (empty if invalid)
 */
export function normalizeIncomingJamPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  // Case A: Bundle object with events array
  if (payload.events && Array.isArray(payload.events)) {
    const events = [];
    for (const rawEvent of payload.events) {
      const jamEvent = deserializeEvent(rawEvent);
      if (jamEvent) {
        events.push(jamEvent);
      }
    }
    return events;
  }

  // Case B: Bare array of events
  if (Array.isArray(payload)) {
    const events = [];
    for (const rawEvent of payload) {
      const jamEvent = deserializeEvent(rawEvent);
      if (jamEvent) {
        events.push(jamEvent);
      }
    }
    return events;
  }

  // Case C: Single event (existing behavior)
  const jamEvent = deserializeEvent(payload);
  if (jamEvent) {
    return [jamEvent];
  }

  return [];
}

