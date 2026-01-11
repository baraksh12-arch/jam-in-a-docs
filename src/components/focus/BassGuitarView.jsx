import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * BassGuitarView - Realistic Bass Guitar with String Slide
 * 
 * Premium bass guitar fretboard interface with:
 * - 4-string bass layout (E, A, D, G)
 * - Touch AND mouse slide between frets
 * - Visual string vibration feedback
 * - Realistic fret markers
 * - Full click & drag support for desktop
 */

// Bass guitar string tuning (MIDI notes for open strings)
const STRINGS = [
  { name: 'G', openNote: 43, color: 'from-amber-400 to-amber-500' },
  { name: 'D', openNote: 38, color: 'from-amber-500 to-amber-600' },
  { name: 'A', openNote: 33, color: 'from-orange-500 to-orange-600' },
  { name: 'E', openNote: 28, color: 'from-orange-600 to-orange-700' }
];

// Number of visible frets
const FRET_COUNT = 12;

// Fret markers (dots on fretboard)
const FRET_MARKERS = [3, 5, 7, 9, 12];
const DOUBLE_MARKERS = [12];

export default function BassGuitarView({ onNoteOn, onNoteOff }) {
  const [activeNotes, setActiveNotes] = useState(new Map()); // stringIndex -> fret
  const [vibratingStrings, setVibratingStrings] = useState(new Set());
  const touchActiveRef = useRef(new Map()); // touchId -> { stringIndex, fret }
  const mouseActiveRef = useRef(null); // { stringIndex, fret } for mouse drag
  const isMouseDownRef = useRef(false);
  const containerRef = useRef(null);

  // Calculate note from string and fret
  const getNote = useCallback((stringIndex, fret) => {
    return STRINGS[stringIndex].openNote + fret;
  }, []);

  // Play a note
  const playNote = useCallback((stringIndex, fret) => {
    const note = getNote(stringIndex, fret);
    
    // Release any existing note on this string
    const existingFret = activeNotes.get(stringIndex);
    if (existingFret !== undefined) {
      const existingNote = getNote(stringIndex, existingFret);
      onNoteOff?.(existingNote);
    }

    // Play new note
    onNoteOn?.(note);

    // Visual feedback
    setActiveNotes(prev => new Map(prev).set(stringIndex, fret));
    setVibratingStrings(prev => new Set(prev).add(stringIndex));

    // Haptic
    if (navigator.vibrate) {
      navigator.vibrate(8);
    }

    // Stop vibration after a bit
    setTimeout(() => {
      setVibratingStrings(prev => {
        const next = new Set(prev);
        next.delete(stringIndex);
        return next;
      });
    }, 300);
  }, [getNote, activeNotes, onNoteOn, onNoteOff]);

  // Release a note
  const releaseNote = useCallback((stringIndex) => {
    const fret = activeNotes.get(stringIndex);
    if (fret !== undefined) {
      const note = getNote(stringIndex, fret);
      onNoteOff?.(note);
      setActiveNotes(prev => {
        const next = new Map(prev);
        next.delete(stringIndex);
        return next;
      });
    }
  }, [getNote, activeNotes, onNoteOff]);

  // Get string and fret from position
  const getPositionFromCoords = useCallback((clientX, clientY) => {
    if (!containerRef.current) return null;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    const stringHeight = rect.height / STRINGS.length;
    const fretWidth = rect.width / (FRET_COUNT + 1);
    
    const stringIndex = Math.floor(y / stringHeight);
    const fret = Math.floor(x / fretWidth);
    
    if (stringIndex < 0 || stringIndex >= STRINGS.length) return null;
    if (fret < 0 || fret > FRET_COUNT) return null;
    
    return { stringIndex, fret };
  }, []);

  // Touch handlers
  const handleTouchStart = useCallback((e) => {
    e.preventDefault();
    
    Array.from(e.changedTouches).forEach(touch => {
      const pos = getPositionFromCoords(touch.clientX, touch.clientY);
      if (pos) {
        touchActiveRef.current.set(touch.identifier, pos);
        playNote(pos.stringIndex, pos.fret);
      }
    });
  }, [getPositionFromCoords, playNote]);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    
    Array.from(e.changedTouches).forEach(touch => {
      const prevPos = touchActiveRef.current.get(touch.identifier);
      const newPos = getPositionFromCoords(touch.clientX, touch.clientY);
      
      if (newPos && prevPos) {
        // Slide to new position
        if (newPos.fret !== prevPos.fret || newPos.stringIndex !== prevPos.stringIndex) {
          // Release old note if changing strings
          if (newPos.stringIndex !== prevPos.stringIndex) {
            releaseNote(prevPos.stringIndex);
          }
          // Play new note
          playNote(newPos.stringIndex, newPos.fret);
          touchActiveRef.current.set(touch.identifier, newPos);
        }
      }
    });
  }, [getPositionFromCoords, playNote, releaseNote]);

  const handleTouchEnd = useCallback((e) => {
    e.preventDefault();
    
    Array.from(e.changedTouches).forEach(touch => {
      const pos = touchActiveRef.current.get(touch.identifier);
      if (pos) {
        releaseNote(pos.stringIndex);
        touchActiveRef.current.delete(touch.identifier);
      }
    });
  }, [releaseNote]);

  // Mouse handlers for desktop - with drag support
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    isMouseDownRef.current = true;
    
    const pos = getPositionFromCoords(e.clientX, e.clientY);
    if (pos) {
      mouseActiveRef.current = pos;
      playNote(pos.stringIndex, pos.fret);
    }
  }, [getPositionFromCoords, playNote]);

  const handleMouseMove = useCallback((e) => {
    if (!isMouseDownRef.current) return;
    
    const prevPos = mouseActiveRef.current;
    const newPos = getPositionFromCoords(e.clientX, e.clientY);
    
    if (newPos && prevPos) {
      // Slide to new position
      if (newPos.fret !== prevPos.fret || newPos.stringIndex !== prevPos.stringIndex) {
        // Release old note if changing strings
        if (newPos.stringIndex !== prevPos.stringIndex) {
          releaseNote(prevPos.stringIndex);
        }
        // Play new note
        playNote(newPos.stringIndex, newPos.fret);
        mouseActiveRef.current = newPos;
      }
    }
  }, [getPositionFromCoords, playNote, releaseNote]);

  const handleMouseUp = useCallback(() => {
    if (mouseActiveRef.current) {
      releaseNote(mouseActiveRef.current.stringIndex);
      mouseActiveRef.current = null;
    }
    isMouseDownRef.current = false;
  }, [releaseNote]);

  const handleMouseLeave = useCallback(() => {
    if (isMouseDownRef.current && mouseActiveRef.current) {
      releaseNote(mouseActiveRef.current.stringIndex);
      mouseActiveRef.current = null;
    }
    isMouseDownRef.current = false;
  }, [releaseNote]);

  // Global mouse up listener to handle mouse release outside component
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isMouseDownRef.current && mouseActiveRef.current) {
        releaseNote(mouseActiveRef.current.stringIndex);
        mouseActiveRef.current = null;
      }
      isMouseDownRef.current = false;
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [releaseNote]);

  return (
    <div 
      className="w-full h-full flex flex-col items-center justify-center p-4"
      style={{ touchAction: 'none' }}
    >
      {/* Bass neck */}
      <motion.div
        ref={containerRef}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-2xl aspect-[3/1] relative rounded-2xl overflow-hidden cursor-pointer select-none"
        style={{
          background: 'linear-gradient(180deg, #2d1810 0%, #1a0f0a 50%, #0d0705 100%)'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Fret wires */}
        {Array.from({ length: FRET_COUNT + 1 }).map((_, i) => (
          <div
            key={`fret-${i}`}
            className="absolute top-0 bottom-0 w-[2px] pointer-events-none"
            style={{
              left: `${(i / (FRET_COUNT + 1)) * 100}%`,
              background: i === 0 
                ? 'linear-gradient(180deg, #f5f5dc, #d4af37, #f5f5dc)'
                : 'linear-gradient(180deg, #c0c0c0 0%, #808080 50%, #c0c0c0 100%)',
              boxShadow: i === 0 ? '0 0 4px rgba(212, 175, 55, 0.5)' : 'none'
            }}
          />
        ))}

        {/* Fret markers */}
        {FRET_MARKERS.map(fret => {
          const isDouble = DOUBLE_MARKERS.includes(fret);
          return (
            <React.Fragment key={`marker-${fret}`}>
              <div
                className="absolute w-3 h-3 rounded-full bg-amber-100/30 pointer-events-none"
                style={{
                  left: `${((fret - 0.5) / (FRET_COUNT + 1)) * 100}%`,
                  top: isDouble ? '25%' : '50%',
                  transform: 'translate(-50%, -50%)'
                }}
              />
              {isDouble && (
                <div
                  className="absolute w-3 h-3 rounded-full bg-amber-100/30 pointer-events-none"
                  style={{
                    left: `${((fret - 0.5) / (FRET_COUNT + 1)) * 100}%`,
                    top: '75%',
                    transform: 'translate(-50%, -50%)'
                  }}
                />
              )}
            </React.Fragment>
          );
        })}

        {/* Strings */}
        {STRINGS.map((string, stringIndex) => {
          const activeFret = activeNotes.get(stringIndex);
          const isVibrating = vibratingStrings.has(stringIndex);
          const stringY = ((stringIndex + 0.5) / STRINGS.length) * 100;
          const stringThickness = 3 + (stringIndex * 1.5); // Thicker for lower strings

          return (
            <div key={string.name} className="absolute left-0 right-0 pointer-events-none" style={{ top: `${stringY}%` }}>
              {/* String base */}
              <motion.div
                animate={isVibrating ? {
                  y: [0, -2, 2, -1, 1, 0],
                } : {}}
                transition={{ duration: 0.3, repeat: isVibrating ? Infinity : 0 }}
                className="absolute left-0 right-0"
                style={{
                  height: stringThickness,
                  top: -stringThickness / 2,
                  background: `linear-gradient(180deg, 
                    rgba(192, 192, 192, 0.9) 0%, 
                    rgba(128, 128, 128, 1) 50%, 
                    rgba(64, 64, 64, 0.9) 100%)`,
                  boxShadow: isVibrating 
                    ? `0 0 10px rgba(255, 200, 100, 0.6), 0 0 20px rgba(255, 200, 100, 0.3)`
                    : '0 2px 4px rgba(0, 0, 0, 0.5)'
                }}
              />

              {/* Finger position indicators for each fret */}
              {Array.from({ length: FRET_COUNT + 1 }).map((_, fret) => {
                const isActive = activeFret === fret;
                return (
                  <AnimatePresence key={fret}>
                    {isActive && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        className="absolute w-8 h-8 rounded-full pointer-events-none"
                        style={{
                          left: `${((fret + 0.5) / (FRET_COUNT + 1)) * 100}%`,
                          top: '50%',
                          transform: 'translate(-50%, -50%)',
                          background: `radial-gradient(circle, rgba(255, 200, 100, 0.8) 0%, rgba(255, 150, 50, 0.4) 50%, transparent 100%)`,
                          boxShadow: '0 0 15px rgba(255, 200, 100, 0.6)'
                        }}
                      />
                    )}
                  </AnimatePresence>
                );
              })}

              {/* String name label */}
              <div 
                className="absolute right-2 text-xs font-bold text-amber-200/50"
                style={{ top: -8 }}
              >
                {string.name}
              </div>
            </div>
          );
        })}

        {/* Fret numbers */}
        <div className="absolute bottom-2 left-0 right-0 flex pointer-events-none">
          {Array.from({ length: FRET_COUNT + 1 }).map((_, fret) => (
            <div
              key={fret}
              className="flex-1 text-center text-[10px] text-amber-200/30"
            >
              {fret}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Note display */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-6 flex items-center gap-4"
      >
        {STRINGS.map((string, idx) => {
          const fret = activeNotes.get(idx);
          const note = fret !== undefined ? getNote(idx, fret) : null;
          const noteName = note !== null ? getNoteNameFromMidi(note) : '-';
          
          return (
            <div
              key={string.name}
              className={`
                w-16 h-16 rounded-xl flex flex-col items-center justify-center
                transition-all duration-150
                ${fret !== undefined 
                  ? `bg-gradient-to-br ${string.color} shadow-lg scale-105` 
                  : 'bg-white/5'
                }
              `}
            >
              <span className="text-white/50 text-xs">{string.name}</span>
              <span className={`text-lg font-bold ${fret !== undefined ? 'text-white' : 'text-white/30'}`}>
                {noteName}
              </span>
            </div>
          );
        })}
      </motion.div>

      {/* Instructions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-4 px-4 py-2 bg-black/40 backdrop-blur-sm rounded-full"
      >
        <p className="text-white/50 text-xs text-center">
          Click & drag to play • Slide along strings for notes
        </p>
      </motion.div>
    </div>
  );
}

// Helper function to get note name from MIDI number
function getNoteNameFromMidi(midi) {
  const notes = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  return `${notes[midi % 12]}${octave}`;
}
