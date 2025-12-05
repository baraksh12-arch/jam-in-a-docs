# DRUM Fix - Manual Test Plan

## Overview

This document describes how to manually test the DRUMS instrument fixes for fast patterns (16th notes and denser).

## Test Setup

### Prerequisites
- Two browser windows/tabs (or two machines on the same network)
- Access to the JAM IN A DOCS application
- A test room created

### Initial Setup
1. Open Browser A and Browser B
2. Both browsers join the same room
3. Browser A: Claim DRUMS instrument
4. Browser B: Claim a different instrument (e.g., GUITAR or EP)

---

## Test 1: Local-Only Test (Single Browser)

**Purpose**: Verify that local drum playback handles fast patterns without missing hits.

### Test Procedure

1. **Single Hits Test**
   - In Browser A (DRUMS), click each pad individually:
     - Kick (Q key)
     - Snare (W key)
     - Hi-Hat (E key)
     - Tom 1 (R key)
     - Tom 2 (A key)
     - Crash (S key)
     - Ride (D key)
     - Clap (F key)
   - **Expected**: Each hit should sound clearly, no missing hits

2. **Fast 16th Notes on Hi-Hat**
   - Click the Hi-Hat pad (E key) rapidly, or hold down the E key
   - Try to achieve 16th note speed (4 hits per beat at 120 BPM = ~125ms between hits)
   - **Expected**: 
     - All hits should sound - no "swallowed" hits
     - No weird choking or "only every second hit" behavior
     - Each hit should be distinct and audible

3. **Snare Rolls**
   - Rapidly click the Snare pad (W key) or hold down W
   - Try fast rolls (multiple hits in quick succession)
   - **Expected**:
     - All hits should sound
     - No missing hits even at very fast speeds
     - Each hit should be clear and distinct

4. **Mixed Fast Patterns**
   - Play fast patterns mixing different drums:
     - Kick + Hi-Hat alternating rapidly
     - Snare + Hi-Hat rolls
     - Complex patterns with multiple drums
   - **Expected**: All hits should sound, no missing notes

### Success Criteria
- ✅ All single hits sound correctly
- ✅ Fast 16th notes on hi-hat: no missing hits
- ✅ Snare rolls: all hits audible
- ✅ Mixed fast patterns: no missing notes

---

## Test 2: Two-Browser Test (WebRTC)

**Purpose**: Verify that fast drum patterns work correctly over WebRTC, with both local and remote playback.

### Test Procedure

1. **Fast Drum Patterns on Browser A**
   - In Browser A (DRUMS), play fast patterns:
     - Fast 16th notes on hi-hat
     - Snare rolls
     - Mixed fast patterns
   - **Listen in Browser A (local)**:
     - **Expected**: All hits should sound immediately, no missing hits
   - **Listen in Browser B (remote)**:
     - **Expected**: 
       - All hits should be heard (subject to network latency)
       - No missing hits due to the audio engine
       - Pattern should be complete, just delayed by network latency

2. **Bidirectional Test**
   - Browser A plays fast drum patterns
   - Browser B plays notes on their instrument (GUITAR/EP) simultaneously
   - **Expected**: 
     - All drum hits from A should be heard in both browsers
     - No interference between instruments
     - No missing drum hits

3. **Very Dense Patterns**
   - Play extremely fast patterns (faster than 16th notes, approaching 32nd notes)
   - **Expected**: 
     - Audio engine should handle it (may use voice stealing if needed)
     - No crashes or audio glitches
     - Pattern should be audible (may lose some hits if exceeding MAX_DRUM_VOICES, but should gracefully degrade)

### Success Criteria
- ✅ Browser A hears all local hits immediately
- ✅ Browser B hears all remote hits (subject to network latency only)
- ✅ No missing hits due to audio engine issues
- ✅ Bidirectional playback works correctly
- ✅ Very dense patterns handled gracefully

---

## Test 3: Regression Test (Other Instruments)

**Purpose**: Ensure that fixes to DRUMS don't break other instruments.

### Test Procedure

1. **BASS Test**
   - Claim BASS in Browser A
   - Play notes on the piano keyboard
   - **Expected**: BASS should play normally, no regressions

2. **EP Test**
   - Claim EP in Browser A
   - Play notes on the piano keyboard
   - **Expected**: EP should play normally, no regressions

3. **GUITAR Test**
   - Claim GUITAR in Browser A
   - Play notes on the piano keyboard
   - **Expected**: GUITAR should play normally, no regressions

### Success Criteria
- ✅ All other instruments work as before
- ✅ No audio glitches or missing notes on other instruments

---

## Debug Mode Testing (Optional)

If you want to inspect polyphony behavior:

1. **Enable DEBUG_DRUMS**
   - Open browser console
   - In `src/components/hooks/useAudioEngine.jsx`, change:
     ```javascript
     const DEBUG_DRUMS = false;
     ```
     to:
     ```javascript
     const DEBUG_DRUMS = true;
     ```
   - Reload the page

2. **Play Fast Patterns**
   - Play fast 16th notes or rolls
   - Watch the console for logs:
     - `[Drums] New voice` - when a new drum voice is created
     - `[Drums] Voice stolen` - when voice stealing occurs (if exceeding MAX_DRUM_VOICES)

3. **Expected Console Output**
   - Should see "New voice" logs for each hit
   - If playing very fast, may see "Voice stolen" logs (this is normal and expected)
   - Active voice count should stay reasonable (under MAX_DRUM_VOICES = 32)

---

## Known Limitations

1. **Network Latency**: Remote playback will always have network latency (typically 20-100ms). This is expected and not a bug.

2. **Voice Stealing**: If playing extremely fast (exceeding 32 simultaneous voices), older voices will be stolen. This is intentional to prevent unbounded node growth.

3. **Visual Feedback**: The visual feedback (pad highlight) may not keep up with very fast hits. This is cosmetic only and doesn't affect audio playback.

---

## Troubleshooting

### Issue: Still missing hits on fast patterns
- **Check**: Is DEBUG_DRUMS enabled? Check console for voice creation logs
- **Check**: Are you testing in ULTRA mode? (should be enabled by default)
- **Check**: Browser console for any errors

### Issue: Audio glitches or distortion
- **Check**: Volume levels - may need to reduce master volume
- **Check**: Too many simultaneous voices - try slower patterns
- **Check**: Browser audio context state - ensure it's not suspended

### Issue: Remote playback missing hits
- **Check**: Network connection quality
- **Check**: WebRTC connection status
- **Check**: Browser console for WebRTC errors

---

## Summary

After completing all tests, you should have verified:
1. ✅ Local drum playback handles fast patterns correctly
2. ✅ Remote drum playback works over WebRTC
3. ✅ No regressions in other instruments
4. ✅ Polyphony management works (if DEBUG_DRUMS enabled)

If all tests pass, the DRUM fix is successful! 🎉

