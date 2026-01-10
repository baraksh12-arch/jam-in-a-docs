/**
 * WebSocket Handler - Real-time communication for Jam in a Docs
 * Handles room sync, note events, chat, and presence
 */

import { logger } from '../services/logger.js';

/**
 * Setup WebSocket event handlers
 */
export function setupWebSocket(io, prisma) {
  // Namespace for jam rooms
  const roomsNamespace = io.of('/rooms');
  
  roomsNamespace.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);
    
    let currentRoom = null;
    let currentUserId = null;
    let isPlayer = false;
    
    // ========================================================================
    // ROOM MANAGEMENT
    // ========================================================================
    
    /**
     * Join a room
     */
    socket.on('room:join', async ({ roomCode, userId, displayName, color, asCrowd = false }) => {
      try {
        currentRoom = roomCode.toUpperCase();
        currentUserId = userId;
        isPlayer = !asCrowd;
        
        // Join socket room
        socket.join(currentRoom);
        
        // Get or create room
        let room = await prisma.room.findUnique({
          where: { code: currentRoom },
          include: { 
            players: true, 
            crowdMembers: true 
          },
        });
        
        if (!room) {
          // Create new room
          room = await prisma.room.create({
            data: {
              code: currentRoom,
              name: `Room ${currentRoom}`,
            },
            include: { 
              players: true, 
              crowdMembers: true 
            },
          });
        }
        
        // Add player or crowd member
        if (asCrowd) {
          await prisma.crowdMember.upsert({
            where: { roomId_userId: { roomId: room.id, userId } },
            update: { 
              isConnected: true, 
              lastPing: new Date(),
              displayName,
              color,
            },
            create: {
              roomId: room.id,
              userId,
              displayName,
              color,
            },
          });
        } else {
          await prisma.player.upsert({
            where: { roomId_userId: { roomId: room.id, userId } },
            update: { 
              isConnected: true, 
              lastPing: new Date(),
              displayName,
              color,
              peerId: socket.id,
            },
            create: {
              roomId: room.id,
              userId,
              displayName,
              color,
              peerId: socket.id,
            },
          });
        }
        
        // Update room activity
        await prisma.room.update({
          where: { id: room.id },
          data: { lastActivity: new Date() },
        });
        
        // Fetch updated room state
        const updatedRoom = await prisma.room.findUnique({
          where: { code: currentRoom },
          include: { 
            players: { where: { isConnected: true } },
            crowdMembers: { where: { isConnected: true } },
          },
        });
        
        // Send room state to joining client
        socket.emit('room:state', {
          room: {
            code: updatedRoom.code,
            bpm: updatedRoom.bpm,
            musicalKey: updatedRoom.musicalKey,
            scale: updatedRoom.scale,
            isPlaying: updatedRoom.isPlaying,
            metronomeOn: updatedRoom.metronomeOn,
            startTime: updatedRoom.startTime,
          },
          players: updatedRoom.players.map(p => ({
            id: p.id,
            oderId: p.userId,
            userId: p.userId, // Include proper userId field
            displayName: p.displayName,
            color: p.color,
            instrument: p.instrument,
            isConnected: p.isConnected,
          })),
          crowdMembers: updatedRoom.crowdMembers.map(c => ({
            id: c.id,
            userId: c.userId,
            displayName: c.displayName,
            color: c.color,
            isBroadcasting: c.isBroadcasting,
          })),
        });
        
        // Broadcast join to room
        socket.to(currentRoom).emit('room:user_joined', {
          userId,
          displayName,
          color,
          isCrowd: asCrowd,
        });
        
        logger.info(`User ${displayName} (${userId}) joined room ${currentRoom} as ${asCrowd ? 'crowd' : 'player'}`);
      } catch (error) {
        logger.error('Error joining room:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });
    
    /**
     * Leave a room
     */
    socket.on('room:leave', async () => {
      if (!currentRoom || !currentUserId) return;
      
      try {
        const room = await prisma.room.findUnique({
          where: { code: currentRoom },
        });
        
        if (room) {
          if (isPlayer) {
            // Release instrument and mark as disconnected
            await prisma.player.updateMany({
              where: { roomId: room.id, userId: currentUserId },
              data: { isConnected: false, instrument: null },
            });
          } else {
            await prisma.crowdMember.updateMany({
              where: { roomId: room.id, userId: currentUserId },
              data: { isConnected: false },
            });
          }
        }
        
        socket.to(currentRoom).emit('room:user_left', { userId: currentUserId });
        socket.leave(currentRoom);
        
        logger.info(`User ${currentUserId} left room ${currentRoom}`);
      } catch (error) {
        logger.error('Error leaving room:', error);
      }
    });
    
    // ========================================================================
    // ROOM CONTROLS (BPM, KEY, SCALE, PLAY/STOP)
    // ========================================================================
    
    /**
     * Update BPM
     */
    socket.on('room:bpm', async ({ bpm }) => {
      if (!currentRoom) return;
      
      try {
        const room = await prisma.room.update({
          where: { code: currentRoom },
          data: { bpm: Math.max(40, Math.min(240, bpm)) },
        });
        
        // Broadcast to all in room including sender for immediate feedback
        roomsNamespace.to(currentRoom).emit('room:bpm_changed', { bpm: room.bpm });
        
        logger.debug(`Room ${currentRoom} BPM changed to ${bpm}`);
      } catch (error) {
        logger.error('Error updating BPM:', error);
      }
    });
    
    /**
     * Update musical key
     */
    socket.on('room:key', async ({ key }) => {
      if (!currentRoom) return;
      
      try {
        const room = await prisma.room.update({
          where: { code: currentRoom },
          data: { musicalKey: key },
        });
        
        roomsNamespace.to(currentRoom).emit('room:key_changed', { key: room.musicalKey });
        
        logger.debug(`Room ${currentRoom} key changed to ${key}`);
      } catch (error) {
        logger.error('Error updating key:', error);
      }
    });
    
    /**
     * Update scale
     */
    socket.on('room:scale', async ({ scale }) => {
      if (!currentRoom) return;
      
      try {
        const room = await prisma.room.update({
          where: { code: currentRoom },
          data: { scale },
        });
        
        roomsNamespace.to(currentRoom).emit('room:scale_changed', { scale: room.scale });
        
        logger.debug(`Room ${currentRoom} scale changed to ${scale}`);
      } catch (error) {
        logger.error('Error updating scale:', error);
      }
    });
    
    /**
     * Toggle play/stop
     */
    socket.on('room:play', async ({ isPlaying }) => {
      if (!currentRoom) return;
      
      try {
        const room = await prisma.room.update({
          where: { code: currentRoom },
          data: { 
            isPlaying,
            startTime: isPlaying ? new Date() : null,
          },
        });
        
        roomsNamespace.to(currentRoom).emit('room:play_changed', { 
          isPlaying: room.isPlaying,
          startTime: room.startTime,
        });
        
        logger.debug(`Room ${currentRoom} play state: ${isPlaying}`);
      } catch (error) {
        logger.error('Error updating play state:', error);
      }
    });
    
    /**
     * Toggle metronome
     */
    socket.on('room:metronome', async ({ metronomeOn }) => {
      if (!currentRoom) return;
      
      try {
        const room = await prisma.room.update({
          where: { code: currentRoom },
          data: { metronomeOn },
        });
        
        roomsNamespace.to(currentRoom).emit('room:metronome_changed', { 
          metronomeOn: room.metronomeOn,
        });
        
        logger.debug(`Room ${currentRoom} metronome: ${metronomeOn}`);
      } catch (error) {
        logger.error('Error updating metronome:', error);
      }
    });
    
    // ========================================================================
    // INSTRUMENT CLAIMS
    // ========================================================================
    
    /**
     * Claim an instrument
     */
    socket.on('instrument:claim', async ({ instrument }) => {
      if (!currentRoom || !currentUserId || !isPlayer) return;
      
      try {
        const room = await prisma.room.findUnique({
          where: { code: currentRoom },
        });
        
        if (!room) return;
        
        // Check if instrument is available
        const existingClaim = await prisma.player.findFirst({
          where: { 
            roomId: room.id, 
            instrument,
            isConnected: true,
          },
        });
        
        if (existingClaim && existingClaim.userId !== currentUserId) {
          socket.emit('instrument:claim_failed', { 
            instrument, 
            reason: 'Instrument already claimed',
          });
          return;
        }
        
        // Release any existing instrument for this user
        await prisma.player.updateMany({
          where: { roomId: room.id, userId: currentUserId },
          data: { instrument: null },
        });
        
        // Claim new instrument
        const player = await prisma.player.update({
          where: { roomId_userId: { roomId: room.id, userId: currentUserId } },
          data: { instrument },
        });
        
        // Broadcast to room
        roomsNamespace.to(currentRoom).emit('instrument:claimed', {
          instrument,
          player: {
            userId: player.userId,
            displayName: player.displayName,
            color: player.color,
          },
        });
        
        logger.info(`User ${currentUserId} claimed ${instrument} in room ${currentRoom}`);
      } catch (error) {
        logger.error('Error claiming instrument:', error);
        socket.emit('instrument:claim_failed', { instrument, reason: 'Server error' });
      }
    });
    
    /**
     * Release an instrument
     */
    socket.on('instrument:release', async () => {
      if (!currentRoom || !currentUserId || !isPlayer) return;
      
      try {
        const room = await prisma.room.findUnique({
          where: { code: currentRoom },
        });
        
        if (!room) return;
        
        const player = await prisma.player.findUnique({
          where: { roomId_userId: { roomId: room.id, userId: currentUserId } },
        });
        
        if (player?.instrument) {
          await prisma.player.update({
            where: { id: player.id },
            data: { instrument: null },
          });
          
          roomsNamespace.to(currentRoom).emit('instrument:released', {
            instrument: player.instrument,
            userId: currentUserId,
          });
          
          logger.info(`User ${currentUserId} released ${player.instrument} in room ${currentRoom}`);
        }
      } catch (error) {
        logger.error('Error releasing instrument:', error);
      }
    });
    
    // ========================================================================
    // NOTE EVENTS (Real-time audio sync)
    // ========================================================================
    
    /**
     * Send note event
     */
    socket.on('note', async ({ instrument, note, velocity, eventType, scheduledAt }) => {
      if (!currentRoom || !currentUserId) return;
      
      // Broadcast immediately for low latency
      socket.to(currentRoom).emit('note', {
        userId: currentUserId,
        instrument,
        note,
        velocity,
        eventType,
        scheduledAt,
        timestamp: Date.now(),
      });
      
      // Optionally store note events for replay (can be toggled)
      if (process.env.STORE_NOTE_EVENTS === 'true') {
        try {
          const room = await prisma.room.findUnique({ where: { code: currentRoom } });
          const player = await prisma.player.findFirst({ 
            where: { roomId: room?.id, userId: currentUserId } 
          });
          
          if (room && player) {
            await prisma.noteEvent.create({
              data: {
                roomId: room.id,
                playerId: player.id,
                instrument,
                note: String(note),
                velocity: velocity || 100,
                eventType: eventType || 'NOTE_ON',
                scheduledAt: scheduledAt ? BigInt(scheduledAt) : null,
              },
            });
          }
        } catch (error) {
          // Non-critical, just log
          logger.debug('Error storing note event:', error);
        }
      }
    });
    
    // ========================================================================
    // CHAT
    // ========================================================================
    
    /**
     * Send chat message
     */
    socket.on('chat:message', async ({ content, type = 'TEXT' }) => {
      if (!currentRoom || !currentUserId || !content?.trim()) return;
      
      try {
        const room = await prisma.room.findUnique({ where: { code: currentRoom } });
        if (!room) return;
        
        // Find user (player or crowd)
        let author = null;
        let playerId = null;
        let crowdMemberId = null;
        
        if (isPlayer) {
          author = await prisma.player.findFirst({ 
            where: { roomId: room.id, userId: currentUserId } 
          });
          playerId = author?.id;
        } else {
          author = await prisma.crowdMember.findFirst({ 
            where: { roomId: room.id, userId: currentUserId } 
          });
          crowdMemberId = author?.id;
        }
        
        if (!author) return;
        
        // Sanitize content
        const sanitizedContent = content.trim().slice(0, 500);
        
        // Create message
        const message = await prisma.chatMessage.create({
          data: {
            roomId: room.id,
            playerId,
            crowdMemberId,
            content: sanitizedContent,
            type,
            authorName: author.displayName,
            authorColor: author.color,
          },
        });
        
        // Broadcast to room
        roomsNamespace.to(currentRoom).emit('chat:message', {
          id: message.id,
          content: message.content,
          type: message.type,
          authorName: message.authorName,
          authorColor: message.authorColor,
          createdAt: message.createdAt,
          isPlayer,
        });
        
      } catch (error) {
        logger.error('Error sending chat message:', error);
      }
    });
    
    // ========================================================================
    // WEBRTC SIGNALING
    // ========================================================================
    
    socket.on('webrtc:offer', ({ to, offer }) => {
      socket.to(currentRoom).emit('webrtc:offer', { from: socket.id, offer });
    });
    
    socket.on('webrtc:answer', ({ to, answer }) => {
      socket.to(currentRoom).emit('webrtc:answer', { from: socket.id, answer });
    });
    
    socket.on('webrtc:ice-candidate', ({ to, candidate }) => {
      socket.to(currentRoom).emit('webrtc:ice-candidate', { from: socket.id, candidate });
    });
    
    // ========================================================================
    // PRESENCE / HEARTBEAT
    // ========================================================================
    
    socket.on('ping', async () => {
      if (!currentRoom || !currentUserId) return;
      
      try {
        const room = await prisma.room.findUnique({ where: { code: currentRoom } });
        if (!room) return;
        
        if (isPlayer) {
          await prisma.player.updateMany({
            where: { roomId: room.id, userId: currentUserId },
            data: { lastPing: new Date() },
          });
        } else {
          await prisma.crowdMember.updateMany({
            where: { roomId: room.id, userId: currentUserId },
            data: { lastPing: new Date() },
          });
        }
        
        socket.emit('pong', { serverTime: Date.now() });
      } catch (error) {
        // Non-critical
      }
    });
    
    // ========================================================================
    // DISCONNECT
    // ========================================================================
    
    socket.on('disconnect', async () => {
      if (currentRoom && currentUserId) {
        try {
          const room = await prisma.room.findUnique({ where: { code: currentRoom } });
          if (room) {
            if (isPlayer) {
              await prisma.player.updateMany({
                where: { roomId: room.id, userId: currentUserId },
                data: { isConnected: false },
              });
            } else {
              await prisma.crowdMember.updateMany({
                where: { roomId: room.id, userId: currentUserId },
                data: { isConnected: false },
              });
            }
            
            socket.to(currentRoom).emit('room:user_left', { userId: currentUserId });
          }
        } catch (error) {
          logger.error('Error handling disconnect:', error);
        }
      }
      
      logger.info(`Client disconnected: ${socket.id}`);
    });
  });
  
  // Periodic cleanup of stale connections
  setInterval(async () => {
    const staleThreshold = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes
    
    try {
      await prisma.player.updateMany({
        where: { lastPing: { lt: staleThreshold }, isConnected: true },
        data: { isConnected: false, instrument: null },
      });
      
      await prisma.crowdMember.updateMany({
        where: { lastPing: { lt: staleThreshold }, isConnected: true },
        data: { isConnected: false },
      });
    } catch (error) {
      logger.error('Error in stale connection cleanup:', error);
    }
  }, 60000); // Run every minute
  
  logger.info('WebSocket handlers initialized');
}
