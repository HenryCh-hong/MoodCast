# Siri & Apple Shortcuts

You don't need a native iOS app to launch Moodcast hands-free. Apple's
**Shortcuts** app, plus a single shell command, gives you "Hey Siri, start
Moodcast" from your Mac, iPhone, iPad, or Apple Watch.

> **Quick start:** run `moodcast shortcut` in your terminal. It prints the
> exact recipes below with your repo path baked in, ready to paste into
> Shortcuts.

> **Scope:** Shortcuts is a launch layer, not a full control surface. Skip,
> retune, ask-DJ etc. still happen in the web app or the terminal shell.
> The goal here is just: *get me to the playing Moodcast as fast as
> possible*.

## Prerequisites

1. The repo is set up locally: `npm install` and `npm run moodcast:setup` have
   been run.
2. The shell aliases have been installed (the setup command does this for
   you on macOS), so `moodcast up` is callable from a fresh login shell.
3. Optional: a working `MOODCAST_HOME=$(mktemp -d) moodcast up` smoke test
   from the terminal so you know the launch flow itself isn't broken.

## Option 1 — "Run Shell Script" (recommended)

Best when you want the shortcut to *also* boot the dev server if it isn't
already running.

1. Open the **Shortcuts** app on macOS.
2. Click `+` to create a new shortcut, name it **Start Moodcast**.
3. Add the action **Run Shell Script** (under "Scripting").
4. Set the shell to `zsh`.
5. Set "Pass Input" to *no input*.
6. Paste this as the script body:

   ```sh
   /bin/zsh -lc "source ~/.zshrc && moodcast"
   ```

   The `-l` makes zsh load your login profile, and the explicit `source` is a
   belt-and-braces in case the shortcut's environment doesn't honor `-l`. We
   need this so the `moodcast` alias from `~/.zshrc` is found.

   We invoke bare `moodcast` (not `moodcast up`) because the bare command is
   the daily app launcher: setup-check → server ensure → browser → shell.
   Use `moodcast up` instead if you only want the server / browser part
   without the terminal shell taking over the window.
7. Toggle **Run as administrator** *off*. Moodcast doesn't need it.
8. Click the info pane (ⓘ) and enable **Use with Siri**, then record the
   phrase **"Start Moodcast"**.

You can now say:

* "Hey Siri, start Moodcast"
* "Hey Siri, open Moodcast"
* "Hey Siri, play my focus radio"  (record the phrase to map to the same
  shortcut)

## Option 2 — "Open URL" (lighter)

Use this if Moodcast is already running and you just want a one-tap link to
the web UI. It does **not** start the dev server if it's offline.

1. Create a new shortcut, name it **Open Moodcast Web**.
2. Add the action **Open URL**.
3. Set the URL to: `http://127.0.0.1:3001`.
4. Enable **Use with Siri** and record the phrase.

## On iPhone / iPad

The Shortcuts app on iOS shows the same actions, but **Run Shell Script** is
not available — that action is macOS-only. On iOS, you can still:

* Use **Option 2 — Open URL** to jump to the local web app once your Mac is
  on the same network and the dev server is running. (Substitute
  `http://<your-mac-hostname>.local:3001` and make sure your Mac firewall
  allows incoming connections to port 3001.)
* Use **SSH** action (third-party app *Prompt*, or a built-in
  *Run Script Over SSH* shortcut) to invoke `moodcast up` on your Mac
  remotely.

A native iOS player is on the long-term roadmap — see
[`./command-setup.md`](./command-setup.md) for the full surface list.

## Troubleshooting

* **"Command not found: moodcast"** — `~/.zshrc` isn't being sourced. Re-run
  `npm run moodcast:setup` to install the alias, or change the script body
  to call the absolute repo path:

  ```sh
  /bin/zsh -lc 'cd /absolute/path/to/MoodCast && npm run --silent moodcast:up'
  ```

* **Browser doesn't open** — the shell script ran but `open` couldn't find a
  default browser. The Moodcast URL still prints to the shortcut's stdout.
  Tap "Show Output" in Shortcuts to see it.

* **Silent failure** — Shortcuts swallows nonzero exit codes by default. Add
  this at the end of your script to surface errors:

  ```sh
  /bin/zsh -lc "source ~/.zshrc && moodcast up" 2>&1 | tee /tmp/moodcast-shortcut.log
  ```
