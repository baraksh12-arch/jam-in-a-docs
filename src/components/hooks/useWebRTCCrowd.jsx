import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/api/supabaseClient';

/**
 * useWebRTCCrowd Hook
 * 
 * Manages WebRTC video-only streams for crowd members.
 * Each crowd member broadcasts their camera (no audio) to all viewers.
 * Uses SFU-like pattern with Supabase Realtime for signaling.
 * 
 * Key features:
 * - Video-only streaming (no audio for latency-free experience)
 * - Supports up to 100 crowd members
 * - Optimized for one-way broadcast
 * - Low bandwidth mode for crowd streams
 */

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

// Video constraints optimized for crowd (smaller resolution, lower bitrate)
const CROWD_VIDEO_CONSTRAINTS = {
  video: {
    width: { ideal: 160, max: 240 },
    height: { ideal: 120, max: 180 },
    frameRate: { ideal: 15, max: 20 },
    facingMode: 'user'
  },
  audio: false
};

/**
 * @param {Object} options
 * @param {string} options.roomId - Room ID
 * @param {string} options.oduserId - Current user ID
 * @param {boolean} options.isCrowd - Whether current user is a crowd member
 * @param {Array} options.crowdMembers - Array of crowd member objects
 * @returns {Object} Crowd WebRTC API
 */
export function useWebRTCCrowd({ roomId, userId, isCrowd = false, crowdMembers = [] }) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map()); // oduserId -> MediaStream
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [connectionStates, setConnectionStates] = useState(new Map());

  // Refs for peer connections
  const peerConnectionsRef = useRef(new Map()); // oduserId -> RTCPeerConnection
  const channelRef = useRef(null);
  const localStreamRef = useRef(null);

  // Initialize signaling channel
  useEffect(() => {
    if (!roomId || !userId) return;

    const channelName = `crowd-video:${roomId}`;
    const channel = supabase.channel(channelName);

    channel.on('broadcast', { event: 'crowd-signal' }, ({ payload }) => {
      if (payload.from === userId) return;
      if (payload.to !== null && payload.to !== userId) return;
      
      handleSignal(payload);
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[useWebRTCCrowd] Connected to signaling: ${channelName}`);
      }
    });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [roomId, userId]);

  // Handle incoming WebRTC signals
  const handleSignal = useCallback(async (signal) => {
    const { from, type, payload } = signal;

    // Get or create peer connection
    let pc = peerConnectionsRef.current.get(from);

    if (!pc && type === 'offer') {
      // Create new peer connection for incoming offer
      pc = createPeerConnection(from);
      peerConnectionsRef.current.set(from, pc);
    }

    if (!pc) {
      console.warn(`[useWebRTCCrowd] No peer connection for ${from}, ignoring ${type}`);
      return;
    }

    try {
      switch (type) {
        case 'offer':
          await pc.setRemoteDescription(payload);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal(from, 'answer', answer);
          break;

        case 'answer':
          await pc.setRemoteDescription(payload);
          break;

        case 'ice-candidate':
          if (payload) {
            await pc.addIceCandidate(payload);
          }
          break;
      }
    } catch (error) {
      console.error(`[useWebRTCCrowd] Error handling ${type}:`, error);
    }
  }, []);

  // Send signaling message
  const sendSignal = useCallback((targetUserId, type, payload) => {
    if (!channelRef.current) return;

    channelRef.current.send({
      type: 'broadcast',
      event: 'crowd-signal',
      payload: {
        from: userId,
        to: targetUserId,
        type,
        payload
      }
    });
  }, [userId]);

  // Create peer connection
  const createPeerConnection = useCallback((peerId) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(peerId, 'ice-candidate', event.candidate);
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      setConnectionStates(prev => {
        const next = new Map(prev);
        if (state === 'connected') {
          next.set(peerId, 'connected');
        } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          next.set(peerId, 'disconnected');
        } else {
          next.set(peerId, 'connecting');
        }
        return next;
      });
    };

    pc.ontrack = (event) => {
      console.log(`[useWebRTCCrowd] Received track from ${peerId}`);
      const stream = event.streams[0];
      if (stream) {
        setRemoteStreams(prev => {
          const next = new Map(prev);
          next.set(peerId, stream);
          return next;
        });
      }
    };

    return pc;
  }, [sendSignal]);

  // Start broadcasting camera
  const startBroadcast = useCallback(async () => {
    if (!isCrowd) {
      console.warn('[useWebRTCCrowd] Only crowd members can broadcast');
      return false;
    }

    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia(CROWD_VIDEO_CONSTRAINTS);
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsBroadcasting(true);
      
      console.log('[useWebRTCCrowd] Camera started, broadcasting...');
      return true;
    } catch (error) {
      console.error('[useWebRTCCrowd] Camera access error:', error);
      let errorMsg = 'Unable to access camera';
      if (error.name === 'NotAllowedError') {
        errorMsg = 'Camera permission denied. Please allow camera access.';
      } else if (error.name === 'NotFoundError') {
        errorMsg = 'No camera found on this device.';
      } else if (error.name === 'NotReadableError') {
        errorMsg = 'Camera is already in use by another application.';
      }
      setCameraError(errorMsg);
      return false;
    }
  }, [isCrowd]);

  // Stop broadcasting
  const stopBroadcast = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setIsBroadcasting(false);
    console.log('[useWebRTCCrowd] Broadcast stopped');
  }, []);

  // Manage peer connections for crowd members
  useEffect(() => {
    if (!roomId || !userId) return;

    // For crowd members who are broadcasting: connect to all players who want to receive
    // For players/viewers: connect to all crowd members who are broadcasting
    
    // For now, create connections based on crowd members list
    const currentPeers = new Set(peerConnectionsRef.current.keys());
    const targetPeers = new Set(
      crowdMembers
        .filter(m => m.userId !== userId && m.oduserId !== userId)
        .map(m => m.userId || m.oduserId)
    );

    // Add new peers
    targetPeers.forEach(peerId => {
      if (!currentPeers.has(peerId)) {
        // Determine if we should initiate
        const shouldInitiate = userId < peerId;
        
        if (shouldInitiate && isBroadcasting && localStreamRef.current) {
          // Initiate connection and send our stream
          initiateConnection(peerId);
        }
      }
    });

    // Remove peers that left
    currentPeers.forEach(peerId => {
      if (!targetPeers.has(peerId)) {
        const pc = peerConnectionsRef.current.get(peerId);
        if (pc) {
          pc.close();
          peerConnectionsRef.current.delete(peerId);
          setRemoteStreams(prev => {
            const next = new Map(prev);
            next.delete(peerId);
            return next;
          });
          setConnectionStates(prev => {
            const next = new Map(prev);
            next.delete(peerId);
            return next;
          });
        }
      }
    });
  }, [crowdMembers, userId, isBroadcasting]);

  // Initiate connection to a peer
  const initiateConnection = useCallback(async (peerId) => {
    if (!localStreamRef.current) return;

    const pc = createPeerConnection(peerId);
    peerConnectionsRef.current.set(peerId, pc);

    // Add local stream tracks
    localStreamRef.current.getTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current);
    });

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal(peerId, 'offer', offer);
      console.log(`[useWebRTCCrowd] Sent offer to ${peerId}`);
    } catch (error) {
      console.error(`[useWebRTCCrowd] Error creating offer for ${peerId}:`, error);
    }
  }, [createPeerConnection, sendSignal]);

  // When starting to broadcast, connect to all known crowd viewers
  useEffect(() => {
    if (!isBroadcasting || !localStreamRef.current) return;

    // Broadcast our stream to all crowd member peers
    const targetPeers = crowdMembers
      .filter(m => {
        const peerId = m.userId || m.oduserId;
        return peerId !== userId && !peerConnectionsRef.current.has(peerId);
      })
      .map(m => m.userId || m.oduserId);

    targetPeers.forEach(peerId => {
      if (userId < peerId) {
        initiateConnection(peerId);
      }
    });
  }, [isBroadcasting, crowdMembers, userId, initiateConnection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopBroadcast();
      peerConnectionsRef.current.forEach(pc => pc.close());
      peerConnectionsRef.current.clear();
    };
  }, []);

  // Get remote stream for a specific user
  const getRemoteStream = useCallback((oduserId) => {
    return remoteStreams.get(oduserId);
  }, [remoteStreams]);

  return {
    localStream,
    remoteStreams: Object.fromEntries(remoteStreams),
    isBroadcasting,
    cameraError,
    connectionStates: Object.fromEntries(connectionStates),
    startBroadcast,
    stopBroadcast,
    getRemoteStream
  };
}
