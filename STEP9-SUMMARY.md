# STEP 9 Summary: Stabilize WebRTC DataChannel Lifecycle

## Problem Identified

From logs, DataChannels were being closed unnecessarily:
- `DataChannel error: OperationError: User-Initiated Abort, reason=Close called`
- `useNoteEvents` was unsubscribing when `webrtc.ready` flipped to false
- `useWebRTC` was trying to re-add peers that already existed
- Effect dependencies were causing loops

## Files Modified

### 1. `src/components/hooks/useWebRTC.jsx`

**Key Changes:**

1. **Stabilized `ready` flag computation:**
   - Changed from state (`useState`) to computed value (`useMemo`)
   - Computed from `connectionStates`: `ready = has at least one 'connected' peer`
   - Prevents unnecessary re-renders and effect re-runs

2. **Fixed peer management effect:**
   - Removed `ready` and `connectionStates` from dependencies
   - Now only depends on `peers` and `userId`
   - Uses stable `targetPeerIds` array (sorted, normalized to strings)
   - Only adds peers that don't exist in current set
   - Only removes peers that are no longer in target list

3. **Improved logging:**
   - Shows target vs current peer IDs clearly
   - Logs only when actually adding/removing (not on every render)

**Before:**
```javascript
useEffect(() => {
  // ... peer management
}, [peers, userId, ready, connectionStates]); // ❌ Causes loops
```

**After:**
```javascript
useEffect(() => {
  // ... peer management
}, [peers, userId]); // ✅ Stable dependencies
```

---

### 2. `src/lib/webrtcManager.js`

**Key Changes:**

1. **Made `addPeer()` idempotent:**
   - Checks if peer already exists with state 'connected' or 'connecting'
   - Returns early if peer connection already exists
   - Prevents duplicate connection attempts
   - Logs clearly when skipping vs adding

2. **Made `removePeer()` idempotent:**
   - Checks if peer exists before trying to remove
   - Only closes DataChannel/RTCPeerConnection if not already closed
   - Safe to call multiple times

3. **Added `getAllPeerIds()` method:**
   - Returns all peer IDs regardless of connection state
   - Used by `useWebRTC` to compare target vs current peers

4. **Improved DataChannel error handling:**
   - `onclose` handler checks if close was expected (state already 'disconnected')
   - `onerror` handler only updates state if channel is actually closed
   - Prevents cascading state updates

**Before:**
```javascript
addPeer(peerId) {
  if (this.peerConnections.has(peerId)) {
    console.warn(`Peer ${peerId} already added`);
    return; // ❌ But might still try to add
  }
  // ...
}
```

**After:**
```javascript
addPeer(peerId) {
  const existingState = this.connectionStates.get(peerId);
  if (existingState === 'connected' || existingState === 'connecting') {
    console.log(`Peer ${peerId} already exists with state: ${existingState}, skipping`);
    return; // ✅ Truly idempotent
  }
  // ...
}
```

---

### 3. `src/components/hooks/useNoteEvents.jsx`

**Key Changes:**

1. **Stabilized event listener:**
   - Removed `webrtc.ready` from effect dependencies
   - Listener stays registered even when `ready` temporarily becomes false
   - Uses ref to access current `webrtc.ready` state inside callback (avoids stale closure)
   - Only processes events when `ready === true`, but doesn't unsubscribe

2. **Improved ready check:**
   - Checks `webrtc.ready` inside callback using ref (always current value)
   - Logs when ignoring events due to not ready

**Before:**
```javascript
useEffect(() => {
  if (!webrtc?.ready) return; // ❌ Unsubscribes when ready becomes false
  const unsubscribe = webrtc.onJamEvent(...);
  return () => unsubscribe();
}, [webrtc, webrtc?.ready, ...]); // ❌ Re-runs when ready changes
```

**After:**
```javascript
useEffect(() => {
  if (!webrtc || !webrtc.onJamEvent) return;
  const unsubscribe = webrtc.onJamEvent((event) => {
    if (!webrtcRef.current?.ready) return; // ✅ Check inside callback
    // process event
  });
  return () => unsubscribe();
}, [webrtc, webrtc?.onJamEvent, ...]); // ✅ Stable - doesn't depend on ready
```

---

## Key Fixes

### 1. DataChannels Stay Open
- **Problem:** Channels were being closed when peers array changed
- **Solution:** Only add/remove peers when they actually join/leave, not when other properties change
- **Result:** Channels stay open once connected

### 2. Ready Flag Stability
- **Problem:** `ready` was flipping to false unnecessarily
- **Solution:** Computed from connectionStates with `useMemo`, only false when all peers disconnected
- **Result:** `ready` stays true as long as at least one peer is connected

### 3. Event Listener Stability
- **Problem:** Listener was unsubscribing when `ready` became false
- **Solution:** Keep listener registered, check `ready` inside callback
- **Result:** Listener stays active, processes events when ready

### 4. Idempotent Peer Management
- **Problem:** `addPeer()` was being called multiple times for same peer
- **Solution:** Check connection state before adding, skip if already exists
- **Result:** No duplicate connections, no unnecessary channel closures

---

## Expected Behavior After Fix

### Console Logs (2-browser test):

**Initial Connection:**
```
[useWebRTC] Peer management: { targetPeerIds: ['user-b'], currentPeerIds: [], ... }
[useWebRTC] Adding new peer: user-b
[WebRTCManager] Adding new peer: user-b
Connected to signaling channel: webrtc:ABC123
DataChannel opened with user-b
[useNoteEvents] Setting up jam event listener
```

**After Connection (stable):**
- No more "Peer already added" spam
- No "OperationError: User-Initiated Abort" unless peer actually leaves
- `webrtc.ready` stays `true`
- Event listener stays registered

**When Playing Notes:**
```
[WebRTCManager] Sending jam event: { type: 'noteOn', ... }
[WebRTCManager] Sending to peer user-b, channel state: open
[WebRTCManager] DataChannel message received from user-a: {...}
[useNoteEvents] Received jam event { senderId: 'user-a', ... }
[useNoteEvents] Playing note: { type: 'noteOn', instrument: 'EP', note: 60 }
```

---

## Manual Test Checklist

### Setup
1. Start dev server
2. Open Browser A: Create/join room
3. Open Browser B: Join same room

### Test 1: Claim Instruments (No Refresh)
- **Browser A:** Click EP
  - ✅ Should see: `[useWebRTC] Adding new peer: {Browser B userId}`
  - ✅ Should see: `DataChannel opened with {Browser B userId}`
  - ✅ Should NOT see: "Peer already added" spam
- **Browser B:** Click BASS
  - ✅ Should see: `[useWebRTC] Adding new peer: {Browser A userId}`
  - ✅ Should see: `DataChannel opened with {Browser A userId}`
  - ✅ Should NOT see: "Peer already added" spam

### Test 2: Play Notes from Browser A
- **Browser A:** Press keys
  - ✅ Should see: `[WebRTCManager] Sending jam event...`
  - ✅ Should see: `[WebRTCManager] Sent jam event to 1 peer(s)`
  - ✅ Should hear: Local echo
- **Browser B:** 
  - ✅ Should see: `[WebRTCManager] DataChannel message received...`
  - ✅ Should see: `[useNoteEvents] Received jam event...`
  - ✅ Should see: `[useNoteEvents] Playing note...`
  - ✅ Should hear: Note played

### Test 3: Stability Check
- **Both browsers:** Check console
  - ✅ Should NOT see: "OperationError: User-Initiated Abort" repeatedly
  - ✅ Should NOT see: `[useNoteEvents] Cleaning up jam event listener` repeatedly
  - ✅ Should NOT see: `[useWebRTC] Peers changed` with same peers repeatedly
  - ✅ `webrtc.ready` should stay `true` once connected

### Test 4: Play from Browser B
- **Browser B:** Press keys
  - ✅ Browser A should receive and play notes
  - ✅ Same behavior as Test 2, reversed

---

## Summary of Changes

✅ **Peer Management:**
- Stable target peer IDs (sorted, normalized)
- Only add/remove when truly needed
- Effect dependencies reduced to `[peers, userId]`

✅ **WebRTCManager:**
- `addPeer()` is idempotent (checks state before adding)
- `removePeer()` is idempotent (checks existence before removing)
- Better error handling (doesn't cascade)

✅ **Ready Flag:**
- Computed with `useMemo` from connectionStates
- Only false when all peers disconnected
- Doesn't cause effect re-runs

✅ **Event Listener:**
- Stays registered even when `ready` changes
- Uses ref to check current `ready` state
- Only processes events when ready

---

## Expected Console Output (Stable Session)

**Browser A (after both claim instruments):**
```
[useWebRTC] Peer management: { targetPeerIds: ['user-b'], currentPeerIds: ['user-b'] }
# No "Adding peer" - already exists ✅
[useNoteEvents] Setting up jam event listener, userId: user-a, webrtc.ready: true
# Listener stays registered ✅
```

**When playing:**
```
[WebRTCManager] Sending jam event: { type: 'noteOn', ... }
[WebRTCManager] Sending to peer user-b, channel state: open
[WebRTCManager] Sent jam event to 1 peer(s)
# No errors, no closures ✅
```

---

## Next Steps

After verifying stability:
- Test with 3-4 players
- Implement clock-based scheduling (future step)
- Add crowd/listener mode (future step)
- Remove/reduce debug logging (optional)

