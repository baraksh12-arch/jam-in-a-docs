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

/**
 * Bundle interval constants for event bundling
 * 
 * These control how often outgoing jam events are bundled and sent.
 * Smaller intervals = lower latency but more packets
 * Larger intervals = higher latency but fewer packets
 * 
 * ULTRA: 8ms (~125 fps) - keeps latency very low while reducing bursts
 * SYNCED: 16ms (~60 fps) - slightly higher latency for better batching
 */
export const BUNDLE_INTERVAL_MS_ULTRA = 8;   // ~125 fps
export const BUNDLE_INTERVAL_MS_SYNCED = 16; // ~60 fps

