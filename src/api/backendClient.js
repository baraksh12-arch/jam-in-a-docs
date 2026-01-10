/**
 * Backend API Client - Connects frontend to our Prisma backend
 * Production-ready with error handling, retries, and TypeScript-like typing
 */

// Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3001';

// ============================================================================
// HTTP Client with retry logic
// ============================================================================

class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.retryCount = 3;
    this.retryDelay = 1000;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    let lastError;
    for (let attempt = 0; attempt < this.retryCount; attempt++) {
      try {
        const response = await fetch(url, config);
        
        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Request failed' }));
          throw new Error(error.error || `HTTP ${response.status}`);
        }
        
        // Handle 204 No Content
        if (response.status === 204) {
          return null;
        }
        
        return await response.json();
      } catch (error) {
        lastError = error;
        
        // Don't retry client errors (4xx)
        if (error.message.includes('HTTP 4')) {
          throw error;
        }
        
        // Wait before retry
        if (attempt < this.retryCount - 1) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * (attempt + 1)));
        }
      }
    }
    
    throw lastError;
  }

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  patch(endpoint, data) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

const api = new ApiClient(API_BASE_URL);

// ============================================================================
// Room API
// ============================================================================

export const RoomAPI = {
  /**
   * Get room by code
   */
  async getRoom(code) {
    return api.get(`/rooms/${code.toUpperCase()}`);
  },

  /**
   * Create a new room
   */
  async createRoom(data = {}) {
    return api.post('/rooms', data);
  },

  /**
   * Update room settings
   */
  async updateRoom(code, data) {
    return api.patch(`/rooms/${code.toUpperCase()}`, data);
  },

  /**
   * Get players in room
   */
  async getPlayers(code) {
    return api.get(`/rooms/${code.toUpperCase()}/players`);
  },
};

// ============================================================================
// Player API
// ============================================================================

export const PlayerAPI = {
  /**
   * Join a room as player
   */
  async join(roomCode, userId, displayName, color) {
    return api.post('/players/join', {
      roomCode: roomCode.toUpperCase(),
      userId,
      displayName,
      color,
    });
  },

  /**
   * Claim an instrument
   */
  async claimInstrument(playerId, instrument) {
    return api.post(`/players/${playerId}/claim`, { instrument });
  },

  /**
   * Release an instrument
   */
  async releaseInstrument(playerId) {
    return api.post(`/players/${playerId}/release`);
  },

  /**
   * Leave room
   */
  async leave(playerId) {
    return api.post(`/players/${playerId}/leave`);
  },
};

// ============================================================================
// Chat API
// ============================================================================

export const ChatAPI = {
  /**
   * Get chat messages
   */
  async getMessages(roomCode, limit = 50, before = null) {
    let url = `/chat/${roomCode.toUpperCase()}?limit=${limit}`;
    if (before) url += `&before=${before}`;
    return api.get(url);
  },

  /**
   * Send a message (fallback for non-WebSocket)
   */
  async sendMessage(roomCode, userId, content, type = 'TEXT') {
    return api.post('/chat', {
      roomCode: roomCode.toUpperCase(),
      userId,
      content,
      type,
    });
  },
};

// ============================================================================
// WebSocket Service
// ============================================================================

class SocketService {
  constructor(url) {
    this.url = url;
    this.socket = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.isConnecting = false;
    this.currentRoom = null;
    this.currentUserId = null;
  }

  /**
   * Connect to WebSocket server
   */
  async connect() {
    if (this.socket?.connected || this.isConnecting) {
      return this.socket;
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      // Dynamic import Socket.io client
      import('socket.io-client').then(({ io }) => {
        this.socket = io(`${this.url}/rooms`, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: this.maxReconnectAttempts,
          reconnectionDelay: this.reconnectDelay,
        });

        this.socket.on('connect', () => {
          console.log('[Socket] Connected:', this.socket.id);
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          resolve(this.socket);
        });

        this.socket.on('connect_error', (error) => {
          console.error('[Socket] Connection error:', error);
          this.isConnecting = false;
          reject(error);
        });

        this.socket.on('disconnect', (reason) => {
          console.log('[Socket] Disconnected:', reason);
        });

        // Re-register all listeners
        this.listeners.forEach((callbacks, event) => {
          callbacks.forEach(callback => {
            this.socket.on(event, callback);
          });
        });
      }).catch(reject);
    });
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Join a room
   */
  async joinRoom(roomCode, userId, displayName, color, asCrowd = false) {
    await this.connect();
    
    this.currentRoom = roomCode.toUpperCase();
    this.currentUserId = userId;
    
    this.socket.emit('room:join', {
      roomCode: this.currentRoom,
      userId,
      displayName,
      color,
      asCrowd,
    });
  }

  /**
   * Leave current room
   */
  leaveRoom() {
    if (this.socket && this.currentRoom) {
      this.socket.emit('room:leave');
      this.currentRoom = null;
    }
  }

  /**
   * Subscribe to an event
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    
    if (this.socket) {
      this.socket.on(event, callback);
    }
    
    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from an event
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  /**
   * Emit an event
   */
  emit(event, data) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('[Socket] Not connected, cannot emit:', event);
    }
  }

  // ========================================================================
  // Room Controls
  // ========================================================================

  setBpm(bpm) {
    this.emit('room:bpm', { bpm });
  }

  setKey(key) {
    this.emit('room:key', { key });
  }

  setScale(scale) {
    this.emit('room:scale', { scale });
  }

  togglePlay(isPlaying) {
    this.emit('room:play', { isPlaying });
  }

  toggleMetronome(metronomeOn) {
    this.emit('room:metronome', { metronomeOn });
  }

  // ========================================================================
  // Instrument Controls
  // ========================================================================

  claimInstrument(instrument) {
    this.emit('instrument:claim', { instrument });
  }

  releaseInstrument() {
    this.emit('instrument:release');
  }

  // ========================================================================
  // Note Events
  // ========================================================================

  sendNote(instrument, note, velocity = 100, eventType = 'NOTE_ON', scheduledAt = null) {
    this.emit('note', {
      instrument,
      note,
      velocity,
      eventType,
      scheduledAt,
    });
  }

  // ========================================================================
  // Chat
  // ========================================================================

  sendChatMessage(content, type = 'TEXT') {
    this.emit('chat:message', { content, type });
  }

  // ========================================================================
  // Presence
  // ========================================================================

  ping() {
    this.emit('ping');
  }
}

// Create singleton instance
export const socketService = new SocketService(WS_URL);

// ============================================================================
// Health Check
// ============================================================================

export async function checkBackendHealth() {
  try {
    const response = await fetch(`${API_BASE_URL.replace('/api', '')}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

// ============================================================================
// Export all
// ============================================================================

export default {
  RoomAPI,
  PlayerAPI,
  ChatAPI,
  socketService,
  checkBackendHealth,
};
