/**
 * Chat Routes - REST API for chat messages
 */

import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../services/logger.js';

const router = Router();

// Validation schemas
const sendMessageSchema = z.object({
  roomCode: z.string().min(4).max(8),
  userId: z.string().min(1).max(100),
  content: z.string().min(1).max(500),
  type: z.enum(['TEXT', 'SYSTEM', 'EMOJI']).default('TEXT'),
});

/**
 * GET /api/chat/:roomCode
 * Get recent chat messages for a room
 */
router.get('/:roomCode', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const before = req.query.before;
    
    const room = await req.prisma.room.findUnique({
      where: { code: roomCode.toUpperCase() },
    });
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    const messages = await req.prisma.chatMessage.findMany({
      where: {
        roomId: room.id,
        ...(before && { createdAt: { lt: new Date(before) } }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        content: true,
        type: true,
        authorName: true,
        authorColor: true,
        createdAt: true,
        player: {
          select: { userId: true },
        },
        crowdMember: {
          select: { userId: true },
        },
      },
    });
    
    // Reverse to get chronological order
    res.json(messages.reverse().map(m => ({
      id: m.id,
      content: m.content,
      type: m.type,
      authorName: m.authorName,
      authorColor: m.authorColor,
      createdAt: m.createdAt,
      isPlayer: !!m.player,
      userId: m.player?.userId || m.crowdMember?.userId,
    })));
  } catch (error) {
    logger.error('Error fetching chat messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/chat
 * Send a chat message (fallback for non-WebSocket clients)
 */
router.post('/', async (req, res) => {
  try {
    const data = sendMessageSchema.parse(req.body);
    
    const room = await req.prisma.room.findUnique({
      where: { code: data.roomCode.toUpperCase() },
    });
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    // Find author (player or crowd member)
    let author = await req.prisma.player.findFirst({
      where: { roomId: room.id, userId: data.userId },
    });
    
    let playerId = author?.id;
    let crowdMemberId = null;
    
    if (!author) {
      author = await req.prisma.crowdMember.findFirst({
        where: { roomId: room.id, userId: data.userId },
      });
      crowdMemberId = author?.id;
    }
    
    if (!author) {
      return res.status(403).json({ error: 'User not in room' });
    }
    
    // Create message
    const message = await req.prisma.chatMessage.create({
      data: {
        roomId: room.id,
        playerId,
        crowdMemberId,
        content: data.content.trim(),
        type: data.type,
        authorName: author.displayName,
        authorColor: author.color,
      },
    });
    
    res.status(201).json({
      id: message.id,
      content: message.content,
      type: message.type,
      authorName: message.authorName,
      authorColor: message.authorColor,
      createdAt: message.createdAt,
      isPlayer: !!playerId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    logger.error('Error sending chat message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
