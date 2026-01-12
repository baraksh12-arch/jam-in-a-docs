import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * GuitarNeckView - Premium Guitar Fretboard with Physically-Informed Controls
 * 
 * Apple-level production quality featuring:
 * - 6-string guitar layout (E A D G B e)
 * - Touch/mouse bends with visual feedback
 * - Vibrato by wobbling finger/cursor
 * - Slide between frets with continuous pitch glide
 * - Hammer-on detection
 * - Palm mute with dramatic effect
 * - Pickup selector (bridge/middle/neck)
 * - Tone control
 * - Real-time pitch visualization
 */

// Standard guitar tuning (MIDI notes for open strings, high to low in display)
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
const MAX_BEND = 2.5;

// Pickup positions
const PICKUP_OPTIONS = [
  { id: 'neck', label: 'N', fullLabel: 'Neck', description: 'Warm' },
  { id: 'middle', label: 'M', fullLabel: 'Middle', description: 'Balanced' },
  { id: 'bridge', label: 'B', fullLabel: 'Bridge', description: 'Bright' },
];

export default function GuitarNeckView({ 
  onNoteOn, 
  onNoteOff, 
  onBend,
  onVibrato,
  onSlide,
  onHammerOn,
  onPalmMuteChange,
  onPickPositionChange,
  onPickupChange,
  onToneChange,
}) {
  const [activeNotes, setActiveNotes] = useState(new Map()); // stringIndex -> { fret, bendAmount, isVibrato }
  const [vibratingStrings, setVibratingStrings] = useState(new Set());
  const [palmMute, setPalmMute] = useState(false);
  const [pickupPosition, setPickupPosition] = useState('bridge');
  const [toneValue, setToneValue] = useState(0.7);
  
  const touchDataRef = useRef(new Map()); // touchId -> { stringIndex, fret, startY, currentY, startTime, lastY }
  const mouseDataRef = useRef(null);
  const isMouseDownRef = useRef(false);
  const containerRef = useRef(null);
  const lastVibratoTimeRef = useRef(new Map());
  const vibratoDirectionRef = useRef(new Map());
  const vibratoCountRef = useRef(new Map());

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
      navigator.vibrate(palmMute ? [8, 4, 8] : 12);
    }

    // Stop vibration animation
    setTimeout(() => {
      setVibratingStrings(prev => {
        const next = new Set(prev);
        next.delete(stringIndex);
        return next;
      });
    }, palmMute ? 150 : 400);

    return note;
  }, [getNote, activeNotes, onNoteOn, onNoteOff, onHammerOn, palmMute]);

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
      // Clear vibrato tracking
      vibratoCountRef.current.delete(stringIndex);
      vibratoDirectionRef.current.delete(stringIndex);
      lastVibratoTimeRef.current.delete(stringIndex);
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

  // Detect vibrato from movement - more sensitive detection
  const detectVibrato = useCallback((stringIndex, currentY, previousY) => {
    if (Math.abs(currentY - previousY) < 2) return; // Ignore tiny movements
    
    const now = Date.now();
    const lastTime = lastVibratoTimeRef.current.get(stringIndex) || 0;
    const lastDirection = vibratoDirectionRef.current.get(stringIndex) || 0;
    const vibratoCount = vibratoCountRef.current.get(stringIndex) || 0;
    
    const direction = currentY > previousY ? 1 : -1;
    const timeDelta = now - lastTime;
    
    // Direction changed within vibrato timing window
    if (direction !== lastDirection && timeDelta < 300 && timeDelta > 30) {
      const newCount = vibratoCount + 1;
      vibratoCountRef.current.set(stringIndex, newCount);
      
      // After 2 direction changes, trigger vibrato
      if (newCount >= 2) {
        const noteData = activeNotes.get(stringIndex);
        if (noteData) {
          const note = getNote(stringIndex, noteData.fret);
          // Calculate rate from timing
          const rate = Math.min(8, Math.max(4, 1000 / (timeDelta * 2)));
          onVibrato?.(note, 0.35, rate);
          
          setActiveNotes(prev => {
            const next = new Map(prev);
            const existing = next.get(stringIndex);
            if (existing && !existing.isVibrato) {
              next.set(stringIndex, { ...existing, isVibrato: true });
            }
            return next;
          });
        }
      }
    } else if (timeDelta > 300) {
      // Reset vibrato count if too slow
      vibratoCountRef.current.set(stringIndex, 0);
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
    const bendOffset = (y - stringCenterY) / (stringHeight * 0.35);
    const bendAmount = Math.max(-MAX_BEND, Math.min(MAX_BEND, -bendOffset * MAX_BEND));
    
    return { stringIndex, fret, bendAmount, rawY: y, rawX: x };
  }, []);

  // Handle palm mute toggle
  const togglePalmMute = useCallback(() => {
    const newValue = !palmMute;
    setPalmMute(newValue);
    onPalmMuteChange?.(newValue ? 0.75 : 0);
    
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(newValue ? [25, 15, 25] : 15);
    }
  }, [palmMute, onPalmMuteChange]);

  // Handle pickup change
  const handlePickupChange = useCallback((position) => {
    setPickupPosition(position);
    onPickupChange?.(position);
    
    // Haptic
    if (navigator.vibrate) {
      navigator.vibrate(8);
    }
  }, [onPickupChange]);

  // Handle tone change
  const handleToneChange = useCallback((e) => {
    const value = parseFloat(e.target.value);
    setToneValue(value);
    onToneChange?.(value);
  }, [onToneChange]);

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
          lastY: pos.rawY,
          startX: pos.rawX,
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
        touchData.lastY = touchData.currentY;
        touchData.currentY = newPos.rawY;
        
        // Check for slide to different fret
        if (newPos.fret !== touchData.fret && newPos.stringIndex === touchData.stringIndex) {
          // Slide to new fret
          const fromNote = getNote(touchData.stringIndex, touchData.fret);
          const toNote = getNote(touchData.stringIndex, newPos.fret);
          onSlide?.(fromNote, toNote, 0.06);
          
          touchData.fret = newPos.fret;
          
          // Update active note display
          setActiveNotes(prev => {
            const next = new Map(prev);
            const existing = next.get(touchData.stringIndex);
            if (existing) {
              next.set(touchData.stringIndex, { ...existing, fret: newPos.fret, bendAmount: 0 });
            }
            return next;
          });
        } else if (newPos.stringIndex !== touchData.stringIndex) {
          // Changed strings - release old, play new
          releaseNote(touchData.stringIndex);
          touchData.stringIndex = newPos.stringIndex;
          touchData.fret = newPos.fret;
          playNote(newPos.stringIndex, newPos.fret);
        } else {
          // Same string and fret - apply bend
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
        lastY: pos.rawY,
        startX: pos.rawX,
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
    mouseData.lastY = mouseData.currentY;
    mouseData.currentY = newPos.rawY;
    
    // Check for slide
    if (newPos.fret !== mouseData.fret && newPos.stringIndex === mouseData.stringIndex) {
      const fromNote = getNote(mouseData.stringIndex, mouseData.fret);
      const toNote = getNote(mouseData.stringIndex, newPos.fret);
      onSlide?.(fromNote, toNote, 0.06);
      mouseData.fret = newPos.fret;
      
      setActiveNotes(prev => {
        const next = new Map(prev);
        const existing = next.get(mouseData.stringIndex);
        if (existing) {
          next.set(mouseData.stringIndex, { ...existing, fret: newPos.fret, bendAmount: 0 });
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

  // Initialize guitar parameters on mount
  useEffect(() => {
    // Set initial state
    onPalmMuteChange?.(0);
    onPickupChange?.(pickupPosition);
    onToneChange?.(toneValue);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div 
      className="w-full h-full flex flex-col items-center justify-center p-3 sm:p-4"
      style={{ touchAction: 'none' }}
    >
      {/* Controls row - Apple-style segmented controls */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl mb-3 sm:mb-4 flex items-center justify-between gap-2 sm:gap-4"
      >
        {/* Palm Mute - Left side, prominent */}
        <motion.button
          onClick={togglePalmMute}
          whileTap={{ scale: 0.95 }}
          className={`
            relative px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl font-semibold text-sm
            transition-all duration-300 overflow-hidden
            ${palmMute 
              ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/40' 
              : 'bg-white/[0.08] text-white/70 hover:bg-white/[0.12] border border-white/10'
            }
          `}
        >
          {/* Animated background pulse when active */}
          {palmMute && (
            <motion.div
              className="absolute inset-0 bg-white/20"
              animate={{ opacity: [0, 0.3, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}
          <span className="relative flex items-center gap-2">
            <span className={`
              w-2 h-2 rounded-full transition-all duration-300
              ${palmMute ? 'bg-white shadow-lg shadow-white/50' : 'bg-white/30'}
            `} />
            <span className="hidden sm:inline">Palm Mute</span>
            <span className="sm:hidden">PM</span>
          </span>
        </motion.button>

        {/* Center controls group */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Pickup Selector - Segmented control style */}
          <div className="flex items-center bg-black/40 backdrop-blur-sm rounded-xl p-1 border border-white/10">
            {PICKUP_OPTIONS.map((pickup, idx) => (
              <motion.button
                key={pickup.id}
                onClick={() => handlePickupChange(pickup.id)}
                whileTap={{ scale: 0.95 }}
                className={`
                  relative px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm
                  transition-all duration-200
                  ${pickupPosition === pickup.id 
                    ? 'bg-white text-black shadow-md' 
                    : 'text-white/50 hover:text-white/80'
                  }
                `}
              >
                <span className="sm:hidden">{pickup.label}</span>
                <span className="hidden sm:inline">{pickup.fullLabel}</span>
              </motion.button>
            ))}
          </div>

          {/* Tone Control - Minimal design */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 backdrop-blur-sm rounded-xl border border-white/10">
            <span className="text-white/40 text-xs font-medium">TONE</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={toneValue}
              onChange={handleToneChange}
              className="w-16 sm:w-20 h-1 rounded-full appearance-none bg-white/20 cursor-pointer
                         [&::-webkit-slider-thumb]:appearance-none 
                         [&::-webkit-slider-thumb]:w-3.5
                         [&::-webkit-slider-thumb]:h-3.5
                         [&::-webkit-slider-thumb]:rounded-full 
                         [&::-webkit-slider-thumb]:bg-white
                         [&::-webkit-slider-thumb]:shadow-md
                         [&::-webkit-slider-thumb]:transition-transform
                         [&::-webkit-slider-thumb]:hover:scale-110"
            />
          </div>
        </div>

        {/* Right spacer for balance */}
        <div className="w-[100px] sm:w-[120px]" />
      </motion.div>

      {/* Guitar neck */}
      <motion.div
        ref={containerRef}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-4xl aspect-[4/1] relative rounded-2xl overflow-hidden cursor-pointer select-none"
        style={{
          background: 'linear-gradient(180deg, #3d2817 0%, #2a1c10 30%, #1a110a 70%, #0d0805 100%)',
          boxShadow: palmMute 
            ? '0 8px 30px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 60px rgba(255, 150, 50, 0.15)'
            : '0 10px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Palm mute indicator overlay */}
        <AnimatePresence>
          {palmMute && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 pointer-events-none z-10"
              style={{
                background: 'linear-gradient(90deg, rgba(255, 120, 50, 0.25) 0%, rgba(255, 100, 30, 0.1) 15%, transparent 40%)',
              }}
            >
              {/* Palm indicator */}
              <div 
                className="absolute left-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-lg bg-orange-500/30 border border-orange-400/40"
              >
                <span className="text-orange-300 text-[10px] font-bold tracking-wider">MUTED</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fretboard wood grain */}
        <div 
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: `repeating-linear-gradient(
              90deg,
              transparent,
              transparent 2px,
              rgba(139, 90, 43, 0.4) 2px,
              rgba(139, 90, 43, 0.4) 4px
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
                : 'linear-gradient(180deg, #d8d8d8 0%, #909090 50%, #d8d8d8 100%)',
              boxShadow: i === 0 
                ? '0 0 10px rgba(212, 175, 55, 0.5), 2px 0 4px rgba(0,0,0,0.4)' 
                : '1px 0 3px rgba(0,0,0,0.4)'
            }}
          />
        ))}

        {/* Fret markers */}
        {FRET_MARKERS.map(fret => {
          const isDouble = DOUBLE_MARKERS.includes(fret);
          return (
            <React.Fragment key={`marker-${fret}`}>
              <div
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: 14,
                  height: 14,
                  left: `${((fret - 0.5) / (FRET_COUNT + 1)) * 100}%`,
                  top: isDouble ? '25%' : '50%',
                  transform: 'translate(-50%, -50%)',
                  background: 'radial-gradient(circle at 35% 35%, #fff, #f0ebe0, #d8d4c8)',
                  boxShadow: 'inset 0 1px 3px rgba(255,255,255,0.9), 0 2px 4px rgba(0,0,0,0.4)'
                }}
              />
              {isDouble && (
                <div
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    width: 14,
                    height: 14,
                    left: `${((fret - 0.5) / (FRET_COUNT + 1)) * 100}%`,
                    top: '75%',
                    transform: 'translate(-50%, -50%)',
                    background: 'radial-gradient(circle at 35% 35%, #fff, #f0ebe0, #d8d4c8)',
                    boxShadow: 'inset 0 1px 3px rgba(255,255,255,0.9), 0 2px 4px rgba(0,0,0,0.4)'
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
          const bendOffset = noteData ? noteData.bendAmount * 4 : 0;
          const isVibratoActive = noteData?.isVibrato;

          return (
            <div key={string.name} className="absolute left-0 right-0 pointer-events-none" style={{ top: `${stringY}%` }}>
              {/* String shadow */}
              <div
                className="absolute left-0 right-0"
                style={{
                  height: string.thickness + 2,
                  top: 2,
                  background: 'rgba(0,0,0,0.5)',
                  filter: 'blur(1.5px)'
                }}
              />
              
              {/* Main string */}
              <motion.div
                animate={
                  isVibratoActive ? {
                    y: [bendOffset - 1.5, bendOffset + 1.5, bendOffset - 1.5],
                  } : isVibrating ? {
                    y: palmMute 
                      ? [0, -0.8, 0.8, -0.4, 0.4, 0] 
                      : [0, -2.5, 2.5, -2, 2, -1, 1, 0],
                  } : { y: bendOffset }
                }
                transition={
                  isVibratoActive 
                    ? { duration: 0.12, repeat: Infinity, ease: "easeInOut" }
                    : isVibrating 
                      ? { duration: palmMute ? 0.1 : 0.18, repeat: Infinity } 
                      : { duration: 0.04, ease: "easeOut" }
                }
                className="absolute left-0 right-0"
                style={{
                  height: string.thickness,
                  top: -string.thickness / 2,
                  background: `linear-gradient(180deg, 
                    rgba(230, 230, 230, 1) 0%, 
                    rgba(190, 190, 190, 1) 25%,
                    rgba(150, 150, 150, 1) 50%,
                    rgba(110, 110, 110, 1) 75%,
                    rgba(90, 90, 90, 1) 100%)`,
                  boxShadow: isVibrating || noteData
                    ? palmMute
                      ? `0 0 6px rgba(255, 130, 80, 0.6), 0 0 12px rgba(255, 100, 50, 0.3)`
                      : isVibratoActive
                        ? `0 0 12px rgba(255, 200, 100, 0.9), 0 0 25px rgba(255, 180, 80, 0.5)`
                        : `0 0 10px rgba(255, 200, 100, 0.8), 0 0 20px rgba(255, 180, 80, 0.4)`
                    : '0 1px 3px rgba(0, 0, 0, 0.6)',
                  borderRadius: string.thickness / 2,
                }}
              />

              {/* Active fret indicator */}
              {noteData && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ 
                    scale: 1, 
                    opacity: 1,
                  }}
                  className="absolute pointer-events-none"
                  style={{
                    left: `${((noteData.fret + 0.5) / (FRET_COUNT + 1)) * 100}%`,
                    top: '50%',
                    transform: `translate(-50%, calc(-50% + ${bendOffset}px))`,
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: palmMute
                      ? `radial-gradient(circle, rgba(255, 130, 70, 0.85) 0%, rgba(220, 90, 40, 0.5) 50%, transparent 100%)`
                      : isVibratoActive
                        ? `radial-gradient(circle, rgba(255, 220, 100, 0.95) 0%, rgba(255, 180, 50, 0.6) 50%, transparent 100%)`
                        : `radial-gradient(circle, rgba(255, 190, 90, 0.9) 0%, rgba(255, 140, 50, 0.5) 50%, transparent 100%)`,
                    boxShadow: palmMute
                      ? `0 0 15px rgba(255, 110, 50, 0.7)`
                      : isVibratoActive
                        ? `0 0 25px rgba(255, 200, 80, 0.9), 0 0 40px rgba(255, 180, 50, 0.5)`
                        : `0 0 22px rgba(255, 160, 50, 0.8)`,
                  }}
                />
              )}

              {/* String label */}
              <div 
                className="absolute -right-7 text-xs font-bold transition-colors duration-150"
                style={{ 
                  top: -7,
                  color: noteData ? '#fbbf24' : 'rgba(255,255,255,0.35)'
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
              className="flex-1 text-center text-[10px] text-amber-200/30 font-medium"
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
        className="mt-6 sm:mt-8 flex items-center gap-2 sm:gap-3"
      >
        {STRINGS.map((string, idx) => {
          const noteData = activeNotes.get(idx);
          const note = noteData ? getNote(idx, noteData.fret) : null;
          const noteName = note !== null ? getNoteNameFromMidi(note) : '-';
          const bendDisplay = noteData && Math.abs(noteData.bendAmount) > 0.15 
            ? (noteData.bendAmount > 0 ? '↑' : '↓') 
            : '';
          const vibratoDisplay = noteData?.isVibrato ? '~' : '';
          
          return (
            <motion.div
              key={string.name}
              animate={noteData ? { scale: [1, 1.06, 1] } : {}}
              transition={{ duration: 0.15 }}
              className={`
                w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex flex-col items-center justify-center
                transition-all duration-150
                ${noteData 
                  ? palmMute
                    ? 'bg-gradient-to-br from-orange-500 to-orange-700 shadow-lg shadow-orange-600/40'
                    : `bg-gradient-to-br ${string.color} shadow-lg shadow-black/30` 
                  : 'bg-white/[0.05] border border-white/[0.08]'
                }
              `}
            >
              <span className={`text-[9px] sm:text-[10px] font-medium ${noteData ? 'text-white/90' : 'text-white/35'}`}>
                {string.name}
              </span>
              <span className={`text-xs sm:text-sm font-bold ${noteData ? 'text-white' : 'text-white/25'}`}>
                {noteName}{vibratoDisplay}{bendDisplay}
              </span>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Instructions - minimal */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-3 sm:mt-4 px-4 sm:px-6 py-2 sm:py-2.5 bg-black/30 backdrop-blur-sm rounded-full border border-white/5"
      >
        <p className="text-white/40 text-[10px] sm:text-xs text-center font-medium">
          <span className="text-white/60">Tap</span> to play · 
          <span className="text-white/60"> Drag ↕</span> to bend · 
          <span className="text-white/60"> Wobble</span> for vibrato · 
          <span className="text-white/60"> Slide ↔</span> between frets
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
