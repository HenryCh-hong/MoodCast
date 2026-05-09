# Moodcast command setup

> **TL;DR — quickest path:** `npm install` once, then run
> `npm run moodcast:setup`. It seeds `.env.local` from `.env.example` (without
> overwriting anything), installs the `moodcast` shell alias after a Y/n
> confirmation, and prints the API keys you need to fill in. After that,
> daily use is just **one word**:
>
> ```sh
> moodcast
> ```
>
> Bare `moodcast` is the daily app launcher: setup-check → ensure server →
> open browser → enter the interactive shell. The other commands
> (`moodcast up`, `moodcast shell`, `moodcast setup`, `moodcast shortcut`,
> `moodcast status`) are still there for when you want just one slice.

After cloning, the `npm run moodcast …` form always works:

```sh
npm run moodcast --silent -- shell
npm run moodcast --silent -- start
npm run moodcast --silent -- sessions list
```

…but it gets old fast. There are two ways to make `moodcast` work as a normal
command.

## Option A — shell alias (recommended, zero install)

Add this line to your `~/.zshrc` (or `~/.bashrc`):

```sh
alias moodcast='npm --prefix ~/Desktop/MoodCast run --silent moodcast --'
```

Reload your shell (`source ~/.zshrc`), then from anywhere:

```sh
moodcast              # opens the interactive shell
moodcast shell        # same
moodcast start        # one-shot generate + dashboard
moodcast start --auto
moodcast sessions list
moodcast resume
```

The alias passes everything after `moodcast` straight through to the underlying
`tsx cli/index.ts` entry point, so any flag the npm form supports works here too.

If you keep the repo somewhere other than `~/Desktop/MoodCast`, change the
`--prefix` path to match.

## Option B — `npm link` (global symlink)

`package.json` already declares the `moodcast` bin (it points at the existing
`cli/index.ts` shebang). To make it globally callable:

```sh
cd ~/Desktop/MoodCast
npm link
```

`npm` will install a symlink in your global `bin` directory (usually
`/usr/local/bin/moodcast` or `~/.npm-global/bin/moodcast`, depending on your
Node setup). After that:

```sh
moodcast
moodcast start
moodcast sessions list
```

Notes:

* The CLI is `tsx`-based, so `tsx` must be on your `PATH`. The repo already
  installs it as a dev-dependency, and `npm link` resolves it inside the repo,
  so this generally just works after `npm install`.
* If you later switch repos / branches, `npm unlink -g moodcast` removes the
  symlink.
* The alias from Option A and the symlink from Option B can coexist — use
  whichever feels right. Option A is easier to undo.

## Inside the shell

Once you have `moodcast` available, the typical flow is:

```
$ moodcast
  ▓▒░ MOODCAST ░▒▓  FM 88.7
  MooC online.
  Type help for commands.

moodcast> help
moodcast> sessions          ← interactive picker
moodcast> start --auto      ← skip the tag picker
moodcast> resume
moodcast> quit
```

Aliases inside the shell: `ls` → `sessions list`, `s` → picker, `r` → resume,
`n` → next, `p` → previous, `q` → quit.

## Storage location

The shell, and every command it dispatches, reads/writes inside `~/.moodcast`
(or `$MOODCAST_HOME` if set). For experimenting without touching your real data,
launch a throwaway shell with:

```sh
MOODCAST_HOME=$(mktemp -d) moodcast
```

## Bare `moodcast` — the daily app launcher

`moodcast` (no arguments) is meant to feel like *"open Moodcast"*. The flow:

1. **Setup check.** Verifies `.env.local` and `node_modules/next` exist. If
   either is missing it prints a single compact line —
   `Moodcast needs setup first` — pointing at `npm run moodcast:setup`,
   and exits. No long setup output from the daily command.
2. **Server ensure.** Pings `127.0.0.1:3001`. Already up? Skip ahead.
   Otherwise spawn `next dev` detached, wait for ready.
3. **3-line status:**

   ```
   ●  web      online  http://127.0.0.1:3001
   ●  shell    ready
   ●  MooC     online
   ```
4. **Browser open** (best-effort — prints the URL if `open` fails).
5. **Drop into the interactive shell.** First-time users see a single
   `type start --auto to broadcast` hint above the prompt; returning users
   go straight to the bare prompt.

### Variants of bare `moodcast`

```sh
moodcast                  # full app launch (server + browser + shell)
moodcast --no-open        # skip the browser open, keep everything else
moodcast --path /saved    # open straight to /saved
moodcast --path /builder
moodcast --port 3002      # use a different port (see SPOTIFY_REDIRECT_URI caveat below)
```

### Quiet by default

Daily commands are deliberately quiet: dotenv's `◇ injected env (N)…` line
is suppressed, and the long setup panel (env explanation, alias preview,
next-steps) only shows when you run `moodcast setup` explicitly. To get
verbose dotenv output back for debugging, set `MOODCAST_DEBUG=1` in your
shell.

### When something is wrong

* **Setup incomplete.** `Moodcast needs setup first (missing: deps + .env.local).` → run `npm run moodcast:setup` once.
* **Port held by another app.** Same as `moodcast up` — `lsof -i :3001`
  to inspect, or run `moodcast --port 3002` as a temporary workaround.
* **Server didn't come up.** The error message points at
  `.next/moodcast-dev.log`; you can also re-run `moodcast up` instead of
  bare `moodcast` to get the verbose flow.

## `moodcast up` — what it does, what flags it takes

`moodcast up` is the "open Moodcast" command. It does the smallest amount of
work necessary to get you to a running web app:

1. Pings `127.0.0.1:3001`. If something is already responding as Moodcast,
   it prints **"Moodcast server already online"** and skips straight to
   opening the browser.
2. Otherwise it spawns `next dev -p 3001` detached (so the server keeps
   running after the CLI exits), polls until the server is healthy, prints
   **"Moodcast is ready"**, and opens the browser.
3. If port 3001 is held by something *other* than Moodcast, it stops with a
   clear error — `moodcast up` will never auto-kill another process.

### Flags

```sh
moodcast up                       # open the home page
moodcast up --no-open             # boot/check the server, but don't open the browser
moodcast up --path /saved         # open straight to the saved-sessions page
moodcast up --path /builder       # open straight to the builder
moodcast up --port 3002           # boot on a different port (see caveat below)
```

* `--no-open` is the right choice for headless setups, automation scripts,
  or any time you just want to confirm the server is up.
* `--path` accepts any application route (`/`, `/saved`, `/builder`,
  `/session/<id>`, …). The leading slash is added for you if missing.
* `--port` is for the "3001 is currently taken, just put Moodcast on 3002
  for now" case. **Caveat:** Spotify auth uses the `SPOTIFY_REDIRECT_URI`
  in `.env.local`. If you change the port at runtime, the OAuth callback
  won't match what you registered with Spotify and connect/login will
  fail — keep the env-configured port and use `--port` only as a temporary
  workaround.

### When it can't open the browser

If `open` fails (no default browser, sandboxed environment, SSH session
without `$DISPLAY`), `moodcast up` does **not** crash. It prints:

```
Open Moodcast here: http://127.0.0.1:3001
```

You can copy that into any browser yourself.

### When the port is occupied

```
✗  Port 3001 is already in use by another process.
   inspect what's holding it: lsof -i :3001
   or boot on a different port: moodcast up --port 3002
```

Run `lsof -i :3001` to see who's bound to it. If it's a stale Moodcast
process, stop it first; `moodcast up` will not kill it for you.

## Double-clickable launcher (macOS)

If you want Moodcast to feel more like an app you "open" than a command you
type, generate a Finder launcher:

```sh
npx tsx scripts/create-mac-launcher.ts            # writes ~/Desktop/Moodcast.command
npx tsx scripts/create-mac-launcher.ts ~/Apps     # write somewhere else
```

The generated `Moodcast.command` file is a small shell script that runs
`moodcast up` against this repo. Double-click it from Finder; the dev server
boots (or just nudges) and your browser opens to `http://127.0.0.1:3001`.

* The launcher is **gitignored** — it embeds your local repo path, so it
  belongs on your machine only.
* The first double-click may show macOS's "cannot verify developer" warning.
  Open *System Settings → Privacy & Security → Open Anyway* once and the
  launcher is trusted from then on.

## Apple Shortcuts / Siri

See [`./siri-shortcuts.md`](./siri-shortcuts.md) for instructions on creating
an Apple Shortcut so you can say "Hey Siri, start Moodcast" from anywhere on
your Apple devices.

## Future app-like surfaces

Moodcast stays local-first today: the web app, the terminal shell, the
double-click launcher, and the Siri shortcut are the four "open Moodcast"
surfaces we ship. Surfaces on the long-term roadmap, **not yet implemented**:

1. **macOS menu-bar app** — quick play/pause + session title in the menu bar.
2. **Desktop mini player** — a stripped-down floating window like the
   `FloatingDJCompanion` but as its own native window.
3. **Polished Apple Shortcuts pack** — beyond "Start Moodcast", e.g.
   "Play my focus radio", "Switch to morning mode".
4. **Native mobile app** — iOS/Android, much later. The current Spotify
   playback path is web-SDK based and would need a different player layer.

For now, anything outside the four current surfaces should go through the
existing CLI / web flows; we don't want to spread the surface area too
quickly.
