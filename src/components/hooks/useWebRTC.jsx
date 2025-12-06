import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { initSignaling } from '@/lib/webrtcSignaling';
import { WebRTCManager } from '@/lib/webrtcManager';
import { ClockSync } from '@/lib/clockSync';
import { ClockSyncManager } from '@/lib/time/syncClock';
import { initSyncedNow } from '@/lib/time/syncedNow';

/**
 * useWebRTC Hook
 * 
 * This hook is the "bridge" between React and the WebRTC core modules.
 * It manages WebRTC connections for the current room and user.
 * 
 * Key responsibilities:
 * - Initialize signaling and WebRTCManager
 * - Track peer connections (add/remove peers as they join/leave)
 * - Expose simple API for sending/receiving jam events
 * - Manage clock synchronization for room time
 * 
 * This hook must stay lightweight and not block rendering.
 * All heavy work is done in the WebRTC core modules.
 */

/**
 * @param {Object} options
 * @param {string} options.roomId - Room ID
 * @param {string} options.userId - Current user ID
 * @param {Array} options.peers - Array of player objects from useRoomState
 * @param {Object|null} options.room - Room object from useRoomState (for room start timestamp)
 * @returns {Object} WebRTC API
 */
export function useWebRTC({ roomId, userId, peers = [], room = null }) {
  const [connectionStates, setConnectionStates] = useState(new Map());
  
  const signalingRef = useRef(null);
  const managerRef = useRef(null);
  const clockSyncRef = useRef(null);
  const clockSyncManagerRef = useRef(null); // New shared clock sync manager
  const jamEventCallbacksRef = useRef(new Set());
  const claimEventCallbacksRef = useRef(new Set());

  // Initialize WebRTC components (only on client)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!roomId || !userId) {
      console.log('[useWebRTC] Skipping initialization - missing roomId or userId:', { roomId, userId });
      return;
    }

    // PHASE 2: Wrap initialization in try-catch to prevent crashes
    // PHASE 2: Ensure peers is always an array (even if empty) - this is safe
    console.log('[useWebRTC] Initializing with:', { roomId, userId, peersCount: peers?.length || 0 });
    try {
      // Initialize clock sync with userId (for peer latency measurement)
      const clockSync = new ClockSync(userId);
      clockSyncRef.current = clockSync;

      // Initialize shared clock sync manager (for server time synchronization)
      const clockSyncManager = new ClockSyncManager(roomId, userId);
      clockSyncManagerRef.current = clockSyncManager;
      
      // Initialize syncedNow() with the manager
      initSyncedNow(clockSyncManager);
      
      // Start clock synchronization
      clockSyncManager.start().catch(error => {
        console.error('[useWebRTC] Failed to start clock sync:', error);
        // Continue anyway - will fall back to local time
      });

      // Get room start timestamp from room data
      // Fallback to current time if room data not available yet
      if (room?.createdAt) {
        const roomStartMs = new Date(room.createdAt).getTime();
        clockSync.setRoomStartTimestamp(roomStartMs);
      } else if (room?.created_at) {
        // Handle snake_case format from database
        const roomStartMs = new Date(room.created_at).getTime();
        clockSync.setRoomStartTimestamp(roomStartMs);
      } else {
        // Fallback: use current time (will be corrected when room data loads)
        clockSync.setRoomStartTimestamp(Date.now());
      }

      // Initialize signaling
      const signaling = initSignaling(roomId, userId);
      signalingRef.current = signaling;

      // Initialize WebRTC manager
      const manager = new WebRTCManager({
        roomId,
        userId,
        signaling,
        clockSync, // Pass clockSync for ping/pong handling
        onJamEvent: (event, fromPeerId) => {
          // Notify all registered callbacks
          jamEventCallbacksRef.current.forEach(callback => {
            try {
              callback(event, fromPeerId);
            } catch (error) {
              console.error('Error in jam event callback:', error);
            }
          });
        },
        onClaimEvent: (event) => {
          // Notify all registered claim event callbacks
          claimEventCallbacksRef.current.forEach(callback => {
            try {
              callback(event);
            } catch (error) {
              console.error('Error in claim event callback:', error);
            }
          });
        },
        onPeerConnectionChange: (peerId, state) => {
          setConnectionStates(prev => {
            const next = new Map(prev);
            next.set(peerId, state);
            return next;
          });
        }
      });
      managerRef.current = manager;
      
      console.log('[useWebRTC] Successfully initialized WebRTC components');
    } catch (error) {
      console.error('[useWebRTC] Error initializing WebRTC components:', error);
      // Don't throw - allow component to render with degraded functionality
    }

    return () => {
      // Cleanup on unmount
      if (managerRef.current) {
        managerRef.current.destroy();
        managerRef.current = null;
      }
      if (signalingRef.current) {
        signalingRef.current.disconnect();
        signalingRef.current = null;
      }
      if (clockSyncManagerRef.current) {
        clockSyncManagerRef.current.stop();
        clockSyncManagerRef.current = null;
      }
      clockSyncRef.current = null;
      jamEventCallbacksRef.current.clear();
      claimEventCallbacksRef.current.clear();
    };
  }, [roomId, userId]); // Only re-init if roomId or userId changes

  // Update room start timestamp when room data loads
  useEffect(() => {
    if (!clockSyncRef.current) return;
    
    const roomStart = room?.createdAt || room?.created_at;
    if (roomStart) {
      const roomStartMs = new Date(roomStart).getTime();
      clockSyncRef.current.setRoomStartTimestamp(roomStartMs);
    }
  }, [room?.createdAt, room?.created_at]);

  // Manage peer connections based on peers list
  useEffect(() => {
    if (!managerRef.current) {
      console.log('[useWebRTC] Manager not initialized yet');
      return;
    }

    // PHASE 2: Ensure peers is always an array
    if (!Array.isArray(peers)) {
      console.warn('[useWebRTC] Peers is not an array, using empty array:', peers);
      return; // Will retry when peers becomes an array
    }

    const manager = managerRef.current;
    const clockSync = clockSyncRef.current;

    // Derive stable target peer IDs (only user IDs, sorted for consistency)
    const targetPeerIds = [...new Set(
      (peers || [])
        .filter(p => {
          const peerUserId = p.userId || p.user_id || p.id;
          const isPlayer = p.isPlayer !== false && p.is_player !== false;
          return peerUserId && String(peerUserId) !== String(userId) && isPlayer;
        })
        .map(p => String(p.userId || p.user_id || p.id))
    )].sort();

    // Get current peer IDs from manager (all states, not just connected)
    const currentPeerIds = [...new Set(
      (manager.getAllPeerIds() || [])
        .map(id => String(id))
    )].sort();

    console.log('[useWebRTC] Peer management:', {
      targetPeerIds,
      currentPeerIds,
      targetCount: targetPeerIds.length,
      currentCount: currentPeerIds.length
    });

    // Add new peers (only those not in current set)
    targetPeerIds.forEach(peerIdStr => {
      if (!currentPeerIds.includes(peerIdStr)) {
        console.log(`[useWebRTC] Adding new peer: ${peerIdStr}`);
        manager.addPeer(peerIdStr);
        if (clockSync) {
          clockSync.registerPeer(peerIdStr);
        }
      }
    });

    // Remove peers that are no longer in target list
    currentPeerIds.forEach(peerIdStr => {
      if (!targetPeerIds.includes(peerIdStr)) {
        console.log(`[useWebRTC] Removing peer that left: ${peerIdStr}`);
        manager.removePeer(peerIdStr);
        if (clockSync) {
          clockSync.removePeer(peerIdStr);
        }
      }
    });
  }, [peers, userId]); // Only depend on peers and userId, not connectionStates or ready

  /**
   * Send a jam event to all connected peers
   * 
   * @param {Object} event - Jam event object
   */
  const sendJamEvent = useCallback((event) => {
    if (managerRef.current) {
      managerRef.current.sendJamEvent(event);
    }
  }, []);

  /**
   * Register callback for incoming jam events
   * 
   * @param {function(Object, string): void} callback - Callback function
   * @returns {function(): void} Unsubscribe function
   */
  const onJamEvent = useCallback((callback) => {
    jamEventCallbacksRef.current.add(callback);
    
    return () => {
      jamEventCallbacksRef.current.delete(callback);
    };
  }, []);

  /**
   * Register callback for incoming claim events
   * 
   * @param {function(Object): void} callback - Callback function
   * @returns {function(): void} Unsubscribe function
   */
  const onClaimEvent = useCallback((callback) => {
    claimEventCallbacksRef.current.add(callback);
    
    return () => {
      claimEventCallbacksRef.current.delete(callback);
    };
  }, []);

  /**
   * Send a claim event to all connected peers
   * 
   * @param {Object} event - Claim event object
   */
  const sendClaimEvent = useCallback((event) => {
    if (managerRef.current) {
      managerRef.current.sendClaimEvent(event);
    }
  }, []);

  /**
   * Get current room time in seconds
   * 
   * @returns {number} Room time in seconds
   */
  const getRoomTime = useCallback(() => {
    if (clockSyncRef.current) {
      return clockSyncRef.current.getRoomTime();
    }
    return 0;
  }, []);

  /**
   * Get latency to a peer
   * 
   * @param {string} peerId - Peer user ID
   * @returns {number} Latency in milliseconds
   */
  const getLatency = useCallback((peerId) => {
    if (clockSyncRef.current) {
      return clockSyncRef.current.getLatency(peerId);
    }
    return 50; // Default latency
  }, []);

  /**
   * Compute target audio time for scheduling a remote note
   * 
   * @param {number} roomTimeFromMessage - Room time from the jam event (seconds)
   * @param {AudioContext} audioContext - Web Audio API AudioContext
   * @param {string} [peerId] - Optional peer ID for latency lookup
   * @returns {number} Target audio time in seconds
   */
  const computeTargetAudioTime = useCallback((roomTimeFromMessage, audioContext, peerId = null) => {
    if (clockSyncRef.current && audioContext) {
      return clockSyncRef.current.computeTargetAudioTime(roomTimeFromMessage, audioContext, peerId);
    }
    // Fallback: return current time if clockSync not available
    return audioContext ? audioContext.currentTime : 0;
  }, []);

  // Compute ready state: true if at least one peer is connected
  // This is computed from connectionStates, not stored in state to avoid unnecessary re-renders
  const ready = useMemo(() => {
    const states = Array.from(connectionStates.values());
    const hasConnectedPeer = states.some(state => state === 'connected');
    return hasConnectedPeer;
  }, [connectionStates]);

  return {
    ready,
    connectionStates: Object.fromEntries(connectionStates),
    sendJamEvent,
    onJamEvent,
    sendClaimEvent,
    onClaimEvent,
    getRoomTime,
    getLatency,
    computeTargetAudioTime
  };
}
