/**
 * Clock Synchronization
 * 
 * Manages room time and latency estimation for synchronized audio playback.
 * 
 * Room Time:
 * - "Room time" is the number of seconds since the room started
 * - All players use the same room start timestamp (from Supabase rooms.created_at)
 * - This ensures all players' audio is aligned to the same musical timeline
 * 
 * Latency Estimation:
 * - Players ping each other to measure network delay
 * - Latency is used when scheduling notes: we add it to the target time
 * - This compensates for network delay so notes play in sync
 * 
 * Safety Offset:
 * - We add a small safety buffer (5ms) when scheduling notes
 * - This accounts for jitter, processing time, and clock drift
 * - Must stay very small to meet app-added latency target of ≤ 5ms
 */

/**
 * Helper to check if latency mode requires clock synchronization
 * 
 * @param {string} mode - Latency mode (from LATENCY_MODES)
 * @returns {boolean} True if mode requires clock sync
 */
export function isLatencyModeSynced(mode) {
  return mode === 'SYNCED';
}

/**
 * Safety offset in milliseconds for scheduling notes
 * This is jitter protection and must stay very small to meet latency targets
 * STEP 2.2: Reduced to 1.0ms for ultra-low latency (configurable)
 */
export const SAFETY_OFFSET_MS = 1.0; // 1.0ms safety offset

/**
 * Immediate playback threshold in seconds
 * If targetAudioTime is within this threshold of currentTime, play immediately
 * STEP 2.2: Reduced to 0.5ms for ultra-low latency (configurable)
 */
export const IMMEDIATE_PLAYBACK_THRESHOLD_SECONDS = 0.0005; // 0.5ms

/**
 * ClockSync class for managing room time and peer latency
 */
export class ClockSync {
  constructor(userId) {
    /** @type {string} Current user ID */
    this.userId = userId;
    
    /** @type {number|null} Room start timestamp (ms) from Supabase */
    this.roomStartTimestamp = null;
    
    /** @type {Map<string, number>} Peer ID -> latency in milliseconds */
    this.peerLatencies = new Map();
    
    /** @type {Set<string>} Registered peer IDs */
    this.registeredPeers = new Set();
    
    /** @type {Map<string, number>} Peer ID -> pending ping timestamp */
    this.pendingPings = new Map();
    
    /** @type {Map<string, number[]>} Peer ID -> array of recent RTT measurements (for median) */
    this.recentRTTs = new Map();
    
    /** @type {Map<string, number>} Peer ID -> Kalman filter state (estimated latency) */
    this.kalmanEstimates = new Map();
    
    /** @type {Map<string, number>} Peer ID -> Kalman filter uncertainty */
    this.kalmanUncertainty = new Map();
    
    /** @type {number} Maximum RTT history to keep per peer */
    this.maxRTTHistory = 5;
    
    /** @type {number} Spike rejection threshold (multiplier of median) */
    this.spikeThreshold = 2.0; // Reject RTTs > 2x median
  }

  /**
   * Set the room start timestamp
   * This should be the rooms.created_at timestamp from Supabase, converted to milliseconds
   * 
   * @param {number} roomStartMs - Room start timestamp in milliseconds (Date.now() format)
   */
  setRoomStartTimestamp(roomStartMs) {
    this.roomStartTimestamp = roomStartMs;
  }

  /**
   * Get current room time in seconds
   * Returns seconds since room start
   * 
   * @returns {number} Room time in seconds, or 0 if not initialized
   */
  getRoomTime() {
    if (this.roomStartTimestamp === null) {
      return 0;
    }
    
    const now = Date.now();
    const elapsedMs = now - this.roomStartTimestamp;
    return elapsedMs / 1000; // Convert to seconds
  }

  /**
   * Get current room time in seconds (alias for getRoomTime)
   * 
   * @returns {number} Room time in seconds, or 0 if not initialized
   */
  getRoomTimeSeconds() {
    return this.getRoomTime();
  }

  /**
   * Register a peer for latency tracking
   * 
   * @param {string} peerId - Peer user ID
   */
  registerPeer(peerId) {
    this.registeredPeers.add(peerId);
    
    // Initialize with a safe default latency (50ms)
    if (!this.peerLatencies.has(peerId)) {
      this.peerLatencies.set(peerId, 50);
    }
  }

  /**
   * Update latency estimate for a peer
   * STEP 2.3: Uses median of last 5 RTTs + Kalman-like smoothing + spike rejection
   * 
   * @param {string} peerId - Peer user ID
   * @param {number} rttMs - Round-trip time in milliseconds (will be halved for one-way)
   */
  updateLatency(peerId, rttMs) {
    if (!this.registeredPeers.has(peerId)) {
      console.warn(`[ClockSync] Updating latency for unregistered peer: ${peerId}`);
    }
    
    // Store RTT history (we'll compute one-way latency from median RTT)
    if (!this.recentRTTs.has(peerId)) {
      this.recentRTTs.set(peerId, []);
    }
    const rttHistory = this.recentRTTs.get(peerId);
    rttHistory.push(rttMs);
    
    // Keep only last N measurements
    if (rttHistory.length > this.maxRTTHistory) {
      rttHistory.shift();
    }
    
    // Compute median RTT (more robust than mean, rejects outliers)
    const sortedRTTs = [...rttHistory].sort((a, b) => a - b);
    const medianRTT = sortedRTTs[Math.floor(sortedRTTs.length / 2)];
    
    // Spike rejection: if current RTT is > 2x median, reject it
    if (rttMs > medianRTT * this.spikeThreshold) {
      // Reject spike - remove it from history
      rttHistory.pop();
      // Use previous median if we have enough history
      if (rttHistory.length >= 3) {
        const prevSorted = [...rttHistory].sort((a, b) => a - b);
        const prevMedian = prevSorted[Math.floor(prevSorted.length / 2)];
        // Continue with previous median
        const oneWayLatency = prevMedian / 2;
        this.applyKalmanFilter(peerId, oneWayLatency);
        return;
      }
      // Not enough history, use current (even if spike)
    }
    
    // Convert RTT to one-way latency
    const oneWayLatency = medianRTT / 2;
    
    // Apply Kalman-like smoothing for stable estimates
    this.applyKalmanFilter(peerId, oneWayLatency);
  }
  
  /**
   * Apply lightweight Kalman-like filter for latency estimation
   * This provides smooth, stable estimates with low drift
   * 
   * @param {string} peerId - Peer user ID
   * @param {number} measuredLatencyMs - Measured one-way latency
   */
  applyKalmanFilter(peerId, measuredLatencyMs) {
    // Initialize Kalman state if needed
    if (!this.kalmanEstimates.has(peerId)) {
      this.kalmanEstimates.set(peerId, measuredLatencyMs);
      this.kalmanUncertainty.set(peerId, 10.0); // Initial uncertainty: 10ms
      this.peerLatencies.set(peerId, measuredLatencyMs);
      return;
    }
    
    const previousEstimate = this.kalmanEstimates.get(peerId);
    const previousUncertainty = this.kalmanUncertainty.get(peerId);
    
    // Process noise (how much we expect latency to drift)
    const processNoise = 0.5; // 0.5ms^2
    
    // Measurement noise (how much we trust the measurement)
    const measurementNoise = 2.0; // 2ms^2
    
    // Prediction step: estimate drifts slightly
    const predictedEstimate = previousEstimate;
    const predictedUncertainty = previousUncertainty + processNoise;
    
    // Update step: combine prediction with measurement
    const kalmanGain = predictedUncertainty / (predictedUncertainty + measurementNoise);
    const newEstimate = predictedEstimate + kalmanGain * (measuredLatencyMs - predictedEstimate);
    const newUncertainty = (1 - kalmanGain) * predictedUncertainty;
    
    // Update state
    this.kalmanEstimates.set(peerId, newEstimate);
    this.kalmanUncertainty.set(peerId, newUncertainty);
    this.peerLatencies.set(peerId, newEstimate);
  }

  /**
   * Get latency estimate for a peer
   * Returns a safe default if unknown
   * 
   * @param {string} peerId - Peer user ID
   * @returns {number} Latency in milliseconds
   */
  getLatency(peerId) {
    return this.peerLatencies.get(peerId) || 50; // Default 50ms if unknown
  }

  /**
   * Get latency estimate for a peer (alias for getLatency)
   * 
   * @param {string} peerId - Peer user ID
   * @returns {number} Latency in milliseconds
   */
  getLatencyMs(peerId) {
    return this.getLatency(peerId);
  }

  /**
   * Remove a peer from tracking
   * 
   * @param {string} peerId - Peer user ID
   */
  removePeer(peerId) {
    this.registeredPeers.delete(peerId);
    this.peerLatencies.delete(peerId);
    this.recentRTTs.delete(peerId);
    this.kalmanEstimates.delete(peerId);
    this.kalmanUncertainty.delete(peerId);
    this.pendingPings.delete(peerId);
  }

  /**
   * Get all registered peers
   * 
   * @returns {string[]} Array of peer IDs
   */
  getRegisteredPeers() {
    return Array.from(this.registeredPeers);
  }

  /**
   * Create a ping message to send to a peer
   * 
   * @param {string} peerId - Target peer ID (for logging, not included in message)
   * @returns {Object} Ping message object
   */
  createPingMessage(peerId) {
    const timestamp = Date.now();
    this.pendingPings.set(peerId, timestamp);
    
    return {
      type: 'ping',
      senderId: this.userId,
      timestamp: timestamp
    };
  }

  /**
   * Handle incoming control message (ping or pong)
   * 
   * @param {Object} msg - Control message object
   * @param {string} fromPeerId - Peer ID that sent the message
   * @returns {Object|null} Response message (pong) if this was a ping, null otherwise
   */
  handleIncomingControlMessage(msg, fromPeerId) {
    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') {
      return null;
    }

    if (msg.type === 'ping') {
      // Received a ping - respond with pong
      return {
        type: 'pong',
        senderId: this.userId,
        originalTimestamp: msg.timestamp,
        timestamp: Date.now()
      };
    } else if (msg.type === 'pong') {
      // Received a pong - calculate latency
      const pingTimestamp = this.pendingPings.get(fromPeerId);
      if (pingTimestamp && msg.originalTimestamp === pingTimestamp) {
        const now = Date.now();
        const roundTripTime = now - pingTimestamp;
        // Latency is half the RTT (one-way delay)
        const latencyMs = roundTripTime / 2;
        
        // Update latency estimate
        this.updateLatency(fromPeerId, latencyMs);
        
        // Remove pending ping
        this.pendingPings.delete(fromPeerId);
        
        // Log latency (throttled to avoid spam)
        if (Math.random() < 0.1) { // Log ~10% of updates
          console.log(`[ClockSync] Latency for peer ${fromPeerId}: ${Math.round(latencyMs)}ms`);
        }
      } else {
        console.warn(`[ClockSync] Received pong with mismatched timestamp from ${fromPeerId}`);
      }
      return null; // No response needed for pong
    }

    return null; // Unknown message type
  }

  /**
   * Compute target audio time for scheduling a remote note
   * 
   * Calculates when a note should play in AudioContext time, accounting for:
   * - Network latency to the sender
   * - Time difference between event's roomTime and current roomTime
   * - Small safety offset to prevent scheduling in the past
   * 
   * @param {number} roomTimeFromMessage - Room time from the jam event (seconds)
   * @param {AudioContext} audioContext - Web Audio API AudioContext
   * @param {string} [peerId] - Optional peer ID for latency lookup
   * @returns {number} Target audio time in seconds (for AudioContext.currentTime)
   */
  computeTargetAudioTime(roomTimeFromMessage, audioContext, peerId = null) {
    const currentRoomTime = this.getRoomTime();
    const audioContextCurrentTime = audioContext.currentTime;
    
    // Get latency to the sender (or default if peerId not provided)
    const latencyMs = peerId ? this.getLatencyMs(peerId) : 50;
    
    // Use the existing computeTargetAudioTime function
    return computeTargetAudioTime({
      audioContextCurrentTime,
      roomTimeFromEvent: roomTimeFromMessage,
      currentRoomTime,
      latencyMs,
      safetyMs: SAFETY_OFFSET_MS
    });
  }
}

/**
 * Compute target audio time for scheduling a note
 * 
 * This function calculates when a note should play in the Web Audio API timeline,
 * accounting for network latency and safety offset.
 * 
 * @param {Object} params
 * @param {number} params.audioContextCurrentTime - Current time from AudioContext (seconds)
 * @param {number} params.roomTimeFromEvent - Room time from the jam event (seconds)
 * @param {number} params.currentRoomTime - Current room time (seconds)
 * @param {number} params.latencyMs - Network latency to sender (milliseconds)
 * @param {number} params.safetyMs - Safety offset in milliseconds (default: SAFETY_OFFSET_MS)
 * @returns {number} Target audio time in seconds (for AudioContext.currentTime)
 */
export function computeTargetAudioTime({
  audioContextCurrentTime,
  roomTimeFromEvent,
  currentRoomTime,
  latencyMs,
  safetyMs = SAFETY_OFFSET_MS
}) {
  // Calculate how far in the future (or past) the event should play
  const timeDelta = roomTimeFromEvent - currentRoomTime; // seconds
  
  // Convert latency and safety to seconds
  const latencySeconds = latencyMs / 1000;
  const safetySeconds = safetyMs / 1000;
  
  // Target time = current audio time + time delta + latency + safety
  // This ensures the note plays at the right musical time, accounting for network delay
  const targetAudioTime = audioContextCurrentTime + timeDelta + latencySeconds + safetySeconds;
  
  // Don't schedule notes in the past (clamp to current time + minimum safety)
  return Math.max(targetAudioTime, audioContextCurrentTime + safetySeconds);
}

// Constants are exported above where they are defined

