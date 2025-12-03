import React, { useState, useEffect } from 'react';

const NOTE_RANGES = {
  BASS: { start: 28, end: 52 },
  EP: { start: 48, end: 84 },
  GUITAR: { start: 40, end: 76 }
};

const KEY_MAP = {
  'a': 0, 's': 2, 'd': 4, 'f': 5, 'g': 7, 'h': 9, 'j': 11, 'k': 12,
  'w': 1, 'e': 3, 't': 6, 'y': 8, 'u': 10
};

export default function PianoKeyboard({ instrument, onNotePlay, disabled }) {
  const [activeNotes, setActiveNotes] = useState(new Set());
  const range = NOTE_RANGES[instrument];
  
  const notes = [];
  for (let i = range.start; i <= range.end; i++) {
    notes.push(i);
  }

  const isBlackKey = (midiNote) => {
    const noteInOctave = midiNote % 12;
    return [1, 3, 6, 8, 10].includes(noteInOctave);
  };

  const handleNoteOn = (note) => {
    if (disabled) return;
    onNotePlay(note);
    setActiveNotes(prev => new Set(prev).add(note));
  };

  const handleNoteOff = (note) => {
    setActiveNotes(prev => {
      const next = new Set(prev);
      next.delete(note);
      return next;
    });
  };

  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e) => {
      const offset = KEY_MAP[e.key.toLowerCase()];
      if (offset !== undefined) {
        const note = range.start + offset;
        if (note <= range.end && !activeNotes.has(note)) {
          handleNoteOn(note);
        }
      }
    };

    const handleKeyUp = (e) => {
      const offset = KEY_MAP[e.key.toLowerCase()];
      if (offset !== undefined) {
        const note = range.start + offset;
        if (note <= range.end) {
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
  }, [disabled, activeNotes, range]);

  const octaveCount = Math.ceil((range.end - range.start + 1) / 12);
  const displayOctaves = Math.min(octaveCount, 3);
  const displayNotes = notes.slice(0, displayOctaves * 12);

  return (
    <div className="relative bg-gray-900 rounded-lg p-4 overflow-x-auto">
      <div className="flex gap-0.5 min-w-max">
        {displayNotes.map(note => {
          const isBlack = isBlackKey(note);
          const isActive = activeNotes.has(note);

          return (
            <button
              key={note}
              onMouseDown={() => handleNoteOn(note)}
              onMouseUp={() => handleNoteOff(note)}
              onMouseLeave={() => handleNoteOff(note)}
              onTouchStart={() => handleNoteOn(note)}
              onTouchEnd={() => handleNoteOff(note)}
              disabled={disabled}
              className={`
                relative transition-all duration-75
                ${isBlack
                  ? `w-8 h-24 ${isActive ? 'bg-purple-600' : 'bg-gray-800'} hover:bg-gray-700 -mx-4 z-10`
                  : `w-12 h-32 ${isActive ? 'bg-cyan-400' : 'bg-white'} hover:bg-gray-100`
                }
                ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
                rounded-b-md border border-gray-700
                active:scale-95
              `}
              style={{
                marginLeft: isBlack ? '-1rem' : '0',
                marginRight: isBlack ? '-1rem' : '0'
              }}
            />
          );
        })}
      </div>

      {!disabled && (
        <div className="mt-2 text-xs text-white/50 text-center">
          Use keys: A S D F G H J K (white) • W E T Y U (black)
        </div>
      )}
    </div>
  );
}