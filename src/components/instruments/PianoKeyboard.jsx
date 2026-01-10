import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

// MIDI note ranges for different instruments - optimized for playability
const NOTE_RANGES = {
  BASS: { start: 28, end: 52 }, // E1 to E3 (2 octaves)
  EP: { start: 48, end: 84 },   // C3 to C6 (3 octaves)
  GUITAR: { start: 40, end: 76 } // E2 to E5 (3 octaves)
};

// Mobile-optimized ranges (fewer keys for bigger touch targets)
const MOBILE_NOTE_RANGES = {
  BASS: { start: 36, end: 48 },  // C2 to C3 (1 octave)
  EP: { start: 48, end: 72 },    // C3 to C5 (2 octaves)
  GUITAR: { start: 48, end: 72 } // C3 to C5 (2 octaves)
};

// Keyboard mapping for piano keys
const KEY_MAP = {
  'a': 0, 's': 2, 'd': 4, 'f': 5, 'g': 7, 'h': 9, 'j': 11, 'k': 12,
  'w': 1, 'e': 3, 't': 6, 'y': 8, 'u': 10
};

// Note colors for visual feedback
const NOTE_COLORS = {
  white: { active: 'bg-gradient-to-b from-cyan-400 to-cyan-500', inactive: 'bg-gradient-to-b from-white to-gray-100' },
  black: { active: 'bg-gradient-to-b from-purple-500 to-purple-600', inactive: 'bg-gradient-to-b from-gray-800 to-gray-900' }
};

export default function PianoKeyboard({ instrument, onNotePlay, disabled, disableKeyboard = false }) {
  const [activeNotes, setActiveNotes] = useState(new Set());
  const touchActiveRef = useRef(false);
  const currentTouchesRef = useRef(new Map()); // Track multi-touch
  const isMobile = useIsMobile();
  
  // Use mobile-optimized range for touch devices
  const range = isMobile ? MOBILE_NOTE_RANGES[instrument] : NOTE_RANGES[instrument];
  
  // Generate notes for this instrument
  const notes = [];
  for (let i = range.start; i <= range.end; i++) {
    notes.push(i);
  }

  const isBlackKey = (midiNote) => {
    const noteInOctave = midiNote % 12;
    return [1, 3, 6, 8, 10].includes(noteInOctave);
  };

  const getNoteName = (midiNote) => {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midiNote / 12) - 1;
    const note = noteNames[midiNote % 12];
    return `${note}${octave}`;
  };

  const handleNoteOn = useCallback((note) => {
    if (disabled) return;
    onNotePlay(note);
    
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(5);
    }
    
    setActiveNotes(prev => new Set(prev).add(note));
  }, [disabled, onNotePlay]);

  const handleNoteOff = useCallback((note) => {
    setActiveNotes(prev => {
      const next = new Set(prev);
      next.delete(note);
      return next;
    });
  }, []);

  // Multi-touch support
  const handleTouchStart = (e) => {
    e.preventDefault();
    touchActiveRef.current = true;
    
    Array.from(e.changedTouches).forEach(touch => {
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      const note = element?.dataset?.note;
      if (note) {
        const noteNum = parseInt(note, 10);
        currentTouchesRef.current.set(touch.identifier, noteNum);
        handleNoteOn(noteNum);
      }
    });
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    
    Array.from(e.changedTouches).forEach(touch => {
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      const note = element?.dataset?.note;
      const previousNote = currentTouchesRef.current.get(touch.identifier);
      
      if (note) {
        const noteNum = parseInt(note, 10);
        if (noteNum !== previousNote) {
          // Glide to new note
          if (previousNote !== undefined) {
            handleNoteOff(previousNote);
          }
          currentTouchesRef.current.set(touch.identifier, noteNum);
          handleNoteOn(noteNum);
        }
      }
    });
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    
    Array.from(e.changedTouches).forEach(touch => {
      const note = currentTouchesRef.current.get(touch.identifier);
      if (note !== undefined) {
        handleNoteOff(note);
        currentTouchesRef.current.delete(touch.identifier);
      }
    });
    
    if (currentTouchesRef.current.size === 0) {
      setTimeout(() => { touchActiveRef.current = false; }, 100);
    }
  };

  const handleMouseDown = (e, note) => {
    if (touchActiveRef.current) return;
    handleNoteOn(note);
  };

  const handleMouseUp = (e, note) => {
    if (touchActiveRef.current) return;
    handleNoteOff(note);
  };

  // Keyboard support - disabled when focus mode is active
  useEffect(() => {
    if (disabled || disableKeyboard) return;

    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      const offset = KEY_MAP[e.key.toLowerCase()];
      if (offset !== undefined) {
        const note = range.start + offset;
        if (note <= range.end && !activeNotes.has(note)) {
          handleNoteOn(note);
        }
      }
    };

    const handleKeyUp = (e) => {
      const offset = KEY_MAP[e.key.toLowerCase()];
      if (offset !== undefined) {
        const note = range.start + offset;
        if (note <= range.end) {
          handleNoteOff(note);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [disabled, disableKeyboard, activeNotes, range, handleNoteOn, handleNoteOff]);

  // Group into white and black keys for proper rendering
  const whiteNotes = notes.filter(n => !isBlackKey(n));
  const blackNotes = notes.filter(n => isBlackKey(n));

  // Calculate white key width based on container
  const whiteKeyWidth = isMobile ? 'w-12' : 'w-10';
  const whiteKeyHeight = isMobile ? 'h-32' : 'h-36';
  const blackKeyWidth = isMobile ? 'w-8' : 'w-7';
  const blackKeyHeight = isMobile ? 'h-20' : 'h-24';

  return (
    <div 
      className="relative bg-gradient-to-b from-gray-800 to-gray-900 rounded-xl p-3 sm:p-4 overflow-x-auto shadow-inner"
      role="group"
      aria-label={`${instrument} keyboard`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: 'none' }}
    >
      <div className="relative flex min-w-max" role="application" aria-label="Piano keyboard">
        {/* White keys */}
        <div className="flex gap-0.5">
          {whiteNotes.map((note, index) => {
            const isActive = activeNotes.has(note);
            const noteName = getNoteName(note);
            const isC = note % 12 === 0;
            
            return (
              <button
                key={note}
                data-note={note}
                onMouseDown={(e) => handleMouseDown(e, note)}
                onMouseUp={(e) => handleMouseUp(e, note)}
                onMouseLeave={() => !touchActiveRef.current && handleNoteOff(note)}
                disabled={disabled}
                aria-label={noteName}
                className={`
                  relative ${whiteKeyWidth} ${whiteKeyHeight}
                  ${isActive ? NOTE_COLORS.white.active : NOTE_COLORS.white.inactive}
                  ${disabled ? 'opacity-40' : 'hover:brightness-95 active:brightness-90'}
                  rounded-b-lg border border-gray-300 shadow-md
                  transition-all duration-50
                  focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-inset
                `}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {/* Note label on C notes */}
                {isC && (
                  <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs font-bold text-gray-500">
                    {noteName}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Black keys - positioned absolutely */}
        <div className="absolute top-0 left-0 flex pointer-events-none" style={{ paddingLeft: isMobile ? '32px' : '28px' }}>
          {whiteNotes.slice(0, -1).map((whiteNote, index) => {
            // Check if there should be a black key after this white key
            const nextWhiteNote = whiteNotes[index + 1];
            const blackNote = whiteNote + 1;
            const hasBlackKey = blackNotes.includes(blackNote);
            
            if (!hasBlackKey) {
              return <div key={`spacer-${index}`} className={`${whiteKeyWidth} flex-shrink-0`} style={{ marginRight: '2px' }} />;
            }
            
            const isActive = activeNotes.has(blackNote);
            const noteName = getNoteName(blackNote);
            
            return (
              <div key={blackNote} className={`${whiteKeyWidth} flex-shrink-0 flex justify-center`} style={{ marginRight: '2px' }}>
                <button
                  data-note={blackNote}
                  onMouseDown={(e) => handleMouseDown(e, blackNote)}
                  onMouseUp={(e) => handleMouseUp(e, blackNote)}
                  onMouseLeave={() => !touchActiveRef.current && handleNoteOff(blackNote)}
                  disabled={disabled}
                  aria-label={noteName}
                  className={`
                    ${blackKeyWidth} ${blackKeyHeight}
                    ${isActive ? NOTE_COLORS.black.active : NOTE_COLORS.black.inactive}
                    ${disabled ? 'opacity-40' : 'hover:brightness-110 active:brightness-125'}
                    rounded-b-md shadow-lg z-10 pointer-events-auto
                    transition-all duration-50 border border-gray-700
                    focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-inset
                  `}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Instructions */}
      {!disabled && !isMobile && (
        <div className="mt-3 text-xs text-gray-500 text-center font-mono">
          ⌨️ Keys: A S D F G H J K (white) • W E T Y U (black)
        </div>
      )}
      
      {/* Mobile hint */}
      {!disabled && isMobile && (
        <div className="mt-3 text-xs text-gray-500 text-center">
          👆 Tap or slide across keys to play
        </div>
      )}
    </div>
  );
}