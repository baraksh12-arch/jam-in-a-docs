import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function SetupInstructions() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">🎉 Firebase Connected!</h1>
          <p className="text-gray-300">Your app is configured and ready to jam</p>
        </div>

        <Card className="bg-white/10 backdrop-blur-sm border-white/20 mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-green-400" />
              <h2 className="text-2xl font-bold text-white">Configuration Complete</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-white">
            <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4">
              <p className="font-semibold mb-2">✅ Firebase credentials are set up</p>
              <p className="text-sm text-gray-300">
                Project: jam-in-a-docs
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/10 backdrop-blur-sm border-white/20 mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-yellow-400" />
              <h2 className="text-2xl font-bold text-white">Important: Enable Firestore</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-white">
            <p className="text-gray-300">
              If you haven't already, you need to enable Firestore Database in your Firebase Console:
            </p>

            <div className="space-y-3">
              <div className="bg-white/5 rounded-lg p-4">
                <h3 className="font-semibold mb-2">Step 1: Go to Firebase Console</h3>
                <p className="text-sm text-gray-300 mb-3">
                  Visit{' '}
                  <a
                    href="https://console.firebase.google.com/project/jam-in-a-docs/firestore"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:underline"
                  >
                    Firebase Console → Firestore Database
                  </a>
                </p>
              </div>

              <div className="bg-white/5 rounded-lg p-4">
                <h3 className="font-semibold mb-2">Step 2: Create Database</h3>
                <p className="text-sm text-gray-300 mb-2">
                  Click "Create database" and choose:
                </p>
                <ul className="text-sm text-gray-300 list-disc list-inside space-y-1 ml-4">
                  <li>Start in <strong>test mode</strong> (for development)</li>
                  <li>Choose your preferred location</li>
                  <li>Click "Enable"</li>
                </ul>
              </div>

              <div className="bg-white/5 rounded-lg p-4">
                <h3 className="font-semibold mb-2">Step 3: Set Security Rules (Optional but Recommended)</h3>
                <p className="text-sm text-gray-300 mb-3">
                  Go to the "Rules" tab and paste these rules:
                </p>
                <pre className="bg-black/50 p-4 rounded text-xs overflow-x-auto">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rooms/{roomId} {
      allow read, write: if true;
      
      match /players/{playerId} {
        allow read: if true;
        allow write: if true;
      }
      
      match /noteEvents/{eventId} {
        allow read, write: if true;
      }
      
      match /chatMessages/{messageId} {
        allow read, write: if true;
      }
    }
  }
}`}
                </pre>
                <p className="text-xs text-yellow-400 mt-2">
                  ⚠️ These rules allow anyone to read/write. Fine for testing, but tighten them for production!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/10 backdrop-blur-sm border-white/20 mb-6">
          <CardHeader>
            <h2 className="text-2xl font-bold text-white">🎵 Ready to Jam?</h2>
          </CardHeader>
          <CardContent className="space-y-4 text-white">
            <p className="text-gray-300">
              Once Firestore is enabled, you're all set! Here's how it works:
            </p>

            <ol className="space-y-3 text-sm text-gray-300 list-decimal list-inside">
              <li>Create a new room from the landing page</li>
              <li>Share the room code with up to 3 friends</li>
              <li>Each person picks an instrument (Drums, Bass, EP, or Guitar)</li>
              <li>Set your BPM and key</li>
              <li>Hit Play and jam together in real-time!</li>
            </ol>

            <div className="pt-4">
              <Button
                onClick={() => navigate(createPageUrl('Landing'))}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 text-white font-bold text-lg py-6"
              >
                Start Jamming 🎸
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader>
            <h2 className="text-xl font-bold text-white">Architecture Overview</h2>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-300">
            <p>
              <strong className="text-white">Frontend:</strong> React + Tailwind + Web Audio API
            </p>
            <p>
              <strong className="text-white">Backend:</strong> Firebase Firestore (real-time sync)
            </p>
            <p>
              <strong className="text-white">Audio:</strong> Browser-based synthesis (oscillators)
            </p>
            <p>
              <strong className="text-white">Data Structure:</strong>
            </p>
            <pre className="bg-black/50 p-3 rounded text-xs overflow-x-auto">
{`rooms/
  {roomId}/
    - Room doc (bpm, key, scale, isPlaying, metronomeOn)
    players/
      {userId}/ - Player doc (displayName, color, instrument)
    noteEvents/
      {eventId}/ - Note event (instrument, note, velocity, timestamp)
    chatMessages/
      {messageId}/ - Chat message (userId, displayName, text, createdAt)`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}