import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Volume2, VolumeX } from 'lucide-react';
import DrumPad from '../instruments/DrumPad';
import PianoKeyboard from '../instruments/PianoKeyboard';
import { setBassMode, getBassMode, BASS_MODE_SYNTH, BASS_MODE_SAMPLED } from '@/lib/instruments/bass';
import { setDrumKitMode, getDrumKitMode, DRUM_KIT_MODE_SAMPLED, DRUM_KIT_MODE_ELECTRONIC } from '@/lib/instruments/drums';

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

export default function InstrumentPanel({ 
  instrument, 
  player, 
  isMyInstrument, 
  audioEngine, 
  sendNote,
  isPlaying 
}) {
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [activity, setActivity] = useState(false);
  const [bassMode, setBassModeState] = useState(getBassMode());
  const [drumKitMode, setDrumKitModeState] = useState(getDrumKitMode());

  const config = INSTRUMENT_CONFIG[instrument];

  // Update bass mode state when it changes externally
  useEffect(() => {
    if (instrument === 'BASS') {
      setBassModeState(getBassMode());
    }
  }, [instrument]);

  // Update drum kit mode state when it changes externally
  useEffect(() => {
    if (instrument === 'DRUMS') {
      setDrumKitModeState(getDrumKitMode());
    }
  }, [instrument]);

  const handleNotePlay = (note) => {
    // Play locally
    audioEngine.playNote(instrument, note, 100);
    
    // Send to others
    sendNote(instrument, note, 'NOTE_ON', 100);

    // Show activity indicator
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

  const handleBassModeChange = (event) => {
    const newMode = event.target.value;
    setBassModeState(newMode);
    setBassMode(newMode);
  };

  const handleDrumKitModeChange = (event) => {
    const newMode = event.target.value;
    setDrumKitModeState(newMode);
    setDrumKitMode(newMode);
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

          {/* Volume controls */}
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
        
        {/* Bass mode toggle - only show for BASS instrument */}
        {instrument === 'BASS' && player && (
          <div className="mt-2 flex items-center gap-3 text-xs">
            <span className="text-white/70">Bass:</span>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                value={BASS_MODE_SYNTH}
                checked={bassMode === BASS_MODE_SYNTH}
                onChange={handleBassModeChange}
                className="cursor-pointer"
                disabled={!isMyInstrument}
              />
              <span className="text-white/80">Synth</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                value={BASS_MODE_SAMPLED}
                checked={bassMode === BASS_MODE_SAMPLED}
                onChange={handleBassModeChange}
                className="cursor-pointer"
                disabled={!isMyInstrument}
              />
              <span className="text-white/80">Sampled</span>
            </label>
          </div>
        )}
        
        {/* Drum kit mode toggle - only show for DRUMS instrument */}
        {instrument === 'DRUMS' && player && (
          <div className="mt-2 flex items-center gap-3 text-xs">
            <span className="text-white/70">Drums:</span>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                value={DRUM_KIT_MODE_SAMPLED}
                checked={drumKitMode === DRUM_KIT_MODE_SAMPLED}
                onChange={handleDrumKitModeChange}
                className="cursor-pointer"
                disabled={!isMyInstrument}
              />
              <span className="text-white/80">Sampled</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                value={DRUM_KIT_MODE_ELECTRONIC}
                checked={drumKitMode === DRUM_KIT_MODE_ELECTRONIC}
                onChange={handleDrumKitModeChange}
                className="cursor-pointer"
                disabled={!isMyInstrument}
              />
              <span className="text-white/80">Electronic</span>
            </label>
          </div>
        )}
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
}