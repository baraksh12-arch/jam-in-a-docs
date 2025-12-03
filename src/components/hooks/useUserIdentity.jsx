import { useState, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';

/**
 * Hook to manage user identity using Supabase Auth
 * Uses anonymous authentication and stores displayName/color in localStorage
 */

const COLORS = [
  '#FF6B9D', '#C44569', '#FFC312', '#EE5A6F',
  '#00D2D3', '#1B9CFC', '#55E6C1', '#A55EEA',
  '#F8EFBA', '#FD79A8', '#FDCB6E', '#6C5CE7'
];

function generateRandomName() {
  const adjectives = [
    'Groovy', 'Funky', 'Smooth', 'Electric', 'Cosmic',
    'Stellar', 'Jazzy', 'Rhythmic', 'Melodic', 'Sonic',
    'Vibing', 'Jamming', 'Rockin', 'Bouncy', 'Soulful'
  ];
  
  const nouns = [
    'Panda', 'Tiger', 'Eagle', 'Dolphin', 'Phoenix',
    'Dragon', 'Wolf', 'Falcon', 'Lynx', 'Hawk',
    'Bear', 'Fox', 'Lion', 'Shark', 'Raven'
  ];
  
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  
  return `${adj} ${noun}`;
}

function getRandomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

export function useUserIdentity() {
  const [userId, setUserId] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [color, setColor] = useState('');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initializeUser = async () => {
      try {
        // Check for existing session
        const { data: { session } } = await supabase.auth.getSession();
        
        let authUserId = session?.user?.id;

        // If no session, sign in anonymously
        if (!authUserId) {
          const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
          
          if (authError) {
            console.error('Error signing in anonymously:', authError);
            throw authError;
          }
          
          authUserId = authData.user.id;
        }

        // Get or create displayName and color from localStorage
        let storedDisplayName = localStorage.getItem('jam_displayName');
        let storedColor = localStorage.getItem('jam_color');

        if (!storedDisplayName) {
          storedDisplayName = generateRandomName();
          localStorage.setItem('jam_displayName', storedDisplayName);
        }

        if (!storedColor) {
          storedColor = getRandomColor();
          localStorage.setItem('jam_color', storedColor);
        }

        setUserId(authUserId);
        setDisplayName(storedDisplayName);
        setColor(storedColor);
        setIsReady(true);
      } catch (error) {
        console.error('Error initializing user:', error);
        // Fallback to localStorage-based ID if Supabase auth fails
        let fallbackUserId = localStorage.getItem('jam_userId');
        if (!fallbackUserId) {
          fallbackUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          localStorage.setItem('jam_userId', fallbackUserId);
        }
        
        let fallbackDisplayName = localStorage.getItem('jam_displayName');
        if (!fallbackDisplayName) {
          fallbackDisplayName = generateRandomName();
          localStorage.setItem('jam_displayName', fallbackDisplayName);
        }
        
        let fallbackColor = localStorage.getItem('jam_color');
        if (!fallbackColor) {
          fallbackColor = getRandomColor();
          localStorage.setItem('jam_color', fallbackColor);
        }

        setUserId(fallbackUserId);
        setDisplayName(fallbackDisplayName);
        setColor(fallbackColor);
        setIsReady(true);
      }
    };

    initializeUser();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user?.id) {
        setUserId(session.user.id);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const updateDisplayName = (newName) => {
    setDisplayName(newName);
    localStorage.setItem('jam_displayName', newName);
  };

  return {
    userId,
    displayName,
    color,
    updateDisplayName,
    isReady
  };
}
