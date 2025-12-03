# Jam in a Docs

A real-time collaborative music jamming app built with React, Vite, and Supabase. Up to 4 players can join a room and play together using browser-based Web Audio API synthesis.

## Features

- 🎵 Real-time collaborative jamming with up to 4 players
- 🎸 4 instruments: Drums, Bass, Electric Piano, Guitar
- 💬 Real-time chat
- 🎹 Web Audio API synthesis for all instruments
- ⚡ Supabase Realtime for instant synchronization
- 🎛️ Room controls: BPM, key, scale, metronome

## Tech Stack

- **Frontend**: React + Vite + TailwindCSS
- **Backend**: Supabase (PostgreSQL + Realtime + Auth)
- **Audio**: Web Audio API
- **Routing**: React Router

## Setup

### Prerequisites

- Node.js 18+ and npm
- A Supabase account (free tier works)

### 1. Clone and Install

```bash
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Project Settings → API
3. Copy your Project URL and anon/public key

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Set up Database

1. Open your Supabase project SQL Editor
2. Run the SQL from `supabase-schema.sql` to create tables
3. Run the SQL from `supabase-rls-policies.sql` to set up Row Level Security

### 5. Run the App

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Project Structure

```
src/
├── api/
│   └── supabaseClient.js      # Supabase client configuration
├── components/
│   ├── hooks/                  # Custom React hooks
│   │   ├── useAudioEngine.jsx # Web Audio API synthesis
│   │   ├── useNoteEvents.jsx  # Note event handling
│   │   ├── useRoomState.jsx   # Room state management
│   │   └── useUserIdentity.jsx # User auth & identity
│   ├── firebaseClient.jsx     # Supabase database operations (legacy name)
│   └── ...                    # UI components
└── pages/                     # Page components
    ├── Landing.jsx           # Home page
    ├── Room.jsx              # Main jamming interface
    └── Setup.jsx             # Setup instructions
```

## Database Schema

- **rooms**: Room configuration (BPM, key, scale, etc.)
- **players**: Players in each room
- **note_events**: Musical note events for real-time sync
- **chat_messages**: Chat messages per room

See `supabase-schema.sql` for full schema details.

## License

MIT
