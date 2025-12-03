# Database Schema Documentation

## Overview

This document describes the Supabase PostgreSQL schema for Jam in a Docs. The schema supports:
- **Players**: Up to 4 players per room, connected via WebRTC P2P mesh
- **Listeners**: Up to 100 listeners per room, receiving jam events via Supabase Realtime
- **Lobby**: Room management, presence, chat
- **Signaling**: WebRTC offer/answer/ICE via Supabase Realtime channels (no persistent table)

---

## Tables

### `rooms`

Room configuration and state.

**Columns:**
- `id` (TEXT, PRIMARY KEY) - Room code (e.g., "ABC123")
- `bpm` (INTEGER, default 120) - Master tempo for clock synchronization
- `key` (TEXT, default 'C') - Musical key
- `scale` (TEXT, default 'major') - Musical scale
- `is_playing` (BOOLEAN, default false) - Whether the jam is currently playing
- `metronome_on` (BOOLEAN, default false) - Whether metronome is enabled
- `host_user_id` (UUID, nullable) - **NEW**: Designated host player for crowd distribution
  - The host player sends jam events to Supabase Realtime channel for listeners
  - Usually the first player to join, but can be reassigned
- `created_at` (TIMESTAMPTZ) - Room creation timestamp
- `updated_at` (TIMESTAMPTZ) - Last update timestamp

**Indexes:**
- Primary key on `id`
- Index on `host_user_id` (for efficient host queries)

---

### `players`

Participants in a room (both players and listeners).

**Columns:**
- `id` (UUID, PRIMARY KEY) - Unique player record ID
- `room_id` (TEXT, FOREIGN KEY → rooms.id) - Which room this participant is in
- `user_id` (UUID, FOREIGN KEY → auth.users.id) - Supabase Auth user ID
- `display_name` (TEXT) - User's display name
- `color` (TEXT) - Hex color code for UI
- `instrument` (TEXT, nullable) - Assigned instrument: 'DRUMS', 'BASS', 'EP', 'GUITAR', or NULL
  - Only applies to players (is_player = TRUE)
  - Listeners don't have instruments
- `is_player` (BOOLEAN, default TRUE) - **NEW**: Distinguishes players from listeners
  - `TRUE` = Player (can play instruments, max 4 per room, connected via WebRTC)
  - `FALSE` = Listener (can only listen, up to 100 per room, receives via Supabase Realtime)
- `webrtc_connected` (BOOLEAN, default FALSE) - **NEW**: WebRTC connection status
  - `TRUE` = WebRTC connection established with other players
  - `FALSE` = Not connected or currently connecting
  - Only applies to players (is_player = TRUE)
- `joined_at` (TIMESTAMPTZ) - When participant joined the room
- `updated_at` (TIMESTAMPTZ) - Last update timestamp

**Constraints:**
- UNIQUE(room_id, user_id) - One participant record per user per room

**Indexes:**
- Index on `room_id` (for efficient room queries)
- Index on `user_id` (for efficient user queries)
- Index on `(room_id, is_player)` where `is_player = FALSE` (for listener queries)
- Index on `(room_id, webrtc_connected)` where `is_player = TRUE` (for connection status)

---

### `chat_messages`

Text chat messages in rooms.

**Columns:**
- `id` (UUID, PRIMARY KEY) - Unique message ID
- `room_id` (TEXT, FOREIGN KEY → rooms.id) - Which room this message belongs to
- `user_id` (UUID, FOREIGN KEY → auth.users.id) - Message sender
- `display_name` (TEXT) - Sender's display name (denormalized for performance)
- `text` (TEXT) - Message content
- `created_at` (TIMESTAMPTZ) - Message timestamp

**Indexes:**
- Index on `(room_id, created_at DESC)` (for efficient message retrieval)

---

### `note_events` ⚠️ DEPRECATED

**⚠️ DEPRECATED FOR LIVE AUDIO - DO NOT USE IN JAM PATH**

This table is **no longer used** for real-time jam events. Jam events now travel exclusively via **WebRTC DataChannels** between players for ultra-low latency.

**Why it still exists:**
- Kept for backward compatibility
- Potential future use for analytics/logging
- Historical data preservation

**Important:**
- **Do NOT** insert jam events into this table during live jamming
- **Do NOT** subscribe to this table for real-time playback
- **Do NOT** query this table in the hot jam path

**Original structure (for reference):**
- `id` (UUID, PRIMARY KEY)
- `room_id` (TEXT, FOREIGN KEY → rooms.id)
- `user_id` (UUID, FOREIGN KEY → auth.users.id)
- `instrument` (TEXT) - 'DRUMS', 'BASS', 'EP', 'GUITAR'
- `note` (INTEGER) - MIDI note (0-127)
- `velocity` (INTEGER) - MIDI velocity (0-127)
- `type` (TEXT) - 'NOTE_ON' or 'NOTE_OFF'
- `created_at` (TIMESTAMPTZ)

---

## Supabase Realtime Channels

### WebRTC Signaling: `webrtc:${roomId}`

**Purpose:** Exchange WebRTC offer/answer/ICE candidates between players.

**Message format:**
```javascript
{
  from: userId,
  to: targetUserId,      // null = broadcast to all
  type: "offer" | "answer" | "ice-candidate",
  payload: { ... }       // WebRTC SDP or ICE candidate
}
```

**Usage:**
- Players publish offers/answers/ICE candidates to this channel
- Other players subscribe to receive signaling messages
- Once WebRTC connection is established, signaling stops
- No persistent storage needed (pure Realtime)

### Crowd Distribution: `jam:${roomId}:crowd`

**Purpose:** Host player broadcasts jam events to listeners.

**Message format:**
```javascript
{
  type: "jamEvent",
  event: {
    type: "noteOn" | "noteOff" | "controlChange" | "tempo",
    instrument: "DRUMS" | "BASS" | "EP" | "GUITAR",
    note: number,
    velocity: number,
    roomTime: number,
    senderId: string,
    timestamp: number
  }
}
```

**Usage:**
- Host player (first player or designated) sends jam events here
- Listeners subscribe to receive jam events
- Listeners synthesize audio locally with Web Audio API
- Acceptable higher latency than player-to-player WebRTC

---

## Row Level Security (RLS) Policy Notes

**Current policies need updates for new columns:**

### `rooms` table:
- ✅ Existing policies should work with `host_user_id`
- ⚠️ May want to restrict `host_user_id` updates to room creator or current host
- **Action needed:** Add policy to allow only room creator or current host to update `host_user_id`

### `players` table:
- ✅ Existing policies should work with `is_player` and `webrtc_connected`
- ⚠️ `webrtc_connected` should be updatable by the user themselves
- **Action needed:** Ensure users can update their own `webrtc_connected` status

### `note_events` table:
- ⚠️ Since this table is deprecated, policies can remain as-is
- **Action needed:** Consider restricting INSERTs (optional, for analytics only)

**RLS updates will be handled in a separate step.**

---

## Migration History

1. **Initial schema** (`supabase-schema.sql`) - Base tables and structure
2. **WebRTC migration** (`supabase-migration-webrtc.sql`) - Added `host_user_id`, `is_player`, `webrtc_connected`

---

## Query Examples

### Get all players (not listeners) in a room:
```sql
SELECT * FROM players 
WHERE room_id = 'ABC123' AND is_player = TRUE;
```

### Get listener count for a room:
```sql
SELECT COUNT(*) FROM players 
WHERE room_id = 'ABC123' AND is_player = FALSE;
```

### Get host player info:
```sql
SELECT p.* FROM players p
JOIN rooms r ON p.room_id = r.id
WHERE r.id = 'ABC123' AND r.host_user_id = p.user_id;
```

### Get connected players:
```sql
SELECT * FROM players 
WHERE room_id = 'ABC123' 
  AND is_player = TRUE 
  AND webrtc_connected = TRUE;
```

