// lib/types/moodcast.ts

export interface Track {
  title: string;
  artist: string;
  moodTag: string;
  energy: 'low' | 'medium' | 'high';
  whyItFits: string;
  transitionLine: string;
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
  spotifyConnected?: boolean;
}

export interface BuilderFormData {
  mood: string;
  activity: string;
  energy: string;
  length: string;
  musicTaste: string;
  songList: string;
  djStyle: string;
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
  prompt: string;
  activity: string;
  length: string;
  direction: string;
  seedArtists?: string;
  seedTracks?: string;
}

export type GenerateSessionRequest = BuilderFormData;

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
