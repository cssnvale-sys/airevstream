'use client';

import { cn } from '@/lib/utils';
import { QUALITY_THRESHOLDS } from '@airevstream/shared';

type QualityBadgeSize = 'sm' | 'md' | 'lg';

interface QualityBadgeProps {
  score: number | null;
  size?: QualityBadgeSize;
  className?: string;
}

function getQualityConfig(score: number | null) {
  if (score == null) return { label: 'Not Scored', color: 'text-text-secondary', bg: 'bg-bg-tertiary', border: 'border-border' };
  if (score >= QUALITY_THRESHOLDS.AUTO_APPROVE) return { label: 'Excellent', color: 'text-accent-green', bg: 'bg-accent-green/10', border: 'border-accent-green/30' };
  if (score >= QUALITY_THRESHOLDS.REVIEW_REQUIRED) return { label: 'Needs Review', color: 'text-accent-amber', bg: 'bg-accent-amber/10', border: 'border-accent-amber/30' };
  if (score >= QUALITY_THRESHOLDS.AUTO_REJECT) return { label: 'Low Quality', color: 'text-accent-red', bg: 'bg-accent-red/10', border: 'border-accent-red/30' };
  return { label: 'Rejected', color: 'text-red-600', bg: 'bg-red-600/10', border: 'border-red-600/30' };
}

const SIZE_CLASSES: Record<QualityBadgeSize, string> = {
  sm: 'text-xs px-1.5 py-0.5 gap-1',
  md: 'text-sm px-2 py-1 gap-1.5',
  lg: 'text-base px-3 py-1.5 gap-2',
};

export function QualityBadge({ score, size = 'sm', className }: QualityBadgeProps) {
  const config = getQualityConfig(score);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        config.bg,
        config.border,
        config.color,
        SIZE_CLASSES[size],
        className,
      )}
    >
      {score != null && <span className="font-bold">{Math.round(score)}</span>}
      <span>{config.label}</span>
    </span>
  );
}

export { getQualityConfig };
