/**
 * Landing Page - Premium Design
 * Elite production-ready landing page with smooth animations
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { createRoom } from '../components/firebaseClient';
import { Music, Users, Zap, Play, Headphones, Globe, ArrowRight, Sparkles, Video, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';

// Instrument emojis that float in the background
const FLOATING_EMOJIS = ['🥁', '🎸', '🎹', '🎵', '🎶', '🎤', '🎧'];

export default function Landing() {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCreateRoom = async () => {
    setIsCreating(true);
    setError('');
    try {
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const room = await createRoom(roomCode);
      if (!room || !room.id) {
        throw new Error('Room created but no ID returned');
      }
      await new Promise(resolve => setTimeout(resolve, 300));
      navigate(createPageUrl(`Room?id=${room.id}`));
    } catch (error) {
      console.error('Failed to create room:', error);
      const errorMessage = error.message || 'Unknown error';
      let userMessage = 'Unable to create room. Please try again.';
      
      if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        userMessage = 'Network issue. Please check your connection.';
      } else if (errorMessage.includes('permission') || errorMessage.includes('auth')) {
        userMessage = 'Permission denied. Please try again.';
      }
      
      setError(userMessage);
      setIsCreating(false);
    }
  };

  const handleJoinRoom = () => {
    if (joinCode.trim()) {
      navigate(createPageUrl(`Room?id=${joinCode.trim().toUpperCase()}`));
    }
  };

  const handleJoinAsCrowd = () => {
    if (joinCode.trim()) {
      navigate(createPageUrl(`Room?id=${joinCode.trim().toUpperCase()}&mode=crowd`));
    }
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] overflow-hidden relative">
      {/* Animated gradient background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Primary gradient orbs */}
        <motion.div 
          animate={{ 
            x: [0, 50, 0],
            y: [0, 30, 0],
            scale: [1, 1.1, 1]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-600/30 rounded-full blur-[120px]"
        />
        <motion.div 
          animate={{ 
            x: [0, -30, 0],
            y: [0, 50, 0],
            scale: [1, 1.2, 1]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute top-[20%] right-[-15%] w-[500px] h-[500px] bg-cyan-500/25 rounded-full blur-[100px]"
        />
        <motion.div 
          animate={{ 
            x: [0, 40, 0],
            y: [0, -30, 0],
            scale: [1, 1.15, 1]
          }}
          transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-10%] left-[30%] w-[400px] h-[400px] bg-pink-500/20 rounded-full blur-[80px]"
        />
        
        {/* Grid pattern overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px'
          }}
        />
        
        {/* Floating emojis */}
        {FLOATING_EMOJIS.map((emoji, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 100 }}
            animate={{ 
              opacity: [0.1, 0.3, 0.1],
              y: [-20, -100, -20],
              x: [0, Math.sin(i) * 30, 0],
              rotate: [0, 360]
            }}
            transition={{ 
              duration: 15 + i * 3,
              repeat: Infinity,
              delay: i * 2,
              ease: "linear"
            }}
            className="absolute text-4xl pointer-events-none"
            style={{
              left: `${10 + i * 12}%`,
              top: `${60 + Math.sin(i) * 20}%`,
            }}
          >
            {emoji}
          </motion.div>
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="container mx-auto px-6 py-6"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Music className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-xl tracking-tight">Jam in a Docs</span>
          </div>
        </motion.header>

        {/* Hero Section */}
        <motion.main 
          variants={containerVariants}
          initial="hidden"
          animate={mounted ? "visible" : "hidden"}
          className="flex-1 container mx-auto px-6 py-12 md:py-20 flex flex-col items-center justify-center"
        >
          {/* Badge */}
          <motion.div variants={itemVariants} className="mb-8">
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm text-gray-300">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span>Real-time • Zero Latency • Web-based</span>
            </div>
          </motion.div>

          {/* Main Headline */}
          <motion.h1 
            variants={itemVariants}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-center mb-6 leading-[0.9] tracking-tight"
          >
            <span className="text-white">Play Music</span>
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
              Together
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p 
            variants={itemVariants}
            className="text-lg md:text-xl text-gray-400 text-center max-w-2xl mb-12 leading-relaxed"
          >
            Start a jam session with friends anywhere in the world. 
            Drums, bass, piano, and guitar — all in your browser with ultra-low latency.
          </motion.p>

          {/* CTA Cards */}
          <motion.div 
            variants={itemVariants}
            className="w-full max-w-2xl grid md:grid-cols-2 gap-4 mb-16"
          >
            {/* Create Room Card */}
            <Card className="bg-gradient-to-br from-purple-600 to-pink-600 border-0 shadow-2xl shadow-purple-500/20 hover:shadow-purple-500/30 transition-shadow">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold text-white mb-2">Start a Jam</h3>
                <p className="text-white/70 text-sm mb-4">Create a room and invite your friends to join</p>
                <Button
                  onClick={handleCreateRoom}
                  disabled={isCreating}
                  size="lg"
                  className="w-full bg-white text-purple-600 hover:bg-gray-100 font-bold text-base h-12 shadow-lg"
                >
                  {isCreating ? (
                    <span className="flex items-center gap-2">
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full"
                      />
                      Creating...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Create Room
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Join Room Card */}
            <Card className="bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold text-white mb-2">Join a Jam</h3>
                <p className="text-gray-400 text-sm mb-4">Enter a room code to join an existing session</p>
                <div className="space-y-3">
                  <Input
                    type="text"
                    placeholder="Enter code"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
                    className="w-full bg-white/10 border-white/20 text-white placeholder:text-white/40 h-12 text-base font-mono text-center tracking-widest"
                    maxLength={6}
                  />
                  
                  {/* Join options - show when code is entered */}
                  {joinCode.trim() && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-2"
                    >
                      <Button
                        onClick={handleJoinRoom}
                        size="lg"
                        className="w-full bg-white text-gray-900 hover:bg-gray-100 font-bold h-12"
                      >
                        <Music className="w-4 h-4 mr-2" />
                        Join as Player
                      </Button>
                      <Button
                        onClick={() => handleJoinAsCrowd()}
                        size="lg"
                        variant="outline"
                        className="w-full bg-violet-500/10 border-violet-500/30 text-violet-300 hover:bg-violet-500/20 hover:text-violet-200 font-medium h-12"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Join as Crowd
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-violet-500/30 rounded-full uppercase tracking-wider">
                          Watch + Camera
                        </span>
                      </Button>
                    </motion.div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Error message */}
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm max-w-md"
            >
              ⚠️ {error}
            </motion.div>
          )}

          {/* Features Grid */}
          <motion.div 
            variants={itemVariants}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl w-full"
          >
            {[
              { icon: Users, label: '4 Players', desc: 'Full band setup' },
              { icon: Zap, label: 'Zero Latency', desc: 'WebRTC powered' },
              { icon: Headphones, label: 'Pro Sound', desc: 'Studio quality' },
              { icon: Globe, label: 'Web-based', desc: 'No install needed' },
            ].map((feature, i) => (
              <motion.div
                key={i}
                whileHover={{ scale: 1.05, y: -5 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="bg-white/5 border border-white/10 rounded-xl p-4 text-center hover:bg-white/10 transition-colors"
              >
                <feature.icon className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                <div className="text-white font-semibold text-sm">{feature.label}</div>
                <div className="text-gray-500 text-xs">{feature.desc}</div>
              </motion.div>
            ))}
          </motion.div>
        </motion.main>

        {/* Footer */}
        <motion.footer 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="container mx-auto px-6 py-8 text-center"
        >
          <div className="text-gray-600 text-sm">
            Built for musicians who want to jam together, anywhere.
          </div>
        </motion.footer>
      </div>
    </div>
  );
}
