import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Play, 
  Pause, 
  Music2, 
  Copy, 
  Check,
  ChevronUp,
  ChevronDown,
  Wifi,
  Users,
  Settings,
  Volume2,
  Eye,
  Maximize2,
  Sparkles
} from 'lucide-react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { CURRENT_LATENCY_MODE, LATENCY_MODES } from '@/config/latencyMode';

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SCALES = ['major', 'minor', 'pentatonic', 'blues', 'dorian'];

export default function RoomTopBar({ 
  room, 
  roomId, 
  setBpm, 
  setKey, 
  setScale, 
  togglePlay, 
  toggleMetronome, 
  playerCount = 0, 
  crowdCount = 0, 
  isCrowdMode = false,
  wsConnected = false,
  onEnterFocusMode,
  canEnterFocusMode = false
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?id=${roomId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBpmChange = (delta) => {
    const newBpm = Math.min(240, Math.max(40, (room?.bpm || 120) + delta));
    setBpm(newBpm);
  };

  const isUltraLow = CURRENT_LATENCY_MODE === LATENCY_MODES.ULTRA;

  return (
    <header className="sticky top-0 z-50">
      {/* Main header bar with glassmorphism */}
      <div className="bg-gradient-to-r from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-xl border-b border-white/5 shadow-2xl shadow-black/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top row - Room info */}
          <div className="flex items-center justify-between py-3 border-b border-white/5">
            {/* Left side - Logo and room info */}
            <div className="flex items-center gap-4">
              {/* Logo */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
                    <Music2 className="w-5 h-5 text-white" />
                  </div>
                  {/* Animated pulse ring */}
                  <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 opacity-30 blur animate-pulse" />
                </div>
                <div>
                  <h1 className="text-lg font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                    {roomId?.toUpperCase() || 'Room'}
                  </h1>
                  <p className="text-xs text-gray-500">Jam in a Docs</p>
                </div>
              </div>

              {/* Status indicators */}
              <div className="hidden sm:flex items-center gap-2">
                {/* Real-time connection status */}
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-300 ${
                  wsConnected 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                }`}>
                  <Wifi className={`w-3 h-3 ${!wsConnected && 'opacity-50'}`} />
                  <span>{wsConnected ? 'Live' : 'Connecting...'}</span>
                </div>

                {/* Latency mode indicator */}
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                  isUltraLow 
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' 
                    : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                }`}>
                  <span>{isUltraLow ? '⚡ Ultra' : '🔄 Synced'}</span>
                </div>

                {/* Player count */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Users className="w-3 h-3" />
                  <span>{playerCount} {playerCount === 1 ? 'player' : 'players'}</span>
                </div>

                {/* Crowd count */}
                {crowdCount > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20">
                    <Eye className="w-3 h-3" />
                    <span>{crowdCount} watching</span>
                  </div>
                )}

                {/* Crowd mode badge */}
                {isCrowdMode && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20">
                    <Eye className="w-3 h-3" />
                    <span>Crowd Mode</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right side - Share button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyLink}
              className={`
                relative overflow-hidden rounded-full px-4 py-2 text-sm font-medium transition-all duration-300
                ${copied 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20'
                }
              `}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Share
                </>
              )}
            </Button>
          </div>

          {/* Bottom row - Controls (hidden or read-only for crowd mode) */}
          {!isCrowdMode ? (
            <div className="flex items-center justify-between py-3 gap-4 overflow-x-auto">
              {/* BPM Control */}
              <div className="flex items-center gap-6 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 uppercase tracking-wider font-medium hidden sm:block">BPM</span>
                  <div className="flex items-center bg-white/5 rounded-lg border border-white/10 overflow-hidden">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleBpmChange(-5)}
                      className="h-9 w-9 p-0 text-gray-400 hover:text-white hover:bg-white/10 rounded-none border-r border-white/10"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                    <Input
                      type="number"
                      value={room?.bpm || 120}
                      onChange={(e) => setBpm(Math.min(240, Math.max(40, parseInt(e.target.value) || 120)))}
                      className="w-16 h-9 text-center bg-transparent border-0 text-white font-mono font-bold text-lg focus:ring-0 focus:outline-none"
                      min="40"
                      max="240"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleBpmChange(5)}
                      className="h-9 w-9 p-0 text-gray-400 hover:text-white hover:bg-white/10 rounded-none border-l border-white/10"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Key & Scale */}
                <div className="flex items-center gap-2">
                  <Select value={room?.key || 'C'} onValueChange={setKey}>
                    <SelectTrigger className="w-16 h-9 bg-white/5 border-white/10 text-white font-medium rounded-lg hover:bg-white/10 transition-colors">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-white/10">
                      {KEYS.map(k => (
                        <SelectItem key={k} value={k} className="text-white hover:bg-white/10">{k}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={room?.scale || 'major'} onValueChange={setScale}>
                    <SelectTrigger className="w-28 h-9 bg-white/5 border-white/10 text-white font-medium rounded-lg hover:bg-white/10 transition-colors">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-white/10">
                      {SCALES.map(s => (
                        <SelectItem key={s} value={s} className="text-white hover:bg-white/10 capitalize">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Transport Controls */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Play/Stop button */}
                <Button
                  onClick={togglePlay}
                  className={`
                    relative h-10 px-5 rounded-full font-semibold text-sm transition-all duration-300 shadow-lg
                    ${room?.isPlaying
                      ? 'bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white shadow-rose-500/25'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-emerald-500/25'
                    }
                  `}
                >
                  {room?.isPlaying ? (
                    <>
                      <Pause className="w-4 h-4 mr-2" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Play
                    </>
                  )}
                </Button>

                {/* Metronome button */}
                <Button
                  onClick={toggleMetronome}
                  className={`
                    h-10 px-4 rounded-full font-medium text-sm transition-all duration-300
                    ${room?.metronomeOn
                      ? 'bg-violet-500/20 border-2 border-violet-400 text-violet-300 hover:bg-violet-500/30'
                      : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white hover:border-white/20'
                    }
                  `}
                >
                  <Volume2 className="w-4 h-4 mr-2" />
                  Metro
                </Button>

                {/* Focus Mode button - Premium feature */}
                {canEnterFocusMode && (
                  <Button
                    onClick={onEnterFocusMode}
                    className="
                      relative h-10 px-5 rounded-full font-semibold text-sm transition-all duration-300
                      bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 
                      hover:from-amber-400 hover:via-orange-400 hover:to-rose-400
                      text-white shadow-lg shadow-orange-500/30
                      group overflow-hidden
                    "
                  >
                    {/* Animated shine effect */}
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    <Maximize2 className="w-4 h-4 mr-2 relative z-10" />
                    <span className="relative z-10">Focus</span>
                    <Sparkles className="w-3 h-3 ml-1.5 relative z-10 text-amber-200" />
                  </Button>
                )}
              </div>
            </div>
          ) : (
            /* Read-only status bar for crowd mode */
            <div className="flex items-center justify-center py-3 gap-6">
              <div className="flex items-center gap-2 text-gray-400">
                <span className="text-xs uppercase tracking-wider font-medium">BPM</span>
                <span className="text-white font-mono font-bold text-lg">{room?.bpm || 120}</span>
              </div>
              <div className="w-px h-6 bg-white/10" />
              <div className="flex items-center gap-2 text-gray-400">
                <span className="text-xs uppercase tracking-wider font-medium">Key</span>
                <span className="text-white font-medium">{room?.key || 'C'} {room?.scale || 'major'}</span>
              </div>
              <div className="w-px h-6 bg-white/10" />
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                room?.isPlaying 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-white/5 text-gray-500 border border-white/10'
              }`}>
                {room?.isPlaying ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                <span>{room?.isPlaying ? 'Playing' : 'Stopped'}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
