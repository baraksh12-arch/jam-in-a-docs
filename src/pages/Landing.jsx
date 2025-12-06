/**
 * Landing Page
 * Fixed: Uses returned room data from createRoom to navigate with correct ID
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { createRoom } from '../components/firebaseClient';
import { Music, Users, Zap, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

export default function Landing() {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreateRoom = async () => {
    setIsCreating(true);
    setError('');
    try {
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      // Fixed: Use returned room data to ensure we navigate with the correct ID
      const room = await createRoom(roomCode);
      if (!room || !room.id) {
        throw new Error('Room created but no ID returned');
      }
      // PHASE 2: Add delay after room creation to allow Supabase to propagate
      console.log('[Landing] Room created, waiting for Supabase propagation...');
      await new Promise(resolve => setTimeout(resolve, 300));
      // Navigate using the room ID from the created room object
      navigate(createPageUrl(`Room?id=${room.id}`));
    } catch (error) {
      console.error('Failed to create room:', error);
      setError(error.message || 'Failed to create room. Please check Firebase configuration.');
      setIsCreating(false);
    }
  };

  const handleJoinRoom = () => {
    if (joinCode.trim()) {
      navigate(createPageUrl(`Room?id=${joinCode.trim().toUpperCase()}`));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute top-40 right-20 w-96 h-96 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-1000"></div>
        <div className="absolute bottom-20 left-1/2 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-2000"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-16 md:py-24">
        <div className="text-center max-w-4xl mx-auto">
          <div className="mb-8 flex justify-center">
            <div className="relative">
              <Music className="w-20 h-20 text-purple-400 animate-bounce" strokeWidth={1.5} />
              <div className="absolute inset-0 blur-xl bg-purple-500 opacity-50"></div>
            </div>
          </div>

          <h1 className="text-6xl md:text-8xl font-black text-white mb-6 tracking-tight">
            Jam in a{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 animate-gradient">
              Docs
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-300 mb-12 font-light">
            Real-time band in your browser – jam with up to 4 players
          </p>

          {error && (
            <div className="mb-8 max-w-2xl mx-auto">
              <Card className="bg-red-500/20 border-red-500/50">
                <CardContent className="p-4">
                  <p className="text-red-300 text-sm font-semibold mb-2">⚠️ Error</p>
                  <p className="text-red-200 text-sm mb-3">{error}</p>
                  <p className="text-red-200 text-xs">
                    Make sure Firestore is enabled in your Firebase Console:{' '}
                    <a
                      href="https://console.firebase.google.com/project/jam-in-a-docs/firestore"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-white"
                    >
                      Enable Firestore
                    </a>
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-6 mb-16 max-w-3xl mx-auto">
            <Card className="bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10 transition-all duration-300">
              <CardContent className="p-6 text-center">
                <Users className="w-12 h-12 text-cyan-400 mx-auto mb-3" />
                <h3 className="text-white font-semibold mb-2">4 Players</h3>
                <p className="text-gray-400 text-sm">Drums, Bass, EPiano & Guitar</p>
              </CardContent>
            </Card>

            <Card className="bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10 transition-all duration-300">
              <CardContent className="p-6 text-center">
                <Zap className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
                <h3 className="text-white font-semibold mb-2">Real-Time Sync</h3>
                <p className="text-gray-400 text-sm">Instant note sharing via Firestore</p>
              </CardContent>
            </Card>

            <Card className="bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10 transition-all duration-300">
              <CardContent className="p-6 text-center">
                <Play className="w-12 h-12 text-pink-400 mx-auto mb-3" />
                <h3 className="text-white font-semibold mb-2">Web Audio</h3>
                <p className="text-gray-400 text-sm">Pure browser-based instruments</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col md:flex-row gap-6 justify-center items-stretch max-w-2xl mx-auto">
            <Card className="flex-1 bg-gradient-to-br from-purple-500 to-pink-500 border-0 hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-300">
              <CardContent className="p-8 text-center">
                <h3 className="text-2xl font-bold text-white mb-4">Start a New Jam</h3>
                <Button
                  onClick={handleCreateRoom}
                  disabled={isCreating}
                  size="lg"
                  className="w-full bg-white text-purple-600 hover:bg-gray-100 font-bold text-lg py-6"
                >
                  {isCreating ? 'Creating Room...' : 'Create Room'}
                </Button>
              </CardContent>
            </Card>

            <Card className="flex-1 bg-gradient-to-br from-cyan-500 to-blue-500 border-0 hover:shadow-2xl hover:shadow-cyan-500/50 transition-all duration-300">
              <CardContent className="p-8 text-center">
                <h3 className="text-2xl font-bold text-white mb-4">Join with Code</h3>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Enter room code"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
                    className="flex-1 bg-white/20 border-white/30 text-white placeholder:text-white/60 text-lg"
                    maxLength={6}
                  />
                  <Button
                    onClick={handleJoinRoom}
                    disabled={!joinCode.trim()}
                    size="lg"
                    className="bg-white text-cyan-600 hover:bg-gray-100 font-bold"
                  >
                    Join
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <p className="text-gray-500 text-sm mt-16">
            Need help?{' '}
            <button
              onClick={() => navigate(createPageUrl('Setup'))}
              className="text-purple-400 hover:text-purple-300 underline"
            >
              View setup instructions
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}