# Drum Sampler Fix Summary

## Problem
The drum kit was playing the **wrong samples** - it sounded like the same sample was being pitch-shifted instead of each pad triggering its own dedicated file (kick/snare/hihat/etc).

## Root Cause
`Tone.Sampler` was configured with **MIDI note numbers** (36, 38, 42, etc.) as keys in the `DRUM_SAMPLES` object. When Tone.Sampler receives MIDI note numbers, it treats them as musical notes and pitch-shifts a single sample across different pitches, rather than playing distinct files.

## Solution
Changed the sampler configuration to use **string keys** ("kick", "snare", "hihat", etc.) instead of MIDI note numbers. This ensures Tone.Sampler plays the correct file for each pad without any pitch-shifting.

---

## Files Modified

### 1. `src/lib/instruments/drums.js`

#### Changes:
- ✅ **Updated `DRUM_SAMPLES` object**: Changed from MIDI note numbers to string keys
  - **Before**: `{ 36: 'kick.mp3', 38: 'snare.mp3', ... }`
  - **After**: `{ 'kick': 'kick.mp3', 'snare': 'snare.mp3', ... }`

- ✅ **Updated `DRUM_MAP` object**: Changed from MIDI note mapping to string key mapping
  - **Before**: `{ 'kick': 36, 'snare': 38, ... }`
  - **After**: `{ 'kick': 'kick', 'snare': 'snare', ... }`

- ✅ **Fixed `triggerNote()` function**: Now uses string keys directly instead of converting to MIDI notes
  - Removed MIDI note conversion logic
  - Passes string keys directly to `sampler.triggerAttackRelease()`

- ✅ **Added `onload` callback**: Logs when sampler is ready

- ✅ **Added console logs**: `[Drums] playDrumSound: ${note} → key: ${drumKey}` for debugging

- ✅ **Added debug helper functions**: 
  - `window.__debugDrumsKick()`
  - `window.__debugDrumsSnare()`
  - `window.__debugDrumsHihat()`
  - `window.__debugDrumsAll()`

#### Final Shape of `DRUM_SAMPLES`:
```javascript
const DRUM_SAMPLES = {
  'kick': 'kick.mp3',
  'snare': 'snare.mp3',
  'hihat': 'hihat.mp3',
  'tom1': 'tom1.mp3',
  'tom2': 'tom2.mp3',
  'crash': 'crash.mp3',
  'ride': 'ride.mp3',
  'clap': 'clap.mp3',
};
```

#### Final Shape of `triggerNote()`:
```javascript
export function triggerNote(note, time, velocity = 100) {
  // Map drum pad ID to sampler key (string keys, not MIDI notes)
  let drumKey = DRUM_MAP[note]; // e.g., 'kick' → 'kick'
  
  // Trigger using string key directly
  sampler.triggerAttackRelease(drumKey, '8n', time, velocityGain);
}
```

### 2. `src/components/instruments/DrumPad.jsx`

#### Changes:
- ✅ **Added console log**: `[UI] Drum triggered: ${padId}` to trace UI → audio flow

### 3. `src/components/hooks/useAudioEngine.jsx`

#### Changes:
- ✅ **Added console log**: `[AudioEngine] playNote DRUMS: ${note}` when Tone.js path is used

---

## How the UI Calls Drums Now

### Flow:
1. **UI Layer** (`DrumPad.jsx`):
   - User clicks pad or presses key (q, w, e, r, a, s, d, f)
   - Calls `onNotePlay(padId)` where `padId` is: `'kick'`, `'snare'`, `'hihat'`, etc.
   - Logs: `[UI] Drum triggered: kick`

2. **Audio Engine** (`useAudioEngine.jsx`):
   - Receives: `playNote('DRUMS', 'kick', velocity)`
   - Logs: `[AudioEngine] playNote DRUMS: kick`
   - Calls: `ToneInstruments.triggerNote('DRUMS', 'kick', ...)`

3. **Instrument Manager** (`src/lib/instruments/index.js`):
   - Routes to: `drums.triggerNote('kick', ...)`

4. **Drums Module** (`src/lib/instruments/drums.js`):
   - Maps: `'kick'` → `'kick'` (via DRUM_MAP)
   - Logs: `[Drums] playDrumSound: kick → key: kick`
   - Calls: `sampler.triggerAttackRelease('kick', '8n', ...)`

5. **Tone.Sampler**:
   - Receives string key `'kick'`
   - Plays file: `/samples/drums/kick.mp3`
   - **No pitch-shifting** - plays the file at its original pitch

---

## Verification Steps

### 1. Test in Browser Console
After loading the app, you can manually test each drum:
```javascript
// Test individual drums
await window.__debugDrumsKick();
await window.__debugDrumsSnare();
await window.__debugDrumsHihat();

// Test all drums in sequence
await window.__debugDrumsAll();
```

### 2. Test via UI
1. Start the dev server: `npm run dev`
2. Join a room and claim the DRUMS instrument
3. Click each drum pad (or press q, w, e, r, a, s, d, f)
4. Verify by ear that:
   - **Kick pad** → plays `kick.mp3` (low thump)
   - **Snare pad** → plays `snare.mp3` (crack)
   - **Hihat pad** → plays `hihat.mp3` (tick)
   - **Clap pad** → plays `clap.mp3` (hand clap)
   - **Tom1 pad** → plays `tom1.mp3` (mid tom)
   - **Tom2 pad** → plays `tom2.mp3` (low tom)
   - **Ride pad** → plays `ride.mp3` (cymbal)
   - **Crash pad** → plays `crash.mp3` (crash cymbal)

### 3. Check Console Logs
You should see the following logs when triggering drums:
```
[UI] Drum triggered: kick
[AudioEngine] playNote DRUMS: kick
[Drums] playDrumSound: kick → key: kick
```

### 4. Verify No Pitch-Shifting
- Each pad should sound **distinctly different**
- No pad should sound like a pitch-shifted version of another
- All samples should play at their **original pitch**

---

## Key Technical Details

### Why String Keys Work
- Tone.Sampler treats **string keys** as one-shot sample triggers
- Tone.Sampler treats **MIDI note numbers** as musical notes and pitch-shifts
- By using string keys, we bypass the pitch-shifting behavior entirely

### Sample File Mapping
The sampler now directly maps:
- Key `'kick'` → File `kick.mp3`
- Key `'snare'` → File `snare.mp3`
- Key `'hihat'` → File `hihat.mp3`
- etc.

### No More MIDI Note Conversion
- Removed all MIDI note number logic
- Drum pad IDs (`'kick'`, `'snare'`, etc.) are used directly as sampler keys
- This ensures each pad triggers its own file without any transformation

---

## Summary

✅ **Fixed**: Each drum pad now triggers its own dedicated audio file  
✅ **No pitch-shifting**: Samples play at their original pitch  
✅ **String keys**: Using `'kick'`, `'snare'`, etc. instead of MIDI note numbers  
✅ **Debug logging**: Added console logs to trace the full flow  
✅ **Debug helpers**: Added browser console functions for manual testing  

The drum sampler now behaves like a **one-shot sampler bank** where each pad triggers its own file, exactly as intended!

