'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { deleteSession, updateSession } from '@/lib/storage/localSessions';
import type { MoodcastSession, SavedSession } from '@/lib/types/moodcast';

interface SessionActionBarProps {
  sessionId: string;
  isDemo: boolean;
  session: MoodcastSession & { spotifyPlaylistUrl?: string };
  spotifyConnected: boolean;
}

export function SessionActionBar({
  sessionId,
  isDemo,
  session,
  spotifyConnected,
}: SessionActionBarProps) {
  const router = useRouter();
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(
    (session as SavedSession).spotifyPlaylistUrl ?? null
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tracksSkipped, setTracksSkipped] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleDelete() {
    deleteSession(sessionId);
    router.push('/saved');
  }

  const handleSavePlaylist = useCallback(async () => {
    setSaving(true);
    setSaveError(null);

    const validUris = session.tracks
      .filter((t) => t.uri?.startsWith('spotify:track:'))
      .map((t) => t.uri!);

    try {
      const res = await fetch('/api/playlist/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionTitle: session.sessionTitle,
          sessionSubtitle: session.sessionSubtitle,
          uris: validUris,
        }),
      });
      const data = await res.json() as {
        ok?: boolean;
        playlistId?: string;
        playlistUrl?: string;
        error?: string;
      };

      if (!res.ok && !data.playlistUrl) {
        setSaveError(data.error ?? 'Failed to save playlist');
        return;
      }

      if (data.playlistUrl) {
        setPlaylistUrl(data.playlistUrl);
        if (!isDemo) {
          updateSession(sessionId, {
            spotifyPlaylistId: data.playlistId,
            spotifyPlaylistUrl: data.playlistUrl,
          });
        }
        if (data.ok === false) {
          setTracksSkipped(true);
        }
        return;
      }

      setSaveError(data.error ?? 'Failed to save playlist');
    } catch {
      setSaveError('Network error — could not save playlist');
    } finally {
      setSaving(false);
    }
  }, [session, sessionId, isDemo]);

  const handleCopyTrackList = useCallback(() => {
    const lines: string[] = [`Moodcast — ${session.sessionTitle}`, ''];
    session.tracks.forEach((track, i) => {
      const trackId = track.uri?.startsWith('spotify:track:')
        ? track.uri.split(':')[2]
        : null;
      const spotifyUrl = trackId ? `https://open.spotify.com/track/${trackId}` : null;
      lines.push(`${i + 1}. ${track.title} — ${track.artist}${spotifyUrl ? `\n   ${spotifyUrl}` : ''}`);
    });
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [session]);

  const validTrackCount = session.tracks.filter(
    (t) => t.uri?.startsWith('spotify:track:')
  ).length;
  const totalTrackCount = session.tracks.length;
  const missingUriCount = totalTrackCount - validTrackCount;
  const hasPlayableTracks = validTrackCount > 0;

  return (
    <div className="mt-8 flex flex-col gap-3">
      <div className="flex items-center gap-4 text-[11px] font-bold tracking-tight">
        <button
          onClick={() => router.push('/builder')}
          className="text-mc-lo hover:text-mc-mid transition-colors"
        >
          ⟳ New session
        </button>
        <button
          onClick={() => router.push('/saved')}
          className="text-mc-lo hover:text-mc-mid transition-colors"
        >
          Saved sessions
        </button>

        {spotifyConnected && !isDemo && !playlistUrl && (
          <button
            onClick={handleSavePlaylist}
            disabled={saving || !hasPlayableTracks}
            title={
              !hasPlayableTracks
                ? 'No Spotify track URIs available — regenerate this session with Spotify connected'
                : undefined
            }
            className="text-[#1DB954] hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? '···' : '♫ Create Spotify Playlist'}
          </button>
        )}

        {playlistUrl && !tracksSkipped && (
          <a
            href={playlistUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#1DB954] hover:opacity-80 transition-opacity"
          >
            ♫ Open in Spotify ↗
          </a>
        )}

        {!isDemo && (
          <button
            onClick={handleDelete}
            className="ml-auto text-mc-dim hover:text-mc-onair transition-colors"
          >
            Delete
          </button>
        )}
      </div>

      {/* Warnings and confirmations */}
      {!spotifyConnected && !isDemo && (
        <p className="text-[10px] font-mono text-mc-lo tracking-tight">
          <a href="/api/auth/spotify" className="text-[#1DB954] underline">Connect Spotify</a>
          {' '}to save this session as a playlist.
        </p>
      )}

      {spotifyConnected && !isDemo && !playlistUrl && missingUriCount > 0 && (
        <p className="text-[10px] font-mono text-mc-dim tracking-tight">
          {missingUriCount === totalTrackCount
            ? 'No Spotify track links in this session — regenerate with Spotify connected to enable playlist saving.'
            : `${missingUriCount} track${missingUriCount > 1 ? 's' : ''} without Spotify links will be skipped when saving.`}
        </p>
      )}

      {missingUriCount > 0 && playlistUrl && !isDemo && !tracksSkipped && (
        <p className="text-[10px] font-mono text-mc-dim tracking-tight">
          {missingUriCount} track{missingUriCount > 1 ? 's' : ''} skipped (no Spotify URI). Playlist saved with {validTrackCount} track{validTrackCount !== 1 ? 's' : ''}.
        </p>
      )}

      {saveError && !tracksSkipped && (
        <p className="text-[10px] font-mono text-mc-onair tracking-tight">{saveError}</p>
      )}

      {tracksSkipped && playlistUrl && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-mono text-mc-dim tracking-tight">
            Spotify created the playlist, but this developer app is not approved to add tracks automatically yet.{' '}
            <a
              href={playlistUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1DB954] underline"
            >
              Open empty playlist ↗
            </a>
            {', '}or copy the track list below.
          </p>
          <button
            onClick={handleCopyTrackList}
            className="self-start text-[10px] font-mono font-bold text-mc-lo hover:text-mc-mid transition-colors tracking-tight"
          >
            {copied ? '✓ Copied!' : '⎘ Copy Track List'}
          </button>
        </div>
      )}
    </div>
  );
}
