# API Reference - Jam in a Docs

## Overview

This document describes the API contracts for Jam in a Docs, including database operations, React hooks, and audio engine interfaces.

## Database API (`src/components/firebaseClient.jsx`)

### Room Operations

#### `createRoom(roomId: string): Promise<Room>`

Creates a new room with the specified room code.

**Parameters:**
- `roomId` (string): 6-character alphanumeric room code (e.g., "ABC123")

**Returns:** Promise resolving to room object with:
```typescript
{
  id: string;
  bpm: number;
  key: string;
  scale: string;
  is_playing: boolean;
  metronome_on: boolean;
  created_at: string;
  updated_at: string;
}
```

**Throws:**
- `Error` if rate limit exceeded
- `Error` if room code is invalid
- `Error` if room creation fails

**Example:**
```javascript
const room = await createRoom('ABC123');
console.log(room.id); // 'ABC123'
```

---

#### `getRoom(roomId: string): Promise<Room | null>`

Fetches room data by room code.

**Parameters:**
- `roomId` (string): 6-character room code

**Returns:** Promise resolving to room object or `null` if not found

**Throws:**
- `Error` if database query fails

---

#### `updateRoom(roomId: string, data: Partial<Room>): Promise<{data: Room}>`

Updates room configuration.

**Parameters:**
- `roomId` (string): Room code
- `data` (object): Partial room object with fields to update:
  - `bpm?: number`
  - `key?: string`
  - `scale?: string`
  - `isPlaying?: boolean`
  - `metronomeOn?: boolean`

**Returns:** Promise resolving to updated room object

---

### Player Operations

#### `joinRoomAsPlayer(roomId: string, userId: string, displayName: string, color: string): Promise<{data: Player}>`

Joins a room as a player (can claim instruments).

**Parameters:**
- `roomId` (string): Room code
- `userId` (string): Unique user ID
- `displayName` (string): Player display name (sanitized)
- `color` (string): Hex color code for player

**Returns:** Promise resolving to player object

**Throws:**
- `Error` if rate limit exceeded
- `Error` if validation fails
- `Error` if room doesn't exist

---

#### `claimInstrument(roomId: string, userId: string, instrument: Instrument): Promise<{data: Player}>`

Claims an instrument for a player.

**Parameters:**
- `roomId` (string): Room code
- `userId` (string): User ID
- `instrument` ('DRUMS' | 'BASS' | 'EP' | 'GUITAR'): Instrument to claim

**Returns:** Promise resolving to updated player object

**Throws:**
- `Error` if rate limit exceeded
- `Error` if instrument already claimed
- `Error` if validation fails

---

#### `releaseInstrument(roomId: string, userId: string): Promise<{data: Player}>`

Releases the player's claimed instrument.

**Parameters:**
- `roomId` (string): Room code
- `userId` (string): User ID

**Returns:** Promise resolving to updated player object

---

#### `getPlayers(roomId: string): Promise<Player[]>`

Fetches all players in a room.

**Parameters:**
- `roomId` (string): Room code

**Returns:** Promise resolving to array of player objects

---

### Chat Operations

#### `sendChatMessage(roomId: string, userId: string, displayName: string, text: string): Promise<{data: ChatMessage}>`

Sends a chat message to the room.

**Parameters:**
- `roomId` (string): Room code
- `userId` (string): User ID
- `displayName` (string): Display name
- `text` (string): Message text (sanitized for XSS)

**Returns:** Promise resolving to chat message object

**Throws:**
- `Error` if rate limit exceeded (10 messages per 10 seconds)
- `Error` if validation fails

---

#### `getChatMessages(roomId: string): Promise<ChatMessage[]>`

Fetches all chat messages for a room.

**Parameters:**
- `roomId` (string): Room code

**Returns:** Promise resolving to array of chat messages

---

### Real-time Subscriptions

#### `subscribeToRoom(roomId: string, callback: (room: Room) => void): () => void`

Subscribes to room updates.

**Parameters:**
- `roomId` (string): Room code
- `callback` (function): Called when room updates

**Returns:** Unsubscribe function

---

#### `subscribeToPlayers(roomId: string, callback: (players: Player[]) => void): () => void`

Subscribes to player list updates.

**Parameters:**
- `roomId` (string): Room code
- `callback` (function): Called when players change

**Returns:** Unsubscribe function

---

#### `subscribeToChatMessages(roomId: string, callback: (message: ChatMessage) => void): () => void`

Subscribes to new chat messages.

**Parameters:**
- `roomId` (string): Room code
- `callback` (function): Called when new message arrives

**Returns:** Unsubscribe function

---

## React Hooks API

### `useUserIdentity()`

Manages user identity (ID, display name, color).

**Returns:**
```typescript
{
  userId: string;
  displayName: string;
  color: string;
  isReady: boolean;
}
```

**Example:**
```javascript
const { userId, displayName, color } = useUserIdentity();
```

---

### `useRoomState(roomId: string, userId: string, webrtc: WebRTCManager | null)`

Manages room state, players, and subscriptions.

**Parameters:**
- `roomId` (string): Room code
- `userId` (string): Current user ID
- `webrtc` (WebRTCManager | null): WebRTC manager instance

**Returns:**
```typescript
{
  room: Room | null;
  players: Player[];
  peers: Player[]; // Filtered players (excludes self, only players)
  currentPlayer: Player | null;
  loading: boolean;
  error: string | null;
  claimInstrument: (instrument: Instrument) => Promise<void>;
  releaseInstrument: () => Promise<void>;
}
```

---

### `useAudioEngine()`

Manages the Web Audio API audio engine and Tone.js instruments.

**Returns:**
```typescript
{
  isReady: boolean;
  playNote: (instrument: Instrument, note: number, velocity?: number) => void;
  stopNote: (instrument: Instrument, note: number) => void;
  playNoteAt: (instrument: Instrument, note: number, time: number, velocity?: number) => void;
  setVolume: (instrument: Instrument, volume: number) => void;
  muteInstrument: (instrument: Instrument, muted: boolean) => void;
}
```

**Example:**
```javascript
const audioEngine = useAudioEngine();
audioEngine.playNote('DRUMS', 36, 100); // Play kick drum
```

---

### `useNoteEvents(roomId: string, userId: string, webrtc: WebRTCManager, audioEngine: AudioEngine, onActivity: Function)`

Handles note event sending and receiving.

**Parameters:**
- `roomId` (string): Room code
- `userId` (string): User ID
- `webrtc` (WebRTCManager): WebRTC manager
- `audioEngine` (AudioEngine): Audio engine instance
- `onActivity` (function): Callback for note activity

**Returns:**
```typescript
{
  sendNote: (instrument: Instrument, note: number, velocity: number) => void;
  isConnected: boolean;
}
```

---

### `useWebRTC({ roomId, userId, peers, room })`

Manages WebRTC P2P connections for real-time note events.

**Parameters:**
- `roomId` (string): Room code
- `userId` (string): User ID
- `peers` (Player[]): Array of peer players
- `room` (Room | null): Room object (for clock sync)

**Returns:**
```typescript
{
  ready: boolean;
  connectionStates: Record<string, string>;
  sendJamEvent: (event: JamEvent) => void;
  onJamEvent: (callback: (event: JamEvent) => void) => void;
}
```

---

## Audio Engine API (`src/lib/instruments/`)

### Instrument Modules

Each instrument module exports:

#### `init[Instrument](): Promise<void>`

Initializes the instrument (loads samples, sets up synths).

**Example:**
```javascript
import { initDrums } from '@/lib/instruments/drums';
await initDrums();
```

---

#### `triggerNote(note: number, velocity?: number): void`

Triggers a note on the instrument.

**Parameters:**
- `note` (number): MIDI note number (0-127)
- `velocity` (number, optional): Velocity (0-127), defaults to 100

**Example:**
```javascript
import { triggerNote as triggerDrum } from '@/lib/instruments/drums';
triggerDrum(36, 100); // Kick drum
```

---

#### `stopAllNotes(): void`

Stops all active notes (prevents stuck notes when switching modes).

**Example:**
```javascript
import { stopAllNotes as stopDrums } from '@/lib/instruments/drums';
stopDrums();
```

---

#### Mode Switching (Bass, Drums, EP, Guitar)

**Bass:**
```javascript
import { setBassMode, BASS_MODE_SYNTH, BASS_MODE_SAMPLED } from '@/lib/instruments/bass';
setBassMode(BASS_MODE_SYNTH);
```

**Drums:**
```javascript
import { setDrumKitMode, DRUM_KIT_MODE_SAMPLED, DRUM_KIT_MODE_ELECTRONIC } from '@/lib/instruments/drums';
setDrumKitMode(DRUM_KIT_MODE_SAMPLED);
```

**Electric Piano:**
```javascript
import { setEPMode, EP_MODE_ELECTRIC, EP_MODE_UPRIGHT } from '@/lib/instruments/piano';
setEPMode(EP_MODE_ELECTRIC);
```

**Guitar:**
```javascript
import { setGuitarMode, GUITAR_MODE_ELECTRIC, GUITAR_MODE_NYLON } from '@/lib/instruments/guitar';
setGuitarMode(GUITAR_MODE_ELECTRIC);
```

---

## Validation API (`src/lib/validation.js`)

### `validateRoomCode(code: string): {valid: boolean, error?: string, value?: string}`

Validates a room code (6 alphanumeric characters).

**Returns:**
- `{valid: true, value: string}` if valid
- `{valid: false, error: string}` if invalid

---

### `validateDisplayName(name: string): {valid: boolean, error?: string, sanitized?: string}`

Validates and sanitizes a display name.

**Returns:**
- `{valid: true, sanitized: string}` if valid
- `{valid: false, error: string}` if invalid

---

### `validateChatMessage(text: string): {valid: boolean, error?: string, sanitized?: string}`

Validates and sanitizes a chat message (max 500 chars, XSS protection).

**Returns:**
- `{valid: true, sanitized: string}` if valid
- `{valid: false, error: string}` if invalid

---

## Rate Limiting API (`src/lib/rateLimiter.js`)

### `RateLimiter(limit: number, windowMs: number)`

Creates a rate limiter instance.

**Parameters:**
- `limit` (number): Maximum number of calls allowed
- `windowMs` (number): Time window in milliseconds

**Methods:**
- `isAllowed(): boolean` - Checks if a call is allowed
- `reset(): void` - Resets the rate limiter

**Pre-configured Limiters:**
- `noteEventLimiter`: 100 calls per second
- `chatMessageLimiter`: 10 calls per 10 seconds
- `roomOperationLimiter`: 5 calls per 10 seconds

**Example:**
```javascript
import { chatMessageLimiter } from '@/lib/rateLimiter';
if (!chatMessageLimiter.isAllowed()) {
  throw new Error('Rate limit exceeded');
}
```

---

## Logging API (`src/lib/logger.js`)

### `debug(message: string, context?: object): void`
### `info(message: string, context?: object): void`
### `warn(message: string, context?: object): void`
### `error(message: string, context?: object): void`
### `critical(message: string, context?: object): void`

Structured logging functions.

**Example:**
```javascript
import { info, error } from '@/lib/logger';
info('Room created', { roomId: 'ABC123' });
error('Failed to join room', { error: err.message });
```

---

### `userAction(eventName: string, properties?: object): void`

Tracks user actions for analytics.

**Example:**
```javascript
import { userAction } from '@/lib/logger';
userAction('instrument_claimed', { instrument: 'DRUMS' });
```

---

### `trackPerformance(metricName: string, value: number, properties?: object): void`

Tracks performance metrics.

**Example:**
```javascript
import { trackPerformance } from '@/lib/logger';
trackPerformance('note_latency', 45, { instrument: 'DRUMS' });
```

---

## Type Definitions

### Room
```typescript
interface Room {
  id: string;
  bpm: number;
  key: string;
  scale: string;
  is_playing: boolean;
  metronome_on: boolean;
  created_at: string;
  updated_at: string;
}
```

### Player
```typescript
interface Player {
  id: string;
  user_id: string;
  room_id: string;
  display_name: string;
  color: string;
  instrument: 'DRUMS' | 'BASS' | 'EP' | 'GUITAR' | null;
  is_player: boolean;
  created_at: string;
}
```

### ChatMessage
```typescript
interface ChatMessage {
  id: string;
  room_id: string;
  user_id: string;
  display_name: string;
  text: string; // Sanitized
  created_at: string;
}
```

### Instrument
```typescript
type Instrument = 'DRUMS' | 'BASS' | 'EP' | 'GUITAR';
```

### JamEvent
```typescript
interface JamEvent {
  type: 'NOTE_ON' | 'NOTE_OFF';
  instrument: Instrument;
  note: number; // MIDI note (0-127)
  velocity: number; // 0-127
  timestamp: number; // Server-synced timestamp
  userId: string;
}
```

---

## Error Handling

All API functions throw `Error` objects with descriptive messages. Always wrap calls in try-catch:

```javascript
try {
  const room = await createRoom('ABC123');
} catch (error) {
  console.error('Failed to create room:', error.message);
  // Show user-friendly error message
}
```

---

## Rate Limiting

Rate limits are enforced client-side and may throw errors:
- **Note events**: 100 per second
- **Chat messages**: 10 per 10 seconds
- **Room operations**: 5 per 10 seconds

Handle rate limit errors gracefully:
```javascript
try {
  await sendChatMessage(roomId, userId, displayName, text);
} catch (error) {
  if (error.message.includes('Rate limit')) {
    // Show user-friendly rate limit message
  }
}
```

---

## Best Practices

1. **Always validate inputs** before calling API functions
2. **Handle errors gracefully** with user-friendly messages
3. **Use rate limiters** before making API calls
4. **Sanitize user inputs** (handled automatically by validation functions)
5. **Check `isReady` flags** before using hooks
6. **Clean up subscriptions** in `useEffect` cleanup functions
7. **Use structured logging** instead of `console.log`

---

For implementation details, see the source code in `src/components/` and `src/lib/`.

