import { supabase } from '@/api/supabaseClient';

/**
 * Room Operations
 * Fixed: Returns room object with id field for consistent navigation
 */
export async function createRoom(roomId) {
  if (!roomId || typeof roomId !== 'string' || roomId.length === 0) {
    throw new Error('Invalid room ID');
  }

  try {
    console.log('[createRoom] Creating room with id:', roomId);
    
    const { data, error } = await supabase
      .from('rooms')
      .insert({
        id: roomId,
        bpm: 120,
        key: 'C',
        scale: 'major',
        is_playing: false,
        metronome_on: false
      })
      .select()
      .single();

    if (error) {
      console.error('[createRoom] Error inserting room:', { roomId, error });
      throw error;
    }

    if (!data || !data.id) {
      throw new Error('Room created but no data returned');
    }

    console.log('[createRoom] Successfully created room:', data.id);
    // Return the room data directly for easier access to .id
    return data;
  } catch (error) {
    console.error('[createRoom] Failed to create room:', { roomId, error });
    throw new Error(error.message || 'Failed to create room');
  }
}

export async function getRoom(roomId) {
  if (!roomId) {
    console.warn('[getRoom] No roomId provided');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .maybeSingle(); // Use maybeSingle() instead of single() for cleaner null handling

    if (error) {
      console.error('[getRoom] Error fetching room:', { roomId, error });
      throw error;
    }

    if (!data) {
      console.warn('[getRoom] No room found for id:', roomId);
      return null;
    }

    // Transform to match expected format
    return {
      id: data.id,
      bpm: data.bpm,
      key: data.key,
      scale: data.scale,
      isPlaying: data.is_playing,
      metronomeOn: data.metronome_on,
      createdAt: data.created_at,
      created_at: data.created_at, // Include both formats for compatibility
      updatedAt: data.updated_at,
      updated_at: data.updated_at
    };
  } catch (error) {
    console.error('[getRoom] Error getting room:', { roomId, error });
    throw new Error(error.message || 'Failed to get room');
  }
}

export async function updateRoom(roomId, data) {
  try {
    const updateData = {};
    if (data.bpm !== undefined) updateData.bpm = data.bpm;
    if (data.key !== undefined) updateData.key = data.key;
    if (data.scale !== undefined) updateData.scale = data.scale;
    if (data.isPlaying !== undefined) updateData.is_playing = data.isPlaying;
    if (data.metronomeOn !== undefined) updateData.metronome_on = data.metronomeOn;

    const { data: updatedRoom, error } = await supabase
      .from('rooms')
      .update(updateData)
      .eq('id', roomId)
      .select()
      .single();

    if (error) throw error;
    return { data: updatedRoom };
  } catch (error) {
    console.error('Error updating room:', error);
    throw new Error(error.message || 'Failed to update room');
  }
}

/**
 * Player Operations
 */
export async function joinRoomAsPlayer(roomId, userId, displayName, color) {
  if (!roomId || !userId) {
    throw new Error('Room ID and User ID are required');
  }
  if (!displayName || displayName.trim().length === 0) {
    throw new Error('Display name is required');
  }
  if (!color || !/^#[0-9A-F]{6}$/i.test(color)) {
    throw new Error('Valid color hex code is required');
  }

  try {
    // First, ensure room exists
    const room = await getRoom(roomId);
    if (!room) {
      await createRoom(roomId);
    }

    // Check if player already exists (use maybeSingle to handle no rows gracefully)
    const { data: existingPlayer, error: queryError } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();

    // Handle real errors (not just "no rows found")
    if (queryError && queryError.code !== 'PGRST116') {
      console.error('Error querying for existing player:', queryError);
      throw queryError;
    }

    if (existingPlayer) {
      // Player row found - update it
      console.log(`[joinRoomAsPlayer] Player row found for user ${userId} in room ${roomId}`);
      
      const { data, error } = await supabase
        .from('players')
        .update({
          display_name: displayName,
          color: color,
          is_player: true, // Ensure is_player is set
          updated_at: new Date().toISOString()
        })
        .eq('id', existingPlayer.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating existing player:', error);
        throw error;
      }
      return { data };
    }

    // No player row found - create new one
    console.log(`[joinRoomAsPlayer] Creating new player row for user ${userId} in room ${roomId}`);
    
    const { data, error } = await supabase
      .from('players')
      .insert({
        room_id: roomId,
        user_id: userId,
        display_name: displayName,
        color: color,
        is_player: true, // Explicitly set as player (not listener)
        instrument: null // Will be claimed later
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating new player:', error);
      throw error;
    }
    
    console.log(`[joinRoomAsPlayer] Successfully created player row for user ${userId}`);
    return { data };
  } catch (error) {
    console.error('Error joining room as player:', error);
    throw new Error(error.message || 'Failed to join room');
  }
}

export async function claimInstrument(roomId, userId, instrument) {
  if (!roomId || !userId || !instrument) {
    throw new Error('Room ID, User ID, and Instrument are required');
  }

  console.log(`[claimInstrument] Claiming ${instrument} for user ${userId} in room ${roomId}`);
  
  try {
    const { data, error } = await supabase
      .from('players')
      .update({
        instrument: instrument,
        updated_at: new Date().toISOString()
      })
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error(`[claimInstrument] Error claiming ${instrument} for user ${userId}:`, error);
      throw error;
    }
    
    console.log(`[claimInstrument] Successfully updated instrument to ${instrument} for user ${userId}`);
    // Note: Supabase Realtime subscription will automatically update useRoomState
    // No need to manually refresh - the subscription in subscribeToPlayers will fire
    return { data };
  } catch (error) {
    console.error(`[claimInstrument] Error claiming instrument ${instrument}:`, error);
    throw new Error(error.message || 'Failed to claim instrument');
  }
}

export async function releaseInstrument(roomId, userId) {
  try {
    const { data, error } = await supabase
      .from('players')
      .update({
        instrument: null,
        updated_at: new Date().toISOString()
      })
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return { data };
  } catch (error) {
    console.error('Error releasing instrument:', error);
    throw new Error(error.message || 'Failed to release instrument');
  }
}

export async function getPlayers(roomId) {
  try {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true });

    if (error) throw error;

    // Transform to match expected format
    return (data || []).map(player => ({
      id: player.user_id || player.id,
      userId: player.user_id,
      displayName: player.display_name,
      color: player.color,
      instrument: player.instrument,
      isPlayer: player.is_player !== false, // Default to true if not set
      is_player: player.is_player !== false, // Also include snake_case for compatibility
      joinedAt: player.joined_at
    }));
  } catch (error) {
    console.error('Error getting players:', error);
    throw new Error(error.message || 'Failed to get players');
  }
}

/**
 * Note Event Operations
 */
export async function sendNoteEvent(roomId, userId, instrument, type, note, velocity) {
  if (!roomId || !userId) {
    throw new Error('Room ID and User ID are required');
  }
  if (!['DRUMS', 'BASS', 'EP', 'GUITAR'].includes(instrument)) {
    throw new Error('Invalid instrument');
  }
  if (!['NOTE_ON', 'NOTE_OFF'].includes(type)) {
    throw new Error('Invalid note type');
  }
  if (typeof note !== 'number' || note < 0 || note > 127) {
    throw new Error('Note must be a MIDI note number (0-127)');
  }
  if (typeof velocity !== 'number' || velocity < 0 || velocity > 127) {
    throw new Error('Velocity must be between 0 and 127');
  }

  try {
    const { data, error } = await supabase
      .from('note_events')
      .insert({
        room_id: roomId,
        user_id: userId,
        instrument: instrument,
        note: note,
        velocity: velocity,
        type: type
      })
      .select()
      .single();

    if (error) throw error;
    return { data };
  } catch (error) {
    console.error('Error sending note event:', error);
    throw new Error(error.message || 'Failed to send note event');
  }
}

export async function getNoteEvents(roomId, since = null) {
  try {
    let query = supabase
      .from('note_events')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    if (since) {
      query = query.gt('created_at', since);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Transform to match expected format
    return (data || []).map(event => ({
      id: event.id,
      userId: event.user_id,
      instrument: event.instrument,
      note: event.note,
      velocity: event.velocity,
      type: event.type,
      timestamp: new Date(event.created_at).getTime(),
      createdAt: event.created_at
    }));
  } catch (error) {
    console.error('Error getting note events:', error);
    throw new Error(error.message || 'Failed to get note events');
  }
}

/**
 * Chat Message Operations
 */
export async function sendChatMessage(roomId, userId, displayName, text) {
  if (!roomId || !userId) {
    throw new Error('Room ID and User ID are required');
  }
  if (!text || text.trim().length === 0) {
    throw new Error('Message text cannot be empty');
  }
  if (text.length > 500) {
    throw new Error('Message text is too long (max 500 characters)');
  }

  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        room_id: roomId,
        user_id: userId,
        display_name: displayName,
        text: text
      })
      .select()
      .single();

    if (error) throw error;
    return { data };
  } catch (error) {
    console.error('Error sending chat message:', error);
    throw new Error(error.message || 'Failed to send chat message');
  }
}

export async function getChatMessages(roomId) {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Transform to match expected format
    return (data || []).map(msg => ({
      id: msg.id,
      userId: msg.user_id,
      displayName: msg.display_name,
      text: msg.text,
      createdAt: msg.created_at
    }));
  } catch (error) {
    console.error('Error getting chat messages:', error);
    throw new Error(error.message || 'Failed to get chat messages');
  }
}

/**
 * Supabase Realtime Subscriptions
 * Replaces polling with real-time database subscriptions
 */
/**
 * Fixed: Added retry logic for initial fetch to handle race conditions
 * when room is just created and navigation happens immediately
 */
export function subscribeToRoom(roomId, callback) {
  if (!roomId) {
    console.warn('[subscribeToRoom] No roomId provided');
    callback(null);
    return () => {};
  }

  // Initial fetch with retry logic to handle race conditions
  // Increased retries and delay to handle Supabase replication delays
  const fetchWithRetry = async (retries = 5, delay = 300) => {
    for (let i = 0; i < retries; i++) {
      try {
        const room = await getRoom(roomId);
        if (room) {
          callback(room);
          return;
        }
        // If room not found and we have retries left, wait and try again
        if (i < retries - 1) {
          console.log(`[subscribeToRoom] Room not found, retrying... (${i + 1}/${retries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.error('[subscribeToRoom] Error fetching room:', error);
        if (i === retries - 1) {
          // Last retry failed, call callback with null
          callback(null);
        } else {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    // All retries exhausted, room not found
    callback(null);
  };

  fetchWithRetry();

  // Subscribe to changes
  const channel = supabase
    .channel(`room:${roomId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${roomId}`
      },
      async (payload) => {
        try {
          const room = await getRoom(roomId);
          callback(room);
        } catch (error) {
          console.error('Error handling room update:', error);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToPlayers(roomId, callback) {
  if (!roomId) {
    console.warn('[subscribeToPlayers] No roomId provided');
    return () => {}; // Return no-op unsubscribe function
  }

  console.log(`[subscribeToPlayers] Setting up subscription for room ${roomId}`);

  // Initial fetch
  getPlayers(roomId)
    .then(players => {
      console.log(`[subscribeToPlayers] Initial players fetch:`, players.length, 'players');
      callback(players);
    })
    .catch(error => {
      console.error('[subscribeToPlayers] Error in initial fetch:', error);
      callback([]); // Call with empty array on error
    });

  // Subscribe to changes
  const channel = supabase
    .channel(`players:${roomId}`)
    .on(
      'postgres_changes',
      {
        event: '*', // Listen to INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'players',
        filter: `room_id=eq.${roomId}`
      },
      async (payload) => {
        console.log(`[subscribeToPlayers] Players table changed:`, payload.eventType, payload.new || payload.old);
        try {
          // Refetch all players to get the latest state
          const players = await getPlayers(roomId);
          console.log(`[subscribeToPlayers] Updated players list:`, players.length, 'players');
          callback(players);
        } catch (error) {
          console.error('[subscribeToPlayers] Error handling players update:', error);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[subscribeToPlayers] Successfully subscribed to players for room ${roomId}`);
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`[subscribeToPlayers] Channel error for room ${roomId}`);
      }
    });

  return () => {
    console.log(`[subscribeToPlayers] Unsubscribing from players for room ${roomId}`);
    supabase.removeChannel(channel);
  };
}

export function subscribeToChatMessages(roomId, callback) {
  // Initial fetch
  getChatMessages(roomId).then(callback).catch(console.error);

  // Subscribe to new messages
  const channel = supabase
    .channel(`chat:${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `room_id=eq.${roomId}`
      },
      async () => {
        try {
          const messages = await getChatMessages(roomId);
          callback(messages);
        } catch (error) {
          console.error('Error handling chat message:', error);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToNoteEvents(roomId, callback) {
  // Subscribe to new note events in real-time
  const channel = supabase
    .channel(`notes:${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'note_events',
        filter: `room_id=eq.${roomId}`
      },
      (payload) => {
        try {
          const event = payload.new;
          // Transform to match expected format
          const transformedEvent = {
            id: event.id,
            userId: event.user_id,
            instrument: event.instrument,
            note: event.note,
            velocity: event.velocity,
            type: event.type,
            timestamp: new Date(event.created_at).getTime(),
            createdAt: event.created_at
          };
          callback(transformedEvent);
        } catch (error) {
          console.error('Error handling note event:', error);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
