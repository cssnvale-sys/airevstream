'use client';

import { useState } from 'react';
import { X, Search } from 'lucide-react';
import { apiPost, useApi } from '@/hooks/use-api';
import { useDebounce } from '@/hooks/use-debounce';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { toast } from '@/lib/toast';
import { LoadingButton } from '@/components/ui/loading-button';

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
  const debouncedSearch = useDebounce(search, 300);
  const [title, setTitle] = useState('');
  const [selectedContentId, setSelectedContentId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const trapRef = useFocusTrap(open, { onEscape: onClose, disabled: submitting });

  const { data: contentData } = useApi<ContentOption[]>(
    open ? `/content?limit=50${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ''}` : null,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={() => !submitting && onClose()} aria-hidden="true" />
      <div ref={trapRef} className="relative bg-bg-secondary border border-border rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-card-title text-text-primary">Add Episode</h2>
          <button type="button" onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <form noValidate onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label htmlFor="episode-search" className="block text-sm font-medium text-text-primary mb-1">Search Content</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                id="episode-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input w-full pl-9"
                placeholder="Search by title..."
              />
            </div>
          </div>
          <div>
            <label htmlFor="episode-content-select" className="block text-sm font-medium text-text-primary mb-1">Select Content</label>
            <select
              id="episode-content-select"
              value={selectedContentId}
              onChange={(e) => setSelectedContentId(e.target.value)}
              className="input w-full"
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
            <label htmlFor="episode-title" className="block text-sm font-medium text-text-primary mb-1">Episode Title (optional)</label>
            <input
              id="episode-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input w-full"
              placeholder="Override title for this episode"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <LoadingButton type="submit" loading={submitting} disabled={!selectedContentId} loadingText="Adding..." className="btn-primary">
              Add Episode
            </LoadingButton>
          </div>
        </form>
      </div>
    </div>
  );
}
