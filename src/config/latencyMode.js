/**
 * Latency Mode Configuration
 * 
 * Controls how note events are scheduled and played back.
 * 
 * ULTRA_LOW_LATENCY: Immediate playback, bypasses scheduling, preloads audio engine
 * SYNCED: Clock-synchronized playback with latency compensation (existing behavior)
 */

export const LATENCY_MODES = {
  ULTRA: 'ULTRA_LOW_LATENCY',
  SYNCED: 'SYNCED', // existing behavior (clock-scheduled)
};

// For now we force ULTRA mode globally.
// Later we can hook this to a UI toggle.
export const CURRENT_LATENCY_MODE = LATENCY_MODES.ULTRA;

