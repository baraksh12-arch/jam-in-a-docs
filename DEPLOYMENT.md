# Deployment Guide

## Environment Variables

The following environment variables are required:

### Required Variables

- `VITE_SUPABASE_URL`: Your Supabase project URL
  - Found in: Supabase Dashboard → Project Settings → API → Project URL
  - Example: `https://xxxxxxxxxxxxx.supabase.co`

- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous/public key
  - Found in: Supabase Dashboard → Project Settings → API → Project API keys → `anon` `public`
  - This is safe to expose in client-side code

### Setting Environment Variables

#### Local Development

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### Production Deployment

Set these as environment variables in your hosting platform:

**Vercel:**
- Go to Project Settings → Environment Variables
- Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

**Netlify:**
- Go to Site Settings → Build & Deploy → Environment
- Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

**Other Platforms:**
- Set as environment variables in your platform's configuration

## Database Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Wait for the project to finish provisioning

### 2. Run Database Migrations

1. Open your Supabase project
2. Go to SQL Editor
3. Run `supabase-schema.sql` to create tables
4. Run `supabase-rls-policies.sql` to set up security policies

### 3. Enable Realtime

Realtime is automatically enabled when you run the schema SQL (via `ALTER PUBLICATION`). Verify in:
- Supabase Dashboard → Database → Replication
- Ensure all tables show as "Enabled"

## Building for Production

```bash
npm install
npm run build
```

The `dist` directory contains the production build.

## Deployment Checklist

- [ ] Supabase project created
- [ ] Database schema applied (`supabase-schema.sql`)
- [ ] RLS policies applied (`supabase-rls-policies.sql`)
- [ ] Realtime enabled for all tables
- [ ] Environment variables set in hosting platform
- [ ] Build succeeds locally (`npm run build`)
- [ ] Test room creation and joining
- [ ] Test real-time note synchronization
- [ ] Test chat functionality

## Troubleshooting

### "Missing Supabase environment variables"
- Ensure `.env` file exists locally
- Ensure environment variables are set in production platform
- Variable names must start with `VITE_` for Vite to expose them

### "Failed to create room" / Database errors
- Verify database schema is applied
- Check RLS policies allow the operations
- Verify Supabase project is active

### Realtime not working
- Check Realtime is enabled in Supabase Dashboard
- Verify tables are added to `supabase_realtime` publication
- Check browser console for WebSocket connection errors

### Authentication errors
- Verify anonymous auth is enabled in Supabase
- Go to: Authentication → Providers → Enable "Anonymous" sign-in

## Security Notes

- The `anon` key is safe to expose in client-side code
- RLS policies enforce data security at the database level
- Never commit `.env` files to version control
- For production, consider adding rate limiting via Supabase Edge Functions

