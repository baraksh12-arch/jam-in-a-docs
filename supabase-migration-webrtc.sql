-- Migration: Add WebRTC architecture support
-- Run this in your Supabase SQL Editor AFTER the initial schema is created
-- This migration adds columns needed for WebRTC player-to-player connections and listener/crowd support

-- ============================================================================
-- ROOMS TABLE UPDATES
-- ============================================================================

-- Add host_user_id to designate which player is the host for crowd distribution
-- The host player sends jam events to Supabase Realtime for listeners
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS host_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add comment explaining the column
COMMENT ON COLUMN rooms.host_user_id IS 'Designated host player for crowd distribution. Host sends jam events to Supabase Realtime channel for listeners.';

-- ============================================================================
-- PLAYERS TABLE UPDATES
-- ============================================================================

-- Add is_player to distinguish between players (4 max) and listeners (up to 100)
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS is_player BOOLEAN NOT NULL DEFAULT TRUE;

-- Add comment explaining the column
COMMENT ON COLUMN players.is_player IS 'TRUE = player (can play instruments, max 4 per room). FALSE = listener (can only listen, up to 100 per room).';

-- Add webrtc_connected to track WebRTC connection status
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS webrtc_connected BOOLEAN NOT NULL DEFAULT FALSE;

-- Add comment explaining the column
COMMENT ON COLUMN players.webrtc_connected IS 'TRUE = WebRTC connection established with other players. FALSE = not connected or connecting.';

-- Add index for efficient queries on is_player
CREATE INDEX IF NOT EXISTS idx_players_is_player ON players(room_id, is_player) WHERE is_player = FALSE;

-- ============================================================================
-- NOTE_EVENTS TABLE - DEPRECATED FOR LIVE AUDIO
-- ============================================================================

-- Add comment to note_events table marking it as deprecated for live audio
COMMENT ON TABLE note_events IS 'DEPRECATED: This table is no longer used for real-time jam events. Jam events now travel via WebRTC DataChannels between players. This table is kept only for potential future analytics/logging purposes. Do not subscribe to this table for real-time playback.';

-- Note: We keep the table structure intact, but it should not be used in the jam path
-- The table remains in the database for backward compatibility and potential analytics

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for querying players by room and connection status
CREATE INDEX IF NOT EXISTS idx_players_room_webrtc ON players(room_id, webrtc_connected) WHERE is_player = TRUE;

-- Index for querying host user
CREATE INDEX IF NOT EXISTS idx_rooms_host_user ON rooms(host_user_id) WHERE host_user_id IS NOT NULL;

