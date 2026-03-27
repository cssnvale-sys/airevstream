'use client';

import { use } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useExperiment } from '@/hooks/use-experiments';
import { apiPost } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { ArrowLeft, Play, Square, Trophy, FlaskConical, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { toast } from '@/lib/toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useState } from 'react';

interface VariantData {
  id: string;
  label: string;
  trafficPercent: number;
  impressions: number;
  clicks: number;
  engagementRate: number;
  completionRate: number;
  shareRate: number;
  viralScore: number | null;
  presetOverrides: Record<string, unknown>;
  content: { id: string; title: string | null; contentType: string; status: string } | null;
}

interface ExperimentData {
  id: string;
  name: string;
  hypothesis: string | null;
  status: string;
  primaryMetric: string;
  confidenceLevel: number;
  minSampleSize: number;
  significance: number | null;
  winnerId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  variants: VariantData[];
}

const STATUS_BADGES: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'bg-bg-tertiary', text: 'text-text-secondary' },
  running: { bg: 'bg-accent-green/10', text: 'text-accent-green' },
  evaluating: { bg: 'bg-accent-purple/10', text: 'text-accent-purple' },
  completed: { bg: 'bg-accent-blue/10', text: 'text-accent-blue' },
  stopped: { bg: 'bg-accent-orange/10', text: 'text-accent-orange' },
};

export default function ExperimentDetailPage({ params }: { params: Promise<{ experimentId: string }> }) {
  const { experimentId } = use(params);
  const { data: experimentData, isLoading, mutate } = useExperiment<ExperimentData>(experimentId);

  const exp = experimentData?.data;
  const [stopOpen, setStopOpen] = useState(false);

  const handleStart = async () => {
    try {
      await apiPost(`/experiments/${experimentId}/start`, {});
      toast.success('Experiment started');
      mutate();
    } catch (err) {
      console.error('Failed to start experiment:', err);
      toast.error('Failed to start experiment');
    }
  };

  const handleStop = async () => {
    try {
      await apiPost(`/experiments/${experimentId}/stop`, {});
      toast.success('Experiment stopped');
      mutate();
    } catch (err) {
      console.error('Failed to stop experiment:', err);
      toast.error('Failed to stop experiment');
    }
  };

  const handleEvaluate = async () => {
    try {
      await apiPost(`/experiments/${experimentId}/evaluate`, {});
      toast.success('Evaluation queued');
      mutate();
    } catch (err) {
      console.error('Failed to queue evaluation:', err);
      toast.error('Failed to queue evaluation');
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue" />
        </div>
      </AppLayout>
    );
  }

  if (!exp) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FlaskConical size={32} className="text-text-secondary mb-3" />
          <h2 className="text-lg font-medium text-text-primary">Experiment not found</h2>
          <Link href="/experiments" className="btn-secondary mt-4 inline-flex items-center gap-2">
            <ArrowLeft size={16} />
            Back to Experiments
          </Link>
        </div>
      </AppLayout>
    );
  }

  const badge = STATUS_BADGES[exp.status] ?? STATUS_BADGES.draft;
  const winnerVariant = exp.variants.find(v => v.id === exp.winnerId);
  const significanceThreshold = 1 - exp.confidenceLevel;
  const significanceProgress = exp.significance != null
    ? Math.min(100, ((1 - exp.significance) / (1 - significanceThreshold)) * 100)
    : 0;

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link href="/experiments" className="text-text-secondary hover:text-text-primary text-sm flex items-center gap-1 mb-2">
            <ArrowLeft size={14} />
            Experiments
          </Link>
          <h1 className="text-page-title text-text-primary">{exp.name}</h1>
          {exp.hypothesis && (
            <p className="text-text-secondary mt-1">{exp.hypothesis}</p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <span className={cn('px-2 py-0.5 rounded-full text-caption font-medium capitalize', badge.bg, badge.text)}>
              {exp.status}
            </span>
            <span className="text-caption text-text-tertiary">
              Metric: <span className="capitalize">{exp.primaryMetric}</span>
            </span>
            <span className="text-caption text-text-tertiary">
              Confidence: {(exp.confidenceLevel * 100).toFixed(0)}%
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {exp.status === 'draft' && (
            <button onClick={handleStart} className="btn-primary flex items-center gap-2">
              <Play size={16} />
              Start
            </button>
          )}
          {exp.status === 'running' && (
            <button onClick={handleEvaluate} className="btn-secondary flex items-center gap-2">
              <BarChart3 size={16} />
              Evaluate Now
            </button>
          )}
          {(exp.status === 'running' || exp.status === 'evaluating') && (
            <button onClick={() => setStopOpen(true)} className="btn-secondary flex items-center gap-2 text-accent-red hover:text-accent-red">
              <Square size={16} />
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Winner banner */}
      {winnerVariant && (
        <div className="mb-6 p-4 rounded-lg bg-accent-green/10 border border-accent-green/30">
          <div className="flex items-center gap-2">
            <Trophy size={20} className="text-accent-green" />
            <span className="text-accent-green font-semibold">Winner: {winnerVariant.label}</span>
            {exp.significance != null && (
              <span className="text-text-secondary text-sm ml-2">
                (p={exp.significance.toFixed(4)})
              </span>
            )}
          </div>
        </div>
      )}

      {/* Significance progress */}
      {exp.status === 'running' && !exp.winnerId && (
        <div className="mb-6 card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-text-secondary">Statistical Significance Progress</span>
            <span className="text-sm font-mono text-text-tertiary">
              {exp.significance != null ? `p=${exp.significance.toFixed(4)}` : 'Awaiting data'}
              {' '}/ target p&le;{significanceThreshold.toFixed(2)}
            </span>
          </div>
          <div className="w-full bg-bg-tertiary rounded-full h-2 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                significanceProgress >= 100 ? 'bg-accent-green' : 'bg-accent-blue',
              )}
              style={{ width: `${Math.max(2, significanceProgress)}%` }}
            />
          </div>
        </div>
      )}

      {/* Variant comparison cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {exp.variants.map((v) => {
          const isWinner = v.id === exp.winnerId;
          return (
            <div
              key={v.id}
              className={cn(
                'card relative',
                isWinner && 'ring-2 ring-accent-green',
              )}
            >
              {isWinner && (
                <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-accent-green flex items-center justify-center">
                  <Trophy size={12} className="text-white" />
                </div>
              )}
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-text-primary">{v.label}</h3>
                <span className="text-caption text-text-tertiary">{v.trafficPercent}% traffic</span>
              </div>

              {v.content && (
                <div className="mb-3 text-caption text-text-secondary">
                  Linked: <Link href={`/content/${v.content.id}`} className="text-accent-blue hover:underline">{v.content.title ?? 'Untitled'}</Link>
                </div>
              )}

              <div className="space-y-2">
                <MetricRow label="Impressions" value={v.impressions.toLocaleString()} />
                <MetricRow label="Clicks" value={v.clicks.toLocaleString()} />
                <MetricRow label="Engagement" value={`${(v.engagementRate * 100).toFixed(2)}%`} highlight={v.engagementRate > 0} />
                <MetricRow label="Completion" value={`${(v.completionRate * 100).toFixed(2)}%`} />
                <MetricRow label="Share Rate" value={`${(v.shareRate * 100).toFixed(2)}%`} />
                {v.viralScore != null && (
                  <MetricRow label="Viral Score" value={String(v.viralScore)} />
                )}
              </div>

              {/* Sample progress bar */}
              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex justify-between text-caption text-text-tertiary mb-1">
                  <span>Samples</span>
                  <span>{v.impressions} / {exp.minSampleSize}</span>
                </div>
                <div className="w-full bg-bg-tertiary rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-accent-blue h-full rounded-full"
                    style={{ width: `${Math.min(100, (v.impressions / exp.minSampleSize) * 100)}%` }}
                  />
                </div>
              </div>

              {Object.keys(v.presetOverrides).length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <span className="text-caption text-text-tertiary">Preset overrides:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.keys(v.presetOverrides).map(key => (
                      <span key={key} className="px-1.5 py-0.5 bg-bg-tertiary rounded text-caption text-text-secondary">
                        {key}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <ConfirmDialog
        open={stopOpen}
        title="Stop Experiment"
        message="This will stop the experiment and finalize results with current data. This cannot be resumed."
        confirmLabel="Stop Experiment"
        variant="danger"
        onConfirm={() => { setStopOpen(false); handleStop(); }}
        onCancel={() => setStopOpen(false)}
      />
    </AppLayout>
  );
}

function MetricRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className={cn('font-mono', highlight ? 'text-accent-green' : 'text-text-primary')}>{value}</span>
    </div>
  );
}
