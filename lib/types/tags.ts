// Phase 3 — Tag tuning vocabulary.

export type TagGroup = 'mood' | 'activity' | 'texture' | 'familiarity' | 'signal';

export interface TagDef {
  id: string;
  label: string;
  group: TagGroup;
}

export const TAG_GROUPS: Record<TagGroup, TagDef[]> = {
  mood: [
    { id: 'focused',     label: 'focused',     group: 'mood' },
    { id: 'gentle',      label: 'gentle',      group: 'mood' },
    { id: 'warm',        label: 'warm',        group: 'mood' },
    { id: 'reflective',  label: 'reflective',  group: 'mood' },
    { id: 'uplifting',   label: 'uplifting',   group: 'mood' },
    { id: 'restless',    label: 'restless',    group: 'mood' },
    { id: 'late-night',  label: 'late-night',  group: 'mood' },
  ],
  activity: [
    { id: 'study',       label: 'study',       group: 'activity' },
    { id: 'coding',      label: 'coding',      group: 'activity' },
    { id: 'walking',     label: 'walking',     group: 'activity' },
    { id: 'commute',     label: 'commute',     group: 'activity' },
    { id: 'reset',       label: 'reset',       group: 'activity' },
    { id: 'journaling',  label: 'journaling',  group: 'activity' },
    { id: 'gym',         label: 'gym',         group: 'activity' },
  ],
  texture: [
    { id: 'instrumental', label: 'instrumental', group: 'texture' },
    { id: 'low-vocal',    label: 'low-vocal',    group: 'texture' },
    { id: 'soft-vocal',   label: 'soft-vocal',   group: 'texture' },
    { id: 'atmospheric',  label: 'atmospheric',  group: 'texture' },
    { id: 'cinematic',    label: 'cinematic',    group: 'texture' },
    { id: 'acoustic',     label: 'acoustic',     group: 'texture' },
  ],
  familiarity: [
    { id: 'familiar',  label: 'familiar',  group: 'familiarity' },
    { id: 'balanced',  label: 'balanced',  group: 'familiarity' },
    { id: 'discover',  label: 'discover',  group: 'familiarity' },
  ],
  signal: [
    { id: 'morning',      label: 'morning',      group: 'signal' },
    { id: 'rainy-day',    label: 'rainy-day',    group: 'signal' },
    { id: 'after-class',  label: 'after-class',  group: 'signal' },
    { id: 'workday',      label: 'workday',      group: 'signal' },
    { id: 'slow-start',   label: 'slow-start',   group: 'signal' },
    { id: 'recharge',     label: 'recharge',     group: 'signal' },
    { id: 'pre-meeting',  label: 'pre-meeting',  group: 'signal' },
  ],
};

export interface SuggestedTagSet {
  mood: string[];
  activity: string[];
  texture: string[];
  signal: string[];
  familiarity: string;     // single (the discovery dial)
}

export interface SelectedTagSet {
  mood: string[];
  activity: string[];
  texture: string[];
  signal: string[];
  familiarity: string;     // 'familiar' | 'balanced' | 'discover'
}

// Helper for prompt block formatting.
export function tagsToPromptLines(tags: SelectedTagSet): string {
  const fmt = (label: string, items: string[]) =>
    `${label}: ${items.length ? items.join(', ') : '—'}`;
  return [
    fmt('mood', tags.mood),
    fmt('activity', tags.activity),
    fmt('texture', tags.texture),
    fmt('signal', tags.signal),
    `familiarity: ${tags.familiarity}`,
  ].join('\n');
}
