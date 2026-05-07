'use client';

import { z } from 'zod';
import { X } from 'lucide-react';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { LoadingButton } from '@/components/ui/loading-button';
import { useForm } from '@/hooks/use-form';
import { nameSchema } from '@/lib/form-validation';

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

const cohortSchema = z.object({
  name: nameSchema,
  platforms: z.array(z.string()).min(1, 'Select at least one platform'),
});

type CohortFormData = z.infer<typeof cohortSchema>;

export function CreateCohortModal({ open, onClose, onSubmit }: CreateCohortModalProps) {
  const form = useForm<CohortFormData>({
    schema: cohortSchema,
    initialValues: { name: '', platforms: [] },
    onSubmit: async (values) => {
      await onSubmit({ name: values.name.trim(), platforms: values.platforms });
      form.reset();
      onClose();
    },
    resetOnSuccess: true,
  });

  const trapRef = useFocusTrap(open, { onEscape: onClose, disabled: form.state.isSubmitting });

  if (!open) return null;

  const togglePlatform = (p: string) => {
    const current = (form.getValue('platforms') as string[]) ?? [];
    const next = current.includes(p) ? current.filter((x) => x !== p) : [...current, p];
    form.setValue('platforms', next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true" aria-labelledby="create-cohort-modal-title">
      <div ref={trapRef} className="bg-bg-secondary border border-border rounded-lg w-full max-w-md p-6">
        <h2 id="create-cohort-modal-title" className="text-h3 text-text-primary mb-4">New Seasoning Cohort</h2>
        <form noValidate onSubmit={form.handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="cohort-name" className="block text-body text-text-secondary mb-1">
              Cohort Name
            </label>
            <input
              id="cohort-name"
              type="text"
              value={form.getValue('name') ?? ''}
              onChange={form.handleTextChange('name')}
              className="input w-full"
              placeholder="e.g. Batch 1 - Gaming Channels"
              required
            />
            {form.isTouched('name') && form.getError('name') && (
              <p className="text-caption text-error mt-1">{form.getError('name')}</p>
            )}
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
                    (form.getValue('platforms') as string[] ?? []).includes(p.value)
                      ? 'bg-accent-blue/20 border-accent-blue text-accent-blue'
                      : 'bg-bg-tertiary border-border text-text-secondary hover:border-text-secondary'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {form.isTouched('platforms') && form.getError('platforms') && (
              <p className="text-caption text-error mt-1">{form.getError('platforms')}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              Cancel
            </button>
            <LoadingButton
              type="submit"
              loading={form.state.isSubmitting}
              disabled={!form.state.isValid}
              loadingText="Creating..."
              className="btn-primary"
            >
              Create Cohort
            </LoadingButton>
          </div>
        </form>
      </div>
    </div>
  );
}
