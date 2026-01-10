import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Music2, Check, Lock } from 'lucide-react';
import { motion } from 'framer-motion';

const INSTRUMENT_CONFIG = {
  DRUMS: {
    name: 'Drums',
    emoji: '🥁',
    color: 'from-red-500 to-orange-500',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/30',
    textColor: 'text-red-400'
  },
  BASS: {
    name: 'Bass',
    emoji: '🎸',
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/30',
    textColor: 'text-blue-400'
  },
  EP: {
    name: 'Piano',
    emoji: '🎹',
    color: 'from-purple-500 to-pink-500',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500/30',
    textColor: 'text-purple-400'
  },
  GUITAR: {
    name: 'Guitar',
    emoji: '🎸',
    color: 'from-green-500 to-emerald-500',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/30',
    textColor: 'text-green-400'
  }
};

export default function InstrumentSlot({ 
  instrument, 
  player, 
  isAvailable, 
  onClaim,
  currentUserId,
  currentPlayerInstrument 
}) {
  const config = INSTRUMENT_CONFIG[instrument];
  const playerUserId = player?.userId || player?.user_id || player?.id;
  const isMyInstrument = playerUserId && String(playerUserId) === String(currentUserId);
  const hasOtherInstrument = currentPlayerInstrument && currentPlayerInstrument !== instrument;
  const canClaim = isAvailable && !hasOtherInstrument;

  return (
    <motion.div
      whileHover={{ scale: canClaim ? 1.02 : 1 }}
      whileTap={{ scale: canClaim ? 0.98 : 1 }}
    >
      <Card className={`
        relative overflow-hidden transition-all duration-300
        ${isMyInstrument 
          ? `bg-gradient-to-br ${config.color} border-2 border-white/50 shadow-xl shadow-purple-500/30` 
          : player 
            ? `${config.bgColor} border ${config.borderColor}` 
            : `bg-white/5 border border-white/10 hover:border-white/30 hover:bg-white/10 ${canClaim ? 'cursor-pointer' : ''}`
        }
      `}
        onClick={canClaim && !player ? onClaim : undefined}
      >
        {/* Glow effect for owned instrument */}
        {isMyInstrument && (
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
        )}
        
        <CardContent className="relative p-4 md:p-6 text-center">
          {/* Emoji icon */}
          <motion.div 
            className="text-5xl md:text-6xl mb-3"
            animate={isMyInstrument ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {config.emoji}
          </motion.div>
          
          {/* Instrument name */}
          <h3 className={`text-lg md:text-xl font-bold mb-3 ${isMyInstrument ? 'text-white' : config.textColor}`}>
            {config.name}
          </h3>

          {player ? (
            <div className="space-y-2">
              {/* Player info */}
              <div className="flex items-center justify-center gap-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg"
                  style={{ backgroundColor: player.color }}
                >
                  {player.displayName?.[0]?.toUpperCase() || '?'}
                </div>
                <span className={`font-medium text-sm truncate max-w-[100px] ${isMyInstrument ? 'text-white' : 'text-gray-300'}`}>
                  {player.displayName}
                </span>
              </div>
              
              {/* Status badge */}
              {isMyInstrument && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="inline-flex items-center gap-1 text-xs text-white bg-white/20 rounded-full px-3 py-1"
                >
                  <Check className="w-3 h-3" />
                  <span>Playing</span>
                </motion.div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Claim button */}
              <Button
                onClick={(e) => { e.stopPropagation(); onClaim(); }}
                disabled={!canClaim}
                size="sm"
                className={`
                  w-full font-bold text-sm h-10
                  ${canClaim 
                    ? `bg-gradient-to-r ${config.color} hover:opacity-90 text-white shadow-lg` 
                    : 'bg-white/10 text-gray-500 cursor-not-allowed'
                  }
                `}
              >
                {hasOtherInstrument ? (
                  <>
                    <Lock className="w-3.5 h-3.5 mr-1.5" />
                    Locked
                  </>
                ) : (
                  <>
                    <Music2 className="w-3.5 h-3.5 mr-1.5" />
                    Play
                  </>
                )}
              </Button>
              
              {/* Availability status */}
              <div className="flex items-center justify-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
                <span className={`text-xs ${isAvailable ? 'text-green-400' : 'text-gray-500'}`}>
                  {isAvailable ? 'Available' : 'Occupied'}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}