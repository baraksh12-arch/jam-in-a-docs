import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Tone from 'tone';
import { Volume2, Smartphone, Vibrate, CheckCircle2, Loader2 } from 'lucide-react';

/**
 * AudioUnlock - iOS/Android Audio Context Unlock Screen
 * 
 * Critical for mobile audio: iOS and Android require user gesture
 * to unlock the Web Audio API / Tone.js AudioContext.
 * This component provides a premium unlock experience.
 * 
 * Features:
 * - Automatic detection of suspended audio context
 * - Single tap unlock for iOS/Android
 * - Premium Apple-style animations
 * - Haptic feedback on supported devices
 */

export default function AudioUnlock({ onUnlocked, isMobile = false }) {
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [error, setError] = useState(null);

  // Check if audio is already unlocked
  useEffect(() => {
    const checkAudioState = async () => {
      try {
        const context = Tone.getContext();
        if (context && context.state === 'running') {
          setIsUnlocked(true);
          onUnlocked?.();
        }
      } catch (e) {
        // Context not ready yet
      }
    };
    checkAudioState();
  }, [onUnlocked]);

  const handleUnlock = useCallback(async () => {
    if (isUnlocking || isUnlocked) return;
    
    setIsUnlocking(true);
    setError(null);

    try {
      // Start Tone.js (this resumes the AudioContext)
      await Tone.start();
      
      // Double-check the context is running
      const context = Tone.getContext();
      if (context.state !== 'running') {
        await context.resume();
      }
      
      // Start Transport for scheduled playback
      if (Tone.Transport.state !== 'started') {
        Tone.Transport.start();
      }
      
      // Haptic feedback on supported devices
      if (navigator.vibrate) {
        navigator.vibrate([10, 30, 10]);
      }
      
      // Play a very quiet test tone to warm up the audio system
      const testOsc = new Tone.Oscillator({
        frequency: 440,
        volume: -60, // Very quiet
        type: 'sine'
      }).toDestination();
      
      testOsc.start();
      setTimeout(() => {
        testOsc.stop();
        testOsc.dispose();
      }, 50);

      console.log('[AudioUnlock] Audio context successfully unlocked');
      
      // Show success state briefly
      setIsUnlocked(true);
      setTimeout(() => {
        onUnlocked?.();
      }, 500);
      
    } catch (err) {
      console.error('[AudioUnlock] Failed to unlock audio:', err);
      setError('Failed to enable audio. Please try again.');
      setIsUnlocking(false);
    }
  }, [isUnlocking, isUnlocked, onUnlocked]);

  if (isUnlocked) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #0a0a12 0%, #1a0a2e 50%, #0a1628 100%)'
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.1, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 400, damping: 15 }}
              className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-2xl shadow-emerald-500/30"
            >
              <CheckCircle2 className="w-12 h-12 text-white" />
            </motion.div>
            <motion.h2
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-bold text-white"
            >
              Audio Ready
            </motion.h2>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6"
      style={{
        background: 'linear-gradient(135deg, #0a0a12 0%, #1a0a2e 50%, #0a1628 100%)'
      }}
    >
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[-20%] left-[-20%] w-[600px] h-[600px] bg-gradient-to-br from-purple-600/30 to-transparent rounded-full blur-[100px]"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2]
          }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-[-20%] right-[-20%] w-[500px] h-[500px] bg-gradient-to-tl from-cyan-500/25 to-transparent rounded-full blur-[80px]"
        />
      </div>

      {/* Content */}
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        className="relative z-10 text-center max-w-sm"
      >
        {/* Icon */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 20 }}
          className="relative w-32 h-32 mx-auto mb-8"
        >
          {/* Outer ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0 rounded-full border-2 border-dashed border-purple-500/30"
          />
          
          {/* Inner circle */}
          <div className="absolute inset-3 rounded-full bg-gradient-to-br from-purple-600 to-fuchsia-600 flex items-center justify-center shadow-2xl shadow-purple-500/40">
            {isMobile ? (
              <Smartphone className="w-12 h-12 text-white" />
            ) : (
              <Volume2 className="w-12 h-12 text-white" />
            )}
          </div>
          
          {/* Pulse rings */}
          <motion.div
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 rounded-full bg-purple-500/20"
          />
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-3xl md:text-4xl font-black text-white mb-3 tracking-tight"
        >
          Enable Sound
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-gray-400 text-lg mb-8"
        >
          {isMobile 
            ? 'Tap to enable real-time audio on your device'
            : 'Click to enable audio playback'
          }
        </motion.p>

        {/* Unlock button */}
        <motion.button
          initial={{ y: 20, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleUnlock}
          disabled={isUnlocking}
          className="relative w-full max-w-xs mx-auto group"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-fuchsia-600 rounded-2xl blur-xl opacity-70 group-hover:opacity-100 transition-opacity" />
          <div className="relative flex items-center justify-center gap-3 px-8 py-5 bg-gradient-to-r from-purple-600 to-fuchsia-600 rounded-2xl text-white font-bold text-lg shadow-lg shadow-purple-500/25 transition-all">
            {isUnlocking ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Enabling Audio...</span>
              </>
            ) : (
              <>
                <Vibrate className="w-6 h-6" />
                <span>{isMobile ? 'Tap to Enable' : 'Enable Audio'}</span>
              </>
            )}
          </div>
        </motion.button>

        {/* Error message */}
        {error && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 text-red-400 text-sm"
          >
            {error}
          </motion.p>
        )}

        {/* Info text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-6 text-gray-600 text-xs"
        >
          {isMobile 
            ? 'iOS & Android require a tap to enable audio'
            : 'Your browser requires interaction to play sound'
          }
        </motion.p>
      </motion.div>

      {/* Bottom branding */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-8 left-0 right-0 text-center"
      >
        <p className="text-gray-700 text-sm font-medium tracking-wider">
          JAM SESSION
        </p>
      </motion.div>
    </motion.div>
  );
}
