'use client';

import { useState, useCallback } from 'react';
import { Plus, User, ImageIcon, Unlink } from 'lucide-react';
import { useChannelAssets, useBrandingPackage } from '@/hooks/use-assets';
import { usePresignedUrl } from '@/hooks/use-presigned-url';
import { apiPost, apiDelete } from '@/hooks/use-api';
import { toast } from '@/lib/toast';
import { AssetPickerModal } from '@/components/assets/asset-picker-modal';
import { BrandingEditor } from '@/components/assets/branding-editor';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { BUCKETS } from '@airevstream/shared';

interface ChannelAssetsTabProps {
  channelId: string;
}

interface ChannelAssetsData {
  avatars: Array<{
    id: string;
    avatarId: string;
    avatar: {
      id: string;
      name: string;
      images: Record<string, { bucket: string; key: string } | undefined>;
    };
  }>;
  scenery: Array<{
    id: string;
    sceneryId: string;
    scenery: {
      id: string;
      name: string;
      category: string | null;
      imageUrl: string;
    };
  }>;
}

interface BrandingData {
  id: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  colors: Record<string, string>;
  fonts: Record<string, string>;
}

// Sub-component for avatar thumbnail in the channel list
function ChannelAvatarItem({
  assignment,
  onRemove,
}: {
  assignment: ChannelAssetsData['avatars'][number];
  onRemove: (assignmentId: string) => void;
}) {
  const faceImage = assignment.avatar.images?.face;
  const { url: faceUrl } = usePresignedUrl(
    faceImage?.bucket ?? null,
    faceImage?.key ?? null,
  );

  return (
    <div className="card flex items-center gap-3 group">
      <div className="w-10 h-10 rounded-full overflow-hidden bg-bg-tertiary flex items-center justify-center shrink-0">
        {faceUrl ? (
          <img src={faceUrl} alt={assignment.avatar.name} className="w-full h-full object-cover" />
        ) : (
          <User size={18} className="text-text-tertiary" />
        )}
      </div>
      <span className="text-sm text-text-primary flex-1 truncate" title={assignment.avatar.name}>{assignment.avatar.name}</span>
      <button
        type="button"
        onClick={() => onRemove(assignment.id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-text-secondary hover:text-accent-red"
        aria-label={`Remove ${assignment.avatar.name}`}
      >
        <Unlink size={14} />
      </button>
    </div>
  );
}

// Sub-component for scenery thumbnail in the channel list
function ChannelSceneryItem({
  assignment,
  onRemove,
}: {
  assignment: ChannelAssetsData['scenery'][number];
  onRemove: (assignmentId: string) => void;
}) {
  const { url: imageUrl } = usePresignedUrl(BUCKETS.SCENERY, assignment.scenery.imageUrl);

  return (
    <div className="card flex items-center gap-3 group">
      <div className="w-12 h-8 rounded overflow-hidden bg-bg-tertiary flex items-center justify-center shrink-0">
        {imageUrl ? (
          <img src={imageUrl} alt={assignment.scenery.name} className="w-full h-full object-cover" />
        ) : (
          <ImageIcon size={14} className="text-text-tertiary" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-text-primary truncate block" title={assignment.scenery.name}>{assignment.scenery.name}</span>
        {assignment.scenery.category && (
          <span className="text-xs text-text-tertiary">{assignment.scenery.category}</span>
        )}
      </div>
      <button
        type="button"
        onClick={() => onRemove(assignment.id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-text-secondary hover:text-accent-red"
        aria-label={`Remove ${assignment.scenery.name}`}
      >
        <Unlink size={14} />
      </button>
    </div>
  );
}

export function ChannelAssetsTab({ channelId }: ChannelAssetsTabProps) {
  const { data: assetsData, mutate: mutateAssets } = useChannelAssets<ChannelAssetsData>(channelId);
  const { data: brandingData, mutate: mutateBranding } = useBrandingPackage<BrandingData>(channelId);

  const [pickerType, setPickerType] = useState<'avatar' | 'scenery' | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ type: 'avatar' | 'scenery'; id: string; name: string } | null>(null);
  const [removing, setRemoving] = useState(false);

  const assets = assetsData?.data ?? null;
  const branding = brandingData?.data ?? null;

  const existingAvatarIds = (assets?.avatars ?? []).map((a) => a.avatarId);
  const existingSceneryIds = (assets?.scenery ?? []).map((s) => s.sceneryId);

  const handleAssignAvatar = useCallback(async (avatarId: string) => {
    try {
      await apiPost(`/channels/${channelId}/avatars`, { avatarId });
      toast.success('Character assigned');
      mutateAssets();
    } catch (err) {
      console.error('Failed to assign avatar:', err);
      toast.error('Failed to assign character');
    }
  }, [channelId, mutateAssets]);

  const handleAssignScenery = useCallback(async (sceneryId: string) => {
    try {
      await apiPost(`/channels/${channelId}/scenery`, { sceneryId });
      toast.success('Background assigned');
      mutateAssets();
    } catch (err) {
      console.error('Failed to assign scenery:', err);
      toast.error('Failed to assign background');
    }
  }, [channelId, mutateAssets]);

  const handlePickerSelect = useCallback((assetId: string) => {
    if (pickerType === 'avatar') {
      handleAssignAvatar(assetId);
    } else if (pickerType === 'scenery') {
      handleAssignScenery(assetId);
    }
    setPickerType(null);
  }, [pickerType, handleAssignAvatar, handleAssignScenery]);

  const handleRemoveConfirm = useCallback(async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      if (removeTarget.type === 'avatar') {
        // Avatar assignments use channelId_avatarId composite key — no individual DELETE route exists.
        // Use the avatars POST pattern or a dedicated unassign endpoint.
        // For now, use the avatars endpoint with the avatar ID as query param.
        await apiDelete(`/channels/${channelId}/avatars?avatarId=${removeTarget.id}`);
      } else {
        // Scenery DELETE expects sceneryId as query parameter, not path segment
        await apiDelete(`/channels/${channelId}/scenery?sceneryId=${removeTarget.id}`);
      }
      toast.success(`${removeTarget.type === 'avatar' ? 'Character' : 'Background'} removed`);
      mutateAssets();
    } catch (err) {
      console.error('Failed to remove asset assignment:', err);
      toast.error('Failed to remove assignment');
    } finally {
      setRemoving(false);
      setRemoveTarget(null);
    }
  }, [removeTarget, channelId, mutateAssets]);

  return (
    <div className="space-y-8">
      {/* Characters Section */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-primary">Characters</h3>
          <button
            type="button"
            onClick={() => setPickerType('avatar')}
            className="flex items-center gap-1.5 text-xs text-accent-blue hover:text-accent-blue/80 transition-colors"
          >
            <Plus size={14} />
            Add Character
          </button>
        </div>
        {!assets?.avatars?.length ? (
          <p className="text-sm text-text-tertiary py-4">No characters assigned to this channel.</p>
        ) : (
          <div className="space-y-2">
            {assets.avatars.map((assignment) => (
              <ChannelAvatarItem
                key={assignment.id}
                assignment={assignment}
                onRemove={(id) => setRemoveTarget({
                  type: 'avatar',
                  id,
                  name: assignment.avatar.name,
                })}
              />
            ))}
          </div>
        )}
      </section>

      {/* Backgrounds Section */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-primary">Backgrounds</h3>
          <button
            type="button"
            onClick={() => setPickerType('scenery')}
            className="flex items-center gap-1.5 text-xs text-accent-blue hover:text-accent-blue/80 transition-colors"
          >
            <Plus size={14} />
            Add Background
          </button>
        </div>
        {!assets?.scenery?.length ? (
          <p className="text-sm text-text-tertiary py-4">No backgrounds assigned to this channel.</p>
        ) : (
          <div className="space-y-2">
            {assets.scenery.map((assignment) => (
              <ChannelSceneryItem
                key={assignment.id}
                assignment={assignment}
                onRemove={(id) => setRemoveTarget({
                  type: 'scenery',
                  id,
                  name: assignment.scenery.name,
                })}
              />
            ))}
          </div>
        )}
      </section>

      {/* Branding Section */}
      <section>
        <h3 className="text-sm font-semibold text-text-primary mb-3">Branding</h3>
        <BrandingEditor
          channelId={channelId}
          branding={branding}
          onUpdated={() => mutateBranding()}
        />
      </section>

      {/* Asset Picker Modal */}
      {pickerType && (
        <AssetPickerModal
          open={true}
          onClose={() => setPickerType(null)}
          type={pickerType}
          onSelect={handlePickerSelect}
          excludeIds={pickerType === 'avatar' ? existingAvatarIds : existingSceneryIds}
        />
      )}

      {/* Remove Confirmation */}
      <ConfirmDialog
        open={!!removeTarget}
        title={`Remove ${removeTarget?.type === 'avatar' ? 'Character' : 'Background'}`}
        message={`Remove "${removeTarget?.name ?? ''}" from this channel? The asset itself will not be deleted.`}
        confirmLabel="Remove"
        variant="warning"
        onConfirm={handleRemoveConfirm}
        onCancel={() => setRemoveTarget(null)}
        loading={removing}
      />
    </div>
  );
}
