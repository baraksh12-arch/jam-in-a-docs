/**
 * Room Routes - REST API for room management
 */

import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../services/logger.js';

const router = Router();

// Generate random room code
const generateRoomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing chars
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Validation schemas
const createRoomSchema = z.object({
  name: z.string().max(100).optional(),
  bpm: z.number().min(40).max(240).default(120),
  musicalKey: z.string().max(3).default('C'),
  scale: z.string().max(20).default('major'),
  isPublic: z.boolean().default(false),
});

const updateRoomSchema = z.object({
  bpm: z.number().min(40).max(240).optional(),
  musicalKey: z.string().max(3).optional(),
  scale: z.string().max(20).optional(),
  isPlaying: z.boolean().optional(),
  metronomeOn: z.boolean().optional(),
});

/**
 * GET /api/rooms/:code
 * Get room by code
 */
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    const room = await req.prisma.room.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        players: {
          where: { isConnected: true },
          select: {
            id: true,
            userId: true,
            displayName: true,
            color: true,
            instrument: true,
            isConnected: true,
          },
        },
        crowdMembers: {
          where: { isConnected: true },
          select: {
            id: true,
            userId: true,
            displayName: true,
            color: true,
            isBroadcasting: true,
          },
        },
      },
    });
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    res.json(room);
  } catch (error) {
    logger.error('Error fetching room:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/rooms
 * Create a new room
 */
router.post('/', async (req, res) => {
  try {
    const data = createRoomSchema.parse(req.body);
    
    // Generate unique room code
    let code = generateRoomCode();
    let attempts = 0;
    
    while (attempts < 10) {
      const existing = await req.prisma.room.findUnique({ where: { code } });
      if (!existing) break;
      code = generateRoomCode();
      attempts++;
    }
    
    if (attempts >= 10) {
      return res.status(500).json({ error: 'Failed to generate unique room code' });
    }
    
    const room = await req.prisma.room.create({
      data: {
        code,
        name: data.name || `Room ${code}`,
        bpm: data.bpm,
        musicalKey: data.musicalKey,
        scale: data.scale,
        isPublic: data.isPublic,
      },
    });
    
    logger.info(`Created room: ${code}`);
    res.status(201).json(room);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    logger.error('Error creating room:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/rooms/:code
 * Update room settings
 */
router.patch('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const data = updateRoomSchema.parse(req.body);
    
    const room = await req.prisma.room.update({
      where: { code: code.toUpperCase() },
      data: {
        ...data,
        lastActivity: new Date(),
        ...(data.isPlaying !== undefined && {
          startTime: data.isPlaying ? new Date() : null,
        }),
      },
    });
    
    res.json(room);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Room not found' });
    }
    logger.error('Error updating room:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/rooms/:code
 * Delete a room (soft delete - mark as inactive)
 */
router.delete('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    await req.prisma.room.delete({
      where: { code: code.toUpperCase() },
    });
    
    logger.info(`Deleted room: ${code}`);
    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Room not found' });
    }
    logger.error('Error deleting room:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/rooms/:code/players
 * Get all players in a room
 */
router.get('/:code/players', async (req, res) => {
  try {
    const { code } = req.params;
    
    const room = await req.prisma.room.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        players: {
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    res.json(room.players);
  } catch (error) {
    logger.error('Error fetching players:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
