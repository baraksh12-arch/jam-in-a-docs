# Phase 1: Codebase Scan & Mapping Report
**Date:** Current Session  
**Status:** ✅ Complete - Ready for Phase 2

---

## 📋 Executive Summary

The Jam-in-a-Doc codebase is a React-based collaborative music application using:
- **Raw Web Audio API** (no Tone.js currently)
- **WebRTC DataChannels** for peer-to-peer communication
- **Supabase** for room/player state management
- **Custom clock synchronization** for room time
- **Event bundling** for non-drum instruments

---

## 🎹 Instrument Architecture

### Current Implementation

#### 1. **Drums** (`DRUMS`)
- **Location:** `src/components/instruments/DrumPad.jsx`
- **Trigger:** `onNotePlay(padId)` → calls `audioEngine.playNote('DRUMS', padId)`
- **Sound Generation:** `useAudioEngine.jsx` → `playDrumSound(drumType, when)`
- **Synthesis Method:** Raw Web Audio API with oscillators + noise buffers
  - Kick: Dual oscillators (150Hz → 40Hz, 80Hz → 30Hz)
  - Snare: Triangle oscillator + filtered white noise
  - Hi-hat: Filtered white noise (highpass @ 7kHz)
  - Crash: Long filtered noise (1.5s decay)
  - Toms: Oscillators with frequency sweeps
- **Polyphony Management:** Voice stealing system (max 32 simultaneous voices)
- **Latency Handling:** 
  - **Sending:** Bypasses bundler, sends immediately via WebRTC
  - **Receiving:** Plays immediately, no scheduling (ultra-low latency path)

#### 2. **Bass** (`BASS`)
- **Location:** `src/components/instruments/PianoKeyboard.jsx` (shared with EP/GUITAR)
- **Trigger:** `onNotePlay(midiNote)` → calls `audioEngine.playNote('BASS', midiNote)`
- **Sound Generation:** `useAudioEngine.jsx` → `playBassSynth(frequency, duration, when)`
- **Synthesis Method:** Raw Web Audio API
  - 3 oscillators: sawtooth (fundamental), square (sub-oscillator), sawtooth (detuned)
  - Lowpass filter with frequency sweep
  - ADSR envelope (attack: 0.001s ULTRA / 0.01s SYNCED)
- **Note Range:** MIDI 28-52 (E1 to E3)

#### 3. **Electric Piano** (`EP`)
- **Location:** `src/components/instruments/PianoKeyboard.jsx`
- **Trigger:** `onNotePlay(midiNote)` → calls `audioEngine.playNote('EP', midiNote)`
- **Sound Generation:** `useAudioEngine.jsx` → `playEPianoSynth(frequency, duration, when)`
- **Synthesis Method:** Raw Web Audio API (FM synthesis)
  - Carrier: sine wave
  - Modulator: sine wave at 3.5x frequency
  - Lowpass filter
  - ADSR envelope (attack: 0.001s ULTRA / 0.01s SYNCED)
- **Note Range:** MIDI 48-84 (C3 to C6)

#### 4. **Guitar** (`GUITAR`)
- **Location:** `src/components/instruments/PianoKeyboard.jsx`
- **Trigger:** `onNotePlay(midiNote)` → calls `audioEngine.playNote('GUITAR', midiNote)`
- **Sound Generation:** `useAudioEngine.jsx` → `playGuitarSynth(frequency, duration, when)`
- **Synthesis Method:** Raw Web Audio API (Karplus-Strong inspired)
  - 3 oscillators: sawtooth, square (2x), triangle (0.5x)
  - WaveShaper distortion (tanh curve)
  - Lowpass filter with frequency sweep
  - ADSR envelope (attack: 0.001s ULTRA / 0.005s SYNCED)
- **Note Range:** MIDI 40-76 (E2 to E5)

### Audio Engine Hook
**File:** `src/components/hooks/useAudioEngine.jsx`

**Key Functions:**
- `playNote(instrument, note, velocity)` - Immediate playback
- `playNoteAt(instrument, note, velocity, whenInSeconds)` - Scheduled playback
- `stopNote(instrument, note)` - Stop note
- `stopNoteAt(instrument, note, whenInSeconds)` - Scheduled stop
- `setInstrumentVolume(instrument, value)` - Volume control
- `getAudioContext()` - Returns AudioContext for scheduling

**Current State:**
- ✅ Uses raw Web Audio API (AudioContext, Oscillators, GainNodes, Filters)
- ✅ Supports scheduled playback via `playNoteAt()`
- ✅ Has warmup mechanism for ULTRA_LOW_LATENCY mode
- ❌ **No Tone.js integration**
- ❌ **No sample-based instruments** (all procedural synthesis)

---

## 🌐 Network & Event Flow

### Note Event Sending
**Flow:** `InstrumentPanel` → `sendNote()` → `useNoteEvents.sendNote()` → `webrtc.sendJamEvent()` → `WebRTCManager.sendJamEvent()`

**File:** `src/components/hooks/useNoteEvents.jsx`
- Creates jam event with `roomTime` from `webrtc.getRoomTime()`
- Sends via `webrtc.sendJamEvent(event)`
- **DRUMS:** Bypasses bundler, sends immediately
- **Other instruments:** Queued in bundler (8ms ULTRA / 16ms SYNCED intervals)

**File:** `src/lib/webrtcManager.js`
- `sendJamEvent(event)` routes to bundler or immediate send
- `sendBundle(eventsArray)` serializes and sends to all connected peers
- Uses unordered, unreliable DataChannels (`ordered: false, maxRetransmits: 0`)

### Note Event Receiving
**Flow:** WebRTC DataChannel → `WebRTCManager.onmessage` → `useNoteEvents` listener → `audioEngine.playNote()` or `playNoteAt()`

**File:** `src/components/hooks/useNoteEvents.jsx`
- Listens to `webrtc.onJamEvent(callback)`
- **DRUMS:** Always plays immediately (bypasses all scheduling)
- **ULTRA mode:** Non-drums play immediately
- **SYNCED mode:** Non-drums use `computeTargetAudioTime()` for scheduling

**Scheduling Logic:**
```javascript
targetAudioTime = audioContext.currentTime + timeDelta + latencySeconds + safetySeconds
```
- `timeDelta = roomTimeFromEvent - currentRoomTime`
- `latencySeconds = peerLatencyMs / 1000`
- `safetySeconds = 1.0ms / 1000` (SAFETY_OFFSET_MS)

---

## ⏱️ Clock Synchronization

### Current Implementation
**File:** `src/lib/clockSync.js`

**ClockSync Class:**
- **Room Time:** Based on `rooms.created_at` timestamp from Supabase
- **Latency Measurement:** Ping-pong RTT measurement (every 500ms per peer)
- **Latency Estimation:** 
  - Median of last 5 RTTs (spike rejection: >2x median)
  - Kalman-like filter for smoothing
  - One-way latency = RTT / 2

**Key Methods:**
- `getRoomTime()` - Returns seconds since room start
- `computeTargetAudioTime(roomTimeFromMessage, audioContext, peerId)` - Calculates when to play note
- `updateLatency(peerId, rttMs)` - Updates latency estimate

**Limitations:**
- ❌ **No server-side clock sync** (relies on Supabase timestamp)
- ❌ **No time offset calculation** (no `timeOffset = serverTime - clientTime`)
- ❌ **No periodic clock sync updates** (only initial room timestamp)
- ✅ Has latency compensation per peer
- ✅ Has safety offset (1.0ms)

---

## 📦 Event Bundling

**File:** `src/lib/jamEventBundler.js`

**JamEventBundler Class:**
- Queues events and flushes at intervals
- **ULTRA mode:** 8ms flush interval (~125 fps)
- **SYNCED mode:** 16ms flush interval (~60 fps)
- **DRUMS:** Always bypass bundler (immediate send)

**Bundle Format:**
- Single event: `{ type, instrument, note, ... }`
- Multiple events: `{ kind: 'bundle', events: [...] }`

---

## 🔌 WebRTC Architecture

**File:** `src/lib/webrtcManager.js`

**Connection Model:**
- Full mesh topology (each player connects to all others)
- One DataChannel per peer connection (named "midi")
- Unordered, unreliable channels for lowest latency

**Key Features:**
- Automatic peer connection management
- Ping/pong for latency measurement
- Event bundling integration
- Connection state tracking

**File:** `src/components/hooks/useWebRTC.jsx`
- React hook wrapper for WebRTCManager
- Manages peer lifecycle (add/remove based on `useRoomState.peers`)
- Exposes `sendJamEvent()`, `onJamEvent()`, `getRoomTime()`, `computeTargetAudioTime()`

---

## 🎛️ Instrument Claiming

**File:** `src/components/hooks/useRoomState.jsx`

**Current Flow:**
1. User clicks "Claim Instrument" → `claimMyInstrument(instrument)`
2. Calls `claimInstrument(roomId, userId, instrument)` (Firebase/Supabase)
3. Room state updates via subscription → `players` array updates
4. `useWebRTC` detects peer changes → adds/removes WebRTC connections
5. UI updates to show claimed instrument

**Limitations:**
- ❌ **No silent peer refresh** - WebRTC connections are recreated
- ❌ **No broadcast of claim events** - Relies on database subscription
- ✅ Instrument state persists in database
- ✅ Players can see who has which instrument

---

## 🎚️ Latency Modes

**File:** `src/config/latencyMode.js`

**Current Modes:**
1. **ULTRA_LOW_LATENCY** (currently active)
   - DRUMS: Immediate send/receive
   - Other instruments: Immediate playback (no scheduling)
   - Bundle interval: 8ms

2. **SYNCED**
   - DRUMS: Immediate send/receive
   - Other instruments: Clock-synchronized scheduling with latency compensation
   - Bundle interval: 16ms

**Note:** Mode is hardcoded to `ULTRA` globally (no UI toggle yet)

---

## 📊 Current Architecture Strengths

✅ **Ultra-low latency path for drums** (bypasses bundler and scheduling)  
✅ **WebRTC peer-to-peer** (no server bottleneck)  
✅ **Unreliable DataChannels** (drops late packets, prevents audio glitches)  
✅ **Polyphony management for drums** (voice stealing)  
✅ **Latency measurement per peer** (ping-pong with Kalman filtering)  
✅ **Event bundling** (reduces burst pressure)  
✅ **Scheduled playback support** (via `playNoteAt()`)  

---

## 🚨 Current Architecture Gaps (vs Google Shared Piano)

### Audio Engine
❌ **No Tone.js** - Using raw Web Audio API (more complex, less optimized)  
❌ **No sample-based instruments** - All procedural synthesis  
❌ **No Tone.Transport** - No unified timing system  
❌ **No preloaded samples** - Samples generated on-the-fly  

### Clock Sync
❌ **No server-side clock sync** - Only uses room creation timestamp  
❌ **No time offset calculation** - No `timeOffset = serverTime - clientTime`  
❌ **No periodic sync updates** - Only initial timestamp  
❌ **No shared clock** - Each client calculates room time independently  

### Scheduling
❌ **No global latency buffer** - Uses per-peer latency + 1ms safety  
❌ **No late note filtering** - Plays notes even if they arrive late  
❌ **No jitter handling** - No sliding window or deduplication beyond basic Set  
❌ **No timestamp-based scheduling** - Uses room time delta, not absolute timestamps  

### Instrument Claiming
❌ **No silent peer refresh** - WebRTC connections are recreated on claim  
❌ **No claim event broadcast** - Relies on database subscription (slower)  

---

## 📝 Key Files Reference

### Audio
- `src/components/hooks/useAudioEngine.jsx` - Audio engine (Web Audio API)
- `src/components/instruments/DrumPad.jsx` - Drum pad UI
- `src/components/instruments/PianoKeyboard.jsx` - Piano keyboard UI (shared)

### Networking
- `src/lib/webrtcManager.js` - WebRTC connection management
- `src/lib/webrtcSignaling.js` - WebRTC signaling (not shown, but referenced)
- `src/components/hooks/useWebRTC.jsx` - React hook for WebRTC
- `src/components/hooks/useNoteEvents.jsx` - Note event sending/receiving

### Synchronization
- `src/lib/clockSync.js` - Clock sync and latency estimation
- `src/lib/jamEventProtocol.js` - Event serialization
- `src/lib/jamEventBundler.js` - Event bundling

### State Management
- `src/components/hooks/useRoomState.jsx` - Room and player state
- `src/config/latencyMode.js` - Latency mode configuration

### UI
- `src/pages/Room.jsx` - Main room page
- `src/components/InstrumentPanel.jsx` - Instrument panel UI
- `src/components/InstrumentGrid.jsx` - Grid of instrument panels

---

## 🎯 Phase 2 Readiness

**Status:** ✅ Ready to proceed

**Prerequisites Met:**
- ✅ All instrument modules identified
- ✅ Current trigger logic mapped
- ✅ Network flow understood
- ✅ Clock sync mechanism documented
- ✅ Scheduling logic analyzed

**Next Steps (Phase 2):**
1. Install Tone.js dependency
2. Create modular Tone.js instrument modules
3. Replace `useAudioEngine` with Tone.js-based implementation
4. Ensure backward compatibility with existing trigger logic

---

**End of Phase 1 Report**

