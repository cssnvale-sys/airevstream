'use client';

import { useState, useMemo, useCallback } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { AppLayout } from '@/components/layout/app-layout';
import { useAccounts, useAccount, apiPost, apiPut, apiDelete } from '@/hooks/use-api';
import { exportToCSV } from '@/lib/export';
import { cn, formatRelativeTime, statusColor, platformIcon } from '@/lib/utils';
import {
  Plus, Upload, Search, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  X, Mail, Activity, Hash, Globe, Tag, Palette, User, Trash2,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState as EmptyStateComponent } from '@/components/ui/empty-state';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SocialAccount {
  id: string;
  platform: string;
  username: string | null;
  status: string;
  healthScore: number;
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
  if (score >= 80) return 'text-green-400';
  if (score >= 50) return 'text-yellow-400';
  return 'text-red-400';
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
  return Math.round(socials.reduce((sum, s) => sum + s.healthScore, 0) / socials.length);
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tier, setTier] = useState('tier2');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await apiPost('/accounts', { email, password, tier });
      setEmail('');
      setPassword('');
      setTier('tier2');
      onSuccess();
      onClose();
      toast.success('Account added successfully');
    } catch (err) {
      console.error('Failed to add account:', err);
      setError('Failed to add account');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="card w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-text-primary">Add Email Account</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input w-full"
              placeholder="user@example.com"
              required
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
              required
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
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={submitting || !email.trim() || !password.trim()} className="btn-primary flex-1">
              {submitting ? 'Adding...' : 'Add Account'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </form>
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
      if (err instanceof SyntaxError) {
        setError('Invalid JSON. Please check the format.');
      } else {
        setError(err instanceof Error ? err.message : 'Import failed');
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
        <form onSubmit={handleSubmit} className="space-y-4">
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
          {error && <p className="text-sm text-red-400">{error}</p>}
          {result && (
            <p className="text-sm text-green-400">
              Imported {result.imported}, skipped {result.skipped}.
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={submitting} className="btn-primary flex-1">
              {submitting ? 'Importing...' : 'Import'}
            </button>
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
      <div className="flex-1 overflow-auto p-5">
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
                    <div key={sa.id} className="flex items-center justify-between bg-bg-tertiary rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span>{platformIcon(sa.platform)}</span>
                        <div>
                          <p className="text-sm font-medium text-text-primary">{sa.username ?? sa.platform}</p>
                          <p className="text-xs text-text-secondary">{sa.platform}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={cn('text-xs font-medium', healthColor(sa.healthScore))}>
                          {sa.healthScore}%
                        </span>
                        <span className={cn('text-xs px-1.5 py-0.5 rounded', statusColor(sa.status))}>
                          {sa.status}
                        </span>
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
      toast.error(err instanceof Error ? err.message : 'Failed to delete accounts');
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

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown size={12} className="opacity-30" />;
    return sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  // Pagination helpers
  const startItem = Math.min((meta.page - 1) * meta.limit + 1, meta.total);
  const endItem = Math.min(meta.page * meta.limit, meta.total);

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
          <div className="text-center py-12 text-red-400">
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
                      <span className="flex items-center gap-1">Email <SortIcon field="email" /></span>
                    </th>
                    <th className="px-4 py-3">Socials</th>
                    <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('socialAccountsCount')}>
                      <span className="flex items-center gap-1">Channels <SortIcon field="socialAccountsCount" /></span>
                    </th>
                    <th className="px-4 py-3">Health</th>
                    <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('status')}>
                      <span className="flex items-center gap-1">Status <SortIcon field="status" /></span>
                    </th>
                    <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('tier')}>
                      <span className="flex items-center gap-1">Tier <SortIcon field="tier" /></span>
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
            <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm text-text-secondary">
              <span>
                Showing {startItem}-{endItem} of {meta.total}
              </span>
              <div className="flex items-center gap-3">
                <select
                  value={perPage}
                  onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                  className="input text-xs py-1 px-2"
                >
                  {PER_PAGE_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n} / page</option>
                  ))}
                </select>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="btn-secondary btn-sm p-1 disabled:opacity-30"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: Math.min(meta.pages, 5) }, (_, i) => {
                    let pageNum: number;
                    if (meta.pages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= meta.pages - 2) {
                      pageNum = meta.pages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={cn(
                          'btn-sm w-8 h-8 flex items-center justify-center rounded text-xs',
                          page === pageNum ? 'btn-primary' : 'btn-secondary',
                        )}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage((p) => Math.min(meta.pages, p + 1))}
                    disabled={page >= meta.pages}
                    className="btn-secondary btn-sm p-1 disabled:opacity-30"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
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
