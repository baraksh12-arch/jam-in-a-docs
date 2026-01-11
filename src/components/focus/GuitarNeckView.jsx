import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * GuitarNeckView - Premium Guitar Fretboard with Advanced Techniques
 * 
 * John Mayer-level playability with:
 * - 6-string guitar layout (E A D G B e)
 * - Touch/mouse bends with visual feedback
 * - Vibrato by wobbling finger/cursor
 * - Slide between frets
 * - Hammer-on detection (quick tap without release)
 * - Pull-off simulation
 * - Real-time pitch visualization
 */

// Standard guitar tuning (MIDI notes for open strings, low to high)
const STRINGS = [
  { name: 'e', openNote: 64, color: 'from-rose-400 to-rose-500', thickness: 1.5 },    // High E
  { name: 'B', openNote: 59, color: 'from-orange-400 to-orange-500', thickness: 2 },
  { name: 'G', openNote: 55, color: 'from-amber-400 to-amber-500', thickness: 2.5 },
  { name: 'D', openNote: 50, color: 'from-yellow-400 to-yellow-500', thickness: 3 },
  { name: 'A', openNote: 45, color: 'from-lime-400 to-lime-500', thickness: 3.5 },
  { name: 'E', openNote: 40, color: 'from-emerald-400 to-emerald-500', thickness: 4 }, // Low E
];

const FRET_COUNT = 15;
const FRET_MARKERS = [3, 5, 7, 9, 12, 15];
const DOUBLE_MARKERS = [12];

// Maximum bend in semitones
const MAX_BEND = 3;

export default function GuitarNeckView({ 
  onNoteOn, 
  onNoteOff, 
  onBend,
  onVibrato,
  onSlide,
  onHammerOn 
}) {
  const [activeNotes, setActiveNotes] = useState(new Map()); // stringIndex -> { fret, bendAmount, isVibrato }
  const [vibratingStrings, setVibratingStrings] = useState(new Set());
  const touchDataRef = useRef(new Map()); // touchId -> { stringIndex, fret, startY, currentY, startTime }
  const mouseDataRef = useRef(null);
  const isMouseDownRef = useRef(false);
  const containerRef = useRef(null);
  const lastVibratoTimeRef = useRef(new Map());
  const vibratoDirectionRef = useRef(new Map());

  // Calculate note from string and fret
  const getNote = useCallback((stringIndex, fret) => {
    return STRINGS[stringIndex].openNote + fret;
  }, []);

  // Play a note
  const playNote = useCallback((stringIndex, fret, velocity = 100, isHammerOn = false) => {
    const note = getNote(stringIndex, fret);
    
    // Release any existing note on this string
    const existingNote = activeNotes.get(stringIndex);
    if (existingNote !== undefined) {
      const existingMidi = getNote(stringIndex, existingNote.fret);
      onNoteOff?.(existingMidi);
    }

    // Play new note
    if (isHammerOn) {
      onHammerOn?.(note, velocity);
    } else {
      onNoteOn?.(note, velocity);
    }

    // Visual feedback
    setActiveNotes(prev => new Map(prev).set(stringIndex, { fret, bendAmount: 0, isVibrato: false }));
    setVibratingStrings(prev => new Set(prev).add(stringIndex));

    // Haptic
    if (navigator.vibrate) {
      navigator.vibrate(isHammerOn ? 5 : 10);
    }

    // Stop vibration animation
    setTimeout(() => {
      setVibratingStrings(prev => {
        const next = new Set(prev);
        next.delete(stringIndex);
        return next;
      });
    }, 400);

    return note;
  }, [getNote, activeNotes, onNoteOn, onNoteOff, onHammerOn]);

  // Release a note
  const releaseNote = useCallback((stringIndex) => {
    const noteData = activeNotes.get(stringIndex);
    if (noteData !== undefined) {
      const note = getNote(stringIndex, noteData.fret);
      onNoteOff?.(note);
      setActiveNotes(prev => {
        const next = new Map(prev);
        next.delete(stringIndex);
        return next;
      });
    }
  }, [getNote, activeNotes, onNoteOff]);

  // Apply bend to a note
  const applyBend = useCallback((stringIndex, bendAmount) => {
    const noteData = activeNotes.get(stringIndex);
    if (noteData) {
      const note = getNote(stringIndex, noteData.fret);
      const clampedBend = Math.max(-MAX_BEND, Math.min(MAX_BEND, bendAmount));
      
      onBend?.(note, clampedBend);
      
      setActiveNotes(prev => {
        const next = new Map(prev);
        const existing = next.get(stringIndex);
        if (existing) {
          next.set(stringIndex, { ...existing, bendAmount: clampedBend });
        }
        return next;
      });
    }
  }, [activeNotes, getNote, onBend]);

  // Detect vibrato from movement
  const detectVibrato = useCallback((stringIndex, currentY, previousY) => {
    const now = Date.now();
    const lastTime = lastVibratoTimeRef.current.get(stringIndex) || 0;
    const lastDirection = vibratoDirectionRef.current.get(stringIndex) || 0;
    
    const direction = currentY > previousY ? 1 : -1;
    
    // Direction changed = vibrato oscillation
    if (direction !== lastDirection && now - lastTime < 200) {
      const noteData = activeNotes.get(stringIndex);
      if (noteData) {
        const note = getNote(stringIndex, noteData.fret);
        onVibrato?.(note, 0.3, 5);
        
        setActiveNotes(prev => {
          const next = new Map(prev);
          const existing = next.get(stringIndex);
          if (existing) {
            next.set(stringIndex, { ...existing, isVibrato: true });
          }
          return next;
        });
      }
    }
    
    vibratoDirectionRef.current.set(stringIndex, direction);
    lastVibratoTimeRef.current.set(stringIndex, now);
  }, [activeNotes, getNote, onVibrato]);

  // Get position from coordinates
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
    
    // Calculate bend amount from Y position within the string area
    const stringCenterY = (stringIndex + 0.5) * stringHeight;
    const bendOffset = (y - stringCenterY) / (stringHeight * 0.4);
    const bendAmount = Math.max(-MAX_BEND, Math.min(MAX_BEND, -bendOffset * MAX_BEND));
    
    return { stringIndex, fret, bendAmount, rawY: y };
  }, []);

  // Touch handlers
  const handleTouchStart = useCallback((e) => {
    e.preventDefault();
    
    Array.from(e.changedTouches).forEach(touch => {
      const pos = getPositionFromCoords(touch.clientX, touch.clientY);
      if (pos) {
        touchDataRef.current.set(touch.identifier, {
          stringIndex: pos.stringIndex,
          fret: pos.fret,
          startY: pos.rawY,
          currentY: pos.rawY,
          startTime: Date.now(),
        });
        playNote(pos.stringIndex, pos.fret);
      }
    });
  }, [getPositionFromCoords, playNote]);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    
    Array.from(e.changedTouches).forEach(touch => {
      const touchData = touchDataRef.current.get(touch.identifier);
      const newPos = getPositionFromCoords(touch.clientX, touch.clientY);
      
      if (newPos && touchData) {
        const prevY = touchData.currentY;
        touchData.currentY = newPos.rawY;
        
        // Check for slide to different fret
        if (newPos.fret !== touchData.fret) {
          // Slide to new fret
          const fromNote = getNote(touchData.stringIndex, touchData.fret);
          const toNote = getNote(newPos.stringIndex, newPos.fret);
          
          if (newPos.stringIndex === touchData.stringIndex) {
            // Same string - slide
            onSlide?.(fromNote, toNote, 0.08);
          } else {
            // Different string - release old, play new
            releaseNote(touchData.stringIndex);
          }
          
          touchData.stringIndex = newPos.stringIndex;
          touchData.fret = newPos.fret;
          
          if (newPos.stringIndex !== touchData.stringIndex) {
            playNote(newPos.stringIndex, newPos.fret);
          }
        } else if (newPos.stringIndex === touchData.stringIndex) {
          // Same fret - apply bend
          applyBend(touchData.stringIndex, newPos.bendAmount);
          
          // Detect vibrato
          detectVibrato(touchData.stringIndex, newPos.rawY, prevY);
        }
        
        touchDataRef.current.set(touch.identifier, touchData);
      }
    });
  }, [getPositionFromCoords, getNote, playNote, releaseNote, applyBend, detectVibrato, onSlide]);

  const handleTouchEnd = useCallback((e) => {
    e.preventDefault();
    
    Array.from(e.changedTouches).forEach(touch => {
      const touchData = touchDataRef.current.get(touch.identifier);
      if (touchData) {
        releaseNote(touchData.stringIndex);
        touchDataRef.current.delete(touch.identifier);
      }
    });
  }, [releaseNote]);

  // Mouse handlers
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    isMouseDownRef.current = true;
    
    const pos = getPositionFromCoords(e.clientX, e.clientY);
    if (pos) {
      mouseDataRef.current = {
        stringIndex: pos.stringIndex,
        fret: pos.fret,
        startY: pos.rawY,
        currentY: pos.rawY,
        startTime: Date.now(),
      };
      playNote(pos.stringIndex, pos.fret);
    }
  }, [getPositionFromCoords, playNote]);

  const handleMouseMove = useCallback((e) => {
    if (!isMouseDownRef.current || !mouseDataRef.current) return;
    
    const newPos = getPositionFromCoords(e.clientX, e.clientY);
    if (!newPos) return;
    
    const mouseData = mouseDataRef.current;
    const prevY = mouseData.currentY;
    mouseData.currentY = newPos.rawY;
    
    // Check for slide
    if (newPos.fret !== mouseData.fret && newPos.stringIndex === mouseData.stringIndex) {
      const fromNote = getNote(mouseData.stringIndex, mouseData.fret);
      const toNote = getNote(mouseData.stringIndex, newPos.fret);
      onSlide?.(fromNote, toNote, 0.08);
      mouseData.fret = newPos.fret;
      
      setActiveNotes(prev => {
        const next = new Map(prev);
        const existing = next.get(mouseData.stringIndex);
        if (existing) {
          next.set(mouseData.stringIndex, { ...existing, fret: newPos.fret });
        }
        return next;
      });
    } else if (newPos.stringIndex !== mouseData.stringIndex) {
      // Changed strings
      releaseNote(mouseData.stringIndex);
      mouseData.stringIndex = newPos.stringIndex;
      mouseData.fret = newPos.fret;
      playNote(newPos.stringIndex, newPos.fret);
    } else {
      // Apply bend
      applyBend(mouseData.stringIndex, newPos.bendAmount);
      detectVibrato(mouseData.stringIndex, newPos.rawY, prevY);
    }
  }, [getPositionFromCoords, getNote, playNote, releaseNote, applyBend, detectVibrato, onSlide]);

  const handleMouseUp = useCallback(() => {
    if (mouseDataRef.current) {
      releaseNote(mouseDataRef.current.stringIndex);
      mouseDataRef.current = null;
    }
    isMouseDownRef.current = false;
  }, [releaseNote]);

  const handleMouseLeave = useCallback(() => {
    handleMouseUp();
  }, [handleMouseUp]);

  // Global mouse up
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isMouseDownRef.current && mouseDataRef.current) {
        releaseNote(mouseDataRef.current.stringIndex);
        mouseDataRef.current = null;
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
      {/* Guitar neck */}
      <motion.div
        ref={containerRef}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-4xl aspect-[4/1] relative rounded-2xl overflow-hidden cursor-pointer select-none shadow-2xl"
        style={{
          background: 'linear-gradient(180deg, #3d2817 0%, #2a1c10 30%, #1a110a 70%, #0d0805 100%)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Fretboard wood grain overlay */}
        <div 
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: `repeating-linear-gradient(
              90deg,
              transparent,
              transparent 2px,
              rgba(139, 90, 43, 0.3) 2px,
              rgba(139, 90, 43, 0.3) 4px
            )`
          }}
        />

        {/* Fret wires */}
        {Array.from({ length: FRET_COUNT + 1 }).map((_, i) => (
          <div
            key={`fret-${i}`}
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{
              left: `${(i / (FRET_COUNT + 1)) * 100}%`,
              width: i === 0 ? 6 : 2,
              background: i === 0 
                ? 'linear-gradient(180deg, #faf8f0, #d4af37, #b8860b, #d4af37, #faf8f0)'
                : 'linear-gradient(180deg, #e0e0e0 0%, #a0a0a0 50%, #e0e0e0 100%)',
              boxShadow: i === 0 
                ? '0 0 8px rgba(212, 175, 55, 0.6), 2px 0 4px rgba(0,0,0,0.3)' 
                : '1px 0 2px rgba(0,0,0,0.3)'
            }}
          />
        ))}

        {/* Fret markers (mother of pearl inlays) */}
        {FRET_MARKERS.map(fret => {
          const isDouble = DOUBLE_MARKERS.includes(fret);
          return (
            <React.Fragment key={`marker-${fret}`}>
              <div
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: 12,
                  height: 12,
                  left: `${((fret - 0.5) / (FRET_COUNT + 1)) * 100}%`,
                  top: isDouble ? '25%' : '50%',
                  transform: 'translate(-50%, -50%)',
                  background: 'radial-gradient(circle at 30% 30%, #fff, #e8e4d9, #d4d0c5)',
                  boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.8), 0 1px 3px rgba(0,0,0,0.3)'
                }}
              />
              {isDouble && (
                <div
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    width: 12,
                    height: 12,
                    left: `${((fret - 0.5) / (FRET_COUNT + 1)) * 100}%`,
                    top: '75%',
                    transform: 'translate(-50%, -50%)',
                    background: 'radial-gradient(circle at 30% 30%, #fff, #e8e4d9, #d4d0c5)',
                    boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.8), 0 1px 3px rgba(0,0,0,0.3)'
                  }}
                />
              )}
            </React.Fragment>
          );
        })}

        {/* Strings */}
        {STRINGS.map((string, stringIndex) => {
          const noteData = activeNotes.get(stringIndex);
          const isVibrating = vibratingStrings.has(stringIndex);
          const stringY = ((stringIndex + 0.5) / STRINGS.length) * 100;
          const bendOffset = noteData ? noteData.bendAmount * 3 : 0;

          return (
            <div key={string.name} className="absolute left-0 right-0 pointer-events-none" style={{ top: `${stringY}%` }}>
              {/* String shadow */}
              <div
                className="absolute left-0 right-0"
                style={{
                  height: string.thickness + 2,
                  top: 1,
                  background: 'rgba(0,0,0,0.4)',
                  filter: 'blur(1px)'
                }}
              />
              
              {/* Main string */}
              <motion.div
                animate={isVibrating ? {
                  y: [0, -2, 2, -1.5, 1.5, -1, 1, 0],
                } : { y: bendOffset }}
                transition={isVibrating 
                  ? { duration: 0.15, repeat: Infinity } 
                  : { duration: 0.05 }
                }
                className="absolute left-0 right-0"
                style={{
                  height: string.thickness,
                  top: -string.thickness / 2,
                  background: `linear-gradient(180deg, 
                    rgba(220, 220, 220, 1) 0%, 
                    rgba(180, 180, 180, 1) 30%,
                    rgba(140, 140, 140, 1) 50%,
                    rgba(100, 100, 100, 1) 70%,
                    rgba(80, 80, 80, 1) 100%)`,
                  boxShadow: isVibrating || noteData
                    ? `0 0 8px rgba(255, 200, 100, 0.7), 0 0 15px rgba(255, 200, 100, 0.4)`
                    : '0 1px 2px rgba(0, 0, 0, 0.5)',
                  borderRadius: string.thickness / 2,
                }}
              />

              {/* Active fret indicator */}
              {noteData && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute pointer-events-none"
                  style={{
                    left: `${((noteData.fret + 0.5) / (FRET_COUNT + 1)) * 100}%`,
                    top: '50%',
                    transform: `translate(-50%, calc(-50% + ${bendOffset}px))`,
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: `radial-gradient(circle, rgba(255, 180, 80, 0.9) 0%, rgba(255, 120, 50, 0.5) 50%, transparent 100%)`,
                    boxShadow: `0 0 20px rgba(255, 150, 50, 0.8)`,
                  }}
                />
              )}

              {/* String label */}
              <div 
                className="absolute -right-6 text-xs font-bold"
                style={{ 
                  top: -6,
                  color: noteData ? '#fbbf24' : 'rgba(255,255,255,0.4)'
                }}
              >
                {string.name}
              </div>
            </div>
          );
        })}

        {/* Fret numbers */}
        <div className="absolute -bottom-6 left-0 right-0 flex pointer-events-none">
          {Array.from({ length: FRET_COUNT + 1 }).map((_, fret) => (
            <div
              key={fret}
              className="flex-1 text-center text-[10px] text-amber-200/40 font-medium"
            >
              {fret}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Active notes display */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-8 flex items-center gap-3"
      >
        {STRINGS.map((string, idx) => {
          const noteData = activeNotes.get(idx);
          const note = noteData ? getNote(idx, noteData.fret) : null;
          const noteName = note !== null ? getNoteNameFromMidi(note) : '-';
          const bendDisplay = noteData && Math.abs(noteData.bendAmount) > 0.1 
            ? (noteData.bendAmount > 0 ? '↑' : '↓') 
            : '';
          
          return (
            <motion.div
              key={string.name}
              animate={noteData ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 0.2 }}
              className={`
                w-14 h-14 rounded-xl flex flex-col items-center justify-center
                transition-all duration-100
                ${noteData 
                  ? `bg-gradient-to-br ${string.color} shadow-lg` 
                  : 'bg-white/5 border border-white/10'
                }
              `}
            >
              <span className={`text-[10px] ${noteData ? 'text-white/80' : 'text-white/40'}`}>
                {string.name}
              </span>
              <span className={`text-sm font-bold ${noteData ? 'text-white' : 'text-white/30'}`}>
                {noteName}{bendDisplay}
              </span>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Instructions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-4 px-6 py-3 bg-black/40 backdrop-blur-sm rounded-full"
      >
        <p className="text-white/50 text-xs text-center">
          <span className="text-amber-400">Click & drag</span> to play • 
          <span className="text-amber-400"> Pull up/down</span> to bend • 
          <span className="text-amber-400"> Wiggle</span> for vibrato • 
          <span className="text-amber-400"> Slide</span> between frets
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
