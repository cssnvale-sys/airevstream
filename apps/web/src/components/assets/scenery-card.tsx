'use client';

import { useState } from 'react';
import { ImageIcon, Trash2, Hash } from 'lucide-react';
import { usePresignedUrl } from '@/hooks/use-presigned-url';
import { BUCKETS } from '@airevstream/shared';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';

interface SceneryCardProps {
  scenery: {
    id: string;
    name: string;
    category: string | null;
    imageUrl: string;
    _count: { channelScenery: number };
  };
  onDelete?: (id: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  city: 'bg-accent-blue/10 text-accent-blue',
  nature: 'bg-accent-green/10 text-accent-green',
  studio: 'bg-accent-purple/10 text-accent-purple',
  fantasy: 'bg-accent-orange/10 text-accent-orange',
  interior: 'bg-accent-amber/10 text-accent-amber',
  abstract: 'bg-accent-purple/10 text-accent-purple',
};

export function SceneryCard({ scenery, onDelete }: SceneryCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { url: imageUrl, isLoading: imageLoading } = usePresignedUrl(
    BUCKETS.SCENERY,
    scenery.imageUrl,
  );

  const handleDelete = () => {
    if (!onDelete) return;
    setDeleting(true);
    onDelete(scenery.id);
    setDeleting(false);
    setConfirmOpen(false);
  };

  const categoryStyle = scenery.category
    ? CATEGORY_COLORS[scenery.category] ?? 'bg-bg-tertiary text-text-secondary'
    : null;

  return (
    <>
      <div className="card group relative">
        {/* Image preview */}
        <div
          className={cn(
            'w-full aspect-video rounded-md overflow-hidden bg-bg-tertiary flex items-center justify-center mb-3',
            imageLoading && 'animate-pulse',
          )}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={scenery.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <ImageIcon size={32} className="text-text-tertiary" />
          )}
        </div>

        {/* Name and category */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-medium text-text-primary truncate" title={scenery.name}>
              {scenery.name}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              {categoryStyle && (
                <span className={cn('text-xs px-2 py-0.5 rounded-full', categoryStyle)}>
                  {scenery.category}
                </span>
              )}
              <span className="flex items-center gap-1 text-xs text-text-secondary">
                <Hash size={12} />
                {scenery._count.channelScenery} channel{scenery._count.channelScenery !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Delete button */}
          {onDelete && (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md text-text-secondary hover:text-accent-red hover:bg-accent-red/10"
              aria-label={`Delete ${scenery.name}`}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Delete Scenery"
        message={`Are you sure you want to delete "${scenery.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
        isLoading={deleting}
      />
    </>
  );
}
