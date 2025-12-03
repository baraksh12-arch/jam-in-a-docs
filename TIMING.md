# Timing & Latency Documentation

## Overview

This document explains how timing and latency are managed in the Jam in a Docs application to achieve app-added latency ≤ 5ms beyond network RTT.

## Room Time Computation

**Location**: `src/lib/clockSync.js` → `ClockSync.getRoomTime()`

Room time is computed as:
```
roomTime = (Date.now() - roomStartTimestamp) / 1000
```

- `roomStartTimestamp` comes from Supabase `rooms.created_at` (or `rooms.createdAt`)
- All players use the same room start timestamp, ensuring synchronized timeline
- Room time is in seconds (floating point)
- Updated in real-time as `Date.now()` advances

This ensures all players' audio is aligned to the same musical timeline, regardless of when they joined.

## Latency Measurement Per Peer

**Location**: `src/lib/clockSync.js` → Ping/Pong protocol

Latency is measured using a lightweight ping/pong protocol over WebRTC DataChannels:

1. **Ping message**: `{ type: "ping", senderId: "<userId>", timestamp: <Date.now()> }`
2. **Pong response**: `{ type: "pong", senderId: "<userId>", originalTimestamp: <pingTimestamp>, timestamp: <Date.now()> }`
3. **Latency calculation**: `latency = (now - pingTimestamp) / 2` (one-way delay)

**Features**:
- Ping messages sent every 3 seconds per peer
- Latency smoothed using Exponential Moving Average (EMA) with alpha = 0.3
- Default latency: 50ms if unknown
- Latency updates logged at ~10% rate to avoid spam

**Location**: `src/lib/webrtcManager.js` → Automatic ping/pong handling

## Target Audio Time Computation

**Location**: `src/lib/clockSync.js` → `ClockSync.computeTargetAudioTime()`

When a remote note event is received, the target playback time is computed as:

```
targetAudioTime = audioContext.currentTime + timeDelta + latencySeconds + safetySeconds
```

Where:
- `timeDelta = roomTimeFromEvent - currentRoomTime` (seconds)
- `latencySeconds = latencyMs / 1000` (converted from milliseconds)
- `safetySeconds = SAFETY_OFFSET_MS / 1000` (5ms converted to seconds)

**Immediate playback fallback**:
- If `targetAudioTime - audioContext.currentTime <= 0.003` (3ms), play immediately
- Prevents scheduling notes in the past, which can cause clicks/no playback

**Location**: `src/components/hooks/useNoteEvents.jsx` → Remote note scheduling

## Safety Offset

**Constant**: `SAFETY_OFFSET_MS = 5` milliseconds

**Purpose**: 
- Accounts for jitter, processing time, and clock drift
- Prevents notes from playing slightly early and getting cut off
- Must stay very small to meet app-added latency target of ≤ 5ms

**Location**: `src/lib/clockSync.js`

## App-Added Latency Target

**Goal**: App-added latency ≤ 5ms beyond network RTT

**Components**:
1. **Safety offset**: 5ms (jitter protection)
2. **Immediate playback threshold**: 3ms (prevents past scheduling)
3. **Processing overhead**: Minimized by:
   - Gated console logs (DEBUG_WEBRTC flag)
   - Minimal jam event fields (type, instrument, note, velocity, roomTime, senderId, timestamp)
   - Direct Web Audio scheduling (no intermediate queues)
   - Unordered, unreliable DataChannels (lowest latency)

**Total app-added latency**: ~5ms (safety offset) + minimal processing overhead

## Remote Note Scheduling

**Location**: `src/components/hooks/useNoteEvents.jsx`

When a remote note event is received:

1. Get `audioContext` from audio engine
2. Compute `targetAudioTime` using `clockSync.computeTargetAudioTime()`
3. If `targetAudioTime <= currentTime + 3ms`: play immediately
4. Otherwise: schedule using `audioEngine.playNoteAt(targetAudioTime)`

**Local echo**: Always plays immediately (no scheduling) for instant feedback.

## Performance Optimizations

1. **Console logs gated**: All hot-path logs behind `DEBUG_WEBRTC` flag (default: false)
2. **Minimal message size**: Jam events only contain essential fields
3. **Direct Web Audio scheduling**: No intermediate queues or buffers
4. **Unordered DataChannels**: Lowest latency, accepts packet loss over late delivery

## Jam Event Fields

Jam events sent over DataChannel contain only:
- `type`: Event type ('noteOn', 'noteOff')
- `instrument`: Instrument name ('DRUMS', 'BASS', 'EP', 'GUITAR')
- `note`: MIDI note (0-127) or drum pad ID (string)
- `velocity`: MIDI velocity (0-127) - only for noteOn
- `roomTime`: Room time in seconds (synchronized timestamp)
- `senderId`: User ID of sender
- `timestamp`: Local timestamp (ms) for debugging/deduplication

No extra debugging data or nested objects are sent over the DataChannel.

## Manual Testing

### Test Setup

1. **Open two browser tabs** on the same machine (or two machines on the same LAN)
2. **Join the same room** in both tabs
3. **Claim different instruments** (e.g., Tab A = DRUMS, Tab B = BASS)

### Test Procedure

#### Test 1: Basic Latency & Synchronization
1. In Tab A, play steady 8th-notes (click drum pad repeatedly at consistent tempo)
2. Listen in Tab B - notes should feel "locked" and in-phase, not flammy or delayed
3. Repeat from Tab B to Tab A (switch instruments if needed)
4. **Expected**: Remote notes should sound synchronized with local playback, minimal perceived delay

#### Test 2: Bidirectional Playback
1. Both tabs play simultaneously (different instruments)
2. Listen to the mix - all notes should align rhythmically
3. **Expected**: No obvious "ping-pong echo" or delayed remote playback

#### Test 3: Connection Resilience
1. While playing, disconnect one tab's network (or close tab)
2. Reconnect/reopen the tab
3. Rejoin the room and resume playing
4. **Expected**: No crashes, connection re-establishes, latency measurement resumes

#### Test 4: Latency Measurement
1. Enable `DEBUG_WEBRTC = true` in `webrtcManager.js` and `useNoteEvents.jsx` (temporarily)
2. Open browser console in both tabs
3. Observe latency logs: `[ClockSync] Latency for peer X: Yms`
4. **Expected**: Latency values should be reasonable (typically 10-50ms on LAN, higher on WAN)
5. Latency should stabilize after a few ping/pong cycles

### Success Criteria

✅ Remote notes feel "locked" and in-phase (not flammy)  
✅ No obvious delay or echo in remote playback  
✅ No crashes on disconnect/reconnect  
✅ Latency measurement shows reasonable values  
✅ Notes scheduled correctly (no clicks or missed notes)

### Troubleshooting

- **Notes sound flammy/delayed**: Check latency measurement, verify roomTime is synchronized
- **Clicks or missed notes**: Check AudioContext scheduling, verify safety offset is appropriate
- **High latency values**: Check network conditions, verify ping/pong is working (check console)
- **Connection issues**: Check WebRTC signaling, verify DataChannels are opening

