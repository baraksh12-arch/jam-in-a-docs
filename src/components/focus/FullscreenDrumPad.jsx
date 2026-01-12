import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Liquid Glass Fullscreen Drum Pad Configuration
 * Soft, luminous colors with premium glass aesthetic
 */
const DRUM_PADS = [
  { 
    id: 'kick', 
    label: 'KICK', 
    key: 'Q', 
    baseColor: 'rgba(255, 140, 130, 0.15)',
    glowColor: 'rgba(255, 140, 130, 0.5)',
    accentColor: '#FF8C82',
    lightColor: 'rgba(255, 200, 195, 0.9)',
    icon: '●' 
  },
  { 
    id: 'snare', 
    label: 'SNARE', 
    key: 'W', 
    baseColor: 'rgba(130, 220, 210, 0.15)',
    glowColor: 'rgba(130, 220, 210, 0.5)',
    accentColor: '#82DCD2',
    lightColor: 'rgba(200, 245, 240, 0.9)',
    icon: '◐' 
  },
  { 
    id: 'hihat', 
    label: 'HI-HAT', 
    key: 'E', 
    baseColor: 'rgba(255, 220, 140, 0.15)',
    glowColor: 'rgba(255, 220, 140, 0.5)',
    accentColor: '#FFDC8C',
    lightColor: 'rgba(255, 245, 210, 0.9)',
    icon: '◯' 
  },
  { 
    id: 'clap', 
    label: 'CLAP', 
    key: 'R', 
    baseColor: 'rgba(170, 230, 160, 0.15)',
    glowColor: 'rgba(170, 230, 160, 0.5)',
    accentColor: '#AAE6A0',
    lightColor: 'rgba(220, 250, 215, 0.9)',
    icon: '👏' 
  },
  { 
    id: 'tom1', 
    label: 'TOM 1', 
    key: 'A', 
    baseColor: 'rgba(180, 160, 255, 0.15)',
    glowColor: 'rgba(180, 160, 255, 0.5)',
    accentColor: '#B4A0FF',
    lightColor: 'rgba(220, 210, 255, 0.9)',
    icon: '◉' 
  },
  { 
    id: 'tom2', 
    label: 'TOM 2', 
    key: 'S', 
    baseColor: 'rgba(255, 160, 190, 0.15)',
    glowColor: 'rgba(255, 160, 190, 0.5)',
    accentColor: '#FFA0BE',
    lightColor: 'rgba(255, 220, 235, 0.9)',
    icon: '◉' 
  },
  { 
    id: 'crash', 
    label: 'CRASH', 
    key: 'D', 
    baseColor: 'rgba(255, 180, 140, 0.15)',
    glowColor: 'rgba(255, 180, 140, 0.5)',
    accentColor: '#FFB48C',
    lightColor: 'rgba(255, 230, 210, 0.9)',
    icon: '✦' 
  },
  { 
    id: 'ride', 
    label: 'RIDE', 
    key: 'F', 
    baseColor: 'rgba(140, 210, 240, 0.15)',
    glowColor: 'rgba(140, 210, 240, 0.5)',
    accentColor: '#8CD2F0',
    lightColor: 'rgba(210, 240, 255, 0.9)',
    icon: '✧' 
  }
];

/**
 * Liquid Glass Drum Pad for fullscreen mode
 * Features center-emanating light and premium glass aesthetic
 */
const LiquidGlassPad = ({ 
  pad, 
  isActive, 
  onTrigger, 
  lightPulses,
  index 
}) => {
  const padRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  
  const calculateVelocity = useCallback((event) => {
    if (event.touches && event.touches[0]) {
      const touch = event.touches[0];
      if (touch.force && touch.force > 0) {
        return Math.min(1, 0.5 + touch.force * 0.5);
      }
    }
    return 0.85;
  }, []);
  
  const calculatePosition = useCallback((event, rect) => {
    let clientX, clientY;
    
    if (event.touches && event.touches[0]) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }
    
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxDist = Math.sqrt(Math.pow(rect.width / 2, 2) + Math.pow(rect.height / 2, 2));
    const dist = Math.sqrt(Math.pow(clientX - centerX, 2) + Math.pow(clientY - centerY, 2));
    
    return Math.min(1, dist / maxDist);
  }, []);
  
  const handlePress = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    
    const rect = padRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const velocity = calculateVelocity(event);
    const position = calculatePosition(event, rect);
    
    onTrigger(pad.id, velocity, position);
  }, [pad.id, onTrigger, calculateVelocity, calculatePosition]);
  
  const padPulses = lightPulses.filter(p => p.padId === pad.id);
  
  return (
    <motion.button
      ref={padRef}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ 
        delay: index * 0.04,
        type: "spring",
        stiffness: 350,
        damping: 28
      }}
      onPointerDown={handlePress}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onContextMenu={(e) => e.preventDefault()}
      className="relative overflow-hidden touch-none select-none cursor-pointer"
      style={{
        // Liquid Glass base
        background: `
          linear-gradient(
            145deg, 
            rgba(255, 255, 255, 0.14) 0%,
            rgba(255, 255, 255, 0.06) 50%,
            rgba(255, 255, 255, 0.02) 100%
          )
        `,
        backdropFilter: 'blur(32px) saturate(180%)',
        WebkitBackdropFilter: 'blur(32px) saturate(180%)',
        borderRadius: '32px',
        border: '1px solid rgba(255, 255, 255, 0.22)',
        boxShadow: `
          0 12px 48px rgba(0, 0, 0, 0.18),
          0 4px 16px rgba(0, 0, 0, 0.12),
          inset 0 1px 0 rgba(255, 255, 255, 0.25),
          inset 0 -1px 0 rgba(255, 255, 255, 0.05)
        `,
        touchAction: 'none',
        WebkitTapHighlightColor: 'transparent',
        minHeight: '140px',
      }}
    >
      {/* === GLASS LAYERS === */}
      
      {/* Top glass highlight */}
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
          borderRadius: '30px',
        }}
      />
      
      {/* Inner glass surface */}
      <div 
        className="absolute inset-[3px] pointer-events-none rounded-[29px]"
        style={{
          background: `
            radial-gradient(
              ellipse 100% 100% at 50% 0%,
              rgba(255, 255, 255, 0.1) 0%,
              transparent 60%
            )
          `,
        }}
      />
      
      {/* === CENTER LIGHT SYSTEM === */}
      
      {/* Permanent ambient center glow - always visible */}
      <div 
        className="absolute inset-0 pointer-events-none flex items-center justify-center"
        style={{ borderRadius: '30px' }}
      >
        {/* Inner soft glow */}
        <div
          style={{
            position: 'absolute',
            width: '40%',
            height: '40%',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${pad.lightColor} 0%, transparent 70%)`,
            filter: 'blur(16px)',
            opacity: 0.55,
          }}
        />
        {/* Outer ambient glow */}
        <motion.div
          animate={{
            opacity: isHovered ? 0.75 : 0.5,
            scale: isHovered ? 1.2 : 1,
          }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          style={{
            width: '65%',
            height: '65%',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${pad.glowColor} 0%, ${pad.baseColor} 40%, transparent 70%)`,
            filter: 'blur(14px)',
          }}
        />
      </div>
      
      {/* Active state - BRIGHT center light burst like real drum pad LED */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ 
              duration: 0.06,
              ease: [0.4, 0, 0.2, 1]
            }}
            className="absolute inset-0 pointer-events-none"
            style={{ borderRadius: '30px', overflow: 'hidden' }}
          >
            {/* Intense white-hot center */}
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
            
            {/* Full pad color wash */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `${pad.accentColor}40`,
              }}
            />
            
            {/* Bright outer bloom */}
            <div
              style={{
                position: 'absolute',
                inset: '-25%',
                background: `
                  radial-gradient(
                    circle at 50% 50%,
                    ${pad.accentColor}95 0%,
                    ${pad.glowColor} 35%,
                    transparent 65%
                  )
                `,
                filter: 'blur(20px)',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Light pulse animations */}
      <AnimatePresence>
        {padPulses.map(pulse => (
          <motion.div
            key={pulse.id}
            className="absolute inset-0 pointer-events-none flex items-center justify-center"
            style={{ borderRadius: '30px', overflow: 'hidden' }}
          >
            <motion.div
              initial={{ scale: 0, opacity: 0.95 }}
              animate={{ scale: 3, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ 
                duration: 0.8,
                ease: [0.25, 0.46, 0.45, 0.94]
              }}
              style={{
                width: '35%',
                height: '35%',
                borderRadius: '50%',
                background: `
                  radial-gradient(
                    circle,
                    ${pad.lightColor} 0%,
                    ${pad.accentColor}50 35%,
                    transparent 65%
                  )
                `,
                filter: 'blur(6px)',
              }}
            />
          </motion.div>
        ))}
      </AnimatePresence>
      
      {/* === CONTENT === */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full p-4">
        {/* Icon */}
        <motion.span 
          className="text-5xl md:text-6xl lg:text-7xl mb-3"
          style={{ 
            color: isActive ? pad.accentColor : 'rgba(255, 255, 255, 0.9)',
            textShadow: isActive 
              ? `0 0 30px ${pad.accentColor}, 0 0 60px ${pad.glowColor}` 
              : '0 4px 8px rgba(0, 0, 0, 0.3)',
            filter: isActive ? 'brightness(1.4)' : 'none',
          }}
          animate={{
            scale: isActive ? 1.2 : 1,
            y: isActive ? -4 : 0,
          }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        >
          {pad.icon}
        </motion.span>
        
        {/* Label */}
        <motion.span 
          className="font-bold text-xl md:text-2xl lg:text-3xl tracking-widest"
          style={{ 
            color: isActive ? 'rgba(255, 255, 255, 0.98)' : 'rgba(255, 255, 255, 0.8)',
            textShadow: isActive 
              ? `0 0 20px ${pad.accentColor}90`
              : '0 2px 6px rgba(0, 0, 0, 0.4)',
          }}
        >
          {pad.label}
        </motion.span>
        
        {/* Key hint */}
        <span 
          className="text-sm md:text-base mt-4 px-5 py-2 rounded-full font-mono tracking-widest"
          style={{ 
            color: 'rgba(255, 255, 255, 0.55)',
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
          }}
        >
          [{pad.key}]
        </span>
      </div>
      
      {/* === EDGE EFFECTS === */}
      
      {/* Bottom shadow */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-1/4 pointer-events-none"
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.1), transparent)',
          borderRadius: '0 0 30px 30px',
        }}
      />
      
      {/* Hover glow ring */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          borderRadius: '32px',
          border: `2px solid transparent`,
          background: `linear-gradient(145deg, transparent, transparent) padding-box,
                      linear-gradient(145deg, ${pad.accentColor}00, ${pad.accentColor}50) border-box`,
        }}
        animate={{
          opacity: isHovered ? 0.7 : 0,
        }}
        transition={{ duration: 0.25 }}
      />
      
      {/* Active glow ring */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            className="absolute -inset-[2px] pointer-events-none"
            style={{
              borderRadius: '34px',
              boxShadow: `
                0 0 30px ${pad.glowColor},
                0 0 60px ${pad.glowColor}60,
                inset 0 0 25px ${pad.glowColor}40
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

/**
 * FullscreenDrumPad - Liquid Glass Premium Experience
 * Features center-emanating light, translucent glass surfaces, and fluid animations
 */
export default function FullscreenDrumPad({ onNoteOn, onNoteOff, focusModeActive = true, viewOnly = false }) {
  const [activePads, setActivePads] = useState(new Set());
  const [lightPulses, setLightPulses] = useState([]);
  const lastPressTimeRef = useRef({});
  const pulseIdRef = useRef(0);

  const handlePadTrigger = useCallback((padId, velocity, position) => {
    if (viewOnly) return;
    
    // Debounce rapid presses
    const now = Date.now();
    const lastPress = lastPressTimeRef.current[padId] || 0;
    if (now - lastPress < 30) return;
    lastPressTimeRef.current[padId] = now;
    
    // Trigger sound
    const midiVelocity = Math.round(velocity * 127);
    onNoteOn?.(padId, midiVelocity, position);
    
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(15);
    }
    
    // Add light pulse
    const pulseId = `${padId}-${pulseIdRef.current++}`;
    setLightPulses(prev => [...prev, { id: pulseId, padId }]);
    setTimeout(() => {
      setLightPulses(prev => prev.filter(p => p.id !== pulseId));
    }, 800);
    
    // Visual feedback
    setActivePads(prev => new Set(prev).add(padId));
    setTimeout(() => {
      setActivePads(prev => {
        const next = new Set(prev);
        next.delete(padId);
        return next;
      });
    }, 120);
  }, [onNoteOn, viewOnly]);

  // Keyboard support
  useEffect(() => {
    if (!focusModeActive || viewOnly) return;
    
    const handleKeyDown = (e) => {
      if (e.repeat || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const pad = DRUM_PADS.find(p => p.key.toLowerCase() === e.key.toLowerCase());
      if (pad) {
        e.preventDefault();
        handlePadTrigger(pad.id, 0.85, 0.3);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePadTrigger, focusModeActive, viewOnly]);

  return (
    <div 
      className="w-full h-full flex items-center justify-center p-4 md:p-6 lg:p-8"
      style={{ touchAction: 'none' }}
    >
      <div className="grid grid-cols-4 grid-rows-2 gap-3 md:gap-5 lg:gap-7 w-full max-w-[1400px] aspect-[2/1]">
        {DRUM_PADS.map((pad, index) => (
          <LiquidGlassPad
            key={pad.id}
            pad={pad}
            isActive={activePads.has(pad.id)}
            onTrigger={handlePadTrigger}
            lightPulses={lightPulses}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}
