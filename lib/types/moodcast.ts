// lib/types/moodcast.ts

export type TrackSourceIntent =
  | 'familiar_anchor'
  | 'same_artist_fresh'
  | 'adjacent_artist'
  | 'contextual_discovery'
  | 'user_seed';

export type TrackFamiliarityLevel = 'familiar' | 'fresh' | 'discovery';

export interface Track {
  title: string;
  artist: string;
  moodTag: string;
  energy: 'low' | 'medium' | 'high';
  whyItFits: string;
  transitionLine: string;
  uri?: string;        // Spotify track URI, present when generated with Spotify
  id?: string;         // Spotify track ID
  albumName?: string;  // populated after Spotify enrichment
  albumArt?: string;
  durationMs?: number;
  // Phase 3 — Source-intent metadata, populated by AI generation.
  sourceIntent?: TrackSourceIntent;
  familiarityLevel?: TrackFamiliarityLevel;
  whyThisSourceFits?: string;
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

export interface ContextualSignals {
  morningArtists: string[];          // artists played 05:00–10:00 local time
  eveningArtists: string[];          // 18:00–22:00
  lateNightArtists: string[];        // 22:00–03:00
  mostActiveHour: number;            // 0–23; 0 when no data
  recentSessionMoods: string[];      // moods from last 5 saved sessions
  recentSessionActivities: string[]; // activities from last 5 saved sessions
  repeatedArtists: string[];         // appear in both topTracks and recentTracks (strong affinity)
  recentEnergyTrend: 'low' | 'medium' | 'high' | 'mixed' | 'unknown';
  confidence: 'low' | 'medium' | 'high';
  explanation: string;               // e.g. "Morning signal detected: soft / focused"
}

export interface TasteProfile {
  topArtists: Array<{ name: string; genres: string[] }>;
  topTracks: Array<{ title: string; artist: string; uri: string }>;
  recentTracks: Array<{
    title: string;
    artist: string;
    uri: string;
    playedAt?: string;  // ISO 8601 from Spotify played_at field
  }>;
  contextualSignals?: ContextualSignals;
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
  recentSessions?: Array<{ mood: string; activity: string; createdAt: string }>;
}

export type GenerateSessionResponse =
  | { session: MoodcastSession; sessionId: string; isDemo: false }
  | { session: MoodcastSession; sessionId: string; isDemo: true; demoId: string };

export interface AskDJRequest {
  session: MoodcastSession;
  question: string;
}

export interface AskDJResponseMessage {
  type: 'message';
  djMessage: string;
}

export interface AskDJResponseRetune {
  type: 'session_update';
  djMessage: string;
  updatedTracks: Track[];
  changedTrackTitles: string[];
  playbackRecommendation: 'continue' | 'restart' | 'ask_user';
}

export type AskDJStructuredResponse = AskDJResponseMessage | AskDJResponseRetune;

export interface GenerateBroadcastRequest {
  form: BroadcastFormData;
  tasteProfile?: TasteProfile;
}
