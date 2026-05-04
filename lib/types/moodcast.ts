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

export interface GenerateSessionRequest extends BuilderFormData {}

export interface GenerateSessionResponse {
  session: MoodcastSession;
  isDemo: boolean;
  demoId?: string; // present when isDemo is true — the hardcoded demo session ID
}

export interface AskDJRequest {
  session: MoodcastSession;
  question: string;
}

export interface AskDJResponse {
  session: MoodcastSession;
  djMessage: string;
}
