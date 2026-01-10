# Testing Checklist for Jam in a Docs

## Pre-Release Testing Checklist

### 1. Accessibility Testing

#### Keyboard Navigation
- [ ] All interactive elements are keyboard accessible
- [ ] Tab order is logical and intuitive
- [ ] Focus indicators are visible on all focusable elements
- [ ] Piano keyboard can be played using keyboard keys (A-S-D-F-G-H-J-K, W-E-T-Y-U)
- [ ] Drum pads can be triggered using keyboard keys (Q-W-E-R-A-S-D-F)
- [ ] All buttons and controls respond to Enter/Space keys
- [ ] Modal dialogs can be closed with Escape key

#### Screen Reader Testing
- [ ] Test with NVDA (Windows) or VoiceOver (Mac/iOS)
- [ ] All buttons have descriptive `aria-label` attributes
- [ ] Form inputs have associated labels
- [ ] Radio button groups have proper `role="radiogroup"` and labels
- [ ] Sliders have `aria-valuemin`, `aria-valuemax`, and `aria-valuenow`
- [ ] Status messages are announced to screen readers
- [ ] Error messages are accessible

#### ARIA Labels
- [ ] All instrument controls have descriptive labels
- [ ] Volume controls have proper labels
- [ ] Mode toggles (Bass, Drums, EP, Guitar) have proper labels
- [ ] Room code input has descriptive label
- [ ] Chat input has proper label

### 2. Cross-Browser Testing

#### Desktop Browsers
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

#### Mobile Browsers
- [ ] iOS Safari (iPhone)
- [ ] iOS Safari (iPad)
- [ ] Chrome Android
- [ ] Samsung Internet

#### Test Scenarios per Browser
- [ ] Create room
- [ ] Join room with code
- [ ] Claim instrument
- [ ] Play notes (keyboard)
- [ ] Play notes (touch)
- [ ] Switch instrument modes (A/B)
- [ ] Adjust volume
- [ ] Send chat message
- [ ] Real-time sync with other players

### 3. Mobile Device Testing

#### iOS Devices
- [ ] iPhone SE (small screen)
- [ ] iPhone 12/13/14 (standard)
- [ ] iPhone 14 Pro Max (large screen)
- [ ] iPad (portrait)
- [ ] iPad (landscape)

#### Android Devices
- [ ] Small phone (320px width)
- [ ] Standard phone (375px width)
- [ ] Large phone (414px width)
- [ ] Tablet (768px+ width)

#### Mobile-Specific Tests
- [ ] Touch targets are at least 44x44px
- [ ] No accidental double-notes on touch
- [ ] No scroll interference when playing instruments
- [ ] Chat panel works as bottom sheet on mobile portrait
- [ ] Orientation changes handled correctly
- [ ] Keyboard doesn't cover inputs
- [ ] No zoom on double-tap
- [ ] Touch latency is acceptable (<50ms)

### 4. Performance Testing

#### Load Testing
- [ ] Test with 4 players simultaneously
- [ ] Test with 100 audience members (chat only)
- [ ] Monitor CPU usage (should stay <80% on mid-range devices)
- [ ] Monitor memory usage (should stay <500MB per client)
- [ ] Test for 10+ minutes continuously
- [ ] Monitor network bandwidth usage

#### Stress Testing
- [ ] Rapid note events (100+ notes/second)
- [ ] Multiple players joining/leaving rapidly
- [ ] Multiple mode switches in quick succession
- [ ] Large chat message volume
- [ ] Network interruption and recovery

#### Latency Testing
- [ ] First note latency <100ms
- [ ] Note-to-sound latency <50ms
- [ ] Network sync latency <200ms
- [ ] Clock synchronization accuracy <50ms

### 5. Real-Time Synchronization Testing

#### Multi-Player Scenarios
- [ ] 2 players playing simultaneously
- [ ] 3 players playing simultaneously
- [ ] 4 players playing simultaneously
- [ ] All instruments playing at once
- [ ] Notes stay in sync across all clients

#### Network Conditions
- [ ] High latency (200ms+)
- [ ] Packet loss (5%+)
- [ ] Intermittent connectivity
- [ ] Slow 3G connection simulation
- [ ] WiFi to mobile data switch

#### Edge Cases
- [ ] Late joiner receives current state
- [ ] Reconnect after disconnect
- [ ] Tab sleep/wake handling
- [ ] Multiple tabs open (same user)
- [ ] Browser back/forward navigation

### 6. Security Testing

#### Input Validation
- [ ] Room codes are validated (6 alphanumeric)
- [ ] Display names are sanitized
- [ ] Chat messages are sanitized (XSS protection)
- [ ] MIDI note values are validated (0-127)
- [ ] Velocity values are validated (0-127)

#### Rate Limiting
- [ ] Note events are rate limited (100/sec)
- [ ] Chat messages are rate limited (10/10sec)
- [ ] Room operations are rate limited (5/10sec)
- [ ] Rate limit errors are user-friendly

#### XSS Protection
- [ ] HTML in chat messages is escaped
- [ ] Script tags in chat are sanitized
- [ ] Event handlers in chat are prevented

### 7. Audio Quality Testing

#### Instrument Sounds
- [ ] All instruments load correctly
- [ ] A/B mode switching works without clicks
- [ ] No stuck notes when switching modes
- [ ] Velocity response feels natural
- [ ] Sounds are realistic and high-quality

#### Audio Engine
- [ ] No audio glitches or pops
- [ ] Smooth note transitions
- [ ] Proper note release
- [ ] Reverb and effects work correctly
- [ ] Volume controls work smoothly

### 8. User Experience Testing

#### Error Handling
- [ ] Network errors show user-friendly messages
- [ ] Invalid room codes show clear errors
- [ ] Permission errors are explained
- [ ] Error boundaries catch React errors gracefully
- [ ] Loading states are shown during async operations

#### Visual Feedback
- [ ] Active notes are visually indicated
- [ ] Instrument activity indicators work
- [ ] Player colors are distinct
- [ ] Toast notifications appear correctly
- [ ] Loading spinners are visible

#### Flow Testing
- [ ] Landing page → Create room → Room page
- [ ] Landing page → Join room → Room page
- [ ] Room page → Claim instrument → Play
- [ ] Room page → Switch modes → Continue playing
- [ ] Room page → Send chat
- [ ] Room page → Leave room → Landing page

### 9. Integration Testing

#### Supabase Integration
- [ ] Room creation works
- [ ] Room joining works
- [ ] Player updates sync correctly
- [ ] Chat messages sync correctly
- [ ] Real-time subscriptions work
- [ ] Database queries are optimized

#### WebRTC Integration
- [ ] P2P connections establish
- [ ] Note events sync via WebRTC
- [ ] Connection states are tracked
- [ ] Reconnection works after disconnect

### 10. Regression Testing

#### Previous Bug Fixes
- [ ] Double notes on mobile are prevented
- [ ] Scroll interference is prevented
- [ ] Stuck notes on mode switch are prevented
- [ ] Sample loading errors are handled
- [ ] Room ID propagation works correctly

### 11. Documentation Testing

#### User Documentation
- [ ] README is clear and complete
- [ ] Setup instructions work
- [ ] User guide is accurate
- [ ] Keyboard shortcuts are documented

#### Developer Documentation
- [ ] Code comments are helpful
- [ ] Architecture is documented
- [ ] API contracts are clear

### 12. Production Readiness

#### Environment Variables
- [ ] All required env vars are documented
- [ ] Default values are safe
- [ ] Production config is separate from dev

#### Monitoring
- [ ] Error logging works
- [ ] Performance metrics are tracked
- [ ] User actions are logged (if applicable)

#### Deployment
- [ ] Build process works
- [ ] Production build is optimized
- [ ] Static assets are served correctly
- [ ] CDN configuration is correct (if applicable)

---

## Automated Testing (Future)

### Unit Tests
- [ ] Instrument modules (drums, bass, piano, guitar)
- [ ] Validation utilities
- [ ] Rate limiter
- [ ] Clock synchronization
- [ ] Event bundling

### Integration Tests
- [ ] Firebase client operations
- [ ] WebRTC connection flow
- [ ] Audio engine initialization
- [ ] Room state management

### E2E Tests
- [ ] Full user flow (create → join → play)
- [ ] Multi-player synchronization
- [ ] Mobile touch interactions
- [ ] Error scenarios

---

## Test Results Template

```
Date: [DATE]
Tester: [NAME]
Browser/Device: [BROWSER/DEVICE]
Version: [VERSION]

Results:
- [ ] All tests passed
- [ ] Issues found: [LIST]
- [ ] Critical bugs: [LIST]
- [ ] Performance notes: [NOTES]
```


