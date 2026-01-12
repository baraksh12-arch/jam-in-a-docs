import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * PianoWithPadsView - Piano keyboard + 5 chord pads above
 * 
 * Premium piano interface with:
 * - Full keyboard (similar to FullscreenKeyboard)
 * - 5 programmable chord pads above the keyboard
 * - Smooth animations and haptic feedback
 */

// Chord pads configuration - 5 pads above the keyboard
const CHORD_PADS = [
  { 
    id: 'pad1', 
    label: 'I', 
    key: '1', 
    chord: 'C', 
    notes: [60, 64, 67], // C major
    baseColor: 'rgba(139, 92, 246, 0.15)',
    glowColor: 'rgba(139, 92, 246, 0.5)',
    accentColor: '#8b5cf6',
    lightColor: 'rgba(196, 181, 253, 0.9)',
  },
  { 
    id: 'pad2', 
    label: 'IV', 
    key: '2', 
    chord: 'F', 
    notes: [65, 69, 72], // F major
    baseColor: 'rgba(236, 72, 153, 0.15)',
    glowColor: 'rgba(236, 72, 153, 0.5)',
    accentColor: '#ec4899',
    lightColor: 'rgba(251, 207, 232, 0.9)',
  },
  { 
    id: 'pad3', 
    label: 'V', 
    key: '3', 
    chord: 'G', 
    notes: [67, 71, 74], // G major
    baseColor: 'rgba(34, 211, 238, 0.15)',
    glowColor: 'rgba(34, 211, 238, 0.5)',
    accentColor: '#22d3ee',
    lightColor: 'rgba(165, 243, 252, 0.9)',
  },
  { 
    id: 'pad4', 
    label: 'vi', 
    key: '4', 
    chord: 'Am', 
    notes: [69, 72, 76], // A minor
    baseColor: 'rgba(251, 146, 60, 0.15)',
    glowColor: 'rgba(251, 146, 60, 0.5)',
    accentColor: '#fb923c',
    lightColor: 'rgba(254, 215, 170, 0.9)',
  },
  { 
    id: 'pad5', 
    label: 'ii', 
    key: '5', 
    chord: 'Dm', 
    notes: [62, 65, 69], // D minor
    baseColor: 'rgba(74, 222, 128, 0.15)',
    glowColor: 'rgba(74, 222, 128, 0.5)',
    accentColor: '#4ade80',
    lightColor: 'rgba(187, 247, 208, 0.9)',
  }
];

// Piano range
const PIANO_RANGE = { start: 36, end: 84 }; // C2 to C6 (4 octaves)

// Key mapping
const KEY_MAP = {
  'z': 0, 'x': 2, 'c': 4, 'v': 5, 'b': 7, 'n': 9, 'm': 11, ',': 12, '.': 14,
  's': 1, 'd': 3, 'g': 6, 'h': 8, 'j': 10, 'l': 13,
  'q': 12, 'w': 14, 'e': 16, 'r': 17, 't': 19, 'y': 21, 'u': 23, 'i': 24,
  '2': 13, '3': 15, '5': 18, '6': 20, '7': 22,
};

const isBlackKey = (midiNote) => [1, 3, 6, 8, 10].includes(midiNote % 12);

const getNoteName = (midiNote) => {
  const noteNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const octave = Math.floor(midiNote / 12) - 1;
  return { note: noteNames[midiNote % 12], octave };
};

// Chord Pad Component
const ChordPad = ({ pad, isActive, onTrigger, onRelease, index }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const handlePress = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    onTrigger(pad.id, pad.notes);
  }, [pad.id, pad.notes, onTrigger]);
  
  const handleRelease = useCallback((e) => {
    e.preventDefault();
    onRelease(pad.id, pad.notes);
  }, [pad.id, pad.notes, onRelease]);
  
  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ 
        delay: index * 0.05,
        type: "spring",
        stiffness: 350,
        damping: 28
      }}
      onPointerDown={handlePress}
      onPointerUp={handleRelease}
      onPointerLeave={handleRelease}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="relative overflow-hidden touch-none select-none cursor-pointer flex-1"
      style={{
        background: `
          linear-gradient(
            145deg, 
            rgba(255, 255, 255, 0.14) 0%,
            rgba(255, 255, 255, 0.06) 50%,
            rgba(255, 255, 255, 0.02) 100%
          )
        `,
        backdropFilter: 'blur(32px) saturate(180%)',
        borderRadius: '20px',
        border: '1px solid rgba(255, 255, 255, 0.22)',
        boxShadow: `
          0 8px 32px rgba(0, 0, 0, 0.18),
          0 4px 16px rgba(0, 0, 0, 0.12),
          inset 0 1px 0 rgba(255, 255, 255, 0.25)
        `,
        touchAction: 'none',
        minHeight: '80px',
      }}
    >
      {/* Glass highlight */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            linear-gradient(
              180deg, 
              rgba(255, 255, 255, 0.28) 0%, 
              rgba(255, 255, 255, 0.1) 20%,
              transparent 50%
            )
          `,
          borderRadius: '18px',
        }}
      />
      
      {/* Ambient glow */}
      <div 
        className="absolute inset-0 pointer-events-none flex items-center justify-center"
      >
        <motion.div
          animate={{
            opacity: isHovered ? 0.75 : 0.5,
            scale: isHovered ? 1.2 : 1,
          }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          style={{
            width: '60%',
            height: '60%',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${pad.glowColor} 0%, ${pad.baseColor} 40%, transparent 70%)`,
            filter: 'blur(12px)',
          }}
        />
      </div>
      
      {/* Active state */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.06 }}
            className="absolute inset-0 pointer-events-none"
            style={{ borderRadius: '18px', overflow: 'hidden' }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `
                  radial-gradient(
                    circle at 50% 50%,
                    rgba(255, 255, 255, 0.98) 0%,
                    ${pad.lightColor} 12%,
                    ${pad.accentColor} 30%,
                    ${pad.glowColor} 50%,
                    transparent 75%
                  )
                `,
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `${pad.accentColor}40`,
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full p-3">
        <motion.span 
          className="font-black text-2xl md:text-3xl"
          style={{ 
            color: isActive ? pad.accentColor : 'rgba(255, 255, 255, 0.9)',
            textShadow: isActive 
              ? `0 0 20px ${pad.accentColor}, 0 0 40px ${pad.glowColor}` 
              : '0 2px 4px rgba(0, 0, 0, 0.3)',
          }}
          animate={{
            scale: isActive ? 1.1 : 1,
          }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        >
          {pad.chord}
        </motion.span>
        <span 
          className="text-xs mt-1 opacity-60 font-mono"
          style={{ color: 'rgba(255, 255, 255, 0.5)' }}
        >
          [{pad.key}]
        </span>
      </div>
      
      {/* Active glow ring */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            className="absolute -inset-[2px] pointer-events-none"
            style={{
              borderRadius: '22px',
              boxShadow: `
                0 0 20px ${pad.glowColor},
                0 0 40px ${pad.glowColor}60,
                inset 0 0 15px ${pad.glowColor}40
              `,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.08 }}
          />
        )}
      </AnimatePresence>
    </motion.button>
  );
};

export default function PianoWithPadsView({ 
  instrument, 
  onNoteOn, 
  onNoteOff,
  focusModeActive = true,
  viewOnly = false
}) {
  const [activeNotes, setActiveNotes] = useState(new Set());
  const [activePads, setActivePads] = useState(new Set());
  const [octaveOffset, setOctaveOffset] = useState(0);
  const touchActiveRef = useRef(false);
  const currentTouchesRef = useRef(new Map());
  const containerRef = useRef(null);
  const activeChordNotesRef = useRef(new Map()); // Track notes for each pad
  
  const range = PIANO_RANGE;
  
  // Generate all notes
  const allNotes = useMemo(() => {
    const notes = [];
    for (let i = range.start; i <= range.end; i++) {
      notes.push(i);
    }
    return notes;
  }, [range]);
  
  const whiteNotes = allNotes.filter(n => !isBlackKey(n));
  const blackNotes = allNotes.filter(n => isBlackKey(n));
  
  const totalOctaves = Math.ceil((range.end - range.start) / 12);
  const maxOctaveOffset = Math.max(0, totalOctaves - 2);

  // Chord pad handlers
  const handlePadTrigger = useCallback((padId, notes) => {
    if (viewOnly) return;
    
    // Play all notes in the chord
    notes.forEach(note => {
      onNoteOn?.(note);
    });
    
    // Track which notes belong to this pad
    activeChordNotesRef.current.set(padId, notes);
    
    setActivePads(prev => new Set(prev).add(padId));
    setActiveNotes(prev => {
      const next = new Set(prev);
      notes.forEach(note => next.add(note));
      return next;
    });
    
    if (navigator.vibrate) navigator.vibrate(15);
  }, [onNoteOn, viewOnly]);
  
  const handlePadRelease = useCallback((padId, notes) => {
    // Release all notes in the chord
    notes.forEach(note => {
      onNoteOff?.(note);
    });
    
    activeChordNotesRef.current.delete(padId);
    
    setActivePads(prev => {
      const next = new Set(prev);
      next.delete(padId);
      return next;
    });
    setActiveNotes(prev => {
      const next = new Set(prev);
      notes.forEach(note => next.delete(note));
      return next;
    });
  }, [onNoteOff]);

  // Piano key handlers
  const handleNoteOn = useCallback((note) => {
    if (!focusModeActive || viewOnly) return;
    if (activeNotes.has(note)) return;
    
    onNoteOn?.(note);
    if (navigator.vibrate) navigator.vibrate(10);
    setActiveNotes(prev => new Set(prev).add(note));
  }, [onNoteOn, focusModeActive, viewOnly, activeNotes]);

  const handleNoteOff = useCallback((note) => {
    if (!activeNotes.has(note)) return;
    
    onNoteOff?.(note);
    setActiveNotes(prev => {
      const next = new Set(prev);
      next.delete(note);
      return next;
    });
  }, [onNoteOff, activeNotes]);

  // Touch handlers for piano
  const handleTouchStart = useCallback((e) => {
    if (viewOnly) return;
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
  }, [handleNoteOn, viewOnly]);

  const handleTouchMove = useCallback((e) => {
    if (viewOnly) return;
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
  }, [handleNoteOn, handleNoteOff, viewOnly]);

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
    if (touchActiveRef.current || viewOnly) return;
    handleNoteOn(note);
  };

  const handleMouseUp = (note) => {
    if (touchActiveRef.current || viewOnly) return;
    handleNoteOff(note);
  };

  // Keyboard input
  useEffect(() => {
    if (!focusModeActive || viewOnly) return;
    
    const baseNote = range.start + (octaveOffset * 12);
    
    const handleKeyDown = (e) => {
      if (e.repeat || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      // Chord pad keys
      const padIndex = ['1', '2', '3', '4', '5'].indexOf(e.key);
      if (padIndex >= 0) {
        e.preventDefault();
        const pad = CHORD_PADS[padIndex];
        if (pad && !activePads.has(pad.id)) {
          handlePadTrigger(pad.id, pad.notes);
        }
        return;
      }
      
      // Octave controls
      if (e.key === 'ArrowUp' || e.key === ']') {
        setOctaveOffset(prev => Math.min(prev + 1, maxOctaveOffset));
        return;
      }
      if (e.key === 'ArrowDown' || e.key === '[') {
        setOctaveOffset(prev => Math.max(prev - 1, 0));
        return;
      }
      
      // Piano keys
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
      // Chord pad release
      const padIndex = ['1', '2', '3', '4', '5'].indexOf(e.key);
      if (padIndex >= 0) {
        const pad = CHORD_PADS[padIndex];
        if (pad) {
          handlePadRelease(pad.id, pad.notes);
        }
        return;
      }
      
      // Piano key release
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
  }, [focusModeActive, viewOnly, octaveOffset, range, maxOctaveOffset, activeNotes, activePads, handleNoteOn, handleNoteOff, handlePadTrigger, handlePadRelease]);

  // Key dimensions
  const whiteKeyWidth = 48;
  const whiteKeyHeight = 180;
  const blackKeyWidth = 28;
  const blackKeyHeight = 110;
  const keyboardWidth = whiteNotes.length * (whiteKeyWidth + 1);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4 gap-4">
      {/* Chord Pads - 5 pads in a row above keyboard */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex gap-3 w-full max-w-2xl px-4"
        style={{ touchAction: 'none' }}
      >
        {CHORD_PADS.map((pad, index) => (
          <ChordPad
            key={pad.id}
            pad={pad}
            isActive={activePads.has(pad.id)}
            onTrigger={handlePadTrigger}
            onRelease={handlePadRelease}
            index={index}
          />
        ))}
      </motion.div>

      {/* Octave Control */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex items-center gap-4"
      >
        <button
          onClick={() => setOctaveOffset(prev => Math.max(prev - 1, 0))}
          disabled={octaveOffset === 0 || viewOnly}
          className="
            px-3 py-1.5 rounded-lg font-semibold text-xs
            bg-white/5 border border-white/10 text-white/70
            hover:bg-white/10 hover:text-white
            disabled:opacity-30 disabled:cursor-not-allowed
            transition-all duration-200
          "
        >
          ◀ Lower
        </button>
        
        <div className="px-4 py-1.5 bg-white/5 backdrop-blur-xl rounded-lg border border-white/10">
          <span className="text-white/40 text-xs mr-2">Oct</span>
          <span className="text-white font-bold">{octaveOffset + 2}</span>
        </div>
        
        <button
          onClick={() => setOctaveOffset(prev => Math.min(prev + 1, maxOctaveOffset))}
          disabled={octaveOffset >= maxOctaveOffset || viewOnly}
          className="
            px-3 py-1.5 rounded-lg font-semibold text-xs
            bg-white/5 border border-white/10 text-white/70
            hover:bg-white/10 hover:text-white
            disabled:opacity-30 disabled:cursor-not-allowed
            transition-all duration-200
          "
        >
          Higher ▶
        </button>
      </motion.div>

      {/* Piano Keyboard */}
      <motion.div 
        ref={containerRef}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="relative overflow-x-auto overflow-y-visible max-w-full"
        style={{ 
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.2) transparent'
        }}
      >
        {/* Piano frame */}
        <div 
          className="relative rounded-xl p-3 pt-2"
          style={{
            background: 'linear-gradient(180deg, #1a1a1f 0%, #0d0d10 100%)',
            boxShadow: `
              0 20px 40px -12px rgba(0, 0, 0, 0.8),
              0 0 0 1px rgba(255, 255, 255, 0.05),
              inset 0 1px 0 rgba(255, 255, 255, 0.05)
            `
          }}
        >
          {/* Accent strip */}
          <div 
            className="h-1.5 rounded-full mb-3 mx-auto"
            style={{ 
              width: '50%',
              background: 'linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.4), transparent)'
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
              height: whiteKeyHeight + 8
            }}
          >
            {/* White Keys */}
            <div className="absolute inset-0 flex">
              {whiteNotes.map((note) => {
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
                    <div
                      className="absolute inset-0 rounded-b-md transition-all duration-[30ms]"
                      style={{
                        background: isActive 
                          ? 'linear-gradient(180deg, #8b5cf6 0%, #7c3aed 100%)'
                          : 'linear-gradient(180deg, #fafafa 0%, #e5e5e5 50%, #d4d4d4 100%)',
                        boxShadow: isActive
                          ? '0 0 15px rgba(139, 92, 246, 0.4), inset 0 -3px 6px rgba(0,0,0,0.2)'
                          : `
                              inset 0 -3px 5px rgba(0,0,0,0.08),
                              inset 0 1px 0 rgba(255,255,255,0.9),
                              0 3px 6px rgba(0,0,0,0.3)
                            `,
                        transform: isActive ? 'translateY(2px)' : 'translateY(0)',
                        borderLeft: '1px solid rgba(0,0,0,0.1)',
                        borderRight: '1px solid rgba(0,0,0,0.1)',
                        borderBottom: '1px solid rgba(0,0,0,0.2)',
                      }}
                    >
                      {isC && (
                        <div className="absolute bottom-2 left-0 right-0 flex flex-col items-center">
                          <span 
                            className="text-[10px] font-bold"
                            style={{ color: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.35)' }}
                          >
                            C{octave}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Black Keys */}
            <div className="absolute top-0 left-0 flex pointer-events-none">
              {whiteNotes.map((whiteNote, index) => {
                const blackNote = whiteNote + 1;
                const hasBlack = blackNotes.includes(blackNote);
                const offset = (whiteKeyWidth - blackKeyWidth / 2) + (index * (whiteKeyWidth + 1));
                
                if (!hasBlack || index === whiteNotes.length - 1) return null;
                
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
                    <div
                      className="absolute inset-0 rounded-b-md transition-all duration-[30ms]"
                      style={{
                        background: isActive 
                          ? 'linear-gradient(180deg, #8b5cf6 0%, #7c3aed 100%)'
                          : 'linear-gradient(180deg, #2a2a2f 0%, #1a1a1f 40%, #0a0a0f 100%)',
                        boxShadow: isActive
                          ? '0 0 12px rgba(139, 92, 246, 0.4), 0 2px 4px rgba(0,0,0,0.5)'
                          : `
                              inset 0 -2px 3px rgba(0,0,0,0.3),
                              inset 0 1px 1px rgba(255,255,255,0.05),
                              0 3px 6px rgba(0,0,0,0.5)
                            `,
                        transform: isActive ? 'translateY(1px)' : 'translateY(0)',
                        border: '1px solid rgba(0,0,0,0.5)',
                      }}
                    >
                      <div 
                        className="absolute top-0 left-0 right-0 h-6 rounded-t-sm"
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
        </div>
      </motion.div>

      {/* Keyboard hints */}
      {!viewOnly && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="px-4 py-2 bg-white/5 backdrop-blur-xl rounded-lg border border-white/10"
        >
          <p className="text-white/30 text-xs text-center">
            <span className="text-white/50 font-medium">1-5</span> Chords
            <span className="mx-2">•</span>
            <span className="text-white/50 font-medium">Z-M</span> Piano
            <span className="mx-2">•</span>
            <span className="text-white/50">↑↓</span> Octave
          </p>
        </motion.div>
      )}
    </div>
  );
}
