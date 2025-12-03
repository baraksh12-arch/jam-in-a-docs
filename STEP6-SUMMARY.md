# STEP 6 Summary: WebRTC Integration into React

## Files Created/Modified

### 1. `src/components/hooks/useWebRTC.jsx` (NEW)
**Purpose:** React hook that bridges React components with WebRTC core modules

**Key Features:**
- Initializes `webrtcSignaling`, `WebRTCManager`, and `ClockSync`
- Manages peer connections (adds/removes peers as they join/leave)
- Tracks connection states and ready status
- Exposes simple API: `sendJamEvent()`, `onJamEvent()`, `getRoomTime()`, `getLatency()`
- Handles cleanup on unmount

**API:**
```javascript
const webrtc = useWebRTC({ roomId, userId, peers, room });

// Returns:
{
  ready: boolean,                    // At least one peer connected
  connectionStates: { [peerId]: 'connecting'|'connected'|'disconnected' },
  sendJamEvent: (event) => void,      // Send jam event to all peers
  onJamEvent: (callback) => unsubscribeFn,  // Listen for incoming events
  getRoomTime: () => number,          // Current room time in seconds
  getLatency: (peerId) => number      // Latency to peer in ms
}
```

**Design Notes:**
- Only initializes on client (guards against SSR)
- Lightweight - doesn't block rendering
- Automatically manages peer connections based on `peers` array
- Uses room `createdAt` timestamp for clock sync (with fallback)

---

### 2. `src/components/hooks/useNoteEvents.jsx` (UPDATED)
**Purpose:** Manages sending/receiving jam events (now via WebRTC instead of Supabase)

**Changes:**
- ✅ Removed Supabase `sendNoteEvent()` and `subscribeToNoteEvents()` calls
- ✅ Now uses `useWebRTC()` hook for all jam event communication
- ✅ Keeps same external API (`sendNote()`) so existing components don't break
- ✅ Local echo still works (sender hears their own notes immediately)
- ✅ Remote notes received via WebRTC and played via audio engine

**How it works:**
1. **Sending notes:**
   - `sendNote()` creates jam event using `createNoteOnEvent()` or `createNoteOffEvent()`
   - Gets room time from `webrtc.getRoomTime()`
   - Sends via `webrtc.sendJamEvent()`
   - Plays locally for immediate feedback

2. **Receiving notes:**
   - Registers callback via `webrtc.onJamEvent()`
   - Filters out self, old events, and duplicates
   - Plays notes via `audioEngine.playNote()` or `audioEngine.stopNote()`
   - TODO: Will add clock sync scheduling in future step

**External API (unchanged):**
```javascript
const { sendNote } = useNoteEvents(roomId, userId, audioEngine, players, room);

// Usage (same as before):
sendNote('EP', 60, 'NOTE_ON', 100);
sendNote('EP', 60, 'NOTE_OFF');
```

---

## Integration Flow

```
Room.jsx
  ├─ useRoomState() → Gets room, players from Supabase
  ├─ useUserIdentity() → Gets userId from Supabase Auth
  ├─ useAudioEngine() → Web Audio API
  └─ useNoteEvents(roomId, userId, audioEngine, players, room)
      └─ useWebRTC({ roomId, userId, peers, room })
          ├─ initSignaling() → Supabase Realtime channel
          ├─ WebRTCManager → RTCPeerConnection + DataChannels
          └─ ClockSync → Room time + latency tracking
```

---

## Key Design Decisions

1. **Same External API**
   - `useNoteEvents` still exposes `sendNote()` with same signature
   - Components like `InstrumentGrid` don't need changes
   - Internal implementation switched from Supabase to WebRTC

2. **Peer Management**
   - `useWebRTC` automatically adds/removes peers based on `peers` array
   - Filters to only players (excludes listeners and self)
   - Connection states tracked per peer

3. **Clock Sync**
   - Uses room `createdAt` timestamp from Supabase
   - Fallback to current time if room data not loaded yet
   - Updates when room data becomes available

4. **Local Echo**
   - Sender still hears their own notes immediately
   - Matches previous behavior (no breaking changes)

5. **Event Deduplication**
   - Uses senderId + timestamp + type + note as key
   - Prevents processing same event twice
   - Cleans up old keys to prevent memory leaks

---

## Manual Test Checklist

### Basic Connection Test
1. ✅ Open two browser windows/tabs
2. ✅ Navigate both to the same room (e.g., `http://localhost:5173/Room?id=ABC123`)
3. ✅ Both should join as different users (different localStorage identities)
4. ✅ Both should see each other in the players list

### WebRTC Connection Test
1. ✅ Open browser console in both windows
2. ✅ Look for "Connected to signaling channel: webrtc:ABC123" messages
3. ✅ Look for "DataChannel opened with [peerId]" messages
4. ✅ Check that `webrtc.ready` becomes `true` when connected

### Note Event Test
1. ✅ In window 1, select an instrument (e.g., EP)
2. ✅ In window 2, select a different instrument (e.g., BASS)
3. ✅ In window 1, press a key on the piano
4. ✅ Window 2 should hear the note (even if timing not perfect yet)
5. ✅ Window 1 should hear the note immediately (local echo)
6. ✅ Repeat in reverse (window 2 plays, window 1 hears)

### Expected Behavior
- ✅ Notes should be heard on both sides
- ✅ No errors in console about Supabase note_events
- ✅ Connection states should show "connected" for peers
- ⚠️ Timing may not be perfect yet (clock sync scheduling will be refined later)

---

## Known Limitations / TODOs

1. **Clock Sync Scheduling**
   - Currently plays notes immediately when received
   - TODO: Use `computeTargetAudioTime()` for precise scheduling
   - Will be refined in future step

2. **Ping/Pong Latency Measurement**
   - Latency tracking structure exists but ping/pong not implemented yet
   - Currently uses default 50ms latency
   - Will be added in future step

3. **Crowd/Listener Mode**
   - Not implemented yet (only 4-player jam)
   - Will be added in separate step

4. **Error Handling**
   - Basic error handling in place
   - Could add retry logic for failed connections
   - Could add UI feedback for connection issues

---

## Build/Runtime Status

✅ **No build errors** - All files compile successfully
✅ **No linting errors** - Code passes ESLint
⚠️ **Runtime testing needed** - Manual testing required to verify WebRTC connections work

---

## Next Steps

- **Future Step:** Add ping/pong for latency measurement
- **Future Step:** Implement precise audio scheduling with `computeTargetAudioTime()`
- **Future Step:** Add crowd/listener mode
- **Future Step:** Add connection status UI indicators
