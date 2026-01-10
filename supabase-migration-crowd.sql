-- Migration: Add Crowd Members Support
-- Run this in your Supabase SQL Editor after the main schema
-- This adds support for crowd members who can watch and broadcast their camera

-- Add is_player column (defaults to true for backwards compatibility)
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS is_player BOOLEAN NOT NULL DEFAULT true;

-- Add is_crowd column (defaults to false)
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS is_crowd BOOLEAN NOT NULL DEFAULT false;

-- Create index for querying crowd members efficiently
CREATE INDEX IF NOT EXISTS idx_players_room_id_is_crowd ON players(room_id, is_crowd) WHERE is_crowd = true;

-- Update existing players to have is_player = true (just in case)
UPDATE players SET is_player = true WHERE is_player IS NULL;

-- Comment for documentation
COMMENT ON COLUMN players.is_player IS 'True if user can play instruments, false if they are just watching (crowd member)';
COMMENT ON COLUMN players.is_crowd IS 'True if user is a crowd member who can watch and broadcast their camera';
