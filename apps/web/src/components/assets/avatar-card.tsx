'use client';

import Link from 'next/link';
import { User, Users, Layers } from 'lucide-react';
import { usePresignedUrl } from '@/hooks/use-presigned-url';
import { cn } from '@/lib/utils';

interface AvatarCardProps {
  avatar: {
    id: string;
    name: string;
    images: Record<string, { bucket: string; key: string } | undefined>;
    _count: { channelAvatars: number; seriesAvatars: number };
  };
}

export function AvatarCard({ avatar }: AvatarCardProps) {
  const faceImage = avatar.images?.face;
  const { url: faceUrl, isLoading: faceLoading } = usePresignedUrl(
    faceImage?.bucket ?? null,
    faceImage?.key ?? null,
  );

  return (
    <Link
      href={`/assets/${avatar.id}`}
      className="card hover:border-accent-blue/30 transition-colors block"
    >
      <div className="flex flex-col items-center gap-3">
        {/* Avatar image or placeholder */}
        <div
          className={cn(
            'w-20 h-20 rounded-full overflow-hidden bg-bg-tertiary flex items-center justify-center shrink-0',
            faceLoading && 'animate-pulse',
          )}
        >
          {faceUrl ? (
            <img
              src={faceUrl}
              alt={avatar.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <User size={32} className="text-text-tertiary" />
          )}
        </div>

        {/* Name */}
        <h4 className="text-sm font-medium text-text-primary truncate w-full text-center" title={avatar.name}>
          {avatar.name}
        </h4>

        {/* Count badges */}
        <div className="flex items-center gap-2">
          {avatar._count.channelAvatars > 0 && (
            <span className="flex items-center gap-1 text-xs text-text-secondary bg-bg-tertiary px-2 py-0.5 rounded-full">
              <Users size={12} />
              {avatar._count.channelAvatars}
            </span>
          )}
          {avatar._count.seriesAvatars > 0 && (
            <span className="flex items-center gap-1 text-xs text-text-secondary bg-bg-tertiary px-2 py-0.5 rounded-full">
              <Layers size={12} />
              {avatar._count.seriesAvatars}
            </span>
          )}
          {avatar._count.channelAvatars === 0 && avatar._count.seriesAvatars === 0 && (
            <span className="text-xs text-text-tertiary">No assignments</span>
          )}
        </div>
      </div>
    </Link>
  );
}
