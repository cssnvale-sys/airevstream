'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useApi, apiPost, apiPut } from '@/hooks/use-api';
import { toast } from '@/lib/toast';
import { BibleEditor } from '@/components/cinema/bible-editor';
import { LoadingButton } from '@/components/ui/loading-button';
import { formatDate } from '@/lib/utils';

interface ChannelInfo {
  id: string;
  name: string;
  socialAccount: {
    platform: string;
    username: string;
  };
}

interface CinemaBible {
  id: string;
  channelId: string;
  version: number;
  lookBible: Record<string, unknown> | null;
  characterBible: Record<string, unknown> | null;
  environmentBible: Record<string, unknown> | null;
  promptBible: Record<string, unknown> | null;
  shotspecTemplate: Record<string, unknown> | null;
  channel: ChannelInfo;
  createdAt: string;
  updatedAt: string;
}

interface ChannelOption {
  id: string;
  name: string;
  socialAccount: {
    platform: string;
    username: string;
  } | null;
}

export default function CinemaBiblePage() {
  const { data, error: fetchError, isLoading, mutate } = useApi<CinemaBible[]>('/cinema-bible');
  const { data: channelsData } = useApi<ChannelOption[]>('/channels?limit=100');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newChannelId, setNewChannelId] = useState('');

  const bibles = (data?.data ?? []) as CinemaBible[];
  const channels = (channelsData?.data ?? []) as ChannelOption[];
  const selected = bibles.find((b) => b.id === selectedId) ?? null;

  async function handleCreate() {
    if (!newChannelId) {
      toast.error('Please select a channel');
      return;
    }
    setCreating(true);
    try {
      const res = await apiPost<{ success: boolean; data: CinemaBible }>('/cinema-bible', { channelId: newChannelId });
      if (res.success) {
        toast.success('Cinema bible created');
        await mutate();
        setSelectedId(res.data.id);
        setShowCreate(false);
        setNewChannelId('');
      }
    } catch (err) {
      console.error('Failed to create cinema bible:', err);
      toast.error('Failed to create cinema bible');
    } finally {
      setCreating(false);
    }
  }

  async function handleSave(id: string, updates: Record<string, unknown>) {
    try {
      const res = await apiPut<{ success: boolean }>(`/cinema-bible/${id}`, updates);
      if (res.success) {
        toast.success('Cinema bible saved');
        await mutate();
      }
    } catch (err) {
      console.error('Failed to save cinema bible:', err);
      toast.error('Failed to save cinema bible');
    }
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-bg-tertiary rounded w-48" />
            <div className="h-64 bg-bg-tertiary rounded" />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">Cinema Bibles</h1>
            <p className="text-sm text-text-secondary mt-1">
              Configure visual style, characters, environments, and prompts for cinema-quality production.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(!showCreate)}
            className="btn-primary"
          >
            New Bible
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="bg-bg-secondary rounded-lg border border-accent-blue/30 p-4">
            <h3 className="text-sm font-medium text-text-primary mb-3">Create Cinema Bible</h3>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label htmlFor="settings-bible-channel" className="block text-xs text-text-secondary mb-1">Channel</label>
                <select
                  id="settings-bible-channel"
                  value={newChannelId}
                  onChange={(e) => setNewChannelId(e.target.value)}
                  className="input w-full"
                >
                  <option value="">Select a channel...</option>
                  {channels.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.name} ({ch.socialAccount?.platform ?? 'unknown'} - @{ch.socialAccount?.username ?? 'unknown'})
                    </option>
                  ))}
                </select>
              </div>
              <LoadingButton
                onClick={handleCreate}
                disabled={!newChannelId}
                loading={creating}
                loadingText="Creating..."
                className="btn-primary"
              >
                Create
              </LoadingButton>
              <button
                type="button"
                onClick={() => { setShowCreate(false); setNewChannelId(''); }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {fetchError ? (
          <div className="text-center py-16 bg-bg-secondary rounded-lg border border-border">
            <p className="text-accent-red">Failed to load cinema bibles</p>
          </div>
        ) : bibles.length === 0 ? (
          <div className="text-center py-16 bg-bg-secondary rounded-lg border border-border">
            <p className="text-text-secondary">No cinema bibles yet.</p>
            <p className="text-sm text-text-tertiary mt-1">Create one to define your visual production style.</p>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-6">
            {/* Bible list */}
            <div className="col-span-3 space-y-2">
              {bibles.map((bible) => (
                <button
                  type="button"
                  key={bible.id}
                  onClick={() => setSelectedId(bible.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                    selectedId === bible.id
                      ? 'border-accent-blue bg-accent-blue/10 text-text-primary'
                      : 'border-border bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
                  }`}
                >
                  <div className="font-medium text-sm">{bible.channel.name}</div>
                  <div className="text-xs text-text-tertiary mt-0.5">
                    {bible.channel.socialAccount.platform} &middot; v{bible.version}
                  </div>
                  <div className="text-xs text-text-tertiary mt-1">
                    Updated <time dateTime={bible.updatedAt}>{formatDate(bible.updatedAt)}</time>
                  </div>
                </button>
              ))}
            </div>

            {/* Editor */}
            <div className="col-span-9">
              {selected ? (
                <BibleEditor bible={selected} onSave={handleSave} />
              ) : (
                <div className="text-center py-16 bg-bg-secondary rounded-lg border border-border">
                  <p className="text-text-secondary">Select a bible to edit</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
