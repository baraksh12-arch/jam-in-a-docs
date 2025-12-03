import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Volume2, VolumeX } from 'lucide-react';
import DrumPad from './DrumPad';
import PianoKeyboard from './PianoKeyboard';

const INSTRUMENT_CONFIG = {
  DRUMS: {
    name: 'Drums',
    color: 'from-red-500 to-orange-500',
    textColor: 'text-red-400'
  },
  BASS: {
    name: 'Bass',
    color: 'from-blue-500 to-cyan-500',
    textColor: 'text-cyan-400'
  },
  EP: {
    name: 'Electric Piano',
    color: 'from-purple-500 to-pink-500',
    textColor: 'text-purple-400'
  },
  GUITAR: {
    name: 'Guitar',
    color: 'from-green-500 to-emerald-500',
    textColor: 'text-green-400'
  }
};

const InstrumentPanel = forwardRef(function InstrumentPanel({ 
  instrument, 
  player, 
  isMyInstrument, 
  audioEngine, 
  sendNote,
  isPlaying,
  onActivity
}, ref) {
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [activity, setActivity] = useState(false);

  const config = INSTRUMENT_CONFIG[instrument];

  // Expose triggerActivity method via ref for external triggering
  useImperativeHandle(ref, () => ({
    triggerActivity: () => {
      setActivity(true);
      setTimeout(() => setActivity(false), 100);
    }
  }), []);

  // Register onActivity callback if provided (for useNoteEvents to trigger)
  useEffect(() => {
    if (onActivity) {
      onActivity(() => {
        setActivity(true);
        setTimeout(() => setActivity(false), 100);
      });
    }
  }, [onActivity]);

  const handleNotePlay = (note) => {
    audioEngine.playNote(instrument, note, 100);
    sendNote(instrument, note, 'NOTE_ON', 100);

    // Local activity indicator (useNoteEvents will also trigger via callback for consistency)
    setActivity(true);
    setTimeout(() => setActivity(false), 100);
  };

  const handleVolumeChange = (value) => {
    const newVolume = value[0];
    setVolume(newVolume);
    audioEngine.setInstrumentVolume(instrument, newVolume);
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    audioEngine.setInstrumentVolume(instrument, newMuted ? 0 : volume);
  };

  return (
    <Card className={`
      bg-gradient-to-br ${config.color} bg-opacity-10 border-2
      ${isMyInstrument 
        ? 'border-white shadow-lg' 
        : player 
          ? 'border-white/30' 
          : 'border-white/10 opacity-50'
      }
      transition-all duration-300
    `}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`
              w-3 h-3 rounded-full transition-all duration-150
              ${activity ? 'bg-white scale-150' : 'bg-white/30'}
            `} />
            <div>
              <h3 className={`font-bold ${config.textColor}`}>{config.name}</h3>
              {player && (
                <p className="text-xs text-white/70">{player.displayName}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="p-1 hover:bg-white/20 rounded transition-colors"
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-white/70" />
              ) : (
                <Volume2 className="w-4 h-4 text-white/70" />
              )}
            </button>
            <Slider
              value={[isMuted ? 0 : volume]}
              onValueChange={handleVolumeChange}
              max={1}
              step={0.01}
              className="w-20"
              disabled={!player}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {!player ? (
          <div className="py-12 text-center">
            <p className="text-white/50">Waiting for player...</p>
          </div>
        ) : instrument === 'DRUMS' ? (
          <DrumPad 
            onNotePlay={handleNotePlay}
            disabled={!isMyInstrument}
          />
        ) : (
          <PianoKeyboard
            instrument={instrument}
            onNotePlay={handleNotePlay}
            disabled={!isMyInstrument}
          />
        )}
      </CardContent>
    </Card>
  );
});

export default InstrumentPanel;