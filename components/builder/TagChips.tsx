'use client';

// Tag tuner UI mirroring the CLI's tag picker. Reuses TAG_GROUPS so the web
// vocabulary stays in lockstep with the terminal. Pre-fills from suggestTags()
// the way the CLI does. Multi-select for mood/activity/texture/signal,
// single-select (radio) for familiarity (the discovery dial).

import { TAG_GROUPS, type TagGroup } from '@/lib/types/tags';
import type { SelectedTagSet } from '@/lib/types/tags';

const GROUP_ORDER: TagGroup[] = ['mood', 'activity', 'texture', 'signal', 'familiarity'];
const GROUP_LABEL: Record<TagGroup, string> = {
  mood: 'mood',
  activity: 'activity',
  texture: 'texture',
  signal: 'signal',
  familiarity: 'discover',
};

interface TagChipsProps {
  value: SelectedTagSet;
  onChange: (next: SelectedTagSet) => void;
}

export function TagChips({ value, onChange }: TagChipsProps) {
  function toggleMulti(group: 'mood' | 'activity' | 'texture' | 'signal', id: string) {
    const set = new Set(value[group]);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange({ ...value, [group]: Array.from(set) });
  }

  function setFamiliarity(id: string) {
    onChange({ ...value, familiarity: id });
  }

  return (
    <div className="flex flex-col gap-3">
      {GROUP_ORDER.map((group) => {
        const tags = TAG_GROUPS[group];
        const isMulti = group !== 'familiarity';
        return (
          <div key={group} className="flex flex-wrap items-center gap-2">
            <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-mc-lo shrink-0 w-20">
              {GROUP_LABEL[group]}
            </span>
            {tags.map((tag) => {
              const isSelected = isMulti
                ? (value[group] as string[]).includes(tag.id)
                : value.familiarity === tag.id;
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() =>
                    isMulti
                      ? toggleMulti(group as 'mood' | 'activity' | 'texture' | 'signal', tag.id)
                      : setFamiliarity(tag.id)
                  }
                  className={
                    'px-2.5 py-1 rounded text-[11px] font-bold tracking-tight border transition-all ' +
                    (isSelected
                      ? 'border-mc-lav bg-[rgba(184,160,216,0.1)] text-mc-lav'
                      : 'border-mc-border text-mc-lo hover:border-mc-mid hover:text-mc-mid')
                  }
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
