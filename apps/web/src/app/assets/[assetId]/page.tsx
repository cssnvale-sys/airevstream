'use client';

import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { useAvatar } from '@/hooks/use-assets';
import { usePresignedUrl } from '@/hooks/use-presigned-url';
import { FileUpload } from '@/components/ui/file-upload';
import { apiPost, apiPut, apiDelete } from '@/hooks/use-api';
import { cn, formatDate } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { LoadingButton } from '@/components/ui/loading-button';
import { BUCKETS } from '@airevstream/shared';
import { toast } from '@/lib/toast';
import type { UploadResult } from '@/hooks/use-upload';
import {
  ArrowLeft,
  Save,
  Sparkles,
  Loader2,
  User,
  Trash2,
  Camera,
  Link as LinkIcon,
  X,
} from 'lucide-react';
import Link from 'next/link';

// ─── Types ─────────────────────────────────────────────

const IMAGE_SLOTS = ['face', 'waist', 'body_front', 'body_back'] as const;
type ImageSlot = (typeof IMAGE_SLOTS)[number];

const SLOT_LABELS: Record<ImageSlot, string> = {
  face: 'Face / Headshot',
  waist: 'Waist Up',
  body_front: 'Full Body (Front)',
  body_back: 'Full Body (Back)',
};

interface AvatarDetail {
  id: string;
  name: string;
  description: Record<string, unknown>;
  traitLock: Record<string, unknown>;
  voiceProfiles: Record<string, unknown>;
  images: Record<string, { bucket: string; key: string } | undefined>;
  generationHistory: Array<Record<string, unknown>>;
  channelAvatars: Array<{ channel: { id: string; name: string } }>;
  seriesAvatars: Array<{ series: { id: string; name: string } }>;
  channelAvatarsCount: number;
  seriesAvatarsCount: number;
  assetRegistryEntriesCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Slot Image Component ──────────────────────────────

function SlotCard({
  slot,
  imageRef,
  avatarId,
  onUpdated,
}: {
  slot: ImageSlot;
  imageRef: { bucket: string; key: string } | undefined;
  avatarId: string;
  onUpdated: () => void;
}) {
  const { url, isLoading: urlLoading } = usePresignedUrl(
    imageRef?.bucket ?? null,
    imageRef?.key ?? null,
  );
  const [showGenerate, setShowGenerate] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteSlotOpen, setDeleteSlotOpen] = useState(false);

  async function handleUploadComplete(result: UploadResult) {
    try {
      await apiPost(`/avatars/${avatarId}/images`, {
        slot,
        bucket: result.bucket,
        key: result.key,
      });
      toast.success(`${SLOT_LABELS[slot]} image uploaded`);
      onUpdated();
    } catch (err) {
      console.error('Failed to register image:', err);
      toast.error('Failed to register uploaded image');
    }
  }

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      await apiPost(`/avatars/${avatarId}/generate`, {
        slot,
        prompt: prompt.trim(),
      });
      toast.success('Generation queued. Image will appear when ready.');
      setShowGenerate(false);
      setPrompt('');
    } catch (err) {
      console.error('Failed to queue generation:', err);
      toast.error('Failed to queue image generation');
    } finally {
      setGenerating(false);
    }
  }

  async function handleDeleteSlot() {
    setDeleting(true);
    try {
      await apiDelete(`/avatars/${avatarId}/images?slot=${slot}`);
      toast.success('Image removed');
      onUpdated();
    } catch (err) {
      console.error('Failed to delete image:', err);
      toast.error('Failed to remove image');
    } finally {
      setDeleting(false);
      setDeleteSlotOpen(false);
    }
  }

  return (
    <div className="card">
      <h4 className="text-sm font-medium text-text-primary mb-2">{SLOT_LABELS[slot]}</h4>

      {imageRef ? (
        <div className="relative group">
          <div className="aspect-square bg-bg-tertiary rounded-lg overflow-hidden mb-2">
            {urlLoading ? (
              <div className="w-full h-full flex items-center justify-center">
                <Loader2 size={24} className="animate-spin text-text-tertiary" />
              </div>
            ) : url ? (
              <img src={url} alt={`${slot} view`} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Camera size={24} className="text-text-tertiary" />
              </div>
            )}
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setShowGenerate(true)}
              className="btn-secondary text-xs flex-1 inline-flex items-center justify-center gap-1"
            >
              <Sparkles size={12} />
              Regenerate
            </button>
            <button
              onClick={() => setDeleteSlotOpen(true)}
              disabled={deleting}
              className="btn-secondary text-xs px-2 text-accent-red hover:bg-accent-red/10"
              title="Remove image"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <FileUpload
            bucket={BUCKETS.AVATARS}
            accept="image/*"
            maxSizeMB={10}
            onUploaded={handleUploadComplete}
          />
          <button
            onClick={() => setShowGenerate(true)}
            className="btn-secondary text-xs w-full inline-flex items-center justify-center gap-1"
          >
            <Sparkles size={12} />
            Generate with AI
          </button>
        </div>
      )}

      {/* Generate prompt popover */}
      {showGenerate && (
        <div className="mt-2 p-3 bg-bg-tertiary border border-border rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-text-secondary">Generation Prompt</span>
            <button onClick={() => setShowGenerate(false)} aria-label="Close" className="text-text-tertiary hover:text-text-primary">
              <X size={14} />
            </button>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the character appearance for this angle..."
            className="input w-full text-sm resize-none"
            rows={3}
            autoFocus
          />
          <LoadingButton
            onClick={handleGenerate}
            loading={generating}
            disabled={!prompt.trim()}
            loadingText="Queuing..."
            className="btn-primary text-xs w-full mt-2 disabled:opacity-50 inline-flex items-center justify-center gap-1"
          >
            <Sparkles size={12} />
            Generate
          </LoadingButton>
        </div>
      )}

      <ConfirmDialog
        open={deleteSlotOpen}
        title="Remove Image"
        message={`Remove the ${SLOT_LABELS[slot]} image? This cannot be undone.`}
        confirmLabel="Remove"
        variant="danger"
        onConfirm={handleDeleteSlot}
        onCancel={() => setDeleteSlotOpen(false)}
        loading={deleting}
      />
    </div>
  );
}

// ─── Main Detail Page ──────────────────────────────────

export default function AssetDetailPage() {
  const { assetId } = useParams<{ assetId: string }>();
  const router = useRouter();
  const { data: rawData, isLoading, mutate } = useAvatar<AvatarDetail>(assetId);

  const avatar = rawData?.data ?? null;

  const [name, setName] = useState('');
  const [descriptionText, setDescriptionText] = useState('');
  const [traitLockText, setTraitLockText] = useState('');
  const [voiceProfilesText, setVoiceProfilesText] = useState('');
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteAvatarOpen, setDeleteAvatarOpen] = useState(false);

  // Initialize form fields when avatar data loads
  if (avatar && !initialized) {
    setName(avatar.name);
    setDescriptionText(
      Object.keys(avatar.description ?? {}).length > 0
        ? JSON.stringify(avatar.description, null, 2)
        : '',
    );
    setTraitLockText(
      Object.keys(avatar.traitLock ?? {}).length > 0
        ? JSON.stringify(avatar.traitLock, null, 2)
        : '',
    );
    setVoiceProfilesText(
      Object.keys(avatar.voiceProfiles ?? {}).length > 0
        ? JSON.stringify(avatar.voiceProfiles, null, 2)
        : '',
    );
    setInitialized(true);
  }

  const handleSave = useCallback(async () => {
    if (!avatar) return;
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {};
      if (name !== avatar.name) updates.name = name;

      // Parse JSON fields
      if (descriptionText.trim()) {
        try {
          updates.description = JSON.parse(descriptionText);
        } catch {
          toast.error('Description must be valid JSON');
          setSaving(false);
          return;
        }
      } else {
        updates.description = {};
      }

      if (traitLockText.trim()) {
        try {
          updates.traitLock = JSON.parse(traitLockText);
        } catch {
          toast.error('Trait locks must be valid JSON');
          setSaving(false);
          return;
        }
      } else {
        updates.traitLock = {};
      }

      if (voiceProfilesText.trim()) {
        try {
          updates.voiceProfiles = JSON.parse(voiceProfilesText);
        } catch {
          toast.error('Voice profiles must be valid JSON');
          setSaving(false);
          return;
        }
      } else {
        updates.voiceProfiles = {};
      }

      await apiPut(`/avatars/${avatar.id}`, updates);
      toast.success('Character saved');
      mutate();
    } catch (err) {
      console.error('Failed to save avatar:', err);
      toast.error('Failed to save character');
    } finally {
      setSaving(false);
    }
  }, [avatar, name, descriptionText, traitLockText, voiceProfilesText, mutate]);

  async function handleDeleteAvatar() {
    if (!avatar) return;
    setDeleting(true);
    try {
      await apiDelete(`/avatars/${avatar.id}`);
      toast.success('Character deleted');
      router.push('/assets');
    } catch (err) {
      console.error('Failed to delete avatar:', err);
      toast.error('Failed to delete character');
      setDeleting(false);
      setDeleteAvatarOpen(false);
    }
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue" />
        </div>
      </AppLayout>
    );
  }

  if (!avatar) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <User size={40} className="text-text-tertiary mb-3" />
          <h2 className="text-lg font-medium text-text-primary">Character not found</h2>
          <p className="text-sm text-text-secondary mt-1 mb-4">
            This character may have been deleted.
          </p>
          <Link href="/assets" className="btn-primary text-sm">
            Back to Assets
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/assets"
          className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary mb-3"
        >
          <ArrowLeft size={16} />
          Back to Assets
        </Link>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent-purple/10 flex items-center justify-center">
              <User size={20} className="text-accent-purple" />
            </div>
            <div>
              <h1 className="text-page-title text-text-primary">{avatar.name}</h1>
              <p className="text-xs text-text-tertiary">
                Created <time dateTime={avatar.createdAt}>{formatDate(avatar.createdAt)}</time>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LoadingButton
              onClick={() => setDeleteAvatarOpen(true)}
              loading={deleting}
              loadingText="Deleting..."
              className="btn-secondary text-sm text-accent-red hover:bg-accent-red/10 inline-flex items-center gap-1"
            >
              <Trash2 size={14} />
              Delete
            </LoadingButton>
            <LoadingButton
              onClick={handleSave}
              loading={saving}
              loadingText="Saving..."
              className="btn-primary text-sm inline-flex items-center gap-1 disabled:opacity-50"
            >
              <Save size={14} />
              Save
            </LoadingButton>
          </div>
        </div>
      </div>

      {/* Image Grid */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
          Multi-Angle Images
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {IMAGE_SLOTS.map((slot) => (
            <SlotCard
              key={slot}
              slot={slot}
              imageRef={avatar.images?.[slot]}
              avatarId={avatar.id}
              onUpdated={() => mutate()}
            />
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Name */}
          <section>
            <label htmlFor="asset-name" className="block text-sm font-medium text-text-secondary mb-1">Name</label>
            <input
              id="asset-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input w-full"
            />
          </section>

          {/* Description */}
          <section>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Description (JSON)
            </label>
            <p className="text-xs text-text-tertiary mb-1">
              Physical attributes, personality traits, backstory, etc.
            </p>
            <textarea
              value={descriptionText}
              onChange={(e) => setDescriptionText(e.target.value)}
              placeholder='{"hair": "dark brown", "eyes": "green", "build": "athletic"}'
              className="input w-full font-mono text-xs resize-vertical"
              rows={6}
            />
          </section>

          {/* Trait Locks */}
          <section>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Trait Locks (JSON)
            </label>
            <p className="text-xs text-text-tertiary mb-1">
              Locked visual traits that remain consistent across generations.
            </p>
            <textarea
              value={traitLockText}
              onChange={(e) => setTraitLockText(e.target.value)}
              placeholder='{"hairColor": "dark brown", "eyeColor": "green"}'
              className="input w-full font-mono text-xs resize-vertical"
              rows={4}
            />
          </section>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Voice Profiles */}
          <section>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Voice Profiles (JSON)
            </label>
            <p className="text-xs text-text-tertiary mb-1">
              TTS voice configuration for this character.
            </p>
            <textarea
              value={voiceProfilesText}
              onChange={(e) => setVoiceProfilesText(e.target.value)}
              placeholder='{"primary": {"provider": "piper", "voice": "en_US-joe-medium"}}'
              className="input w-full font-mono text-xs resize-vertical"
              rows={4}
            />
          </section>

          {/* Assignments */}
          <section>
            <h3 className="text-sm font-medium text-text-secondary mb-2">Assignments</h3>
            <div className="card bg-bg-tertiary">
              {avatar.channelAvatars.length === 0 && avatar.seriesAvatars.length === 0 ? (
                <p className="text-sm text-text-tertiary py-2">
                  Not assigned to any channels or series yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {avatar.channelAvatars.map((ca) => (
                    <Link
                      key={ca.channel.id}
                      href={`/channels/${ca.channel.id}`}
                      className="flex items-center gap-2 text-sm text-text-primary hover:text-accent-blue"
                    >
                      <LinkIcon size={12} className="text-text-tertiary" />
                      <span>Channel: {ca.channel.name}</span>
                    </Link>
                  ))}
                  {avatar.seriesAvatars.map((sa) => (
                    <Link
                      key={sa.series.id}
                      href={`/series/${sa.series.id}`}
                      className="flex items-center gap-2 text-sm text-text-primary hover:text-accent-blue"
                    >
                      <LinkIcon size={12} className="text-text-tertiary" />
                      <span>Series: {sa.series.name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Generation History */}
          <section>
            <h3 className="text-sm font-medium text-text-secondary mb-2">Generation History</h3>
            <div className="card bg-bg-tertiary">
              {(!avatar.generationHistory || avatar.generationHistory.length === 0) ? (
                <p className="text-sm text-text-tertiary py-2">
                  No generations yet. Use the AI generate buttons on image slots above.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {avatar.generationHistory.slice(0, 10).map((entry, i) => (
                    <div key={i} className="text-xs text-text-secondary border-b border-border last:border-b-0 pb-1">
                      <span className="font-mono text-text-tertiary">
                        {entry.timestamp
                          ? new Date(entry.timestamp as string).toLocaleString()
                          : `Entry ${i + 1}`}
                      </span>
                      {typeof entry.slot === 'string' && (
                        <span className="ml-2 px-1 py-0.5 bg-accent-blue/10 text-accent-blue rounded">
                          {SLOT_LABELS[entry.slot as ImageSlot] ?? entry.slot}
                        </span>
                      )}
                      {typeof entry.prompt === 'string' && (
                        <p className="mt-0.5 text-text-tertiary truncate">{entry.prompt}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Stats */}
          <section>
            <h3 className="text-sm font-medium text-text-secondary mb-2">Stats</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="card bg-bg-tertiary text-center py-3">
                <p className="text-lg font-semibold text-text-primary">{avatar.channelAvatarsCount}</p>
                <p className="text-xs text-text-tertiary">Channels</p>
              </div>
              <div className="card bg-bg-tertiary text-center py-3">
                <p className="text-lg font-semibold text-text-primary">{avatar.seriesAvatarsCount}</p>
                <p className="text-xs text-text-tertiary">Series</p>
              </div>
              <div className="card bg-bg-tertiary text-center py-3">
                <p className="text-lg font-semibold text-text-primary">{avatar.assetRegistryEntriesCount}</p>
                <p className="text-xs text-text-tertiary">Registry</p>
              </div>
            </div>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={deleteAvatarOpen}
        title="Delete Character"
        message="Delete this character permanently? All images will be removed. This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDeleteAvatar}
        onCancel={() => setDeleteAvatarOpen(false)}
        loading={deleting}
      />
    </AppLayout>
  );
}
