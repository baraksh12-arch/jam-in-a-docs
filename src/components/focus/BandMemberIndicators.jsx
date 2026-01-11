import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Volume2 } from 'lucide-react';

/**
 * BandMemberIndicators - Real-time activity lights for band members
 * 
 * Shows glowing indicators when band members play notes
 * Click to reveal mini keyboard/instrument showing their activity
 */

// Mini keyboard for displaying played notes
const MiniKeyboard = ({ notes = [], instrument, playerName, color, onClose }) => {
  const whiteKeys = [0, 2, 4, 5, 7, 9, 11]; // C, D, E, F, G, A, B
  const blackKeys = [1, 3, 6, 8, 10]; // C#, D#, F#, G#, A#
  const blackKeyPositions = { 1: 0.7, 3: 1.7, 6: 3.7, 8: 4.7, 10: 5.7 };

  // Convert MIDI notes to note classes (0-11)
  const activeNoteClasses = notes.map(n => n % 12);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      className="relative bg-black/90 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl"
      style={{ width: 200 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full animate-pulse"
            style={{ backgroundColor: color }}
          />
          <span className="text-white text-xs font-medium truncate max-w-[100px]">
            {playerName}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded-lg transition-colors"
        >
          <X className="w-3 h-3 text-white/50" />
        </button>
      </div>

      {/* Instrument label */}
      <div className="px-3 py-1 bg-white/5">
        <span className="text-white/40 text-[10px] uppercase tracking-wider">
          {instrument}
        </span>
      </div>

      {/* Mini keyboard */}
      <div className="relative h-16 mx-2 my-2">
        {/* White keys */}
        <div className="absolute inset-0 flex gap-[1px]">
          {whiteKeys.map((noteClass, idx) => {
            const isActive = activeNoteClasses.includes(noteClass);
            return (
              <div
                key={noteClass}
                className={`
                  flex-1 rounded-b-sm transition-all duration-75
                  ${isActive 
                    ? 'bg-gradient-to-b from-white to-gray-200 shadow-lg' 
                    : 'bg-gradient-to-b from-gray-100 to-gray-300'
                  }
                `}
                style={{
                  boxShadow: isActive 
                    ? `0 0 10px ${color}, 0 2px 4px rgba(0,0,0,0.3)` 
                    : '0 2px 4px rgba(0,0,0,0.2)'
                }}
              />
            );
          })}
        </div>

        {/* Black keys */}
        <div className="absolute top-0 left-0 right-0 h-[60%]">
          {blackKeys.map((noteClass) => {
            const isActive = activeNoteClasses.includes(noteClass);
            const position = blackKeyPositions[noteClass];
            return (
              <div
                key={noteClass}
                className={`
                  absolute w-[12%] h-full rounded-b-sm transition-all duration-75
                  ${isActive 
                    ? 'bg-gradient-to-b from-gray-700 to-gray-900' 
                    : 'bg-gradient-to-b from-gray-800 to-black'
                  }
                `}
                style={{
                  left: `${(position / 7) * 100}%`,
                  boxShadow: isActive 
                    ? `0 0 8px ${color}` 
                    : '0 2px 4px rgba(0,0,0,0.4)'
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Active notes display */}
      {notes.length > 0 && (
        <div className="px-3 py-2 border-t border-white/10 flex items-center gap-1 flex-wrap">
          {notes.slice(0, 5).map((note, idx) => (
            <span
              key={idx}
              className="px-1.5 py-0.5 text-[9px] font-mono rounded"
              style={{ backgroundColor: `${color}40`, color: color }}
            >
              {getNoteNameFromMidi(note)}
            </span>
          ))}
          {notes.length > 5 && (
            <span className="text-white/30 text-[9px]">+{notes.length - 5}</span>
          )}
        </div>
      )}
    </motion.div>
  );
};

// Drum visualization for drum players
const MiniDrumPad = ({ notes = [], playerName, color, onClose }) => {
  const drumPads = [
    { note: 36, name: 'KICK' },
    { note: 38, name: 'SNARE' },
    { note: 42, name: 'HH' },
    { note: 46, name: 'OH' },
    { note: 45, name: 'TOM' },
    { note: 49, name: 'CRASH' },
    { note: 51, name: 'RIDE' },
    { note: 39, name: 'CLAP' }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      className="relative bg-black/90 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl"
      style={{ width: 180 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full animate-pulse"
            style={{ backgroundColor: color }}
          />
          <span className="text-white text-xs font-medium truncate max-w-[100px]">
            {playerName}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded-lg transition-colors"
        >
          <X className="w-3 h-3 text-white/50" />
        </button>
      </div>

      {/* Mini drum pads */}
      <div className="grid grid-cols-4 gap-1 p-2">
        {drumPads.map((pad) => {
          const isActive = notes.includes(pad.note);
          return (
            <div
              key={pad.note}
              className={`
                aspect-square rounded-lg flex items-center justify-center
                transition-all duration-75 text-[8px] font-bold
                ${isActive 
                  ? 'bg-white/30 scale-95' 
                  : 'bg-white/10'
                }
              `}
              style={{
                boxShadow: isActive ? `0 0 10px ${color}` : 'none',
                color: isActive ? color : 'rgba(255,255,255,0.4)'
              }}
            >
              {pad.name}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

// Helper function
function getNoteNameFromMidi(midi) {
  const notes = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  return `${notes[midi % 12]}${octave}`;
}

export default function BandMemberIndicators({ 
  players = [], 
  currentUserId,
  noteEvents = {}, // { playerId: { notes: [], lastActivity: timestamp } }
  position = 'top' // 'top' or 'bottom'
}) {
  const [expandedPlayer, setExpandedPlayer] = useState(null);
  const [playerActivity, setPlayerActivity] = useState({});
  const activityTimeouts = useRef({});

  // Track note activity with decay
  useEffect(() => {
    Object.entries(noteEvents).forEach(([playerId, event]) => {
      if (playerId === currentUserId) return;
      
      // Update activity state
      setPlayerActivity(prev => ({
        ...prev,
        [playerId]: {
          notes: event.notes || [],
          isActive: true,
          lastActivity: event.lastActivity
        }
      }));

      // Clear previous timeout
      if (activityTimeouts.current[playerId]) {
        clearTimeout(activityTimeouts.current[playerId]);
      }

      // Set decay timeout (stop showing active after 500ms of no activity)
      activityTimeouts.current[playerId] = setTimeout(() => {
        setPlayerActivity(prev => ({
          ...prev,
          [playerId]: {
            ...prev[playerId],
            isActive: false,
            notes: []
          }
        }));
      }, 500);
    });

    return () => {
      Object.values(activityTimeouts.current).forEach(clearTimeout);
    };
  }, [noteEvents, currentUserId]);

  // Filter out current user
  const otherPlayers = players.filter(p => p.userId !== currentUserId);

  if (otherPlayers.length === 0) return null;

  const containerClass = position === 'top' 
    ? 'fixed top-20 left-0 right-0 z-30 px-4'
    : 'fixed bottom-24 left-0 right-0 z-30 px-4';

  return (
    <div className={containerClass}>
      <div className="flex items-center justify-center gap-3 flex-wrap">
        {otherPlayers.map((player) => {
          const activity = playerActivity[player.userId] || { isActive: false, notes: [] };
          const isExpanded = expandedPlayer === player.userId;
          const color = player.color || '#8b5cf6';

          return (
            <div key={player.userId} className="relative">
              {/* Activity indicator button */}
              <motion.button
                onClick={() => setExpandedPlayer(isExpanded ? null : player.userId)}
                className={`
                  relative flex items-center gap-2 px-3 py-2 rounded-xl
                  transition-all duration-200 group
                  ${isExpanded 
                    ? 'bg-white/20 border border-white/30' 
                    : 'bg-black/40 backdrop-blur-sm border border-white/10 hover:bg-black/60'
                  }
                `}
                whileTap={{ scale: 0.95 }}
              >
                {/* Activity light */}
                <motion.div
                  animate={activity.isActive ? {
                    scale: [1, 1.5, 1],
                    opacity: [0.5, 1, 0.5]
                  } : {}}
                  transition={{ duration: 0.3, repeat: activity.isActive ? Infinity : 0 }}
                  className="relative"
                >
                  <div
                    className={`
                      w-4 h-4 rounded-full transition-all duration-150
                      ${activity.isActive ? 'shadow-lg' : ''}
                    `}
                    style={{
                      backgroundColor: activity.isActive ? color : `${color}40`,
                      boxShadow: activity.isActive ? `0 0 15px ${color}` : 'none'
                    }}
                  />
                  {/* Pulse ring */}
                  {activity.isActive && (
                    <motion.div
                      className="absolute inset-0 rounded-full"
                      style={{ borderColor: color, borderWidth: 2 }}
                      animate={{ scale: [1, 2], opacity: [0.8, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity }}
                    />
                  )}
                </motion.div>

                {/* Player info */}
                <div className="flex flex-col items-start">
                  <span className="text-white text-xs font-medium truncate max-w-[80px]">
                    {player.displayName}
                  </span>
                  <span className="text-white/40 text-[10px] uppercase">
                    {player.instrument}
                  </span>
                </div>

                {/* Sound indicator */}
                {activity.isActive && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0 }}
                  >
                    <Volume2 className="w-3 h-3" style={{ color }} />
                  </motion.div>
                )}
              </motion.button>

              {/* Expanded mini display */}
              <AnimatePresence>
                {isExpanded && (
                  <div 
                    className={`absolute ${position === 'top' ? 'top-full mt-2' : 'bottom-full mb-2'} left-1/2 -translate-x-1/2 z-50`}
                  >
                    {player.instrument === 'DRUMS' ? (
                      <MiniDrumPad
                        notes={activity.notes}
                        playerName={player.displayName}
                        color={color}
                        onClose={() => setExpandedPlayer(null)}
                      />
                    ) : (
                      <MiniKeyboard
                        notes={activity.notes}
                        instrument={player.instrument}
                        playerName={player.displayName}
                        color={color}
                        onClose={() => setExpandedPlayer(null)}
                      />
                    )}
                  </div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
