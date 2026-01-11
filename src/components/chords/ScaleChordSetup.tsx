/**
 * ScaleChordSetup - Scale & Chord Set Configuration Panel
 * 
 * Features:
 * - Scale root note selection
 * - Scale type picker (modes, pentatonic, blues, etc.)
 * - Custom scale editor (12-semitone toggle)
 * - Chord set builder (triads/7ths toggle)
 * - Preset save/load
 */

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { 
  NOTE_NAMES, 
  SCALE_INTERVALS,
  buildScale, 
  buildCustomScale,
  getScaleTypes,
  getScaleDisplayName,
  type ScaleDefinition,
} from '@/lib/music/scale';
import { 
  generateDiatonicChords, 
  createDiatonicPadAssignments,
  type ChordPadAssignment,
} from '@/lib/music/chords';

// Interval names for custom scale editor
const INTERVAL_NAMES = [
  'R', 'm2', 'M2', 'm3', 'M3', 'P4', 
  'TT', 'P5', 'm6', 'M6', 'm7', 'M7'
];

interface ScaleChordSetupProps {
  currentScale: ScaleDefinition;
  use7thChords: boolean;
  onScaleChange: (scale: ScaleDefinition) => void;
  onChordSetChange: (assignments: ChordPadAssignment[]) => void;
  onUse7thChordsChange: (use7ths: boolean) => void;
}

export default function ScaleChordSetup({
  currentScale,
  use7thChords,
  onScaleChange,
  onChordSetChange,
  onUse7thChordsChange,
}: ScaleChordSetupProps) {
  const [showCustomEditor, setShowCustomEditor] = useState(false);
  const [customSemitones, setCustomSemitones] = useState<boolean[]>(
    Array(12).fill(false).map((_, i) => i === 0) // Root always selected
  );
  const [customScaleName, setCustomScaleName] = useState('My Scale');
  
  const scaleTypes = useMemo(() => getScaleTypes(), []);
  
  // Handle root note change
  const handleRootChange = useCallback((root: string) => {
    if (currentScale.isCustom) {
      const newScale = buildCustomScale(root, customSemitones, customScaleName);
      onScaleChange(newScale);
      onChordSetChange(createDiatonicPadAssignments(newScale, use7thChords));
    } else {
      const newScale = buildScale(root, currentScale.type);
      onScaleChange(newScale);
      onChordSetChange(createDiatonicPadAssignments(newScale, use7thChords));
    }
  }, [currentScale, customSemitones, customScaleName, use7thChords, onScaleChange, onChordSetChange]);
  
  // Handle scale type change
  const handleScaleTypeChange = useCallback((type: string) => {
    if (type === 'Custom') {
      setShowCustomEditor(true);
      const newScale = buildCustomScale(currentScale.root, customSemitones, customScaleName);
      onScaleChange(newScale);
      onChordSetChange(createDiatonicPadAssignments(newScale, use7thChords));
    } else {
      setShowCustomEditor(false);
      const newScale = buildScale(currentScale.root, type);
      onScaleChange(newScale);
      onChordSetChange(createDiatonicPadAssignments(newScale, use7thChords));
    }
  }, [currentScale.root, customSemitones, customScaleName, use7thChords, onScaleChange, onChordSetChange]);
  
  // Handle custom semitone toggle
  const handleSemitoneToggle = useCallback((index: number) => {
    if (index === 0) return; // Can't disable root
    
    const newSemitones = [...customSemitones];
    newSemitones[index] = !newSemitones[index];
    setCustomSemitones(newSemitones);
    
    const newScale = buildCustomScale(currentScale.root, newSemitones, customScaleName);
    onScaleChange(newScale);
    onChordSetChange(createDiatonicPadAssignments(newScale, use7thChords));
  }, [customSemitones, currentScale.root, customScaleName, use7thChords, onScaleChange, onChordSetChange]);
  
  // Handle 7th chord toggle
  const handle7thToggle = useCallback(() => {
    const newUse7ths = !use7thChords;
    onUse7thChordsChange(newUse7ths);
    onChordSetChange(createDiatonicPadAssignments(currentScale, newUse7ths));
  }, [use7thChords, currentScale, onUse7thChordsChange, onChordSetChange]);
  
  // Generate preview of scale notes
  const scaleNotesPreview = useMemo(() => {
    return currentScale.notes.join(' - ');
  }, [currentScale]);
  
  // Generate chord preview
  const chordsPreview = useMemo(() => {
    const chords = generateDiatonicChords(currentScale, use7thChords);
    return chords.map(c => c.symbol).join(' - ');
  }, [currentScale, use7thChords]);
  
  return (
    <div className="space-y-5">
      {/* Current Scale Display */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/10 border border-violet-500/20">
        <h3 className="text-sm font-bold text-violet-300 mb-2">Current Scale</h3>
        <p className="text-2xl font-black text-white mb-1">
          {getScaleDisplayName(currentScale)}
        </p>
        <p className="text-xs text-white/50 font-mono">
          {scaleNotesPreview}
        </p>
      </div>
      
      {/* Root Note Selection */}
      <div>
        <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
          Root Note
        </label>
        <div className="grid grid-cols-6 gap-1.5">
          {NOTE_NAMES.map((note) => (
            <button
              key={note}
              onClick={() => handleRootChange(note)}
              className={cn(
                'py-2.5 px-1 rounded-lg text-sm font-bold transition-all',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
                currentScale.root === note
                  ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30'
                  : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
              )}
            >
              {note}
            </button>
          ))}
        </div>
      </div>
      
      {/* Scale Type Selection */}
      <div>
        <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
          Scale Type
        </label>
        <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto scrollbar-hide">
          {scaleTypes.map((type) => (
            <button
              key={type}
              onClick={() => handleScaleTypeChange(type)}
              className={cn(
                'py-2 px-3 rounded-lg text-xs font-medium transition-all text-left',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
                currentScale.type === type && !currentScale.isCustom
                  ? 'bg-violet-500/30 text-violet-200 border border-violet-500/50'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
              )}
            >
              {type}
            </button>
          ))}
          <button
            onClick={() => handleScaleTypeChange('Custom')}
            className={cn(
              'py-2 px-3 rounded-lg text-xs font-medium transition-all text-left',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
              currentScale.isCustom
                ? 'bg-orange-500/30 text-orange-200 border border-orange-500/50'
                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
            )}
          >
            ✨ Custom...
          </button>
        </div>
      </div>
      
      {/* Custom Scale Editor */}
      <AnimatePresence>
        {showCustomEditor && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-orange-300">Custom Scale Editor</h4>
                <button
                  onClick={() => setShowCustomEditor(false)}
                  className="text-white/40 hover:text-white text-xs"
                >
                  Close
                </button>
              </div>
              
              {/* Scale name input */}
              <input
                type="text"
                value={customScaleName}
                onChange={(e) => setCustomScaleName(e.target.value)}
                placeholder="Scale name..."
                className="w-full bg-black/30 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 border border-white/10 focus:border-orange-500/50 focus:outline-none"
              />
              
              {/* Semitone toggles */}
              <div className="grid grid-cols-6 gap-1.5">
                {INTERVAL_NAMES.map((name, index) => (
                  <button
                    key={index}
                    onClick={() => handleSemitoneToggle(index)}
                    disabled={index === 0}
                    className={cn(
                      'py-2 rounded-lg text-xs font-bold transition-all',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500',
                      index === 0
                        ? 'bg-orange-500 text-white cursor-not-allowed'
                        : customSemitones[index]
                        ? 'bg-orange-500/80 text-white'
                        : 'bg-white/5 text-white/40 hover:bg-white/10'
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
              
              <p className="text-[10px] text-white/40">
                Toggle intervals to build your scale. Root (R) is always included.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Chord Type Toggle */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-white/5">
        <div>
          <h4 className="text-sm font-semibold text-white">Use 7th Chords</h4>
          <p className="text-xs text-white/40">Extended harmony for jazz/neo-soul</p>
        </div>
        <button
          onClick={handle7thToggle}
          className={cn(
            'relative w-14 h-8 rounded-full transition-colors',
            use7thChords ? 'bg-violet-500' : 'bg-white/20'
          )}
        >
          <motion.div
            className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg"
            animate={{ left: use7thChords ? 'calc(100% - 28px)' : '4px' }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        </button>
      </div>
      
      {/* Chord Preview */}
      <div className="p-4 rounded-xl bg-white/5">
        <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
          Diatonic Chords
        </h4>
        <p className="text-sm text-white/80 font-mono leading-relaxed">
          {chordsPreview}
        </p>
      </div>
    </div>
  );
}
