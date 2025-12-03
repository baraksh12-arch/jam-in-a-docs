# Latency & Timing Analysis - Current State

## STEP 0 Summary: Current Timing Implementation

### 1. Room Time Computation

**Location**: `src/lib/clockSync.js` → `ClockSync.getRoomTime()`

**How it works**:
- Room time = `(Date.now() - roomStartTimestamp) / 1000` (seconds since room start)
- `roomStartTimestamp` is set from Supabase `rooms.created_at` or `rooms.createdAt`
- Initialized in `useWebRTC.jsx` when room data loads
- All players use the same room start timestamp, ensuring synchronized timeline

**Status**: ✅ Implemented and working

---

### 2. Ping/Pong Latency Measurement

**Location**: `src/lib/clockSync.js` → `ClockSync` class

**Current state**:
- **API exists but NOT implemented**: 
  - `registerPeer(peerId)` - registers peer, initializes latency to 50ms default
  - `updateLatency(peerId, latencyMs)` - updates latency using EMA smoothing (alpha = 0.3)
  - `getLatency(peerId)` - returns latency estimate (defaults to 50ms if unknown)
- **Missing**: No actual ping/pong messages are sent or handled
- **No ping/pong protocol**: No code in `webrtcManager.js` or `useWebRTC.jsx` that sends ping messages or handles pong responses
- **Result**: All peers use default 50ms latency estimate (not measured)

**Status**: ❌ Stubbed but not implemented

---

### 3. Remote Note Scheduling

**Location**: `src/components/hooks/useNoteEvents.jsx` → line 88-103

**Current behavior**:
- Remote notes are played **immediately** when received
- Code: `audioEngine.playNote(event.instrument, event.note, event.velocity)` (line 98)
- No scheduling in AudioContext time - just plays "now"
- TODO comment on line 88: "TODO: Use clockSync + computeTargetAudioTime for precise scheduling"

**Helper function exists but unused**:
- `computeTargetAudioTime()` exists in `clockSync.js` (lines 141-161)
- Takes: `audioContextCurrentTime`, `roomTimeFromEvent`, `currentRoomTime`, `latencyMs`, `safetyMs`
- Calculates target audio time accounting for latency and safety offset
- **Not called anywhere** in the codebase

**Audio Engine**:
- `useAudioEngine.jsx` uses `ctx.currentTime` (immediate scheduling)
- All synthesis functions schedule with `now = ctx.currentTime`
- No support for future scheduling (e.g., `playNoteAt(when)`)

**Status**: ❌ Immediate playback only, no scheduled playback

---

### 4. Local Echo

**Location**: `src/components/hooks/useNoteEvents.jsx` → `sendNote()` function (lines 152-158)

**Current behavior**:
- When sending a note locally, it plays immediately via `audioEngine.playNote()` (line 155)
- This provides instant local feedback
- Remote peers receive the event with `roomTime` but play it immediately (not scheduled)

**Status**: ✅ Working (immediate local echo)

---

## Summary

**What's working**:
- Room time computation (based on Supabase room start timestamp)
- Local echo (immediate playback for sender)
- Remote note reception and playback (immediate)

**What's missing**:
- Ping/pong latency measurement (API exists but not implemented)
- Scheduled remote note playback (plays immediately instead of using `computeTargetAudioTime`)
- Audio engine support for future scheduling (`playNoteAt()` method)

**Next steps** (per user's plan):
- STEP 1: Implement ping/pong protocol over DataChannel
- STEP 2: Use `computeTargetAudioTime` to schedule remote notes
- STEP 3: Minimize app-added latency (< 5ms)
- STEP 4: Testing and validation

