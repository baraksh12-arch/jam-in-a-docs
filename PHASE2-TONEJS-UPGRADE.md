# Phase 2: Audio Engine Upgrade with Tone.js
**Date:** Current Session  
**Status:** ✅ Complete

---

## 📋 Summary

Successfully upgraded the audio engine to use Tone.js while maintaining full backward compatibility with the existing raw Web Audio API implementation. All instruments now have Tone.js implementations that shadow (run alongside) the existing code.

---

## ✅ Completed Tasks

### 1. Tone.js Installation
- ✅ Installed `tone` package via npm
- ✅ No breaking changes to existing dependencies

### 2. Modular Instrument Files Created

#### `src/lib/instruments/drums.js`
- ✅ Uses `Tone.Sampler` with drum kit samples
- ✅ Maps drum pad IDs (kick, snare, hihat, etc.) to MIDI notes
- ✅ Exposes `triggerNote(note, time, velocity)` method
- ✅ Preloads samples on initialization
- ✅ Error handling for missing samples

#### `src/lib/instruments/piano.js`
- ✅ Uses `Tone.Sampler` with multi-sample piano (C2-C6)
- ✅ Automatic pitch-shifting between samples
- ✅ Exposes `triggerNote(note, time, velocity)` method
- ✅ Preloads samples on initialization
- ✅ Error handling for missing samples

#### `src/lib/instruments/bass.js`
- ✅ Uses `Tone.MonoSynth` with fat bass settings
- ✅ Lowpass filter with envelope
- ✅ Exposes `triggerNote(note, time, velocity)` method
- ✅ Optimized for low-end frequencies (E1-E3)

#### `src/lib/instruments/guitar.js`
- ✅ Uses `Tone.Synth` with plucked string characteristics
- ✅ `Tone.Distortion` effect (30% wet)
- ✅ `Tone.Reverb` effect (20% wet)
- ✅ Exposes `triggerNote(note, time, velocity)` method
- ✅ Effects chain: synth → distortion → reverb → destination

### 3. Instrument Manager (`src/lib/instruments/index.js`)
- ✅ Centralized initialization system
- ✅ `initAllInstruments()` - Initializes all instruments in parallel
- ✅ `triggerNote(instrument, note, time, velocity)` - Unified API
- ✅ `setInstrumentVolume(instrument, volume)` - Volume control
- ✅ Time conversion utilities (AudioContext ↔ Tone.Transport)
- ✅ Automatic Tone.Transport startup
- ✅ Cleanup/disposal methods

### 4. Integration into `useAudioEngine`
- ✅ Tone.js initialization runs alongside raw Web Audio API
- ✅ `playNote()` uses Tone.js if available, falls back to raw Web Audio
- ✅ `playNoteAt()` uses Tone.js if available, falls back to raw Web Audio
- ✅ `setInstrumentVolume()` syncs with both systems
- ✅ Backward compatibility maintained - old code still works
- ✅ Graceful fallback if Tone.js initialization fails

---

## 🏗️ Architecture

### Dual-Path System
```
playNote() / playNoteAt()
    ├─→ Tone.js Path (if enabled & ready)
    │   └─→ ToneInstruments.triggerNote()
    │       ├─→ drums.triggerNote()
    │       ├─→ piano.triggerNote()
    │       ├─→ bass.triggerNote()
    │       └─→ guitar.triggerNote()
    │
    └─→ Raw Web Audio API Path (fallback)
        ├─→ playDrumSound()
        ├─→ playBassSynth()
        ├─→ playEPianoSynth()
        └─→ playGuitarSynth()
```

### Initialization Flow
1. `useAudioEngine` mounts
2. Raw Web Audio API initialized (existing code)
3. Tone.js instruments initialized in parallel
4. Samples preloaded
5. Tone.Transport started
6. Both systems ready - Tone.js takes priority

---

## 📁 File Structure

```
src/
├── lib/
│   └── instruments/
│       ├── index.js          # Instrument manager
│       ├── drums.js          # Tone.Sampler for drums
│       ├── piano.js          # Tone.Sampler for piano
│       ├── bass.js           # Tone.MonoSynth for bass
│       └── guitar.js          # Tone.Synth + effects for guitar
└── components/
    └── hooks/
        └── useAudioEngine.jsx # Updated with Tone.js integration
```

---

## 🎹 Instrument Details

### Drums (`Tone.Sampler`)
- **Samples:** Kick, Snare, Hi-Hat, Toms, Crash, Ride, Clap
- **MIDI Mapping:** General MIDI drum map (36-51)
- **Release:** 0.1s (punchy)
- **Attack:** 0s (instant)

### Piano (`Tone.Sampler`)
- **Samples:** Multi-sample (C2, C3, C4, C5, C6)
- **Release:** 1.5s (sustained)
- **Attack:** 0.01s (natural feel)
- **Pitch-shifting:** Automatic between samples

### Bass (`Tone.MonoSynth`)
- **Oscillator:** Sawtooth
- **Filter:** Lowpass (800Hz, Q=2)
- **Filter Envelope:** 200Hz base, 3 octaves
- **Envelope:** ADSR (0.01s / 0.3s / 0.4 / 0.5s)

### Guitar (`Tone.Synth` + Effects)
- **Oscillator:** Sawtooth
- **Envelope:** Fast attack (0.005s) for pluck
- **Distortion:** 40% distortion, 30% wet
- **Reverb:** Room size 0.5, 20% wet

---

## 🔧 Configuration

### Sample URLs
Currently using placeholder URLs from `tonejs.github.io`. These should be replaced with:
- Local samples in `/public/samples/`
- Your own CDN
- Reliable sample hosting service

**Files to update:**
- `src/lib/instruments/drums.js` - `DRUM_SAMPLES` object
- `src/lib/instruments/piano.js` - `PIANO_SAMPLES` object

### Tone.js Enable/Disable
Currently enabled by default. To disable Tone.js and use only raw Web Audio API:
- Set `useToneJsRef.current = false` in `useAudioEngine.jsx`

---

## ✅ Backward Compatibility

### Maintained Features
- ✅ All existing `playNote()` calls work unchanged
- ✅ All existing `playNoteAt()` calls work unchanged
- ✅ Volume control works for both systems
- ✅ Metronome still uses raw Web Audio API
- ✅ AudioContext still available via `getAudioContext()`

### Fallback Behavior
- If Tone.js initialization fails → falls back to raw Web Audio API
- If Tone.js sample loading fails → falls back to raw Web Audio API
- If Tone.js triggerNote() throws error → falls back to raw Web Audio API

---

## 🧪 Testing Checklist

- [x] Tone.js installed successfully
- [x] All instrument modules created
- [x] Instrument manager created
- [x] Integration into useAudioEngine complete
- [x] No linter errors
- [x] Backward compatibility maintained
- [ ] Manual testing: Play each instrument
- [ ] Manual testing: Verify scheduled playback works
- [ ] Manual testing: Verify volume control works
- [ ] Manual testing: Verify fallback to raw Web Audio API

---

## 🚀 Next Steps (Phase 3)

Ready to proceed to **Phase 3: Shared Clock Sync**:
- Implement server-side clock synchronization
- Add time offset calculation
- Periodic clock sync updates
- Unified `syncedNow()` function

---

## 📝 Notes

1. **Sample Loading:** Current sample URLs may not work. Replace with your own samples before production.

2. **Tone.Transport:** Automatically started by instrument manager. All scheduled playback uses Tone.Transport time.

3. **Time Conversion:** Utilities provided in `instruments/index.js` for converting between AudioContext time and Tone.Transport time.

4. **Performance:** Tone.js instruments are initialized in parallel for faster loading.

5. **Error Handling:** Graceful degradation - if Tone.js fails, raw Web Audio API continues to work.

---

**End of Phase 2 Report**

