# Moodcast

An open-source AI radio agent for your current moment.

Describe the room, connect Spotify, and Moodcast tunes a radio-style session from your listening taste, time of day, weather, location, and calendar rhythm — narrated by **MooC**, an AI DJ companion.

**Demo mode available — no API key, no Spotify account, no setup.**

---

## What it does

- Describe the mood: *"Late night coding, keep it quiet"* or *"Sunday morning, slow and present"*.
- **Auto Tune** from your current moment: time, weather, location, Apple Calendar, Spotify taste, and recent listening patterns.
- **Manual Tune** with mood, activity, texture, signal, and discovery tags.
- Spotify listening history is used as a **taste anchor**, not a replay list — MooC builds an *AI radio show*, mixing familiar anchors with same-artist deep cuts, adjacent artists, and contextual discoveries.
- MooC writes opening monologues, transition cues, and closing notes. Optional browser TTS reads transitions aloud — the voice is **off-able**, and text cues still appear when voice is disabled.
- Purple ambient on-air glow reacts to playing / paused / MooC speaking states.
- Spotify Premium → full in-browser playback via Spotify Web Playback SDK.
- Spotify Free → AI-generated session and track list (no in-browser playback).
- No Spotify or no AI key → demo mode with prewritten sessions.

> Moodcast is not just a playlist generator — it's a context-aware AI radio workflow.

---

## Detailed functionality

### Auto Tune

Moodcast reads the current moment automatically and produces a session without you choosing every tag.

- Reads local time, weather (Open-Meteo), coarse location, Apple Calendar rhythm, your Spotify taste profile, and recent listening context.
- Picks suggested mood / activity / texture / signal tags internally based on those signals.
- Best for *"I just want the right session now."*
- Triggered from the web with **Auto Tune**, or from the terminal with `start --auto`.

### Manual Tune

You choose the signal yourself.

- Mood, activity, texture, moment signal, and familiarity (discovery) level are picked through the tag picker.
- Selected tags shape both the prompt and the session structure (energy arc, source-intent mix).
- Best for *"I know exactly what I want."*
- Triggered from the web with **Manual Tune**, or from the terminal with `start --manual`.

### Discovery Dial

The discovery dial controls how adventurous the queue is. It is *not* a replay-vs-new switch.

| Setting   | What it leans toward                                                                      |
| --------- | ----------------------------------------------------------------------------------------- |
| Familiar  | More familiar anchors, but still mixes in same-artist fresh tracks and adjacent artists.   |
| Balanced  | Even mix of familiar anchors, same-artist deep cuts, adjacent artists, and contextual finds. |
| Discover  | Leans toward adjacent artists and contextual discoveries; fewer familiar anchors.          |

> Even on **Familiar**, MooC will not just replay your top tracks — the prompt explicitly forbids replay-only queues.

### Shared session library

Web and CLI use the **same** session library on disk.

- Path: `~/.moodcast/sessions/` (override with `MOODCAST_HOME` for sandboxed testing).
- Sessions generated in the terminal appear in the web `/saved` page.
- Sessions generated in the web app appear in `moodcast sessions list`.
- `~/.moodcast/active-session.json` is just the "currently playing" pointer — not the library itself.

### Terminal shell

`moodcast` (or `moodcast shell`) opens an interactive command mode designed to feel like a terminal-native radio control room.

```text
moodcast> status
moodcast> start --auto
moodcast> start --manual
moodcast> sessions          # arrow-key picker
moodcast> resume
moodcast> next
moodcast> pause
moodcast> auth              # connect Spotify in browser
moodcast> calendar connect  # connect Apple Calendar
moodcast> quit
```

`sessions` opens an interactive picker (↑↓ select, Enter play, `s` show, `d` delete).

### MooC companion

A floating DJ companion overlay in the web app surfaces:

- the current session (title, energy arc, MooC's read of the room)
- now-playing track + progress
- the live transition cue card
- quick actions and playback controls
- voice & ambient settings (collapsed by default)

MooC is Moodcast's AI DJ identity, distinct from Spotify's own DJ feature.

### MooC voice transitions

Spoken DJ transitions use **the browser's local `speechSynthesis` API** — there is no cloud TTS by default.

- Voice is **optional and off-able**. When off, no `SpeechSynthesisUtterance` is ever created and the visual cue card still appears.
- Voice modes: **off** (no AI reading), **transitions** (short DJ cues between songs), **welcome + transitions** (short opener + transition cues).
- You can adjust volume, rate, and pick a specific browser voice.
- If `speechSynthesis` is unavailable in the browser, text cues still work; the panel labels itself "text-only fallback".
- Disabling voice never delays playback — tracks start immediately even if a cue card is showing.

### Purple on-air ambient mode

A software-only ambient glow that reacts to the on-air state.

- States: disconnected · idle · paused · playing · MooC speaking.
- Three intensity levels (low / medium / high).
- *Future:* hardware lighting (Hue, HomeKit, Nanoleaf) is **not** wired up today.

### Spotify playback

- Premium is required for in-browser playback (Spotify Web Playback SDK requirement).
- The CLI playback handoff prefers the Moodcast Web Playback SDK device when one is online; otherwise it picks the first available active device.
- Moodcast **verifies** that audio is actually playing on the chosen device before showing **ON AIR**, so a silent "Spotify accepted but didn't play" state surfaces as an error instead of fake success.

### Playlist save fallback

Spotify may reject `POST /playlists/{id}/tracks` for apps in **Development Mode**.

- When the auto-fill is rejected, Moodcast still creates the playlist shell, opens it, and provides a copyable ordered track list as a fallback.
- Full automatic insertion typically requires **Spotify Extended Quota Mode** approval. See `docs/spotify-quota.md`.

---

## AI and product mechanisms

This section is what's actually wired up in the codebase today — no future-tense.

### LLM prompting

- Moodcast uses LLMs (Anthropic Claude or Google Gemini) to turn user intent + context + taste into a **structured radio session**.
- The LLM never plays music. It outputs session metadata: title, energy arc, opening monologue, an ordered track queue, per-track `transitionLine`, `whyItFits`, `sourceIntent`, `familiarityLevel`, and an ending message.
- A single LLM call produces the entire session including all narration.

### Prompt engineering

- The prompt has separate **system** and **user/context** sections.
- System rules encode product constraints: no replay-only sessions, mandatory `sourceIntent` mix, respect the discovery dial's anchor ratios, keep calendar/location language privacy-safe, avoid creepy overconfidence ("seems to lean toward" not "I know").
- `MomentContext` (time, weather, calendar rhythm) and `selectedTags` (mood, activity, texture, signal) are injected as **soft signals** — guidance, not hard filters.

### RAG-like contextual grounding (RAG fundamentals, not vector RAG)

- Moodcast does **not** use a vector database or embedding similarity search today.
- It does use retrieval-style grounding: it pulls structured context from your Spotify top artists / top tracks / recent plays, recent local sessions, calendar summary, weather, and location, then injects that context into the generation prompt.
- The result is grounded in user-specific context rather than generic playlist generation.
- *Future:* embeddings + vector search over listening history would be a real RAG upgrade (see *Future improvements*).

### Contextual memory (local, privacy-scoped)

- Moodcast remembers your last few generated sessions, recent listening patterns, and time-of-day affinities.
- These signals are computed locally from your Spotify history and your local session library.
- **Memory is local.** It lives under `~/.moodcast/sessions/` and `~/.moodcast/preferences.json`. Nothing is sent to a Moodcast cloud (because there isn't one).
- This is taste/context memory, not surveillance — there is no per-user model and no learning loop yet.

### Multi-step generation workflow

A session generation goes through ordered steps:

1. Read user preferences (`~/.moodcast/preferences.json`).
2. Build `MomentContext` (time + weather + calendar rhythm + location).
3. Suggest tags (Auto Tune) or accept user-chosen tags (Manual Tune).
4. Build the prompt (system rules + taste profile + context + tags).
5. Call the AI provider (Claude or Gemini).
6. Parse the structured output.
7. Validate the `sourceIntent` distribution.
8. If degenerate (e.g. balanced/discover dial returned a replay-heavy queue), retry once with stronger discovery instructions.
9. Resolve missing Spotify URIs via Spotify search.
10. Save the session to the shared library.
11. Hand off playback and open the broadcast dashboard.

This is a **deterministic pipeline with one conditional retry** — not an autonomous agent loop.

### Structured output parsing

- The LLM is asked to return JSON in a fixed schema.
- Moodcast parses it into typed `MoodcastSession` objects.
- Each track carries metadata: `sourceIntent` (familiar_anchor / same_artist_fresh / adjacent_artist / contextual_discovery / user_seed), `familiarityLevel`, `whyItFits` / `whyThisSourceFits`, `transitionLine`.
- Missing optional fields are tolerated; in dev, a warning surfaces so the prompt can be tuned.

### Post-generation validation and one-shot retry

- After the LLM call, Moodcast inspects the queue's `sourceIntent` distribution.
- If balanced/discover mode came back too replay-heavy (too many `familiar_anchor`s, or too many tracks with no source intent at all), it asks the LLM **once** to regenerate with a stricter discovery instruction.
- This guards against the classic "the AI just listed your top tracks" failure mode.

### Spotify URI resolution

- Some tracks come back from the LLM without a real Spotify URI (by design: only familiar anchors and explicit user seeds are required to carry a real URI).
- For the rest, Moodcast searches Spotify with `track:<title> artist:<artist>` and matches on artist substring + title prefix.
- Tracks that don't resolve stay empty and are **filtered out at playback** — Moodcast never fabricates a URI to fake a play.

### Privacy-safe context summarization

- Apple Calendar events are summarized **before** the LLM sees them. The AI only receives shapes like "busy afternoon" or "meeting soon" — never raw titles, attendees, descriptions, notes, or exact locations.
- Location is **city-level / coarse** by default. Raw GPS coordinates are not passed to the AI.
- Calendar credentials live in `~/.moodcast/apple-calendar.json` with `0600` permissions and never leave your machine.

### Local-first architecture

- Sessions, preferences, Apple Calendar credentials, and the active-session pointer all live under `~/.moodcast/`.
- `MOODCAST_HOME` overrides the directory — useful for sandboxed testing (`MOODCAST_HOME=$(mktemp -d) npm run moodcast --silent`).
- No database is required. No Moodcast cloud service is required.

### Human-in-the-loop tuning

- **Manual Tune** lets you override every suggested tag.
- **Auto Tune** lets MooC pick from the moment context.
- Both flows are first-class — Moodcast supports *"do it for me"* and *"let me drive"* equally.

### Multi-surface product design

- The same `MoodcastSession` model powers the web session page, the floating DJ companion, the terminal dashboard, the saved session library, and the live broadcast dashboard.
- Web and CLI share one session library on disk, so they're not separate worlds.

---

## Future improvements

These are honest gaps — not hidden features.

- Real RAG over listening history with embeddings and vector search.
- Persistent feedback signals (like / skip / save) feeding the next session.
- Stronger agentic planning via Claude tool use (search Spotify, fetch audio features, related artists from inside the LLM loop).
- Audio-feature-aware energy arc (use Spotify's `audio_features` instead of keyword heuristics).
- Hardware ambient lighting (Hue / HomeKit / Nanoleaf).
- Cloud TTS as an alternative voice option.

---

## Who's setting this up?

Moodcast has three distinct setup roles. **Most people are role 3 and have nothing to configure.**

### 1. End user (just wants to listen)

You opened a hosted Moodcast deployment in your browser.

- You **do not** create a Spotify app.
- You **do not** edit any `.env` file.
- You click **Connect Spotify** and authorize through Spotify's hosted login (PKCE).
- Apple Calendar is opt-in — only connect it if you want calendar-aware sessions, and only via an app-specific password you generate yourself.
- AI provider keys are the deployment owner's responsibility unless the deployment is BYOK.

### 2. Local developer / self-host user

You cloned the repo and want to run it on your machine or a personal server.

- You create your own Spotify app (Spotify requires every redirect URI to be registered, so each developer needs their own app).
- You set `SPOTIFY_CLIENT_ID` and `SPOTIFY_REDIRECT_URI` in `.env.local`.
- You **do not** need `SPOTIFY_CLIENT_SECRET` — Moodcast uses Authorization Code with PKCE.
- You add at least one AI provider key (`ANTHROPIC_API_KEY` or `GOOGLE_API_KEY`).
- Your end users (if any) still don't touch env vars.

### 3. Deployment owner (hosting Moodcast for others)

You're running Moodcast as a service.

- Configure one official Spotify app, add the production redirect URI to it, and set `SPOTIFY_CLIENT_ID` + `SPOTIFY_REDIRECT_URI` as deployment env vars.
- The Spotify Client ID is public by design — it appears in the OAuth redirect URL — so it's safe to bake into a deployment. **Never** ship a client secret in the bundle or repo.
- Provide at least one AI provider key as a server-side env var, or document that users must bring their own.
- For automatic playlist track insertion, request **Spotify Extended Quota Mode** for your app. In Development Mode, Spotify may reject `POST /playlists/{id}/tracks`; Moodcast falls back to creating the playlist shell and showing a copyable track list. See `docs/spotify-quota.md`.

---

## Quick start (local developer)

```bash
git clone https://github.com/your-org/moodcast
cd moodcast
npm install

cp .env.example .env.local
# Fill in SPOTIFY_CLIENT_ID, SPOTIFY_REDIRECT_URI, and one AI provider key.

npm run dev -- -p 3001
```

Open:

```text
http://127.0.0.1:3001
```

Moodcast's dev/test flow uses `127.0.0.1:3001` (Spotify treats `127.0.0.1` and `localhost` as different hosts — pick one and use it everywhere). To try without setup, click the demo session link on the landing page.

---

## Spotify setup (developer / owner)

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard).
2. Create a new app.
3. Under **Redirect URIs**, add the URI matching where you'll run Moodcast:

   ```text
   http://127.0.0.1:3001/api/auth/spotify/callback
   ```

   For a hosted deployment, add your production callback URL too.
4. Copy the **Client ID** into `.env.local`:

   ```env
   SPOTIFY_CLIENT_ID=your_client_id
   SPOTIFY_REDIRECT_URI=http://127.0.0.1:3001/api/auth/spotify/callback
   ```

5. Start the dev server and click **Connect Spotify**. Login goes through Spotify's hosted page using **Authorization Code with PKCE** — no client secret is sent or stored.

> **Spotify Premium** is required for in-browser playback via the Web Playback SDK. Free accounts still get AI-generated sessions and track lists.

> **Playlist save limitation**: in Spotify Development Mode, `POST /playlists/{id}/tracks` may be rejected. Moodcast creates the playlist shell, shows an open playlist link, and provides a copyable ordered track list as fallback. Request Extended Quota for full automatic insertion. See `docs/spotify-quota.md`.

---

## AI provider setup

Moodcast supports Gemini and Anthropic. Add at least one provider key to `.env.local`.

| Provider         | Env var                        | Notes                                  |
| ---------------- | ------------------------------ | -------------------------------------- |
| Google Gemini    | `GOOGLE_API_KEY=...`           | session generation; no DJ chat support |
| Anthropic Claude | `ANTHROPIC_API_KEY=sk-ant-...` | session generation **+ DJ chat**       |

If both are set, Anthropic takes priority. Force one explicitly with:

```env
AI_PROVIDER=anthropic   # or: gemini
```

- Gemini key: [aistudio.google.com](https://aistudio.google.com)
- Anthropic key: [console.anthropic.com](https://console.anthropic.com)

---

## Terminal mode

Moodcast also ships with a terminal-native radio console.

```bash
npm run moodcast --silent
```

Or with an alias:

```bash
alias moodcast='npm --prefix ~/Desktop/MoodCast run --silent moodcast --'
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

`moodcast sessions` opens an interactive picker. ↑↓ to select, Enter to play.

The CLI shares the same Spotify auth and session library as the web app — log in once, use either surface.

---

## Auto Tune vs Manual Tune

### Auto Tune — Moodcast reads the moment

Tunes automatically from:

- local time
- weather (Open-Meteo, no API key)
- coarse location (city-level)
- Apple Calendar rhythm (busy/open windows only)
- Spotify taste (top artists, top tracks, recent plays)
- recent listening patterns
- discovery preference

```bash
moodcast start --auto
```

### Manual Tune — you pick the signal

- mood
- activity
- texture
- moment signal
- familiarity / discovery level

```bash
moodcast start --manual
```

---

## Moment Context (privacy-safe)

Moodcast can shape sessions with privacy-safe context:

| Context         | Provider                         | Notes                                       |
| --------------- | -------------------------------- | ------------------------------------------- |
| Time / timezone | local system                     | always available                            |
| Weather         | Open-Meteo                       | no API key required                         |
| Location        | manual city / coarse location    | raw coordinates are not sent to the AI      |
| Calendar        | Apple Calendar via iCloud CalDAV | summarized locally; only Apple, not Google  |
| Spotify taste   | Spotify Web API                  | top artists, top tracks, recent plays       |

**Calendar privacy rule.** Moodcast does **not** send raw event titles, attendees, notes, descriptions, or exact locations to the AI. It only sends a summary such as:

```text
busy afternoon
meeting soon
open evening
suggested shorter session
```

---

## Apple Calendar setup

Moodcast supports Apple Calendar through iCloud CalDAV (no Google Calendar / OAuth).

You need an Apple app-specific password:

1. Go to [account.apple.com](https://account.apple.com).
2. Sign in.
3. Go to **Sign-In and Security**.
4. Open **App-Specific Passwords** and generate one named `Moodcast`.
5. Connect from the CLI:

   ```bash
   moodcast calendar connect
   ```

Credentials are stored locally at `~/.moodcast/apple-calendar.json` with `0600` permissions.

---

## Saved sessions

Moodcast keeps a **shared web/CLI session library** at:

```text
~/.moodcast/sessions/
```

Sessions saved from the web app are visible in the CLI and vice versa. This is not a localStorage-only store — the source of truth is your local filesystem under `~/.moodcast`.

This powers:

- the web `/saved` page
- `moodcast sessions`
- `moodcast resume`
- `moodcast sessions play <id>`

The current active session is stored at:

```text
~/.moodcast/active-session.json
```

For safe testing, sandbox local Moodcast data:

```bash
MOODCAST_HOME=$(mktemp -d) npm run moodcast --silent -- sessions list
```

---

## Fallback behavior

| State                           | What you get                                          |
| ------------------------------- | ----------------------------------------------------- |
| No API key, no Spotify          | Demo mode (prewritten sessions)                       |
| API key, no Spotify             | AI-generated session text and track list              |
| Spotify connected, free account | Taste-aware generation, no Web Playback SDK audio     |
| Spotify Premium                 | Full playback, album art, progress, session dashboard |
| AI quota exceeded               | Friendly `AI_QUOTA_EXCEEDED` error and retry guidance |

---

## Tech stack

- **Next.js 16** App Router (customized — see `AGENTS.md`)
- **TypeScript** strict mode
- **Tailwind CSS v4**
- **Spotify Web API** + **Spotify Web Playback SDK**
- **Spotify OAuth 2.0** with **PKCE** (no client secret required)
- **Google Gemini** via `@google/generative-ai`
- **Anthropic Claude** via `@anthropic-ai/sdk`
- **Open-Meteo** for weather and geocoding
- **Apple Calendar / iCloud CalDAV** via `tsdav` and `ical.js`
- **Web Speech API** for local MooC voice cues
- **Local filesystem session library** under `~/.moodcast` (shared web + CLI)
- **localStorage** for browser preferences and UI state

---

## Self-hosting (BYOK)

Moodcast is bring-your-own-keys:

- bring your own Spotify app (Client ID only — PKCE means no secret)
- bring your own AI provider key
- optionally connect Apple Calendar with an app-specific password

Secrets live in `.env.local` and `~/.moodcast`. They are not exposed to the browser. `.env.local` and other `.env*` files are gitignored.

---

## License

MIT
