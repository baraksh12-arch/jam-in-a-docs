import * as Tone from 'tone';
import * as drums from './drums';
import * as piano from './piano';
import * as bass from './bass';
import * as guitar from './guitar';

/**
 * Instrument Manager
 * 
 * Centralized initialization and management of all Tone.js instruments.
 * Handles preloading, initialization, and provides unified API.
 */

let isInitialized = false;
let initializationPromise = null;

/**
 * Initialize all instruments and preload samples
 * 
 * @returns {Promise<void>}
 */
export async function initAllInstruments() {
  if (isInitialized) {
    return;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      console.log('[InstrumentManager] Initializing Tone.js instruments...');

      // Start Tone.Transport (required for scheduled playback)
      if (Tone.Transport.state !== 'started') {
        Tone.Transport.start();
      }

      // Initialize all instruments in parallel for faster loading
      await Promise.all([
        drums.initDrums(),
        piano.initPiano(),
        bass.initBass(),
        guitar.initGuitar(),
      ]);

      // Wait for all samples to be loaded
      await Tone.loaded();

      isInitialized = true;
      console.log('[InstrumentManager] All instruments initialized and ready');
    } catch (error) {
      console.error('[InstrumentManager] Failed to initialize instruments:', error);
      throw error;
    }
  })();

  return initializationPromise;
}

/**
 * Trigger a note on the specified instrument
 * 
 * @param {string} instrument - Instrument name: 'DRUMS', 'BASS', 'EP', 'GUITAR'
 * @param {string|number} note - MIDI note (0-127) or drum pad ID (for DRUMS)
 * @param {number} time - Time in Tone.Transport time (seconds) or AudioContext time
 * @param {number} [velocity=100] - MIDI velocity (0-127)
 */
export function triggerNote(instrument, note, time, velocity = 100) {
  if (!isInitialized) {
    console.warn('[InstrumentManager] Instruments not initialized, cannot trigger note');
    return;
  }

  switch (instrument) {
    case 'DRUMS':
      drums.triggerNote(note, time, velocity);
      break;
    case 'BASS':
      bass.triggerNote(note, time, velocity);
      break;
    case 'EP':
      piano.triggerNote(note, time, velocity);
      break;
    case 'GUITAR':
      guitar.triggerNote(note, time, velocity);
      break;
    default:
      console.warn(`[InstrumentManager] Unknown instrument: ${instrument}`);
  }
}

/**
 * Set volume for an instrument
 * 
 * @param {string} instrument - Instrument name
 * @param {number} volume - Volume (0-1)
 */
export function setInstrumentVolume(instrument, volume) {
  switch (instrument) {
    case 'DRUMS':
      drums.setVolume(volume);
      break;
    case 'BASS':
      bass.setVolume(volume);
      break;
    case 'EP':
      piano.setVolume(volume);
      break;
    case 'GUITAR':
      guitar.setVolume(volume);
      break;
    default:
      console.warn(`[InstrumentManager] Unknown instrument: ${instrument}`);
  }
}

/**
 * Get volume for an instrument
 * 
 * @param {string} instrument - Instrument name
 * @returns {number} Volume (0-1)
 */
export function getInstrumentVolume(instrument) {
  switch (instrument) {
    case 'DRUMS':
      return drums.getVolume();
    case 'BASS':
      return bass.getVolume();
    case 'EP':
      return piano.getVolume();
    case 'GUITAR':
      return guitar.getVolume();
    default:
      return 0;
  }
}

/**
 * Check if all instruments are ready
 * 
 * @returns {boolean}
 */
export function areInstrumentsReady() {
  return isInitialized && 
         drums.isReady() && 
         piano.isReady() && 
         bass.isReady() && 
         guitar.isReady();
}

/**
 * Get Tone.Transport for external scheduling
 * 
 * @returns {Tone.Transport}
 */
export function getTransport() {
  return Tone.Transport;
}

/**
 * Get Tone.Context for time conversion
 * 
 * @returns {Tone.Context}
 */
export function getContext() {
  return Tone.context;
}

/**
 * Convert AudioContext time to Tone.Transport time
 * 
 * @param {number} audioContextTime - Time in AudioContext.currentTime
 * @returns {number} Time in Tone.Transport time
 */
export function audioContextTimeToTransportTime(audioContextTime) {
  const context = Tone.context;
  const now = context.currentTime;
  const transportTime = Tone.Transport.seconds;
  const offset = audioContextTime - now;
  return transportTime + offset;
}

/**
 * Convert Tone.Transport time to AudioContext time
 * 
 * @param {number} transportTime - Time in Tone.Transport time
 * @returns {number} Time in AudioContext.currentTime
 */
export function transportTimeToAudioContextTime(transportTime) {
  const context = Tone.context;
  const now = context.currentTime;
  const transportSeconds = Tone.Transport.seconds;
  const offset = transportTime - transportSeconds;
  return now + offset;
}

/**
 * Cleanup all instruments
 */
export function dispose() {
  drums.dispose();
  piano.dispose();
  bass.dispose();
  guitar.dispose();
  isInitialized = false;
  initializationPromise = null;
}

// Export individual instrument modules for advanced usage
export { drums, piano, bass, guitar };
export { Tone };

