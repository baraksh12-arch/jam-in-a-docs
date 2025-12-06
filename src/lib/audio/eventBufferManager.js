import { syncedNow } from '@/lib/time/syncedNow';

/**
 * Event Buffer Manager
 * 
 * Handles jitter, deduplication, and stale event filtering for networked note events.
 * Maintains a sliding buffer of recent events to prevent double triggers and out-of-order playback.
 */

/**
 * Configuration constants
 */
const BUFFER_WINDOW_MS = 300; // Sliding buffer window: 300ms
const STALE_THRESHOLD_MS = 1500; // Events >1.5s in past are stale
const MIN_NOTE_INTERVAL_MS = 10; // Minimum time between same note (prevents overlapping for mono synths)

/**
 * Debug flag for event buffer logging
 */
const DEBUG_BUFFER = false;

/**
 * Statistics for debugging
 */
const stats = {
  totalEvents: 0,
  droppedDuplicates: 0,
  droppedStale: 0,
  droppedOverlapping: 0,
  jitterSum: 0,
  jitterCount: 0,
  jitterMin: Infinity,
  jitterMax: -Infinity,
};

/**
 * EventBufferManager class
 * Manages sliding buffer of events and deduplication
 */
export class EventBufferManager {
  constructor() {
    /** @type {Map<string, {timestamp: number, event: Object}>} Event key -> event data */
    this.eventBuffer = new Map();
    
    /** @type {Map<string, number>} Instrument -> last play time (ms) */
    this.lastPlayTime = new Map();
    
    /** @type {Map<string, number>} Instrument-note -> last play time (ms) */
    this.lastNotePlayTime = new Map();
    
    /** @type {number} Last cleanup time */
    this.lastCleanupTime = 0;
    
    /** @type {number} Cleanup interval (ms) */
    this.cleanupInterval = 100; // Clean up every 100ms
  }

  /**
   * Generate event key for deduplication
   * Format: ${instrument}-${note}-${timestamp}
   * 
   * @param {Object} event - Event object
   * @returns {string} Event key
   */
  getEventKey(event) {
    return `${event.instrument}-${event.note}-${event.timestamp}`;
  }

  /**
   * Check if event should be played
   * Performs all filtering: deduplication, stale filtering, overlapping prevention
   * 
   * @param {Object} event - Event object
   * @param {string} event.instrument - Instrument name
   * @param {number|string} event.note - MIDI note or drum pad ID
   * @param {number} event.timestamp - Server-aligned timestamp
   * @param {string} [event.senderId] - Optional sender ID
   * @returns {boolean} True if event should be played, false if should be dropped
   */
  shouldPlay(event) {
    if (!event || !event.instrument || event.note === undefined || !event.timestamp) {
      return false;
    }

    stats.totalEvents++;

    const now = syncedNow();
    const eventKey = this.getEventKey(event);
    const instrumentNoteKey = `${event.instrument}-${event.note}`;

    // 1. Deduplication: Check if same event already in buffer
    if (this.eventBuffer.has(eventKey)) {
      stats.droppedDuplicates++;
      if (DEBUG_BUFFER) {
        console.log('[EventBuffer] Dropped duplicate event:', {
          instrument: event.instrument,
          note: event.note,
          timestamp: event.timestamp,
          key: eventKey,
        });
      }
      return false;
    }

    // 2. Stale event filtering: Check if event is too old (>1.5s in past)
    const eventAge = now - event.timestamp;
    if (eventAge > STALE_THRESHOLD_MS) {
      stats.droppedStale++;
      if (DEBUG_BUFFER) {
        console.warn('[EventBuffer] Dropped stale event:', {
          instrument: event.instrument,
          note: event.note,
          timestamp: event.timestamp,
          age: `${eventAge.toFixed(2)}ms`,
        });
      }
      return false;
    }

    // 3. Overlapping note prevention (especially for mono synths like bass)
    // Prevent same note from playing again within MIN_NOTE_INTERVAL_MS
    const lastNoteTime = this.lastNotePlayTime.get(instrumentNoteKey);
    if (lastNoteTime !== undefined) {
      const timeSinceLastNote = now - lastNoteTime;
      if (timeSinceLastNote < MIN_NOTE_INTERVAL_MS) {
        stats.droppedOverlapping++;
        if (DEBUG_BUFFER) {
          console.log('[EventBuffer] Dropped overlapping note:', {
            instrument: event.instrument,
            note: event.note,
            timeSinceLastNote: `${timeSinceLastNote.toFixed(2)}ms`,
          });
        }
        return false;
      }
    }

    // 4. Calculate jitter (variance from target time)
    // Jitter = |actual arrival time - expected arrival time|
    // Expected arrival time ≈ timestamp (assuming no network delay for calculation)
    const jitter = Math.abs(now - event.timestamp);
    
    // Update jitter statistics
    stats.jitterSum += jitter;
    stats.jitterCount++;
    if (jitter < stats.jitterMin) {
      stats.jitterMin = jitter;
    }
    if (jitter > stats.jitterMax) {
      stats.jitterMax = jitter;
    }

    // 5. Add event to buffer
    this.eventBuffer.set(eventKey, {
      timestamp: event.timestamp,
      event: event,
    });

    // 6. Update last play times
    this.lastPlayTime.set(event.instrument, now);
    this.lastNotePlayTime.set(instrumentNoteKey, now);

    // 7. Periodic cleanup of old events from buffer
    this.cleanupIfNeeded(now);

    return true; // Event should be played
  }

  /**
   * Clean up old events from buffer (sliding window)
   * 
   * @param {number} now - Current time in milliseconds
   */
  cleanupIfNeeded(now) {
    // Only cleanup every cleanupInterval to avoid overhead
    if (now - this.lastCleanupTime < this.cleanupInterval) {
      return;
    }

    this.lastCleanupTime = now;
    const cutoffTime = now - BUFFER_WINDOW_MS;

    // Remove events older than buffer window
    for (const [key, data] of this.eventBuffer.entries()) {
      if (data.timestamp < cutoffTime) {
        this.eventBuffer.delete(key);
      }
    }

    // Also cleanup old lastNotePlayTime entries (keep only recent ones)
    // Remove entries older than buffer window
    for (const [key, playTime] of this.lastNotePlayTime.entries()) {
      if (now - playTime > BUFFER_WINDOW_MS) {
        this.lastNotePlayTime.delete(key);
      }
    }
  }

  /**
   * Get buffer statistics
   * 
   * @returns {Object} Stats object
   */
  getStats() {
    const avgJitter = stats.jitterCount > 0
      ? stats.jitterSum / stats.jitterCount
      : 0;

    return {
      totalEvents: stats.totalEvents,
      droppedDuplicates: stats.droppedDuplicates,
      droppedStale: stats.droppedStale,
      droppedOverlapping: stats.droppedOverlapping,
      bufferSize: this.eventBuffer.size,
      avgJitter: avgJitter,
      jitterMin: stats.jitterMin === Infinity ? 0 : stats.jitterMin,
      jitterMax: stats.jitterMax === -Infinity ? 0 : stats.jitterMax,
      dropRate: stats.totalEvents > 0
        ? ((stats.droppedDuplicates + stats.droppedStale + stats.droppedOverlapping) / stats.totalEvents) * 100
        : 0,
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    stats.totalEvents = 0;
    stats.droppedDuplicates = 0;
    stats.droppedStale = 0;
    stats.droppedOverlapping = 0;
    stats.jitterSum = 0;
    stats.jitterCount = 0;
    stats.jitterMin = Infinity;
    stats.jitterMax = -Infinity;
  }

  /**
   * Clear event buffer (useful for testing or reset)
   */
  clear() {
    this.eventBuffer.clear();
    this.lastPlayTime.clear();
    this.lastNotePlayTime.clear();
  }

  /**
   * Get current buffer size
   * 
   * @returns {number} Number of events in buffer
   */
  getBufferSize() {
    return this.eventBuffer.size;
  }
}

// Singleton instance (shared across the app)
let eventBufferManager = null;

/**
 * Get or create the singleton EventBufferManager instance
 * 
 * @returns {EventBufferManager} EventBufferManager instance
 */
export function getEventBufferManager() {
  if (!eventBufferManager) {
    eventBufferManager = new EventBufferManager();
  }
  return eventBufferManager;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetEventBufferManager() {
  if (eventBufferManager) {
    eventBufferManager.clear();
    eventBufferManager.resetStats();
  }
  eventBufferManager = null;
}

