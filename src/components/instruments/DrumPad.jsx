import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

// Drum pads with colors for visual distinction
const DRUM_PADS = [
  { id: 'kick', label: 'KICK', key: 'q', color: 'from-red-500 to-red-600', emoji: '🔴' },
  { id: 'snare', label: 'SNARE', key: 'w', color: 'from-orange-500 to-orange-600', emoji: '🟠' },
  { id: 'hihat', label: 'HI-HAT', key: 'e', color: 'from-yellow-500 to-yellow-600', emoji: '🟡' },
  { id: 'clap', label: 'CLAP', key: 'r', color: 'from-pink-500 to-pink-600', emoji: '👏' },
  { id: 'tom1', label: 'TOM 1', key: 'a', color: 'from-green-500 to-green-600', emoji: '🟢' },
  { id: 'tom2', label: 'TOM 2', key: 's', color: 'from-teal-500 to-teal-600', emoji: '🔵' },
  { id: 'crash', label: 'CRASH', key: 'd', color: 'from-purple-500 to-purple-600', emoji: '💥' },
  { id: 'ride', label: 'RIDE', key: 'f', color: 'from-indigo-500 to-indigo-600', emoji: '🔔' }
];

export default function DrumPad({ onNotePlay, disabled }) {
  const [activePads, setActivePads] = useState(new Set());
  const touchActiveRef = React.useRef(false);
  const lastPressTimeRef = React.useRef({});
  const isMobile = useIsMobile();

  const handlePadPress = (padId, event = null) => {
    if (disabled) return;
    
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // Debounce: prevent rapid double-taps (min 30ms between presses - faster for drums)
    const now = Date.now();
    const lastPress = lastPressTimeRef.current[padId] || 0;
    if (now - lastPress < 30) {
      return;
    }
    lastPressTimeRef.current[padId] = now;
    
    onNotePlay(padId);
    
    // Haptic feedback on mobile if available
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
    
    // Visual feedback - shorter for faster response
    setActivePads(prev => new Set(prev).add(padId));
    setTimeout(() => {
      setActivePads(prev => {
        const next = new Set(prev);
        next.delete(padId);
        return next;
      });
    }, 100);
  };

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

  // Keyboard support
  React.useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e) => {
      const pad = DRUM_PADS.find(p => p.key === e.key.toLowerCase());
      if (pad) {
        handlePadPress(pad.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled]);

  return (
    <div 
      className={`
        grid gap-2 sm:gap-3
        ${isMobile ? 'grid-cols-2 grid-rows-4' : 'grid-cols-4 grid-rows-2'}
      `}
      style={{ touchAction: 'none' }}
      role="group"
      aria-label="Drum pad grid"
    >
      {DRUM_PADS.map(pad => (
        <button
          key={pad.id}
          onMouseDown={(e) => handleMouseDown(e, pad.id)}
          onTouchStart={(e) => handleTouchStart(e, pad.id)}
          onTouchEnd={handleTouchEnd}
          disabled={disabled}
          aria-label={`${pad.label} drum pad`}
          aria-pressed={activePads.has(pad.id)}
          role="button"
          tabIndex={disabled ? -1 : 0}
          className={`
            relative rounded-xl font-bold text-base sm:text-lg
            transition-all duration-75 select-none
            ${isMobile ? 'h-20 min-h-[80px]' : 'h-24 sm:h-28'}
            ${activePads.has(pad.id)
              ? `bg-gradient-to-br ${pad.color} scale-95 shadow-lg shadow-white/30 ring-2 ring-white`
              : `bg-gradient-to-br ${pad.color} opacity-80 hover:opacity-100`
            }
            ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer active:scale-90'}
            focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-900
          `}
          style={{ touchAction: 'none', WebkitTapHighlightColor: 'transparent' }}
        >
          <div className="flex flex-col items-center justify-center h-full text-white drop-shadow-lg">
            <span className="text-2xl mb-1">{pad.emoji}</span>
            <span className="font-black tracking-wider">{pad.label}</span>
            {!isMobile && (
              <span className="text-xs opacity-60 mt-1 font-mono">[{pad.key.toUpperCase()}]</span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}