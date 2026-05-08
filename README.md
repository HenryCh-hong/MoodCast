# Moodcast

An open-source AI radio agent for your current moment.

Describe the room, connect Spotify, and Moodcast tunes a radio-style session from your listening taste, time of day, weather, location, and calendar rhythm — with MooC, an AI DJ companion.

**Demo mode available — no API key needed.**

---

## What it does

- Describe the mood: *"Late night coding, keep it quiet"* or *"Sunday morning, slow and present"*
- Auto Tune from your current moment: time, weather, location, Apple Calendar, Spotify taste, and recent listening patterns
- Manual Tune with mood/activity/texture/signal/discovery tags
- MooC builds an AI-curated radio session with:
  - familiar anchors
  - same-artist fresh tracks
  - adjacent artists
  - contextual discoveries
- MooC writes opening monologues, transition cues, and closing notes
- Optional browser TTS lets MooC speak transition cues
- Purple on-air ambient glow reacts to playing / paused / MooC speaking states
- Spotify Premium users get full playback through the Spotify Web Playback SDK
- Free Spotify users still get AI-generated sessions and track lists, but not in-browser playback
- No Spotify / no API key: demo mode with prewritten sessions

---

## Quick start

```bash
git clone https://github.com/your-org/moodcast
cd moodcast
npm install

cp .env.example .env.local
# Fill in an AI key and Spotify credentials if you want the full experience

npm run dev -- -p 3001
```

Open:

```text
http://127.0.0.1:3001
```

The default Next.js dev port is `http://localhost:3000`; the current Moodcast dev/test flow uses `127.0.0.1:3001`.

To try without setup, use the demo session link on the landing page.

---

## Terminal mode

Moodcast also ships with a terminal-native radio console.

From the project directory:

```bash
npm run moodcast --silent
```

Or set up a shortcut:

```bash
alias moodcast='npm --prefix ~/Desktop/MoodCast run --silent moodcast --'
```

Then run:

```bash
moodcast
```

Inside the Moodcast shell:

```text
moodcast> status
moodcast> start --auto
moodcast> start --manual
moodcast> resume
moodcast> sessions
moodcast> next
moodcast> pause
moodcast> quit
```

`moodcast sessions` opens an interactive session picker. Use ↑↓ to select a saved session and Enter to play it.

---

## Auto Tune vs Manual Tune

### Auto Tune

Moodcast reads the current signal and tunes automatically:

- local time
- weather
- location
- Apple Calendar rhythm
- Spotify taste
- recent listening patterns
- discovery preference

```bash
moodcast start --auto
```

### Manual Tune

Choose the signal yourself:

- mood
- activity
- texture
- moment signal
- familiarity / discovery level

```bash
moodcast start --manual
```

---

## Moment Context

Moodcast can use privacy-safe context to shape the session.

| Context         | Provider                         | Notes                                  |
| --------------- | -------------------------------- | -------------------------------------- |
| Time / timezone | local system                     | always available                       |
| Weather         | Open-Meteo                       | no API key required                    |
| Location        | manual city / coarse location    | raw coordinates are not sent to the AI |
| Calendar        | Apple Calendar via iCloud CalDAV | summarized locally                     |
| Spotify taste   | Spotify Web API                  | top artists, top tracks, recent plays  |

Calendar privacy rule:

Moodcast does **not** send raw event titles, attendees, notes, descriptions, or exact locations to the AI. It only uses a summary such as:

```text
busy afternoon
meeting soon
open evening
suggested shorter session
```

---

## Apple Calendar setup

Moodcast supports Apple Calendar through iCloud CalDAV.

You need an Apple app-specific password:

1. Go to [account.apple.com](https://account.apple.com)
2. Sign in
3. Go to **Sign-In and Security**
4. Open **App-Specific Passwords**
5. Generate one named `Moodcast`
6. Connect from the CLI:

```bash
moodcast calendar connect
```

Credentials are stored locally in:

```text
~/.moodcast/apple-calendar.json
```

with `0600` file permissions.

---

## Spotify setup

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Add this Redirect URI:

```text
http://127.0.0.1:3001/api/auth/spotify/callback
```

4. Add credentials to `.env.local`:

```env
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3001/api/auth/spotify/callback
```

5. In Moodcast, click **Connect Spotify**

Spotify Web Playback SDK requires a **Premium account** for in-browser playback.

---

## AI provider setup

Moodcast supports Gemini and Anthropic. Add one provider key to `.env.local`.

| Provider         | Env var                        | Notes    |
| ---------------- | ------------------------------ | -------- |
| Google Gemini    | `GOOGLE_API_KEY=...`           | default  |
| Anthropic Claude | `ANTHROPIC_API_KEY=sk-ant-...` | optional |

If both are set, Gemini is used by default unless you set:

```env
AI_PROVIDER=anthropic
```

Gemini setup:

1. Get a key from [aistudio.google.com](https://aistudio.google.com)
2. Add:

```env
GOOGLE_API_KEY=...
```

Anthropic setup:

1. Get a key from [console.anthropic.com](https://console.anthropic.com)
2. Add:

```env
ANTHROPIC_API_KEY=...
```

---

## Saved sessions

Moodcast keeps a shared web/CLI session library at:

```text
~/.moodcast/sessions/
```

This powers:

- the web `/saved` page
- `moodcast sessions`
- `moodcast resume`
- `moodcast sessions play <id>`

The current active session is stored at:

```text
~/.moodcast/active-session.json
```

For safe testing, you can sandbox local Moodcast data:

```bash
MOODCAST_HOME=$(mktemp -d) npm run moodcast --silent -- sessions list
```

---

## Playlist save limitation

Moodcast can create Spotify playlist shells.

In Spotify Development Mode, Spotify may reject automatic track insertion into playlists unless your app has Spotify Extended Quota approval. When that happens, Moodcast falls back to:

- creating the playlist shell
- showing an open playlist link
- providing a copyable ordered track list

See:

```text
docs/spotify-quota.md
```

---

## Fallback behavior

| State                           | What you get                                          |
| ------------------------------- | ----------------------------------------------------- |
| No API key, no Spotify          | Demo mode                                             |
| API key, no Spotify             | AI-generated session text and track list              |
| Spotify connected, free account | Taste-aware generation, no Web Playback SDK audio     |
| Spotify Premium                 | Full playback, album art, progress, session dashboard |
| AI quota exceeded               | Friendly `AI_QUOTA_EXCEEDED` error and retry guidance |

---

## Tech stack

- **Next.js 16** App Router
- **TypeScript** strict mode
- **Tailwind CSS v4**
- **Spotify Web API**
- **Spotify Web Playback SDK**
- **Google Gemini** via `@google/generative-ai`
- **Anthropic Claude** via `@anthropic-ai/sdk`
- **Open-Meteo** for weather and geocoding
- **Apple Calendar / iCloud CalDAV** via `tsdav` and `ical.js`
- **Web Speech API** for local MooC voice cues
- **Local filesystem session library** under `~/.moodcast`
- **localStorage** for browser preferences and UI state

---

## Self-hosting

Moodcast is BYOK:

- bring your own Spotify app credentials
- bring your own AI provider key
- optionally connect Apple Calendar with an app-specific password

Secrets are stored locally and are not exposed to the browser.

---

## License

MIT
