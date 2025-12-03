import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Music2 } from 'lucide-react';

const INSTRUMENT_CONFIG = {
  DRUMS: {
    name: 'Drums',
    emoji: '🥁',
    color: 'from-red-500 to-orange-500',
    icon: '🥁'
  },
  BASS: {
    name: 'Bass',
    emoji: '🎸',
    color: 'from-blue-500 to-cyan-500',
    icon: '🎸'
  },
  EP: {
    name: 'Electric Piano',
    emoji: '🎹',
    color: 'from-purple-500 to-pink-500',
    icon: '🎹'
  },
  GUITAR: {
    name: 'Guitar',
    emoji: '🎸',
    color: 'from-green-500 to-emerald-500',
    icon: '🎸'
  }
};

export default function InstrumentSlot({ 
  instrument, 
  player, 
  isAvailable, 
  onClaim,
  currentUserId 
}) {
  const config = INSTRUMENT_CONFIG[instrument];
  const isMyInstrument = player?.id === currentUserId;

  return (
    <Card className={`
      border-2 transition-all duration-300
      ${isMyInstrument 
        ? 'border-purple-400 bg-gradient-to-br ' + config.color + ' shadow-lg shadow-purple-500/50' 
        : player 
          ? 'border-white/20 bg-white/5' 
          : 'border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10 cursor-pointer'
      }
    `}>
      <CardContent className="p-6 text-center">
        <div className="text-6xl mb-4">{config.icon}</div>
        
        <h3 className={`text-xl font-bold mb-2 ${isMyInstrument ? 'text-white' : 'text-gray-200'}`}>
          {config.name}
        </h3>

        {player ? (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: player.color }}
              />
              <span className={`font-medium ${isMyInstrument ? 'text-white' : 'text-gray-300'}`}>
                {player.displayName}
              </span>
            </div>
            {isMyInstrument && (
              <div className="text-xs text-white/80 bg-white/20 rounded px-2 py-1 inline-block">
                Your instrument
              </div>
            )}
          </div>
        ) : (
          <Button
            onClick={onClaim}
            className={`mt-4 bg-gradient-to-r ${config.color} hover:opacity-90 text-white font-semibold`}
          >
            <Music2 className="w-4 h-4 mr-2" />
            Claim {config.name}
          </Button>
        )}

        <div className="mt-4">
          {isAvailable ? (
            <span className="text-xs text-green-400">● Available</span>
          ) : (
            <span className="text-xs text-gray-500">● Occupied</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}