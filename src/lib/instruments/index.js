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

      // Initialize all instruments in parallel - use allSettled so one failure doesn't block others
      const results = await Promise.allSettled([
        drums.initDrums(),
        piano.initPiano(),
        bass.initBass(),
        guitar.initGuitar(),
      ]);

      // Log individual instrument status
      const instrumentNames = ['Drums', 'Piano', 'Bass', 'Guitar'];
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.warn(`[InstrumentManager] ${instrumentNames[index]} init failed (non-critical):`, result.reason);
        } else {
          console.log(`[InstrumentManager] ${instrumentNames[index]} ready`);
        }
      });

      // Wait for all samples to be loaded (non-critical if some fail)
      try {
        await Tone.loaded();
      } catch (e) {
        console.warn('[InstrumentManager] Some samples failed to load:', e);
      }

      isInitialized = true;
      console.log('[InstrumentManager] Instruments initialized (some may have fallbacks)');
    } catch (error) {
      console.error('[InstrumentManager] Critical initialization failure:', error);
      throw error;
    }
  })();

  return initializationPromise;
}

/**
 * Trigger a note ON (attack) on the specified instrument
 * Note will sustain until releaseNote is called - natural, expressive playing
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
 * Release a note (note off) - stops the sustain naturally
 * Essential for expressive playing like Jacob Collier
 * 
 * @param {string} instrument - Instrument name
 * @param {string|number} note - MIDI note or drum pad ID
 * @param {number} time - Optional time for scheduled release
 */
export function releaseNote(instrument, note, time) {
  if (!isInitialized) return;

  switch (instrument) {
    case 'DRUMS':
      // Drums don't need release (they're percussive)
      break;
    case 'BASS':
      bass.releaseNote?.(note, time);
      break;
    case 'EP':
      piano.releaseNote?.(note, time);
      break;
    case 'GUITAR':
      guitar.releaseNote?.(note, time);
      break;
    default:
      break;
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

