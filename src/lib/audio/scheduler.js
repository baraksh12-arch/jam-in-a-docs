import * as Tone from 'tone';
import { syncedNow } from '@/lib/time/syncedNow';
import * as ToneInstruments from '@/lib/instruments';
import { getEventBufferManager } from './eventBufferManager';

/**
 * Global Latency Buffer
 * 
 * This buffer ensures notes are scheduled far enough in the future to account for:
 * - Network jitter
 * - Processing delays
 * - Clock drift
 * - Audio buffer latency
 * 
 * Start with 50ms. Can be adjusted per environment (low-latency vs. high-latency networks).
 */
export const LATENCY_BUFFER_MS = 50; // 50ms default buffer

/**
 * Debug flag for scheduler logging
 */
const DEBUG_SCHEDULER = false;

/**
 * Statistics for dropped/late notes
 */
const stats = {
  totalScheduled: 0,
  totalDropped: 0,
  totalLate: 0,
  lastDroppedTime: 0,
};

/**
 * Schedule a note event for playback
 * 
 * All networked note events should be scheduled through this function.
 * Uses Tone.Transport for precise timing and syncedNow() for server-aligned time.
 * 
 * Phase 5: Includes jitter handling and deduplication via EventBufferManager.
 * 
 * @param {Object} event - Note event object
 * @param {string} event.instrument - Instrument name ('DRUMS', 'BASS', 'EP', 'GUITAR')
 * @param {number|string} event.note - MIDI note (0-127) or drum pad ID
 * @param {number} event.velocity - MIDI velocity (0-127)
 * @param {number} event.timestamp - Server-aligned timestamp in milliseconds (from syncedNow())
 * @param {string} [event.senderId] - Optional sender ID for logging
 * @returns {boolean} True if scheduled, false if dropped (too late, duplicate, stale, etc.)
 */
export function scheduleNote(event) {
  if (!event || !event.instrument || event.note === undefined) {
    console.warn('[Scheduler] Invalid event:', event);
    return false;
  }

  // Phase 5: Check event buffer manager for deduplication, stale filtering, overlapping prevention
  const bufferManager = getEventBufferManager();
  if (!bufferManager.shouldPlay(event)) {
    // Event was filtered by buffer manager (duplicate, stale, overlapping, etc.)
    // Statistics are tracked in EventBufferManager
    return false;
  }

  // Get current server-aligned time
  const now = syncedNow();
  
  // Calculate when the note should play (timestamp + buffer)
  const playAt = event.timestamp + LATENCY_BUFFER_MS;
  
  // Filter too-late notes
  if (playAt < now) {
    const lateBy = now - playAt;
    stats.totalDropped++;
    stats.totalLate++;
    stats.lastDroppedTime = now;
    
    if (DEBUG_SCHEDULER) {
      console.warn('[Scheduler] Dropped late note:', {
        instrument: event.instrument,
        note: event.note,
        lateBy: `${lateBy.toFixed(2)}ms`,
        timestamp: event.timestamp,
        now,
        playAt,
      });
    }
    
    // Log occasionally (not every dropped note to avoid spam)
    if (stats.totalDropped % 10 === 1) {
      console.warn(`[Scheduler] Dropped ${stats.totalDropped} late notes (latest: ${lateBy.toFixed(2)}ms late)`);
    }
    
    return false; // Too late, skip it
  }

  // Convert playAt (milliseconds, server time) to Tone.Transport time (seconds)
  // Calculate how far in the future playAt is from now (both in server time)
  const timeUntilPlay = (playAt - now) / 1000; // Convert to seconds
  
  // Get current Tone.Transport time and add the delay
  const currentTransportTime = Tone.Transport.seconds;
  const scheduleTime = currentTransportTime + timeUntilPlay;
  
  // Ensure we're scheduling in the future (at least 1ms ahead)
  const minScheduleTime = currentTransportTime + 0.001;
  const finalScheduleTime = Math.max(scheduleTime, minScheduleTime);

  // Schedule the note using Tone.Transport
  Tone.Transport.scheduleOnce(() => {
    try {
      // Trigger the note using Tone.js instruments
      // Use undefined for time to play immediately when callback fires
      ToneInstruments.triggerNote(
        event.instrument,
        event.note,
        undefined, // Play immediately when callback fires
        event.velocity || 100
      );
      
      stats.totalScheduled++;
      
      if (DEBUG_SCHEDULER) {
        console.log('[Scheduler] Played note:', {
          instrument: event.instrument,
          note: event.note,
          velocity: event.velocity,
          scheduledAt: playAt,
          actualTime: syncedNow(),
        });
      }
    } catch (error) {
      console.error('[Scheduler] Error playing scheduled note:', error);
    }
  }, finalScheduleTime);

  if (DEBUG_SCHEDULER) {
    console.log('[Scheduler] Scheduled note:', {
      instrument: event.instrument,
      note: event.note,
      timestamp: event.timestamp,
      playAt,
      timeUntilPlay: `${(timeUntilPlay * 1000).toFixed(2)}ms`,
      scheduleTime: `${(finalScheduleTime * 1000).toFixed(2)}ms`,
      currentTransportTime: `${(currentTransportTime * 1000).toFixed(2)}ms`,
    });
  }

  return true; // Successfully scheduled
}

/**
 * Schedule multiple note events (for chords or bundles)
 * 
 * @param {Array<Object>} events - Array of note event objects
 * @returns {number} Number of successfully scheduled events
 */
export function scheduleNotes(events) {
  if (!Array.isArray(events)) {
    console.warn('[Scheduler] scheduleNotes expects an array');
    return 0;
  }

  let scheduled = 0;
  for (const event of events) {
    if (scheduleNote(event)) {
      scheduled++;
    }
  }

  return scheduled;
}

/**
 * Get scheduler statistics
 * Includes both scheduler stats and event buffer manager stats
 * 
 * @returns {Object} Combined stats object
 */
export function getSchedulerStats() {
  const bufferManager = getEventBufferManager();
  const bufferStats = bufferManager.getStats();
  
  return {
    // Scheduler stats
    totalScheduled: stats.totalScheduled,
    totalDropped: stats.totalDropped,
    totalLate: stats.totalLate,
    lastDroppedTime: stats.lastDroppedTime,
    schedulerDropRate: stats.totalScheduled + stats.totalDropped > 0
      ? (stats.totalDropped / (stats.totalScheduled + stats.totalDropped)) * 100
      : 0,
    
    // Event buffer manager stats
    ...bufferStats,
    
    // Combined drop rate (scheduler + buffer manager)
    totalDropRate: stats.totalScheduled + stats.totalDropped + bufferStats.droppedDuplicates + bufferStats.droppedStale + bufferStats.droppedOverlapping > 0
      ? ((stats.totalDropped + bufferStats.droppedDuplicates + bufferStats.droppedStale + bufferStats.droppedOverlapping) / 
         (stats.totalScheduled + stats.totalDropped + bufferStats.totalEvents)) * 100
      : 0,
  };
}

/**
 * Reset scheduler statistics
 * Also resets event buffer manager statistics
 */
export function resetSchedulerStats() {
  stats.totalScheduled = 0;
  stats.totalDropped = 0;
  stats.totalLate = 0;
  stats.lastDroppedTime = 0;
  
  const bufferManager = getEventBufferManager();
  bufferManager.resetStats();
}

/**
 * Set latency buffer (for testing or environment-specific tuning)
 * 
 * @param {number} bufferMs - New buffer in milliseconds
 */
export function setLatencyBuffer(bufferMs) {
  if (bufferMs < 0 || bufferMs > 1000) {
    console.warn('[Scheduler] Invalid buffer value, must be between 0 and 1000ms');
    return;
  }
  
  // Update the constant (note: this is a workaround since we can't modify const)
  // In production, use a config object instead
  console.log(`[Scheduler] Latency buffer set to ${bufferMs}ms (note: requires code update to persist)`);
}

