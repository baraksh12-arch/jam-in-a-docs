import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Volume2, VolumeX } from 'lucide-react';
import DrumPad from '../instruments/DrumPad';
import PianoKeyboard from '../instruments/PianoKeyboard';
import { setBassMode, getBassMode, BASS_MODE_SYNTH, BASS_MODE_SAMPLED } from '@/lib/instruments/bass';
import { setDrumKitMode, getDrumKitMode, DRUM_KIT_MODE_SAMPLED, DRUM_KIT_MODE_ELECTRONIC } from '@/lib/instruments/drums';
import { setEPMode, getEPMode, EP_MODE_ELECTRIC, EP_MODE_UPRIGHT } from '@/lib/instruments/piano';
import { setGuitarMode, getGuitarMode, GUITAR_MODE_ELECTRIC, GUITAR_MODE_NYLON } from '@/lib/instruments/guitar';

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
  const [epMode, setEPModeState] = useState(getEPMode());
  const [guitarMode, setGuitarModeState] = useState(getGuitarMode());

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

  // Update EP mode state when it changes externally
  useEffect(() => {
    if (instrument === 'EP') {
      setEPModeState(getEPMode());
    }
  }, [instrument]);

  // Update Guitar mode state when it changes externally
  useEffect(() => {
    if (instrument === 'GUITAR') {
      setGuitarModeState(getGuitarMode());
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

  const handleEPModeChange = (event) => {
    const newMode = event.target.value;
    setEPModeState(newMode);
    setEPMode(newMode);
  };

  const handleGuitarModeChange = (event) => {
    const newMode = event.target.value;
    setGuitarModeState(newMode);
    setGuitarMode(newMode);
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
          <div className="flex items-center gap-2" role="group" aria-label="Volume controls">
            <button
              onClick={toggleMute}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              aria-label={isMuted ? `Unmute ${config.name}` : `Mute ${config.name}`}
              aria-pressed={isMuted}
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-white/70" aria-hidden="true" />
              ) : (
                <Volume2 className="w-4 h-4 text-white/70" aria-hidden="true" />
              )}
            </button>
            <Slider
              value={[isMuted ? 0 : volume]}
              onValueChange={handleVolumeChange}
              max={1}
              step={0.01}
              className="w-20"
              disabled={!player}
              aria-label={`${config.name} volume`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(volume * 100)}
            />
          </div>
        </div>
        
        {/* Bass mode toggle - only show for BASS instrument */}
        {instrument === 'BASS' && player && (
          <div className="mt-2 flex items-center gap-3 text-xs" role="radiogroup" aria-label="Bass sound mode">
            <span className="text-white/70" id="bass-mode-label">Bass:</span>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                value={BASS_MODE_SYNTH}
                checked={bassMode === BASS_MODE_SYNTH}
                onChange={handleBassModeChange}
                className="cursor-pointer"
                disabled={!isMyInstrument}
                aria-labelledby="bass-mode-label"
                aria-label="Synth bass mode"
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
                aria-labelledby="bass-mode-label"
                aria-label="Sampled bass mode"
              />
              <span className="text-white/80">Sampled</span>
            </label>
          </div>
        )}
        
        {/* Drum kit mode toggle - only show for DRUMS instrument */}
        {instrument === 'DRUMS' && player && (
          <div className="mt-2 flex items-center gap-3 text-xs" role="radiogroup" aria-label="Drum kit sound mode">
            <span className="text-white/70" id="drums-mode-label">Drums:</span>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                value={DRUM_KIT_MODE_SAMPLED}
                checked={drumKitMode === DRUM_KIT_MODE_SAMPLED}
                onChange={handleDrumKitModeChange}
                className="cursor-pointer"
                disabled={!isMyInstrument}
                aria-labelledby="drums-mode-label"
                aria-label="Sampled drum kit mode"
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
                aria-labelledby="drums-mode-label"
                aria-label="Electronic drum kit mode"
              />
              <span className="text-white/80">Electronic</span>
            </label>
          </div>
        )}
        
        {/* EP mode toggle - only show for EP instrument */}
        {instrument === 'EP' && player && (
          <div className="mt-2 flex items-center gap-3 text-xs" role="radiogroup" aria-label="Electric piano sound mode">
            <span className="text-white/70" id="ep-mode-label">EP:</span>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                value={EP_MODE_ELECTRIC}
                checked={epMode === EP_MODE_ELECTRIC}
                onChange={handleEPModeChange}
                className="cursor-pointer"
                disabled={!isMyInstrument}
                aria-labelledby="ep-mode-label"
                aria-label="Electric piano mode"
              />
              <span className="text-white/80">Electric</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                value={EP_MODE_UPRIGHT}
                checked={epMode === EP_MODE_UPRIGHT}
                onChange={handleEPModeChange}
                className="cursor-pointer"
                disabled={!isMyInstrument}
                aria-labelledby="ep-mode-label"
                aria-label="Upright piano mode"
              />
              <span className="text-white/80">Upright</span>
            </label>
          </div>
        )}
        
        {/* Guitar mode toggle - only show for GUITAR instrument */}
        {instrument === 'GUITAR' && player && (
          <div className="mt-2 flex items-center gap-3 text-xs" role="radiogroup" aria-label="Guitar sound mode">
            <span className="text-white/70" id="guitar-mode-label">Guitar:</span>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                value={GUITAR_MODE_ELECTRIC}
                checked={guitarMode === GUITAR_MODE_ELECTRIC}
                onChange={handleGuitarModeChange}
                className="cursor-pointer"
                disabled={!isMyInstrument}
                aria-labelledby="guitar-mode-label"
                aria-label="Electric guitar mode"
              />
              <span className="text-white/80">Electric</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                value={GUITAR_MODE_NYLON}
                checked={guitarMode === GUITAR_MODE_NYLON}
                onChange={handleGuitarModeChange}
                className="cursor-pointer"
                disabled={!isMyInstrument}
                aria-labelledby="guitar-mode-label"
                aria-label="Nylon guitar mode"
              />
              <span className="text-white/80">Nylon</span>
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