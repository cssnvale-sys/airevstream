'use client';

import { Layers, Film } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface SeriesCardData {
  id: string;
  name: string;
  description: string | null;
  status: string;
  tags: string[];
  _count: { episodes: number };
}

interface Props {
  series: SeriesCardData;
}

const STATUS_DOT: Record<string, string> = {
  draft: 'bg-text-secondary',
  active: 'bg-accent-green',
  archived: 'bg-accent-orange',
};

export function SeriesCard({ series }: Props) {
  return (
    <Link href={`/series/${series.id}`} className="card hover:border-accent-blue/30 transition-colors block">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-accent-purple/10 flex items-center justify-center shrink-0">
          <Layers size={20} className="text-accent-purple" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-text-primary truncate" title={series.name}>{series.name}</h4>
            <div className={cn('w-2 h-2 rounded-full shrink-0', STATUS_DOT[series.status] ?? STATUS_DOT.draft)} aria-hidden="true" />
            <span className="sr-only">{series.status}</span>
          </div>
          {series.description && (
            <p className="text-xs text-text-secondary truncate mt-0.5" title={series.description ?? undefined}>{series.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-text-secondary flex items-center gap-1">
              <Film size={12} />
              {series._count.episodes} episodes
            </span>
            {(series.tags ?? []).slice(0, 2).map((tag) => (
              <span key={tag} className="px-1.5 py-0.5 rounded bg-bg-tertiary text-xs text-text-secondary">{tag}</span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}
