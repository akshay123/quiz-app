# Multiplayer Quiz App - Setup Guide

## Prerequisites

- Node.js 18+
- Supabase CLI (`npm install -g supabase`)
- A Supabase project (https://supabase.com/dashboard)
- A Google Cloud project with OAuth configured
- A Vercel account

---

## 1. Google OAuth Setup (for Admin Login)

### 1.1 Create Google OAuth Credentials

1. Go to https://console.cloud.google.com/apis/credentials
2. Select your project (or create one)
3. Click **Create Credentials** > **OAuth client ID**
4. Application type: **Web application**
5. Name: `Multiplayer Quiz Admin`
6. Authorized JavaScript origins:
   - `http://localhost:3000` (development)
   - `https://your-app.vercel.app` (production)
7. Authorized redirect URIs:
   - `https://<your-supabase-ref>.supabase.co/auth/v1/callback`
   - `http://localhost:54321/auth/v1/callback` (local dev)
8. Click **Create** and note the Client ID and Client Secret

### 1.2 Configure Supabase Auth

In the Supabase Dashboard:

1. Go to **Authentication** > **Providers**
2. Enable **Google**
3. Enter your Client ID and Client Secret
4. Save

### 1.3 Multi-Admin Access

Any Google account that signs in is automatically registered as an administrator.
Each admin gets their own dashboard and can only see/manage their own games.
There is no invite flow or approval step; signing in with Google is sufficient.

Multiple admins can be active simultaneously, each running independent games.

If you later need to restrict access to specific accounts or domains,
add a check in the `handle_new_user()` trigger in migration 00001.

---

## 2. Supabase Project Setup (Hosted)

### 2.1 Create a Supabase Project

1. Go to https://supabase.com/dashboard
2. Click **New Project**
3. Choose an organization (or create one)
4. Enter project name: `multiplayer-quiz`
5. Set a database password (save it securely)
6. Select a region close to your users (e.g., `us-east-1` for US)
7. Click **Create new project**

### 2.2 Run Migrations via SQL Editor

Since we are using hosted Supabase (no CLI needed):

1. Go to **SQL Editor** in the Supabase Dashboard
2. Run each migration file in order:
   - Copy contents of `supabase/migrations/00001_create_schema.sql` and execute
   - Copy contents of `supabase/migrations/00002_game_functions.sql` and execute
   - Copy contents of `supabase/migrations/00003_seed_defaults.sql` and execute
3. Verify tables were created under **Table Editor**

Alternatively, if you prefer the CLI:

```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

### 2.3 Get Your Keys

From **Settings** > **API** in the dashboard, note:
- **Project URL** (e.g., `https://abcdefgh.supabase.co`)
- **anon public key** (safe for browser)
- **service_role key** (server-only, never expose to client)

---

## 3. Supabase Realtime Configuration

In the Supabase Dashboard:

1. Go to **Database** > **Replication**
2. Enable realtime for these tables:
   - `games` (status changes)
   - `players` (join/leave)
3. Go to **Database** > **Publications**
4. The app primarily uses Realtime Broadcast (channels), not DB changes,
   so table replication is only needed for the admin dashboard.

The quiz engine uses **Supabase Realtime Broadcast** (not Postgres Changes)
for low-latency game events. Each game gets a channel: `game:{gameId}`

---

## 4. Vercel Deployment

### 4.1 Environment Variables

Set these in Vercel project settings (Settings > Environment Variables):

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
GOOGLE_CLIENT_ID=<from step 1>
GOOGLE_CLIENT_SECRET=<from step 1>
```

**Important:** `SUPABASE_SERVICE_ROLE_KEY` is server-only (no `NEXT_PUBLIC_` prefix).
It is used in API routes for player operations (join, answer, reconnect).

### 4.2 Vercel Configuration

Create `vercel.json` in your project root:

```json
{
  "framework": "nextjs",
  "regions": ["iad1"],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-store" }
      ]
    }
  ]
}
```

Pick a region close to your Supabase project region for lowest latency.

### 4.3 Auth Callback Route

Your Next.js app needs a callback route for Google OAuth:

```
app/auth/callback/route.ts
```

This exchanges the OAuth code for a Supabase session.

### 4.4 Deploy

```bash
vercel --prod
```

After deploying, update:
- Google OAuth redirect URI to include your production URL
- Supabase Auth site_url to your Vercel domain
- Supabase Auth redirect URLs to include `https://your-app.vercel.app/auth/callback`

---

## 5. Local Development

### 5.1 Environment File

Create `.env.local` pointing to your hosted Supabase project:

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5.2 Start the App

```bash
npm run dev
```

### 5.3 Test Google Auth Locally

Google OAuth redirects through your hosted Supabase instance.
Make sure your Google OAuth credentials include:
- Authorized redirect URI: `https://<your-ref>.supabase.co/auth/v1/callback`
- Authorized JavaScript origin: `http://localhost:3000`

And in Supabase Dashboard under **Authentication** > **URL Configuration**:
- Site URL: `http://localhost:3000`
- Redirect URLs: `http://localhost:3000/auth/callback`

---

## 6. Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    Vercel (Next.js)                       │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Admin Pages │  │ Player Pages │  │ API Routes    │  │
│  │ (protected) │  │ (public)     │  │ (server-side) │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  │
└─────────┼────────────────┼───────────────────┼──────────┘
          │                │                   │
          │ Supabase JS    │ Supabase JS       │ Service Role
          │ (anon key)     │ (anon key)        │ (elevated)
          │                │                   │
┌─────────▼────────────────▼───────────────────▼──────────┐
│                    Supabase                               │
│                                                          │
│  ┌────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ Auth       │  │ Realtime    │  │ PostgreSQL      │  │
│  │ (Google)   │  │ (Broadcast) │  │ (RLS + funcs)   │  │
│  └────────────┘  └─────────────┘  └─────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Key Patterns

- **Admin actions**: Use Supabase client with user's JWT. RLS enforces ownership.
- **Player join/answer**: Call Next.js API routes, which use the service role key
  to call `join_game()`, `submit_answer()`, etc. This bypasses RLS intentionally
  since players don't have Supabase auth accounts.
- **Real-time**: Both admin and players subscribe to a Supabase Realtime Broadcast
  channel (`game:{gameId}`). The API routes broadcast state changes after mutations.
- **Timer**: Server sets `question_started_at` and `question_ends_at`. Clients
  compute countdown locally. No timer ticks are broadcast.

---

## 7. Security Checklist

- [ ] `SUPABASE_SERVICE_ROLE_KEY` is never exposed to the browser
- [ ] Player session tokens are generated server-side and hashed before storage
- [ ] `is_correct` column is filtered out of player-facing queries
- [ ] Google OAuth is the only sign-in method (email/password disabled)
- [ ] `enable_signup` is `false` in auth config (prevents non-OAuth signups)
- [ ] Rate limiting is configured on Vercel (or via middleware)
- [ ] All player-facing API routes validate session tokens
- [ ] Room code input is sanitized (uppercase, trimmed, length-checked)
