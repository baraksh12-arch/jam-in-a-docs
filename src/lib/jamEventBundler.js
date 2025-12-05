/**
 * Jam Event Bundler
 * 
 * Bundles outgoing jam events into single packets to reduce burst pressure
 * and stabilize latency, especially for drums.
 * 
 * Design:
 * - Maintains a queue of outgoing events
 * - Flushes queue at configurable intervals (8ms for ULTRA, 16ms for SYNCED)
 * - Sends single events as-is (backwards compatible)
 * - Sends multiple events as a bundle object
 * 
 * The bundler is per-WebRTCManager instance and must be cleaned up
 * when the manager is destroyed.
 */

/**
 * Debug flag for bundler operations
 * Set to true to enable verbose logging
 */
const DEBUG_BUNDLER = false;

/**
 * JamEventBundler class
 * 
 * Queues jam events and flushes them at regular intervals to reduce
 * burst pressure on WebRTC DataChannels.
 */
export class JamEventBundler {
  /**
   * @param {Object} options
   * @param {number} options.flushIntervalMs - Flush interval in milliseconds
   * @param {function(Array<Object>): void} options.sendBundle - Callback to send bundle
   */
  constructor({ flushIntervalMs, sendBundle }) {
    /** @type {Array<Object>} Queue of pending jam events */
    this.queue = [];
    
    /** @type {number|null} Interval timer ID */
    this.timer = null;
    
    /** @type {number} Flush interval in milliseconds */
    this.flushIntervalMs = flushIntervalMs;
    
    /** @type {function(Array<Object>): void} Callback to send bundle */
    this.sendBundle = sendBundle;
    
    /** @type {boolean} Whether bundler is started */
    this.started = false;
  }

  /**
   * Start the bundler (begin periodic flushing)
   */
  start() {
    if (this.started) {
      return; // Already started
    }
    
    this.started = true;
    
    if (DEBUG_BUNDLER) {
      console.log('[JamEventBundler] Starting with flush interval:', this.flushIntervalMs, 'ms');
    }
    
    // Start periodic flush
    this.timer = setInterval(() => {
      this.flush();
    }, this.flushIntervalMs);
  }

  /**
   * Stop the bundler (stop periodic flushing)
   * Flushes any remaining events before stopping
   */
  stop() {
    if (!this.started) {
      return; // Already stopped
    }
    
    this.started = false;
    
    if (DEBUG_BUNDLER) {
      console.log('[JamEventBundler] Stopping, flushing remaining events');
    }
    
    // Clear timer
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    
    // Flush any remaining events
    this.flushNow();
  }

  /**
   * Add an event to the queue
   * 
   * @param {Object} event - Jam event object
   */
  addEvent(event) {
    if (!this.started) {
      // If not started, start automatically (defensive)
      this.start();
    }
    
    this.queue.push(event);
    
    if (DEBUG_BUNDLER) {
      console.log('[JamEventBundler] Added event to queue, queue size:', this.queue.length);
    }
  }

  /**
   * Flush the queue (send all pending events)
   * Called periodically by the timer
   */
  flush() {
    if (this.queue.length === 0) {
      return; // Nothing to send
    }
    
    // Get all queued events and clear the queue
    const eventsToSend = [...this.queue];
    this.queue = [];
    
    if (DEBUG_BUNDLER) {
      console.log('[JamEventBundler] Flushing', eventsToSend.length, 'event(s)');
    }
    
    // Send via callback
    this.sendBundle(eventsToSend);
  }

  /**
   * Flush immediately (used on stop/cleanup)
   * Same as flush() but with explicit naming
   */
  flushNow() {
    this.flush();
  }

  /**
   * Get current queue size (for debugging)
   * 
   * @returns {number} Number of events in queue
   */
  getQueueSize() {
    return this.queue.length;
  }

  /**
   * Check if bundler is started
   * 
   * @returns {boolean} True if started
   */
  isStarted() {
    return this.started;
  }
}

