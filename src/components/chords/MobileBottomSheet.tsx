/**
 * MobileBottomSheet - Tabbed Control Panel for Mobile
 * 
 * Features:
 * - Swipeable tabs: Play / Scale & Chords / Voicing
 * - Smooth drawer behavior
 * - Snap points (collapsed, half, full)
 * - Touch-friendly controls
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo, useDragControls } from 'framer-motion';
import { cn } from '@/lib/utils';
import ScaleChordSetup from './ScaleChordSetup';
import VoicingControls from './VoicingControls';
import type { ScaleDefinition } from '@/lib/music/scale';
import type { ChordPadAssignment } from '@/lib/music/chords';
import type { VoicingState } from '@/lib/music/voicing';

type TabType = 'play' | 'scale' | 'voicing';

interface MobileBottomSheetProps {
  // Scale/Chord props
  currentScale: ScaleDefinition;
  use7thChords: boolean;
  onScaleChange: (scale: ScaleDefinition) => void;
  onChordSetChange: (assignments: ChordPadAssignment[]) => void;
  onUse7thChordsChange: (use7ths: boolean) => void;
  
  // Voicing props
  voicingState: VoicingState;
  onVoicingStateChange: (state: Partial<VoicingState>) => void;
  strumTime: number;
  humanize: number;
  sustain: boolean;
  onStrumTimeChange: (value: number) => void;
  onHumanizeChange: (value: number) => void;
  onSustainChange: (value: boolean) => void;
  lockMode: 'none' | 'per-pad' | 'global';
  globalInversion: number;
  maxInversion: number;
  onLockModeChange: (mode: 'none' | 'per-pad' | 'global') => void;
  onGlobalInversionChange: (inv: number) => void;
}

const TABS: { id: TabType; label: string; icon: string }[] = [
  { id: 'play', label: 'Play', icon: '🎹' },
  { id: 'scale', label: 'Scale', icon: '🎵' },
  { id: 'voicing', label: 'Voicing', icon: '🎛️' },
];

// Snap points for sheet height (as fraction of viewport)
const SNAP_COLLAPSED = 0.12;
const SNAP_HALF = 0.45;
const SNAP_FULL = 0.85;

export default function MobileBottomSheet(props: MobileBottomSheetProps) {
  const [activeTab, setActiveTab] = useState<TabType>('play');
  const [sheetHeight, setSheetHeight] = useState(SNAP_COLLAPSED);
  const [isDragging, setIsDragging] = useState(false);
  
  const handleDragEnd = useCallback((event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);
    
    const velocity = info.velocity.y;
    const offset = info.offset.y;
    
    // Determine snap point based on velocity and current position
    let newHeight = sheetHeight;
    
    if (velocity < -500) {
      // Fast upward swipe - expand
      newHeight = sheetHeight < SNAP_HALF ? SNAP_HALF : SNAP_FULL;
    } else if (velocity > 500) {
      // Fast downward swipe - collapse
      newHeight = sheetHeight > SNAP_HALF ? SNAP_HALF : SNAP_COLLAPSED;
    } else {
      // Slow drag - snap to nearest
      const currentHeight = sheetHeight - (offset / window.innerHeight);
      const distances = [
        { point: SNAP_COLLAPSED, dist: Math.abs(currentHeight - SNAP_COLLAPSED) },
        { point: SNAP_HALF, dist: Math.abs(currentHeight - SNAP_HALF) },
        { point: SNAP_FULL, dist: Math.abs(currentHeight - SNAP_FULL) },
      ];
      distances.sort((a, b) => a.dist - b.dist);
      newHeight = distances[0].point;
    }
    
    setSheetHeight(newHeight);
  }, [sheetHeight]);
  
  const handleDrag = useCallback((event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // Update height during drag for responsive feel
    const newHeight = sheetHeight - (info.offset.y / window.innerHeight);
    // Clamp between collapsed and full
    const clampedHeight = Math.max(SNAP_COLLAPSED, Math.min(SNAP_FULL, newHeight));
    // Only update if significantly different (for performance)
    if (Math.abs(clampedHeight - sheetHeight) > 0.01) {
      setIsDragging(true);
    }
  }, [sheetHeight]);
  
  const expandSheet = useCallback(() => {
    setSheetHeight(prev => prev < SNAP_HALF ? SNAP_HALF : SNAP_FULL);
  }, []);
  
  const isExpanded = sheetHeight > SNAP_COLLAPSED;
  
  return (
    <motion.div
      className="fixed inset-x-0 bottom-0 z-50 bg-gradient-to-t from-black via-gray-900 to-gray-900/95 backdrop-blur-xl rounded-t-3xl shadow-2xl shadow-black/50"
      style={{
        height: `${sheetHeight * 100}vh`,
      }}
      animate={{
        height: `${sheetHeight * 100}vh`,
      }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 30,
      }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.1}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
    >
      {/* Drag Handle */}
      <div 
        className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
        onClick={expandSheet}
      >
        <div className="w-12 h-1.5 rounded-full bg-white/30" />
      </div>
      
      {/* Tab Bar */}
      <div className="px-4 pb-2">
        <div className="flex bg-white/5 rounded-xl p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (sheetHeight === SNAP_COLLAPSED) {
                  setSheetHeight(SNAP_HALF);
                }
              }}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all',
                'text-sm font-medium',
                activeTab === tab.id
                  ? 'bg-white/10 text-white'
                  : 'text-white/50 hover:text-white/70'
              )}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Tab Content */}
      <div 
        className="flex-1 overflow-y-auto px-4 pb-safe scrollbar-hide"
        style={{ 
          maxHeight: `calc(${sheetHeight * 100}vh - 100px)`,
          touchAction: isExpanded ? 'pan-y' : 'none',
        }}
      >
        <AnimatePresence mode="wait">
          {activeTab === 'play' && (
            <motion.div
              key="play"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="py-4"
            >
              <PlayTab
                sustain={props.sustain}
                strumTime={props.strumTime}
                humanize={props.humanize}
                onSustainChange={props.onSustainChange}
                onStrumTimeChange={props.onStrumTimeChange}
                onHumanizeChange={props.onHumanizeChange}
              />
            </motion.div>
          )}
          
          {activeTab === 'scale' && (
            <motion.div
              key="scale"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="py-4"
            >
              <ScaleChordSetup
                currentScale={props.currentScale}
                use7thChords={props.use7thChords}
                onScaleChange={props.onScaleChange}
                onChordSetChange={props.onChordSetChange}
                onUse7thChordsChange={props.onUse7thChordsChange}
              />
            </motion.div>
          )}
          
          {activeTab === 'voicing' && (
            <motion.div
              key="voicing"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="py-4"
            >
              <VoicingControls
                voicingState={props.voicingState}
                onVoicingStateChange={props.onVoicingStateChange}
                strumTime={props.strumTime}
                humanize={props.humanize}
                sustain={props.sustain}
                onStrumTimeChange={props.onStrumTimeChange}
                onHumanizeChange={props.onHumanizeChange}
                onSustainChange={props.onSustainChange}
                lockMode={props.lockMode}
                globalInversion={props.globalInversion}
                maxInversion={props.maxInversion}
                onLockModeChange={props.onLockModeChange}
                onGlobalInversionChange={props.onGlobalInversionChange}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/**
 * PlayTab - Quick access playback controls
 */
interface PlayTabProps {
  sustain: boolean;
  strumTime: number;
  humanize: number;
  onSustainChange: (value: boolean) => void;
  onStrumTimeChange: (value: number) => void;
  onHumanizeChange: (value: number) => void;
}

function PlayTab({
  sustain,
  strumTime,
  humanize,
  onSustainChange,
  onStrumTimeChange,
  onHumanizeChange,
}: PlayTabProps) {
  return (
    <div className="space-y-4">
      {/* Quick Sustain Toggle */}
      <button
        onClick={() => onSustainChange(!sustain)}
        className={cn(
          'w-full p-4 rounded-2xl transition-all',
          'flex items-center justify-between',
          sustain
            ? 'bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30'
            : 'bg-white/5 text-white/70 hover:bg-white/10'
        )}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎵</span>
          <div className="text-left">
            <span className="block text-lg font-bold">Sustain</span>
            <span className="block text-xs opacity-70">
              {sustain ? 'Chords hold until next' : 'Release when finger lifts'}
            </span>
          </div>
        </div>
        <div className={cn(
          'px-3 py-1 rounded-full text-xs font-bold',
          sustain ? 'bg-white/20' : 'bg-white/10'
        )}>
          {sustain ? 'ON' : 'OFF'}
        </div>
      </button>
      
      {/* Quick Strum Presets */}
      <div>
        <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
          Strum Style
        </label>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Piano', value: 0, icon: '🎹' },
            { label: 'Soft', value: 20, icon: '🪕' },
            { label: 'Guitar', value: 40, icon: '🎸' },
            { label: 'Harp', value: 70, icon: '🎻' },
          ].map((preset) => (
            <button
              key={preset.value}
              onClick={() => onStrumTimeChange(preset.value)}
              className={cn(
                'p-3 rounded-xl text-center transition-all',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500',
                strumTime === preset.value
                  ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-500/50'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              )}
            >
              <span className="text-xl block mb-1">{preset.icon}</span>
              <span className="text-[10px] font-medium">{preset.label}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Quick Humanize Presets */}
      <div>
        <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
          Feel
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Robotic', value: 0, icon: '🤖' },
            { label: 'Tight', value: 0.3, icon: '🎯' },
            { label: 'Human', value: 0.7, icon: '👤' },
          ].map((preset) => (
            <button
              key={preset.value}
              onClick={() => onHumanizeChange(preset.value)}
              className={cn(
                'p-3 rounded-xl text-center transition-all',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
                humanize === preset.value
                  ? 'bg-violet-500/30 text-violet-200 border border-violet-500/50'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              )}
            >
              <span className="text-xl block mb-1">{preset.icon}</span>
              <span className="text-[10px] font-medium">{preset.label}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Tips */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/5 border border-violet-500/10">
        <h4 className="text-sm font-bold text-violet-300 mb-2">💡 Pro Tips</h4>
        <ul className="text-xs text-white/50 space-y-1">
          <li>• Slide <span className="text-white/70">horizontally</span> on a pad to change inversions</li>
          <li>• Slide <span className="text-white/70">vertically</span> to add 7ths, 9ths, etc.</li>
          <li>• Tap near <span className="text-white/70">top</span> for soft, <span className="text-white/70">bottom</span> for loud</li>
        </ul>
      </div>
    </div>
  );
}
