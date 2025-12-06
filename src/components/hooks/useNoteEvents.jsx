import { useEffect, useRef, useCallback } from 'react';
import { useWebRTC } from './useWebRTC';
import { createNoteOnEvent, createNoteOffEvent } from '@/lib/jamEventProtocol';
import { IMMEDIATE_PLAYBACK_THRESHOLD_SECONDS } from '@/lib/clockSync';
import { CURRENT_LATENCY_MODE, LATENCY_MODES } from '@/config/latencyMode';
import { syncedNow } from '@/lib/time/syncedNow';
import { scheduleNote } from '@/lib/audio/scheduler';
// TODO: Deprecated - Supabase note_events table is no longer used for live audio
// import { subscribeToNoteEvents, sendNoteEvent } from '../firebaseClient';

/**
 * Debug flag for WebRTC and note events
 * Set to true to enable verbose logging in the hot path
 */
const DEBUG_WEBRTC = false;

/**
 * Debug flag for latency mode logging
 */
const DEBUG_LATENCY = false;

/**
 * useNoteEvents Hook
 * 
 * Manages sending and receiving jam events (notes) via WebRTC.
 * 
 * This hook now uses WebRTC DataChannels instead of Supabase for ultra-low latency.
 * The external API remains the same so existing components don't break.
 * 
 * DRUMS are treated in ultra-low-latency mode:
 * - sending: bypasses bundler and goes out immediately (handled in webrtcManager.js)
 * - receiving: plays immediately, no scheduling (bypasses all scheduling logic)
 * Other instruments keep the existing scheduling / bundling behavior.
 */

export function useNoteEvents(roomId, userId, audioEngine, peers, room, onNoteActivity, webrtc = null) {
  const processedEventsRef = useRef(new Set());
  const webrtcRef = useRef(null);
  
  // Use provided webrtc instance, or create one if not provided (backward compatibility)
  const webrtcInstance = webrtc || useWebRTC({ roomId, userId, peers, room });
  
  // Keep ref updated with latest webrtc object
  webrtcRef.current = webrtcInstance;

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

    const unsubscribe = webrtcInstance.onJamEvent((event, fromPeerId) => {
      // Get current ready state from ref (avoids stale closure)
      const currentReady = webrtcInstance?.ready;
      
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

      // Fast path: DRUMS always play immediately, bypassing all scheduling logic
      // This ensures DRUMS get the lowest possible latency (network latency only)
      const isDrumsEvent = event.instrument === 'DRUMS';
      if (isDrumsEvent) {
        // Immediate playback for DRUMS - bypass all scheduling, regardless of mode
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
        return; // Exit early - DRUMS are done (no scheduling, no mode checks)
      }

      // Phase 4: Use timestamp-based scheduling for all non-DRUMS instruments
      // All notes are scheduled using event.timestamp + LATENCY_BUFFER_MS
      // This ensures tight playback with no jitter or missed notes
      
      if (event.type === 'noteOn') {
        // Schedule the note using the unified scheduler
        // scheduleNote() handles:
        // - Late note filtering (if playAt < syncedNow())
        // - Tone.Transport scheduling
        // - Tone.js instrument triggering
        const scheduled = scheduleNote({
          instrument: event.instrument,
          note: event.note,
          velocity: event.velocity ?? 100,
          timestamp: event.timestamp, // Server-aligned timestamp from sender
          senderId: event.senderId,
        });
        
        if (scheduled) {
          // Trigger activity indicator for remote notes
          if (onNoteActivity) {
            onNoteActivity({
              source: 'remote',
              instrument: event.instrument,
              note: event.note,
              velocity: event.velocity ?? 100
            });
          }
        } else {
          // Note was dropped (too late) - already logged by scheduler
          if (DEBUG_WEBRTC) {
            console.log('[useNoteEvents] Note dropped (too late):', {
              instrument: event.instrument,
              note: event.note,
              timestamp: event.timestamp,
              now: syncedNow(),
            });
          }
        }
      } else if (event.type === 'noteOff') {
        // NoteOff events: For now, we'll handle them immediately
        // TODO: Consider scheduling noteOff events as well for precise timing
        audioEngine.stopNote(event.instrument, event.note);
      }
    });

    return () => {
      if (DEBUG_WEBRTC) {
        console.log('[useNoteEvents] Cleaning up jam event listener');
      }
      if (unsubscribe) unsubscribe();
    };
  }, [webrtcInstance, webrtcInstance?.onJamEvent, audioEngine, userId]); // Don't depend on ready - keep listener stable

  /**
   * Send a note event via WebRTC
   * 
   * @param {string} instrument - Instrument name
   * @param {number} note - MIDI note (0-127)
   * @param {string} type - 'NOTE_ON' or 'NOTE_OFF'
   * @param {number} velocity - MIDI velocity (0-127)
   */
  const sendNote = useCallback(async (instrument, note, type = 'NOTE_ON', velocity = 100) => {
    if (!roomId || !userId || !webrtcInstance?.sendJamEvent) return;

    try {
      // Get current room time from clock sync (uses syncedNow() internally if available)
      const roomTime = webrtcInstance.getRoomTime();

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
      webrtcInstance.sendJamEvent(event);

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
  }, [roomId, userId, webrtcInstance?.sendJamEvent, webrtcInstance?.getRoomTime, audioEngine]);

  return {
    sendNote
  };
}
