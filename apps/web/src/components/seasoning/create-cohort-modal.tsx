'use client';

import { useState } from 'react';

interface CreateCohortModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; platforms: string[] }) => Promise<void>;
}

const PLATFORMS = [
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
];

export function CreateCohortModal({ open, onClose, onSubmit }: CreateCohortModalProps) {
  const [name, setName] = useState('');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const togglePlatform = (p: string) => {
    setPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || platforms.length === 0) return;
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), platforms });
      setName('');
      setPlatforms([]);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-secondary border border-border rounded-lg w-full max-w-md p-6">
        <h2 className="text-h3 text-text-primary mb-4">New Seasoning Cohort</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="cohort-name" className="block text-body text-text-secondary mb-1">
              Cohort Name
            </label>
            <input
              id="cohort-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-bg-primary border border-border text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-blue"
              placeholder="e.g. Batch 1 - Gaming Channels"
              required
            />
          </div>

          <div>
            <label className="block text-body text-text-secondary mb-2">Platforms</label>
            <div className="flex gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => togglePlatform(p.value)}
                  className={`px-3 py-1.5 rounded-md text-caption border transition-colors ${
                    platforms.includes(p.value)
                      ? 'bg-accent-blue/20 border-accent-blue text-accent-blue'
                      : 'bg-bg-tertiary border-border text-text-secondary hover:border-text-secondary'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md text-body text-text-secondary hover:bg-bg-tertiary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim() || platforms.length === 0}
              className="px-4 py-2 rounded-md text-body bg-accent-blue text-white hover:bg-accent-blue/80 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Cohort'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
