'use client';

import { useState } from 'react';
import { apiPost } from '@/hooks/use-api';
import { toast } from '@/lib/toast';
import { X, Plus, Trash2 } from 'lucide-react';

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

export function CreateExperimentModal({ open, onClose, onCreated }: CreateExperimentModalProps) {
  const [name, setName] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [primaryMetric, setPrimaryMetric] = useState('engagement');
  const [confidenceLevel, setConfidenceLevel] = useState(0.95);
  const [minSampleSize, setMinSampleSize] = useState(100);
  const [variants, setVariants] = useState([
    { label: 'Control', trafficPercent: 50 },
    { label: 'Variant B', trafficPercent: 50 },
  ]);
  const [submitting, setSubmitting] = useState(false);

  const addVariant = () => {
    if (variants.length >= 10) return;
    const count = variants.length + 1;
    const evenSplit = Math.floor(100 / count);
    const remainder = 100 - evenSplit * count;
    const updated = Array.from({ length: count }, (_, i) => ({
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

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    if (variants.length < 2) { toast.error('At least 2 variants required'); return; }
    if (totalTraffic !== 100) { toast.error(`Traffic must sum to 100% (currently ${totalTraffic}%)`); return; }

    setSubmitting(true);
    try {
      await apiPost('/api/v1/experiments', {
        name: name.trim(),
        hypothesis: hypothesis.trim() || undefined,
        primaryMetric,
        confidenceLevel,
        minSampleSize,
        variants,
      });
      toast.success('Experiment created');
      // Reset form
      setName('');
      setHypothesis('');
      setPrimaryMetric('engagement');
      setConfidenceLevel(0.95);
      setMinSampleSize(100);
      setVariants([
        { label: 'Control', trafficPercent: 50 },
        { label: 'Variant B', trafficPercent: 50 },
      ]);
      onCreated();
    } catch (err) {
      console.error('Failed to create experiment:', err);
      toast.error('Failed to create experiment');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-bg-secondary border border-border rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">New Experiment</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-bg-tertiary text-text-secondary">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm text-text-secondary mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hook style comparison"
              className="input w-full"
            />
          </div>

          {/* Hypothesis */}
          <div>
            <label className="block text-sm text-text-secondary mb-1">Hypothesis</label>
            <textarea
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              placeholder="e.g. Question hooks will increase engagement by 20%"
              rows={2}
              className="input w-full resize-none"
            />
          </div>

          {/* Primary Metric */}
          <div>
            <label className="block text-sm text-text-secondary mb-1">Primary Metric</label>
            <select value={primaryMetric} onChange={(e) => setPrimaryMetric(e.target.value)} className="input w-full">
              {METRIC_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Confidence Level */}
          <div>
            <label className="block text-sm text-text-secondary mb-1">
              Confidence Level: {(confidenceLevel * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min={0.80}
              max={0.99}
              step={0.01}
              value={confidenceLevel}
              onChange={(e) => setConfidenceLevel(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-caption text-text-tertiary">
              <span>80%</span>
              <span>99%</span>
            </div>
          </div>

          {/* Min Sample Size */}
          <div>
            <label className="block text-sm text-text-secondary mb-1">Min Sample Size per Variant</label>
            <input
              type="number"
              min={10}
              max={100000}
              value={minSampleSize}
              onChange={(e) => setMinSampleSize(Number(e.target.value))}
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
                onClick={addVariant}
                disabled={variants.length >= 10}
                className="text-accent-blue hover:text-accent-blue/80 text-sm flex items-center gap-1 disabled:opacity-50"
              >
                <Plus size={14} />
                Add
              </button>
            </div>
            <div className="space-y-2">
              {variants.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={v.label}
                    onChange={(e) => updateVariantLabel(i, e.target.value)}
                    className="input flex-1"
                    placeholder="Variant label"
                  />
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={v.trafficPercent}
                    onChange={(e) => updateVariantTraffic(i, Number(e.target.value))}
                    className="input w-20 text-center"
                  />
                  <span className="text-text-tertiary text-sm">%</span>
                  <button
                    onClick={() => removeVariant(i)}
                    disabled={variants.length <= 2}
                    className="p-1 text-text-secondary hover:text-accent-red disabled:opacity-30"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !name.trim() || totalTraffic !== 100}
            className="btn-primary disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Experiment'}
          </button>
        </div>
      </div>
    </div>
  );
}
