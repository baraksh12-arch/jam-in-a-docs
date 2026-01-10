import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * FullscreenKeyboard - Premium VST-quality piano keyboard
 * Inspired by Native Instruments, Arturia, and top-tier virtual instruments
 * Features: Natural proportions, 3D depth, smooth interactions
 */

// Extended note ranges for fullscreen
const FULLSCREEN_RANGES = {
  BASS: { start: 24, end: 60 },   // C1 to C4 (3 octaves)
  EP: { start: 36, end: 84 },     // C2 to C6 (4 octaves)  
  GUITAR: { start: 40, end: 76 }  // E2 to E5 (3 octaves)
};

// Professional keyboard mapping - two rows
const KEY_MAP = {
  // Lower row - white keys
  'z': 0, 'x': 2, 'c': 4, 'v': 5, 'b': 7, 'n': 9, 'm': 11, ',': 12, '.': 14,
  // Upper row - black keys
  's': 1, 'd': 3, 'g': 6, 'h': 8, 'j': 10, 'l': 13,
  // Alternative octave up (q row)
  'q': 12, 'w': 14, 'e': 16, 'r': 17, 't': 19, 'y': 21, 'u': 23, 'i': 24,
  '2': 13, '3': 15, '5': 18, '6': 20, '7': 22,
};

// Instrument theme colors
const INSTRUMENT_THEMES = {
  BASS: {
    accent: '#06b6d4', // cyan
    accentDark: '#0891b2',
    glow: 'rgba(6, 182, 212, 0.4)',
    name: 'Bass'
  },
  EP: {
    accent: '#8b5cf6', // violet
    accentDark: '#7c3aed',
    glow: 'rgba(139, 92, 246, 0.4)',
    name: 'Electric Piano'
  },
  GUITAR: {
    accent: '#10b981', // emerald
    accentDark: '#059669',
    glow: 'rgba(16, 185, 129, 0.4)',
    name: 'Guitar'
  }
};

// Check if a MIDI note is a black key
const isBlackKey = (midiNote) => [1, 3, 6, 8, 10].includes(midiNote % 12);

// Get note name from MIDI number
const getNoteName = (midiNote) => {
  const noteNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const octave = Math.floor(midiNote / 12) - 1;
  return { note: noteNames[midiNote % 12], octave };
};

export default function FullscreenKeyboard({ 
  instrument, 
  onNoteOn: externalNoteOn, 
  onNoteOff: externalNoteOff,
  focusModeActive = true 
}) {
  const [activeNotes, setActiveNotes] = useState(new Set());
  const [octaveOffset, setOctaveOffset] = useState(0);
  const touchActiveRef = useRef(false);
  const currentTouchesRef = useRef(new Map());
  const containerRef = useRef(null);
  
  const range = FULLSCREEN_RANGES[instrument] || FULLSCREEN_RANGES.EP;
  const theme = INSTRUMENT_THEMES[instrument] || INSTRUMENT_THEMES.EP;
  
  // Generate all notes in range
  const allNotes = [];
  for (let i = range.start; i <= range.end; i++) {
    allNotes.push(i);
  }
  
  // Separate white and black keys
  const whiteNotes = allNotes.filter(n => !isBlackKey(n));
  const blackNotes = allNotes.filter(n => isBlackKey(n));
  
  // Calculate visible octaves
  const totalOctaves = Math.ceil((range.end - range.start) / 12);
  const maxOctaveOffset = Math.max(0, totalOctaves - 2);

  // NOTE_ON handler - sustain until release (like a real piano)
  const handleNoteOn = useCallback((note) => {
    if (!focusModeActive) return;
    if (activeNotes.has(note)) return; // Prevent double-triggering
    
    externalNoteOn?.(note);
    if (navigator.vibrate) navigator.vibrate(10);
    setActiveNotes(prev => new Set(prev).add(note));
  }, [externalNoteOn, focusModeActive, activeNotes]);

  // NOTE_OFF handler - release sustain naturally
  const handleNoteOff = useCallback((note) => {
    if (!activeNotes.has(note)) return; // Only release if was playing
    
    externalNoteOff?.(note);
    setActiveNotes(prev => {
      const next = new Set(prev);
      next.delete(note);
      return next;
    });
  }, [externalNoteOff, activeNotes]);

  // Multi-touch handlers
  const handleTouchStart = useCallback((e) => {
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
  }, [handleNoteOn]);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    Array.from(e.changedTouches).forEach(touch => {
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      const note = element?.dataset?.note;
      const prevNote = currentTouchesRef.current.get(touch.identifier);
      if (note) {
        const noteNum = parseInt(note, 10);
        if (noteNum !== prevNote) {
          if (prevNote !== undefined) handleNoteOff(prevNote);
          currentTouchesRef.current.set(touch.identifier, noteNum);
          handleNoteOn(noteNum);
        }
      }
    });
  }, [handleNoteOn, handleNoteOff]);

  const handleTouchEnd = useCallback((e) => {
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
  }, [handleNoteOff]);

  // Mouse handlers
  const handleMouseDown = (note) => {
    if (touchActiveRef.current) return;
    handleNoteOn(note);
  };

  const handleMouseUp = (note) => {
    if (touchActiveRef.current) return;
    handleNoteOff(note);
  };

  // Keyboard input - ONLY active in focus mode
  useEffect(() => {
    if (!focusModeActive) return;
    
    const baseNote = range.start + (octaveOffset * 12);
    
    const handleKeyDown = (e) => {
      if (e.repeat || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      // Octave controls
      if (e.key === 'ArrowUp' || e.key === ']') {
        setOctaveOffset(prev => Math.min(prev + 1, maxOctaveOffset));
        return;
      }
      if (e.key === 'ArrowDown' || e.key === '[') {
        setOctaveOffset(prev => Math.max(prev - 1, 0));
        return;
      }
      
      const offset = KEY_MAP[e.key.toLowerCase()];
      if (offset !== undefined) {
        const note = baseNote + offset;
        if (note >= range.start && note <= range.end && !activeNotes.has(note)) {
          e.preventDefault();
          handleNoteOn(note);
        }
      }
    };

    const handleKeyUp = (e) => {
      const offset = KEY_MAP[e.key.toLowerCase()];
      if (offset !== undefined) {
        const note = range.start + (octaveOffset * 12) + offset;
        if (note >= range.start && note <= range.end) {
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
  }, [focusModeActive, octaveOffset, range, maxOctaveOffset, activeNotes, handleNoteOn, handleNoteOff]);

  // Calculate key dimensions - natural piano proportions
  const whiteKeyWidth = 52;
  const whiteKeyHeight = 220;
  const blackKeyWidth = 32;
  const blackKeyHeight = 140;
  const keyboardWidth = whiteNotes.length * (whiteKeyWidth + 1);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      {/* Octave Control Bar */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex items-center gap-4 mb-6"
      >
        <button
          onClick={() => setOctaveOffset(prev => Math.max(prev - 1, 0))}
          disabled={octaveOffset === 0}
          className="
            px-4 py-2 rounded-xl font-semibold text-sm
            bg-white/5 border border-white/10 text-white/70
            hover:bg-white/10 hover:text-white
            disabled:opacity-30 disabled:cursor-not-allowed
            transition-all duration-200
          "
        >
          ◀ Lower
        </button>
        
        <div className="px-6 py-2 bg-white/5 backdrop-blur-xl rounded-xl border border-white/10">
          <span className="text-white/40 text-sm mr-2">Octave</span>
          <span className="text-white font-bold text-xl">{octaveOffset + 2}</span>
        </div>
        
        <button
          onClick={() => setOctaveOffset(prev => Math.min(prev + 1, maxOctaveOffset))}
          disabled={octaveOffset >= maxOctaveOffset}
          className="
            px-4 py-2 rounded-xl font-semibold text-sm
            bg-white/5 border border-white/10 text-white/70
            hover:bg-white/10 hover:text-white
            disabled:opacity-30 disabled:cursor-not-allowed
            transition-all duration-200
          "
        >
          Higher ▶
        </button>
      </motion.div>

      {/* Piano Keyboard Container */}
      <motion.div 
        ref={containerRef}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="relative overflow-x-auto overflow-y-visible max-w-full pb-4"
        style={{ 
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.2) transparent'
        }}
      >
        {/* Piano body/frame */}
        <div 
          className="relative rounded-2xl p-4 pt-3"
          style={{
            background: 'linear-gradient(180deg, #1a1a1f 0%, #0d0d10 100%)',
            boxShadow: `
              0 25px 50px -12px rgba(0, 0, 0, 0.8),
              0 0 0 1px rgba(255, 255, 255, 0.05),
              inset 0 1px 0 rgba(255, 255, 255, 0.05)
            `
          }}
        >
          {/* Top decorative strip */}
          <div 
            className="h-2 rounded-full mb-4 mx-auto"
            style={{ 
              width: '60%',
              background: `linear-gradient(90deg, transparent, ${theme.accent}40, transparent)`
            }}
          />

          {/* Keys container */}
          <div 
            className="relative"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ 
              touchAction: 'none',
              width: keyboardWidth,
              height: whiteKeyHeight + 10
            }}
          >
            {/* White Keys */}
            <div className="absolute inset-0 flex">
              {whiteNotes.map((note, index) => {
                const isActive = activeNotes.has(note);
                const { note: noteName, octave } = getNoteName(note);
                const isC = note % 12 === 0;
                
                return (
                  <div
                    key={note}
                    data-note={note}
                    onMouseDown={() => handleMouseDown(note)}
                    onMouseUp={() => handleMouseUp(note)}
                    onMouseLeave={() => !touchActiveRef.current && handleNoteOff(note)}
                    className="relative cursor-pointer select-none"
                    style={{
                      width: whiteKeyWidth,
                      height: whiteKeyHeight,
                      marginRight: 1,
                    }}
                  >
                    {/* White key */}
                    <div
                      className="absolute inset-0 rounded-b-lg transition-all duration-[30ms]"
                      style={{
                        background: isActive 
                          ? `linear-gradient(180deg, ${theme.accent} 0%, ${theme.accentDark} 100%)`
                          : 'linear-gradient(180deg, #fafafa 0%, #e5e5e5 50%, #d4d4d4 100%)',
                        boxShadow: isActive
                          ? `0 0 20px ${theme.glow}, inset 0 -4px 8px rgba(0,0,0,0.2)`
                          : `
                              inset 0 -4px 6px rgba(0,0,0,0.08),
                              inset 0 1px 0 rgba(255,255,255,0.9),
                              0 4px 8px rgba(0,0,0,0.3)
                            `,
                        transform: isActive ? 'translateY(3px)' : 'translateY(0)',
                        borderLeft: '1px solid rgba(0,0,0,0.1)',
                        borderRight: '1px solid rgba(0,0,0,0.1)',
                        borderBottom: '1px solid rgba(0,0,0,0.2)',
                      }}
                    >
                      {/* Key label for C notes */}
                      {isC && (
                        <div className="absolute bottom-3 left-0 right-0 flex flex-col items-center">
                          <span 
                            className="text-xs font-bold"
                            style={{ color: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.35)' }}
                          >
                            C{octave}
                          </span>
                          <div 
                            className="w-6 h-0.5 rounded-full mt-1"
                            style={{ 
                              background: isActive ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.15)'
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Black Keys - Positioned over white keys */}
            <div className="absolute top-0 left-0 flex pointer-events-none">
              {whiteNotes.map((whiteNote, index) => {
                const blackNote = whiteNote + 1;
                const hasBlack = blackNotes.includes(blackNote);
                
                // Calculate position offset for black key
                const offset = (whiteKeyWidth - blackKeyWidth / 2) + (index * (whiteKeyWidth + 1));
                
                if (!hasBlack || index === whiteNotes.length - 1) {
                  return null;
                }
                
                const isActive = activeNotes.has(blackNote);
                
                return (
                  <div
                    key={blackNote}
                    data-note={blackNote}
                    onMouseDown={() => handleMouseDown(blackNote)}
                    onMouseUp={() => handleMouseUp(blackNote)}
                    onMouseLeave={() => !touchActiveRef.current && handleNoteOff(blackNote)}
                    className="absolute cursor-pointer select-none pointer-events-auto"
                    style={{
                      left: offset,
                      width: blackKeyWidth,
                      height: blackKeyHeight,
                      zIndex: 10,
                    }}
                  >
                    {/* Black key with realistic 3D effect */}
                    <div
                      className="absolute inset-0 rounded-b-md transition-all duration-[30ms]"
                      style={{
                        background: isActive 
                          ? `linear-gradient(180deg, ${theme.accent} 0%, ${theme.accentDark} 100%)`
                          : 'linear-gradient(180deg, #2a2a2f 0%, #1a1a1f 40%, #0a0a0f 100%)',
                        boxShadow: isActive
                          ? `0 0 15px ${theme.glow}, 0 3px 6px rgba(0,0,0,0.5)`
                          : `
                              inset 0 -2px 4px rgba(0,0,0,0.3),
                              inset 0 1px 1px rgba(255,255,255,0.05),
                              0 4px 8px rgba(0,0,0,0.5),
                              0 2px 4px rgba(0,0,0,0.3)
                            `,
                        transform: isActive ? 'translateY(2px)' : 'translateY(0)',
                        border: '1px solid rgba(0,0,0,0.5)',
                      }}
                    >
                      {/* Subtle highlight on top */}
                      <div 
                        className="absolute top-0 left-0 right-0 h-8 rounded-t-sm"
                        style={{
                          background: isActive 
                            ? 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 100%)'
                            : 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 100%)'
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom decorative elements */}
          <div className="flex justify-center mt-4 gap-2">
            <div className="w-2 h-2 rounded-full bg-white/10" />
            <div 
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: theme.accent + '60' }}
            />
            <div className="w-2 h-2 rounded-full bg-white/10" />
          </div>
        </div>
      </motion.div>

      {/* Keyboard shortcuts hint */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-6 px-6 py-3 bg-white/5 backdrop-blur-xl rounded-xl border border-white/10"
      >
        <p className="text-white/30 text-sm text-center">
          <span className="text-white/50 font-medium">Z X C V B N M</span>
          <span className="mx-2">•</span>
          <span className="text-white/50 font-medium">S D G H J</span> (black)
          <span className="mx-2">•</span>
          <span className="text-white/50">↑↓ or [ ] octave</span>
        </p>
      </motion.div>
    </div>
  );
}
