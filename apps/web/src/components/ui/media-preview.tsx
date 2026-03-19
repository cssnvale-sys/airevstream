'use client';

import { useState } from 'react';
import { usePresignedUrl } from '@/hooks/use-presigned-url';
import { cn } from '@/lib/utils';
import { ImageIcon, Film, Music, Loader2, AlertCircle } from 'lucide-react';

interface MediaPreviewProps {
  bucket: string;
  objectKey: string;
  type?: 'image' | 'video' | 'audio';
  className?: string;
  alt?: string;
}

export function MediaPreview({ bucket, objectKey, type = 'image', className, alt = 'Media preview' }: MediaPreviewProps) {
  const { url, isLoading, error } = usePresignedUrl(bucket, objectKey);
  const [imgError, setImgError] = useState(false);

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center bg-bg-tertiary rounded-lg animate-pulse', className)}>
        <Loader2 size={24} className="text-text-secondary animate-spin" />
      </div>
    );
  }

  if (error || !url || imgError) {
    const Icon = type === 'video' ? Film : type === 'audio' ? Music : ImageIcon;
    return (
      <div className={cn('flex flex-col items-center justify-center bg-bg-tertiary rounded-lg', className)}>
        <Icon size={32} className="text-text-secondary opacity-40" />
        {(error || imgError) && <AlertCircle size={14} className="text-accent-red mt-1" />}
      </div>
    );
  }

  if (type === 'video') {
    return (
      <video
        src={url}
        controls
        className={cn('rounded-lg bg-black', className)}
        preload="metadata"
      />
    );
  }

  if (type === 'audio') {
    return (
      <div className={cn('flex items-center gap-3 p-3 bg-bg-tertiary rounded-lg', className)}>
        <Music size={20} className="text-text-secondary shrink-0" />
        <audio src={url} controls className="flex-1" preload="metadata" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      onError={() => setImgError(true)}
      className={cn('rounded-lg object-cover', className)}
      loading="lazy"
    />
  );
}
