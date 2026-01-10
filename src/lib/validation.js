/**
 * Input Validation and Sanitization Utilities
 * Provides validation and sanitization for user inputs to prevent XSS, injection attacks, etc.
 */

/**
 * Sanitize text input to prevent XSS attacks
 * Escapes HTML special characters
 * 
 * @param {string} text - Text to sanitize
 * @returns {string} Sanitized text
 */
export function sanitizeText(text) {
  if (typeof text !== 'string') {
    return '';
  }

  // Escape HTML special characters
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };

  return text.replace(/[&<>"'/]/g, (char) => map[char]);
}

/**
 * Validate room code
 * Room codes should be alphanumeric, uppercase, 4-8 characters
 * 
 * @param {string} roomCode - Room code to validate
 * @returns {Object} { valid: boolean, error?: string }
 */
export function validateRoomCode(roomCode) {
  if (!roomCode || typeof roomCode !== 'string') {
    return { valid: false, error: 'Room code is required' };
  }

  const trimmed = roomCode.trim().toUpperCase();

  if (trimmed.length < 4 || trimmed.length > 8) {
    return { valid: false, error: 'Room code must be 4-8 characters' };
  }

  if (!/^[A-Z0-9]+$/.test(trimmed)) {
    return { valid: false, error: 'Room code must contain only letters and numbers' };
  }

  return { valid: true, value: trimmed };
}

/**
 * Validate display name
 * Display names should be 1-30 characters, no special HTML/script tags
 * 
 * @param {string} displayName - Display name to validate
 * @returns {Object} { valid: boolean, error?: string, sanitized?: string }
 */
export function validateDisplayName(displayName) {
  if (!displayName || typeof displayName !== 'string') {
    return { valid: false, error: 'Display name is required' };
  }

  const trimmed = displayName.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Display name cannot be empty' };
  }

  if (trimmed.length > 30) {
    return { valid: false, error: 'Display name must be 30 characters or less' };
  }

  // Check for potentially dangerous patterns (script tags, etc.)
  if (/<[^>]*>/g.test(trimmed)) {
    return { valid: false, error: 'Display name cannot contain HTML tags' };
  }

  // Sanitize the display name
  const sanitized = sanitizeText(trimmed);

  return { valid: true, sanitized };
}

/**
 * Validate chat message
 * Chat messages should be 1-500 characters, sanitized for XSS
 * 
 * @param {string} message - Chat message to validate
 * @returns {Object} { valid: boolean, error?: string, sanitized?: string }
 */
export function validateChatMessage(message) {
  if (!message || typeof message !== 'string') {
    return { valid: false, error: 'Message is required' };
  }

  const trimmed = message.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Message cannot be empty' };
  }

  if (trimmed.length > 500) {
    return { valid: false, error: 'Message must be 500 characters or less' };
  }

  // Sanitize the message to prevent XSS
  const sanitized = sanitizeText(trimmed);

  return { valid: true, sanitized };
}

/**
 * Valid drum pad IDs
 */
export const VALID_DRUM_PADS = ['kick', 'snare', 'hihat', 'openhat', 'tom1', 'tom2', 'crash', 'ride'];

/**
 * Validate MIDI note number
 * 
 * @param {number} note - MIDI note (0-127)
 * @returns {boolean}
 */
export function validateMIDINote(note) {
  return typeof note === 'number' && 
         Number.isInteger(note) && 
         note >= 0 && 
         note <= 127;
}

/**
 * Validate drum pad ID
 * Drums use string identifiers like 'kick', 'snare', etc.
 * 
 * @param {string} padId - Drum pad ID
 * @returns {boolean}
 */
export function validateDrumPad(padId) {
  return typeof padId === 'string' && VALID_DRUM_PADS.includes(padId.toLowerCase());
}

/**
 * Validate velocity
 * 
 * @param {number} velocity - MIDI velocity (0-127)
 * @returns {boolean}
 */
export function validateVelocity(velocity) {
  return typeof velocity === 'number' && 
         Number.isInteger(velocity) && 
         velocity >= 0 && 
         velocity <= 127;
}

/**
 * Validate instrument name
 * 
 * @param {string} instrument - Instrument name
 * @returns {boolean}
 */
export function validateInstrument(instrument) {
  const validInstruments = ['DRUMS', 'BASS', 'EP', 'GUITAR'];
  return typeof instrument === 'string' && validInstruments.includes(instrument);
}

