import { deserializeEvent } from './jamEventProtocol';

/**
 * Debug flag for WebRTC operations
 * Set to true to enable verbose logging in the hot path
 */
const DEBUG_WEBRTC = false;

/**
 * WebRTC Manager
 * 
 * Manages RTCPeerConnections and DataChannels for player-to-player connections.
 * 
 * Key Design Decisions:
 * - Uses unordered, unreliable DataChannels (ordered: false, maxRetransmits: 0)
 *   This provides the lowest latency for jam events. We don't need reliability
 *   because missing a note is better than late notes (which cause audio glitches).
 * 
 * - Full mesh topology: Each player connects to all other players
 * - One DataChannel per peer connection, named "midi"
 * - All jam events broadcast to all connected peers
 * 
 * This path must stay as fast as possible - no database calls, no heavy processing.
 */

/**
 * @typedef {Object} JamEvent
 * @property {string} type
 * @property {string} instrument
 * @property {number} roomTime
 * @property {string} senderId
 */

/**
 * @typedef {Object} WebRTCManagerOptions
 * @property {string} roomId - Room ID
 * @property {string} userId - Current user ID
 * @property {Object} signaling - Signaling API from initSignaling()
 * @property {function(JamEvent, string): void} onJamEvent - Callback when jam event received
 * @property {function(string, 'connecting'|'connected'|'disconnected'): void} [onPeerConnectionChange] - Optional callback for connection state changes
 * @property {Object} [clockSync] - ClockSync instance for latency measurement
 */

/**
 * WebRTC Manager class
 */
export class WebRTCManager {
  /**
   * @param {WebRTCManagerOptions} options
   */
  constructor(options) {
    this.roomId = options.roomId;
    this.userId = options.userId;
    this.signaling = options.signaling;
    this.onJamEvent = options.onJamEvent;
    this.onPeerConnectionChange = options.onPeerConnectionChange || (() => {});
    this.clockSync = options.clockSync || null;

    /** @type {Map<string, RTCPeerConnection>} Peer ID -> RTCPeerConnection */
    this.peerConnections = new Map();
    
    /** @type {Map<string, RTCDataChannel>} Peer ID -> DataChannel */
    this.dataChannels = new Map();
    
    /** @type {Set<string>} Peers we've initiated connection to */
    this.initiatedConnections = new Set();
    
    /** @type {Map<string, 'connecting'|'connected'|'disconnected'>} Peer connection states */
    this.connectionStates = new Map();

    /** @type {Map<string, number>} Peer ID -> ping interval ID */
    this.pingIntervals = new Map();

    // Listen for signaling messages
    this.signalingUnsubscribe = this.signaling.onSignal((signal) => {
      this.handleSignal(signal);
    });

    // STUN server configuration
    this.iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ];
  }

  /**
   * Add a peer and initiate connection if needed
   * Idempotent: safe to call multiple times for the same peer
   * 
   * @param {string} peerId - Peer user ID
   */
  addPeer(peerId) {
    if (peerId === this.userId) {
      console.warn(`[WebRTCManager] Cannot add self as peer: ${peerId}`);
      return;
    }

    // Check if peer already exists and has an active connection
    const existingState = this.connectionStates.get(peerId);
    if (existingState === 'connected' || existingState === 'connecting') {
      console.log(`[WebRTCManager] Peer ${peerId} already exists with state: ${existingState}, skipping addPeer`);
      return;
    }

    // Check if peer connection already exists (even if not connected yet)
    if (this.peerConnections.has(peerId)) {
      const currentState = this.connectionStates.get(peerId) || 'unknown';
      console.log(`[WebRTCManager] Peer ${peerId} already has connection (state: ${currentState}), skipping addPeer`);
      return;
    }

    console.log(`[WebRTCManager] Adding new peer: ${peerId}`);

    // Determine who initiates (lower user ID is "caller")
    const isCaller = this.userId < peerId;
    
    if (isCaller) {
      this.initiateConnection(peerId);
    } else {
      // Wait for offer from the caller
      this.prepareForIncomingConnection(peerId);
    }
  }

  /**
   * Initiate connection to a peer (caller side)
   * 
   * @param {string} peerId - Peer user ID
   */
  async initiateConnection(peerId) {
    if (this.initiatedConnections.has(peerId)) {
      return; // Already initiated
    }

    this.initiatedConnections.add(peerId);
    this.setConnectionState(peerId, 'connecting');

    try {
      const pc = this.createPeerConnection(peerId);
      this.peerConnections.set(peerId, pc);

      // Create data channel
      const dataChannel = pc.createDataChannel('midi', {
        ordered: false,        // Unordered for lowest latency
        maxRetransmits: 0      // No retransmissions - drop lost packets
      });
      
      this.setupDataChannel(peerId, dataChannel);
      this.dataChannels.set(peerId, dataChannel);

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      this.signaling.sendOffer(peerId, offer);

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.signaling.sendIceCandidate(peerId, event.candidate);
        }
      };

    } catch (error) {
      console.error(`Error initiating connection to ${peerId}:`, error);
      this.setConnectionState(peerId, 'disconnected');
    }
  }

  /**
   * Prepare for incoming connection (callee side)
   * 
   * @param {string} peerId - Peer user ID
   */
  prepareForIncomingConnection(peerId) {
    // Connection will be created when we receive the offer
    this.setConnectionState(peerId, 'connecting');
  }

  /**
   * Create RTCPeerConnection for a peer
   * 
   * @param {string} peerId - Peer user ID
   * @returns {RTCPeerConnection}
   */
  createPeerConnection(peerId) {
    const pc = new RTCPeerConnection({
      iceServers: this.iceServers
    });

    // Track connection state
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected' || state === 'completed') {
        this.setConnectionState(peerId, 'connected');
      } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        this.setConnectionState(peerId, 'disconnected');
      }
    };

    // Handle incoming data channel (for callee)
    pc.ondatachannel = (event) => {
      const dataChannel = event.channel;
      if (dataChannel.label === 'midi') {
        this.setupDataChannel(peerId, dataChannel);
        this.dataChannels.set(peerId, dataChannel);
      }
    };

    return pc;
  }

  /**
   * Setup data channel event handlers
   * 
   * @param {string} peerId - Peer user ID
   * @param {RTCDataChannel} dataChannel - Data channel
   */
  setupDataChannel(peerId, dataChannel) {
    dataChannel.onopen = () => {
      console.log(`[WebRTCManager] DataChannel opened with ${peerId}`);
      this.setConnectionState(peerId, 'connected');
      
      // STEP 2.3: Start periodic ping messages (every 500ms for faster adaptation)
      if (this.clockSync) {
        this.startPingInterval(peerId);
      }
    };

    dataChannel.onclose = () => {
      // Stop ping interval
      this.stopPingInterval(peerId);
      
      // Only log and update state if this wasn't an intentional close
      // (If we called removePeer, the state is already being updated)
      const currentState = this.connectionStates.get(peerId);
      if (currentState !== 'disconnected') {
        console.log(`[WebRTCManager] DataChannel closed with ${peerId} (unexpected)`);
        this.setConnectionState(peerId, 'disconnected');
      } else {
        console.log(`[WebRTCManager] DataChannel closed with ${peerId} (expected)`);
      }
    };

    dataChannel.onerror = (error) => {
      // Log error but don't automatically close - let the connection state handle it
      console.error(`[WebRTCManager] DataChannel error with ${peerId}:`, error);
      // Only update state if channel is actually closed
      if (dataChannel.readyState === 'closed') {
        this.setConnectionState(peerId, 'disconnected');
      }
    };

    // Handle incoming messages (ping/pong or jam events)
    // STEP 2.4: Fast-path - move event handling to microtask to avoid blocking WebRTC queue
    dataChannel.onmessage = (event) => {
      try {
        const data = event.data;
        let parsed;
        
        // Try to parse as JSON (only once - fix double parsing)
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          if (DEBUG_WEBRTC) {
            console.warn(`[WebRTCManager] Failed to parse message from ${peerId}:`, data);
          }
          return;
        }

        // Check if it's a control message (ping/pong) - handle synchronously (fast)
        if (parsed && typeof parsed === 'object' && (parsed.type === 'ping' || parsed.type === 'pong')) {
          if (this.clockSync) {
            const response = this.clockSync.handleIncomingControlMessage(parsed, peerId);
            if (response) {
              // Send pong response
              const dataChannel = this.dataChannels.get(peerId);
              if (dataChannel && dataChannel.readyState === 'open') {
                dataChannel.send(JSON.stringify(response));
              }
            }
          }
          return; // Control message handled, don't process as jam event
        }

        // STEP 2.4: Move jam event handling to microtask to avoid blocking WebRTC message queue
        // This ensures WebRTC can continue receiving messages while we process events
        queueMicrotask(() => {
          try {
            // STEP 2.4: Fix double JSON parsing - pass parsed object directly
            // deserializeEvent can accept either a string or already-parsed object
            const jamEvent = deserializeEvent(parsed);
            if (jamEvent) {
              this.onJamEvent(jamEvent, peerId);
            } else {
              if (DEBUG_WEBRTC) {
                console.warn(`[WebRTCManager] Failed to deserialize jam event from ${peerId}`);
              }
            }
          } catch (error) {
            console.error(`[WebRTCManager] Error handling jam event from ${peerId}:`, error);
          }
        });
      } catch (error) {
        console.error(`[WebRTCManager] Error handling message from ${peerId}:`, error);
      }
    };
  }

  /**
   * Handle incoming signaling message
   * 
   * @param {Object} signal - Signaling message
   * @param {string} signal.from - Sender user ID
   * @param {string|null} signal.to - Target user ID
   * @param {string} signal.type - Signal type
   * @param {any} signal.payload - Signal payload
   */
  async handleSignal(signal) {
    const { from, to, type, payload } = signal;

    // Ignore signals not for us (unless broadcast)
    if (to !== null && to !== this.userId) {
      return;
    }

    // Ignore signals from self
    if (from === this.userId) {
      return;
    }

    let pc = this.peerConnections.get(from);

    // Create connection if we don't have one yet (callee receiving offer)
    if (!pc && type === 'offer') {
      pc = this.createPeerConnection(from);
      this.peerConnections.set(from, pc);
      
      // Setup incoming data channel handler
      pc.ondatachannel = (event) => {
        const dataChannel = event.channel;
        if (dataChannel.label === 'midi') {
          this.setupDataChannel(from, dataChannel);
          this.dataChannels.set(from, dataChannel);
        }
      };
    }

    if (!pc) {
      console.warn(`Received ${type} from ${from} but no connection exists`);
      return;
    }

    try {
      switch (type) {
        case 'offer':
          await pc.setRemoteDescription(payload);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          this.signaling.sendAnswer(from, answer);
          break;

        case 'answer':
          await pc.setRemoteDescription(payload);
          break;

        case 'ice-candidate':
          await pc.addIceCandidate(payload);
          break;

        default:
          console.warn(`Unknown signal type: ${type}`);
      }
    } catch (error) {
      console.error(`Error handling ${type} from ${from}:`, error);
    }
  }

  /**
   * Send jam event to all connected peers
   * 
   * @param {JamEvent} event - Jam event to send
   */
  sendJamEvent(event) {
    const serialized = JSON.stringify(event);
    
    if (DEBUG_WEBRTC) {
      console.log(`[WebRTCManager] Sending jam event:`, {
        type: event.type,
        instrument: event.instrument,
        note: event.note,
        senderId: event.senderId,
        dataChannelsCount: this.dataChannels.size
      });
    }
    
    let sentCount = 0;
    this.dataChannels.forEach((dataChannel, peerId) => {
      if (dataChannel.readyState === 'open') {
        try {
          if (DEBUG_WEBRTC) {
            console.log(`[WebRTCManager] Sending to peer ${peerId}, channel state: ${dataChannel.readyState}`);
          }
          dataChannel.send(serialized);
          sentCount++;
        } catch (error) {
          // Only log errors (not in hot path, but important for debugging)
          console.error(`[WebRTCManager] Error sending jam event to ${peerId}:`, error);
        }
      } else {
        if (DEBUG_WEBRTC) {
          console.warn(`[WebRTCManager] DataChannel to ${peerId} not open, state: ${dataChannel.readyState}`);
        }
      }
    });
    
    if (DEBUG_WEBRTC) {
      console.log(`[WebRTCManager] Sent jam event to ${sentCount} peer(s)`);
    }
  }

  /**
   * Remove a peer and cleanup connection
   * Idempotent: safe to call multiple times for the same peer
   * 
   * @param {string} peerId - Peer user ID
   */
  removePeer(peerId) {
    // Stop ping interval
    this.stopPingInterval(peerId);

    // Check if peer exists before trying to remove
    if (!this.peerConnections.has(peerId) && !this.dataChannels.has(peerId)) {
      console.log(`[WebRTCManager] Peer ${peerId} already removed or never existed`);
      return;
    }

    console.log(`[WebRTCManager] Removing peer: ${peerId}`);

    const dataChannel = this.dataChannels.get(peerId);
    if (dataChannel) {
      // Only close if not already closed
      if (dataChannel.readyState !== 'closed') {
        dataChannel.close();
      }
      this.dataChannels.delete(peerId);
    }

    const pc = this.peerConnections.get(peerId);
    if (pc) {
      // Only close if not already closed
      if (pc.connectionState !== 'closed') {
        pc.close();
      }
      this.peerConnections.delete(peerId);
    }

    this.initiatedConnections.delete(peerId);
    // Update state to disconnected (this will trigger callback)
    this.setConnectionState(peerId, 'disconnected');
  }

  /**
   * Set connection state and notify callback
   * 
   * @param {string} peerId - Peer user ID
   * @param {'connecting'|'connected'|'disconnected'} state - Connection state
   */
  setConnectionState(peerId, state) {
    const previousState = this.connectionStates.get(peerId);
    if (previousState !== state) {
      this.connectionStates.set(peerId, state);
      this.onPeerConnectionChange(peerId, state);
    }
  }

  /**
   * Get connection state for a peer
   * 
   * @param {string} peerId - Peer user ID
   * @returns {'connecting'|'connected'|'disconnected'}
   */
  getConnectionState(peerId) {
    return this.connectionStates.get(peerId) || 'disconnected';
  }

  /**
   * Get all connected peer IDs
   * 
   * @returns {string[]} Array of peer IDs
   */
  getConnectedPeers() {
    return Array.from(this.connectionStates.entries())
      .filter(([_, state]) => state === 'connected')
      .map(([peerId]) => peerId);
  }

  /**
   * Get all peer IDs (regardless of connection state)
   * 
   * @returns {string[]} Array of peer IDs
   */
  getAllPeerIds() {
    return Array.from(this.connectionStates.keys());
  }

  /**
   * Start periodic ping messages to a peer
   * 
   * @param {string} peerId - Peer ID
   */
  startPingInterval(peerId) {
    // Clear any existing interval
    this.stopPingInterval(peerId);

    if (!this.clockSync) {
      return;
    }

    // STEP 2.3: Send ping every 500ms (reduced from 3000ms for faster adaptation)
    const intervalId = setInterval(() => {
      const dataChannel = this.dataChannels.get(peerId);
      if (dataChannel && dataChannel.readyState === 'open') {
        const pingMsg = this.clockSync.createPingMessage(peerId);
        try {
          dataChannel.send(JSON.stringify(pingMsg));
        } catch (error) {
          console.error(`[WebRTCManager] Error sending ping to ${peerId}:`, error);
        }
      }
    }, 500);

    this.pingIntervals.set(peerId, intervalId);
  }

  /**
   * Stop periodic ping messages to a peer
   * 
   * @param {string} peerId - Peer ID
   */
  stopPingInterval(peerId) {
    const intervalId = this.pingIntervals.get(peerId);
    if (intervalId) {
      clearInterval(intervalId);
      this.pingIntervals.delete(peerId);
    }
  }

  /**
   * Cleanup and destroy all connections
   */
  destroy() {
    // Stop all ping intervals
    this.pingIntervals.forEach((intervalId, peerId) => {
      this.stopPingInterval(peerId);
    });

    // Remove all peers
    const peerIds = Array.from(this.peerConnections.keys());
    peerIds.forEach(peerId => this.removePeer(peerId));

    // Unsubscribe from signaling
    if (this.signalingUnsubscribe) {
      this.signalingUnsubscribe();
    }
  }
}

