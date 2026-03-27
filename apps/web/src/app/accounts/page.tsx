'use client';

import { useState, useMemo, useCallback } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { AppLayout } from '@/components/layout/app-layout';
import { useAccounts, useAccount, apiPost } from '@/hooks/use-api';
import { exportToCSV } from '@/lib/export';
import { cn, formatRelativeTime, statusColor, platformIcon } from '@/lib/utils';
import {
  Plus, Upload, Search, ChevronDown, ChevronUp,
  X, Mail, Activity, Hash, Globe, Tag, Palette, User, Trash2,
  RefreshCw, HeartPulse, Flame, ArrowLeft, ArrowRight, Rocket,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState as EmptyStateComponent } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { PlatformSelect } from '@/components/accounts/platform-select';
import { AvatarAssignPicker } from '@/components/accounts/avatar-assign-picker';
import { LifecycleStatusPanel } from '@/components/accounts/lifecycle-status-panel';
import { LoadingButton } from '@/components/ui/loading-button';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SocialAccount {
  id: string;
  platform: string;
  username: string | null;
  status: string;
  healthScore: number | null;
}

interface EmailAccount {
  id: string;
  email: string;
  status: string;
  tier: string;
  notes: string | null;
  socialAccounts: SocialAccount[];
  socialAccountsCount: number;
  createdAt: string;
  updatedAt: string;
}

type SortField = 'email' | 'status' | 'tier' | 'createdAt' | 'socialAccountsCount';
type SortOrder = 'asc' | 'desc';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = ['', 'active', 'pending', 'disabled', 'flagged'];
const PLATFORM_OPTIONS = ['', 'youtube', 'tiktok', 'instagram', 'facebook'];
const TIER_OPTIONS = ['', 'tier1', 'tier2', 'tier3'];
const PER_PAGE_OPTIONS = [10, 25, 50];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function healthColor(score: number): string {
  if (score >= 80) return 'text-accent-green';
  if (score >= 50) return 'text-accent-amber';
  return 'text-accent-red';
}

function tierLabel(tier: string): string {
  switch (tier) {
    case 'tier1': return 'Tier 1';
    case 'tier2': return 'Tier 2';
    case 'tier3': return 'Tier 3';
    default: return tier;
  }
}

function accountHealthAvg(socials: SocialAccount[] | undefined): number | null {
  if (!socials || socials.length === 0) return null;
  const withScore = socials.filter((s) => s.healthScore != null);
  if (withScore.length === 0) return null;
  return Math.round(withScore.reduce((sum, s) => sum + (s.healthScore ?? 0), 0) / withScore.length);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <div className="w-5 h-5 animate-pulse bg-bg-tertiary rounded" />
          <div className="flex-1 h-4 animate-pulse bg-bg-tertiary rounded" />
          <div className="w-24 h-4 animate-pulse bg-bg-tertiary rounded" />
          <div className="w-16 h-4 animate-pulse bg-bg-tertiary rounded" />
          <div className="w-20 h-4 animate-pulse bg-bg-tertiary rounded" />
          <div className="w-16 h-4 animate-pulse bg-bg-tertiary rounded" />
        </div>
      ))}
    </div>
  );
}

function AccountsEmptyState({ onAddEmail }: { onAddEmail: () => void }) {
  return (
    <EmptyStateComponent
      icon={Mail}
      title="No accounts found"
      description="Add your first email account to get started."
      actionLabel="Add Email Account"
      onAction={onAddEmail}
    />
  );
}

// ---------------------------------------------------------------------------
// Add Email Modal
// ---------------------------------------------------------------------------

function AddEmailModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tier, setTier] = useState('tier2');
  const [targetPlatforms, setTargetPlatforms] = useState<string[]>([]);
  const [avatarId, setAvatarId] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const resetForm = () => {
    setStep(1);
    setEmail('');
    setPassword('');
    setTier('tier2');
    setTargetPlatforms([]);
    setAvatarId(undefined);
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = { email, password, tier };
      if (targetPlatforms.length > 0) {
        payload.targetPlatforms = targetPlatforms;
        if (avatarId) payload.avatarId = avatarId;
        payload.autoSeasoning = true;
      }
      await apiPost('/accounts', payload);
      resetForm();
      onSuccess();
      onClose();
      toast.success(
        targetPlatforms.length > 0
          ? 'Account added — lifecycle pipeline started'
          : 'Account added successfully',
      );
    } catch (err) {
      console.error('Failed to add account:', err);
      setError('Failed to add account');
    } finally {
      setSubmitting(false);
    }
  };

  const stepTitles = ['Email & Password', 'Select Platforms', 'Assign Avatar', 'Review'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={handleClose}>
      <div className="card w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">{stepTitles[step - 1]}</h2>
          <button onClick={handleClose} className="text-text-secondary hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex gap-1 mb-6">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                s <= step ? 'bg-accent-purple' : 'bg-bg-tertiary',
              )}
            />
          ))}
        </div>

        {/* Step 1: Email & Password */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input w-full"
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input w-full"
                placeholder="Account password"
                minLength={8}
              />
              <p className="text-xs text-text-secondary mt-1">Minimum 8 characters</p>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Tier</label>
              <select value={tier} onChange={(e) => setTier(e.target.value)} className="input w-full">
                <option value="tier1">Tier 1 (Fresh)</option>
                <option value="tier2">Tier 2 (Warmed)</option>
                <option value="tier3">Tier 3 (Established)</option>
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setStep(2)}
                disabled={!email.trim() || !password.trim() || password.length < 8}
                className="btn-primary flex-1 flex items-center justify-center gap-1.5"
              >
                Next <ArrowRight size={16} />
              </button>
              <button type="button" onClick={handleClose} className="btn-secondary">Cancel</button>
            </div>
          </div>
        )}

        {/* Step 2: Select Platforms */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Select platforms to auto-discover, sign up, and warm accounts on.
            </p>
            <PlatformSelect selected={targetPlatforms} onChange={setTargetPlatforms} />
            <div className="flex gap-2 pt-2">
              <button onClick={() => setStep(1)} className="btn-secondary flex items-center gap-1.5">
                <ArrowLeft size={16} /> Back
              </button>
              <button
                onClick={() => setStep(targetPlatforms.length > 0 ? 3 : 4)}
                className="btn-primary flex-1 flex items-center justify-center gap-1.5"
              >
                {targetPlatforms.length > 0 ? 'Next' : 'Skip'} <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Assign Avatar */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Optionally assign an avatar for profile images after signup.
            </p>
            <AvatarAssignPicker selectedId={avatarId} onChange={setAvatarId} />
            <div className="flex gap-2 pt-2">
              <button onClick={() => setStep(2)} className="btn-secondary flex items-center gap-1.5">
                <ArrowLeft size={16} /> Back
              </button>
              <button
                onClick={() => setStep(4)}
                className="btn-primary flex-1 flex items-center justify-center gap-1.5"
              >
                {avatarId ? 'Next' : 'Skip'} <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="rounded-lg bg-zinc-800/50 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-secondary">Email</span>
                <span className="text-text-primary">{email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Tier</span>
                <span className="text-text-primary capitalize">{tier.replace('tier', 'Tier ')}</span>
              </div>
              {targetPlatforms.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">Platforms</span>
                  <span className="text-text-primary capitalize">{targetPlatforms.join(', ')}</span>
                </div>
              )}
              {avatarId && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">Avatar</span>
                  <span className="text-text-primary">Assigned</span>
                </div>
              )}
            </div>
            {targetPlatforms.length > 0 && (
              <p className="text-xs text-text-secondary">
                We&apos;ll check for existing accounts, sign up where needed, and start warming.
                This takes ~21 days to fully season accounts.
              </p>
            )}
            {error && <p className="text-sm text-accent-red">{error}</p>}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setStep(targetPlatforms.length > 0 ? 3 : 2)} className="btn-secondary flex items-center gap-1.5">
                <ArrowLeft size={16} /> Back
              </button>
              <LoadingButton
                onClick={handleSubmit}
                loading={submitting}
                loadingText="Creating..."
                className="btn-primary flex-1 flex items-center justify-center gap-1.5"
              >
                <Rocket size={16} />
                {targetPlatforms.length > 0 ? 'Create & Start Pipeline' : 'Create Account'}
              </LoadingButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bulk Import Modal
// ---------------------------------------------------------------------------

function BulkImportModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [json, setJson] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setSubmitting(true);
    try {
      const parsed = JSON.parse(json);
      const accounts = Array.isArray(parsed) ? parsed : parsed.accounts;
      if (!Array.isArray(accounts)) {
        setError('Expected a JSON array or an object with an "accounts" array.');
        setSubmitting(false);
        return;
      }
      const res = await apiPost<{ data: { imported: number; skipped: number } }>('/accounts/bulk-import', { accounts });
      setResult(res.data);
      onSuccess();
      toast.success(`Imported ${res.data.imported} accounts`);
    } catch (err: unknown) {
      console.error('Bulk import failed:', err);
      if (err instanceof SyntaxError) {
        setError('Invalid JSON. Please check the format.');
      } else {
        setError('Import failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="card w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-text-primary">Bulk Import Accounts</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>
        <form noValidate onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">
              Paste JSON array of accounts
            </label>
            <textarea
              value={json}
              onChange={(e) => setJson(e.target.value)}
              className="input w-full h-40 font-mono text-xs"
              placeholder={`[
  { "email": "user1@example.com", "password": "pass1", "tier": "tier2" },
  { "email": "user2@example.com", "password": "pass2", "tier": "tier1" }
]`}
              required
            />
          </div>
          {error && <p className="text-sm text-accent-red">{error}</p>}
          {result && (
            <p className="text-sm text-accent-green">
              Imported {result.imported}, skipped {result.skipped}.
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <LoadingButton type="submit" loading={submitting} loadingText="Importing..." className="btn-primary flex-1">
              Import
            </LoadingButton>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Account Detail Panel
// ---------------------------------------------------------------------------

interface ChannelDetail {
  id: string;
  name: string;
  primaryLanguage: string;
  niches: string[];
  channelAvatars: { avatar: { id: string; name: string; images: Record<string, string> }; role: string | null }[];
  brandingPackages: { id: string; logoUrl: string | null; colors: Record<string, string> }[];
}

interface DetailSocialAccount extends SocialAccount {
  channels: ChannelDetail[];
}

interface DetailAccount extends Omit<EmailAccount, 'socialAccounts'> {
  socialAccounts: DetailSocialAccount[];
}

function SocialAccountActions({ accountId, socialId }: { accountId: string; socialId: string }) {
  const [acting, setActing] = useState<string | null>(null);
  const [warmPopoverOpen, setWarmPopoverOpen] = useState(false);
  const [warmDuration, setWarmDuration] = useState(30);

  const handleAction = async (action: 'sync' | 'health-check') => {
    setActing(action);
    try {
      await apiPost(`/accounts/${accountId}/socials/${socialId}/${action}`, {});
      toast.success(`${action === 'sync' ? 'Sync' : 'Health check'} started`);
    } catch (err) {
      console.error(`Failed to start ${action}:`, err);
      toast.error(`Failed to start ${action}`);
    } finally {
      setActing(null);
    }
  };

  const handleStartWarm = async () => {
    setActing('warm');
    try {
      await apiPost(`/accounts/${accountId}/socials/${socialId}/warm`, { durationMinutes: warmDuration });
      toast.success(`Warm-up started (${warmDuration} min)`);
      setWarmPopoverOpen(false);
    } catch (err) {
      console.error('Failed to start warm-up:', err);
      toast.error('Failed to start warm-up');
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={(e) => { e.stopPropagation(); handleAction('sync'); }}
        disabled={acting !== null}
        title="Sync"
        className="p-1 rounded text-text-secondary hover:text-accent-blue hover:bg-bg-primary transition-colors"
      >
        <RefreshCw size={12} className={acting === 'sync' ? 'animate-spin' : ''} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); handleAction('health-check'); }}
        disabled={acting !== null}
        title="Health Check"
        className="p-1 rounded text-text-secondary hover:text-accent-green hover:bg-bg-primary transition-colors"
      >
        <HeartPulse size={12} />
      </button>
      <div className="relative">
        <button
          onClick={(e) => { e.stopPropagation(); setWarmPopoverOpen((v) => !v); }}
          disabled={acting !== null}
          title="Warm Up"
          className="p-1 rounded text-text-secondary hover:text-accent-amber hover:bg-bg-primary transition-colors"
        >
          <Flame size={12} />
        </button>
        {warmPopoverOpen && (
          <>
            {/* Invisible backdrop to close popover */}
            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setWarmPopoverOpen(false); }} />
            <div
              className="absolute right-0 bottom-full mb-2 z-50 w-56 bg-bg-secondary border border-border rounded-lg shadow-xl p-3"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-xs font-medium text-text-primary mb-2">Warm-up Duration</p>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="range"
                  min={15}
                  max={120}
                  step={5}
                  value={warmDuration}
                  onChange={(e) => setWarmDuration(Number(e.target.value))}
                  className="flex-1 accent-accent-amber h-1.5 cursor-pointer"
                />
                <span className="text-xs font-medium text-text-primary w-12 text-right tabular-nums">
                  {warmDuration} min
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-text-secondary mb-3">
                <span>15 min</span>
                <span>120 min</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleStartWarm}
                  disabled={acting === 'warm'}
                  className="btn-primary btn-sm flex-1 text-xs"
                >
                  {acting === 'warm' ? 'Starting...' : 'Start Warm-up'}
                </button>
                <button
                  onClick={() => setWarmPopoverOpen(false)}
                  className="btn-secondary btn-sm text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DetailPanel({
  accountId,
  onClose,
}: {
  accountId: string;
  onClose: () => void;
}) {
  const { data, isLoading } = useAccount(accountId);
  const [tab, setTab] = useState<'overview' | 'channels' | 'assets'>('overview');

  const account = (data?.data ?? undefined) as DetailAccount | undefined;

  const allChannels = useMemo(
    () => account?.socialAccounts?.flatMap((sa: DetailSocialAccount) => sa.channels?.map((ch: ChannelDetail) => ({ ...ch, platform: sa.platform, socialUsername: sa.username })) ?? []) ?? [],
    [account],
  );

  const allAvatars = useMemo(
    () => allChannels.flatMap((ch) => ch.channelAvatars?.map((ca: ChannelDetail['channelAvatars'][number]) => ({ ...ca.avatar, role: ca.role, channelName: ch.name })) ?? []),
    [allChannels],
  );

  const tabs = [
    { key: 'overview' as const, label: 'Overview' },
    { key: 'channels' as const, label: 'Channels' },
    { key: 'assets' as const, label: 'Assets' },
  ];

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md bg-bg-secondary border-l border-border shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h3 className="font-semibold text-text-primary truncate">
          {isLoading ? 'Loading...' : account?.email ?? 'Account Detail'}
        </h3>
        <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex-1 px-4 py-2.5 text-sm font-medium transition-colors',
              tab === t.key
                ? 'text-text-primary border-b-2 border-accent-blue'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div role="tabpanel" className="flex-1 overflow-auto p-5">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse bg-bg-tertiary rounded" />
            ))}
          </div>
        ) : !account ? (
          <p className="text-text-secondary text-sm">Account not found.</p>
        ) : tab === 'overview' ? (
          <div className="space-y-6">
            {/* Status / Tier */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-bg-tertiary rounded-lg p-3">
                <p className="text-xs text-text-secondary mb-1">Status</p>
                <span className={cn('text-sm font-medium px-2 py-0.5 rounded', statusColor(account.status))}>
                  {account.status}
                </span>
              </div>
              <div className="bg-bg-tertiary rounded-lg p-3">
                <p className="text-xs text-text-secondary mb-1">Tier</p>
                <p className="text-sm font-medium text-text-primary">{tierLabel(account.tier)}</p>
              </div>
            </div>

            {/* Connected Socials */}
            <div>
              <h4 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
                <Globe size={14} /> Connected Socials
              </h4>
              {account.socialAccounts.length === 0 ? (
                <p className="text-sm text-text-secondary">No social accounts connected.</p>
              ) : (
                <div className="space-y-2">
                  {account.socialAccounts.map((sa) => (
                    <div key={sa.id} className="bg-bg-tertiary rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>{platformIcon(sa.platform)}</span>
                          <div>
                            <p className="text-sm font-medium text-text-primary">{sa.username ?? sa.platform}</p>
                            <p className="text-xs text-text-secondary">{sa.platform}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={cn('text-xs font-medium', healthColor(sa.healthScore ?? 0))}>
                            {sa.healthScore != null ? `${sa.healthScore}%` : '--'}
                          </span>
                          <span className={cn('text-xs px-1.5 py-0.5 rounded', statusColor(sa.status))}>
                            {sa.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-end mt-1 border-t border-border/30 pt-1">
                        <SocialAccountActions accountId={account.id} socialId={sa.id} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Health Metrics */}
            <div>
              <h4 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
                <Activity size={14} /> Health Metrics
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-bg-tertiary rounded-lg p-3 text-center">
                  <p className="text-xs text-text-secondary">Avg Health</p>
                  <p className={cn('text-lg font-bold', healthColor(accountHealthAvg(account.socialAccounts) ?? 0))}>
                    {accountHealthAvg(account.socialAccounts) ?? '--'}%
                  </p>
                </div>
                <div className="bg-bg-tertiary rounded-lg p-3 text-center">
                  <p className="text-xs text-text-secondary">Total Channels</p>
                  <p className="text-lg font-bold text-text-primary">{allChannels.length}</p>
                </div>
              </div>
            </div>

            {/* Lifecycle Pipeline */}
            <div>
              <h4 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
                <Rocket size={14} /> Lifecycle Pipeline
              </h4>
              <LifecycleStatusPanel emailAccountId={accountId} />
            </div>

            {/* Niche Tags */}
            {allChannels.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
                  <Tag size={14} /> Niche Tags
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {[...new Set(allChannels.flatMap((ch) => ch.niches ?? []))].map((niche) => (
                    <span key={niche} className="badge-idle text-xs px-2 py-0.5 rounded">
                      {niche}
                    </span>
                  ))}
                  {allChannels.every((ch) => !ch.niches?.length) && (
                    <p className="text-sm text-text-secondary">No niches assigned.</p>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {account.notes && (
              <div>
                <h4 className="text-sm font-medium text-text-primary mb-2">Notes</h4>
                <p className="text-sm text-text-secondary bg-bg-tertiary rounded-lg p-3">{account.notes}</p>
              </div>
            )}

            {/* Timestamps */}
            <div className="text-xs text-text-secondary space-y-1 pt-2 border-t border-border">
              <p>Created: {formatRelativeTime(account.createdAt)}</p>
              <p>Updated: {formatRelativeTime(account.updatedAt)}</p>
            </div>
          </div>
        ) : tab === 'channels' ? (
          <div className="space-y-3">
            {allChannels.length === 0 ? (
              <p className="text-sm text-text-secondary py-8 text-center">No channels found for this account.</p>
            ) : (
              allChannels.map((ch) => (
                <div key={ch.id} className="bg-bg-tertiary rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span>{platformIcon(ch.platform)}</span>
                    <h5 className="font-medium text-text-primary text-sm">{ch.name}</h5>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-text-secondary">
                    <div className="flex items-center gap-1">
                      <Globe size={12} />
                      <span>{ch.primaryLanguage.toUpperCase()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <User size={12} />
                      <span>{ch.socialUsername ?? 'N/A'}</span>
                    </div>
                  </div>
                  {ch.niches.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {ch.niches.map((n) => (
                        <span key={n} className="badge-idle text-xs px-1.5 py-0.5 rounded">{n}</span>
                      ))}
                    </div>
                  )}
                  {ch.channelAvatars && ch.channelAvatars.length > 0 && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-text-secondary">
                      <User size={12} />
                      <span>{ch.channelAvatars.length} avatar{ch.channelAvatars.length !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          /* Assets tab */
          <div className="space-y-6">
            {/* Avatars */}
            <div>
              <h4 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
                <User size={14} /> Avatars
              </h4>
              {allAvatars.length === 0 ? (
                <p className="text-sm text-text-secondary">No avatars assigned.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {allAvatars.map((avatar, idx) => (
                    <div key={`${avatar.id}-${idx}`} className="bg-bg-tertiary rounded-lg p-2 text-center">
                      <div className="w-full aspect-square bg-bg-primary rounded-md mb-1.5 flex items-center justify-center">
                        <User className="text-text-secondary opacity-30" size={24} />
                      </div>
                      <p className="text-xs font-medium text-text-primary truncate">{avatar.name}</p>
                      {avatar.role && (
                        <p className="text-xs text-text-secondary truncate">{avatar.role}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Branding */}
            <div>
              <h4 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
                <Palette size={14} /> Branding Packages
              </h4>
              {allChannels.every((ch) => !ch.brandingPackages || ch.brandingPackages.length === 0) ? (
                <p className="text-sm text-text-secondary">No branding packages configured.</p>
              ) : (
                <div className="space-y-2">
                  {allChannels
                    .filter((ch) => ch.brandingPackages && ch.brandingPackages.length > 0)
                    .map((ch) =>
                      ch.brandingPackages?.map((bp) => (
                        <div key={bp.id} className="bg-bg-tertiary rounded-lg p-3">
                          <p className="text-sm font-medium text-text-primary mb-1">{ch.name}</p>
                          <div className="flex items-center gap-2">
                            {Object.entries(bp.colors).map(([key, val]) => (
                              <div key={key} className="flex items-center gap-1">
                                <div className="w-4 h-4 rounded-sm border border-border" style={{ backgroundColor: val as string }} />
                                <span className="text-xs text-text-secondary">{key}</span>
                              </div>
                            ))}
                            {Object.keys(bp.colors).length === 0 && (
                              <span className="text-xs text-text-secondary">No colors defined</span>
                            )}
                          </div>
                        </div>
                      )),
                    )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sort indicator — extracted to module scope to avoid re-creation on every render
// ---------------------------------------------------------------------------

function SortIcon({ field, sortField, sortOrder }: { field: SortField; sortField: SortField; sortOrder: string }) {
  if (sortField !== field) return <ChevronDown size={12} className="opacity-30" />;
  return sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AccountsPage() {
  // Filters
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('');
  const [filterTier, setFilterTier] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  // Sorting
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);

  // Modals
  const [showAddEmail, setShowAddEmail] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // Build query params
  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set('page', String(page));
    p.set('limit', String(perPage));
    p.set('sort', sortField === 'socialAccountsCount' ? 'createdAt' : sortField);
    p.set('order', sortOrder);
    if (debouncedSearch) p.set('search', debouncedSearch);
    if (filterStatus) p.set('status', filterStatus);
    if (filterTier) p.set('tier', filterTier);
    return p.toString();
  }, [page, perPage, sortField, sortOrder, debouncedSearch, filterStatus, filterTier]);

  const { data, isLoading, error, mutate } = useAccounts(queryParams);

  const accounts = (data?.data ?? []) as EmailAccount[];
  const meta = data?.meta ?? { total: 0, page: 1, limit: perPage, pages: 1 };

  // Filter by platform client-side since API doesn't support it directly
  const filteredAccounts = useMemo(() => {
    if (!filterPlatform) return accounts;
    return accounts.filter((a) =>
      a.socialAccounts?.some((sa) => sa.platform === filterPlatform),
    );
  }, [accounts, filterPlatform]);

  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortOrder('asc');
      return field;
    });
    setPage(1);
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredAccounts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAccounts.map((a) => a.id)));
    }
  }, [selectedIds.size, filteredAccounts]);

  const handleRefresh = useCallback(() => {
    mutate();
  }, [mutate]);

  // Bulk actions
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const handleBulkDelete = useCallback(async () => {
    setBulkDeleting(true);
    try {
      await apiPost('/accounts/bulk-delete', { ids: Array.from(selectedIds) });
      setSelectedIds(new Set());
      setShowBulkDelete(false);
      mutate();
      toast.success(`Deleted ${selectedIds.size} accounts`);
    } catch (err) {
      console.error('Failed to delete accounts:', err);
      toast.error('Failed to delete accounts');
    } finally {
      setBulkDeleting(false);
    }
  }, [selectedIds, mutate]);

  const handleBulkExport = useCallback(() => {
    const selected = filteredAccounts.filter((a) => selectedIds.has(a.id));
    exportToCSV(selected, [
      { header: 'Email', accessor: 'email' },
      { header: 'Status', accessor: 'status' },
      { header: 'Tier', accessor: 'tier' },
      { header: 'Social Accounts', accessor: (a) => a.socialAccounts?.length ?? 0 },
      { header: 'Created', accessor: 'createdAt' },
    ], 'accounts-export.csv');
    toast.success(`Exported ${selected.length} accounts`);
  }, [filteredAccounts, selectedIds]);


  // Pagination helpers

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Accounts</h1>
          <p className="text-text-secondary text-sm mt-1">Manage email accounts and connected socials</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)} className="btn-secondary flex items-center gap-2">
            <Upload size={14} /> Import
          </button>
          <button onClick={() => setShowAddEmail(true)} className="btn-primary flex items-center gap-2">
            <Plus size={14} /> Add Email
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by email or notes..."
              className="input w-full pl-9"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            className="input"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.filter(Boolean).map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <select
            value={filterPlatform}
            onChange={(e) => { setFilterPlatform(e.target.value); setPage(1); }}
            className="input"
          >
            <option value="">All Platforms</option>
            {PLATFORM_OPTIONS.filter(Boolean).map((p) => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
          <select
            value={filterTier}
            onChange={(e) => { setFilterTier(e.target.value); setPage(1); }}
            className="input"
          >
            <option value="">All Tiers</option>
            {TIER_OPTIONS.filter(Boolean).map((t) => (
              <option key={t} value={t}>{tierLabel(t)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Bulk Action Toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-4 px-4 py-3 bg-accent-blue/10 border border-accent-blue/20 rounded-lg">
          <span className="text-sm font-medium text-accent-blue">
            {selectedIds.size} selected
          </span>
          <div className="flex-1" />
          <button onClick={handleBulkExport} className="btn-secondary btn-sm flex items-center gap-1.5">
            <Upload size={14} /> Export CSV
          </button>
          <button
            onClick={() => setShowBulkDelete(true)}
            className="btn-danger btn-sm flex items-center gap-1.5"
          >
            <Trash2 size={14} /> Delete Selected
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-text-secondary hover:text-text-primary text-sm"
          >
            Clear
          </button>
        </div>
      )}

      {/* Account Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <TableSkeleton />
        ) : error ? (
          <div className="text-center py-12 text-accent-red">
            <p>Failed to load accounts.</p>
            <button onClick={handleRefresh} className="btn-secondary btn-sm mt-3">Retry</button>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <AccountsEmptyState onAddEmail={() => setShowAddEmail(true)} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-text-secondary text-left">
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === filteredAccounts.length && filteredAccounts.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-border"
                        aria-label="Select all accounts"
                      />
                    </th>
                    <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('email')}>
                      <span className="flex items-center gap-1">Email <SortIcon field="email" sortField={sortField} sortOrder={sortOrder} /></span>
                    </th>
                    <th className="px-4 py-3">Socials</th>
                    <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('socialAccountsCount')}>
                      <span className="flex items-center gap-1">Channels <SortIcon field="socialAccountsCount" sortField={sortField} sortOrder={sortOrder} /></span>
                    </th>
                    <th className="px-4 py-3">Health</th>
                    <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('status')}>
                      <span className="flex items-center gap-1">Status <SortIcon field="status" sortField={sortField} sortOrder={sortOrder} /></span>
                    </th>
                    <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('tier')}>
                      <span className="flex items-center gap-1">Tier <SortIcon field="tier" sortField={sortField} sortOrder={sortOrder} /></span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.map((account) => {
                    const health = accountHealthAvg(account.socialAccounts ?? []);
                    const channelCount = account.socialAccountsCount ?? account.socialAccounts?.length ?? 0;

                    return (
                      <tr
                        key={account.id}
                        onClick={() => setDetailId(account.id)}
                        className={cn(
                          'border-b border-border/50 cursor-pointer transition-colors hover:bg-bg-tertiary/50',
                          detailId === account.id && 'bg-bg-tertiary/70',
                        )}
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(account.id)}
                            onChange={() => toggleSelect(account.id)}
                            className="rounded border-border"
                            aria-label={`Select ${account.email}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Mail size={14} className="text-text-secondary flex-shrink-0" />
                            <span className="font-medium text-text-primary truncate max-w-[220px]">{account.email}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {(account.socialAccounts ?? []).length > 0
                              ? account.socialAccounts.map((sa) => (
                                  <span key={sa.id} title={`${sa.platform}: ${sa.username ?? 'N/A'}`}>
                                    {platformIcon(sa.platform)}
                                  </span>
                                ))
                              : <span className="text-text-secondary text-xs">None</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-text-secondary">
                            <Hash size={12} />
                            <span>{channelCount}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {health !== null ? (
                            <span className={cn('font-medium', healthColor(health))}>{health}%</span>
                          ) : (
                            <span className="text-text-secondary">--</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('text-xs font-medium px-2 py-0.5 rounded', statusColor(account.status))}>
                            {account.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-text-secondary text-xs">
                          {tierLabel(account.tier)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <Pagination
              page={page}
              totalPages={meta.pages}
              total={meta.total}
              limit={perPage}
              onPageChange={setPage}
              onLimitChange={(n) => { setPerPage(n); setPage(1); }}
              limitOptions={PER_PAGE_OPTIONS}
              className="px-4 py-3 border-t border-border"
            />
          </>
        )}
      </div>

      {/* Bulk Delete Confirm */}
      <ConfirmDialog
        open={showBulkDelete}
        title="Delete Selected Accounts"
        message={`Are you sure you want to delete ${selectedIds.size} account(s)? This will also remove all connected social accounts. This action cannot be undone.`}
        confirmLabel={`Delete ${selectedIds.size} Account(s)`}
        variant="danger"
        onConfirm={handleBulkDelete}
        onCancel={() => setShowBulkDelete(false)}
        loading={bulkDeleting}
      />

      {/* Modals */}
      <AddEmailModal
        open={showAddEmail}
        onClose={() => setShowAddEmail(false)}
        onSuccess={handleRefresh}
      />
      <BulkImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onSuccess={handleRefresh}
      />

      {/* Detail Panel */}
      {detailId && (
        <>
          <div className="fixed inset-0 z-30 bg-black/30" onClick={() => setDetailId(null)} />
          <DetailPanel accountId={detailId} onClose={() => setDetailId(null)} />
        </>
      )}
    </AppLayout>
  );
}
