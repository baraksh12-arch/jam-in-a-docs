# DRUM Fix - Implementation Summary

## Root Cause of Missed Fast Hits

**Primary Issue**: UI throttling in `DrumPad.jsx`
- The `activePads` Set was used to block rapid hits on the same pad within 150ms
- For 16th notes at 120 BPM (125ms between hits), this blocked every other hit
- The blocking logic: `if (pad && !activePads.has(pad.id))` prevented the same pad from being triggered if already "active"

**Secondary Issues**:
1. No polyphony management in `playDrumSound()` - could theoretically create unlimited audio nodes
2. Drum envelopes were too long for very fast patterns (some drums had 0.3-0.4s decay)
3. No voice tracking/cleanup

---

## Changes Made

### 1. Fixed Drum Engine (`src/components/hooks/useAudioEngine.jsx`)

#### Added Polyphony Management
- **MAX_DRUM_VOICES = 32**: Limits simultaneous drum voices to prevent unbounded node growth
- **Voice tracking**: `drumVoicesRef` tracks all active drum voices with their nodes and stop times
- **Voice stealing**: When exceeding MAX_DRUM_VOICES, the oldest voice is stopped and disconnected before creating a new one
- **Automatic cleanup**: Voices are removed from tracking after they stop

#### Optimized Envelopes for Fast Patterns
- **Kick**: Decay reduced from 0.3s → 0.2s, frequency sweep from 0.15s → 0.1s
- **Snare**: Decay reduced from 0.15s → 0.1s, noise buffer from 0.2s → 0.1s
- **Hihat**: Decay reduced from 0.05s → 0.03s, noise buffer from 0.05s → 0.03s
- **Tom**: Decay reduced from 0.3s → 0.2s, frequency sweep from 0.15s → 0.1s
- **Crash**: Slightly reduced from 2s → 1.5s (still long for realism, but allows overlapping hits)

#### ULTRA Mode Integration
- All drums use ultra-fast attack (0.001s) regardless of mode
- Envelopes optimized for immediate playback
- No scheduling delays for drums (already implemented in `useNoteEvents.jsx`)

#### Added DEBUG_DRUMS Logging
- Lightweight logging behind `DEBUG_DRUMS` flag (default: `false`)
- Logs when new voices are created: `[Drums] New voice { type, activeVoices, stopTime }`
- Logs when voices are stolen: `[Drums] Voice stolen { type, activeVoices }`

### 2. Removed UI Throttling (`src/components/instruments/DrumPad.jsx` and `src/components/DrumPad.jsx`)

#### Removed Input Blocking
- **Before**: `if (pad && !activePads.has(pad.id))` blocked rapid hits
- **After**: `if (pad)` - always allows the hit, no blocking
- **Result**: `activePads` is now only used for visual feedback, not input blocking

#### Updated Dependencies
- Removed `activePads` from `useEffect` dependencies (no longer needed for blocking)
- Keyboard handler now allows rapid repeated hits on the same pad

---

## How to Enable DEBUG_DRUMS

To inspect polyphony behavior during fast patterns:

1. Open `src/components/hooks/useAudioEngine.jsx`
2. Find the line:
   ```javascript
   const DEBUG_DRUMS = false;
   ```
3. Change it to:
   ```javascript
   const DEBUG_DRUMS = true;
   ```
4. Reload the page
5. Open browser console (F12 or Cmd+Option+I)
6. Play fast drum patterns
7. Watch for logs:
   - `[Drums] New voice` - when a new drum voice is created
   - `[Drums] Voice stolen` - when voice stealing occurs (if exceeding MAX_DRUM_VOICES)

**Note**: Keep DEBUG_DRUMS disabled in production to avoid console spam.

---

## Technical Details

### Voice Management
- Each drum hit creates a new set of audio nodes (oscillators, buffers, gains)
- All nodes for a hit are tracked in a `voice` object: `{ nodes: [...], stopTime: number, drumType: string }`
- Voices are automatically cleaned up after they stop playing
- When MAX_DRUM_VOICES is exceeded, the oldest voice (earliest stopTime) is stolen

### Envelope Optimization
- All envelopes use exponential ramps for natural decay
- Attack time is 0.001s (ultra-fast) for immediate response
- Decay times optimized for fast patterns while maintaining drum character
- No artificial rate limiting - drums can play as fast as the browser can deliver events

### No Scheduling Delays
- Local hits: Direct call to `playDrumSound()` via `playNote()` - immediate
- Remote hits: Already bypass scheduling in `useNoteEvents.jsx` (lines 164-181)
- ULTRA mode: All instruments play immediately (lines 132-157)

---

## Testing

See `DRUM-FIX-TEST-PLAN.md` for detailed manual testing procedures.

**Quick Test**:
1. Open one browser, claim DRUMS
2. Rapidly click hi-hat pad (E key) or hold E key
3. Verify: All hits should sound, no missing hits
4. Try snare rolls (W key) - should all sound
5. Open second browser, claim different instrument
6. Play fast patterns in first browser
7. Verify: Both browsers hear all hits

---

## Files Modified

1. `src/components/hooks/useAudioEngine.jsx`
   - Added polyphony management
   - Optimized drum envelopes
   - Added DEBUG_DRUMS logging

2. `src/components/instruments/DrumPad.jsx`
   - Removed input blocking logic
   - Updated keyboard handler

3. `src/components/DrumPad.jsx` (duplicate file)
   - Removed input blocking logic
   - Updated keyboard handler

---

## Constraints Maintained

✅ Public hook signatures unchanged (`useAudioEngine`, `useNoteEvents`, `useWebRTC`)
✅ Backend/Supabase/WebRTC bundling untouched
✅ ULTRA vs SYNCED behavior preserved
✅ Other instruments (EP/BASS/GUITAR) unchanged

---

## Expected Results

After these changes:
- ✅ Fast 16th notes on hi-hat: All hits sound
- ✅ Snare rolls: All hits audible
- ✅ Mixed fast patterns: No missing notes
- ✅ WebRTC playback: All remote hits heard (subject to network latency only)
- ✅ No regressions in other instruments
- ✅ Graceful handling of extremely dense patterns (voice stealing if needed)

---

## Summary

The root cause was **UI throttling** blocking rapid hits on the same pad. The fix:
1. Removed input blocking in `DrumPad.jsx`
2. Added polyphony management to prevent unbounded node growth
3. Optimized drum envelopes for fast patterns
4. Added optional debug logging

The DRUMS instrument can now handle very fast patterns (16th notes and denser) both locally and over WebRTC without missing hits or choking.

