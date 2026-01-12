import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Liquid Glass Drum Pad Configuration
 * Soft, luminous colors that create depth and warmth
 */
const DRUM_PADS = [
  { 
    id: 'kick', 
    label: 'Kick', 
    key: 'q', 
    // Soft coral/salmon
    baseColor: 'rgba(255, 140, 130, 0.15)',
    glowColor: 'rgba(255, 140, 130, 0.6)',
    accentColor: '#FF8C82',
    lightColor: 'rgba(255, 200, 195, 0.9)',
    icon: '●' 
  },
  { 
    id: 'snare', 
    label: 'Snare', 
    key: 'w', 
    // Soft teal/aqua
    baseColor: 'rgba(130, 220, 210, 0.15)',
    glowColor: 'rgba(130, 220, 210, 0.6)',
    accentColor: '#82DCD2',
    lightColor: 'rgba(200, 245, 240, 0.9)',
    icon: '◐' 
  },
  { 
    id: 'hihat', 
    label: 'Hi-Hat', 
    key: 'e', 
    // Soft golden/amber
    baseColor: 'rgba(255, 220, 140, 0.15)',
    glowColor: 'rgba(255, 220, 140, 0.6)',
    accentColor: '#FFDC8C',
    lightColor: 'rgba(255, 245, 210, 0.9)',
    icon: '◯' 
  },
  { 
    id: 'tom1', 
    label: 'Tom 1', 
    key: 'r', 
    // Soft lavender/violet
    baseColor: 'rgba(180, 160, 255, 0.15)',
    glowColor: 'rgba(180, 160, 255, 0.6)',
    accentColor: '#B4A0FF',
    lightColor: 'rgba(220, 210, 255, 0.9)',
    icon: '◉' 
  },
  { 
    id: 'tom2', 
    label: 'Tom 2', 
    key: 'a', 
    // Soft rose/pink
    baseColor: 'rgba(255, 160, 190, 0.15)',
    glowColor: 'rgba(255, 160, 190, 0.6)',
    accentColor: '#FFA0BE',
    lightColor: 'rgba(255, 220, 235, 0.9)',
    icon: '◉' 
  },
  { 
    id: 'crash', 
    label: 'Crash', 
    key: 's', 
    // Soft peach/orange
    baseColor: 'rgba(255, 180, 140, 0.15)',
    glowColor: 'rgba(255, 180, 140, 0.6)',
    accentColor: '#FFB48C',
    lightColor: 'rgba(255, 230, 210, 0.9)',
    icon: '✦' 
  },
  { 
    id: 'ride', 
    label: 'Ride', 
    key: 'd', 
    // Soft sky/cyan
    baseColor: 'rgba(140, 210, 240, 0.15)',
    glowColor: 'rgba(140, 210, 240, 0.6)',
    accentColor: '#8CD2F0',
    lightColor: 'rgba(210, 240, 255, 0.9)',
    icon: '✧' 
  },
  { 
    id: 'clap', 
    label: 'Clap', 
    key: 'f', 
    // Soft mint/green
    baseColor: 'rgba(170, 230, 160, 0.15)',
    glowColor: 'rgba(170, 230, 160, 0.6)',
    accentColor: '#AAE6A0',
    lightColor: 'rgba(220, 250, 215, 0.9)',
    icon: '👏' 
  }
];

/**
 * Liquid Glass Drum Pad Component
 * Features center-emanating light, translucent glass surfaces, and fluid animations
 */
const LiquidGlassPad = ({ 
  pad, 
  isActive, 
  onTrigger, 
  disabled,
  velocity 
}) => {
  const padRef = useRef(null);
  const touchStartRef = useRef(null);
  const [lightPulses, setLightPulses] = useState([]);
  const [isHovered, setIsHovered] = useState(false);
  
  // Calculate velocity from touch/click pressure or speed
  const calculateVelocity = useCallback((event) => {
    if (event.touches && event.touches[0]) {
      const touch = event.touches[0];
      if (touch.force && touch.force > 0) {
        return Math.min(1, touch.force);
      }
    }
    return 0.8;
  }, []);
  
  // Calculate position from touch/click location on pad (0=center, 1=edge)
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
  
  // Add center light pulse effect
  const addLightPulse = useCallback(() => {
    const id = Date.now();
    
    setLightPulses(prev => [...prev, { id }]);
    
    // Remove pulse after animation
    setTimeout(() => {
      setLightPulses(prev => prev.filter(p => p.id !== id));
    }, 800);
  }, []);
  
  // Handle pointer/touch events
  const handlePointerDown = useCallback((event) => {
    if (disabled) return;
    
    const rect = padRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    touchStartRef.current = Date.now();
    
    const vel = calculateVelocity(event);
    const pos = calculatePosition(event, rect);
    
    addLightPulse();
    onTrigger(pad.id, vel, pos);
  }, [disabled, pad.id, onTrigger, calculateVelocity, calculatePosition, addLightPulse]);
  
  // Prevent context menu on long press
  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
  }, []);
  
  return (
    <motion.button
      ref={padRef}
      onPointerDown={handlePointerDown}
      onContextMenu={handleContextMenu}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      disabled={disabled}
      className="relative overflow-hidden touch-none select-none"
      style={{
        // Liquid Glass base - translucent with depth
        background: `
          linear-gradient(
            145deg, 
            rgba(255, 255, 255, 0.12) 0%,
            rgba(255, 255, 255, 0.05) 50%,
            rgba(255, 255, 255, 0.02) 100%
          )
        `,
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderRadius: '24px',
        // Multi-layer glass border
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: `
          0 8px 32px rgba(0, 0, 0, 0.15),
          0 2px 8px rgba(0, 0, 0, 0.1),
          inset 0 1px 0 rgba(255, 255, 255, 0.2),
          inset 0 -1px 0 rgba(255, 255, 255, 0.05)
        `,
        height: '100%',
        width: '100%',
        minHeight: '80px',
      }}
      initial={false}
      animate={{
        scale: isActive ? 0.96 : 1,
      }}
      transition={{ 
        type: 'spring', 
        stiffness: 600, 
        damping: 35,
        mass: 0.4
      }}
      whileHover={!disabled ? { 
        scale: 1.02,
      } : undefined}
    >
      {/* === GLASS LAYERS === */}
      
      {/* Top glass highlight - creates depth illusion */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            linear-gradient(
              180deg, 
              rgba(255, 255, 255, 0.25) 0%, 
              rgba(255, 255, 255, 0.08) 20%,
              transparent 50%
            )
          `,
          borderRadius: '22px',
        }}
      />
      
      {/* Inner glass surface with subtle color tint */}
      <div 
        className="absolute inset-[2px] pointer-events-none rounded-[22px]"
        style={{
          background: `
            radial-gradient(
              ellipse 100% 100% at 50% 0%,
              rgba(255, 255, 255, 0.08) 0%,
              transparent 60%
            )
          `,
        }}
      />
      
      {/* === CENTER LIGHT SYSTEM === */}
      
      {/* Permanent ambient center glow - always visible */}
      <div 
        className="absolute inset-0 pointer-events-none flex items-center justify-center"
        style={{ borderRadius: '22px' }}
      >
        {/* Inner soft glow */}
        <div
          style={{
            position: 'absolute',
            width: '50%',
            height: '50%',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${pad.lightColor} 0%, transparent 70%)`,
            filter: 'blur(12px)',
            opacity: 0.5,
          }}
        />
        {/* Outer ambient glow */}
        <motion.div
          animate={{
            opacity: isHovered ? 0.7 : 0.45,
            scale: isHovered ? 1.15 : 1,
          }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          style={{
            width: '70%',
            height: '70%',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${pad.glowColor} 0%, ${pad.baseColor} 40%, transparent 70%)`,
            filter: 'blur(10px)',
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
              duration: 0.08,
              ease: [0.4, 0, 0.2, 1]
            }}
            className="absolute inset-0 pointer-events-none"
            style={{ borderRadius: '22px', overflow: 'hidden' }}
          >
            {/* Intense white-hot center */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `
                  radial-gradient(
                    circle at 50% 50%,
                    rgba(255, 255, 255, 0.95) 0%,
                    ${pad.lightColor} 15%,
                    ${pad.accentColor} 35%,
                    ${pad.glowColor} 55%,
                    transparent 80%
                  )
                `,
              }}
            />
            
            {/* Full pad color wash */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `${pad.accentColor}35`,
              }}
            />
            
            {/* Bright outer bloom */}
            <div
              style={{
                position: 'absolute',
                inset: '-20%',
                background: `
                  radial-gradient(
                    circle at 50% 50%,
                    ${pad.accentColor}90 0%,
                    ${pad.glowColor} 40%,
                    transparent 70%
                  )
                `,
                filter: 'blur(16px)',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Light pulse animation - emanates from center */}
      <AnimatePresence>
        {lightPulses.map(pulse => (
          <motion.div
            key={pulse.id}
            className="absolute inset-0 pointer-events-none flex items-center justify-center"
            style={{ borderRadius: '22px', overflow: 'hidden' }}
          >
            <motion.div
              initial={{ scale: 0, opacity: 0.9 }}
              animate={{ scale: 2.5, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ 
                duration: 0.7,
                ease: [0.25, 0.46, 0.45, 0.94]
              }}
              style={{
                width: '40%',
                height: '40%',
                borderRadius: '50%',
                background: `
                  radial-gradient(
                    circle,
                    ${pad.lightColor} 0%,
                    ${pad.accentColor}40 40%,
                    transparent 70%
                  )
                `,
                filter: 'blur(4px)',
              }}
            />
          </motion.div>
        ))}
      </AnimatePresence>
      
      {/* === CONTENT === */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full p-2">
        {/* Icon with dynamic lighting */}
        <motion.span 
          className="text-2xl mb-1"
          style={{ 
            color: isActive ? pad.accentColor : 'rgba(255, 255, 255, 0.85)',
            textShadow: isActive 
              ? `0 0 20px ${pad.accentColor}, 0 0 40px ${pad.glowColor}` 
              : '0 2px 4px rgba(0, 0, 0, 0.2)',
            filter: isActive ? 'brightness(1.3)' : 'none',
          }}
          animate={{
            scale: isActive ? 1.15 : 1,
            y: isActive ? -2 : 0,
          }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        >
          {pad.icon}
        </motion.span>
        
        {/* Label with glass-like appearance */}
        <motion.span 
          className="font-medium text-sm tracking-wide"
          style={{ 
            color: isActive ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.75)',
            textShadow: isActive 
              ? `0 0 12px ${pad.accentColor}80`
              : '0 1px 2px rgba(0, 0, 0, 0.3)',
          }}
          animate={{
            opacity: isActive ? 1 : 0.85,
          }}
        >
          {pad.label}
        </motion.span>
        
        {/* Key hint - frosted pill */}
        <span 
          className="text-[10px] font-semibold mt-1 px-2 py-0.5 rounded-full"
          style={{ 
            color: 'rgba(255, 255, 255, 0.5)',
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          {pad.key.toUpperCase()}
        </span>
      </div>
      
      {/* === EDGE EFFECTS === */}
      
      {/* Bottom edge shadow for depth */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-1/3 pointer-events-none"
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.08), transparent)',
          borderRadius: '0 0 22px 22px',
        }}
      />
      
      {/* Hover glow ring */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          borderRadius: '24px',
          border: `2px solid transparent`,
          background: `linear-gradient(145deg, transparent, transparent) padding-box,
                      linear-gradient(145deg, ${pad.accentColor}00, ${pad.accentColor}40) border-box`,
        }}
        animate={{
          opacity: isHovered ? 0.6 : 0,
        }}
        transition={{ duration: 0.2 }}
      />
      
      {/* Active glow ring */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            className="absolute -inset-[1px] pointer-events-none"
            style={{
              borderRadius: '25px',
              boxShadow: `
                0 0 20px ${pad.glowColor},
                0 0 40px ${pad.glowColor}60,
                inset 0 0 20px ${pad.glowColor}30
              `,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
          />
        )}
      </AnimatePresence>
      
      {/* Disabled overlay - frosted glass */}
      {disabled && (
        <div 
          className="absolute inset-0"
          style={{ 
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px) grayscale(80%)',
            borderRadius: '22px',
          }}
        />
      )}
    </motion.button>
  );
};

/**
 * Liquid Glass Hi-Hat Pedal Control
 */
const LiquidGlassHiHatPedal = ({ openAmount, onOpenChange, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);
  
  const handleDrag = useCallback((event) => {
    if (!isDragging || disabled || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    let clientY;
    
    if (event.touches && event.touches[0]) {
      clientY = event.touches[0].clientY;
    } else {
      clientY = event.clientY;
    }
    
    const relY = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    onOpenChange(relY);
  }, [isDragging, disabled, onOpenChange]);
  
  useEffect(() => {
    if (!isDragging) return;
    
    const handleMove = (e) => handleDrag(e);
    const handleEnd = () => setIsDragging(false);
    
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);
    
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, handleDrag]);
  
  return (
    <div 
      ref={containerRef}
      className="relative h-32 w-14 rounded-2xl overflow-hidden touch-none select-none cursor-ns-resize"
      style={{
        background: `
          linear-gradient(
            145deg, 
            rgba(255, 255, 255, 0.1) 0%,
            rgba(255, 255, 255, 0.04) 50%,
            rgba(255, 255, 255, 0.02) 100%
          )
        `,
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        boxShadow: `
          0 8px 32px rgba(0, 0, 0, 0.15),
          inset 0 1px 0 rgba(255, 255, 255, 0.2)
        `,
      }}
      onMouseDown={() => setIsDragging(true)}
      onTouchStart={() => setIsDragging(true)}
    >
      {/* Top glass highlight */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 40%)',
          borderRadius: '14px',
        }}
      />
      
      {/* Track background */}
      <div 
        className="absolute inset-x-2.5 inset-y-4 rounded-xl overflow-hidden"
        style={{
          background: 'rgba(0, 0, 0, 0.2)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        {/* Fill with center glow */}
        <motion.div 
          className="absolute inset-x-0 bottom-0 flex items-end justify-center"
          style={{
            background: `
              linear-gradient(
                to top, 
                rgba(255, 220, 140, 0.8),
                rgba(255, 220, 140, 0.4) 50%,
                rgba(255, 220, 140, 0.1)
              )
            `,
          }}
          animate={{
            height: `${Math.max(8, openAmount * 100)}%`,
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          {/* Center light glow */}
          <div
            style={{
              position: 'absolute',
              bottom: '50%',
              width: '80%',
              height: '30%',
              background: 'radial-gradient(ellipse, rgba(255, 245, 210, 0.9), transparent 70%)',
              filter: 'blur(6px)',
            }}
          />
        </motion.div>
      </div>
      
      {/* Handle - liquid glass knob */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 w-10 h-5 rounded-full"
        style={{
          background: `
            linear-gradient(
              180deg, 
              rgba(255, 255, 255, 0.4) 0%,
              rgba(255, 255, 255, 0.15) 50%,
              rgba(255, 255, 255, 0.1) 100%
            )
          `,
          border: '1px solid rgba(255, 255, 255, 0.3)',
          boxShadow: `
            0 4px 12px rgba(0, 0, 0, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.3)
          `,
        }}
        animate={{
          bottom: `${Math.max(12, openAmount * 80 + 12)}%`,
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      />
      
      {/* Label */}
      <div 
        className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[9px] font-medium"
        style={{ color: 'rgba(255, 255, 255, 0.5)' }}
      >
        HH
      </div>
    </div>
  );
};

/**
 * Main DrumPad Component with Liquid Glass Aesthetic
 */
export default function DrumPad({ 
  onNotePlay, 
  disabled, 
  disableKeyboard = false,
  showHiHatPedal = true 
}) {
  const [activePads, setActivePads] = useState(new Map());
  const [hihatOpen, setHihatOpen] = useState(0);
  const activeTimeoutsRef = useRef(new Map());
  
  /**
   * Handle pad trigger with velocity and position
   */
  const handlePadTrigger = useCallback((padId, velocity = 0.8, position = 0.5) => {
    if (disabled) return;
    
    onNotePlay(padId, velocity, position);
    
    setActivePads(prev => {
      const next = new Map(prev);
      next.set(padId, { velocity, position });
      return next;
    });
    
    const existingTimeout = activeTimeoutsRef.current.get(padId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    const timeout = setTimeout(() => {
      setActivePads(prev => {
        const next = new Map(prev);
        next.delete(padId);
        return next;
      });
      activeTimeoutsRef.current.delete(padId);
    }, 150);
    
    activeTimeoutsRef.current.set(padId, timeout);
  }, [disabled, onNotePlay]);
  
  /**
   * Handle hi-hat pedal change
   */
  const handleHiHatChange = useCallback((amount) => {
    setHihatOpen(amount);
  }, []);
  
  /**
   * Keyboard support
   */
  useEffect(() => {
    if (disabled || disableKeyboard) return;
    
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.repeat) return;
      
      const pad = DRUM_PADS.find(p => p.key === e.key.toLowerCase());
      if (pad) {
        handlePadTrigger(pad.id, 0.85, 0.3);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled, disableKeyboard, handlePadTrigger]);
  
  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      activeTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    };
  }, []);
  
  return (
    <div className="flex gap-4">
      {/* Main pad grid */}
      <div className="flex-1">
        <div className="grid grid-cols-4 gap-2.5 sm:gap-3.5">
          {DRUM_PADS.map(pad => (
            <div key={pad.id} className="aspect-square">
              <LiquidGlassPad
                pad={pad}
                isActive={activePads.has(pad.id)}
                velocity={activePads.get(pad.id)?.velocity ?? 0}
                onTrigger={handlePadTrigger}
                disabled={disabled}
              />
            </div>
          ))}
        </div>
      </div>
      
      {/* Hi-Hat Pedal */}
      {showHiHatPedal && (
        <div className="flex flex-col items-center justify-center">
          <LiquidGlassHiHatPedal
            openAmount={hihatOpen}
            onOpenChange={handleHiHatChange}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
