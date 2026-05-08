import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';
import { Navbar } from '@/components/layout/Navbar';
import { MoodcastProvider } from '@/lib/context/MoodcastContext';
import { FloatingDJCompanion } from '@/components/companion/FloatingDJCompanion';
import { AmbientStage } from '@/components/companion/AmbientStage';
import { SpotifyPlayerHost } from '@/components/player/SpotifyPlayerHost';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Moodcast — Turn your mood into a personal radio session',
  description:
    'An open-source AI radio agent. Tell Moodcast your mood, get a curated session with AI DJ monologue, track queue, and transition lines.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-screen bg-mc-bg text-mc-hi flex flex-col">
        <MoodcastProvider>
          {/* SpotifyPlayerHost mounts the Web Playback SDK once for the
              entire app, so navigation between sessions does not tear it
              down and force a 1-2s reconnect (which read to users as
              "Spotify is not authenticated"). */}
          <SpotifyPlayerHost />
          <AmbientStage />
          <Navbar />
          <main className="flex-1">{children}</main>
          <FloatingDJCompanion />
        </MoodcastProvider>
      </body>
    </html>
  );
}
