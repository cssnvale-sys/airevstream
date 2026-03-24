'use client';

import { useState, useCallback } from 'react';
import { apiPost } from '@/hooks/use-api';
import { formatCost } from '@airevstream/shared';

interface CostBreakdownItem {
  category: string;
  description: string;
  estimatedCost: number;
  unit: string;
  quantity: number;
}

interface CostEstimate {
  totalCost: number;
  breakdown: CostBreakdownItem[];
}

interface CostPreviewPanelProps {
  shots: Array<{ duration?: number; outputType?: string; generation?: { width?: number; height?: number } }>;
  qualityTier?: 'quick' | 'standard' | 'cinema';
  provider?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  text: 'bg-blue-500',
  image: 'bg-purple-500',
  video: 'bg-green-500',
  audio: 'bg-amber-500',
  upscale: 'bg-cyan-500',
};

export function CostPreviewPanel({ shots, qualityTier, provider }: CostPreviewPanelProps) {
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);
  const [budgetStatus, setBudgetStatus] = useState<{ remaining: number | null; status: string; exceeded: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchEstimate = useCallback(async () => {
    if (shots.length === 0) return;
    setLoading(true);
    try {
      const res = await apiPost<{
        success: boolean;
        data: {
          estimate: CostEstimate;
          budget: { remaining: number | null; status: string; exceeded: boolean };
        };
      }>('/pipeline/cost-preview', {
        shots,
        qualityTier: qualityTier ?? 'standard',
        provider: provider ?? 'comfyui',
      });
      if (res?.data?.estimate) {
        setEstimate(res.data.estimate);
        setBudgetStatus(res.data.budget);
      }
    } catch (err) {
      console.error('Cost preview estimate failed:', err);
    } finally {
      setLoading(false);
    }
  }, [shots, qualityTier, provider]);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-bg-tertiary border-b border-border flex items-center justify-between">
        <span className="text-sm font-medium text-text-primary">Cost Preview</span>
        <button
          onClick={fetchEstimate}
          disabled={loading || shots.length === 0}
          className="text-xs px-2 py-1 bg-accent-blue text-white rounded hover:bg-accent-blue/90 disabled:opacity-50"
        >
          {loading ? 'Estimating...' : 'Estimate'}
        </button>
      </div>

      <div className="p-3 space-y-3">
        {!estimate ? (
          <p className="text-xs text-text-tertiary text-center py-2">
            Click Estimate to preview pipeline costs
          </p>
        ) : (
          <>
            {/* Total */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Total</span>
              <span className="text-lg font-semibold text-text-primary">{formatCost(estimate.totalCost)}</span>
            </div>

            {/* Budget bar */}
            {budgetStatus?.remaining != null && (
              <div>
                <div className="flex justify-between text-xs text-text-tertiary mb-1">
                  <span>Budget</span>
                  <span>{formatCost(budgetStatus.remaining)} remaining</span>
                </div>
                <div className="w-full h-2 bg-bg-tertiary rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      budgetStatus.exceeded ? 'bg-red-500' : budgetStatus.status === 'warning' ? 'bg-amber-500' : 'bg-green-500'
                    }`}
                    style={{
                      width: `${Math.min(100, (estimate.totalCost / Math.max(0.01, budgetStatus.remaining)) * 100)}%`,
                    }}
                  />
                </div>
                {budgetStatus.exceeded && (
                  <p className="text-[10px] text-red-400 mt-1">Estimated cost exceeds remaining budget</p>
                )}
              </div>
            )}

            {/* Breakdown */}
            <div className="space-y-1.5">
              {estimate.breakdown.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div className={`w-2 h-2 rounded-full ${CATEGORY_COLORS[item.category] ?? 'bg-gray-500'}`} />
                  <span className="flex-1 text-text-secondary">{item.description}</span>
                  <span className="text-text-tertiary">{formatCost(item.estimatedCost)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
