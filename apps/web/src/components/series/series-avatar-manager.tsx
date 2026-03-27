'use client';

import { useState } from 'react';
import { Plus, Trash2, Star, UserCircle } from 'lucide-react';
import { apiPost, apiDelete, useApi } from '@/hooks/use-api';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { LoadingButton } from '@/components/ui/loading-button';

interface SeriesAvatarEntry {
  seriesId: string;
  avatarId: string;
  isPrimary: boolean;
  role: string | null;
  avatar: { id: string; name: string; images: Record<string, unknown> };
}

interface Props {
  seriesId: string;
  avatars: SeriesAvatarEntry[];
  onUpdate: () => void;
}

interface AvatarOption {
  id: string;
  name: string;
}

const ROLES = ['main_character', 'supporting', 'narrator', 'antagonist'];

export function SeriesAvatarManager({ seriesId, avatars, onUpdate }: Props) {
  const [adding, setAdding] = useState(false);
  const [selectedAvatarId, setSelectedAvatarId] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  const { data: allAvatarsData } = useApi<AvatarOption[]>(adding ? '/avatars?limit=100' : null);
  const allAvatars = allAvatarsData?.data ?? [];
  const assignedIds = new Set(avatars.map((a) => a.avatarId));
  const availableAvatars = allAvatars.filter((a) => !assignedIds.has(a.id));

  const handleAdd = async () => {
    if (!selectedAvatarId) return;
    setSubmitting(true);
    try {
      await apiPost(`/series/${seriesId}/avatars`, {
        avatarId: selectedAvatarId,
        role: selectedRole || null,
      });
      toast.success('Avatar assigned');
      setAdding(false);
      setSelectedAvatarId('');
      setSelectedRole('');
      onUpdate();
    } catch (err) {
      console.error('Failed to assign avatar:', err);
      toast.error('Failed to assign avatar');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await apiDelete(`/series/${seriesId}/avatars?avatarId=${removeTarget}`);
      toast.success('Avatar removed');
      setRemoveTarget(null);
      onUpdate();
    } catch (err) {
      console.error('Failed to remove avatar:', err);
      toast.error('Failed to remove avatar');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-card-title text-text-primary">Series Avatars ({avatars.length})</h3>
        <button type="button" onClick={() => setAdding(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={14} />
          Assign Avatar
        </button>
      </div>

      {avatars.length === 0 ? (
        <div className="card text-center py-8">
          <UserCircle size={48} className="mx-auto text-text-secondary mb-3" />
          <p className="text-text-secondary">No avatars assigned to this series yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {avatars.map((a) => (
            <div key={a.avatarId} className="card flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-bg-tertiary flex items-center justify-center shrink-0">
                <UserCircle size={24} className="text-text-secondary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium text-text-primary truncate">{a.avatar.name}</span>
                  {a.isPrimary && <Star size={12} className="text-accent-yellow shrink-0" />}
                </div>
                {a.role && (
                  <span className="text-xs text-text-secondary">{a.role.replace('_', ' ')}</span>
                )}
              </div>
              <button
                onClick={() => setRemoveTarget(a.avatarId)}
                className="text-text-secondary hover:text-accent-red transition-colors shrink-0"
                title="Remove"
                aria-label="Remove avatar"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!removeTarget}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={handleRemove}
        loading={removing}
        title="Remove Avatar"
        message="Remove this avatar from the series? This does not delete the avatar itself."
        variant="danger"
        confirmLabel="Remove"
      />

      {/* Add avatar inline form */}
      {adding && (
        <div className="card mt-4">
          <h4 className="text-sm font-medium text-text-primary mb-3">Assign Avatar</h4>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs text-text-secondary mb-1">Avatar</label>
              <select
                value={selectedAvatarId}
                onChange={(e) => setSelectedAvatarId(e.target.value)}
                className="input w-full text-sm"
              >
                <option value="">Select...</option>
                {availableAvatars.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="w-40">
              <label className="block text-xs text-text-secondary mb-1">Role</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="input w-full text-sm"
              >
                <option value="">None</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <LoadingButton onClick={handleAdd} loading={submitting} disabled={!selectedAvatarId} loadingText="Adding..." className="btn-primary text-sm">
              Add
            </LoadingButton>
            <button type="button" onClick={() => setAdding(false)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
