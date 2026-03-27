'use client';

import { cn } from '@/lib/utils';
import { VISUAL_PRESETS } from '@airevstream/shared';

interface StyleCardPickerProps {
  onApply: (overrides: Record<string, unknown>) => void;
  selectedId?: string;
}

const SWATCH_COLORS: Record<string, string> = {
  'visual.film-noir.v1': 'bg-gradient-to-br from-gray-900 to-gray-600',
  'visual.wes-anderson.v1': 'bg-gradient-to-br from-amber-200 to-pink-300',
  'visual.cyberpunk.v1': 'bg-gradient-to-br from-purple-600 to-cyan-400',
  'visual.warm-vintage.v1': 'bg-gradient-to-br from-orange-300 to-yellow-200',
  'visual.cool-modern.v1': 'bg-gradient-to-br from-blue-400 to-slate-300',
  'visual.golden-hour.v1': 'bg-gradient-to-br from-orange-400 to-amber-200',
};

export function StyleCardPicker({ onApply, selectedId }: StyleCardPickerProps) {
  // Filter to simple-tier presets if available, otherwise show all visual presets
  const presets = VISUAL_PRESETS.filter(p => !p.tier || p.tier === 'simple');

  return (
    <div>
      <label className="block text-sm font-medium text-text-secondary mb-2">Visual Style</label>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {presets.map((preset) => (
          <button
            type="button"
            key={preset.id}
            onClick={() => onApply(preset.overrides)}
            className={cn(
              'p-3 rounded-lg border-2 transition-all text-left hover:scale-[1.02]',
              selectedId === preset.id
                ? 'border-accent-blue shadow-lg shadow-accent-blue/20'
                : 'border-border hover:border-accent-blue/50',
            )}
          >
            <div className={cn('w-full h-12 rounded-md mb-2', SWATCH_COLORS[preset.id] ?? 'bg-bg-tertiary')} />
            <div className="text-xs font-medium text-text-primary">{preset.name}</div>
            <div className="text-[10px] text-text-tertiary mt-0.5 line-clamp-2">{preset.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
