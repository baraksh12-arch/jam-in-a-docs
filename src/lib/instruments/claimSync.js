import { syncedNow } from '@/lib/time/syncedNow';

/**
 * Instrument Claim Synchronization
 * 
 * Handles real-time instrument claim/release events across all peers.
 * Ensures silent refresh of peer connections without UI disruption.
 */

/**
 * Debug flag for claim sync logging
 */
const DEBUG_CLAIM_SYNC = true;

/**
 * ClaimSyncManager class
 * Manages instrument claim state and silent peer refresh
 */
export class ClaimSyncManager {
  constructor(roomId, userId) {
    this.roomId = roomId;
    this.userId = userId;
    
    /** @type {Map<string, string>} Instrument -> userId (who has it claimed) */
    this.claimedBy = new Map();
    
    /** @type {Set<Function>} Callbacks for claim changes */
    this.claimChangeCallbacks = new Set();
    
    /** @type {Set<Function>} Callbacks for routing refresh */
    this.routingRefreshCallbacks = new Set();
    
    /** @type {Map<string, number>} Instrument -> last claim timestamp */
    this.lastClaimTime = new Map();
    
    /** @type {boolean} Whether manager is active */
    this.isActive = false;
  }

  /**
   * Start the claim sync manager
   * 
   * @param {Function} sendClaimEvent - Function to send claim events (via WebRTC or Supabase)
   * @param {Function} onClaimEvent - Function to receive claim events
   */
  start(sendClaimEvent, onClaimEvent) {
    if (this.isActive) {
      console.warn('[ClaimSyncManager] Already started');
      return;
    }

    this.isActive = true;
    this.sendClaimEvent = sendClaimEvent;
    
    // Set up listener for incoming claim events
    if (onClaimEvent) {
      onClaimEvent((event) => {
        this.handleClaimEvent(event);
      });
    }
    
    if (DEBUG_CLAIM_SYNC) {
      console.log('[ClaimSyncManager] Started for room:', this.roomId);
    }
  }

  /**
   * Stop the claim sync manager
   */
  stop() {
    this.isActive = false;
    this.claimChangeCallbacks.clear();
    this.routingRefreshCallbacks.clear();
    this.claimedBy.clear();
    
    if (DEBUG_CLAIM_SYNC) {
      console.log('[ClaimSyncManager] Stopped');
    }
  }

  /**
   * Broadcast a claim event
   * 
   * @param {string} instrument - Instrument name
   * @param {boolean} isClaim - True if claiming, false if releasing
   */
  broadcastClaim(instrument, isClaim) {
    if (!this.isActive || !this.sendClaimEvent) {
      console.warn('[ClaimSyncManager] Not active or sendClaimEvent not set');
      return;
    }

    const event = {
      type: 'instrument-claim',
      instrument,
      userId: this.userId,
      isClaim, // true = claim, false = release
      timestamp: syncedNow(),
    };

    // Update local state immediately
    if (isClaim) {
      this.claimedBy.set(instrument, this.userId);
      this.lastClaimTime.set(instrument, event.timestamp);
    } else {
      this.claimedBy.delete(instrument);
      this.lastClaimTime.delete(instrument);
    }

    // Broadcast to all peers
    this.sendClaimEvent(event);

    if (DEBUG_CLAIM_SYNC) {
      console.log('[ClaimSyncManager] Broadcasted claim event:', {
        instrument,
        userId: this.userId,
        isClaim,
        timestamp: event.timestamp,
      });
    }

    // Notify callbacks
    this.notifyClaimChange(instrument, this.userId, isClaim);
  }

  /**
   * Handle incoming claim event from peer
   * 
   * @param {Object} event - Claim event object
   */
  handleClaimEvent(event) {
    if (!this.isActive) {
      return;
    }

    if (event.type !== 'instrument-claim') {
      return;
    }

    // Ignore events from self
    if (event.userId === this.userId) {
      return;
    }

    const { instrument, userId, isClaim, timestamp } = event;

    if (DEBUG_CLAIM_SYNC) {
      console.log('[ClaimSyncManager] Received claim event:', {
        instrument,
        userId,
        isClaim,
        timestamp,
        currentClaim: this.claimedBy.get(instrument),
      });
    }

    // Check if event is stale (older than 5 seconds)
    const now = syncedNow();
    const eventAge = now - timestamp;
    if (eventAge > 5000) {
      if (DEBUG_CLAIM_SYNC) {
        console.warn('[ClaimSyncManager] Ignoring stale claim event:', {
          instrument,
          age: `${eventAge.toFixed(2)}ms`,
        });
      }
      return;
    }

    // Update local state
    const previousOwner = this.claimedBy.get(instrument);
    
    if (isClaim) {
      // Claiming
      this.claimedBy.set(instrument, userId);
      this.lastClaimTime.set(instrument, timestamp);
      
      // If we were using this instrument, we need to release it
      if (previousOwner === this.userId) {
        if (DEBUG_CLAIM_SYNC) {
          console.log('[ClaimSyncManager] Instrument claimed by another user, releasing our claim:', instrument);
        }
        // Eject gracefully - notify that we lost the instrument
        this.notifyEjection(instrument, userId);
      }
      
      // If peer previously connected to this instrument, refresh routing
      // This triggers silent peer refresh (no UI disruption)
      if (previousOwner && previousOwner !== userId) {
        if (DEBUG_CLAIM_SYNC) {
          console.log('[ClaimSyncManager] Instrument ownership changed, triggering silent refresh:', {
            instrument,
            from: previousOwner,
            to: userId,
          });
        }
        this.notifyRoutingRefresh(instrument, previousOwner, userId);
      } else if (!previousOwner) {
        // New claim (instrument was unclaimed)
        if (DEBUG_CLAIM_SYNC) {
          console.log('[ClaimSyncManager] Instrument claimed (was unclaimed):', {
            instrument,
            by: userId,
          });
        }
        // Notify routing refresh for new claim
        this.notifyRoutingRefresh(instrument, null, userId);
      }
    } else {
      // Releasing
      if (previousOwner === userId) {
        this.claimedBy.delete(instrument);
        this.lastClaimTime.delete(instrument);
        
        if (DEBUG_CLAIM_SYNC) {
          console.log('[ClaimSyncManager] Instrument released:', instrument);
        }
      }
    }

    // Notify callbacks of claim change
    this.notifyClaimChange(instrument, userId, isClaim);
  }

  /**
   * Get current claim map
   * 
   * @returns {Map<string, string>} Instrument -> userId
   */
  getClaimMap() {
    return new Map(this.claimedBy);
  }

  /**
   * Get who has an instrument claimed
   * 
   * @param {string} instrument - Instrument name
   * @returns {string|undefined} User ID or undefined if not claimed
   */
  getClaimedBy(instrument) {
    return this.claimedBy.get(instrument);
  }

  /**
   * Check if instrument is available
   * 
   * @param {string} instrument - Instrument name
   * @returns {boolean} True if available
   */
  isAvailable(instrument) {
    return !this.claimedBy.has(instrument);
  }

  /**
   * Initialize claim map from current players state
   * Called on reconnect or initial load
   * 
   * @param {Array} players - Array of player objects with instrument property
   */
  initializeFromPlayers(players) {
    this.claimedBy.clear();
    this.lastClaimTime.clear();

    for (const player of players) {
      const playerUserId = player.userId || player.user_id || player.id;
      const instrument = player.instrument;
      
      if (instrument && playerUserId) {
        this.claimedBy.set(instrument, playerUserId);
        this.lastClaimTime.set(instrument, syncedNow());
      }
    }

    if (DEBUG_CLAIM_SYNC) {
      console.log('[ClaimSyncManager] Initialized claim map from players:', {
        claimMap: Object.fromEntries(this.claimedBy),
      });
    }
  }

  /**
   * Restore previous claim if still available
   * Called on reconnect
   * 
   * @param {string} previousInstrument - Previously claimed instrument
   * @returns {boolean} True if successfully restored
   */
  restoreClaim(previousInstrument) {
    if (!previousInstrument) {
      return false;
    }

    // Check if instrument is still available
    if (this.isAvailable(previousInstrument)) {
      // Restore claim
      this.broadcastClaim(previousInstrument, true);
      return true;
    }

    if (DEBUG_CLAIM_SYNC) {
      console.log('[ClaimSyncManager] Could not restore claim, instrument taken:', previousInstrument);
    }

    return false;
  }

  /**
   * Register callback for claim changes
   * 
   * @param {Function} callback - Callback function (instrument, userId, isClaim)
   * @returns {Function} Unsubscribe function
   */
  onClaimChange(callback) {
    this.claimChangeCallbacks.add(callback);
    
    return () => {
      this.claimChangeCallbacks.delete(callback);
    };
  }

  /**
   * Register callback for routing refresh
   * 
   * @param {Function} callback - Callback function (instrument, fromUserId, toUserId)
   * @returns {Function} Unsubscribe function
   */
  onRoutingRefresh(callback) {
    this.routingRefreshCallbacks.add(callback);
    
    return () => {
      this.routingRefreshCallbacks.delete(callback);
    };
  }

  /**
   * Notify all claim change callbacks
   * 
   * @param {string} instrument - Instrument name
   * @param {string} userId - User ID
   * @param {boolean} isClaim - True if claiming
   */
  notifyClaimChange(instrument, userId, isClaim) {
    this.claimChangeCallbacks.forEach(callback => {
      try {
        callback(instrument, userId, isClaim);
      } catch (error) {
        console.error('[ClaimSyncManager] Error in claim change callback:', error);
      }
    });
  }

  /**
   * Notify all routing refresh callbacks
   * 
   * @param {string} instrument - Instrument name
   * @param {string} fromUserId - Previous owner
   * @param {string} toUserId - New owner
   */
  notifyRoutingRefresh(instrument, fromUserId, toUserId) {
    this.routingRefreshCallbacks.forEach(callback => {
      try {
        callback(instrument, fromUserId, toUserId);
      } catch (error) {
        console.error('[ClaimSyncManager] Error in routing refresh callback:', error);
      }
    });
  }

  /**
   * Notify that current user was ejected from instrument
   * 
   * @param {string} instrument - Instrument name
   * @param {string} newOwnerId - New owner user ID
   */
  notifyEjection(instrument, newOwnerId) {
    if (DEBUG_CLAIM_SYNC) {
      console.log('[ClaimSyncManager] User ejected from instrument:', {
        instrument,
        newOwner: newOwnerId,
      });
    }

    // Notify via claim change callback (with isClaim = false for ejection)
    this.notifyClaimChange(instrument, this.userId, false);
  }
}

// Singleton instance (shared across the app)
let claimSyncManager = null;

/**
 * Get or create the singleton ClaimSyncManager instance
 * 
 * @param {string} roomId - Room ID
 * @param {string} userId - User ID
 * @returns {ClaimSyncManager} ClaimSyncManager instance
 */
export function getClaimSyncManager(roomId, userId) {
  if (!claimSyncManager || claimSyncManager.roomId !== roomId || claimSyncManager.userId !== userId) {
    if (claimSyncManager) {
      claimSyncManager.stop();
    }
    claimSyncManager = new ClaimSyncManager(roomId, userId);
  }
  return claimSyncManager;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetClaimSyncManager() {
  if (claimSyncManager) {
    claimSyncManager.stop();
  }
  claimSyncManager = null;
}

