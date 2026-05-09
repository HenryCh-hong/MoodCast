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
- Stronger agentic planning via Claude tool use (search Spotify, fetch audio features, related artists from inside the LLM loop).
- Audio-feature-aware energy arc (use Spotify's `audio_features` instead of keyword heuristics).
- Hardware ambient lighting (Hue / HomeKit / Nanoleaf).
- Cloud TTS as an alternative voice option.

---

## Music provider roadmap

Moodcast was built around Spotify, but listeners outside its footprint
deserve the same experience. The provider abstraction in
`lib/music/providers/` is the seam we'll grow into.

**Today, Spotify is the only provider that can drive playback inside
Moodcast.** QQ Music and NetEase Cloud Music support is **planned**, not
shipped — the safe fallback is a curated track list plus an "Open in
&lt;provider&gt;" external search link. Full playback in the Moodcast page
depends on each platform exposing an official, sanctioned, individually-
developer-eligible API path. Research details and open questions live in
[`docs/music-providers.md`](./docs/music-providers.md).

| Provider              | Moodcast playback today | Fallback for now                            | Why                                                                                                                                |
| --------------------- | ----------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Spotify               | **Yes** (Web Playback SDK, Premium) | n/a                                         | Official, documented, individual-developer eligible.                                                                               |
| QQ Music              | No (under investigation)            | Curated list + "Open in QQ Music" search    | Official developer platform exists; QPlay playback is partner-cert gated (cars / speakers / TVs); web embed undocumented for 3P.   |
| NetEase Cloud Music   | No (under investigation)            | Curated list + "Open in NetEase" search     | Official developer portal exists at `developer.music.163.com`; eligibility / scopes / playback surface unverified. Unofficial reverse-engineered libraries are out of scope.   |

We do **not** ship reverse-engineered NetEase / QQ APIs, DRM bypass, or
region-restriction workarounds — see "Why not unofficial APIs?" in the
provider doc for the durable reasoning. Until an official integration
path exists, the honest UX for Chinese-platform users is *"Moodcast
curates, you open it in your existing app."*

---

## Feedback memory (like / dislike)

Each track row in the web UI and the floating DJ companion has a 👍 / 👎
control. Feedback is stored at `<MOODCAST_HOME>/feedback.json` (default
`~/.moodcast/feedback.json`) so it persists across sessions and is shared
between the web app and the terminal CLI.

Future generations get a privacy-safe summary of the feedback — liked
artists, repeatedly-disliked artists, intent preferences, and the set of
exact track URIs to avoid repeating. Single dislikes never permanently ban
an entire artist; the rule is "do not repeat exact disliked tracks unless
the user explicitly asks for them, and gently favour what they've liked".

Sandbox a fresh feedback file for testing with:

```sh
MOODCAST_HOME=$(mktemp -d) npm run test:feedback
```

---

## Daily launch (`moodcast`)

Once `npm run moodcast:setup` has installed the shell aliases, the daily
flow is just one word:

```sh
moodcast
```

Bare `moodcast` is the **app launcher**, not just the shell. It does, in
order:

1. **Setup check.** If `.env.local` or `node_modules` is missing it prints
   one compact line — `run: npm run moodcast:setup` — and stops. No setup
   wizard noise from the daily command.
2. **Server ensure.** Pings `127.0.0.1:3001`. Already responding? Skips to
   step 3. Otherwise spawns `next dev` detached and waits for it.
3. **Compact status.** A 3-line panel: `web online`, `shell ready`,
   `MooC online` — no env panels, no alias previews, no dotenv noise.
4. **Browser open** (best-effort — if `open` fails, the URL is printed,
   never a crash).
5. **Hand off to the interactive shell** for `start --auto`, `sessions`,
   `resume`, etc. First-run users get a one-line "type `start --auto` to
   broadcast" hint above the prompt; returning users go straight to the
   bare prompt.

### Variants

```sh
moodcast --no-open               # ensure server, drop into shell, skip browser
moodcast --path /saved           # open straight to /saved
moodcast --path /builder
moodcast --port 3002             # use a different port (temporary; see caveat)
moodcast up [...same flags...]   # web only — server + browser, no shell
moodcast shell                   # shell only — no server / browser side-effects
moodcast setup                   # first-run wizard (deps / .env.local / aliases)
moodcast shortcut                # print Apple Shortcuts recipes for "Hey Siri, start Moodcast"
moodcast status                  # spotify / device / now-playing
```

`moodcast up` and `moodcast shell` are still there for the times you want
just one half. `moodcast setup` and `moodcast shortcut` are the two
explicit-and-verbose commands; everything else stays quiet.

For a Finder-clickable launcher and "Hey Siri, start Moodcast", see
[`docs/command-setup.md`](./docs/command-setup.md) and
[`docs/siri-shortcuts.md`](./docs/siri-shortcuts.md).

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

## 90-second demo walkthrough

The shortest path through Moodcast — for a recorded demo, a code review, or
a five-minute showcase. Assumes a one-time setup is already done (Spotify
Premium connected, an AI provider key in `.env.local`).

**0:00 — Launch.** In a terminal, type:

```sh
moodcast
```

A 3-line panel reports `web online`, `shell ready`, `MooC online`. The
browser opens to the Moodcast home. The shell prompt is now waiting.

**0:10 — Auto Tune.** From the prompt:

```text
moodcast> start --auto
```

Moodcast does *not* ask you to pick mood, activity, or tags. It reads the
current moment — time, weather, coarse location, Apple Calendar rhythm if
connected, your Spotify taste — and starts generating.

**0:20 — Signal Scan.** The browser fades into the Signal Scan card: a
live read of "what Moodcast knows about right now" — `late-night · weekend
· clear · open evening · taste anchor: indie / folk`. This is the entire
context the AI is about to receive, in plain English. No raw event titles,
no GPS, no surveillance.

**0:30 — Generated session.** A `MoodcastSession` lands in the broadcast
dashboard:

- **Session title** + 1-line subtitle.
- **Opening monologue** — 2–4 sentences in DJ MOOC's voice.
- **Energy arc** + **session arc phases** (e.g., *Warm intro → Deep cuts → Landing*).
- **Track queue** with `sourceIntent` chips (familiar / fresh / discovery /
  contextual) and one-line `whyItFits` per track.

**0:55 — ON AIR.** Moodcast hands playback to the Spotify Web Playback
SDK, verifies audio is actually playing on the chosen device, and the
header flips to **ON AIR**. The floating MooC companion appears bottom-
right with the now-playing track and the next transition cue.

**1:10 — Like / dislike.** Hover any track — a 👍 / 👎 pair appears.
Tapping 👎 on a track marks it as disliked in `~/.moodcast/feedback.json`
(scrubbed of tokens; capped at 500 records). The next session won't
replay that exact track and will gently lean toward what was liked.

**1:25 — Saved session.** Open `/saved` in the browser, or run:

```text
moodcast> sessions
```

The session you just generated is in the shared library. Web and CLI see
the same list. Tap or arrow-Enter to replay or resume any past session.

**1:30 — Done.** Total elapsed: under 90 seconds. No login wall, no
playlist export step, no manual tag fiddling.

> Want to try without any setup? The landing page has a **Demo mode**
> link that runs through this entire flow with prewritten sessions — no
> Spotify, no AI key, no terminal needed.

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

#### How the credential is stored

Your Apple ID and the app-specific password are written to
`~/.moodcast/apple-calendar.json` as **plaintext JSON** with `0600` file
permissions (owner read/write only). The file never leaves your machine —
no Moodcast cloud, no analytics, no backups. The only network calls that
ever see the password are direct CalDAV requests to `caldav.icloud.com`.

This is acceptable for a single-user laptop. If you share the machine, or
if Moodcast is being run on a multi-tenant host, treat the file as a
secret on disk and revoke the app-specific password from
[account.apple.com](https://account.apple.com) when you're done. Run
`moodcast calendar disconnect` to delete the file completely.

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

## Tests and evals

Unit-level checks (no AI calls, sandboxed under a temp `MOODCAST_HOME`):

```sh
npm run test:queue       # playable-index ↔ raw-row queue mapping
npm run test:feedback    # like/dislike persistence + privacy scrubbing
npm run test:providers   # music provider abstraction + URL safety
```

Prompt-quality regression harness (calls the live AI provider — costs a
few cents per full run, takes 1–3 minutes):

```sh
npm run eval:dry         # validate scenario set, no AI calls
npm run eval             # run all 12 scenarios
npm run eval -- --ids core-late-night-coding,replay-discover-with-taste
```

The eval harness lives at `scripts/eval/`. Each scenario fixes a
(mood, activity, moment context, discovery dial, taste profile) input and
declares expectations on:

- track count
- `sourceIntent` distribution (per-dial bounds from the prompt rules)
- replay leakage (no top/recent track may sneak in unmarked)
- structured-field schema (no missing/invalid `sourceIntent`, `energy`, etc.)
- soft context alignment (mood/activity keyword matches; opener length)

Run it before merging any change to `lib/ai/moodcastPrompt.ts` or
`lib/ai/generateMoodcastSession.ts`. Add a scenario when you encounter a
failure mode that the existing scenarios didn't catch.

---

## License

MIT
