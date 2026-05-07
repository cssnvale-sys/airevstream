'use client';

import { useState } from 'react';
import { z } from 'zod';
import { X } from 'lucide-react';
import { useForm } from '@/hooks/use-form';
import { apiPost } from '@/hooks/use-api';
import { toast } from '@/lib/toast';
import { useApi } from '@/hooks/use-api';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { LoadingButton } from '@/components/ui/loading-button';
import { nameSchema, descriptionSchema, uuidSchema } from '@/lib/form-validation';
import { cn } from '@/lib/utils';

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

// Schema for series creation form
const seriesCreateSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
  channelId: uuidSchema,
  targetAudience: z.string().max(200, 'Target audience must be less than 200 characters').optional(),
  tags: z.string().optional(),
});

type SeriesCreateFormData = z.infer<typeof seriesCreateSchema>;

export function CreateSeriesModal({ open, onClose, onCreated, defaultChannelId }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const trapRef = useFocusTrap(open, { onEscape: onClose, disabled: submitting });

  const { data: channelsData } = useApi<ChannelOption[]>('/channels?limit=100');
  const channels = channelsData?.data ?? [];

  const form = useForm<SeriesCreateFormData>({
    schema: seriesCreateSchema,
    initialValues: {
      name: '',
      description: '',
      channelId: defaultChannelId ?? '',
      targetAudience: '',
      tags: '',
    },
    onSubmit: async (values) => {
      setSubmitting(true);
      try {
        const res = await apiPost<{ success: boolean; data: { id: string } }>('/series', {
          channelId: values.channelId,
          name: values.name.trim(),
          description: values.description?.trim() || null,
          targetAudience: values.targetAudience?.trim() || null,
          tags: values.tags ? values.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        });
        toast.success('Series created');
        onCreated(res.data?.id);
        onClose();
      } catch (err) {
        console.error('Failed to create series:', err);
        toast.error('Failed to create series');
      } finally {
        setSubmitting(false);
      }
    },
    successMessage: 'Series created',
    errorMessage: 'Failed to create series',
    resetOnSuccess: true,
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="create-series-modal-title">
      <div className="absolute inset-0 bg-black/60" onClick={() => !submitting && onClose()} aria-hidden="true" />
      <div ref={trapRef} className="relative bg-bg-secondary border border-border rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 id="create-series-modal-title" className="text-card-title text-text-primary">Create Series</h2>
          <button type="button" onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue/50 rounded" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <form noValidate onSubmit={form.handleSubmit} className="p-4 space-y-4">
          <div>
            <label htmlFor="series-channel" className="block text-sm font-medium text-text-primary mb-1">Channel</label>
            <select
              id="series-channel"
              value={form.state.values.channelId ?? ''}
              onChange={(e) => form.setValue('channelId', e.target.value)}
              onBlur={() => form.touch('channelId')}
              className={cn('input w-full', form.getError('channelId') && 'border-accent-red')}
            >
              <option value="">Select a channel...</option>
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>{ch.name}</option>
              ))}
            </select>
            {form.getError('channelId') && (
              <p className="text-accent-red text-xs mt-1">{form.getError('channelId')}</p>
            )}
          </div>
          <div>
            <label htmlFor="series-name" className="block text-sm font-medium text-text-primary mb-1">Name</label>
            <input
              id="series-name"
              type="text"
              value={form.state.values.name ?? ''}
              onChange={form.handleTextChange('name')}
              onBlur={() => form.touch('name')}
              className={cn('input w-full', form.getError('name') && 'border-accent-red')}
              placeholder="e.g., Ancient Rome"
            />
            {form.getError('name') && (
              <p className="text-accent-red text-xs mt-1">{form.getError('name')}</p>
            )}
          </div>
          <div>
            <label htmlFor="series-description" className="block text-sm font-medium text-text-primary mb-1">Description</label>
            <textarea
              id="series-description"
              value={form.state.values.description ?? ''}
              onChange={form.handleTextChange('description')}
              className="input w-full"
              rows={2}
              placeholder="What is this series about?"
            />
          </div>
          <div>
            <label htmlFor="series-target-audience" className="block text-sm font-medium text-text-primary mb-1">Target Audience</label>
            <input
              id="series-target-audience"
              type="text"
              value={form.state.values.targetAudience ?? ''}
              onChange={form.handleTextChange('targetAudience')}
              onBlur={() => form.touch('targetAudience')}
              className={cn('input w-full', form.getError('targetAudience') && 'border-accent-red')}
              placeholder="e.g., History enthusiasts, ages 18-35"
            />
            {form.getError('targetAudience') && (
              <p className="text-accent-red text-xs mt-1">{form.getError('targetAudience')}</p>
            )}
          </div>
          <div>
            <label htmlFor="series-tags" className="block text-sm font-medium text-text-primary mb-1">Tags (comma separated)</label>
            <input
              id="series-tags"
              type="text"
              value={form.state.values.tags ?? ''}
              onChange={form.handleTextChange('tags')}
              className="input w-full"
              placeholder="e.g., history, ancient, rome"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <LoadingButton type="submit" loading={submitting} disabled={!form.state.values.channelId || !form.state.values.name?.trim()} loadingText="Creating..." className="btn-primary">
              Create Series
            </LoadingButton>
          </div>
        </form>
      </div>
    </div>
  );
}
