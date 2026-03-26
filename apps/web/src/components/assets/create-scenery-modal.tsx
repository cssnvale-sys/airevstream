'use client';

import { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { apiPost } from '@/hooks/use-api';
import { toast } from '@/lib/toast';
import { FileUpload } from '@/components/ui/file-upload';
import { BUCKETS } from '@airevstream/shared';
import type { UploadResult } from '@/hooks/use-upload';

interface CreateSceneryModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const CATEGORIES = [
  { value: 'city', label: 'City' },
  { value: 'nature', label: 'Nature' },
  { value: 'studio', label: 'Studio' },
  { value: 'fantasy', label: 'Fantasy' },
  { value: 'interior', label: 'Interior' },
  { value: 'abstract', label: 'Abstract' },
];

export function CreateSceneryModal({ open, onClose, onCreated }: CreateSceneryModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [imageUpload, setImageUpload] = useState<UploadResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    setName('');
    setCategory('');
    setImageUpload(null);
  }, []);

  const handleClose = useCallback(() => {
    if (submitting) return;
    resetForm();
    onClose();
  }, [submitting, resetForm, onClose]);

  if (!open) return null;

  const canSubmit = name.trim() && imageUpload;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      await apiPost('/scenery', {
        name: name.trim(),
        category: category || null,
        imageUrl: imageUpload.key,
      });

      toast.success('Scenery created');
      resetForm();
      onCreated();
      onClose();
    } catch (err) {
      console.error('Failed to create scenery:', err);
      toast.error('Failed to create scenery');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-scenery-title"
    >
      <div
        className="card w-full max-w-lg mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 id="create-scenery-title" className="text-h3 text-text-primary">
            New Scenery
          </h2>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="scenery-name" className="block text-body text-text-secondary mb-1">
              Name <span className="text-accent-red">*</span>
            </label>
            <input
              id="scenery-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-bg-primary border border-border text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-blue"
              placeholder="e.g. Tokyo Night Skyline"
              required
              disabled={submitting}
            />
          </div>

          {/* Category */}
          <div>
            <label htmlFor="scenery-category" className="block text-body text-text-secondary mb-1">
              Category
            </label>
            <select
              id="scenery-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-bg-primary border border-border text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-blue"
              disabled={submitting}
            >
              <option value="">Select a category...</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Image upload */}
          <div>
            <label className="block text-body text-text-secondary mb-1">
              Image <span className="text-accent-red">*</span>
            </label>
            <FileUpload
              bucket={BUCKETS.SCENERY}
              accept="image/*"
              maxSizeMB={20}
              onUploaded={setImageUpload}
              disabled={submitting}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="px-4 py-2 rounded-md text-body text-text-secondary hover:bg-bg-tertiary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !canSubmit}
              className="px-4 py-2 rounded-md text-body bg-accent-blue text-white hover:bg-accent-blue/80 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Scenery'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
