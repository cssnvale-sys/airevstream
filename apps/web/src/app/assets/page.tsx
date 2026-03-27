'use client';

import { useState, useMemo, useEffect } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { AppLayout } from '@/components/layout/app-layout';
import { useAvatars, useSceneryAssets } from '@/hooks/use-assets';
import { apiPost, apiDelete } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Palette,
  Plus,
  Search,
  Users,
  Image,
  Paintbrush,
  User,
  Mountain,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';

// ─── Types ─────────────────────────────────────────────

type Tab = 'characters' | 'backgrounds' | 'branding';

interface AvatarListItem {
  id: string;
  name: string;
  images: Record<string, { bucket: string; key: string } | undefined>;
  channelAvatarsCount: number;
  seriesAvatarsCount: number;
  createdAt: string;
}

interface SceneryListItem {
  id: string;
  name: string;
  category: string | null;
  imageUrl: string;
  channelCount: number;
  createdAt: string;
}

type AvatarPaginatedResponse = {
  data: AvatarListItem[];
  meta: { total: number; page: number; limit: number; pages: number };
};

type SceneryPaginatedResponse = {
  data: SceneryListItem[];
  meta: { total: number; page: number; limit: number; pages: number };
};

// ─── Constants ─────────────────────────────────────────

const TABS: Array<{ key: Tab; label: string; icon: typeof Users }> = [
  { key: 'characters', label: 'Characters', icon: Users },
  { key: 'backgrounds', label: 'Backgrounds', icon: Image },
  { key: 'branding', label: 'Branding', icon: Paintbrush },
];

const SCENERY_CATEGORIES = ['all', 'city', 'nature', 'studio', 'fantasy', 'interior', 'abstract'] as const;

// ─── Create Avatar Modal ───────────────────────────────

function CreateAvatarModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, saving, onClose]);

  if (!open) return null;

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await apiPost('/avatars', { name: name.trim() });
      toast.success('Character created');
      setName('');
      onCreated();
      onClose();
    } catch (err) {
      console.error('Failed to create avatar:', err);
      toast.error('Failed to create character');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-secondary border border-border rounded-xl w-full max-w-md p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">New Character</h2>
          <button onClick={onClose} aria-label="Close" className="text-text-secondary hover:text-text-primary">
            <X size={20} />
          </button>
        </div>
        <label className="block text-sm text-text-secondary mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Alex, Narrator, Host"
          className="input w-full mb-4"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreate();
          }}
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary text-sm">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || saving}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Create Scenery Modal ──────────────────────────────

function CreateSceneryModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, saving, onClose]);

  if (!open) return null;

  async function handleCreate() {
    if (!name.trim() || !imageUrl.trim()) return;
    setSaving(true);
    try {
      await apiPost('/scenery', {
        name: name.trim(),
        category: category || null,
        imageUrl: imageUrl.trim(),
      });
      toast.success('Background created');
      setName('');
      setCategory('');
      setImageUrl('');
      onCreated();
      onClose();
    } catch (err) {
      console.error('Failed to create scenery:', err);
      toast.error('Failed to create background');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-secondary border border-border rounded-xl w-full max-w-md p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">New Background</h2>
          <button onClick={onClose} aria-label="Close" className="text-text-secondary hover:text-text-primary">
            <X size={20} />
          </button>
        </div>

        <label className="block text-sm text-text-secondary mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Downtown Night, Forest Clearing"
          className="input w-full mb-3"
          autoFocus
        />

        <label className="block text-sm text-text-secondary mb-1">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="input w-full mb-3"
        >
          <option value="">None</option>
          {SCENERY_CATEGORIES.filter((c) => c !== 'all').map((c) => (
            <option key={c} value={c}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>

        <label className="block text-sm text-text-secondary mb-1">Image URL or MinIO Key</label>
        <input
          type="text"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://... or minio://bucket/key"
          className="input w-full mb-4"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreate();
          }}
        />

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary text-sm">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || !imageUrl.trim() || saving}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Avatar Card ───────────────────────────────────────

function AvatarCard({
  avatar,
  onDeleted,
}: {
  avatar: AvatarListItem;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Find the first image slot that has data for the thumbnail
  const firstImage = useMemo(() => {
    if (!avatar.images || typeof avatar.images !== 'object') return null;
    const slots = ['face', 'waist', 'body_front', 'body_back'];
    for (const slot of slots) {
      const val = avatar.images[slot];
      if (val?.bucket && val?.key) return val;
    }
    return null;
  }, [avatar.images]);

  const filledSlots = useMemo(() => {
    if (!avatar.images || typeof avatar.images !== 'object') return 0;
    return Object.values(avatar.images).filter((v) => v?.bucket && v?.key).length;
  }, [avatar.images]);

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiDelete(`/avatars/${avatar.id}`);
      toast.success('Character deleted');
      onDeleted();
    } catch (err) {
      console.error('Failed to delete avatar:', err);
      toast.error('Failed to delete character');
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  return (
    <Link href={`/assets/${avatar.id}`} className="group card hover:border-accent-blue/40 transition-colors">
      {/* Thumbnail */}
      <div className="aspect-square bg-bg-tertiary rounded-lg mb-3 flex items-center justify-center overflow-hidden">
        {firstImage ? (
          <img
            src={`/api/v1/media/url?bucket=${encodeURIComponent(firstImage.bucket)}&key=${encodeURIComponent(firstImage.key)}`}
            alt={avatar.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <User size={40} className="text-text-tertiary" />
        )}
      </div>

      {/* Info */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-text-primary truncate group-hover:text-accent-blue transition-colors">
            {avatar.name}
          </h3>
          <p className="text-xs text-text-tertiary mt-0.5">
            {filledSlots}/4 images
            {(avatar.channelAvatarsCount > 0 || avatar.seriesAvatarsCount > 0) && (
              <span className="ml-2">
                {avatar.channelAvatarsCount > 0 && `${avatar.channelAvatarsCount} channel${avatar.channelAvatarsCount !== 1 ? 's' : ''}`}
                {avatar.channelAvatarsCount > 0 && avatar.seriesAvatarsCount > 0 && ', '}
                {avatar.seriesAvatarsCount > 0 && `${avatar.seriesAvatarsCount} series`}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteOpen(true); }}
          disabled={deleting}
          className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-accent-red transition-all p-1 rounded"
          title="Delete character"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete Character"
        message="Delete this character? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
        loading={deleting}
      />
    </Link>
  );
}

// ─── Scenery Card ──────────────────────────────────────

function SceneryCard({
  scenery,
  onDeleted,
}: {
  scenery: SceneryListItem;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiDelete(`/scenery/${scenery.id}`);
      toast.success('Background deleted');
      onDeleted();
    } catch (err) {
      console.error('Failed to delete scenery:', err);
      toast.error('Failed to delete background');
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  return (
    <div className="group card hover:border-accent-blue/40 transition-colors">
      {/* Thumbnail */}
      <div className="aspect-video bg-bg-tertiary rounded-lg mb-3 flex items-center justify-center overflow-hidden">
        {scenery.imageUrl ? (
          <img
            src={scenery.imageUrl}
            alt={scenery.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <Mountain size={40} className="text-text-tertiary" />
        )}
      </div>

      {/* Info */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-text-primary truncate">
            {scenery.name}
          </h3>
          <div className="flex items-center gap-2 mt-0.5">
            {scenery.category && (
              <span className="text-xs px-1.5 py-0.5 bg-accent-purple/10 text-accent-purple border border-accent-purple/30 rounded">
                {scenery.category}
              </span>
            )}
            {scenery.channelCount > 0 && (
              <span className="text-xs text-text-tertiary">
                {scenery.channelCount} channel{scenery.channelCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setDeleteOpen(true)}
          disabled={deleting}
          className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-accent-red transition-all p-1 rounded"
          title="Delete background"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete Background"
        message="Delete this background? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
        loading={deleting}
      />
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────

export default function AssetsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('characters');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [avatarPage, setAvatarPage] = useState(1);
  const [sceneryPage, setSceneryPage] = useState(1);
  const [sceneryCategory, setSceneryCategory] = useState('all');
  const [showCreateAvatar, setShowCreateAvatar] = useState(false);
  const [showCreateScenery, setShowCreateScenery] = useState(false);

  // Build avatar query params
  const avatarParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set('page', String(avatarPage));
    p.set('limit', '12');
    if (debouncedSearch) p.set('search', debouncedSearch);
    return p.toString();
  }, [avatarPage, debouncedSearch]);

  // Build scenery query params
  const sceneryParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set('page', String(sceneryPage));
    p.set('limit', '12');
    if (debouncedSearch) p.set('search', debouncedSearch);
    if (sceneryCategory !== 'all') p.set('category', sceneryCategory);
    return p.toString();
  }, [sceneryPage, debouncedSearch, sceneryCategory]);

  const { data: avatarRaw, isLoading: avatarsLoading, mutate: mutateAvatars } =
    useAvatars<AvatarListItem[]>(avatarParams);
  const { data: sceneryRaw, isLoading: sceneryLoading, mutate: mutateScenery } =
    useSceneryAssets<SceneryListItem[]>(sceneryParams);

  // Paginated response shape: { data: T[], meta: { total, page, limit, pages } }
  const avatarResponse = avatarRaw as unknown as AvatarPaginatedResponse | undefined;
  const avatars = avatarResponse?.data ?? [];
  const avatarTotal = avatarResponse?.meta?.total ?? 0;
  const avatarTotalPages = avatarResponse?.meta?.pages ?? 1;

  const sceneryResponse = sceneryRaw as unknown as SceneryPaginatedResponse | undefined;
  const sceneryAssets = sceneryResponse?.data ?? [];
  const sceneryTotal = sceneryResponse?.meta?.total ?? 0;
  const sceneryTotalPages = sceneryResponse?.meta?.pages ?? 1;

  // Reset page when debounced search changes (avoids jarring resets on every keystroke)
  useEffect(() => {
    setAvatarPage(1);
    setSceneryPage(1);
  }, [debouncedSearch]);

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Palette size={28} className="text-accent-purple" />
          <div>
            <h1 className="text-page-title text-text-primary">Assets</h1>
            <p className="text-text-secondary mt-0.5">Manage characters, backgrounds, and branding.</p>
          </div>
        </div>

        {/* Create button for active tab */}
        {activeTab === 'characters' && (
          <button onClick={() => setShowCreateAvatar(true)} className="btn-primary inline-flex items-center gap-2 text-sm">
            <Plus size={16} />
            New Character
          </button>
        )}
        {activeTab === 'backgrounds' && (
          <button onClick={() => setShowCreateScenery(true)} className="btn-primary inline-flex items-center gap-2 text-sm">
            <Plus size={16} />
            New Background
          </button>
        )}
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 border-b border-border mb-4">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors inline-flex items-center gap-2',
              activeTab === key
                ? 'border-accent-blue text-accent-blue'
                : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border',
            )}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input w-full pl-9"
          />
        </div>
        {activeTab === 'backgrounds' && (
          <select
            value={sceneryCategory}
            onChange={(e) => {
              setSceneryCategory(e.target.value);
              setSceneryPage(1);
            }}
            className="input"
          >
            {SCENERY_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c === 'all' ? 'All Categories' : c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'characters' && (
        <div>
          {avatarsLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue" />
            </div>
          ) : avatars.length === 0 ? (
            <div className="card flex flex-col items-center justify-center py-16 text-center">
              <Users size={40} className="text-text-tertiary mb-3" />
              <h3 className="text-lg font-medium text-text-primary">No characters yet</h3>
              <p className="text-sm text-text-secondary mt-1 mb-4">
                {search ? 'No characters match your search.' : 'Create your first character to use in productions.'}
              </p>
              {!search && (
                <button onClick={() => setShowCreateAvatar(true)} className="btn-primary text-sm inline-flex items-center gap-2">
                  <Plus size={16} />
                  New Character
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {avatars.map((avatar) => (
                  <AvatarCard key={avatar.id} avatar={avatar} onDeleted={() => mutateAvatars()} />
                ))}
              </div>
              {avatarTotalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-caption text-text-tertiary">
                    {avatarTotal} character{avatarTotal !== 1 ? 's' : ''}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setAvatarPage((p) => Math.max(1, p - 1))}
                      disabled={avatarPage === 1}
                      className="btn-secondary text-caption px-2 py-1 disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <span className="text-caption text-text-secondary px-2 py-1">
                      {avatarPage} / {avatarTotalPages}
                    </span>
                    <button
                      onClick={() => setAvatarPage((p) => Math.min(avatarTotalPages, p + 1))}
                      disabled={avatarPage === avatarTotalPages}
                      className="btn-secondary text-caption px-2 py-1 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'backgrounds' && (
        <div>
          {sceneryLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue" />
            </div>
          ) : sceneryAssets.length === 0 ? (
            <div className="card flex flex-col items-center justify-center py-16 text-center">
              <Mountain size={40} className="text-text-tertiary mb-3" />
              <h3 className="text-lg font-medium text-text-primary">No backgrounds yet</h3>
              <p className="text-sm text-text-secondary mt-1 mb-4">
                {search || sceneryCategory !== 'all'
                  ? 'No backgrounds match your filters.'
                  : 'Add backgrounds for use in your video productions.'}
              </p>
              {!search && sceneryCategory === 'all' && (
                <button onClick={() => setShowCreateScenery(true)} className="btn-primary text-sm inline-flex items-center gap-2">
                  <Plus size={16} />
                  New Background
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {sceneryAssets.map((scenery) => (
                  <SceneryCard key={scenery.id} scenery={scenery} onDeleted={() => mutateScenery()} />
                ))}
              </div>
              {sceneryTotalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-caption text-text-tertiary">
                    {sceneryTotal} background{sceneryTotal !== 1 ? 's' : ''}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setSceneryPage((p) => Math.max(1, p - 1))}
                      disabled={sceneryPage === 1}
                      className="btn-secondary text-caption px-2 py-1 disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <span className="text-caption text-text-secondary px-2 py-1">
                      {sceneryPage} / {sceneryTotalPages}
                    </span>
                    <button
                      onClick={() => setSceneryPage((p) => Math.min(sceneryTotalPages, p + 1))}
                      disabled={sceneryPage === sceneryTotalPages}
                      className="btn-secondary text-caption px-2 py-1 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'branding' && (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <Paintbrush size={40} className="text-text-tertiary mb-3" />
          <h3 className="text-lg font-medium text-text-primary">Channel Branding</h3>
          <p className="text-sm text-text-secondary mt-1 mb-4">
            Select a channel to manage its branding assets (logos, intros, outros, watermarks).
          </p>
          <Link href="/channels" className="btn-primary text-sm">
            Go to Channels
          </Link>
        </div>
      )}

      {/* Modals */}
      <CreateAvatarModal
        open={showCreateAvatar}
        onClose={() => setShowCreateAvatar(false)}
        onCreated={() => mutateAvatars()}
      />
      <CreateSceneryModal
        open={showCreateScenery}
        onClose={() => setShowCreateScenery(false)}
        onCreated={() => mutateScenery()}
      />
    </AppLayout>
  );
}
