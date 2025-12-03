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
 * Safety offset in milliseconds for scheduling notes
 * This is jitter protection and must stay very small to meet latency targets
 * Ultra-low latency tuning: reduced from 5ms to 2ms for tighter scheduling
 */
export const SAFETY_OFFSET_MS = 2; // 2ms safety offset

/**
 * Immediate playback threshold in seconds
 * If targetAudioTime is within this threshold of currentTime, play immediately
 * Ultra-low latency tuning: reduced from 3ms to 1ms for faster response
 */
export const IMMEDIATE_PLAYBACK_THRESHOLD_SECONDS = 0.001; // 1ms

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
    
    /** @type {number} EMA smoothing factor (0.6 = 60% new sample, 40% previous) */
    // Ultra-low latency tuning: increased from 0.3 to 0.6 for faster adaptation to network conditions
    this.latencyAlpha = 0.6;
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
   * This should be called after receiving a pong response
   * 
   * @param {string} peerId - Peer user ID
   * @param {number} latencyMs - Measured latency in milliseconds
   */
  updateLatency(peerId, latencyMs) {
    if (!this.registeredPeers.has(peerId)) {
      console.warn(`[ClockSync] Updating latency for unregistered peer: ${peerId}`);
    }
    
    // Use exponential moving average for smoother updates
    const currentLatency = this.peerLatencies.get(peerId) || 50;
    const alpha = this.latencyAlpha;
    const smoothedLatency = currentLatency * (1 - alpha) + latencyMs * alpha;
    
    this.peerLatencies.set(peerId, smoothedLatency);
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

