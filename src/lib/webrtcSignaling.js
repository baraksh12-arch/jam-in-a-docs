import { supabase } from '@/api/supabaseClient';

/**
 * WebRTC Signaling via Supabase Realtime
 * 
 * Handles WebRTC offer/answer/ICE candidate exchange between players.
 * Uses Supabase Realtime channel (not a persistent table) for low-latency signaling.
 * 
 * Signaling Flow:
 * 1. Player A creates offer → sends to webrtc:${roomId} channel
 * 2. Player B receives offer → creates answer → sends back to A
 * 3. ICE candidates exchanged similarly
 * 4. Once WebRTC connection established, signaling stops
 */

/**
 * @typedef {Object} SignalingMessage
 * @property {string} from - Sender userId
 * @property {string|null} to - Target userId (null = broadcast to all)
 * @property {'offer'|'answer'|'ice-candidate'} type - Signal type
 * @property {any} payload - WebRTC SDP or ICE candidate
 */

/**
 * Initialize WebRTC signaling for a room
 * 
 * @param {string} roomId - Room ID
 * @param {string} userId - Current user ID
 * @returns {Object} Signaling API object
 */
export function initSignaling(roomId, userId) {
  const channelName = `webrtc:${roomId}`;
  let channel = null;
  let signalCallbacks = [];

  /**
   * Join the signaling channel
   */
  function connect() {
    if (channel) {
      console.warn(`Already connected to signaling channel: ${channelName}`);
      return;
    }

    channel = supabase.channel(channelName);

    // Listen for signaling messages
    channel.on('broadcast', { event: 'signal' }, (payload) => {
      const message = payload.payload;
      
      // Ignore messages from self
      if (message.from === userId) {
        return;
      }

      // If message has a 'to' field, only process if it's for us or broadcast
      if (message.to !== null && message.to !== userId) {
        return;
      }

      // Notify all callbacks
      signalCallbacks.forEach(callback => {
        try {
          callback(message);
        } catch (error) {
          console.error('Error in signal callback:', error);
        }
      });
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Connected to signaling channel: ${channelName}`);
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`Error subscribing to signaling channel: ${channelName}`);
      }
    });
  }

  /**
   * Send a signaling message
   * 
   * @param {string|null} targetUserId - Target user ID (null = broadcast)
   * @param {'offer'|'answer'|'ice-candidate'} type - Signal type
   * @param {any} payload - WebRTC SDP or ICE candidate
   */
  function sendSignal(targetUserId, type, payload) {
    if (!channel) {
      console.error('Signaling channel not connected');
      return;
    }

    const message = {
      from: userId,
      to: targetUserId,
      type: type,
      payload: payload
    };

    channel.send({
      type: 'broadcast',
      event: 'signal',
      payload: message
    });
  }

  /**
   * Send WebRTC offer
   * 
   * @param {string|null} targetUserId - Target user ID (null = broadcast)
   * @param {RTCSessionDescriptionInit} offer - WebRTC offer
   */
  function sendOffer(targetUserId, offer) {
    sendSignal(targetUserId, 'offer', offer);
  }

  /**
   * Send WebRTC answer
   * 
   * @param {string} targetUserId - Target user ID
   * @param {RTCSessionDescriptionInit} answer - WebRTC answer
   */
  function sendAnswer(targetUserId, answer) {
    sendSignal(targetUserId, 'answer', answer);
  }

  /**
   * Send ICE candidate
   * 
   * @param {string|null} targetUserId - Target user ID (null = broadcast)
   * @param {RTCIceCandidateInit} candidate - ICE candidate
   */
  function sendIceCandidate(targetUserId, candidate) {
    sendSignal(targetUserId, 'ice-candidate', candidate);
  }

  /**
   * Register callback for incoming signals
   * 
   * @param {function(SignalingMessage): void} callback - Callback function
   * @returns {function(): void} Unsubscribe function
   */
  function onSignal(callback) {
    signalCallbacks.push(callback);
    
    return () => {
      signalCallbacks = signalCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Disconnect from signaling channel
   */
  function disconnect() {
    if (channel) {
      supabase.removeChannel(channel);
      channel = null;
      signalCallbacks = [];
      console.log(`Disconnected from signaling channel: ${channelName}`);
    }
  }

  // Auto-connect on init
  connect();

  return {
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    onSignal,
    disconnect
  };
}

