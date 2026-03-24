'use client';

import { cn } from '@/lib/utils';
import { CHARACTER_PRESETS } from '@airevstream/shared';
import type { Preset } from '@airevstream/shared';

interface CharacterPresetPickerProps {
  onApply: (overrides: Record<string, unknown>) => void;
  selectedId?: string;
}

const CHAR_ICONS: Record<string, string> = {
  'character.solo-speaker.v1': '🎙️',
  'character.two-characters.v1': '👥',
  'character.narrator-broll.v1': '📖',
  'character.no-dialogue.v1': '🎵',
  'character.faceless-cinema.v1': '🎭',
};

export function CharacterPresetPicker({ onApply, selectedId }: CharacterPresetPickerProps) {
  const presets = CHARACTER_PRESETS.filter((p) => !p.tier || p.tier === 'simple');

  return (
    <div>
      <label className="block text-sm font-medium text-text-secondary mb-2">Character Type</label>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {presets.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onApply(preset.overrides)}
            className={cn(
              'p-3 rounded-lg border-2 transition-all text-left hover:scale-[1.02]',
              selectedId === preset.id
                ? 'border-accent-blue shadow-lg shadow-accent-blue/20 bg-accent-blue/5'
                : 'border-border hover:border-accent-blue/50 bg-bg-secondary',
            )}
          >
            <div className="text-2xl mb-2">{CHAR_ICONS[preset.id] ?? '👤'}</div>
            <div className="text-xs font-medium text-text-primary">{preset.name}</div>
            <div className="text-[10px] text-text-tertiary mt-0.5 line-clamp-2">
              {preset.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
