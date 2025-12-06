# Phase 5: Jitter Handling & Late Event Filtering Enhancements
**Date:** Current Session  
**Status:** ✅ Complete

---

## 📋 Summary

Successfully implemented robust jitter handling, deduplication, and stale event filtering. The system now prevents double triggers, out-of-order playback, and unnecessary CPU spikes due to network jitter.

---

## ✅ Completed Tasks

### 1. EventBufferManager Module (`lib/audio/eventBufferManager.js`)
- ✅ Sliding buffer of last 300ms of events
- ✅ Event deduplication using `${instrument}-${note}-${timestamp}` key
- ✅ Last play time tracking per instrument
- ✅ Overlapping note prevention (minimum 10ms between same note)
- ✅ Out-of-window filtering (>1.5s in past = stale)
- ✅ Debug counters (dropped duplicates, stale events, jitter stats)
- ✅ Automatic cleanup of old events from buffer

### 2. Integration into Scheduler
- ✅ `scheduleNote()` now calls `EventBufferManager.shouldPlay()` before scheduling
- ✅ Events filtered by buffer manager are dropped early (before scheduling)
- ✅ Combined statistics from scheduler and buffer manager
- ✅ Unified drop rate calculation

### 3. Filtering Layers
- ✅ **Deduplication:** Same event (same instrument-note-timestamp) → drop
- ✅ **Stale filtering:** Event >1.5s in past → drop
- ✅ **Overlapping prevention:** Same note within 10ms → drop
- ✅ **Late filtering:** Event timestamp + buffer < now → drop (from Phase 4)

---

## 🏗️ Architecture

### Event Flow with Filtering

```
Event Arrives
    ↓
EventBufferManager.shouldPlay(event)
    ├─→ Check deduplication (event key in buffer?)
    │   └─→ If duplicate → DROP
    ├─→ Check stale (>1.5s old?)
    │   └─→ If stale → DROP
    ├─→ Check overlapping (same note <10ms ago?)
    │   └─→ If overlapping → DROP
    ├─→ Calculate jitter
    ├─→ Add to buffer
    └─→ Return true
    ↓
scheduleNote(event)
    ├─→ Check late (playAt < now?)
    │   └─→ If late → DROP
    └─→ Schedule with Tone.Transport
```

### Event Key Format
```
${instrument}-${note}-${timestamp}
Example: "BASS-60-1234567890123"
```

### Buffer Management
- **Window:** 300ms sliding window
- **Cleanup:** Every 100ms (removes events older than window)
- **Storage:** Map<eventKey, {timestamp, event}>

---

## 📁 File Structure

```
src/lib/audio/
├── scheduler.js              # Updated with EventBufferManager integration
└── eventBufferManager.js     # New: Jitter handling and deduplication
```

---

## 🔧 Key Features

### Sliding Buffer
- **Window:** 300ms of recent events
- **Purpose:** Track recent events for deduplication
- **Cleanup:** Automatic removal of old events

### Deduplication
- **Key Format:** `${instrument}-${note}-${timestamp}`
- **Purpose:** Prevent same event from playing twice
- **Use Case:** Network retransmissions, duplicate packets

### Overlapping Prevention
- **Threshold:** 10ms minimum between same note
- **Purpose:** Prevent overlapping notes (especially for mono synths like bass)
- **Use Case:** Fast repeated notes, network jitter

### Stale Event Filtering
- **Threshold:** >1.5s in past
- **Purpose:** Filter events from reconnect storms or packet replay
- **Use Case:** Client reconnection, delayed packets

### Jitter Tracking
- **Calculation:** `|actual arrival time - expected arrival time|`
- **Statistics:** Min, max, average jitter
- **Purpose:** Monitor network quality

---

## 📊 Statistics

### EventBufferManager Stats
```javascript
{
  totalEvents: number,           // Total events processed
  droppedDuplicates: number,     // Duplicate events dropped
  droppedStale: number,          // Stale events dropped
  droppedOverlapping: number,    // Overlapping notes dropped
  bufferSize: number,            // Current buffer size
  avgJitter: number,             // Average jitter (ms)
  jitterMin: number,             // Minimum jitter (ms)
  jitterMax: number,             // Maximum jitter (ms)
  dropRate: number               // Overall drop rate (%)
}
```

### Combined Stats (Scheduler + Buffer)
```javascript
const stats = getSchedulerStats();
// Includes:
// - Scheduler stats (totalScheduled, totalDropped, totalLate)
// - Buffer manager stats (droppedDuplicates, droppedStale, etc.)
// - Combined drop rate
```

---

## 🔌 Integration Points

### Scheduler (`lib/audio/scheduler.js`)
- Calls `EventBufferManager.shouldPlay()` before scheduling
- Drops events filtered by buffer manager
- Combines statistics for unified reporting

### Event Receiver (`useNoteEvents.jsx`)
- Events flow: Receive → `scheduleNote()` → `EventBufferManager.shouldPlay()` → Schedule
- All filtering happens transparently

---

## 🎯 Filtering Layers (Order of Execution)

1. **Deduplication** (EventBufferManager)
   - Check if event key exists in buffer
   - Drop if duplicate

2. **Stale Filtering** (EventBufferManager)
   - Check if event >1.5s old
   - Drop if stale

3. **Overlapping Prevention** (EventBufferManager)
   - Check if same note played <10ms ago
   - Drop if overlapping

4. **Late Filtering** (Scheduler)
   - Check if `playAt < now`
   - Drop if too late

5. **Schedule** (Scheduler)
   - Schedule with Tone.Transport if all checks pass

---

## 🧪 Testing Checklist

- [x] EventBufferManager created
- [x] Deduplication implemented
- [x] Stale filtering implemented
- [x] Overlapping prevention implemented
- [x] Jitter tracking implemented
- [x] Integration into scheduler complete
- [ ] Manual testing: Simulate duplicate events
- [ ] Manual testing: Simulate stale events (>1.5s old)
- [ ] Manual testing: Simulate overlapping notes
- [ ] Manual testing: Verify jitter statistics
- [ ] Manual testing: Multiple users simultaneously

---

## 🚀 Next Steps (Phase 6)

Ready to proceed to **Phase 6: Instrument Claim Sync & Silent Refresh**:
- Broadcast instrument claim events to all clients
- Silent peer refresh (no UI disruption)
- Reclaim state on reconnect
- No reload required

---

## 📝 Notes

1. **Buffer Window:** 300ms is a good balance between:
   - Catching duplicates (network retransmissions)
   - Not blocking legitimate fast notes
   - Memory usage

2. **Overlapping Threshold:** 10ms prevents:
   - Double triggers on mono synths (bass)
   - CPU spikes from rapid-fire events
   - Audio glitches from overlapping notes

3. **Stale Threshold:** 1.5s catches:
   - Reconnect storms (old events arriving after reconnect)
   - Packet replay attacks
   - Network routing delays

4. **Jitter Tracking:** Useful for:
   - Monitoring network quality
   - Debugging timing issues
   - Performance optimization

5. **Singleton Pattern:** EventBufferManager uses singleton pattern for:
   - Shared state across the app
   - Consistent filtering
   - Unified statistics

---

**End of Phase 5 Report**

