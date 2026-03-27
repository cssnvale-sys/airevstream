'use client';

import { cn } from '@/lib/utils';

const PLATFORM_OPTIONS = [
  { value: 'youtube', label: 'YouTube', icon: '▶', color: 'text-accent-red border-accent-red/30' },
  { value: 'tiktok', label: 'TikTok', icon: '♫', color: 'text-accent-blue border-accent-blue/30' },
  { value: 'instagram', label: 'Instagram', icon: '📷', color: 'text-accent-purple border-accent-purple/30' },
  { value: 'facebook', label: 'Facebook', icon: 'f', color: 'text-accent-blue border-accent-blue/30' },
] as const;

interface PlatformSelectProps {
  selected: string[];
  onChange: (platforms: string[]) => void;
}

export function PlatformSelect({ selected, onChange }: PlatformSelectProps) {
  const toggle = (platform: string) => {
    if (selected.includes(platform)) {
      onChange(selected.filter((p) => p !== platform));
    } else {
      onChange([...selected, platform]);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {PLATFORM_OPTIONS.map((platform) => {
        const isSelected = selected.includes(platform.value);
        return (
          <button
            key={platform.value}
            type="button"
            onClick={() => toggle(platform.value)}
            className={cn(
              'flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-all',
              isSelected
                ? `${platform.color} bg-zinc-800/50`
                : 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300',
            )}
          >
            <span className="text-2xl">{platform.icon}</span>
            <div>
              <div className="font-medium text-sm">{platform.label}</div>
              <div className="text-xs text-zinc-500">
                {isSelected ? 'Selected' : 'Click to select'}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
