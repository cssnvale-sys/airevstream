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
  RefreshCw,
  Check,
  X,
  ChevronRight,
  Monitor,
  Moon,
  Sun,
  PanelLeft,
  PanelRight,
  ArrowDownUp,
  Loader2,
  Zap,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CopyButton } from '@/components/ui/copy-button';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';

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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TABS = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'ai', label: 'AI Services', icon: Cpu },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
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
    const settings = settingsRes?.data as unknown as GeneralSettings | undefined;
    if (settings) {
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
      toast.error(err instanceof Error ? err.message : 'Failed to save settings');
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
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : <Save size={16} />}
          {saved ? 'Saved' : 'Save Changes'}
        </button>
        {dirty && <span className="text-xs text-accent-amber">Unsaved changes</span>}
      </div>
    </div>
  );
}

function AiServicesTab() {
  const { data: servicesRes, isLoading, mutate } = useAiServices();
  const { data: chainsRes, error: chainsError } = useApi<FallbackChain[]>('/settings/ai/fallback-chains');

  const [showAddForm, setShowAddForm] = useState(false);
  const [newService, setNewService] = useState({ name: '', type: 'text', endpoint: '' });
  const [adding, setAdding] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const services = (servicesRes?.data as unknown as AiService[]) ?? [];
  const fallbackChains = (chainsRes?.data as unknown as FallbackChain[]) ?? [];

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
      toast.error(err instanceof Error ? err.message : 'Failed to add service');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteService = async (id: string) => {
    try {
      await apiDelete(`/ai-services/${id}`);
      mutate();
      toast.success('Service removed');
    } catch (err) {
      console.error('Failed to remove service:', err);
      toast.error('Failed to remove service');
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
            <button
              onClick={handleTestServices}
              disabled={testingId !== null || services.length === 0}
              className="btn-secondary btn-sm flex items-center gap-1"
            >
              {testingId ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              Test All
            </button>
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
              <button
                onClick={handleAddService}
                disabled={adding || !newService.name || !newService.endpoint}
                className="btn-primary btn-sm flex items-center gap-1"
              >
                {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Add
              </button>
              <button onClick={() => setShowAddForm(false)} className="btn-secondary btn-sm">
                Cancel
              </button>
            </div>
          </div>
        )}

        {services.length === 0 ? (
          <p className="text-text-secondary text-sm py-4 text-center">No AI services registered</p>
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
                  className="text-text-secondary hover:text-accent-red transition-colors p-1"
                  title="Remove service"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fallback Chains */}
      <div>
        <h3 className="text-base font-semibold text-text-primary mb-4">Fallback Chains</h3>
        {chainsError ? (
          <p className="text-accent-red text-sm py-4 text-center">Failed to load fallback chains</p>
        ) : fallbackChains.length === 0 ? (
          <p className="text-text-secondary text-sm py-4 text-center">No fallback chains configured</p>
        ) : (
          <div className="space-y-3">
            {fallbackChains.map((chain) => (
              <div key={chain.type} className="card">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowDownUp size={14} className="text-accent-purple" />
                  <span className="text-sm font-medium text-text-primary capitalize">{chain.type} Chain</span>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {chain.services.map((svc, idx) => (
                    <span key={svc.id} className="flex items-center gap-1">
                      <span className="badge badge-idle text-xs">{svc.name}</span>
                      {idx < chain.services.length - 1 && (
                        <ChevronRight size={12} className="text-text-secondary" />
                      )}
                    </span>
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
    const data = notifRes?.data as unknown as NotificationChannel[] | undefined;
    if (data && data.length > 0) {
      setChannels(data);
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
      toast.error(err instanceof Error ? err.message : 'Failed to save notification settings');
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

      <button
        onClick={handleSave}
        disabled={saving}
        className="btn-primary flex items-center gap-2"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : <Save size={16} />}
        {saved ? 'Saved' : 'Save Changes'}
      </button>
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

  const apiKeys = (keysRes?.data as unknown as ApiKey[]) ?? [];

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
    try {
      await apiPost(`/settings/api-keys/${id}/revoke`);
      mutateKeys();
      setRevokeTarget(null);
      toast.success('API key revoked');
    } catch (err) {
      console.error('Failed to revoke key:', err);
      toast.error('Failed to revoke key');
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
        <form onSubmit={handleChangePassword} className="max-w-md space-y-4">
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
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary p-1"
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
              minLength={8}
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

          <button
            type="submit"
            disabled={passwordSaving}
            className="btn-primary flex items-center gap-2"
          >
            {passwordSaving ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
            Change Password
          </button>
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
          <button
            onClick={handleCreateKey}
            disabled={creatingKey || !newKeyName.trim()}
            className="btn-primary btn-sm flex items-center gap-1"
          >
            {creatingKey ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Generate
          </button>
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
          <p className="text-text-secondary text-sm py-4 text-center">No API keys created</p>
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
                  disabled={key.status === 'revoked'}
                  className={cn('btn-danger btn-sm flex items-center gap-1', key.status === 'revoked' && 'opacity-50 cursor-not-allowed')}
                >
                  <Trash2 size={12} /> Revoke
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
    const settings = appearanceRes?.data as unknown as AppearanceSettings | undefined;
    if (settings) {
      setTheme(settings.theme);
      setSidebarPosition(settings.sidebarPosition);
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
      toast.error(err instanceof Error ? err.message : 'Failed to save appearance settings');
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

      <button
        onClick={handleSave}
        disabled={saving}
        className="btn-primary flex items-center gap-2"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : <Save size={16} />}
        {saved ? 'Saved' : 'Save Changes'}
      </button>
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
