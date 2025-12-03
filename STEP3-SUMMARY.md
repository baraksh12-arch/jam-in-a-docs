# STEP 3 Summary: WebRTC Core Implementation

## Files Created

### 1. `src/lib/webrtcSignaling.js`
**Purpose:** WebRTC signaling via Supabase Realtime channels

**Key Features:**
- Connects to `webrtc:${roomId}` Supabase Realtime channel
- Sends/receives offer, answer, and ICE candidate messages
- No persistent table needed (pure Realtime)
- Auto-connects on initialization

**API:**
```javascript
const signaling = initSignaling(roomId, userId);
signaling.sendOffer(targetUserId, offer);
signaling.sendAnswer(targetUserId, answer);
signaling.sendIceCandidate(targetUserId, candidate);
signaling.onSignal(callback); // Returns unsubscribe function
signaling.disconnect();
```

---

### 2. `src/lib/jamEventProtocol.js`
**Purpose:** Jam event message types and serialization

**Key Features:**
- Defines event types: noteOn, noteOff, controlChange, tempo, pitchBend
- JSON serialization/deserialization (can swap to binary later)
- Type validation with `isJamEvent()`
- Helper functions: `createNoteOnEvent()`, `createNoteOffEvent()`

**API:**
```javascript
import { serializeEvent, deserializeEvent, isJamEvent, createNoteOnEvent } from './jamEventProtocol';

const event = createNoteOnEvent({ instrument: 'EP', note: 60, velocity: 100, roomTime: 123.456, senderId: 'user-123' });
const json = serializeEvent(event);
const parsed = deserializeEvent(json);
```

---

### 3. `src/lib/clockSync.js`
**Purpose:** Room time and latency management

**Key Features:**
- Tracks room start timestamp (from Supabase)
- Calculates room time (seconds since room start)
- Tracks latency per peer (for ping/pong)
- Helper function: `computeTargetAudioTime()` for scheduling notes

**API:**
```javascript
import { ClockSync, computeTargetAudioTime } from './clockSync';

const clock = new ClockSync();
clock.setRoomStartTimestamp(roomCreatedAtMs);
const roomTime = clock.getRoomTime(); // seconds
clock.registerPeer(peerId);
clock.updateLatency(peerId, 45); // ms
const latency = clock.getLatency(peerId);

// Schedule a note
const targetTime = computeTargetAudioTime({
  audioContextCurrentTime: audioContext.currentTime,
  roomTimeFromEvent: event.roomTime,
  currentRoomTime: clock.getRoomTime(),
  latencyMs: clock.getLatency(peerId),
  safetyMs: 20
});
```

---

### 4. `src/lib/webrtcManager.js`
**Purpose:** RTCPeerConnection and DataChannel management

**Key Features:**
- Full mesh topology (each player connects to all others)
- Unordered, unreliable DataChannels (ordered: false, maxRetransmits: 0)
- Automatic offer/answer/ICE handling
- Broadcasts jam events to all connected peers

**API:**
```javascript
import { WebRTCManager } from './webrtcManager';

const manager = new WebRTCManager({
  roomId: 'ABC123',
  userId: 'user-123',
  signaling: signaling,
  onJamEvent: (event, fromPeerId) => {
    // Handle incoming jam event
  },
  onPeerConnectionChange: (peerId, state) => {
    // 'connecting' | 'connected' | 'disconnected'
  }
});

manager.addPeer('user-456');
manager.sendJamEvent(jamEvent);
manager.removePeer('user-456');
manager.destroy();
```

---

## Usage Example (Future Integration)

Here's how these modules will be wired together in a future `useWebRTC` hook:

```javascript
// Future useWebRTC hook (not implemented yet)
import { initSignaling } from '@/lib/webrtcSignaling';
import { WebRTCManager } from '@/lib/webrtcManager';
import { ClockSync } from '@/lib/clockSync';
import { createNoteOnEvent } from '@/lib/jamEventProtocol';

function useWebRTC(roomId, userId, roomStartTimestamp) {
  // 1. Initialize signaling
  const signaling = initSignaling(roomId, userId);
  
  // 2. Initialize clock sync
  const clock = new ClockSync();
  clock.setRoomStartTimestamp(roomStartTimestamp);
  
  // 3. Initialize WebRTC manager
  const manager = new WebRTCManager({
    roomId,
    userId,
    signaling,
    onJamEvent: (event, fromPeerId) => {
      // Schedule note with clock sync
      const latency = clock.getLatency(fromPeerId);
      const targetTime = computeTargetAudioTime({
        audioContextCurrentTime: audioContext.currentTime,
        roomTimeFromEvent: event.roomTime,
        currentRoomTime: clock.getRoomTime(),
        latencyMs: latency,
        safetyMs: 20
      });
      audioEngine.playNoteAt(event.instrument, event.note, event.velocity, targetTime);
    }
  });
  
  // 4. When peers join, add them
  // manager.addPeer(peerId);
  
  // 5. Send jam events
  const sendNote = (instrument, note, velocity) => {
    const event = createNoteOnEvent({
      instrument,
      note,
      velocity,
      roomTime: clock.getRoomTime(),
      senderId: userId
    });
    manager.sendJamEvent(event);
  };
  
  return { manager, clock, sendNote };
}
```

---

## Design Decisions

1. **Unordered, Unreliable DataChannels**
   - `ordered: false` - Messages can arrive out of order (faster)
   - `maxRetransmits: 0` - Don't retry lost packets (lower latency)
   - Missing a note is better than late notes (which cause audio glitches)

2. **Full Mesh Topology**
   - Each player connects directly to all other players
   - No central relay for players (only for crowd/listeners)
   - Lowest latency possible

3. **Pure Realtime Signaling**
   - No signals table needed
   - Uses Supabase Realtime channel `webrtc:${roomId}`
   - Automatic cleanup when channel unsubscribes

4. **JSON Messages (for now)**
   - Easy to debug and extend
   - Can swap to binary later if needed
   - Messages are small (~100-200 bytes)

---

## Next Steps

- **STEP 6 (Future):** Create `useWebRTC` React hook
- **STEP 7 (Future):** Replace `useNoteEvents` to use WebRTC instead of Supabase
- **STEP 8 (Future):** Add ping/pong for latency measurement
- **STEP 9 (Future):** Integrate with audio engine for scheduled playback

---

## Testing Notes

These modules are pure JavaScript with no React dependencies. They can be tested independently:

- `webrtcSignaling`: Test with mock Supabase client
- `jamEventProtocol`: Test serialization/deserialization
- `clockSync`: Test room time calculations
- `webrtcManager`: Test with mock RTCPeerConnection (or in browser with real WebRTC)

No UI code was modified in this step.

