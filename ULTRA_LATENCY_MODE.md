# ULTRA_LOW_LATENCY Mode

## Overview

ULTRA_LOW_LATENCY mode is a latency optimization mode that bypasses clock synchronization and scheduling to achieve the smallest possible latency for all instruments (DRUMS, BASS, EP, GUITAR). This mode is designed for scenarios where immediate responsiveness is more important than tight synchronization across long distances.

## Event Bundling

To reduce burst pressure and stabilize latency (especially for drums), outgoing jam events are bundled into single packets:

- **ULTRA mode**: Events are bundled every **8ms** (~125 fps)
- **SYNCED mode**: Events are bundled every **16ms** (~60 fps)

The bundler maintains a queue of outgoing events and flushes them at regular intervals. This dramatically reduces the number of packets sent during rapid drum patterns while keeping latency very low.

**Backwards compatibility**: Single events are sent as-is (no bundle wrapper), and the receiving side accepts both single events and bundles.

## How It Works

### Audio Engine Preloading

When ULTRA mode is active, the audio engine performs a one-time warmup on the first real note:

1. **Context Resume**: Ensures the AudioContext is active and resumed
2. **Node Pre-creation**: Triggers very low-level (inaudible) sounds for each instrument type:
   - DRUMS: Very quiet kick drum
   - BASS: Very quiet bass note
   - EP: Very quiet electric piano note
   - GUITAR: Very quiet guitar note

This "wakes up" the audio graph so that real notes don't incur node creation or context resume latency.

### Fast Envelopes

In ULTRA mode, harmonic instruments (BASS, EP, GUITAR) use ultra-fast attack times:

- **ULTRA mode**: 0.001s (1ms) attack time
- **SYNCED mode**: 0.01s (10ms) for BASS/EP, 0.005s (5ms) for GUITAR

This reduces the perceived latency when notes start playing.

### No Scheduling

In ULTRA mode, all remote note events bypass clock synchronization:

- **ULTRA mode**: Notes play immediately upon arrival (using `audioEngine.playNote()`)
- **SYNCED mode**: Notes are scheduled using `computeTargetAudioTime()` and `audioEngine.playNoteAt()`

This eliminates scheduling overhead and latency compensation calculations.

### Event Bundling

Outgoing jam events are bundled to reduce burst pressure:

- Events are queued in `JamEventBundler` and flushed at regular intervals
- **ULTRA mode**: 8ms flush interval (~125 fps) - keeps latency very low
- **SYNCED mode**: 16ms flush interval (~60 fps) - slightly higher latency for better batching
- Single events are sent as-is (backwards compatible)
- Multiple events are sent as a bundle object: `{ kind: 'bundle', events: [...] }`
- Receiving side accepts both single events and bundles (handled by `normalizeIncomingJamPayload`)

**Trade-off**: Slightly more deterministic latency (worst-case ~8ms for ULTRA) in exchange for much more stable performance under bursts, especially for drums.

## Files Involved

### Configuration
- `src/config/latencyMode.js` - Central latency mode configuration

### Core Implementation
- `src/components/hooks/useAudioEngine.jsx` - Audio engine with warmup and fast envelopes
- `src/components/hooks/useNoteEvents.jsx` - Note event handling with ULTRA mode bypass
- `src/lib/clockSync.js` - Clock sync helper function
- `src/lib/jamEventBundler.js` - Event bundling for reduced burst pressure
- `src/lib/webrtcManager.js` - WebRTC manager with bundling integration
- `src/lib/jamEventProtocol.js` - Event protocol with bundle normalization

### UI
- `src/components/room/TopBar.jsx` - Visual latency mode indicator

## Changing Latency Mode

To switch between ULTRA and SYNCED modes, edit `src/config/latencyMode.js`:

```javascript
// For ULTRA mode:
export const CURRENT_LATENCY_MODE = LATENCY_MODES.ULTRA;

// For SYNCED mode:
export const CURRENT_LATENCY_MODE = LATENCY_MODES.SYNCED;
```

**Important**: Both browsers/clients must use the same mode for consistent behavior. In the future, this can be made configurable via UI or room settings.

## Trade-offs

### ULTRA_LOW_LATENCY Mode

**Advantages:**
- Fastest possible response time
- No scheduling overhead
- Preloaded audio engine eliminates first-note latency
- Tight envelopes for immediate attack

**Disadvantages:**
- No clock synchronization - notes may drift slightly across players
- Less tight sync at long distances or high network latency
- Players may hear notes at slightly different times

### SYNCED Mode

**Advantages:**
- Tight synchronization across all players
- Accounts for network latency
- Notes play at the same musical time for everyone

**Disadvantages:**
- Higher latency due to scheduling and latency compensation
- First note may have extra latency (node creation, context resume)
- More computational overhead

## Debug Logging

Debug logs are controlled by flags in each file:

- `DEBUG_LATENCY` in `useAudioEngine.jsx` and `useNoteEvents.jsx` (default: `false`)
- `DEBUG_WEBRTC` in `useNoteEvents.jsx` (default: `false`)

When enabled, logs will show:
- `[AudioEngine] Warmup completed (ULTRA_LOW_LATENCY).`
- `[useNoteEvents] ULTRA mode - playing remote note immediately:`

## Testing

To test ULTRA mode:

1. Ensure both browsers have `CURRENT_LATENCY_MODE = LATENCY_MODES.ULTRA`
2. Open the room in both browsers
3. Play notes and observe:
   - Visual indicator shows "Latency: ULTRA LOW" in the top bar
   - Notes play immediately with no noticeable delay
   - First note should be as fast as subsequent notes (warmup effect)

## Future Enhancements

- UI toggle to switch modes without code changes
- Per-room latency mode configuration
- Automatic mode selection based on network conditions
- Hybrid mode: ULTRA for local/close peers, SYNCED for distant peers

