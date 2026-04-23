'use client';

import { useTheme } from '@/hooks/use-theme';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useState } from 'react';

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
  const [showOptions, setShowOptions] = useState(false);

  const options = [
    { value: 'light' as const, label: 'Light', icon: Sun },
    { value: 'dark' as const, label: 'Dark', icon: Moon },
    { value: 'system' as const, label: 'System', icon: Monitor },
  ];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggleTheme}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowOptions(!showOptions);
        }}
        className="btn-icon"
        title={`Theme: ${theme} (${resolvedTheme}) - Right-click for options`}
        aria-label={`Current theme: ${theme}. Click to toggle, right-click for options.`}
      >
        {resolvedTheme === 'dark' ? (
          <Moon size={18} />
        ) : (
          <Sun size={18} />
        )}
      </button>

      {showOptions && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowOptions(false)}
          />
          <div className="absolute right-0 mt-2 w-40 bg-bg-secondary border border-border rounded-lg shadow-lg z-50 py-1">
            {options.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setTheme(value);
                  setShowOptions(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  theme === value
                    ? 'bg-accent-blue/10 text-accent-blue'
                    : 'text-text-primary hover:bg-bg-tertiary'
                }`}
              >
                <Icon size={16} />
                <span>{label}</span>
                {theme === value && (
                  <span className="ml-auto text-xs">●</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
