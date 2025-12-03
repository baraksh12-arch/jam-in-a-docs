# STEP 8 Summary: Fix WebRTC Receive Path & Dynamic Peers

## Files Modified

### 1. `src/components/hooks/useNoteEvents.jsx`

**Changes:**
- ✅ Added check for `webrtc.ready` before setting up event listener
- ✅ Enhanced debug logging for received events
- ✅ Fixed filtering logic to use string comparison (`String(event.senderId) === String(userId)`)
- ✅ Added logging at each step: received, filtered, played
- ✅ Effect now depends on `webrtc.ready` to ensure it runs when WebRTC is connected

**Key Fix:**
- The effect now waits for `webrtc.ready === true` before registering the event listener
- This ensures DataChannels are actually open before we try to receive events

**Debug Logs Added:**
- `[useNoteEvents] Not ready yet:` - Shows why listener isn't set up
- `[useNoteEvents] Setting up jam event listener` - When listener is registered
- `[useNoteEvents] Received jam event` - Every incoming event with full details
- `[useNoteEvents] Ignoring event from self` - When self-filter works
- `[useNoteEvents] Playing note:` - When note is actually played

---

### 2. `src/components/hooks/useWebRTC.jsx`

**Changes:**
- ✅ Enhanced peer management logging
- ✅ Added `ready` and `connectionStates` to effect dependencies
- ✅ Normalized peer ID comparisons to strings for consistency
- ✅ More detailed logging of peer changes and connection states

**Key Fix:**
- Effect dependencies now include `ready` and `connectionStates` to ensure it reacts to connection changes
- Peer ID comparisons normalized to strings to avoid UUID vs string mismatches

**Debug Logs Added:**
- `[useWebRTC] Peers changed:` - Full peers array with details
- `[useWebRTC] Filtered player peers:` - After filtering
- `[useWebRTC] Connection state:` - Current vs target peer IDs
- `[useWebRTC] Adding peer:` - When new peer is added
- `[useWebRTC] Peer already in connection set` - When peer already exists

---

### 3. `src/lib/webrtcManager.js`

**Changes:**
- ✅ Added logging to `sendJamEvent()` to track sending
- ✅ Added logging to DataChannel `onmessage` handler to track receiving
- ✅ Logs channel state and send/receive counts

**Debug Logs Added:**
- `[WebRTCManager] Sending jam event:` - Event details before sending
- `[WebRTCManager] Sending to peer {peerId}` - Per-peer send attempt
- `[WebRTCManager] DataChannel to {peerId} not open` - When channel isn't ready
- `[WebRTCManager] Sent jam event to {count} peer(s)` - Send summary
- `[WebRTCManager] DataChannel message received from {peerId}` - Raw message received
- `[WebRTCManager] Deserialized jam event from {peerId}` - After parsing

---

## Key Fixes

### 1. Receive Path Fixed

**Problem:** Events weren't being received because:
- Effect was running before WebRTC was ready
- No logging to debug what was happening

**Solution:**
- Added `webrtc.ready` check before setting up listener
- Added comprehensive logging to track event flow
- Fixed string comparison for senderId filtering

### 2. Dynamic Peer Updates Fixed

**Problem:** Peers weren't updating dynamically because:
- Effect dependencies might not have been triggering re-runs
- Peer ID format mismatches (UUID vs string)

**Solution:**
- Added `ready` and `connectionStates` to dependencies
- Normalized all peer ID comparisons to strings
- Enhanced logging to see when peers change

---

## Manual Test Flow & Expected Results

### Setup
1. Start dev server: `npm run dev`
2. Open Browser A: Navigate to room (e.g., `http://localhost:5173/Room?id=ABC123`)
3. Open Browser B: Navigate to same room URL

### Test Steps

#### Step 1: Both Join Room
- **Browser A:** Should see log: `[joinRoomAsPlayer] Creating new player row...`
- **Browser B:** Should see log: `[joinRoomAsPlayer] Creating new player row...`
- **Both:** Check Supabase `players` table - should have 2 rows with `is_player = true`

#### Step 2: Claim Instruments (No Refresh)
- **Browser A:** Click on EP (Electric Piano)
  - Should see: `[claimInstrument] Claiming EP for user...`
  - Should see: `[useWebRTC] Peers changed:` with 1 peer (Browser B)
  - Should see: `[useWebRTC] Adding peer: {Browser B userId}`
- **Browser B:** Click on BASS
  - Should see: `[claimInstrument] Claiming BASS for user...`
  - Should see: `[useWebRTC] Peers changed:` with 1 peer (Browser A)
  - Should see: `[useWebRTC] Adding peer: {Browser A userId}`

#### Step 3: WebRTC Connection
- **Both browsers:** Should see:
  - `[useWebRTC] Peers changed:` showing exactly 1 peer
  - `Connected to signaling channel: webrtc:ABC123`
  - `DataChannel opened with {peerId}`
  - `[useNoteEvents] Setting up jam event listener` (when ready becomes true)

#### Step 4: Play Notes from Browser A
- **Browser A:** Press keys on EP
  - Should see: `[WebRTCManager] Sending jam event:` with event details
  - Should see: `[WebRTCManager] Sending to peer {Browser B userId}`
  - Should see: `[WebRTCManager] Sent jam event to 1 peer(s)`
  - Should hear: Local echo (immediate playback)
  
- **Browser B:** Should see:
  - `[WebRTCManager] DataChannel message received from {Browser A userId}`
  - `[WebRTCManager] Deserialized jam event from {Browser A userId}`
  - `[useNoteEvents] Received jam event` with full event details
  - `[useNoteEvents] Playing note:` with instrument/note details
  - Should hear: Note played through audio engine

#### Step 5: Play Notes from Browser B
- **Browser B:** Press keys on BASS
  - Should see same sending logs as Browser A
  
- **Browser A:** Should see:
  - Same receiving logs as Browser B saw
  - Should hear: Note played through audio engine

---

## Expected Console Output (Example)

### Browser A (after claiming EP and Browser B joins):
```
[useWebRTC] Peers changed: { peersCount: 1, peers: [{ userId: 'user-b-id', instrument: null }] }
[useWebRTC] Adding peer: user-b-id
Connected to signaling channel: webrtc:ABC123
DataChannel opened with user-b-id
[useNoteEvents] Setting up jam event listener, userId: user-a-id
```

### Browser A (when playing a note):
```
[WebRTCManager] Sending jam event: { type: 'noteOn', instrument: 'EP', note: 60, senderId: 'user-a-id' }
[WebRTCManager] Sending to peer user-b-id, channel state: open
[WebRTCManager] Sent jam event to 1 peer(s)
```

### Browser B (when receiving note from Browser A):
```
[WebRTCManager] DataChannel message received from user-a-id: {"type":"noteOn","instrument":"EP",...}
[WebRTCManager] Deserialized jam event from user-a-id: { type: 'noteOn', ... }
[useNoteEvents] Received jam event { type: 'noteOn', senderId: 'user-a-id', myUserId: 'user-b-id' }
[useNoteEvents] Playing note: { type: 'noteOn', instrument: 'EP', note: 60 }
```

---

## Troubleshooting Guide

### If events are received but not played:
- Check: `[useNoteEvents] Playing note:` log appears
- Check: `audioEngine.playNote()` is being called
- Check: Audio engine is ready (`audioEngine.isReady === true`)

### If no events are received:
- Check: `[useWebRTC] Peers changed:` shows peers
- Check: `[useWebRTC] Adding peer:` appears
- Check: `DataChannel opened with {peerId}` appears
- Check: `[useNoteEvents] Setting up jam event listener` appears
- Check: `[WebRTCManager] DataChannel message received` appears

### If peers don't update after claiming instrument:
- Check: `[claimInstrument] Successfully claimed` appears
- Check: Supabase Realtime subscription updates `useRoomState`
- Check: `[useWebRTC] Peers changed:` shows updated peers array
- Check: `[useWebRTC] Adding peer:` appears for new peer

---

## Summary of Changes

✅ **Receive Path:**
- Events now wait for `webrtc.ready` before setting up listener
- Comprehensive logging at every step
- Fixed senderId comparison to use strings

✅ **Dynamic Peers:**
- Effect dependencies include `ready` and `connectionStates`
- Peer ID comparisons normalized to strings
- Enhanced logging to track peer changes

✅ **Debug Logging:**
- Added logs throughout the event flow
- Can trace events from send → receive → play
- Can see peer connection state changes

---

## Next Steps

After verifying this works:
- Remove or reduce debug logging (optional)
- Test with 3-4 players
- Implement clock-based scheduling (future step)
- Add crowd/listener mode (future step)

