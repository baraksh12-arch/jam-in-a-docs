# Step 0: Repository Audit & Production Readiness Plan
**Date:** Current Session  
**Status:** ✅ Complete - Ready for Step 1

---

## 📋 Executive Summary

**Jam in a Docs** is a real-time multiplayer music jam web app with:
- **Frontend:** React 18 + Vite 6 + TailwindCSS
- **Backend:** Supabase (PostgreSQL + Realtime + Auth)
- **Real-time Transport:** WebRTC DataChannels (P2P mesh) + Supabase Realtime (signaling)
- **Audio Engine:** Tone.js v15 (recently integrated) + Web Audio API fallback
- **Deployment:** Vercel (based on `vercel.json`)

**Current State:** Functional but needs production polish, mobile optimization, and sound quality improvements to match Google Shared Piano standards.

---

## 🏗️ Architecture Map

### Frontend Framework
- **React 18.2** with functional components + hooks
- **Vite 6.1** for build tooling
- **React Router 7.2** for routing
- **TailwindCSS 3.4** for styling
- **Radix UI** components (shadcn/ui style)

### Backend Stack
- **Supabase** (PostgreSQL + Realtime + Auth)
- **Tables:** `rooms`, `players`, `chat_messages`, `note_events` (deprecated)
- **Realtime Channels:**
  - `webrtc:${roomId}` - WebRTC signaling (offer/answer/ICE)
  - `jam:${roomId}:crowd` - Crowd distribution (not yet implemented)

### Real-time Transport
- **WebRTC DataChannels** (P2P mesh topology)
  - Full mesh: Each player connects to all other players
  - Unordered, unreliable channels (`ordered: false, maxRetransmits: 0`)
  - Ultra-low latency path for DRUMS (bypasses bundler)
  - Event bundling for other instruments (8ms ULTRA / 16ms SYNCED)
- **Supabase Realtime** for signaling and room state

### Audio Engine Architecture

**Location:** `src/lib/instruments/` + `src/components/hooks/useAudioEngine.jsx`

**Current Implementation:**
- ✅ **Tone.js v15** integrated (recently upgraded from raw Web Audio API)
- ✅ **Modular instruments:** `drums.js`, `piano.js`, `bass.js`, `guitar.js`
- ✅ **Tone.Transport** for synchronized timing
- ✅ **Sample-based:** Drums (local samples), Piano (CDN samples), Bass (local samples)
- ✅ **Synthesis-based:** Drums (electronic mode), Bass (synth mode), Guitar (synth)
- ⚠️ **Fallback:** Raw Web Audio API still exists in `useAudioEngine.jsx` (dual path)

**Instrument Details:**
1. **DRUMS** (`src/lib/instruments/drums.js`)
   - ✅ A/B switching: **Acoustic (Sampled)** / **Electric (Synth)**
   - Sampled: Tone.Sampler with local `/samples/drums/` files
   - Electronic: Tone.MembraneSynth + NoiseSynth
   - Polyphony: Max 32 voices with voice stealing

2. **BASS** (`src/lib/instruments/bass.js`)
   - ✅ A/B switching: **Synth** / **Sampled**
   - Synth: Tone.MonoSynth (fat analog-style)
   - Sampled: Tone.Sampler with local `/samples/bass/` files

3. **EP (Electric Piano)** (`src/lib/instruments/piano.js`)
   - ❌ **Missing A/B switching** (only Electric Piano, no Upright Piano)
   - Current: Tone.Sampler with CDN samples (Salamander piano)
   - Needs: Upright Piano variant

4. **GUITAR** (`src/lib/instruments/guitar.js`)
   - ❌ **Missing A/B switching** (only Electric, no Nylon)
   - Current: Tone.Synth + Distortion + Reverb (electric)
   - Needs: Nylon string variant

### State Management
- **React Hooks** (no Redux/Zustand)
- **Custom Hooks:**
  - `useRoomState.jsx` - Room/player state (Supabase subscriptions)
  - `useWebRTC.jsx` - WebRTC connection management
  - `useNoteEvents.jsx` - Note event sending/receiving
  - `useAudioEngine.jsx` - Audio engine wrapper
  - `useUserIdentity.jsx` - User identity (localStorage)

### Clock Synchronization
**Location:** `src/lib/clockSync.js` + `src/lib/time/syncedNow.js`

**Current Implementation:**
- ✅ **Kalman-filtered ping/pong** (every 500ms per peer)
- ✅ **Time offset calculation** (`timeOffset = serverTime - clientTime`)
- ✅ **Adaptive sync interval** (3-5s based on jitter)
- ✅ **Fallback to local time** if sync fails
- ✅ **Tone.Transport scheduling** via `src/lib/audio/scheduler.js`

### Event Scheduling
**Location:** `src/lib/audio/scheduler.js` + `src/lib/audio/eventBufferManager.js`

**Current Implementation:**
- ✅ **Timestamp-based scheduling** (uses `event.timestamp + LATENCY_BUFFER_MS`)
- ✅ **Late note filtering** (drops if `playAt < syncedNow()`)
- ✅ **Event deduplication** (senderId + timestamp + type + note)
- ✅ **Jitter tracking** (min, max, average)
- ✅ **Overlapping note prevention** (10ms minimum between same note)

---

## 🎯 Major User Flows

### 1. Join Room Flow
**Path:** `Landing.jsx` → `Room.jsx`

1. User visits landing page
2. Creates room OR joins with code
3. `useUserIdentity` generates/retrieves user ID (localStorage)
4. `useRoomState` subscribes to room/players
5. `useWebRTC` establishes P2P connections
6. User sees instrument selection UI

**Status:** ✅ Working

### 2. Claim Instrument Flow
**Path:** `Room.jsx` → `InstrumentSlot.jsx` → `useRoomState.claimMyInstrument()`

1. User clicks "Claim Instrument"
2. `claimMyInstrument()` updates Supabase `players` table
3. `ClaimSyncManager` broadcasts claim event via WebRTC
4. All peers receive claim event → UI updates
5. WebRTC connections refresh (silent, <200ms)
6. User sees instrument panel

**Status:** ✅ Working (recently improved with WebRTC broadcast)

### 3. Switch A/B Sound Flow
**Path:** `InstrumentPanel.jsx` → Instrument module (e.g., `bass.js`)

1. User toggles A/B switch (radio buttons)
2. `setBassMode()` / `setDrumKitMode()` updates instrument state
3. Next note uses new sound engine
4. **Issue:** No visual feedback during switch, potential for stuck notes

**Status:** ⚠️ Partially working (Drums/Bass only, EP/Guitar missing)

### 4. Play Notes Flow
**Path:** `InstrumentPanel` → `sendNote()` → `useNoteEvents` → `WebRTCManager` → Remote peers

**Sending:**
1. User presses key/pad
2. `audioEngine.playNote()` plays locally (immediate)
3. `sendNote()` creates jam event with `timestamp` (syncedNow())
4. **DRUMS:** Bypasses bundler, sends immediately
5. **Other instruments:** Queued in bundler (8ms ULTRA / 16ms SYNCED)

**Receiving:**
1. WebRTC DataChannel receives event
2. **DRUMS:** Plays immediately (bypasses scheduling)
3. **Other instruments:** Scheduled via `scheduleNote()` using timestamp
4. `Tone.Transport.scheduleOnce()` triggers note at target time

**Status:** ✅ Working (recently improved with timestamp scheduling)

### 5. Watch Crowd Flow
**Path:** Not yet implemented

**Expected Flow:**
1. User joins as listener (`is_player = FALSE`)
2. Host player broadcasts jam events to `jam:${roomId}:crowd` channel
3. Listeners receive events via Supabase Realtime
4. Listeners synthesize audio locally

**Status:** ❌ Not implemented (schema exists, code missing)

### 6. Chat Flow
**Path:** `ChatPanel.jsx` → Supabase `chat_messages` table

1. User types message
2. Message inserted into `chat_messages` table
3. Supabase Realtime subscription broadcasts to all users
4. UI updates with new message

**Status:** ✅ Working

### 7. Leave/Rejoin Flow
**Path:** `Room.jsx` → `useWebRTC.destroy()` → `useRoomState`

1. User closes tab / navigates away
2. `useWebRTC` cleans up connections
3. Supabase subscription detects player removal
4. Other peers see player leave
5. On rejoin: `previousInstrumentRef` attempts to restore claim

**Status:** ✅ Working (recently improved with auto-restore)

---

## 🐛 Bugs & Risks

### Critical Issues

1. **Missing A/B Sound Switching for EP and Guitar**
   - **Risk:** Product requirement not met
   - **Impact:** Users cannot switch EP (Electric/Upright) or Guitar (Nylon/Electric)
   - **Location:** `src/lib/instruments/piano.js`, `src/lib/instruments/guitar.js`
   - **Fix:** Add mode switching similar to Bass/Drums

2. **Mobile Touch Handling Issues**
   - **Risk:** Double notes, scroll interference, touch latency
   - **Impact:** Poor mobile UX, unplayable on phones
   - **Location:** `src/components/instruments/PianoKeyboard.jsx`, `src/components/instruments/DrumPad.jsx`
   - **Symptoms:**
     - `onTouchStart` + `onMouseDown` both fire (double notes)
     - No `touch-action: none` (scroll interference)
     - No `preventDefault()` on touch (browser gestures interfere)
   - **Fix:** Add proper touch event handling, prevent default, use `touch-action: none`

3. **Sound Quality Not Production-Ready**
   - **Risk:** Sounds don't match Google Shared Piano quality
   - **Impact:** Poor user experience, not "elite Apple/Google level"
   - **Location:** All instrument modules
   - **Issues:**
     - Piano samples from CDN (may be slow/blocked)
     - Guitar synthesis too simple (needs better Karplus-Strong)
     - Bass samples limited (only 3 notes)
     - No velocity mapping for samples
   - **Fix:** Upgrade samples, improve synthesis, add velocity mapping

4. **A/B Switching Can Cause Stuck Notes**
   - **Risk:** Switching modes mid-note leaves notes playing
   - **Impact:** Audio glitches, stuck notes
   - **Location:** `src/lib/instruments/bass.js`, `src/lib/instruments/drums.js`
   - **Fix:** Stop all active notes before switching, add visual feedback

### High Priority Issues

5. **Mobile Layout Not Optimized**
   - **Risk:** UI doesn't adapt well to phones
   - **Impact:** Poor mobile UX
   - **Location:** `src/pages/Room.jsx`, `src/components/room/InstrumentPanel.jsx`
   - **Issues:**
     - Instrument grid not responsive (4 columns on mobile)
     - Hit targets too small (<44px)
     - No orientation handling
     - Chat panel takes too much space
   - **Fix:** Responsive grid, larger hit targets, orientation-aware layout

6. **No Rate Limiting / Abuse Protection**
   - **Risk:** Server abuse, DoS attacks
   - **Impact:** Service degradation, high costs
   - **Location:** No rate limiting implemented
   - **Fix:** Add rate limiting to Supabase Edge Functions or client-side throttling

7. **Sample Loading Can Fail Silently**
   - **Risk:** Instruments don't play if samples fail to load
   - **Impact:** Broken instruments, poor UX
   - **Location:** `src/lib/instruments/piano.js`, `src/lib/instruments/drums.js`
   - **Fix:** Better error handling, fallback to synthesis, loading indicators

8. **No Error Boundaries for Audio Failures**
   - **Risk:** Audio errors crash entire app
   - **Impact:** Poor UX, app becomes unusable
   - **Location:** `src/components/ErrorBoundary.jsx` exists but may not catch audio errors
   - **Fix:** Add audio-specific error boundaries, graceful degradation

### Medium Priority Issues

9. **Clock Sync Drift Not Monitored**
   - **Risk:** Long sessions drift out of sync
   - **Impact:** Notes become desynchronized over time
   - **Location:** `src/lib/clockSync.js`
   - **Fix:** Add periodic drift measurement, alert if >100ms over 5 minutes

10. **No Production Logging**
    - **Risk:** Can't debug production issues
    - **Impact:** Hard to diagnose problems
    - **Location:** No logging endpoint
    - **Fix:** Add structured logging, analytics hooks

11. **Chat Not XSS-Safe**
    - **Risk:** XSS attacks via chat
    - **Impact:** Security vulnerability
    - **Location:** `src/components/chat/ChatPanel.jsx`
    - **Fix:** Sanitize chat input, escape HTML

12. **No Accessibility Features**
    - **Risk:** App not accessible to screen readers
    - **Impact:** Excludes users with disabilities
    - **Location:** All UI components
    - **Fix:** Add ARIA labels, keyboard navigation, focus management

### Low Priority Issues

13. **No MIDI Controller Support**
    - **Risk:** Users can't use MIDI controllers
    - **Impact:** Limited input options
    - **Location:** No WebMIDI integration
    - **Fix:** Add WebMIDI API support

14. **No Audio Compression for WebRTC**
    - **Risk:** High bandwidth usage
    - **Impact:** Poor performance on slow connections
    - **Location:** WebRTC DataChannels (text only, not audio)
    - **Fix:** N/A (not applicable - we send events, not audio)

15. **No Web Workers for Audio Processing**
    - **Risk:** Audio processing blocks main thread
    - **Impact:** UI jank during heavy audio
    - **Location:** All audio processing
    - **Fix:** Move audio processing to Web Workers (future enhancement)

---

## 📊 Production Readiness Plan

### Phase 1: Stability & Correctness (Must-Fix)
**Goal:** Fix critical bugs, ensure core flows work reliably

**Tasks:**
1. ✅ Fix mobile touch handling (prevent double notes, scroll interference)
2. ✅ Add A/B switching for EP (Electric/Upright Piano)
3. ✅ Add A/B switching for Guitar (Nylon/Electric)
4. ✅ Fix stuck notes on A/B switch (stop all active notes)
5. ✅ Add error boundaries for audio failures
6. ✅ Improve sample loading (error handling, fallbacks, loading indicators)
7. ✅ Add XSS protection for chat (sanitize input)

**Success Criteria:**
- No double notes on mobile
- All instruments have A/B switching
- No stuck notes when switching
- Graceful degradation on audio errors
- Chat is XSS-safe

---

### Phase 2: UX Polish & Mobile Perfection
**Goal:** Make mobile experience excellent, fix layout issues

**Tasks:**
1. ✅ Responsive instrument grid (1-2 columns on mobile)
2. ✅ Larger hit targets (min 44px on mobile)
3. ✅ Orientation handling (portrait/landscape)
4. ✅ Mobile-optimized chat panel (collapsible, bottom sheet)
5. ✅ Prevent accidental double-notes (debounce, touch-action)
6. ✅ Add loading states for all async operations
7. ✅ Improve error messages (user-friendly, actionable)

**Success Criteria:**
- Perfect mobile layout (all screen sizes)
- No accidental double notes
- Smooth touch interactions
- Clear loading/error states

---

### Phase 3: Sound Quality + Performance
**Goal:** Match Google Shared Piano sound quality, optimize performance

**Tasks:**
1. ✅ Upgrade piano samples (host locally, better quality)
2. ✅ Improve guitar synthesis (better Karplus-Strong, more realistic)
3. ✅ Expand bass samples (more notes, better velocity mapping)
4. ✅ Add velocity mapping to all sampled instruments
5. ✅ Optimize sample loading (lazy load, preload critical samples)
6. ✅ Add audio warmup for faster first note
7. ✅ Monitor and optimize CPU usage (target <30% per client)

**Success Criteria:**
- Sounds match Google Shared Piano quality
- All samples load reliably
- First note latency <50ms
- CPU usage <30% per client

---

### Phase 4: Security & Scaling Hardening
**Goal:** Secure the app, handle scale (100 watchers + players)

**Tasks:**
1. ✅ Add rate limiting (client-side + server-side)
2. ✅ Add input validation (all user inputs)
3. ✅ Add CSRF protection (if needed)
4. ✅ Optimize Supabase queries (indexes, pagination)
5. ✅ Add connection pooling (if needed)
6. ✅ Add monitoring/alerting (error tracking, performance)
7. ✅ Add structured logging (analytics hooks)

**Success Criteria:**
- Rate limiting prevents abuse
- All inputs validated
- Handles 100+ concurrent users
- Monitoring catches issues early

---

### Phase 5: Final QA + Release Checklist
**Goal:** Final polish, comprehensive testing, release readiness

**Tasks:**
1. ✅ Accessibility audit (ARIA labels, keyboard nav, screen readers)
2. ✅ Cross-browser testing (Chrome, Firefox, Safari, Edge)
3. ✅ Mobile device testing (iOS, Android, various screen sizes)
4. ✅ Performance testing (4 clients, 10 minutes, stress test)
5. ✅ Security audit (penetration testing, XSS, CSRF)
6. ✅ Documentation (user guide, API docs)
7. ✅ Release checklist (env vars, deployment, monitoring)

**Success Criteria:**
- WCAG 2.1 AA compliance
- Works on all major browsers
- Works on all major mobile devices
- Handles stress tests
- Security audit passes
- Documentation complete

---

## 🎯 Step 1 TODO List (Max 5 Tasks)

Based on Phase 1 priorities, here are the first 5 tasks:

### Task 1: Fix Mobile Touch Handling
**Priority:** Critical  
**Files:** `src/components/instruments/PianoKeyboard.jsx`, `src/components/instruments/DrumPad.jsx`

**Changes:**
- Add `touch-action: none` CSS to prevent scroll
- Use `onTouchStart` with `preventDefault()` to stop browser gestures
- Prevent `onMouseDown` from firing after `onTouchStart` (use flag)
- Add debounce/throttle to prevent rapid double-taps

**Test:**
- Open on mobile device
- Play notes - should not trigger double notes
- Scroll should not interfere with playing
- No accidental note triggers during movement

---

### Task 2: Add A/B Switching for Electric Piano
**Priority:** Critical  
**Files:** `src/lib/instruments/piano.js`, `src/components/room/InstrumentPanel.jsx`

**Changes:**
- Add `EP_MODE_ELECTRIC` and `EP_MODE_UPRIGHT` constants
- Create two Tone.Sampler instances (electric piano + upright piano samples)
- Add `setEPMode()` and `getEPMode()` functions
- Add UI toggle in `InstrumentPanel.jsx` (similar to Bass/Drums)
- Stop all active notes before switching

**Test:**
- Toggle EP mode - should switch sounds instantly
- No stuck notes when switching
- Both modes sound distinct and realistic

---

### Task 3: Add A/B Switching for Guitar
**Priority:** Critical  
**Files:** `src/lib/instruments/guitar.js`, `src/components/room/InstrumentPanel.jsx`

**Changes:**
- Add `GUITAR_MODE_NYLON` and `GUITAR_MODE_ELECTRIC` constants
- Create two synth instances (nylon string + electric)
- Nylon: Softer attack, less distortion, more reverb
- Electric: Current implementation (distortion + reverb)
- Add `setGuitarMode()` and `getGuitarMode()` functions
- Add UI toggle in `InstrumentPanel.jsx`
- Stop all active notes before switching

**Test:**
- Toggle Guitar mode - should switch sounds instantly
- No stuck notes when switching
- Nylon sounds soft/acoustic, Electric sounds distorted

---

### Task 4: Fix Stuck Notes on A/B Switch
**Priority:** Critical  
**Files:** `src/lib/instruments/bass.js`, `src/lib/instruments/drums.js`, `src/lib/instruments/piano.js`, `src/lib/instruments/guitar.js`

**Changes:**
- Add `stopAllNotes()` function to each instrument
- Call `stopAllNotes()` before switching modes
- Ensure all active voices are released
- Add visual feedback (loading state) during switch

**Test:**
- Play notes, switch mode mid-note - no stuck notes
- All notes stop cleanly before switch
- Visual feedback shows switch in progress

---

### Task 5: Improve Sample Loading & Error Handling
**Priority:** High  
**Files:** `src/lib/instruments/piano.js`, `src/lib/instruments/drums.js`, `src/lib/instruments/bass.js`

**Changes:**
- Add loading indicators (show "Loading samples..." in UI)
- Better error handling (fallback to synthesis if samples fail)
- Retry logic for failed sample loads
- Progress tracking (show % loaded)
- Graceful degradation (use synthesis if samples unavailable)

**Test:**
- Slow network - should show loading state
- Failed sample load - should fallback to synthesis
- All samples load - should show ready state
- Partial load - should work with available samples

---

## 📝 Summary

**Architecture:** ✅ Solid foundation (React + Supabase + WebRTC + Tone.js)  
**Core Flows:** ✅ Working (join, claim, play, chat)  
**Critical Bugs:** ⚠️ 4 critical issues (mobile touch, missing A/B switches, stuck notes, sound quality)  
**Production Ready:** ❌ Not yet (needs Phase 1-5 work)

**Next Step:** Proceed with Step 1 (5 tasks above) after user approval.

---

**End of Step 0 Audit**

