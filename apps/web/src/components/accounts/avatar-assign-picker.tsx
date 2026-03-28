'use client';

import { useApi } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { Loader2, User } from 'lucide-react';

interface AvatarItem {
  id: string;
  name: string;
  images: Record<string, { bucket?: string; key?: string }>;
}

interface AvatarAssignPickerProps {
  selectedId: string | undefined;
  onChange: (avatarId: string | undefined) => void;
}

export function AvatarAssignPicker({ selectedId, onChange }: AvatarAssignPickerProps) {
  const { data, isLoading } = useApi<AvatarItem[]>('avatars?limit=20');
  const avatars = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (avatars.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500 text-sm">
        <User className="h-8 w-8 mx-auto mb-2" />
        <p>No avatars created yet</p>
        <p className="text-xs mt-1">Create avatars in the Assets section first</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {avatars.map((avatar) => (
        <button
          key={avatar.id}
          type="button"
          onClick={() => onChange(selectedId === avatar.id ? undefined : avatar.id)}
          className={cn(
            'rounded-lg border-2 p-3 text-center transition-all',
            selectedId === avatar.id
              ? 'border-accent-purple/50 bg-accent-purple/10'
              : 'border-zinc-700 hover:border-zinc-600',
          )}
        >
          <div className="w-12 h-12 rounded-full bg-zinc-800 mx-auto mb-2 flex items-center justify-center">
            <User className="h-6 w-6 text-zinc-500" />
          </div>
          <div className="text-xs font-medium text-zinc-300 truncate" title={avatar.name}>{avatar.name}</div>
        </button>
      ))}
    </div>
  );
}
