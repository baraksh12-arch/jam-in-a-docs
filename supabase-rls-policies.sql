-- Row Level Security (RLS) Policies for Jam in a Docs
-- Run this in your Supabase SQL Editor AFTER creating the schema

-- Enable RLS on all tables
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- ROOMS POLICIES
-- Anyone can read rooms (to join)
CREATE POLICY "Anyone can read rooms"
  ON rooms FOR SELECT
  USING (true);

-- Anyone can create rooms
CREATE POLICY "Anyone can create rooms"
  ON rooms FOR INSERT
  WITH CHECK (true);

-- Anyone can update rooms (for BPM, key, scale, play/pause controls)
CREATE POLICY "Anyone can update rooms"
  ON rooms FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- PLAYERS POLICIES
-- Anyone can read players in a room
CREATE POLICY "Anyone can read players"
  ON players FOR SELECT
  USING (true);

-- Users can insert themselves as players
CREATE POLICY "Users can insert themselves as players"
  ON players FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can update their own player record
CREATE POLICY "Users can update their own player"
  ON players FOR UPDATE
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can delete their own player record
CREATE POLICY "Users can delete their own player"
  ON players FOR DELETE
  USING (auth.uid() = user_id OR user_id IS NULL);

-- NOTE EVENTS POLICIES
-- Anyone in a room can read note events
CREATE POLICY "Anyone can read note events"
  ON note_events FOR SELECT
  USING (true);

-- Users can insert their own note events
CREATE POLICY "Users can insert their own note events"
  ON note_events FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- CHAT MESSAGES POLICIES
-- Anyone in a room can read chat messages
CREATE POLICY "Anyone can read chat messages"
  ON chat_messages FOR SELECT
  USING (true);

-- Users can insert their own chat messages
CREATE POLICY "Users can insert their own chat messages"
  ON chat_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

