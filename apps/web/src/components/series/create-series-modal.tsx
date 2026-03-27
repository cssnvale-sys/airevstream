'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { apiPost } from '@/hooks/use-api';
import { toast } from 'sonner';
import { useApi } from '@/hooks/use-api';
import { LoadingButton } from '@/components/ui/loading-button';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (id?: string) => void;
  defaultChannelId?: string;
}

interface ChannelOption {
  id: string;
  name: string;
}

export function CreateSeriesModal({ open, onClose, onCreated, defaultChannelId }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [channelId, setChannelId] = useState(defaultChannelId ?? '');
  const [targetAudience, setTargetAudience] = useState('');
  const [tags, setTags] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, submitting, onClose]);

  const { data: channelsData } = useApi<ChannelOption[]>('/channels?limit=100');
  const channels = channelsData?.data ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelId || !name.trim()) return;

    setSubmitting(true);
    try {
      const res = await apiPost<{ success: boolean; data: { id: string } }>('/series', {
        channelId,
        name: name.trim(),
        description: description.trim() || null,
        targetAudience: targetAudience.trim() || null,
        tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      });
      toast.success('Series created');
      onCreated(res.data?.id);
      onClose();
      setName('');
      setDescription('');
      setTargetAudience('');
      setTags('');
    } catch (err) {
      console.error('Failed to create series:', err);
      toast.error('Failed to create series');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={() => !submitting && onClose()} />
      <div className="relative bg-bg-secondary border border-border rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-card-title text-text-primary">Create Series</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={18} />
          </button>
        </div>
        <form noValidate onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Channel</label>
            <select
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              className="input-field w-full"
              required
            >
              <option value="">Select a channel...</option>
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>{ch.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field w-full"
              placeholder="e.g., Ancient Rome"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field w-full"
              rows={2}
              placeholder="What is this series about?"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Target Audience</label>
            <input
              type="text"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              className="input-field w-full"
              placeholder="e.g., History enthusiasts, ages 18-35"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Tags (comma separated)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="input-field w-full"
              placeholder="e.g., history, ancient, rome"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <LoadingButton type="submit" loading={submitting} disabled={!channelId || !name.trim()} loadingText="Creating..." className="btn-primary">
              Create Series
            </LoadingButton>
          </div>
        </form>
      </div>
    </div>
  );
}
