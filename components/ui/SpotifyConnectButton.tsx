'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useMoodcast } from '@/lib/context/MoodcastContext';

export function SpotifyConnectButton() {
  const { spotifyProfile: profile } = useMoodcast();
  const [showDropdown, setShowDropdown] = useState(false);

  if (!profile || !profile.connected) {
    return (
      <a
        href="/api/auth/spotify"
        className="flex items-center gap-1.5 text-[10px] font-bold tracking-tight text-mc-lo border border-mc-border rounded px-2.5 py-1 hover:border-mc-mid hover:text-mc-mid transition-colors"
      >
        <span className="text-[#1DB954]">♪</span>
        Connect Spotify
      </a>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown((v) => !v)}
        className="flex items-center gap-2 text-[10px] font-bold tracking-tight text-mc-mid hover:text-mc-hi transition-colors"
      >
        {profile.avatar && (
          <Image src={profile.avatar} alt="" width={20} height={20} className="rounded-full" unoptimized />
        )}
        <span>{profile.name}</span>
        {profile.isPremium && (
          <span className="text-[#1DB954] text-[8px] font-bold tracking-[0.1em] uppercase">Premium</span>
        )}
        <span className="text-mc-dim">▾</span>
      </button>

      {showDropdown && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
          <div className="absolute right-0 top-full mt-2 w-44 bg-mc-elevated border border-mc-border rounded shadow-lg z-50 py-1">
            <div className="px-3 py-2 border-b border-mc-border">
              <p className="text-[11px] font-bold tracking-tight text-mc-hi">{profile.name}</p>
              <p className="text-[9px] font-bold tracking-tight text-mc-lo mt-0.5">
                {profile.isPremium ? '✓ Spotify Premium' : 'Free account — playback unavailable'}
              </p>
            </div>
            <a
              href="/api/auth/spotify/logout"
              className="block px-3 py-2 text-[10px] font-bold tracking-tight text-mc-lo hover:text-mc-mid hover:bg-mc-surface transition-colors"
            >
              Disconnect
            </a>
          </div>
        </>
      )}
    </div>
  );
}
