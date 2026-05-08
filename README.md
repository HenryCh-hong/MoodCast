# Moodcast

An open-source AI radio agent. Describe the room, connect Spotify, and Moodcast builds a curated session from your own listening history with an AI DJ voice.

**[Demo mode available — no API key needed]**

---

## What it does

- You describe the mood: *"Late night coding, keep it quiet"* or *"Sunday morning, slow and present"*
- Moodcast reads your Spotify taste (top artists, top tracks, recent plays)
- AI selects tracks from your history and arranges them into a session with emotional arc
- MooC (the AI DJ) opens with a monologue, narrates transitions, and closes the session
- Spotify Premium: full playback via Web Playback SDK
- Without Premium: real AI-generated track list, no audio
- No Spotify / no API key: demo mode with 5 prewritten sessions

---

## Quick start

```bash
git clone https://github.com/your-org/moodcast
cd moodcast
npm install

cp .env.example .env.local
# Fill in an AI key and Spotify credentials (see Setup below)

node node_modules/next/dist/bin/next dev
```

Open [http://localhost:3000](http://localhost:3000)

**To try without any setup:** go to the demo session link on the landing page — no API key needed.

---

## Setup

### 1. AI provider (required for AI generation and MooC chat)

Moodcast supports two providers. Add **one** to `.env.local`:

| Provider | Env var | Full experience |
|---|---|---|
| Google Gemini | `GOOGLE_API_KEY=...` | Session generation + MooC chat |
| Anthropic Claude | `ANTHROPIC_API_KEY=sk-ant-...` | Session generation + MooC chat |

If both are set, `GOOGLE_API_KEY` takes priority (override with `AI_PROVIDER=anthropic`).

**Google Gemini** (recommended — free tier available):
1. Get a key at [aistudio.google.com](https://aistudio.google.com)
2. Add to `.env.local`: `GOOGLE_API_KEY=AIza...`

**Anthropic Claude** (alternative):
1. Create an account at [console.anthropic.com](https://console.anthropic.com)
2. Generate an API key
3. Add to `.env.local`: `ANTHROPIC_API_KEY=sk-ant-...`

### 2. Spotify app (required for Spotify features)

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Create a new app (any name)
3. In app settings, add this Redirect URI:
   ```
   http://localhost:3000/api/auth/spotify/callback
   ```
4. Copy **Client ID** and **Client Secret** to `.env.local`:
   ```
   SPOTIFY_CLIENT_ID=your_client_id
   SPOTIFY_CLIENT_SECRET=your_client_secret
   SPOTIFY_REDIRECT_URI=http://localhost:3000/api/auth/spotify/callback
   ```
5. In the app, click **Connect Spotify** in the navbar

### Playback note

Spotify Web Playback SDK requires a **Premium account**. Free accounts see the AI-generated track list but cannot play audio through Moodcast.

---

## Fallback behavior

| State | What you get |
|---|---|
| No API key, no Spotify | Demo mode — 5 prewritten sessions |
| API key, no Spotify | AI generates session with track names, no playback |
| Spotify connected, free account | AI uses your taste data, shows track list, no playback |
| Spotify Premium | Full experience — real playback, album art, progress bar |

If Moodcast reaches the AI API quota, update `GOOGLE_API_KEY` / `ANTHROPIC_API_KEY` in `.env.local` or wait for the provider quota to reset. See [docs/ai-quota.md](docs/ai-quota.md) for detection logic and the structured `AI_QUOTA_EXCEEDED` API response.

---

## Tech stack

- **Next.js 16** (App Router)
- **TypeScript** strict mode
- **Tailwind CSS v4**
- **@google/generative-ai** — Gemini 2.5 Flash (default provider)
- **@anthropic-ai/sdk** — Claude Sonnet 4.6 with prompt caching (optional)
- **Spotify Web API** — taste profile (top artists/tracks/recent)
- **Spotify Web Playback SDK** — in-browser playback (Premium)
- **localStorage** — session persistence (no database)

---

## Self-hosting

Each user must bring their own Spotify app credentials — Spotify does not allow credential redistribution. AI provider keys (`GOOGLE_API_KEY` / `ANTHROPIC_API_KEY`) are BYOK (bring your own key) and are never exposed to the browser.

---

## License

MIT
