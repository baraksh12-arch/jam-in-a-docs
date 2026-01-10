import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

// Premium drum pad configuration with unique colors and effects
const DRUM_PADS = [
  { id: 'kick', label: 'KICK', key: 'Q', gradient: 'from-rose-500 to-red-600', glow: 'shadow-rose-500/50', ring: 'ring-rose-400' },
  { id: 'snare', label: 'SNARE', key: 'W', gradient: 'from-orange-500 to-amber-600', glow: 'shadow-orange-500/50', ring: 'ring-orange-400' },
  { id: 'hihat', label: 'HI-HAT', key: 'E', gradient: 'from-yellow-400 to-amber-500', glow: 'shadow-yellow-500/50', ring: 'ring-yellow-400' },
  { id: 'clap', label: 'CLAP', key: 'R', gradient: 'from-pink-500 to-rose-600', glow: 'shadow-pink-500/50', ring: 'ring-pink-400' },
  { id: 'tom1', label: 'TOM 1', key: 'A', gradient: 'from-emerald-500 to-green-600', glow: 'shadow-emerald-500/50', ring: 'ring-emerald-400' },
  { id: 'tom2', label: 'TOM 2', key: 'S', gradient: 'from-cyan-500 to-teal-600', glow: 'shadow-cyan-500/50', ring: 'ring-cyan-400' },
  { id: 'crash', label: 'CRASH', key: 'D', gradient: 'from-violet-500 to-purple-600', glow: 'shadow-violet-500/50', ring: 'ring-violet-400' },
  { id: 'ride', label: 'RIDE', key: 'F', gradient: 'from-indigo-500 to-blue-600', glow: 'shadow-indigo-500/50', ring: 'ring-indigo-400' }
];

/**
 * FullscreenDrumPad - Premium fullscreen drum pad experience
 * Features massive touch targets, satisfying visual feedback, and haptic response
 * Drums are one-shot (percussive) - onNoteOff is accepted for API consistency but drums don't sustain
 */
export default function FullscreenDrumPad({ onNoteOn, onNoteOff, focusModeActive = true }) {
  const [activePads, setActivePads] = useState(new Set());
  const [ripples, setRipples] = useState({});
  const touchActiveRef = useRef(false);
  const lastPressTimeRef = useRef({});

  const triggerRipple = useCallback((padId) => {
    const rippleId = `${padId}-${Date.now()}`;
    setRipples(prev => ({ ...prev, [rippleId]: padId }));
    setTimeout(() => {
      setRipples(prev => {
        const next = { ...prev };
        delete next[rippleId];
        return next;
      });
    }, 600);
  }, []);

  const handlePadPress = useCallback((padId, event = null) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // Debounce rapid presses
    const now = Date.now();
    const lastPress = lastPressTimeRef.current[padId] || 0;
    if (now - lastPress < 30) return;
    lastPressTimeRef.current[padId] = now;
    
    onNoteOn?.(padId);
    triggerRipple(padId);
    
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(15);
    }
    
    // Visual feedback
    setActivePads(prev => new Set(prev).add(padId));
    setTimeout(() => {
      setActivePads(prev => {
        const next = new Set(prev);
        next.delete(padId);
        return next;
      });
    }, 120);
  }, [onNoteOn, triggerRipple]);

  const handleTouchStart = (e, padId) => {
    e.preventDefault();
    e.stopPropagation();
    touchActiveRef.current = true;
    handlePadPress(padId, e);
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    setTimeout(() => {
      touchActiveRef.current = false;
    }, 100);
  };

  const handleMouseDown = (e, padId) => {
    if (touchActiveRef.current) {
      e.preventDefault();
      return;
    }
    handlePadPress(padId, e);
  };

  // Keyboard support - only active in focus mode
  useEffect(() => {
    if (!focusModeActive) return;
    
    const handleKeyDown = (e) => {
      if (e.repeat || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const pad = DRUM_PADS.find(p => p.key.toLowerCase() === e.key.toLowerCase());
      if (pad) {
        e.preventDefault();
        handlePadPress(pad.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePadPress, focusModeActive]);

  return (
    <div 
      className="w-full h-full flex items-center justify-center p-4"
      style={{ touchAction: 'none' }}
    >
      <div className="grid grid-cols-4 grid-rows-2 gap-4 md:gap-6 w-full max-w-[1200px] aspect-[2/1]">
        {DRUM_PADS.map((pad, index) => {
          const isActive = activePads.has(pad.id);
          const padRipples = Object.entries(ripples).filter(([_, id]) => id === pad.id);
          
          return (
            <motion.button
              key={pad.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ 
                delay: index * 0.05,
                type: "spring",
                stiffness: 300,
                damping: 25
              }}
              onMouseDown={(e) => handleMouseDown(e, pad.id)}
              onTouchStart={(e) => handleTouchStart(e, pad.id)}
              onTouchEnd={handleTouchEnd}
              className={`
                relative rounded-3xl font-bold overflow-hidden
                transition-all duration-75 select-none cursor-pointer
                ${isActive 
                  ? `bg-gradient-to-br ${pad.gradient} scale-[0.96] ${pad.ring} ring-4 shadow-2xl ${pad.glow}` 
                  : `bg-gradient-to-br ${pad.gradient} opacity-80 hover:opacity-100 hover:scale-[1.02]`
                }
                active:scale-[0.94]
                focus:outline-none focus:ring-4 ${pad.ring} focus:ring-opacity-50
              `}
              style={{ 
                touchAction: 'none', 
                WebkitTapHighlightColor: 'transparent',
                minHeight: '120px'
              }}
            >
              {/* Ripple effects */}
              {padRipples.map(([rippleId]) => (
                <motion.div
                  key={rippleId}
                  initial={{ scale: 0, opacity: 0.8 }}
                  animate={{ scale: 2.5, opacity: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="absolute inset-0 bg-white rounded-full pointer-events-none"
                  style={{ transformOrigin: 'center center' }}
                />
              ))}
              
              {/* Glass effect overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-black/20 pointer-events-none" />
              
              {/* Content */}
              <div className="relative flex flex-col items-center justify-center h-full text-white z-10">
                <motion.span 
                  animate={isActive ? { scale: 1.3 } : { scale: 1 }}
                  className="text-4xl md:text-5xl lg:text-6xl mb-2 drop-shadow-lg"
                  style={{ textShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
                >
                  {pad.label === 'KICK' && '🔴'}
                  {pad.label === 'SNARE' && '🟠'}
                  {pad.label === 'HI-HAT' && '🟡'}
                  {pad.label === 'CLAP' && '👏'}
                  {pad.label === 'TOM 1' && '🟢'}
                  {pad.label === 'TOM 2' && '🔵'}
                  {pad.label === 'CRASH' && '💥'}
                  {pad.label === 'RIDE' && '🔔'}
                </motion.span>
                <span className="font-black text-lg md:text-xl lg:text-2xl tracking-wider drop-shadow-lg">
                  {pad.label}
                </span>
                <span className="text-xs md:text-sm mt-2 px-3 py-1 bg-black/30 rounded-full font-mono tracking-widest">
                  [{pad.key}]
                </span>
              </div>

              {/* Active glow effect */}
              {isActive && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`absolute inset-0 bg-white/30 pointer-events-none`}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
