'use client';

import { useComplexityMode } from '@/hooks/use-complexity-mode';
import type { ComplexityMode } from '@/lib/complexity-fields';
import { cn } from '@/lib/utils';

const MODES: { value: ComplexityMode; label: string }[] = [
  { value: 'simple', label: 'Simple' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'complex', label: 'Complex' },
];

export function ComplexityToggle() {
  const { mode, setMode } = useComplexityMode();

  return (
    <div className="inline-flex rounded-md border border-border bg-bg-tertiary p-0.5">
      {MODES.map(({ value, label }) => (
        <button
          type="button"
          key={value}
          onClick={() => setMode(value)}
          className={cn(
            'px-2.5 py-1 text-xs font-medium rounded transition-colors',
            mode === value
              ? 'bg-accent-blue text-white shadow-sm'
              : 'text-text-secondary hover:text-text-primary',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
