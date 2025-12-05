import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

const DRUM_PADS = [
  { id: 'kick', label: 'Kick', key: 'q' },
  { id: 'snare', label: 'Snare', key: 'w' },
  { id: 'hihat', label: 'Hi-Hat', key: 'e' },
  { id: 'tom1', label: 'Tom 1', key: 'r' },
  { id: 'tom2', label: 'Tom 2', key: 'a' },
  { id: 'crash', label: 'Crash', key: 's' },
  { id: 'ride', label: 'Ride', key: 'd' },
  { id: 'clap', label: 'Clap', key: 'f' }
];

export default function DrumPad({ onNotePlay, disabled }) {
  const [activePads, setActivePads] = useState(new Set());

  const handlePadPress = (padId) => {
    if (disabled) return;
    
    onNotePlay(padId);
    
    // Visual feedback
    setActivePads(prev => new Set(prev).add(padId));
    setTimeout(() => {
      setActivePads(prev => {
        const next = new Set(prev);
        next.delete(padId);
        return next;
      });
    }, 150);
  };

  // Keyboard support
  // Removed throttling: allow rapid hits on the same pad for fast patterns (16th notes, rolls)
  // activePads is now only used for visual feedback, not input blocking
  React.useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e) => {
      const pad = DRUM_PADS.find(p => p.key === e.key.toLowerCase());
      if (pad) {
        // Always allow the hit - no blocking based on activePads
        // This enables fast patterns like 16th notes and rolls
        handlePadPress(pad.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled]); // Removed activePads dependency - no longer needed for blocking

  return (
    <div className="grid grid-cols-4 gap-2">
      {DRUM_PADS.map(pad => (
        <button
          key={pad.id}
          onClick={() => handlePadPress(pad.id)}
          disabled={disabled}
          className={`
            relative h-20 rounded-lg font-semibold text-sm
            transition-all duration-150
            ${activePads.has(pad.id)
              ? 'bg-white text-gray-900 scale-95 shadow-lg'
              : 'bg-white/20 text-white hover:bg-white/30'
            }
            ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
          `}
        >
          <div className="flex flex-col items-center justify-center h-full">
            <span>{pad.label}</span>
            <span className="text-xs opacity-70 mt-1">{pad.key.toUpperCase()}</span>
          </div>
        </button>
      ))}
    </div>
  );
}