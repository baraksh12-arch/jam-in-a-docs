import { useEffect, useRef, useCallback } from 'react';
import { useWebRTC } from './useWebRTC';
import { createNoteOnEvent, createNoteOffEvent } from '@/lib/jamEventProtocol';
import { IMMEDIATE_PLAYBACK_THRESHOLD_SECONDS } from '@/lib/clockSync';
// TODO: Deprecated - Supabase note_events table is no longer used for live audio
// import { subscribeToNoteEvents, sendNoteEvent } from '../firebaseClient';

/**
 * Debug flag for WebRTC and note events
 * Set to true to enable verbose logging in the hot path
 */
const DEBUG_WEBRTC = false;

/**
 * useNoteEvents Hook
 * 
 * Manages sending and receiving jam events (notes) via WebRTC.
 * 
 * This hook now uses WebRTC DataChannels instead of Supabase for ultra-low latency.
 * The external API remains the same so existing components don't break.
 */

export function useNoteEvents(roomId, userId, audioEngine, peers, room, onNoteActivity) {
  const processedEventsRef = useRef(new Set());
  const webrtcRef = useRef(null);
  const webrtc = useWebRTC({ roomId, userId, peers, room });
  
  // Keep ref updated with latest webrtc object
  webrtcRef.current = webrtc;

  // Handle incoming jam events from WebRTC
  // Set up listener once when webrtc is available, keep it stable
  useEffect(() => {
    // Wait for WebRTC manager and audio engine to be available
    if (!webrtc || typeof webrtc.onJamEvent !== 'function' || !audioEngine) {
      if (DEBUG_WEBRTC) {
        console.log('[useNoteEvents] Not ready yet:', {
          hasWebRTC: !!webrtc,
          hasOnJamEvent: typeof webrtc?.onJamEvent === 'function',
          hasAudioEngine: !!audioEngine
        });
      }
      return;
    }

    if (DEBUG_WEBRTC) {
      console.log('[useNoteEvents] Setting up jam event listener, userId:', userId, 'webrtc.ready:', webrtc.ready);
    }

    const unsubscribe = webrtc.onJamEvent((event, fromPeerId) => {
      // Get current ready state from ref (avoids stale closure)
      const currentReady = webrtcRef.current?.ready;
      
      // Only process events when WebRTC is actually ready (has connected peers)
      // But keep the listener registered even when not ready
      if (!currentReady) {
        if (DEBUG_WEBRTC) {
          console.log('[useNoteEvents] Received event but WebRTC not ready yet, ignoring');
        }
        return;
      }
      
      if (DEBUG_WEBRTC) {
        console.log('[useNoteEvents] Received jam event', {
          type: event.type,
          instrument: event.instrument,
          note: event.note,
          senderId: event.senderId,
          myUserId: userId,
          fromPeerId: fromPeerId,
          eventAge: Date.now() - event.timestamp
        });
      }

      // Ignore events from self (shouldn't happen via WebRTC, but safety check)
      // Compare as strings to handle UUID vs string comparisons
      if (String(event.senderId) === String(userId)) {
        if (DEBUG_WEBRTC) {
          console.log('[useNoteEvents] Ignoring event from self');
        }
        return;
      }

      // Check if event is too old (ignore events older than 5 seconds)
      const eventAge = Date.now() - event.timestamp;
      if (eventAge > 5000) {
        if (DEBUG_WEBRTC) {
          console.log('[useNoteEvents] Ignoring old event (age:', eventAge, 'ms)');
        }
        return;
      }

      // Deduplicate events (use senderId + timestamp as key)
      const eventKey = `${event.senderId}-${event.timestamp}-${event.type}-${event.note || ''}`;
      if (processedEventsRef.current.has(eventKey)) {
        if (DEBUG_WEBRTC) {
          console.log('[useNoteEvents] Ignoring duplicate event');
        }
        return;
      }
      processedEventsRef.current.add(eventKey);

      // Cleanup old keys to prevent memory leak
      if (processedEventsRef.current.size > 100) {
        const firstItem = processedEventsRef.current.values().next().value;
        processedEventsRef.current.delete(firstItem);
      }

      // Schedule the note using roomTime + latency
      // Get audioContext from audioEngine
      const audioContext = audioEngine.getAudioContext?.();
      if (!audioContext) {
        if (DEBUG_WEBRTC) {
          console.warn('[useNoteEvents] AudioContext not available, playing immediately');
        }
        // Fallback: play immediately
        if (event.type === 'noteOn') {
          audioEngine.playNote(event.instrument, event.note, event.velocity);
        } else if (event.type === 'noteOff') {
          audioEngine.stopNote(event.instrument, event.note);
        }
        return;
      }

      // Compute target audio time using clockSync
      let targetAudioTime = webrtcRef.current?.computeTargetAudioTime?.(
        event.roomTime,
        audioContext,
        fromPeerId
      );

      if (targetAudioTime === undefined || targetAudioTime === null) {
        if (DEBUG_WEBRTC) {
          console.warn('[useNoteEvents] Could not compute target audio time, playing immediately');
        }
        // Fallback: play immediately
        if (event.type === 'noteOn') {
          audioEngine.playNote(event.instrument, event.note, event.velocity);
        } else if (event.type === 'noteOff') {
          audioEngine.stopNote(event.instrument, event.note);
        }
        return;
      }

      // Psychoacoustic improvement: play drums slightly early for tighter feel
      // This is perceptually acceptable and makes drums feel more in sync
      if (event.instrument === 'DRUMS') {
        targetAudioTime -= 0.002; // 2ms early
      }

      const currentTime = audioContext.currentTime;
      
      // Ensure we never schedule in the past (clamp to current time)
      if (targetAudioTime < currentTime) {
        targetAudioTime = currentTime;
      }
      
      const timeUntilPlay = targetAudioTime - currentTime;

      // If target time is in the past or very close (within threshold), play immediately
      if (timeUntilPlay <= IMMEDIATE_PLAYBACK_THRESHOLD_SECONDS) {
        // Play immediately (fallback case)
        if (event.type === 'noteOn') {
          audioEngine.playNote(event.instrument, event.note, event.velocity);
          
          // Trigger activity indicator for remote notes
          if (onNoteActivity) {
            onNoteActivity({
              source: 'remote',
              instrument: event.instrument,
              note: event.note,
              velocity: event.velocity ?? 100
            });
          }
        } else if (event.type === 'noteOff') {
          audioEngine.stopNote(event.instrument, event.note);
        }
      } else {
        // Schedule for future playback
        if (event.type === 'noteOn') {
          audioEngine.playNoteAt(event.instrument, event.note, event.velocity, targetAudioTime);
          
          // Trigger activity indicator for remote notes
          if (onNoteActivity) {
            onNoteActivity({
              source: 'remote',
              instrument: event.instrument,
              note: event.note,
              velocity: event.velocity ?? 100
            });
          }
        } else if (event.type === 'noteOff') {
          audioEngine.stopNoteAt(event.instrument, event.note, targetAudioTime);
        }
      }
    });

    return () => {
      if (DEBUG_WEBRTC) {
        console.log('[useNoteEvents] Cleaning up jam event listener');
      }
      if (unsubscribe) unsubscribe();
    };
  }, [webrtc, webrtc?.onJamEvent, audioEngine, userId]); // Don't depend on ready - keep listener stable

  /**
   * Send a note event via WebRTC
   * 
   * @param {string} instrument - Instrument name
   * @param {number} note - MIDI note (0-127)
   * @param {string} type - 'NOTE_ON' or 'NOTE_OFF'
   * @param {number} velocity - MIDI velocity (0-127)
   */
  const sendNote = useCallback(async (instrument, note, type = 'NOTE_ON', velocity = 100) => {
    if (!roomId || !userId || !webrtc.sendJamEvent) return;

    try {
      // Get current room time from clock sync
      const roomTime = webrtc.getRoomTime();

      // Create jam event based on type
      let event;
      if (type === 'NOTE_ON') {
        event = createNoteOnEvent({
          instrument,
          note,
          velocity,
          roomTime,
          senderId: userId
        });
      } else if (type === 'NOTE_OFF') {
        event = createNoteOffEvent({
          instrument,
          note,
          roomTime,
          senderId: userId
        });
      } else {
        console.warn(`Unknown note type: ${type}`);
        return;
      }

      // Send via WebRTC
      webrtc.sendJamEvent(event);

      // Local echo: play the note immediately for the sender
      // This matches the previous behavior where you hear yourself
      if (type === 'NOTE_ON') {
        audioEngine.playNote(instrument, note, velocity);
        
        // Trigger activity indicator for local notes
        if (onNoteActivity) {
          onNoteActivity({
            source: 'local',
            instrument,
            note,
            velocity
          });
        }
      } else if (type === 'NOTE_OFF') {
        audioEngine.stopNote(instrument, note);
      }

    } catch (error) {
      console.error('Failed to send note event:', error);
    }
  }, [roomId, userId, webrtc.sendJamEvent, webrtc.getRoomTime, audioEngine]);

  return {
    sendNote
  };
}
