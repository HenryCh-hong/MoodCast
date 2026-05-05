// lib/types/moodcast.ts

export interface Track {
  title: string;
  artist: string;
  moodTag: string;
  energy: 'low' | 'medium' | 'high';
  whyItFits: string;
  transitionLine: string;
  uri?: string;   // Spotify track URI, present when generated with Spotify
  id?: string;    // Spotify track ID
}

export interface SessionArcPhase {
  phase: string;
  description: string;
}

export interface MoodcastSession {
  sessionTitle: string;
  sessionSubtitle: string;
  mood: string;
  activity: string;
  energyArc: string;
  openingMonologue: string;
  tracks: Track[];
  sessionArc: SessionArcPhase[];
  endingMessage: string;
}

export interface SavedSession extends MoodcastSession {
  id: string;
  createdAt: string;
  isDemo?: boolean;
  demoId?: string;
  spotifyConnected?: boolean;
  spotifyPlaylistId?: string;
  spotifyPlaylistUrl?: string;
}

export interface SpotifyTrack {
  uri: string;
  id: string;
  title: string;
  artist: string;
  albumName: string;
  albumArt: string;
  durationMs: number;
}

export interface TasteProfile {
  topArtists: Array<{ name: string; genres: string[] }>;
  topTracks: Array<{ title: string; artist: string; uri: string }>;
  recentTracks: Array<{ title: string; artist: string; uri: string }>;
}

export interface SpotifySession extends Omit<MoodcastSession, 'tracks'> {
  tracks: SpotifyTrack[];
}

export interface BroadcastFormData {
  mood: string;
  activity: string;
  length: string;
  direction: string;
  prompt?: string;
  seedArtists?: string;
  seedTracks?: string;
}

export type GenerateSessionResponse =
  | { session: MoodcastSession; isDemo: false }
  | { session: MoodcastSession; isDemo: true; demoId: string };

export interface AskDJRequest {
  session: MoodcastSession;
  question: string;
}

export interface AskDJResponse {
  session: MoodcastSession;
  djMessage: string;
}

export interface GenerateBroadcastRequest {
  form: BroadcastFormData;
  tasteProfile?: TasteProfile;
}
