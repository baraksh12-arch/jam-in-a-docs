/**
 * ChordPad - Individual Chord Pad Component
 * 
 * Premium playable chord pad with:
 * - Gesture detection (tap, slide X for inversion, slide Y for extension)
 * - Velocity response based on press position/force
 * - Smooth visual feedback and animations
 * - Accessibility support
 */

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { ChordPadAssignment } from '@/lib/music/chords';

// Constants for gesture detection
const SLIDE_THRESHOLD = 20;        // Pixels to trigger slide detection
const INVERSION_STEP = 40;         // Pixels per inversion step
const EXTENSION_STEP = 30;         // Pixels per extension step
const VELOCITY_ZONE_SIZE = 0.3;    // Top/bottom zone for velocity variation

interface ChordPadProps {
  assignment: ChordPadAssignment;
  isActive: boolean;
  currentInversion: number;
  currentExtension: number;
  maxInversions: number;
  maxExtensions: number;
  onTrigger: (velocity: number) => void;
  onRelease: () => void;
  onInversionChange: (delta: number) => void;
  onExtensionChange: (delta: number) => void;
  keyboardShortcut?: string;
  disabled?: boolean;
}

export default function ChordPad({
  assignment,
  isActive,
  currentInversion,
  currentExtension,
  maxInversions,
  maxExtensions,
  onTrigger,
  onRelease,
  onInversionChange,
  onExtensionChange,
  keyboardShortcut,
  disabled = false,
}: ChordPadProps) {
  const padRef = useRef<HTMLButtonElement>(null);
  const gestureRef = useRef({
    startX: 0,
    startY: 0,
    startTime: 0,
    isSliding: false,
    slideDirection: null as 'x' | 'y' | null,
    accumulatedX: 0,
    accumulatedY: 0,
    isPressed: false,
    triggeredNote: false,
  });
  
  const [ripple, setRipple] = useState<{ x: number; y: number; id: number } | null>(null);
  const [pressIntensity, setPressIntensity] = useState(0);
  
  // Calculate velocity from touch position (top = soft, bottom = loud)
  const calculateVelocity = useCallback((clientY: number): number => {
    if (!padRef.current) return 100;
    
    const rect = padRef.current.getBoundingClientRect();
    const relativeY = (clientY - rect.top) / rect.height;
    
    // Map position to velocity (top = 60, bottom = 127)
    const minVelocity = 60;
    const maxVelocity = 127;
    return Math.round(minVelocity + relativeY * (maxVelocity - minVelocity));
  }, []);
  
  // Trigger ripple effect
  const triggerRipple = useCallback((clientX: number, clientY: number) => {
    if (!padRef.current) return;
    
    const rect = padRef.current.getBoundingClientRect();
    setRipple({
      x: clientX - rect.left,
      y: clientY - rect.top,
      id: Date.now(),
    });
    
    setTimeout(() => setRipple(null), 600);
  }, []);
  
  // Handle pointer down
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const gesture = gestureRef.current;
    gesture.startX = e.clientX;
    gesture.startY = e.clientY;
    gesture.startTime = Date.now();
    gesture.isSliding = false;
    gesture.slideDirection = null;
    gesture.accumulatedX = 0;
    gesture.accumulatedY = 0;
    gesture.isPressed = true;
    gesture.triggeredNote = true;
    
    // Calculate velocity and trigger
    const velocity = calculateVelocity(e.clientY);
    setPressIntensity(velocity / 127);
    onTrigger(velocity);
    
    // Visual feedback
    triggerRipple(e.clientX, e.clientY);
    
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(12);
    }
    
    // Capture pointer for slide detection
    padRef.current?.setPointerCapture(e.pointerId);
  }, [disabled, calculateVelocity, onTrigger, triggerRipple]);
  
  // Handle pointer move (for sliding)
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const gesture = gestureRef.current;
    if (!gesture.isPressed) return;
    
    const deltaX = e.clientX - gesture.startX;
    const deltaY = e.clientY - gesture.startY;
    
    // Determine slide direction on first significant movement
    if (!gesture.slideDirection) {
      if (Math.abs(deltaX) > SLIDE_THRESHOLD) {
        gesture.slideDirection = 'x';
        gesture.isSliding = true;
      } else if (Math.abs(deltaY) > SLIDE_THRESHOLD) {
        gesture.slideDirection = 'y';
        gesture.isSliding = true;
      }
    }
    
    // Process sliding
    if (gesture.slideDirection === 'x') {
      const steps = Math.floor(deltaX / INVERSION_STEP);
      const stepDelta = steps - Math.floor(gesture.accumulatedX / INVERSION_STEP);
      
      if (stepDelta !== 0) {
        gesture.accumulatedX = deltaX;
        onInversionChange(stepDelta);
        
        // Subtle haptic for inversion change
        if (navigator.vibrate) {
          navigator.vibrate(5);
        }
      }
    } else if (gesture.slideDirection === 'y') {
      const steps = Math.floor(-deltaY / EXTENSION_STEP); // Negative because up = higher extensions
      const stepDelta = steps - Math.floor(-gesture.accumulatedY / EXTENSION_STEP);
      
      if (stepDelta !== 0) {
        gesture.accumulatedY = deltaY;
        onExtensionChange(stepDelta);
        
        // Subtle haptic for extension change
        if (navigator.vibrate) {
          navigator.vibrate(5);
        }
      }
    }
    
    // Update press intensity for visual feedback
    const intensity = Math.min(1, 0.5 + Math.abs(deltaX + deltaY) / 200);
    setPressIntensity(intensity);
  }, [onInversionChange, onExtensionChange]);
  
  // Handle pointer up
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const gesture = gestureRef.current;
    if (!gesture.isPressed) return;
    
    gesture.isPressed = false;
    gesture.isSliding = false;
    gesture.slideDirection = null;
    
    setPressIntensity(0);
    onRelease();
    
    padRef.current?.releasePointerCapture(e.pointerId);
  }, [onRelease]);
  
  // Handle pointer cancel/leave
  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    const gesture = gestureRef.current;
    if (gesture.isPressed) {
      gesture.isPressed = false;
      setPressIntensity(0);
      onRelease();
    }
  }, [onRelease]);
  
  const { chord, color, locked } = assignment;
  
  // Format inversion indicator
  const inversionIndicator = currentInversion > 0 
    ? `${currentInversion}${['st', 'nd', 'rd'][currentInversion - 1] || 'th'} inv`
    : '';
  
  // Extension names for display
  const extensionNames = ['', '7', '9', '11', '13'];
  const extensionIndicator = extensionNames[currentExtension] || '';
  
  return (
    <motion.button
      ref={padRef}
      disabled={disabled}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerCancel}
      className={cn(
        // Base styles
        'relative w-full aspect-[4/3] rounded-2xl overflow-hidden',
        'font-semibold select-none cursor-pointer',
        'transition-all duration-100',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
        // Gradient background
        `bg-gradient-to-br ${color}`,
        // State styles
        isActive && 'scale-95 ring-4 ring-white/60',
        !isActive && 'hover:scale-[1.02] hover:brightness-110',
        disabled && 'opacity-40 cursor-not-allowed',
        locked && 'ring-2 ring-yellow-400/50',
      )}
      style={{
        touchAction: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileTap={{ scale: 0.95 }}
      aria-label={`${chord.name} chord${inversionIndicator ? `, ${inversionIndicator}` : ''}`}
      aria-pressed={isActive}
    >
      {/* Glass overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/25 via-transparent to-black/30 pointer-events-none" />
      
      {/* Inner shadow for 3D effect */}
      <div className="absolute inset-0 shadow-[inset_0_-4px_12px_rgba(0,0,0,0.3)] rounded-2xl pointer-events-none" />
      
      {/* Press intensity glow */}
      <motion.div
        className="absolute inset-0 bg-white pointer-events-none rounded-2xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: pressIntensity * 0.3 }}
        transition={{ duration: 0.05 }}
      />
      
      {/* Ripple effect */}
      <AnimatePresence>
        {ripple && (
          <motion.div
            key={ripple.id}
            className="absolute w-8 h-8 -ml-4 -mt-4 bg-white rounded-full pointer-events-none"
            style={{ left: ripple.x, top: ripple.y }}
            initial={{ scale: 0, opacity: 0.6 }}
            animate={{ scale: 4, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
      
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-2 text-white">
        {/* Roman numeral (small, top) */}
        {chord.romanNumeral && (
          <span className="absolute top-2 left-3 text-[10px] sm:text-xs font-medium opacity-60 uppercase tracking-wider">
            {chord.romanNumeral}
          </span>
        )}
        
        {/* Lock indicator */}
        {locked && (
          <span className="absolute top-2 right-3 text-[10px] text-yellow-300 opacity-80">
            🔒
          </span>
        )}
        
        {/* Main chord name */}
        <span className="text-2xl sm:text-3xl md:text-4xl font-black drop-shadow-lg tracking-tight">
          {chord.name}
          {extensionIndicator && (
            <span className="text-lg sm:text-xl md:text-2xl font-bold opacity-90 ml-0.5">
              {extensionIndicator}
            </span>
          )}
        </span>
        
        {/* Inversion indicator */}
        {inversionIndicator && (
          <span className="text-[10px] sm:text-xs font-medium opacity-70 mt-1">
            {inversionIndicator}
          </span>
        )}
        
        {/* Keyboard shortcut */}
        {keyboardShortcut && (
          <span className="absolute bottom-2 right-3 text-[10px] font-mono opacity-40 hidden md:block">
            {keyboardShortcut}
          </span>
        )}
      </div>
      
      {/* Slide indicators (visible during slide) */}
      <AnimatePresence>
        {isActive && (
          <>
            {/* Horizontal slide indicator (inversions) */}
            <motion.div
              className="absolute left-1 right-1 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
            >
              <div className="text-white/60 text-xs">◀</div>
              <div className="text-white/60 text-xs">▶</div>
            </motion.div>
            
            {/* Vertical slide indicator (extensions) */}
            <motion.div
              className="absolute left-1/2 -translate-x-1/2 top-2 bottom-2 flex flex-col justify-between pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
            >
              <div className="text-white/60 text-xs">▲</div>
              <div className="text-white/60 text-xs">▼</div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      {/* Inversion dots at bottom */}
      {maxInversions > 0 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
          {Array.from({ length: maxInversions + 1 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'w-1.5 h-1.5 rounded-full transition-all',
                i === currentInversion 
                  ? 'bg-white scale-125' 
                  : 'bg-white/40'
              )}
            />
          ))}
        </div>
      )}
    </motion.button>
  );
}
