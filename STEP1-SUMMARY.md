# STEP 1 Summary: Database Schema Updates for WebRTC

## What Changed

### New Columns Added

**`rooms` table:**
- `host_user_id` (UUID, nullable) - Designates which player is the host for crowd distribution

**`players` table:**
- `is_player` (BOOLEAN, default TRUE) - Distinguishes players from listeners
- `webrtc_connected` (BOOLEAN, default FALSE) - Tracks WebRTC connection status

### Deprecated Table

**`note_events` table:**
- Marked as deprecated for live audio
- Kept in database for potential analytics/logging
- **Do NOT use** for real-time jam events (use WebRTC DataChannels instead)

## Files Created

1. **`supabase-migration-webrtc.sql`** - SQL migration script
   - ALTER TABLE statements to add new columns
   - Indexes for performance
   - Comments explaining each column

2. **`SCHEMA.md`** - Complete schema documentation
   - Table descriptions
   - Column explanations
   - Supabase Realtime channel documentation
   - Query examples
   - RLS policy notes

## How to Apply

1. Open Supabase SQL Editor
2. Run `supabase-migration-webrtc.sql`
3. Verify columns were added:
   ```sql
   SELECT column_name, data_type, column_default 
   FROM information_schema.columns 
   WHERE table_name = 'rooms' AND column_name IN ('host_user_id');
   
   SELECT column_name, data_type, column_default 
   FROM information_schema.columns 
   WHERE table_name = 'players' AND column_name IN ('is_player', 'webrtc_connected');
   ```

## RLS Policy Updates Needed (Future Step)

- **`rooms`**: Add policy to restrict `host_user_id` updates to room creator or current host
- **`players`**: Ensure users can update their own `webrtc_connected` status
- **`note_events`**: Consider restricting INSERTs (optional, since deprecated)

## Next Steps

- No frontend code changes yet
- Schema is ready for WebRTC implementation
- Wait for "GO STEP X" to proceed with WebRTC code

