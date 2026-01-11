import React, { useState, useCallback, useRef, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ChordPadView - Premium Chord Pad Interface
 * 
 * This is a wrapper that provides two modes:
 * 1. Legacy mode (simple): Original chord pad for quick use
 * 2. Pro mode: Full ChordPadScreen with all features
 * 
 * Features (Pro mode):
 * - Scale & chord configuration
 * - Inversions via horizontal slide
 * - Extensions via vertical slide (7ths, 9ths, etc.)
 * - Voice leading & voicing options
 * - Strum & humanize controls
 * - Preset system
 */

// Lazy load the pro chord pad screen
const ChordPadScreen = lazy(() => import('@/components/chords/ChordPadScreen'));

// Common chord definitions with MIDI notes (for legacy mode)
const CHORD_DEFINITIONS = {
  // Major chords
  'C': { notes: [60, 64, 67], name: 'C', type: 'maj', color: 'from-rose-500 to-rose-600' },
  'D': { notes: [62, 66, 69], name: 'D', type: 'maj', color: 'from-orange-500 to-orange-600' },
  'E': { notes: [64, 68, 71], name: 'E', type: 'maj', color: 'from-amber-500 to-amber-600' },
  'F': { notes: [65, 69, 72], name: 'F', type: 'maj', color: 'from-yellow-500 to-yellow-600' },
  'G': { notes: [67, 71, 74], name: 'G', type: 'maj', color: 'from-emerald-500 to-emerald-600' },
  'A': { notes: [69, 73, 76], name: 'A', type: 'maj', color: 'from-teal-500 to-teal-600' },
  'B': { notes: [71, 75, 78], name: 'B', type: 'maj', color: 'from-cyan-500 to-cyan-600' },
  
  // Minor chords
  'Am': { notes: [69, 72, 76], name: 'Am', type: 'min', color: 'from-blue-500 to-blue-600' },
  'Dm': { notes: [62, 65, 69], name: 'Dm', type: 'min', color: 'from-indigo-500 to-indigo-600' },
  'Em': { notes: [64, 67, 71], name: 'Em', type: 'min', color: 'from-violet-500 to-violet-600' },
  'Bm': { notes: [71, 74, 78], name: 'Bm', type: 'min', color: 'from-purple-500 to-purple-600' },
  'Fm': { notes: [65, 68, 72], name: 'Fm', type: 'min', color: 'from-fuchsia-500 to-fuchsia-600' },
  
  // 7th chords
  'G7': { notes: [67, 71, 74, 77], name: 'G7', type: '7', color: 'from-pink-500 to-pink-600' },
  'C7': { notes: [60, 64, 67, 70], name: 'C7', type: '7', color: 'from-rose-600 to-rose-700' },
  'D7': { notes: [62, 66, 69, 72], name: 'D7', type: '7', color: 'from-orange-600 to-orange-700' },
  'A7': { notes: [69, 73, 76, 79], name: 'A7', type: '7', color: 'from-amber-600 to-amber-700' },
};

// Piano chord layout (pop/jazz progression friendly)
const PIANO_LAYOUT = [
  ['C', 'Dm', 'Em', 'F'],
  ['G', 'Am', 'G7', 'C7'],
  ['D', 'E', 'A', 'Bm'],
  ['D7', 'A7', 'Fm', 'B']
];

// Guitar chord layout (common progressions)
const GUITAR_LAYOUT = [
  ['G', 'C', 'D', 'Em'],
  ['Am', 'F', 'E', 'A'],
  ['Dm', 'G7', 'C7', 'D7'],
  ['Bm', 'A7', 'Fm', 'B']
];

export default function ChordPadView({ 
  instrument, 
  onNoteOn, 
  onNoteOff,
  isGuitar = false,
  proMode = false, // Enable new pro chord pad
}) {
  const [activeChord, setActiveChord] = useState(null);
  const [ripples, setRipples] = useState({});
  const touchActiveRef = useRef(false);
  const activeNotesRef = useRef([]);

  const layout = isGuitar ? GUITAR_LAYOUT : PIANO_LAYOUT;

  // If pro mode is enabled, render the full ChordPadScreen
  if (proMode) {
    return (
      <Suspense fallback={
        <div className="w-full h-full flex items-center justify-center bg-gray-950">
          <div className="text-white/60 text-sm">Loading Chord Pad Pro...</div>
        </div>
      }>
        <ChordPadScreen
          onNoteOn={onNoteOn}
          onNoteOff={onNoteOff}
        />
      </Suspense>
    );
  }

  const triggerRipple = useCallback((chordName) => {
    const rippleId = `${chordName}-${Date.now()}`;
    setRipples(prev => ({ ...prev, [rippleId]: chordName }));
    setTimeout(() => {
      setRipples(prev => {
        const next = { ...prev };
        delete next[rippleId];
        return next;
      });
    }, 600);
  }, []);

  const playChord = useCallback((chord, event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // Release any active notes first
    activeNotesRef.current.forEach(note => {
      onNoteOff?.(note);
    });
    activeNotesRef.current = [];

    // Play chord notes with slight strum delay for guitar
    const delay = isGuitar ? 15 : 0;
    chord.notes.forEach((note, i) => {
      setTimeout(() => {
        onNoteOn?.(note);
      }, i * delay);
    });
    activeNotesRef.current = [...chord.notes];

    triggerRipple(chord.name);
    setActiveChord(chord.name);

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(12);
    }

    // Visual feedback duration
    setTimeout(() => {
      setActiveChord(null);
    }, 150);
  }, [onNoteOn, onNoteOff, isGuitar, triggerRipple]);

  const releaseChord = useCallback(() => {
    activeNotesRef.current.forEach(note => {
      onNoteOff?.(note);
    });
    activeNotesRef.current = [];
  }, [onNoteOff]);

  const handleTouchStart = (e, chord) => {
    e.preventDefault();
    e.stopPropagation();
    touchActiveRef.current = true;
    playChord(chord, e);
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    releaseChord();
    setTimeout(() => {
      touchActiveRef.current = false;
    }, 100);
  };

  const handleMouseDown = (e, chord) => {
    if (touchActiveRef.current) {
      e.preventDefault();
      return;
    }
    playChord(chord, e);
  };

  const handleMouseUp = () => {
    if (touchActiveRef.current) return;
    releaseChord();
  };

  return (
    <div 
      className="w-full h-full flex flex-col items-center justify-center p-4"
      style={{ touchAction: 'none' }}
    >
      {/* Chord grid */}
      <div className="w-full max-w-lg grid grid-cols-4 gap-3 md:gap-4">
        {layout.flat().map((chordName, index) => {
          const chord = CHORD_DEFINITIONS[chordName];
          if (!chord) return null;
          
          const isActive = activeChord === chord.name;
          const chordRipples = Object.entries(ripples).filter(([_, name]) => name === chord.name);

          return (
            <motion.button
              key={chord.name}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                delay: index * 0.03,
                type: 'spring',
                stiffness: 400,
                damping: 25
              }}
              onMouseDown={(e) => handleMouseDown(e, chord)}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={(e) => handleTouchStart(e, chord)}
              onTouchEnd={handleTouchEnd}
              className={`
                relative aspect-square rounded-2xl overflow-hidden
                font-bold select-none cursor-pointer
                transition-all duration-75
                ${isActive
                  ? `bg-gradient-to-br ${chord.color} scale-95 shadow-2xl ring-4 ring-white/50`
                  : `bg-gradient-to-br ${chord.color} opacity-80 hover:opacity-100 hover:scale-[1.02]`
                }
                active:scale-90
                focus:outline-none focus:ring-2 focus:ring-white/30
              `}
              style={{ 
                touchAction: 'none',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              {/* Glass effect */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-black/20 pointer-events-none" />
              
              {/* Ripple effects */}
              <AnimatePresence>
                {chordRipples.map(([rippleId]) => (
                  <motion.div
                    key={rippleId}
                    initial={{ scale: 0.3, opacity: 0.8 }}
                    animate={{ scale: 2.5, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="absolute inset-0 bg-white rounded-full pointer-events-none"
                    style={{ transformOrigin: 'center center' }}
                  />
                ))}
              </AnimatePresence>

              {/* Content */}
              <div className="relative z-10 flex flex-col items-center justify-center h-full text-white">
                <span className="text-2xl md:text-3xl font-black drop-shadow-lg">
                  {chord.name}
                </span>
                <span className="text-[10px] md:text-xs opacity-70 uppercase tracking-wider mt-1">
                  {chord.type === 'maj' ? 'Major' : chord.type === 'min' ? 'Minor' : '7th'}
                </span>
              </div>

              {/* Active glow */}
              {isActive && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 bg-white/30 pointer-events-none"
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Instructions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-6 px-4 py-2 bg-black/40 backdrop-blur-sm rounded-full"
      >
        <p className="text-white/50 text-xs text-center">
          {isGuitar 
            ? 'Tap to strum • Hold for sustain'
            : 'Tap chords to play • Release to stop'
          }
        </p>
      </motion.div>
    </div>
  );
}
