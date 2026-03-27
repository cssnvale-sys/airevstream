'use client';

import { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

interface Shortcut {
  keys: string[];
  description: string;
}

const SHORTCUTS: { section: string; items: Shortcut[] }[] = [
  {
    section: 'Navigation',
    items: [
      { keys: ['?'], description: 'Open this shortcuts modal' },
      { keys: ['⌘', 'K'], description: 'Open command palette' },
      { keys: ['Esc'], description: 'Close panels and modals' },
      { keys: ['D'], description: 'Go to Dashboard' },
      { keys: ['S'], description: 'Go to Settings' },
      { keys: ['P'], description: 'Go to Approvals' },
      { keys: ['Y'], description: 'Go to System' },
    ],
  },
  {
    section: 'Content',
    items: [
      { keys: ['N'], description: 'Go to Create page' },
      { keys: ['L'], description: 'Go to Library' },
      { keys: ['A'], description: 'Go to Analytics' },
      { keys: ['W'], description: 'Go to Workflows' },
      { keys: ['E'], description: 'Go to Experiments' },
      { keys: ['C'], description: 'Go to Channels' },
      { keys: ['R'], description: 'Go to Series' },
      { keys: ['T'], description: 'Go to Assets' },
    ],
  },
];

function KeyBadge({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded border border-border bg-bg-tertiary text-text-primary text-xs font-mono font-medium">
      {children}
    </kbd>
  );
}

interface KeyboardShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        className="card w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-text-primary">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            aria-label="Close shortcuts modal"
            className="text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue/50 rounded"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-6">
          {SHORTCUTS.map((section) => (
            <div key={section.section}>
              <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3">
                {section.section}
              </h3>
              <div className="space-y-2">
                {section.items.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="text-sm text-text-primary">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key) => (
                        <KeyBadge key={key}>{key}</KeyBadge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-border">
          <p className="text-xs text-text-secondary text-center">
            Press <KeyBadge>?</KeyBadge> to toggle this modal
          </p>
        </div>
      </div>
    </div>
  );
}
