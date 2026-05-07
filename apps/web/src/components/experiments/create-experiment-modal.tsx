'use client';

import { useState } from 'react';
import { z } from 'zod';
import { apiPost } from '@/hooks/use-api';
import { useForm } from '@/hooks/use-form';
import { nameSchema, descriptionSchema } from '@/lib/form-validation';
import { toast } from '@/lib/toast';
import { X, Plus, Trash2 } from 'lucide-react';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { LoadingButton } from '@/components/ui/loading-button';

interface CreateExperimentModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const METRIC_OPTIONS = [
  { value: 'views', label: 'Views' },
  { value: 'engagement', label: 'Engagement Rate' },
  { value: 'retention', label: 'Retention' },
  { value: 'clickRate', label: 'Click Rate' },
  { value: 'viralScore', label: 'Viral Score' },
];

const experimentCreateSchema = z.object({
  name: nameSchema,
  hypothesis: descriptionSchema,
  primaryMetric: z.string().min(1, 'Primary metric is required'),
  confidenceLevel: z.number().min(0.8).max(0.99),
  minSampleSize: z.number().int().min(10).max(100000),
});

type ExperimentCreateFormData = z.infer<typeof experimentCreateSchema>;

const INITIAL_VARIANTS = () => [
  { id: crypto.randomUUID(), label: 'Control', trafficPercent: 50 },
  { id: crypto.randomUUID(), label: 'Variant B', trafficPercent: 50 },
];

export function CreateExperimentModal({ open, onClose, onCreated }: CreateExperimentModalProps) {
  const [variants, setVariants] = useState(INITIAL_VARIANTS);

  const form = useForm<ExperimentCreateFormData>({
    schema: experimentCreateSchema,
    initialValues: {
      name: '',
      hypothesis: '',
      primaryMetric: 'engagement',
      confidenceLevel: 0.95,
      minSampleSize: 100,
    },
    onSubmit: async (values) => {
      if (variants.length < 2) {
        toast.error('At least 2 variants required');
        return;
      }
      const totalTraffic = variants.reduce((sum, v) => sum + v.trafficPercent, 0);
      if (totalTraffic !== 100) {
        toast.error(`Traffic must sum to 100% (currently ${totalTraffic}%)`);
        return;
      }

      await apiPost('/experiments', {
        name: values.name.trim(),
        hypothesis: values.hypothesis?.trim() || undefined,
        primaryMetric: values.primaryMetric,
        confidenceLevel: values.confidenceLevel,
        minSampleSize: values.minSampleSize,
        variants,
      });

      toast.success('Experiment created');
      setVariants(INITIAL_VARIANTS());
      onCreated();
    },
    errorMessage: 'Failed to create experiment',
    resetOnSuccess: true,
  });

  const trapRef = useFocusTrap(open, { onEscape: onClose, disabled: form.state.isSubmitting });

  const addVariant = () => {
    if (variants.length >= 10) return;
    const count = variants.length + 1;
    const evenSplit = Math.floor(100 / count);
    const remainder = 100 - evenSplit * count;
    const updated = Array.from({ length: count }, (_, i) => ({
      id: i < variants.length ? variants[i].id : crypto.randomUUID(),
      label: i < variants.length ? variants[i].label : `Variant ${String.fromCharCode(65 + i)}`,
      trafficPercent: evenSplit + (i < remainder ? 1 : 0),
    }));
    setVariants(updated);
  };

  const removeVariant = (index: number) => {
    if (variants.length <= 2) return;
    const updated = variants.filter((_, i) => i !== index);
    const count = updated.length;
    const evenSplit = Math.floor(100 / count);
    const remainder = 100 - evenSplit * count;
    setVariants(updated.map((v, i) => ({
      ...v,
      trafficPercent: evenSplit + (i < remainder ? 1 : 0),
    })));
  };

  const updateVariantLabel = (index: number, label: string) => {
    setVariants(prev => prev.map((v, i) => i === index ? { ...v, label } : v));
  };

  const updateVariantTraffic = (index: number, trafficPercent: number) => {
    setVariants(prev => prev.map((v, i) => i === index ? { ...v, trafficPercent } : v));
  };

  const totalTraffic = variants.reduce((sum, v) => sum + v.trafficPercent, 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="create-experiment-modal-title">
      <div className="absolute inset-0 bg-black/60" onClick={() => !form.state.isSubmitting && onClose()} aria-hidden="true" />
      <div ref={trapRef} className="relative w-full max-w-lg">
        <form noValidate onSubmit={form.handleSubmit} className="bg-bg-secondary border border-border rounded-lg shadow-xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 id="create-experiment-modal-title" className="text-lg font-semibold text-text-primary">New Experiment</h2>
            <button type="button" onClick={onClose} className="p-1 rounded hover:bg-bg-tertiary text-text-secondary" aria-label="Close">
              <X size={18} />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Name */}
            <div>
              <label htmlFor="experiment-name" className="block text-sm text-text-secondary mb-1">Name</label>
              <input
                id="experiment-name"
                type="text"
                value={form.getValue('name') || ''}
                onChange={form.handleTextChange('name')}
                onBlur={() => form.touch('name')}
                placeholder="e.g. Hook style comparison"
                className="input w-full"
              />
              {form.getError('name') && (
                <p className="text-sm text-accent-red mt-1">{form.getError('name')}</p>
              )}
            </div>

            {/* Hypothesis */}
            <div>
              <label htmlFor="experiment-hypothesis" className="block text-sm text-text-secondary mb-1">Hypothesis</label>
              <textarea
                id="experiment-hypothesis"
                value={form.getValue('hypothesis') || ''}
                onChange={form.handleTextChange('hypothesis')}
                onBlur={() => form.touch('hypothesis')}
                placeholder="e.g. Question hooks will increase engagement by 20%"
                rows={2}
                className="input w-full resize-none"
              />
              {form.getError('hypothesis') && (
                <p className="text-sm text-accent-red mt-1">{form.getError('hypothesis')}</p>
              )}
            </div>

            {/* Primary Metric */}
            <div>
              <label htmlFor="experiment-primary-metric" className="block text-sm text-text-secondary mb-1">Primary Metric</label>
              <select
                id="experiment-primary-metric"
                value={form.getValue('primaryMetric') || 'engagement'}
                onChange={(e) => form.setValue('primaryMetric', e.target.value)}
                className="input w-full"
              >
                {METRIC_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Confidence Level */}
            <div>
              <label htmlFor="experiment-confidence-level" className="block text-sm text-text-secondary mb-1">
                Confidence Level: {((form.getValue('confidenceLevel') ?? 0.95) * 100).toFixed(0)}%
              </label>
              <input
                id="experiment-confidence-level"
                type="range"
                min={0.80}
                max={0.99}
                step={0.01}
                value={form.getValue('confidenceLevel') ?? 0.95}
                onChange={(e) => form.setValue('confidenceLevel', Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-caption text-text-tertiary">
                <span>80%</span>
                <span>99%</span>
              </div>
            </div>

            {/* Min Sample Size */}
            <div>
              <label htmlFor="experiment-min-sample-size" className="block text-sm text-text-secondary mb-1">Min Sample Size per Variant</label>
              <input
                id="experiment-min-sample-size"
                type="number"
                min={10}
                max={100000}
                value={form.getValue('minSampleSize') ?? 100}
                onChange={(e) => form.setValue('minSampleSize', Number(e.target.value))}
                className="input w-full"
              />
            </div>

            {/* Variants */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-text-secondary">
                  Variants ({variants.length})
                  {totalTraffic !== 100 && (
                    <span className="text-accent-red ml-2">Traffic: {totalTraffic}% (must be 100%)</span>
                  )}
                </label>
                <button
                  type="button"
                  onClick={addVariant}
                  disabled={variants.length >= 10}
                  className="text-accent-blue hover:text-accent-blue/80 text-sm flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus size={14} />
                  Add
                </button>
              </div>
              <div className="space-y-2">
                {variants.map((v, i) => (
                  <div key={v.id} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={v.label}
                      onChange={(e) => updateVariantLabel(i, e.target.value)}
                      className="input flex-1"
                      placeholder="Variant label"
                      aria-label={`Variant ${i + 1} label`}
                    />
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={v.trafficPercent}
                      onChange={(e) => updateVariantTraffic(i, Number(e.target.value))}
                      className="input w-20 text-center"
                      aria-label={`Variant ${i + 1} traffic weight`}
                    />
                    <span className="text-text-tertiary text-sm">%</span>
                    <button
                      type="button"
                      onClick={() => removeVariant(i)}
                      disabled={variants.length <= 2}
                      className="p-1 text-text-secondary hover:text-accent-red disabled:opacity-30"
                      aria-label="Remove variant"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <LoadingButton
              type="submit"
              loading={form.state.isSubmitting}
              disabled={!form.getValue('name')?.trim() || totalTraffic !== 100}
              loadingText="Creating..."
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Experiment
            </LoadingButton>
          </div>
        </form>
      </div>
    </div>
  );
}
