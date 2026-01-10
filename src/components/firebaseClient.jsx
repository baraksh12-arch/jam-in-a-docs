import { supabase } from '@/api/supabaseClient';
import { validateRoomCode, validateDisplayName, validateChatMessage, sanitizeText } from '@/lib/validation';
import { chatMessageLimiter, roomOperationLimiter } from '@/lib/rateLimiter';
import { info, error as logError, warn, userAction } from '@/lib/logger';

/**
 * Room Operations
 * Fixed: Returns room object with id field for consistent navigation
 */
export async function createRoom(roomId) {
  // Rate limiting
  if (!roomOperationLimiter.isAllowed()) {
    const waitTime = roomOperationLimiter.getTimeUntilNext();
    throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
  }

  // Validate room code
  const validation = validateRoomCode(roomId);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid room ID');
  }
  const validatedRoomId = validation.value;

  try {
    info('[createRoom] Creating room', { roomId: validatedRoomId });
    
    const { data, error } = await supabase
      .from('rooms')
      .insert({
        id: validatedRoomId,
        bpm: 120,
        key: 'C',
        scale: 'major',
        is_playing: false,
        metronome_on: false
      })
      .select()
      .single();

    if (error) {
      logError('[createRoom] Error inserting room', { roomId: validatedRoomId, error: error.message });
      throw error;
    }

    if (!data || !data.id) {
      logError('[createRoom] Room created but no data returned', { roomId: validatedRoomId });
      throw new Error('Room created but no data returned');
    }

    info('[createRoom] Successfully created room', { roomId: data.id });
    userAction('room_created', { roomId: data.id });
    
    // Return the room data directly for easier access to .id
    return data;
  } catch (error) {
    logError('[createRoom] Failed to create room', { roomId: validatedRoomId, error: error.message });
    throw new Error(error.message || 'Failed to create room');
  }
}

export async function getRoom(roomId) {
  if (!roomId) {
    warn('[getRoom] No roomId provided');
    return null;
  }

  // Validate room code format before querying
  const validation = validateRoomCode(roomId);
  if (!validation.valid) {
    warn('[getRoom] Invalid room code format', { roomId });
    return null;
  }
  const validatedRoomId = validation.value;

  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', validatedRoomId)
      .maybeSingle(); // Use maybeSingle() instead of single() for cleaner null handling

    if (error) {
      logError('[getRoom] Error fetching room', { roomId: validatedRoomId, error: error.message });
      throw error;
    }

    if (!data) {
      warn('[getRoom] No room found', { roomId: validatedRoomId });
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
    logError('[getRoom] Error getting room', { roomId: validatedRoomId, error: error.message });
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
      .eq('id', roomId.toUpperCase()) // Ensure case-insensitive match
      .select()
      .maybeSingle(); // Use maybeSingle() to handle 0 rows gracefully

    if (error) throw error;
    
    if (!updatedRoom) {
      console.warn('[updateRoom] Room not found:', roomId);
      return { data: null };
    }
    
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
  // Rate limiting
  if (!roomOperationLimiter.isAllowed()) {
    const waitTime = roomOperationLimiter.getTimeUntilNext();
    throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
  }

  // Validate inputs
  if (!roomId || !userId) {
    throw new Error('Room ID and User ID are required');
  }

  const roomValidation = validateRoomCode(roomId);
  if (!roomValidation.valid) {
    throw new Error(roomValidation.error || 'Invalid room code');
  }
  const validatedRoomId = roomValidation.value;

  const nameValidation = validateDisplayName(displayName);
  if (!nameValidation.valid) {
    throw new Error(nameValidation.error || 'Invalid display name');
  }
  const sanitizedDisplayName = nameValidation.sanitized || displayName;

  if (!color || !/^#[0-9A-F]{6}$/i.test(color)) {
    throw new Error('Valid color hex code is required');
  }

  try {
    // First, ensure room exists
    const room = await getRoom(validatedRoomId);
    if (!room) {
      await createRoom(validatedRoomId);
    }

    // Check if player already exists (use maybeSingle to handle no rows gracefully)
    const { data: existingPlayer, error: queryError } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', validatedRoomId)
      .eq('user_id', userId)
      .maybeSingle();

    // Handle real errors (not just "no rows found")
    if (queryError && queryError.code !== 'PGRST116') {
      console.error('Error querying for existing player:', queryError);
      throw queryError;
    }

    if (existingPlayer) {
      // Player row found - update it
      console.log(`[joinRoomAsPlayer] Player row found for user ${userId} in room ${validatedRoomId}`);
      
      const { data, error } = await supabase
        .from('players')
        .update({
          display_name: sanitizedDisplayName,
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
    console.log(`[joinRoomAsPlayer] Creating new player row for user ${userId} in room ${validatedRoomId}`);
    
    const { data, error } = await supabase
      .from('players')
      .insert({
        room_id: validatedRoomId,
        user_id: userId,
        display_name: sanitizedDisplayName,
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
    
    info('[joinRoomAsPlayer] Successfully created player row', { userId, roomId: validatedRoomId });
    userAction('player_joined', { userId, roomId: validatedRoomId });
    return { data };
  } catch (error) {
    logError('[joinRoomAsPlayer] Error joining room as player', { userId, roomId: validatedRoomId, error: error.message });
    throw new Error(error.message || 'Failed to join room');
  }
}

export async function claimInstrument(roomId, userId, instrument) {
  // Rate limiting
  if (!roomOperationLimiter.isAllowed()) {
    const waitTime = roomOperationLimiter.getTimeUntilNext();
    throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
  }

  // Validate inputs
  if (!roomId || !userId || !instrument) {
    throw new Error('Room ID, User ID, and Instrument are required');
  }

  const roomValidation = validateRoomCode(roomId);
  if (!roomValidation.valid) {
    throw new Error(roomValidation.error || 'Invalid room code');
  }
  const validatedRoomId = roomValidation.value;

  if (!['DRUMS', 'BASS', 'EP', 'GUITAR'].includes(instrument)) {
    throw new Error('Invalid instrument');
  }

  info('[claimInstrument] Claiming instrument', { userId, roomId: validatedRoomId, instrument });
  
  try {
    // First, check if player exists and get current instrument
    const { data: existingPlayer, error: checkError } = await supabase
      .from('players')
      .select('id, instrument')
      .eq('room_id', validatedRoomId)
      .eq('user_id', userId)
      .single();

    if (checkError || !existingPlayer) {
      logError('[claimInstrument] Player not found', { userId, roomId: validatedRoomId, instrument, error: checkError?.message });
      throw new Error('You must join the room as a player before claiming an instrument. Please refresh the page.');
    }

    // Check if user already has a different instrument
    if (existingPlayer.instrument && existingPlayer.instrument !== instrument) {
      logError('[claimInstrument] User already has instrument', { userId, roomId: validatedRoomId, currentInstrument: existingPlayer.instrument, requestedInstrument: instrument });
      throw new Error(`You already have ${existingPlayer.instrument}. Release it first to claim a different instrument.`);
    }

    // Check if instrument is already claimed by another player
    const { data: instrumentOwner, error: ownerError } = await supabase
      .from('players')
      .select('user_id, instrument')
      .eq('room_id', validatedRoomId)
      .eq('instrument', instrument)
      .single();

    if (ownerError && ownerError.code !== 'PGRST116') { // PGRST116 = no rows returned
      logError('[claimInstrument] Error checking instrument owner', { userId, roomId: validatedRoomId, instrument, error: ownerError?.message });
    }

    if (instrumentOwner && instrumentOwner.user_id !== userId) {
      logError('[claimInstrument] Instrument already claimed', { userId, roomId: validatedRoomId, instrument, owner: instrumentOwner.user_id });
      throw new Error('This instrument is already claimed by another player.');
    }

    // Now update the instrument
    const { data, error } = await supabase
      .from('players')
      .update({
        instrument: instrument,
        updated_at: new Date().toISOString()
      })
      .eq('room_id', validatedRoomId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      logError('[claimInstrument] Error claiming instrument', { userId, roomId: validatedRoomId, instrument, error: error.message });
      throw error;
    }

    if (!data) {
      logError('[claimInstrument] No data returned after update', { userId, roomId: validatedRoomId, instrument });
      throw new Error('Failed to claim instrument: no data returned');
    }
    
    info('[claimInstrument] Successfully claimed instrument', { userId, roomId: validatedRoomId, instrument });
    userAction('instrument_claimed', { userId, roomId: validatedRoomId, instrument });
    
    // Note: Supabase Realtime subscription will automatically update useRoomState
    // No need to manually refresh - the subscription in subscribeToPlayers will fire
    return { data };
  } catch (error) {
    logError('[claimInstrument] Error claiming instrument', { userId, roomId: validatedRoomId, instrument, error: error.message });
    throw new Error(error.message || 'Failed to claim instrument');
  }
}

export async function releaseInstrument(roomId, userId) {
  try {
    // Normalize room ID to uppercase
    const normalizedRoomId = roomId?.toUpperCase();
    
    const { data, error } = await supabase
      .from('players')
      .update({
        instrument: null,
        updated_at: new Date().toISOString()
      })
      .eq('room_id', normalizedRoomId)
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
    // Normalize room ID to uppercase to match how it's stored
    const normalizedRoomId = roomId?.toUpperCase();
    
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', normalizedRoomId)
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
  // Rate limiting
  if (!chatMessageLimiter.isAllowed()) {
    const waitTime = chatMessageLimiter.getTimeUntilNext();
    throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds before sending another message.`);
  }

  // Validate inputs
  if (!roomId || !userId) {
    throw new Error('Room ID and User ID are required');
  }

  const roomValidation = validateRoomCode(roomId);
  if (!roomValidation.valid) {
    throw new Error(roomValidation.error || 'Invalid room code');
  }
  const validatedRoomId = roomValidation.value;

  const nameValidation = validateDisplayName(displayName);
  if (!nameValidation.valid) {
    throw new Error(nameValidation.error || 'Invalid display name');
  }
  const sanitizedDisplayName = nameValidation.sanitized || displayName;

  const messageValidation = validateChatMessage(text);
  if (!messageValidation.valid) {
    throw new Error(messageValidation.error || 'Invalid message');
  }
  const sanitizedText = messageValidation.sanitized || text;

  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        room_id: validatedRoomId,
        user_id: userId,
        display_name: sanitizedDisplayName,
        text: sanitizedText // XSS-protected text
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

  let lastRoomHash = '';
  let isSubscribed = false;

  // Function to fetch room and update if changed
  const fetchAndUpdate = async (force = false) => {
    try {
      const room = await getRoom(roomId);
      if (room) {
        const newHash = JSON.stringify({
          bpm: room.bpm,
          key: room.key,
          scale: room.scale,
          isPlaying: room.isPlaying,
          metronomeOn: room.metronomeOn
        });
        
        if (force || newHash !== lastRoomHash) {
          lastRoomHash = newHash;
          console.log(`[subscribeToRoom] Room state updated:`, room.bpm, room.key, room.scale, room.isPlaying ? 'PLAYING' : 'STOPPED');
          callback(room);
        }
      } else {
        callback(null);
      }
    } catch (error) {
      console.error('[subscribeToRoom] Error fetching room:', error);
    }
  };

  // Initial fetch with retry logic to handle race conditions
  const fetchWithRetry = async (retries = 5, delay = 300) => {
    for (let i = 0; i < retries; i++) {
      try {
        const room = await getRoom(roomId);
        if (room) {
          lastRoomHash = JSON.stringify({
            bpm: room.bpm,
            key: room.key,
            scale: room.scale,
            isPlaying: room.isPlaying,
            metronomeOn: room.metronomeOn
          });
          callback(room);
          return;
        }
        if (i < retries - 1) {
          console.log(`[subscribeToRoom] Room not found, retrying... (${i + 1}/${retries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.error('[subscribeToRoom] Error fetching room:', error);
        if (i === retries - 1) {
          callback(null);
        } else {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    callback(null);
  };

  fetchWithRetry();

  // Subscribe to changes with improved reliability
  const channelName = `room-realtime-${roomId}-${Date.now()}`;
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${roomId}`
      },
      async (payload) => {
        console.log(`[subscribeToRoom] Realtime UPDATE:`, payload.new);
        await fetchAndUpdate(true);
      }
    )
    .subscribe((status, error) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[subscribeToRoom] ✅ Realtime subscription active for room ${roomId}`);
        isSubscribed = true;
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`[subscribeToRoom] ❌ Realtime channel error:`, error);
        isSubscribed = false;
      } else {
        console.log(`[subscribeToRoom] Subscription status: ${status}`);
      }
    });

  // Polling fallback - more frequent when realtime not connected
  const pollInterval = setInterval(() => {
    if (!isSubscribed) {
      console.log('[subscribeToRoom] Polling fallback active');
    }
    fetchAndUpdate();
  }, isSubscribed ? 5000 : 2000);

  return () => {
    console.log(`[subscribeToRoom] Unsubscribing from room ${roomId}`);
    clearInterval(pollInterval);
    supabase.removeChannel(channel);
  };
}

export function subscribeToPlayers(roomId, callback) {
  if (!roomId) {
    console.warn('[subscribeToPlayers] No roomId provided');
    return () => {}; // Return no-op unsubscribe function
  }

  console.log(`[subscribeToPlayers] Setting up subscription for room ${roomId}`);
  
  // Track last known state for comparison
  let lastPlayersHash = '';
  let isSubscribed = false;
  let retryCount = 0;
  const maxRetries = 3;
  
  // Function to fetch and update players
  const fetchAndUpdate = async (force = false) => {
    try {
      const players = await getPlayers(roomId);
      // Create a hash of the players state to detect actual changes
      const newHash = JSON.stringify(players.map(p => ({ 
        id: p.id, 
        instrument: p.instrument,
        displayName: p.displayName || p.display_name 
      })));
      
      if (force || newHash !== lastPlayersHash) {
        lastPlayersHash = newHash;
        console.log(`[subscribeToPlayers] Players updated:`, players.length, 'players', 
          players.map(p => `${p.display_name || p.displayName}: ${p.instrument || 'none'}`).join(', '));
        callback(players);
      }
    } catch (error) {
      console.error('[subscribeToPlayers] Error fetching players:', error);
      // Retry logic
      if (retryCount < maxRetries) {
        retryCount++;
        setTimeout(() => fetchAndUpdate(true), 1000 * retryCount);
      }
    }
  };

  // Initial fetch - force update
  fetchAndUpdate(true);

  // Subscribe to changes via Supabase Realtime with improved error handling
  const channelName = `players-realtime-${roomId}-${Date.now()}`;
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'players',
        filter: `room_id=eq.${roomId}`
      },
      async (payload) => {
        console.log(`[subscribeToPlayers] Realtime INSERT:`, payload.new);
        await fetchAndUpdate(true); // Force update on INSERT
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'players',
        filter: `room_id=eq.${roomId}`
      },
      async (payload) => {
        console.log(`[subscribeToPlayers] Realtime UPDATE:`, payload.new);
        await fetchAndUpdate(true); // Force update on UPDATE
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'players',
        filter: `room_id=eq.${roomId}`
      },
      async (payload) => {
        console.log(`[subscribeToPlayers] Realtime DELETE:`, payload.old);
        await fetchAndUpdate(true); // Force update on DELETE
      }
    )
    .subscribe((status, error) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[subscribeToPlayers] ✅ Realtime subscription active for room ${roomId}`);
        isSubscribed = true;
        retryCount = 0;
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`[subscribeToPlayers] ❌ Realtime channel error:`, error);
        isSubscribed = false;
      } else if (status === 'TIMED_OUT') {
        console.warn(`[subscribeToPlayers] ⏰ Realtime channel timed out, will retry`);
        isSubscribed = false;
      } else {
        console.log(`[subscribeToPlayers] Subscription status: ${status}`);
      }
    });

  // More aggressive polling when not subscribed - every 1.5 seconds
  // When subscribed, poll every 5 seconds as a backup
  const pollInterval = setInterval(() => {
    const pollDelay = isSubscribed ? 5000 : 1500;
    if (!isSubscribed) {
      console.log('[subscribeToPlayers] Polling fallback active (realtime not connected)');
    }
    fetchAndUpdate();
  }, 1500);

  return () => {
    console.log(`[subscribeToPlayers] Unsubscribing from players for room ${roomId}`);
    clearInterval(pollInterval);
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

/**
 * Crowd Member Operations
 * Crowd members can view/listen but only broadcast their camera (no audio, no instrument control)
 */
export async function joinRoomAsCrowd(roomId, userId, displayName, color) {
  // Rate limiting
  if (!roomOperationLimiter.isAllowed()) {
    const waitTime = roomOperationLimiter.getTimeUntilNext();
    throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
  }

  // Validate inputs
  if (!roomId || !userId) {
    throw new Error('Room ID and User ID are required');
  }

  const roomValidation = validateRoomCode(roomId);
  if (!roomValidation.valid) {
    throw new Error(roomValidation.error || 'Invalid room code');
  }
  const validatedRoomId = roomValidation.value;

  const nameValidation = validateDisplayName(displayName);
  if (!nameValidation.valid) {
    throw new Error(nameValidation.error || 'Invalid display name');
  }
  const sanitizedDisplayName = nameValidation.sanitized || displayName;

  if (!color || !/^#[0-9A-F]{6}$/i.test(color)) {
    throw new Error('Valid color hex code is required');
  }

  try {
    // First, ensure room exists
    const room = await getRoom(validatedRoomId);
    if (!room) {
      throw new Error('Room does not exist. Cannot join as crowd.');
    }

    // Check if already in players table
    const { data: existingPlayer, error: queryError } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', validatedRoomId)
      .eq('user_id', userId)
      .maybeSingle();

    if (queryError && queryError.code !== 'PGRST116') {
      console.error('Error querying for existing player:', queryError);
      throw queryError;
    }

    if (existingPlayer) {
      // Update existing record to be crowd member
      const { data, error } = await supabase
        .from('players')
        .update({
          display_name: sanitizedDisplayName,
          color: color,
          is_player: false, // Mark as crowd member (not a player)
          instrument: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingPlayer.id)
        .select()
        .single();

      if (error) throw error;
      info('[joinRoomAsCrowd] Updated existing player to crowd', { userId, roomId: validatedRoomId });
      userAction('crowd_joined', { userId, roomId: validatedRoomId });
      return { data };
    }

    // Create new crowd member
    const { data, error } = await supabase
      .from('players')
      .insert({
        room_id: validatedRoomId,
        user_id: userId,
        display_name: sanitizedDisplayName,
        color: color,
        is_player: false, // Not a player (crowd member)
        instrument: null
      })
      .select()
      .single();

    if (error) throw error;
    info('[joinRoomAsCrowd] Successfully created crowd member', { userId, roomId: validatedRoomId });
    userAction('crowd_joined', { userId, roomId: validatedRoomId });
    return { data };
  } catch (error) {
    logError('[joinRoomAsCrowd] Error joining as crowd', { userId, roomId: validatedRoomId, error: error.message });
    throw new Error(error.message || 'Failed to join as crowd');
  }
}

export async function getCrowdMembers(roomId) {
  try {
    // Normalize room ID to uppercase
    const normalizedRoomId = roomId?.toUpperCase();
    
    // Query for crowd members (is_player = false)
    // Note: is_crowd column doesn't exist in schema, so we use is_player = false
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', normalizedRoomId)
      .eq('is_player', false)
      .order('joined_at', { ascending: true });

    if (error) throw error;

    // Transform to match expected format
    return (data || []).map(member => ({
      id: member.user_id || member.id,
      userId: member.user_id,
      displayName: member.display_name,
      color: member.color,
      isCrowd: true,
      joinedAt: member.joined_at
    }));
  } catch (error) {
    console.error('Error getting crowd members:', error);
    throw new Error(error.message || 'Failed to get crowd members');
  }
}

export function subscribeToCrowdMembers(roomId, callback) {
  if (!roomId) {
    console.warn('[subscribeToCrowdMembers] No roomId provided');
    return () => {};
  }

  // Initial fetch
  getCrowdMembers(roomId)
    .then(members => {
      callback(members);
    })
    .catch(error => {
      console.error('[subscribeToCrowdMembers] Error in initial fetch:', error);
      callback([]);
    });

  // Subscribe to changes
  const channel = supabase
    .channel(`crowd:${roomId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'players',
        filter: `room_id=eq.${roomId}`
      },
      async (payload) => {
        try {
          // Refetch all crowd members to get the latest state
          const members = await getCrowdMembers(roomId);
          callback(members);
        } catch (error) {
          console.error('[subscribeToCrowdMembers] Error handling crowd update:', error);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function leaveCrowd(roomId, userId) {
  try {
    // Normalize room ID to uppercase
    const normalizedRoomId = roomId?.toUpperCase();
    
    const { error } = await supabase
      .from('players')
      .delete()
      .eq('room_id', normalizedRoomId)
      .eq('user_id', userId)
      .eq('is_player', false); // Crowd members have is_player = false

    if (error) throw error;
    info('[leaveCrowd] Crowd member left', { userId, roomId: normalizedRoomId });
    return { success: true };
  } catch (error) {
    console.error('Error leaving crowd:', error);
    throw new Error(error.message || 'Failed to leave crowd');
  }
}
