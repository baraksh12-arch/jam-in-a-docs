# Jam in a Docs - User Guide

## Welcome to Jam in a Docs! 🎵

Jam in a Docs is a real-time collaborative music jamming app that lets you play music together with friends in your browser. Up to 4 players can join a room and jam together using virtual instruments.

## Getting Started

### Creating a Room

1. Visit the app homepage
2. Click **"Create Room"** button
3. You'll be automatically redirected to your new room
4. Share the room code (shown in the top bar) with your friends

### Joining a Room

1. Get the 6-character room code from the host
2. Enter it in the **"Join with Code"** field on the homepage
3. Click **"Join"** or press Enter
4. You'll be taken to the room

## Playing Instruments

### Available Instruments

- **🥁 Drums** - 8 drum pads (Kick, Snare, Hi-Hat, Tom 1, Tom 2, Crash, Ride, Clap)
- **🎸 Bass** - Bass guitar with synth and sampled modes
- **🎹 Electric Piano** - Piano with electric and upright modes
- **🎸 Guitar** - Guitar with electric and nylon modes

### Claiming an Instrument

1. Find an available instrument slot (shows "Available")
2. Click **"Claim [Instrument Name]"**
3. The instrument panel will activate and you can start playing!

### Playing on Desktop

#### Piano Keyboard (Bass, EP, Guitar)
- **White keys**: A, S, D, F, G, H, J, K
- **Black keys**: W, E, T, Y, U
- You can also click/tap the keys with your mouse

#### Drum Pads
- **Q** - Kick
- **W** - Snare
- **E** - Hi-Hat
- **R** - Tom 1
- **A** - Tom 2
- **S** - Crash
- **D** - Ride
- **F** - Clap

### Playing on Mobile

- **Touch the keys/pads** directly on your screen
- The interface is optimized for touch - just tap to play!
- Make sure your device volume is turned up

## Instrument Controls

### Volume Control

Each instrument has its own volume slider:
- Click the **mute/unmute button** (🔇/🔊) to quickly mute
- Drag the **volume slider** to adjust volume (0-100%)

### Sound Mode Switching (A/B Modes)

Each instrument has two sound modes you can switch between:

- **Bass**: Synth / Sampled
- **Drums**: Sampled / Electronic
- **Electric Piano**: Electric / Upright
- **Guitar**: Electric / Nylon

To switch modes:
1. Make sure you've claimed the instrument
2. Use the radio buttons in the instrument panel header
3. The sound will switch instantly (no clicks or stuck notes!)

## Chat

### Sending Messages

1. Type your message in the chat input at the bottom
2. Press **Enter** or click **Send**
3. Messages appear in real-time for all players

### Chat Features

- **Real-time sync** - Messages appear instantly for everyone
- **Rate limiting** - Maximum 10 messages per 10 seconds (prevents spam)
- **XSS protection** - All messages are sanitized for security
- **Mobile-friendly** - Chat appears as a bottom sheet on mobile

### Audience Members

- Up to 100 audience members can join a room
- Audience members can chat but cannot play instruments
- They can watch and listen to the jam session

## Tips for Best Experience

### Latency & Performance

- **First note latency**: The first note you play may have slight latency as the audio engine initializes. This is normal!
- **Network**: For best sync, use a stable internet connection
- **CPU usage**: The app monitors CPU usage. If it gets too high (>80%), you may see a warning

### Mobile Tips

- **Orientation**: Works best in landscape mode for playing instruments
- **Touch targets**: All keys and pads are sized for easy touch (44x44px minimum)
- **No accidental double-notes**: The app prevents double-triggers on touch devices
- **No scroll interference**: Touch events won't interfere with scrolling

### Keyboard Shortcuts

- **Tab** - Navigate between interactive elements
- **Enter/Space** - Activate buttons
- **Escape** - Close modals/dialogs
- **A-S-D-F-G-H-J-K** - Play piano keys (white)
- **W-E-T-Y-U** - Play piano keys (black)
- **Q-W-E-R-A-S-D-F** - Trigger drum pads

## Troubleshooting

### Audio Not Working

1. **Check device volume** - Make sure your device volume is up
2. **Check browser permissions** - Some browsers require user interaction before playing audio
3. **Try clicking/tapping** - The first interaction may need to be a click/tap to enable audio
4. **Check browser console** - Open developer tools (F12) and look for errors

### Notes Not Syncing

1. **Check internet connection** - Real-time sync requires stable internet
2. **Refresh the page** - Sometimes a refresh helps reconnect
3. **Check room code** - Make sure you're in the correct room
4. **Check WebRTC status** - Look for connection indicators in the debug panel (if enabled)

### Can't Claim Instrument

1. **Check if already claimed** - Only one player per instrument
2. **Check room capacity** - Maximum 4 players per room
3. **Try refreshing** - The room state may need to update

### Mobile Issues

1. **Touch not working** - Make sure you're tapping directly on the keys/pads
2. **Double notes** - This should be prevented, but if it happens, try tapping more deliberately
3. **Scroll interference** - The app uses `touch-action: none` to prevent this, but some browsers may still interfere

## Accessibility

### Keyboard Navigation

- All interactive elements are keyboard accessible
- Use **Tab** to navigate, **Enter/Space** to activate
- Focus indicators are visible on all focusable elements

### Screen Readers

- The app includes ARIA labels for screen readers
- All buttons, inputs, and controls are properly labeled
- Instrument controls announce their state to screen readers

### Visual Feedback

- Active notes are highlighted visually
- Instrument activity indicators show when someone is playing
- Player colors help distinguish between players

## Privacy & Security

### Data Collection

- **Room codes** - Stored temporarily in the database
- **Display names** - Stored with chat messages
- **Chat messages** - Stored in the database (sanitized for XSS protection)
- **Note events** - Not stored long-term (only for real-time sync)

### Rate Limiting

The app includes rate limiting to prevent abuse:
- **Note events**: 100 per second maximum
- **Chat messages**: 10 per 10 seconds
- **Room operations**: 5 per 10 seconds

### XSS Protection

All user inputs (chat messages, display names) are sanitized to prevent cross-site scripting attacks.

## Browser Compatibility

### Recommended Browsers

- **Chrome** (latest) - ✅ Best support
- **Firefox** (latest) - ✅ Full support
- **Safari** (latest) - ✅ Full support
- **Edge** (latest) - ✅ Full support

### Mobile Browsers

- **iOS Safari** - ✅ Full support
- **Chrome Android** - ✅ Full support
- **Samsung Internet** - ✅ Full support

### Minimum Requirements

- Modern browser with Web Audio API support
- JavaScript enabled
- Stable internet connection
- Audio output device (speakers/headphones)

## Support

### Getting Help

- Check this user guide first
- Check the browser console for error messages (F12)
- Try refreshing the page
- Check your internet connection

### Reporting Issues

If you encounter a bug or issue:
1. Note the browser and device you're using
2. Check the browser console for errors (F12)
3. Take a screenshot if possible
4. Report the issue with as much detail as possible

## Keyboard Reference

### Piano Keys (Bass, EP, Guitar)

```
White Keys:  A  S  D  F  G  H  J  K
Black Keys:   W  E     T  Y  U
```

### Drum Pads

```
Q - Kick        R - Tom 1
W - Snare       A - Tom 2
E - Hi-Hat      S - Crash
                D - Ride
                F - Clap
```

## FAQ

**Q: Can I use MIDI controllers?**  
A: MIDI support is planned for future releases. Currently, use keyboard or touch.

**Q: How many people can join a room?**  
A: Up to 4 players can claim instruments. Up to 100 audience members can join to watch and chat.

**Q: Do I need an account?**  
A: No account required! Just join with a room code.

**Q: Are my notes saved?**  
A: No, notes are only for real-time sync. They're not saved or recorded.

**Q: Can I record the jam session?**  
A: Recording functionality is not currently available.

**Q: What if someone disconnects?**  
A: Their instrument will be released and become available for others to claim.

**Q: Can I change my display name?**  
A: Display names are set when joining. To change, leave and rejoin the room.

---

Enjoy jamming! 🎸🥁🎹🎸

