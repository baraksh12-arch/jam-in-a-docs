# STEP 1: Drum Implementation Analysis

## Summary of Current Implementation

### How is playDrumSound() implemented?

Located in `src/components/hooks/useAudioEngine.jsx` (lines 150-276):

- **Creates new audio nodes for each hit** - Good! Each drum hit creates fresh oscillators, buffers, and gain nodes
- **No node reuse** - Each hit is independent
- **No polyphony management** - No tracking of active voices, no voice stealing
- **No cleanup tracking** - Nodes just run until they stop themselves (via `stop()` calls)

Drum synthesis approaches:
- **Kick**: Two oscillators (punch + sub bass) with frequency sweeps
- **Snare**: Oscillator + noise buffer with highpass filter
- **Hihat**: Filtered white noise buffer (0.05s duration)
- **Crash**: Long filtered noise buffer (2s duration)
- **Tom**: Oscillator with frequency sweep

### Does it reuse a single AudioBufferSourceNode per drum type, or create a new source per hit?

✅ **Creates new nodes per hit** - This is correct! No reuse of nodes.

However:
- ❌ **No voice tracking** - Can't tell how many active voices exist
- ❌ **No voice limiting** - Could theoretically create unlimited nodes
- ❌ **No cleanup** - Nodes just stop themselves, but no tracking

### Does it use any flags like isPlaying, lastHitTime, MIN_INTERVAL_MS, or similar that throttle or debounce drum hits?

❌ **NO throttling in playDrumSound() itself** - The audio engine function is clean.

However, there IS throttling in the UI layer (see below).

### Is there any rate limiting / throttle / debounce in the drum UI components?

✅ **YES - Found blocking logic in DrumPad.jsx:**

**Location**: `src/components/instruments/DrumPad.jsx` (and duplicate in `src/components/DrumPad.jsx`)

**Problem**: Line 40 in keyboard handler:
```javascript
if (pad && !activePads.has(pad.id)) {
  handlePadPress(pad.id);
}
```

**Issue**: The `activePads` Set prevents the same pad from being triggered if it's already "active". The active state is cleared after **150ms** (line 25-31). This means:
- If you hit the same pad twice within 150ms, the second hit is **completely ignored**
- For 16th notes at 120 BPM (8 hits per second = 125ms between hits), this will block every other hit!
- For faster patterns, even more hits will be missed

**Root Cause**: The `activePads` Set was likely intended for visual feedback only, but it's being used to block input events.

### How does useNoteEvents call into the audio engine for DRUMS?

**Local hits** (from UI):
- `InstrumentPanel.jsx` line 65: `audioEngine.playNote(instrument, note, 100)` - Direct call, immediate
- `useNoteEvents.jsx` line 314: Also calls `audioEngine.playNote()` for local echo
- Both paths are immediate, no scheduling

**Remote hits** (from WebRTC):
- `useNoteEvents.jsx` line 164-181: Drums bypass all scheduling, play immediately
- `useNoteEvents.jsx` line 132-157: ULTRA mode also plays immediately
- Both paths use `audioEngine.playNote()` - immediate playback

✅ **No scheduling delays for drums** - This is correct!

## Root Cause Identified

**Primary Issue**: UI throttling in `DrumPad.jsx` - the `activePads` Set blocks rapid hits on the same pad within 150ms.

**Secondary Issues**:
1. No polyphony management in `playDrumSound()` - could theoretically create unlimited nodes
2. Drum envelopes might be too long for very fast patterns (some drums have 0.3-0.4s decay)
3. No voice tracking/cleanup

## Next Steps

1. Remove UI throttling in `DrumPad.jsx` - allow rapid hits
2. Add polyphony management to `playDrumSound()` - track active voices, implement voice stealing
3. Optimize drum envelopes for fast patterns - shorter decay times
4. Add DEBUG_DRUMS logging for polyphony inspection

