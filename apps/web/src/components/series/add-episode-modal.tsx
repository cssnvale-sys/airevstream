'use client';

import { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { apiPost, useApi } from '@/hooks/use-api';
import { toast } from '@/lib/toast';

interface Props {
  open: boolean;
  onClose: () => void;
  seriesId: string;
  onAdded: () => void;
}

interface ContentOption {
  id: string;
  title: string | null;
  contentType: string;
  status: string;
}

export function AddEpisodeModal({ open, onClose, seriesId, onAdded }: Props) {
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [selectedContentId, setSelectedContentId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, submitting, onClose]);

  const { data: contentData } = useApi<ContentOption[]>(
    open ? `/content?limit=50${search ? `&search=${encodeURIComponent(search)}` : ''}` : null,
  );
  const contentItems = contentData?.data ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContentId) return;

    setSubmitting(true);
    try {
      await apiPost(`/series/${seriesId}/episodes`, {
        contentId: selectedContentId,
        title: title.trim() || null,
      });
      toast.success('Episode added');
      onAdded();
      onClose();
      setSelectedContentId('');
      setTitle('');
      setSearch('');
    } catch (err) {
      console.error('Failed to add episode:', err);
      toast.error('Failed to add episode');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={() => !submitting && onClose()} />
      <div className="relative bg-bg-secondary border border-border rounded-lg shadow-xl w-full max-w-lg mx-4" role="dialog" aria-modal="true">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-card-title text-text-primary">Add Episode</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Search Content</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field w-full pl-9"
                placeholder="Search by title..."
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Select Content</label>
            <select
              value={selectedContentId}
              onChange={(e) => setSelectedContentId(e.target.value)}
              className="input-field w-full"
              required
            >
              <option value="">Choose content...</option>
              {contentItems.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title || 'Untitled'} ({c.contentType} - {c.status})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Episode Title (optional)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field w-full"
              placeholder="Override title for this episode"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={submitting || !selectedContentId} className="btn-primary">
              {submitting ? 'Adding...' : 'Add Episode'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
