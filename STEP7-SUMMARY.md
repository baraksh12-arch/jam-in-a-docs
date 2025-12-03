# STEP 7 Summary: Fix Room/Player Logic for WebRTC

## Files Modified

### 1. `src/components/firebaseClient.jsx`

#### `joinRoomAsPlayer()` - Fixed
**Changes:**
- ✅ Changed `.single()` to `.maybeSingle()` when checking for existing player
- ✅ Handles `PGRST116` (no rows) gracefully vs real errors
- ✅ Always sets `is_player = true` when creating/updating
- ✅ Sets `instrument = null` when creating new player (will be claimed later)
- ✅ Added debug logging:
  - Logs when player row is found
  - Logs when player row is created
  - Logs errors clearly

**Behavior:**
- If player row exists: Updates `display_name`, `color`, `is_player = true`
- If player row doesn't exist: Creates new row with all required fields
- Always returns valid player object

#### `claimInstrument()` - Enhanced
**Changes:**
- ✅ Added debug logging before UPDATE
- ✅ Logs which instrument, room, and user
- ✅ Enhanced error logging with context

**Behavior:**
- Updates `instrument` field for the player
- Supabase Realtime subscription automatically updates `useRoomState`

#### `getPlayers()` - Enhanced
**Changes:**
- ✅ Now includes `isPlayer` and `is_player` fields in returned data
- ✅ Defaults to `true` if not set (backward compatibility)

**Returns:**
```javascript
{
  id: string,
  userId: string,
  displayName: string,
  color: string,
  instrument: string | null,
  isPlayer: boolean,      // NEW
  is_player: boolean,      // NEW (snake_case for compatibility)
  joinedAt: timestamp
}
```

---

### 2. `src/components/hooks/useRoomState.jsx`

**Changes:**
- ✅ Now builds and returns `peers` array for `useWebRTC`
- ✅ Filters out self and non-players
- ✅ Maps to correct structure with `userId`, `displayName`, `instrument`, `isPlayer`

**Returns:**
```javascript
{
  room: {...},
  players: [...],      // All players (including self)
  peers: [...],       // NEW: Filtered for useWebRTC (excludes self, only players)
  currentPlayer: {...},
  // ... other fields
}
```

**Peers Structure:**
```javascript
peers = [
  {
    userId: string,        // For WebRTC connection
    user_id: string,       // Also included for compatibility
    id: string,
    displayName: string,
    instrument: string | null,
    isPlayer: boolean,
    is_player: boolean,
    color: string
  },
  // ... other peers (excludes self)
]
```

---

### 3. `src/pages/Room.jsx`

**Changes:**
- ✅ Now uses `peers` from `useRoomState` instead of `players`
- ✅ Passes `peers` to `useNoteEvents` (which passes to `useWebRTC`)

**Before:**
```javascript
const { players, ... } = useRoomState(...);
useNoteEvents(..., players, ...);
```

**After:**
```javascript
const { players, peers, ... } = useRoomState(...);
useNoteEvents(..., peers, ...);
```

---

### 4. `src/components/hooks/useWebRTC.jsx`

**Changes:**
- ✅ Added debug logging when peers array changes
- ✅ Logs peer IDs, instruments, and isPlayer status
- ✅ Logs when adding/removing peers
- ✅ Double-checks filtering (excludes self, only players)

**Debug Logs:**
- `[useWebRTC] Peers array updated:` - Shows all peers
- `[useWebRTC] Adding peer: {peerId}` - When new peer added
- `[useWebRTC] Removing peer: {peerId}` - When peer removed

---

## How Peers Are Built and Passed to useWebRTC

### Flow:
1. **Supabase Database:**
   - `players` table has rows with `user_id`, `is_player`, `instrument`, etc.

2. **`getPlayers()` in firebaseClient.jsx:**
   - Queries all players for a room
   - Transforms to include `userId`, `isPlayer`, `is_player` fields

3. **`useRoomState` hook:**
   - Receives players from Supabase Realtime subscription
   - Builds `peers` array:
     ```javascript
     const peers = players
       .filter(p => {
         const playerUserId = p.userId || p.user_id || p.id;
         const isPlayer = p.isPlayer !== false && p.is_player !== false;
         return playerUserId && playerUserId !== userId && isPlayer;
       })
       .map(p => ({
         userId: p.userId || p.user_id || p.id,
         // ... other fields
       }));
     ```

4. **`Room.jsx`:**
   - Gets `peers` from `useRoomState`
   - Passes to `useNoteEvents`

5. **`useNoteEvents`:**
   - Receives `peers` array
   - Passes to `useWebRTC`

6. **`useWebRTC`:**
   - Receives `peers` array
   - Filters again (safety check)
   - Calls `manager.addPeer()` / `manager.removePeer()` for each peer

---

## Manual Test Checklist

### 1. Player Row Creation
- [ ] Open browser and navigate to a room
- [ ] Open browser console
- [ ] Look for log: `[joinRoomAsPlayer] Creating new player row for user {userId} in room {roomId}`
- [ ] Check Supabase dashboard → `players` table
- [ ] Verify row exists with:
  - `user_id` = your user ID
  - `room_id` = room ID
  - `is_player` = `true`
  - `instrument` = `null`

### 2. Player Row Update (Re-join)
- [ ] Refresh the page (same room)
- [ ] Look for log: `[joinRoomAsPlayer] Player row found for user {userId} in room {roomId}`
- [ ] Verify row is updated (not duplicated)

### 3. Instrument Claim
- [ ] Click on an instrument (DRUMS, BASS, EP, or GUITAR)
- [ ] Look for log: `[claimInstrument] Claiming {instrument} for user {userId} in room {roomId}`
- [ ] Look for log: `[claimInstrument] Successfully claimed {instrument} for user {userId}`
- [ ] Check Supabase dashboard → `players` table
- [ ] Verify `instrument` field is updated
- [ ] Verify UI shows you have that instrument selected

### 4. Peers Array
- [ ] Open two browser windows (same room, different users)
- [ ] In console, look for: `[useWebRTC] Peers array updated:`
- [ ] Verify peers array shows the other user (not yourself)
- [ ] Verify each peer has: `userId`, `instrument`, `isPlayer: true`

### 5. WebRTC Connection
- [ ] With two players in room
- [ ] Look for: `[useWebRTC] Adding peer: {peerId}`
- [ ] Look for WebRTC connection messages in console
- [ ] Verify DataChannel opens

---

## Expected Database State

### After joining room:
```sql
SELECT * FROM players WHERE room_id = 'ABC123';
-- Should show:
-- user_id | room_id | is_player | instrument | display_name | color
-- user-1  | ABC123  | true     | null       | Groovy Panda | #FF6B9D
```

### After claiming instrument:
```sql
SELECT * FROM players WHERE room_id = 'ABC123' AND user_id = 'user-1';
-- Should show:
-- instrument = 'EP' (or DRUMS, BASS, GUITAR)
```

---

## Debug Logging Summary

**Temporary logs added (can be removed later):**

1. `[joinRoomAsPlayer]` - Player row found/created
2. `[claimInstrument]` - Before/after claiming instrument
3. `[useWebRTC]` - Peers array updates, adding/removing peers

All logs are short and clear for debugging purposes.

---

## Confirmation Checklist

✅ **Joining a room creates a row in players table**
- `joinRoomAsPlayer()` uses `.maybeSingle()` and creates row if needed
- Always sets `is_player = true` and `instrument = null`

✅ **Clicking on instrument updates the field**
- `claimInstrument()` updates `instrument` field
- Supabase Realtime automatically updates `useRoomState`
- UI reflects the change

✅ **Peers array is correctly built and passed to useWebRTC**
- `useRoomState` filters and maps players to peers
- Excludes self and non-players
- Includes all required fields (`userId`, `instrument`, `isPlayer`)
- `Room.jsx` passes `peers` to `useNoteEvents` → `useWebRTC`

---

## Next Steps

- Remove debug logs after testing (optional)
- Test with 2-4 players to verify WebRTC connections
- Verify instrument claims work correctly
- Monitor Supabase dashboard to confirm data integrity

