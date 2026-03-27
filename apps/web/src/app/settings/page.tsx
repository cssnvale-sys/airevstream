'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useApi, useAiServices, apiPost, apiPut, apiDelete } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import {
  Settings,
  Cpu,
  Bell,
  Shield,
  Palette,
  Save,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Check,
  Monitor,
  Moon,
  Sun,
  PanelLeft,
  PanelRight,
  ArrowDownUp,
  Zap,
  Globe,
  Database,
  Download,
  Activity,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CopyButton } from '@/components/ui/copy-button';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingButton } from '@/components/ui/loading-button';
import { getToken } from '@/lib/auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GeneralSettings {
  systemName: string;
  timezone: string;
  defaultLanguage: string;
}

interface AiService {
  id: string;
  name: string;
  serviceType: string;
  status: string;
  endpoint: string;
}

interface FallbackChainService {
  id: string;
  name: string;
  provider: string;
  order: number;
  status: string;
  healthScore: number;
  isLocal: boolean;
  isFree: boolean;
}

interface FallbackChain {
  type: string;
  services: FallbackChainService[];
}

interface NotificationChannel {
  type: string;
  enabled: boolean;
  config: Record<string, string>;
}

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  status: string;
  expiresAt?: string | null;
  createdAt: string;
  lastUsedAt?: string;
}

interface AppearanceSettings {
  theme: 'dark' | 'light' | 'system';
  sidebarPosition: 'left' | 'right';
}

interface ProxyEntry {
  id: string;
  name: string;
  type: 'http' | 'socks5' | 'residential';
  host: string;
  port: number;
  username?: string;
  password?: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

interface RetentionSettings {
  retentionDays: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TABS = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'ai', label: 'AI Services', icon: Cpu },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'proxies', label: 'Proxies', icon: Globe },
  { id: 'data', label: 'Data', icon: Database },
  { id: 'appearance', label: 'Appearance', icon: Palette },
] as const;

type TabId = (typeof TABS)[number]['id'];

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' },
];

// ---------------------------------------------------------------------------
// Skeleton components
// ---------------------------------------------------------------------------

function SkeletonInput() {
  return <div className="h-10 w-full bg-bg-tertiary rounded animate-pulse" />;
}

function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="h-4 w-32 bg-bg-tertiary rounded mb-3" />
      <div className="space-y-2">
        <div className="h-3 w-48 bg-bg-tertiary rounded" />
        <div className="h-3 w-40 bg-bg-tertiary rounded" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components for each tab
// ---------------------------------------------------------------------------

function GeneralTab() {
  const { data: settingsRes, isLoading } = useApi<GeneralSettings>('/settings/general');
  const [form, setForm] = useState<GeneralSettings>({
    systemName: 'AiRevStream',
    timezone: 'UTC',
    defaultLanguage: 'en',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useUnsavedChanges(dirty);

  useEffect(() => {
    if (settingsRes?.data) {
      const settings = settingsRes.data;
      setForm(settings);
      setDirty(false);
    }
  }, [settingsRes]);

  const updateForm = (update: Partial<GeneralSettings>) => {
    setForm((prev) => ({ ...prev, ...update }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiPut('/settings/general', form);
      setSaved(true);
      setDirty(false);
      toast.success('Settings saved');
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save general settings:', err);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i}>
            <div className="h-3 w-24 bg-bg-tertiary rounded mb-2 animate-pulse" />
            <SkeletonInput />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">System Name</label>
        <input
          value={form.systemName}
          onChange={(e) => updateForm({ systemName: e.target.value })}
          className="input w-full"
          placeholder="AiRevStream"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Timezone</label>
        <select
          value={form.timezone}
          onChange={(e) => updateForm({ timezone: e.target.value })}
          className="input w-full"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Default Language</label>
        <select
          value={form.defaultLanguage}
          onChange={(e) => updateForm({ defaultLanguage: e.target.value })}
          className="input w-full"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <LoadingButton
          onClick={handleSave}
          loading={saving}
          loadingText="Saving..."
          className="btn-primary flex items-center gap-2"
        >
          {saved ? <Check size={16} /> : <Save size={16} />}
          {saved ? 'Saved' : 'Save Changes'}
        </LoadingButton>
        {dirty && <span className="text-xs text-accent-amber">Unsaved changes</span>}
      </div>
    </div>
  );
}

function AiServicesTab() {
  const { data: servicesRes, isLoading, mutate } = useAiServices<AiService[]>();
  const { data: chainsRes, error: chainsError, mutate: mutateChains } = useApi<FallbackChain[]>('/settings/ai/fallback-chains');

  const [showAddForm, setShowAddForm] = useState(false);
  const [newService, setNewService] = useState({ name: '', type: 'text', endpoint: '' });
  const [adding, setAdding] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deletingServiceId, setDeletingServiceId] = useState<string | null>(null);

  // DnD state for fallback chain editor
  const [reorderableChains, setReorderableChains] = useState<FallbackChain[]>([]);
  const [dragState, setDragState] = useState<{ group: string; index: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ group: string; index: number } | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderDirty, setOrderDirty] = useState(false);

  const services = servicesRes?.data ?? [];
  const fallbackChains = chainsRes?.data ?? [];

  // Sync reorderable chains from SWR data
  useEffect(() => {
    if (fallbackChains.length > 0) {
      setReorderableChains(fallbackChains.map(c => ({ ...c, services: [...c.services] })));
      setOrderDirty(false);
    }
  }, [fallbackChains]);

  const handleDragStart = useCallback((group: string, index: number) => {
    setDragState({ group, index });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, group: string, index: number) => {
    e.preventDefault();
    if (dragState && dragState.group === group) {
      setDropTarget({ group, index });
    }
  }, [dragState]);

  const handleDrop = useCallback((group: string, index: number) => {
    if (!dragState || dragState.group !== group) return;

    setReorderableChains(prev => {
      const updated = prev.map(chain => {
        if (chain.type !== group) return chain;
        const svcs = [...chain.services];
        const [moved] = svcs.splice(dragState.index, 1);
        svcs.splice(index, 0, moved);
        return { ...chain, services: svcs };
      });
      return updated;
    });
    setOrderDirty(true);
    setDragState(null);
    setDropTarget(null);
  }, [dragState]);

  const handleDragEnd = useCallback(() => {
    setDragState(null);
    setDropTarget(null);
  }, []);

  const handleSaveOrder = async () => {
    setSavingOrder(true);
    try {
      const ordering = reorderableChains.flatMap(chain =>
        chain.services.map((svc, idx) => ({
          serviceId: svc.id,
          priority: idx,
        }))
      );
      await apiPut('/settings/fallback-chain', { ordering });
      toast.success('Fallback order saved');
      setOrderDirty(false);
      mutateChains();
    } catch (err) {
      console.error('Failed to save fallback order:', err);
      toast.error('Failed to save fallback order');
    } finally {
      setSavingOrder(false);
    }
  };

  const handleAddService = async () => {
    setAdding(true);
    try {
      await apiPost('/ai-services', {
        name: newService.name,
        provider: 'ollama',
        serviceType: newService.type,
        endpoint: newService.endpoint,
        isLocal: true,
      });
      setShowAddForm(false);
      setNewService({ name: '', type: 'text', endpoint: '' });
      mutate();
      toast.success('AI service added');
    } catch (err) {
      console.error('Failed to add AI service:', err);
      toast.error('Failed to add service');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteService = async (id: string) => {
    setDeletingServiceId(id);
    try {
      await apiDelete(`/ai-services/${id}`);
      mutate();
      toast.success('Service removed');
    } catch (err) {
      console.error('Failed to remove service:', err);
      toast.error('Failed to remove service');
    } finally {
      setDeletingServiceId(null);
    }
  };

  const handleTestServices = async () => {
    setTestingId('all');
    try {
      const res = await apiPost<{ data: { results: { id: string; healthy: boolean; responseMs: number | null; error: string | null }[] } }>('/ai-services/health-check');
      const results = res.data?.results ?? [];
      const healthy = results.filter((r) => r.healthy).length;
      const total = results.length;
      if (healthy === total) {
        toast.success(`All ${total} services healthy`);
      } else {
        toast.warning(`${healthy}/${total} services healthy`);
      }
      mutate();
    } catch (err) {
      console.error('Health check failed:', err);
      toast.error('Failed to run health checks');
    } finally {
      setTestingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Services List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-text-primary">Registered Services</h3>
          <div className="flex items-center gap-2">
            <LoadingButton
              loading={testingId !== null}
              loadingText="Testing..."
              onClick={handleTestServices}
              disabled={services.length === 0}
              className="btn-secondary btn-sm flex items-center gap-1"
            >
              <Zap size={14} />
              Test All
            </LoadingButton>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="btn-primary btn-sm flex items-center gap-1"
            >
              <Plus size={14} /> Add Service
            </button>
          </div>
        </div>

        {showAddForm && (
          <div className="card mb-4 border border-accent-blue/30">
            <h4 className="text-sm font-medium text-text-primary mb-3">New AI Service</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-text-secondary mb-1">Name</label>
                <input
                  value={newService.name}
                  onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                  className="input w-full"
                  placeholder="Ollama Local"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Type</label>
                <select
                  value={newService.type}
                  onChange={(e) => setNewService({ ...newService, type: e.target.value })}
                  className="input w-full"
                >
                  <option value="text">Text Generation</option>
                  <option value="image">Image Generation</option>
                  <option value="video">Video Generation</option>
                  <option value="voice">Voice / TTS</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Endpoint</label>
                <input
                  value={newService.endpoint}
                  onChange={(e) => setNewService({ ...newService, endpoint: e.target.value })}
                  className="input w-full"
                  placeholder="http://localhost:11434"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LoadingButton
                loading={adding}
                loadingText="Adding..."
                onClick={handleAddService}
                disabled={!newService.name || !newService.endpoint}
                className="btn-primary btn-sm flex items-center gap-1"
              >
                <Plus size={14} />
                Add
              </LoadingButton>
              <button onClick={() => setShowAddForm(false)} className="btn-secondary btn-sm">
                Cancel
              </button>
            </div>
          </div>
        )}

        {services.length === 0 ? (
          <EmptyState
            icon={Cpu}
            title="No AI services registered"
            description="Register an AI service to enable content generation."
            actionLabel="Add Service"
            onAction={() => setShowAddForm(true)}
            className="py-8"
          />
        ) : (
          <div className="space-y-3">
            {services.map((svc) => (
              <div key={svc.id} className="card flex items-center gap-3">
                <div
                  className={cn(
                    'h-2.5 w-2.5 rounded-full shrink-0',
                    svc.status === 'active' || svc.status === 'healthy'
                      ? 'bg-accent-green'
                      : svc.status === 'degraded'
                        ? 'bg-accent-amber'
                        : 'bg-accent-red',
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">{svc.name}</span>
                    <span className="badge badge-idle text-xs">{svc.serviceType}</span>
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5 font-mono truncate">
                    {svc.endpoint}
                  </p>
                </div>
                <span className={cn('badge text-xs', svc.status === 'active' || svc.status === 'healthy' ? 'badge-active' : svc.status === 'degraded' ? 'badge-pending' : 'badge-error')}>
                  {svc.status}
                </span>
                <button
                  onClick={() => handleDeleteService(svc.id)}
                  disabled={deletingServiceId === svc.id}
                  className={cn('text-text-secondary hover:text-accent-red transition-colors p-1', deletingServiceId === svc.id && 'opacity-50 cursor-not-allowed')}
                  title="Remove service"
                >
                  <Trash2 size={14} className={deletingServiceId === svc.id ? 'animate-pulse' : ''} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fallback Chains — DnD Editor */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-text-primary">Fallback Chains</h3>
          {orderDirty && (
            <LoadingButton
              onClick={handleSaveOrder}
              loading={savingOrder}
              loadingText="Saving..."
              className="btn-primary btn-sm flex items-center gap-1"
            >
              <Save size={14} />
              Save Order
            </LoadingButton>
          )}
        </div>
        {chainsError ? (
          <p className="text-accent-red text-sm py-4 text-center">Failed to load fallback chains</p>
        ) : reorderableChains.length === 0 ? (
          <p className="text-text-secondary text-sm py-4 text-center">No fallback chains configured</p>
        ) : (
          <div className="space-y-3">
            {reorderableChains.map((chain) => (
              <div key={chain.type} className="card">
                <div className="flex items-center gap-2 mb-3">
                  <ArrowDownUp size={14} className="text-accent-purple" />
                  <span className="text-sm font-medium text-text-primary capitalize">{chain.type} Chain</span>
                  <span className="text-xs text-text-secondary">({chain.services.length} services)</span>
                </div>
                <div className="space-y-1">
                  {chain.services.map((svc, idx) => (
                    <div
                      key={svc.id}
                      draggable
                      onDragStart={() => handleDragStart(chain.type, idx)}
                      onDragOver={(e) => handleDragOver(e, chain.type, idx)}
                      onDrop={() => handleDrop(chain.type, idx)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-md border transition-all cursor-grab active:cursor-grabbing',
                        dragState?.group === chain.type && dragState?.index === idx
                          ? 'opacity-40 border-border'
                          : dropTarget?.group === chain.type && dropTarget?.index === idx
                            ? 'bg-accent-blue/10 border-accent-blue/40'
                            : 'border-border hover:border-border-hover',
                      )}
                    >
                      <span className="text-text-secondary select-none" title="Drag to reorder">&#x2630;</span>
                      <span className="text-xs font-mono text-text-secondary w-5 text-center">{idx + 1}</span>
                      <div
                        className={cn(
                          'h-2 w-2 rounded-full shrink-0',
                          svc.status === 'active' ? 'bg-accent-green' : svc.status === 'degraded' ? 'bg-accent-amber' : 'bg-accent-red',
                        )}
                      />
                      <span className="text-sm text-text-primary flex-1">{svc.name}</span>
                      <span className="badge badge-idle text-xs">{svc.provider}</span>
                      <span className="text-xs text-text-secondary">{svc.healthScore}%</span>
                      {svc.isLocal && <span className="badge badge-active text-xs">Local</span>}
                      {svc.isFree && <span className="badge badge-active text-xs">Free</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationsTab() {
  const { data: notifRes, isLoading } = useApi<NotificationChannel[]>('/settings/notifications');
  const [channels, setChannels] = useState<NotificationChannel[]>([
    { type: 'dashboard', enabled: true, config: {} },
    { type: 'email', enabled: false, config: { address: '' } },
    { type: 'slack', enabled: false, config: { webhookUrl: '' } },
  ]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (notifRes?.data && notifRes.data.length > 0) {
      setChannels(notifRes.data);
    }
  }, [notifRes]);

  const toggleChannel = (idx: number) => {
    setChannels((prev) => prev.map((ch, i) => (i === idx ? { ...ch, enabled: !ch.enabled } : ch)));
  };

  const updateConfig = (idx: number, key: string, value: string) => {
    setChannels((prev) =>
      prev.map((ch, i) => (i === idx ? { ...ch, config: { ...ch.config, [key]: value } } : ch)),
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiPut('/settings/notifications', { channels });
      setSaved(true);
      toast.success('Notification settings saved');
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save notification settings:', err);
      toast.error('Failed to save notification settings');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-lg">
      {channels.map((ch, idx) => (
        <div key={ch.type} className="card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-text-primary capitalize">{ch.type}</span>
            <button
              role="switch"
              aria-checked={ch.enabled}
              aria-label={`${ch.type} notifications`}
              onClick={() => toggleChannel(idx)}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                ch.enabled ? 'bg-accent-blue' : 'bg-bg-tertiary',
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  ch.enabled ? 'translate-x-6' : 'translate-x-1',
                )}
              />
            </button>
          </div>

          {ch.enabled && ch.type === 'email' && (
            <div>
              <label className="block text-xs text-text-secondary mb-1">Email Address</label>
              <input
                value={ch.config.address ?? ''}
                onChange={(e) => updateConfig(idx, 'address', e.target.value)}
                className="input w-full"
                placeholder="admin@example.com"
                type="email"
              />
            </div>
          )}

          {ch.enabled && ch.type === 'slack' && (
            <div>
              <label className="block text-xs text-text-secondary mb-1">Webhook URL</label>
              <input
                value={ch.config.webhookUrl ?? ''}
                onChange={(e) => updateConfig(idx, 'webhookUrl', e.target.value)}
                className="input w-full"
                placeholder="https://hooks.slack.com/services/..."
              />
            </div>
          )}

          {ch.enabled && ch.type === 'dashboard' && (
            <p className="text-xs text-text-secondary">Alerts will appear in the dashboard notification center.</p>
          )}
        </div>
      ))}

      <LoadingButton
        onClick={handleSave}
        loading={saving}
        loadingText="Saving..."
        className="btn-primary flex items-center gap-2"
      >
        {saved ? <Check size={16} /> : <Save size={16} />}
        {saved ? 'Saved' : 'Save Changes'}
      </LoadingButton>
    </div>
  );
}

function SecurityTab() {
  // Change password
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // API keys
  const { data: keysRes, isLoading: keysLoading, mutate: mutateKeys } = useApi<ApiKey[]>('/settings/api-keys');
  const [newKeyName, setNewKeyName] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null);

  const apiKeys = keysRes?.data ?? [];

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 8 characters.' });
      return;
    }

    setPasswordSaving(true);
    try {
      await apiPost('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordMessage({ type: 'success', text: 'Password changed successfully.' });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      console.error('Failed to change password:', err);
      setPasswordMessage({ type: 'error', text: 'Failed to change password.' });
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    try {
      const res = await apiPost<{ data: { key: string } }>('/settings/api-keys', { name: newKeyName });
      setNewKeyValue(res.data.key);
      setNewKeyName('');
      mutateKeys();
      toast.success('API key generated');
    } catch (err) {
      console.error('Failed to generate API key:', err);
      toast.error('Failed to generate API key');
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeKey = async (id: string) => {
    setRevokingKeyId(id);
    try {
      await apiPost(`/settings/api-keys/${id}/revoke`);
      mutateKeys();
      setRevokeTarget(null);
      toast.success('API key revoked');
    } catch (err) {
      console.error('Failed to revoke key:', err);
      toast.error('Failed to revoke key');
    } finally {
      setRevokingKeyId(null);
    }
  };

  const handleCopyKey = () => {
    if (newKeyValue) {
      navigator.clipboard.writeText(newKeyValue);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  return (
    <div className="space-y-8">
      {/* Change Password */}
      <div>
        <h3 className="text-base font-semibold text-text-primary mb-4">Change Password</h3>
        <form noValidate onSubmit={handleChangePassword} className="max-w-md space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Current Password</label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                className="input w-full pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary p-1"
                aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
              >
                {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">New Password</label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                className="input w-full pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary p-1"
                aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
              >
                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Confirm New Password</label>
            <input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              className="input w-full"
              required
            />
          </div>

          {passwordMessage && (
            <p
              className={cn(
                'text-sm',
                passwordMessage.type === 'success' ? 'text-accent-green' : 'text-accent-red',
              )}
            >
              {passwordMessage.text}
            </p>
          )}

          <LoadingButton
            type="submit"
            loading={passwordSaving}
            loadingText="Saving..."
            className="btn-primary flex items-center gap-2"
          >
            <Shield size={16} />
            Change Password
          </LoadingButton>
        </form>
      </div>

      {/* API Key Management */}
      <div>
        <h3 className="text-base font-semibold text-text-primary mb-4">API Keys</h3>

        {/* Create new key */}
        <div className="flex items-end gap-2 mb-4 max-w-md">
          <div className="flex-1">
            <label className="block text-xs text-text-secondary mb-1">Key Name</label>
            <input
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="input w-full"
              placeholder="My integration"
            />
          </div>
          <LoadingButton
            loading={creatingKey}
            loadingText="Generating..."
            onClick={handleCreateKey}
            disabled={!newKeyName.trim()}
            className="btn-primary btn-sm flex items-center gap-1"
          >
            <Plus size={14} />
            Generate
          </LoadingButton>
        </div>

        {/* Newly created key banner */}
        {newKeyValue && (
          <div className="card border border-accent-green/30 bg-accent-green/5 mb-4">
            <p className="text-sm text-text-primary mb-2 font-medium">
              Your new API key (copy it now -- it will not be shown again):
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-bg-tertiary rounded px-3 py-2 font-mono text-text-primary break-all">
                {newKeyValue}
              </code>
              <button onClick={handleCopyKey} className="btn-ghost btn-sm flex items-center gap-1 shrink-0">
                {copiedKey ? <Check size={14} className="text-accent-green" /> : <Copy size={14} />}
                {copiedKey ? 'Copied' : 'Copy'}
              </button>
            </div>
            <button
              onClick={() => setNewKeyValue(null)}
              className="text-xs text-text-secondary hover:text-text-primary mt-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Key list */}
        {keysLoading ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2].map((i) => (
              <div key={i} className="h-14 bg-bg-tertiary rounded-lg" />
            ))}
          </div>
        ) : apiKeys.length === 0 ? (
          <EmptyState
            icon={Shield}
            title="No API keys created"
            description="Use the form above to create an API key for programmatic access."
            className="py-8"
          />
        ) : (
          <div className="space-y-2">
            {apiKeys.map((key) => (
              <div key={key.id} className={cn('card flex items-center gap-3', key.status === 'revoked' && 'opacity-60')}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">{key.name}</span>
                    {key.status === 'revoked' && (
                      <span className="badge badge-error text-xs">Revoked</span>
                    )}
                    {key.status === 'expired' && (
                      <span className="badge badge-pending text-xs">Expired</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-text-secondary">
                    <span className="font-mono">{key.keyPrefix}...</span>
                    <CopyButton value={key.keyPrefix} label="Copy key prefix" size={12} showToast={false} />
                    <span>Created {new Date(key.createdAt).toLocaleDateString()}</span>
                    {key.lastUsedAt && <span>Last used {new Date(key.lastUsedAt).toLocaleDateString()}</span>}
                    {key.expiresAt && <span>Expires {new Date(key.expiresAt).toLocaleDateString()}</span>}
                  </div>
                </div>
                <button
                  onClick={() => setRevokeTarget(key.id)}
                  disabled={key.status === 'revoked' || revokingKeyId === key.id}
                  className={cn('btn-danger btn-sm flex items-center gap-1', (key.status === 'revoked' || revokingKeyId === key.id) && 'opacity-50 cursor-not-allowed')}
                >
                  <Trash2 size={12} /> {revokingKeyId === key.id ? 'Revoking...' : 'Revoke'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!revokeTarget}
        title="Revoke API Key"
        message="This key will be permanently revoked and can no longer be used for authentication. This action cannot be undone."
        confirmLabel="Revoke Key"
        variant="danger"
        loading={revokingKeyId !== null}
        onConfirm={() => revokeTarget && handleRevokeKey(revokeTarget)}
        onCancel={() => setRevokeTarget(null)}
      />
    </div>
  );
}

function AppearanceTab() {
  const { data: appearanceRes, isLoading } = useApi<AppearanceSettings>('/settings/appearance');
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');
  const [sidebarPosition, setSidebarPosition] = useState<'left' | 'right'>('left');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (appearanceRes?.data) {
      setTheme(appearanceRes.data.theme);
      setSidebarPosition(appearanceRes.data.sidebarPosition);
    }
  }, [appearanceRes]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiPut('/settings/appearance', { theme, sidebarPosition });
      setSaved(true);
      toast.success('Appearance settings saved');
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save appearance settings:', err);
      toast.error('Failed to save appearance settings');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-3 w-24 bg-bg-tertiary rounded animate-pulse" />
        <div className="flex gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 w-28 bg-bg-tertiary rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const themeOptions: { value: 'dark' | 'light' | 'system'; label: string; icon: typeof Moon }[] = [
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  const sidebarOptions: { value: 'left' | 'right'; label: string; icon: typeof PanelLeft }[] = [
    { value: 'left', label: 'Left', icon: PanelLeft },
    { value: 'right', label: 'Right', icon: PanelRight },
  ];

  return (
    <div className="space-y-8 max-w-lg">
      {/* Theme */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-3">Theme</label>
        <div className="flex gap-3">
          {themeOptions.map((opt) => {
            const Icon = opt.icon;
            const selected = theme === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={cn(
                  'flex flex-col items-center gap-2 px-6 py-4 rounded-lg border transition-colors',
                  selected
                    ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                    : 'border-border bg-bg-secondary text-text-secondary hover:border-text-secondary',
                )}
              >
                <Icon size={20} />
                <span className="text-xs font-medium">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sidebar Position */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-3">Sidebar Position</label>
        <div className="flex gap-3">
          {sidebarOptions.map((opt) => {
            const Icon = opt.icon;
            const selected = sidebarPosition === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setSidebarPosition(opt.value)}
                className={cn(
                  'flex flex-col items-center gap-2 px-6 py-4 rounded-lg border transition-colors',
                  selected
                    ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                    : 'border-border bg-bg-secondary text-text-secondary hover:border-text-secondary',
                )}
              >
                <Icon size={20} />
                <span className="text-xs font-medium">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <LoadingButton
        onClick={handleSave}
        loading={saving}
        loadingText="Saving..."
        className="btn-primary flex items-center gap-2"
      >
        {saved ? <Check size={16} /> : <Save size={16} />}
        {saved ? 'Saved' : 'Save Changes'}
      </LoadingButton>
    </div>
  );
}

function ProxiesTab() {
  const { data: proxiesRes, isLoading, mutate } = useApi<ProxyEntry[]>('/settings/proxies');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProxy, setNewProxy] = useState({
    name: '',
    type: 'http' as 'http' | 'socks5' | 'residential',
    host: '',
    port: '',
    username: '',
    password: '',
  });
  const [adding, setAdding] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deletingProxyId, setDeletingProxyId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const proxies = proxiesRes?.data ?? [];
  const activeCount = proxies.filter((p) => p.status === 'active').length;
  const inactiveCount = proxies.filter((p) => p.status === 'inactive').length;

  const handleAddProxy = async () => {
    const port = parseInt(newProxy.port, 10);
    if (!newProxy.name || !newProxy.host || isNaN(port) || port < 1 || port > 65535) {
      toast.error('Please fill in all required fields with valid values');
      return;
    }
    setAdding(true);
    try {
      await apiPost('/settings/proxies', {
        name: newProxy.name,
        type: newProxy.type,
        host: newProxy.host,
        port,
        ...(newProxy.username ? { username: newProxy.username } : {}),
        ...(newProxy.password ? { password: newProxy.password } : {}),
      });
      setShowAddForm(false);
      setNewProxy({ name: '', type: 'http', host: '', port: '', username: '', password: '' });
      mutate();
      toast.success('Proxy added');
    } catch (err) {
      console.error('Failed to add proxy:', err);
      toast.error('Failed to add proxy');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteProxy = async (id: string) => {
    setDeletingProxyId(id);
    try {
      await apiDelete(`/settings/proxies/${id}`);
      mutate();
      setDeleteTarget(null);
      toast.success('Proxy removed');
    } catch (err) {
      console.error('Failed to delete proxy:', err);
      toast.error('Failed to delete proxy');
    } finally {
      setDeletingProxyId(null);
    }
  };

  const handleTestProxy = async (id: string) => {
    setTestingId(id);
    try {
      const res = await apiPost<{ data: { reachable: boolean; status: string } }>(`/settings/proxies/${id}`);
      if (res.data.reachable) {
        toast.success('Proxy is reachable');
      } else {
        toast.error('Proxy is not reachable');
      }
      mutate();
    } catch (err) {
      console.error('Failed to test proxy:', err);
      toast.error('Failed to test proxy');
    } finally {
      setTestingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pool Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg">
        <div className="card text-center">
          <div className="text-2xl font-bold text-text-primary">{proxies.length}</div>
          <div className="text-xs text-text-secondary mt-1">Total</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-accent-green">{activeCount}</div>
          <div className="text-xs text-text-secondary mt-1">Active</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-accent-red">{inactiveCount}</div>
          <div className="text-xs text-text-secondary mt-1">Inactive</div>
        </div>
      </div>

      {/* Proxy List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-text-primary">Configured Proxies</h3>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn-primary btn-sm flex items-center gap-1"
          >
            <Plus size={14} /> Add Proxy
          </button>
        </div>

        {showAddForm && (
          <div className="card mb-4 border border-accent-blue/30">
            <h4 className="text-sm font-medium text-text-primary mb-3">New Proxy</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-text-secondary mb-1">Name</label>
                <input
                  value={newProxy.name}
                  onChange={(e) => setNewProxy({ ...newProxy, name: e.target.value })}
                  className="input w-full"
                  placeholder="US Residential 1"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Type</label>
                <select
                  value={newProxy.type}
                  onChange={(e) => setNewProxy({ ...newProxy, type: e.target.value as 'http' | 'socks5' | 'residential' })}
                  className="input w-full"
                >
                  <option value="http">HTTP</option>
                  <option value="socks5">SOCKS5</option>
                  <option value="residential">Residential</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Host</label>
                <input
                  value={newProxy.host}
                  onChange={(e) => setNewProxy({ ...newProxy, host: e.target.value })}
                  className="input w-full"
                  placeholder="proxy.example.com"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Port</label>
                <input
                  value={newProxy.port}
                  onChange={(e) => setNewProxy({ ...newProxy, port: e.target.value })}
                  className="input w-full"
                  placeholder="8080"
                  type="number"
                  min={1}
                  max={65535}
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Username (optional)</label>
                <input
                  value={newProxy.username}
                  onChange={(e) => setNewProxy({ ...newProxy, username: e.target.value })}
                  className="input w-full"
                  placeholder="username"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Password (optional)</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newProxy.password}
                    onChange={(e) => setNewProxy({ ...newProxy, password: e.target.value })}
                    className="input w-full pr-10"
                    placeholder="password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary p-1"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LoadingButton
                loading={adding}
                loadingText="Adding..."
                onClick={handleAddProxy}
                disabled={!newProxy.name || !newProxy.host || !newProxy.port}
                className="btn-primary btn-sm flex items-center gap-1"
              >
                <Plus size={14} />
                Add
              </LoadingButton>
              <button onClick={() => setShowAddForm(false)} className="btn-secondary btn-sm">
                Cancel
              </button>
            </div>
          </div>
        )}

        {proxies.length === 0 ? (
          <EmptyState
            icon={Globe}
            title="No proxies configured"
            description="Add a proxy to route browser automation traffic through different IP addresses."
            actionLabel="Add Proxy"
            onAction={() => setShowAddForm(true)}
            className="py-8"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="pb-2 text-text-secondary font-medium">Name</th>
                  <th scope="col" className="pb-2 text-text-secondary font-medium">Type</th>
                  <th scope="col" className="pb-2 text-text-secondary font-medium">Host:Port</th>
                  <th scope="col" className="pb-2 text-text-secondary font-medium">Status</th>
                  <th scope="col" className="pb-2 text-text-secondary font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {proxies.map((proxy) => (
                  <tr key={proxy.id} className="border-b border-border/50">
                    <td className="py-3 text-text-primary font-medium">{proxy.name}</td>
                    <td className="py-3">
                      <span className="badge badge-idle text-xs uppercase">{proxy.type}</span>
                    </td>
                    <td className="py-3 text-text-secondary font-mono text-xs">
                      {proxy.host}:{proxy.port}
                    </td>
                    <td className="py-3">
                      <span className={cn('badge text-xs', proxy.status === 'active' ? 'badge-active' : 'badge-error')}>
                        {proxy.status}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-1">
                        <LoadingButton
                          loading={testingId === proxy.id}
                          loadingText="Testing..."
                          onClick={() => handleTestProxy(proxy.id)}
                          disabled={testingId !== null && testingId !== proxy.id}
                          className="btn-secondary btn-sm flex items-center gap-1"
                          title="Test connection"
                        >
                          <Activity size={12} />
                          Test
                        </LoadingButton>
                        <button
                          onClick={() => setDeleteTarget(proxy.id)}
                          disabled={deletingProxyId === proxy.id}
                          className={cn('text-text-secondary hover:text-accent-red transition-colors p-1.5', deletingProxyId === proxy.id && 'opacity-50 cursor-not-allowed')}
                          title="Delete proxy"
                        >
                          <Trash2 size={14} className={deletingProxyId === proxy.id ? 'animate-pulse' : ''} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Proxy"
        message="This proxy will be permanently removed from the configuration. This action cannot be undone."
        confirmLabel="Delete Proxy"
        variant="danger"
        loading={deletingProxyId !== null}
        onConfirm={() => deleteTarget && handleDeleteProxy(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function DataTab() {
  const { data: retentionRes, isLoading } = useApi<RetentionSettings>('/settings/data/retention');
  const [retentionDays, setRetentionDays] = useState(90);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    if (retentionRes?.data) {
      setRetentionDays(retentionRes.data.retentionDays);
    }
  }, [retentionRes]);

  const handleSaveRetention = async () => {
    setSaving(true);
    try {
      await apiPut('/settings/data/retention', { retentionDays });
      setSaved(true);
      toast.success('Retention settings saved');
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save retention settings:', err);
      toast.error('Failed to save retention settings');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async (type: 'content' | 'analytics' | 'accounts') => {
    setExporting(type);
    try {
      const token = getToken();
      const res = await fetch(`/api/v1/settings/data/export?type=${type}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        toast.error('Failed to export data');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const disposition = res.headers.get('Content-Disposition');
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      link.download = filenameMatch?.[1] ?? `${type}-export.csv`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} exported successfully`);
    } catch (err) {
      console.error(`Failed to export ${type}:`, err);
      toast.error('Failed to export data');
    } finally {
      setExporting(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  const exportOptions = [
    { type: 'content' as const, label: 'Content Items', description: 'Export all content items with title, type, status, quality score, and channel.' },
    { type: 'analytics' as const, label: 'Analytics', description: 'Export posted content analytics with performance data and quality scores.' },
    { type: 'accounts' as const, label: 'Accounts', description: 'Export email accounts and linked social accounts with status and health scores.' },
  ];

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Export Section */}
      <div>
        <h3 className="text-base font-semibold text-text-primary mb-4">Export Data</h3>
        <div className="space-y-3">
          {exportOptions.map((opt) => (
            <div key={opt.type} className="card flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-text-primary">{opt.label}</div>
                <p className="text-xs text-text-secondary mt-0.5">{opt.description}</p>
              </div>
              <LoadingButton
                loading={exporting === opt.type}
                loadingText="Exporting..."
                onClick={() => handleExport(opt.type)}
                disabled={exporting !== null && exporting !== opt.type}
                className="btn-secondary btn-sm flex items-center gap-1 shrink-0"
              >
                <Download size={14} />
                Export CSV
              </LoadingButton>
            </div>
          ))}
        </div>
      </div>

      {/* Data Retention */}
      <div>
        <h3 className="text-base font-semibold text-text-primary mb-4">Data Retention</h3>
        <p className="text-sm text-text-secondary mb-4">
          Configure how long resolved alerts, old metrics, and completed jobs are retained before automatic cleanup.
        </p>
        <div className="max-w-sm">
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Auto-cleanup Period</label>
          <select
            value={retentionDays}
            onChange={(e) => setRetentionDays(Number(e.target.value))}
            className="input w-full"
          >
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
            <option value={180}>180 days</option>
          </select>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <LoadingButton
            onClick={handleSaveRetention}
            loading={saving}
            loadingText="Saving..."
            className="btn-primary flex items-center gap-2"
          >
            {saved ? <Check size={16} /> : <Save size={16} />}
            {saved ? 'Saved' : 'Save Changes'}
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('general');

  const renderTab = useCallback(() => {
    switch (activeTab) {
      case 'general':
        return <GeneralTab />;
      case 'ai':
        return <AiServicesTab />;
      case 'notifications':
        return <NotificationsTab />;
      case 'security':
        return <SecurityTab />;
      case 'proxies':
        return <ProxiesTab />;
      case 'data':
        return <DataTab />;
      case 'appearance':
        return <AppearanceTab />;
      default:
        return null;
    }
  }, [activeTab]);

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
        <p className="text-text-secondary mt-1">Configure your AiRevStream instance</p>
      </div>

      {/* Tab navigation */}
      <div role="tablist" aria-label="Settings sections" className="flex border-b border-border mb-6 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                isActive
                  ? 'border-accent-blue text-accent-blue'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border',
              )}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div role="tabpanel" id={`tabpanel-${activeTab}`} aria-label={TABS.find(t => t.id === activeTab)?.label}>{renderTab()}</div>
    </AppLayout>
  );
}
