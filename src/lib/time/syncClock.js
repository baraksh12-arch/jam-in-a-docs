import { supabase } from '@/api/supabaseClient';

/**
 * Shared Clock Synchronization
 * 
 * Implements client-server clock sync using Supabase server time as reference.
 * Uses ping-pong messages to measure RTT and calculate time offset.
 * 
 * Time Offset Calculation:
 * - timeOffset = serverTime - localClientTime
 * - syncedNow() = performance.now() + timeOffset
 * 
 * This ensures all clients share the same time reference, matching Google Shared Piano behavior.
 */

/**
 * ClockSyncManager class
 * Manages shared clock synchronization across all clients
 */
export class ClockSyncManager {
  constructor(roomId, userId) {
    this.roomId = roomId;
    this.userId = userId;
    
    /** @type {number} Current time offset (serverTime - localTime) in milliseconds */
    this.timeOffset = 0;
    
    /** @type {number} Smoothed time offset using Kalman filter */
    this.smoothedOffset = 0;
    
    /** @type {number} Kalman filter uncertainty */
    this.kalmanUncertainty = 10.0; // Initial uncertainty: 10ms
    
    /** @type {number} Last sync timestamp */
    this.lastSyncTime = 0;
    
    /** @type {number} Sync interval in milliseconds (3-5 seconds, adaptive) */
    this.syncInterval = 3000; // Start with 3 seconds
    
    /** @type {number|null} Sync interval timer ID */
    this.syncTimer = null;
    
    /** @type {boolean} Whether sync is active */
    this.isActive = false;
    
    /** @type {Array<{rtt: number, offset: number, timestamp: number}>} Recent sync measurements */
    this.recentMeasurements = [];
    
    /** @type {number} Maximum number of measurements to keep */
    this.maxMeasurements = 10;
    
    /** @type {Map<string, {rtt: number, jitter: number, offset: number}>} Per-peer latency stats */
    this.peerStats = new Map();
    
    /** @type {Function|null} Supabase channel unsubscribe function */
    this.channelUnsubscribe = null;
    
    /** @type {Map<string, {localTime: number, serverTime: number}>} Pending sync requests */
    this.pendingSyncs = new Map();
  }

  /**
   * Start clock synchronization
   * 
   * @returns {Promise<void>}
   */
  async start() {
    if (this.isActive) {
      console.warn('[ClockSyncManager] Already started');
      return;
    }

    this.isActive = true;
    
    // Set up Supabase Realtime channel for time sync
    await this.setupSyncChannel();
    
    // Perform initial sync
    await this.performSync();
    
    // Start periodic sync
    this.startPeriodicSync();
    
    console.log('[ClockSyncManager] Clock sync started');
  }

  /**
   * Stop clock synchronization
   */
  stop() {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;
    
    // Stop periodic sync
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    
    // Unsubscribe from channel
    if (this.channelUnsubscribe) {
      this.channelUnsubscribe();
      this.channelUnsubscribe = null;
    }
    
    console.log('[ClockSyncManager] Clock sync stopped');
  }

  /**
   * Set up Supabase Realtime channel for time sync messages
   * 
   * @returns {Promise<void>}
   */
  async setupSyncChannel() {
    const channelName = `timesync:${this.roomId}`;
    const channel = supabase.channel(channelName);

    // Listen for time sync responses
    channel.on('broadcast', { event: 'timesync-response' }, (payload) => {
      this.handleSyncResponse(payload.payload);
    });

    // Listen for time sync requests (we can respond to help other clients)
    channel.on('broadcast', { event: 'timesync-request' }, (payload) => {
      this.handleSyncRequest(payload.payload);
    });

    await channel.subscribe();
    
    this.channelUnsubscribe = () => {
      supabase.removeChannel(channel);
    };
  }

  /**
   * Perform a clock sync by querying Supabase server time
   * Includes fallbacks for high-latency environments
   * 
   * @returns {Promise<void>}
   */
  async performSync() {
    if (!this.isActive) {
      return;
    }

    try {
      // Method 1: Use Supabase database query to get server time
      // We'll query a simple table to get the server's current timestamp
      const localTimeBefore = performance.now();
      
      // Query Supabase to get server time (using a simple query that returns server timestamp)
      // Use a timeout for high-latency environments
      const queryPromise = supabase
        .from('rooms')
        .select('updated_at')
        .eq('id', this.roomId)
        .single();
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), 5000)
      );
      
      let data, error;
      try {
        const result = await Promise.race([queryPromise, timeoutPromise]);
        data = result.data;
        error = result.error;
      } catch (timeoutError) {
        console.warn('[ClockSyncManager] Server time query timeout, using fallback');
        // Fallback: Use peer-to-peer sync or local time
        this.performPeerSync();
        return;
      }
      
      const localTimeAfter = performance.now();
      const rtt = localTimeAfter - localTimeBefore;
      
      // High-latency fallback: If RTT > 500ms, use peer sync instead
      if (rtt > 500) {
        console.warn(`[ClockSyncManager] High RTT (${rtt}ms), using peer sync fallback`);
        this.performPeerSync();
        return;
      }
      
      if (error) {
        console.warn('[ClockSyncManager] Failed to get server time:', error);
        // Fallback: Use peer-to-peer sync
        this.performPeerSync();
        return;
      }
      
      // Get server time from the updated_at timestamp
      const serverTime = new Date(data.updated_at).getTime();
      const localTime = Date.now();
      
      // Calculate time offset (serverTime - localTime)
      // Account for RTT: assume server processed at midpoint
      const estimatedServerTime = serverTime + (rtt / 2);
      const offset = estimatedServerTime - localTime;
      
      // Reject outliers: if offset is > 5 seconds, likely an error
      if (Math.abs(offset) > 5000) {
        console.warn(`[ClockSyncManager] Rejecting outlier offset: ${offset}ms`);
        // Use peer sync instead
        this.performPeerSync();
        return;
      }
      
      // Update with Kalman filter
      this.updateOffset(offset, rtt);
      
      // Store measurement
      this.recentMeasurements.push({
        rtt,
        offset,
        timestamp: performance.now(),
      });
      
      // Keep only recent measurements
      if (this.recentMeasurements.length > this.maxMeasurements) {
        this.recentMeasurements.shift();
      }
      
      // Adapt sync interval based on jitter
      this.adaptSyncInterval();
      
      this.lastSyncTime = performance.now();
      
    } catch (error) {
      console.error('[ClockSyncManager] Sync error:', error);
      // Fallback: Use peer-to-peer sync
      this.performPeerSync();
    }
  }

  /**
   * Fallback: Perform peer-to-peer time sync
   * Sends time sync request via Supabase Realtime
   */
  performPeerSync() {
    if (!this.isActive) {
      return;
    }

    const syncId = `${this.userId}-${Date.now()}`;
    const localTime = performance.now();
    
    // Store pending sync
    this.pendingSyncs.set(syncId, {
      localTime,
      serverTime: null, // Will be set when we get response
    });
    
    // Send sync request via Supabase Realtime
    const channelName = `timesync:${this.roomId}`;
    const channel = supabase.channel(channelName);
    
    channel.send({
      type: 'broadcast',
      event: 'timesync-request',
      payload: {
        from: this.userId,
        syncId,
        localTime,
        timestamp: Date.now(),
      },
    });
    
    // Timeout after 2 seconds
    setTimeout(() => {
      this.pendingSyncs.delete(syncId);
    }, 2000);
  }

  /**
   * Handle time sync response from another peer
   * 
   * @param {Object} payload - Response payload
   */
  handleSyncResponse(payload) {
    if (payload.syncId && this.pendingSyncs.has(payload.syncId)) {
      const pending = this.pendingSyncs.get(payload.syncId);
      const localTimeNow = performance.now();
      const rtt = localTimeNow - pending.localTime;
      
      // Calculate offset from peer's server time
      if (payload.serverTime) {
        const estimatedServerTime = payload.serverTime + (rtt / 2);
        const localTime = Date.now();
        const offset = estimatedServerTime - localTime;
        
        this.updateOffset(offset, rtt);
        this.pendingSyncs.delete(payload.syncId);
      }
    }
  }

  /**
   * Handle time sync request from another peer
   * Respond with our current server time estimate
   * 
   * @param {Object} payload - Request payload
   */
  handleSyncRequest(payload) {
    if (payload.from === this.userId) {
      return; // Ignore our own requests
    }

    // Respond with our current server time estimate
    const channelName = `timesync:${this.roomId}`;
    const channel = supabase.channel(channelName);
    
    const serverTimeEstimate = this.getSyncedTime(); // Our estimate of server time
    
    channel.send({
      type: 'broadcast',
      event: 'timesync-response',
      payload: {
        from: this.userId,
        syncId: payload.syncId,
        serverTime: serverTimeEstimate,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Update time offset using Kalman filter
   * 
   * @param {number} measuredOffset - Measured time offset
   * @param {number} rtt - Round-trip time
   */
  updateOffset(measuredOffset, rtt) {
    // Process noise (how much we expect offset to drift)
    const processNoise = 0.5; // 0.5ms^2
    
    // Measurement noise (how much we trust the measurement)
    // Higher RTT = less trust
    const measurementNoise = Math.max(2.0, rtt * 0.1); // At least 2ms^2, scales with RTT
    
    // Prediction step: offset drifts slightly
    const predictedOffset = this.smoothedOffset;
    const predictedUncertainty = this.kalmanUncertainty + processNoise;
    
    // Update step: combine prediction with measurement
    const kalmanGain = predictedUncertainty / (predictedUncertainty + measurementNoise);
    const newOffset = predictedOffset + kalmanGain * (measuredOffset - predictedOffset);
    const newUncertainty = (1 - kalmanGain) * predictedUncertainty;
    
    // Update state
    this.smoothedOffset = newOffset;
    this.kalmanUncertainty = newUncertainty;
    this.timeOffset = newOffset; // Use smoothed offset
    
    // Update peer stats (if we have peer info)
    // For now, we'll track overall stats
  }

  /**
   * Adapt sync interval based on jitter
   * Higher jitter = more frequent syncs
   */
  adaptSyncInterval() {
    if (this.recentMeasurements.length < 3) {
      return; // Need at least 3 measurements
    }

    // Calculate jitter (standard deviation of offsets)
    const offsets = this.recentMeasurements.map(m => m.offset);
    const mean = offsets.reduce((a, b) => a + b, 0) / offsets.length;
    const variance = offsets.reduce((sum, offset) => sum + Math.pow(offset - mean, 2), 0) / offsets.length;
    const jitter = Math.sqrt(variance);
    
    // Adapt interval: more jitter = shorter interval (min 2s, max 5s)
    if (jitter > 50) {
      this.syncInterval = 2000; // 2 seconds for high jitter
    } else if (jitter > 20) {
      this.syncInterval = 3000; // 3 seconds for medium jitter
    } else {
      this.syncInterval = 5000; // 5 seconds for low jitter
    }
  }

  /**
   * Start periodic sync
   */
  startPeriodicSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    
    this.syncTimer = setInterval(() => {
      this.performSync();
    }, this.syncInterval);
  }

  /**
   * Get synced time (server-aligned time)
   * 
   * @returns {number} Server time in milliseconds (Unix timestamp)
   */
  getSyncedTime() {
    const localTime = Date.now();
    return localTime + this.timeOffset;
  }

  /**
   * Get synced time in seconds (for room time calculations)
   * 
   * @returns {number} Server time in seconds
   */
  getSyncedTimeSeconds() {
    return this.getSyncedTime() / 1000;
  }

  /**
   * Get current time offset
   * 
   * @returns {number} Time offset in milliseconds
   */
  getTimeOffset() {
    return this.timeOffset;
  }

  /**
   * Get latency statistics
   * 
   * @returns {Object} Stats object
   */
  getStats() {
    if (this.recentMeasurements.length === 0) {
      return {
        offset: this.timeOffset,
        smoothedOffset: this.smoothedOffset,
        uncertainty: this.kalmanUncertainty,
        syncInterval: this.syncInterval,
        lastSyncTime: this.lastSyncTime,
        measurementCount: 0,
        avgRTT: 0,
        jitter: 0,
      };
    }

    const rtts = this.recentMeasurements.map(m => m.rtt);
    const offsets = this.recentMeasurements.map(m => m.offset);
    
    const avgRTT = rtts.reduce((a, b) => a + b, 0) / rtts.length;
    const meanOffset = offsets.reduce((a, b) => a + b, 0) / offsets.length;
    const variance = offsets.reduce((sum, offset) => sum + Math.pow(offset - meanOffset, 2), 0) / offsets.length;
    const jitter = Math.sqrt(variance);
    
    return {
      offset: this.timeOffset,
      smoothedOffset: this.smoothedOffset,
      uncertainty: this.kalmanUncertainty,
      syncInterval: this.syncInterval,
      lastSyncTime: this.lastSyncTime,
      measurementCount: this.recentMeasurements.length,
      avgRTT,
      jitter,
    };
  }

  /**
   * Get per-peer latency stats
   * 
   * @returns {Map<string, Object>} Peer ID -> stats
   */
  getPeerStats() {
    return this.peerStats;
  }
}

