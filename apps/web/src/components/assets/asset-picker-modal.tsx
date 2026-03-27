'use client';

import { useState, useMemo } from 'react';
import { X, Search, User, ImageIcon } from 'lucide-react';
import { useAvatars, useSceneryAssets } from '@/hooks/use-assets';
import { usePresignedUrl } from '@/hooks/use-presigned-url';
import { useDebounce } from '@/hooks/use-debounce';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { BUCKETS } from '@airevstream/shared';
import { cn } from '@/lib/utils';

interface AssetPickerModalProps {
  open: boolean;
  onClose: () => void;
  type: 'avatar' | 'scenery';
  onSelect: (assetId: string) => void;
  excludeIds?: string[];
}

interface AvatarItem {
  id: string;
  name: string;
  images: Record<string, { bucket: string; key: string } | undefined>;
}

interface SceneryItem {
  id: string;
  name: string;
  category: string | null;
  imageUrl: string;
}

function AvatarPickerItem({ avatar, onSelect }: { avatar: AvatarItem; onSelect: (id: string) => void }) {
  const faceImage = avatar.images?.face;
  const { url: faceUrl } = usePresignedUrl(
    faceImage?.bucket ?? null,
    faceImage?.key ?? null,
  );

  return (
    <button
      type="button"
      onClick={() => onSelect(avatar.id)}
      className="card hover:border-accent-blue/30 transition-colors flex flex-col items-center gap-2 p-3 cursor-pointer"
    >
      <div className="w-14 h-14 rounded-full overflow-hidden bg-bg-tertiary flex items-center justify-center">
        {faceUrl ? (
          <img src={faceUrl} alt={avatar.name} className="w-full h-full object-cover" />
        ) : (
          <User size={24} className="text-text-tertiary" />
        )}
      </div>
      <span className="text-xs text-text-primary truncate w-full text-center" title={avatar.name}>{avatar.name}</span>
    </button>
  );
}

function SceneryPickerItem({ scenery, onSelect }: { scenery: SceneryItem; onSelect: (id: string) => void }) {
  const { url: imageUrl } = usePresignedUrl(BUCKETS.SCENERY, scenery.imageUrl);

  return (
    <button
      type="button"
      onClick={() => onSelect(scenery.id)}
      className="card hover:border-accent-blue/30 transition-colors flex flex-col gap-2 p-2 cursor-pointer"
    >
      <div className="w-full aspect-video rounded overflow-hidden bg-bg-tertiary flex items-center justify-center">
        {imageUrl ? (
          <img src={imageUrl} alt={scenery.name} className="w-full h-full object-cover" />
        ) : (
          <ImageIcon size={24} className="text-text-tertiary" />
        )}
      </div>
      <span className="text-xs text-text-primary truncate w-full" title={scenery.name}>{scenery.name}</span>
    </button>
  );
}

export function AssetPickerModal({ open, onClose, type, onSelect, excludeIds = [] }: AssetPickerModalProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const trapRef = useFocusTrap(open, { onEscape: onClose });

  const { data: avatarData } = useAvatars<AvatarItem[]>(type === 'avatar' ? 'limit=100' : undefined);
  const { data: sceneryData } = useSceneryAssets<SceneryItem[]>(type === 'scenery' ? 'limit=100' : undefined);

  const items = type === 'avatar'
    ? (avatarData?.data ?? [])
    : (sceneryData?.data ?? []);

  const filteredItems = useMemo(() => {
    const excludeSet = new Set(excludeIds);
    return (items as Array<{ id: string; name: string }>).filter((item) => {
      if (excludeSet.has(item.id)) return false;
      if (debouncedSearch && !item.name.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
      return true;
    });
  }, [items, excludeIds, debouncedSearch]);

  if (!open) return null;

  const title = type === 'avatar' ? 'Select Avatar' : 'Select Scenery';

  const handleSelect = (id: string) => {
    onSelect(id);
    setSearch('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="asset-picker-title"
    >
      <div
        ref={trapRef}
        className="card w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 id="asset-picker-title" className="text-h3 text-text-primary">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue/50 rounded"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input w-full pl-9 text-sm"
            placeholder={`Search ${type === 'avatar' ? 'avatars' : 'scenery'}...`}
          />
        </div>

        {/* Grid */}
        <div className="overflow-y-auto flex-1">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-text-secondary">
                {search ? 'No results found' : `No ${type === 'avatar' ? 'avatars' : 'scenery'} available`}
              </p>
            </div>
          ) : (
            <div className={cn(
              'grid gap-3',
              type === 'avatar' ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5' : 'grid-cols-2 sm:grid-cols-3',
            )}>
              {filteredItems.map((item) =>
                type === 'avatar' ? (
                  <AvatarPickerItem
                    key={item.id}
                    avatar={item as AvatarItem}
                    onSelect={handleSelect}
                  />
                ) : (
                  <SceneryPickerItem
                    key={item.id}
                    scenery={item as SceneryItem}
                    onSelect={handleSelect}
                  />
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
