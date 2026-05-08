import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';
import { Navbar } from '@/components/layout/Navbar';
import { MoodcastProvider } from '@/lib/context/MoodcastContext';
import { FloatingDJCompanion } from '@/components/companion/FloatingDJCompanion';
import { AmbientStage } from '@/components/companion/AmbientStage';
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
          <AmbientStage />
          <Navbar />
          <main className="flex-1">{children}</main>
          <FloatingDJCompanion />
        </MoodcastProvider>
      </body>
    </html>
  );
}
