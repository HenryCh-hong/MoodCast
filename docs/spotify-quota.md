# Spotify Playlist Track Insertion — Developer Mode Restriction

## What works

| Operation | Endpoint | Status |
|-----------|----------|--------|
| Create playlist | `POST /me/playlists` | ✅ Works |
| Unfollow / delete playlist | `DELETE /playlists/{id}/followers` | ✅ Works |
| Add tracks (JSON body) | `POST /playlists/{id}/tracks` | ❌ 403 in dev mode |
| Add tracks (query param) | `POST /playlists/{id}/tracks?uris=…` | ❌ 403 in dev mode |
| Replace tracks | `PUT /playlists/{id}/tracks` | ❌ 403 in dev mode |

## Root cause

Spotify's 2024 API policy change gates playlist **item modification** endpoints behind **Extended Quota Mode** (app review). Apps in Development Mode — even those with `playlist-modify-public` and `playlist-modify-private` scopes, with the correct owner, and with Web API enabled in the dashboard — receive `403 Forbidden` with no `spotify-request-id` response header. The absence of `spotify-request-id` indicates the request is blocked at Spotify's upstream API gateway before reaching the endpoint handler.

This is not a Moodcast code bug. Playlist creation and cleanup use "user library" operations that are permitted in dev mode; item modification is not.

## How to unlock

1. Open the Spotify Developer Dashboard → your app → **Settings → Quota Extension**
2. Fill in the use case form. Suggested description:

   > Moodcast is an AI radio session generator. Users describe a mood and activity; the app generates a curated tracklist and saves it as a Spotify playlist. We need `POST /playlists/{id}/tracks` to populate the playlist with the generated tracks.

3. Spotify typically reviews within 2–6 weeks.

## Current fallback (until approved)

When track insertion fails, Moodcast:

- Creates the playlist shell successfully (visible in user's Spotify Library)
- Returns HTTP 207 with `ok: false` and the playlist URL
- Shows the user: *"Spotify created the playlist, but this developer app is not approved to add tracks automatically yet. Open empty playlist ↗, or copy the track list below."*
- Provides a **Copy Track List** button that copies all tracks with Spotify URLs to the clipboard, formatted for manual paste into the playlist

The playlist URL is stored in localStorage so the session page can display it on reload.
