import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Play, 
  Pause, 
  Music, 
  Copy, 
  Check,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SCALES = ['major', 'minor'];

export default function RoomTopBar({ room, roomId, setBpm, setKey, setScale, togglePlay, toggleMetronome }) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?id=${roomId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBpmChange = (delta) => {
    const newBpm = (room?.bpm || 120) + delta;
    setBpm(newBpm);
  };

  return (
    <div className="bg-slate-800/80 backdrop-blur-sm border-b border-white/10 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Music className="w-6 h-6 text-purple-400" />
              <div>
                <h1 className="text-white font-bold">Room: {roomId}</h1>
                <p className="text-gray-400 text-xs">Jam in a Docs</p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="bg-white/5 border-white/20 text-white hover:bg-white/10"
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

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
              <span className="text-gray-400 text-sm">BPM</span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleBpmChange(-5)}
                  className="h-6 w-6 p-0 text-white hover:bg-white/10"
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
                <Input
                  type="number"
                  value={room?.bpm || 120}
                  onChange={(e) => setBpm(parseInt(e.target.value) || 120)}
                  className="w-16 h-8 text-center bg-white/5 border-white/20 text-white"
                  min="40"
                  max="240"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleBpmChange(5)}
                  className="h-6 w-6 p-0 text-white hover:bg-white/10"
                >
                  <ChevronUp className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <Select value={room?.key || 'C'} onValueChange={setKey}>
              <SelectTrigger className="w-20 bg-white/5 border-white/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KEYS.map(k => (
                  <SelectItem key={k} value={k}>{k}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={room?.scale || 'major'} onValueChange={setScale}>
              <SelectTrigger className="w-28 bg-white/5 border-white/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCALES.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={togglePlay}
              className={`${
                room?.isPlaying
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-green-500 hover:bg-green-600'
              }`}
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

            <Button
              onClick={toggleMetronome}
              variant="outline"
              className={`${
                room?.metronomeOn
                  ? 'bg-purple-500/20 border-purple-400 text-purple-300'
                  : 'bg-white/5 border-white/20 text-white'
              } hover:bg-white/10`}
            >
              <Music className="w-4 h-4 mr-2" />
              Metro
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}