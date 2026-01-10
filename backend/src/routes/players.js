/**
 * Player Routes - REST API for player management
 */

import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../services/logger.js';

const router = Router();

// Validation schemas
const joinRoomSchema = z.object({
  roomCode: z.string().min(4).max(8),
  userId: z.string().min(1).max(100),
  displayName: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

const claimInstrumentSchema = z.object({
  instrument: z.enum(['DRUMS', 'BASS', 'EP', 'GUITAR']),
});

/**
 * POST /api/players/join
 * Join a room as a player
 */
router.post('/join', async (req, res) => {
  try {
    const data = joinRoomSchema.parse(req.body);
    
    // Find or create room
    let room = await req.prisma.room.findUnique({
      where: { code: data.roomCode.toUpperCase() },
    });
    
    if (!room) {
      // Create room if it doesn't exist
      room = await req.prisma.room.create({
        data: {
          code: data.roomCode.toUpperCase(),
          name: `Room ${data.roomCode.toUpperCase()}`,
        },
      });
    }
    
    // Check max players
    const playerCount = await req.prisma.player.count({
      where: { roomId: room.id, isConnected: true },
    });
    
    if (playerCount >= room.maxPlayers) {
      return res.status(400).json({ error: 'Room is full' });
    }
    
    // Upsert player
    const player = await req.prisma.player.upsert({
      where: {
        roomId_userId: { roomId: room.id, userId: data.userId },
      },
      update: {
        displayName: data.displayName,
        color: data.color,
        isConnected: true,
        lastPing: new Date(),
      },
      create: {
        roomId: room.id,
        userId: data.userId,
        displayName: data.displayName,
        color: data.color,
      },
    });
    
    logger.info(`Player ${data.displayName} joined room ${data.roomCode}`);
    
    res.json({
      player,
      room: {
        code: room.code,
        bpm: room.bpm,
        musicalKey: room.musicalKey,
        scale: room.scale,
        isPlaying: room.isPlaying,
        metronomeOn: room.metronomeOn,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    logger.error('Error joining room:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/players/:playerId/claim
 * Claim an instrument
 */
router.post('/:playerId/claim', async (req, res) => {
  try {
    const { playerId } = req.params;
    const data = claimInstrumentSchema.parse(req.body);
    
    const player = await req.prisma.player.findUnique({
      where: { id: playerId },
      include: { room: true },
    });
    
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    // Check if instrument is already claimed
    const existingClaim = await req.prisma.player.findFirst({
      where: {
        roomId: player.roomId,
        instrument: data.instrument,
        isConnected: true,
        NOT: { id: playerId },
      },
    });
    
    if (existingClaim) {
      return res.status(400).json({ 
        error: 'Instrument already claimed',
        claimedBy: existingClaim.displayName,
      });
    }
    
    // Release any existing instrument
    await req.prisma.player.update({
      where: { id: playerId },
      data: { instrument: null },
    });
    
    // Claim new instrument
    const updated = await req.prisma.player.update({
      where: { id: playerId },
      data: { instrument: data.instrument },
    });
    
    logger.info(`Player ${player.displayName} claimed ${data.instrument}`);
    
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    logger.error('Error claiming instrument:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/players/:playerId/release
 * Release an instrument
 */
router.post('/:playerId/release', async (req, res) => {
  try {
    const { playerId } = req.params;
    
    const player = await req.prisma.player.update({
      where: { id: playerId },
      data: { instrument: null },
    });
    
    logger.info(`Player ${player.displayName} released instrument`);
    
    res.json(player);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Player not found' });
    }
    logger.error('Error releasing instrument:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/players/:playerId/leave
 * Leave a room
 */
router.post('/:playerId/leave', async (req, res) => {
  try {
    const { playerId } = req.params;
    
    const player = await req.prisma.player.update({
      where: { id: playerId },
      data: { 
        isConnected: false,
        instrument: null,
      },
    });
    
    logger.info(`Player ${player.displayName} left room`);
    
    res.json({ success: true });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Player not found' });
    }
    logger.error('Error leaving room:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
