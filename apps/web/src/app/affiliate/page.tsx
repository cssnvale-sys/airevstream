'use client';

import { useState, useMemo, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useApi, useAffiliateProducts, useChannels, apiPost, apiPut, apiDelete } from '@/hooks/use-api';
import { cn, formatNumber, formatCurrency, formatRelativeTime, statusColor } from '@/lib/utils';
import {
  Plus,
  Search,
  Link2,
  ExternalLink,
  X,
  Star,
  Trash2,
  Package,
  BarChart3,
  Layers,
  MousePointerClick,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AffiliateProduct {
  id: string;
  name: string;
  url: string;
  shortUrl: string | null;
  salesAngle: string | null;
  commissionRate: number | null;
  category: string | null;
  description: string | null;
  brand: string | null;
  imageUrl: string | null;
  status: string;
  totalClicks: number;
  totalConversions: number;
  totalRevenue: number;
  createdAt: string;
  updatedAt: string;
  _count?: { channelPools: number; clicks: number };
  channelPools?: Array<{
    channel: { id: string; name: string };
    isAutoSuggested: boolean;
    performanceScore: number;
    lastUsedAt: string | null;
  }>;
}

interface Channel {
  id: string;
  name: string;
  status: string;
  socialAccount?: { platform: string; username: string } | null;
}

interface AffiliateLink {
  id: string;
  name: string;
  url: string;
  shortUrl: string | null;
  category: string | null;
  totalClicks: number;
  createdAt: string;
}

interface PoolEntry extends AffiliateProduct {
  isAutoSuggested: boolean;
  performanceScore: number;
  lastUsedAt: string | null;
}

interface RevenueByChannel {
  channelId: string | null;
  channelName: string;
  revenue: number;
  conversions: number;
}

interface RevenueByProduct {
  productId: string;
  productName: string;
  category: string | null;
  revenue: number;
  conversions: number;
}

interface RevenueSummary {
  totalRevenue: number;
  totalConversions: number;
  totalClicks: number;
  conversionRate: number;
}

interface RevenueData {
  summary: RevenueSummary;
  byChannel: RevenueByChannel[];
  byProduct: RevenueByProduct[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type TabKey = 'products' | 'pools' | 'links' | 'performance';

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'products', label: 'Products', icon: Package },
  { key: 'pools', label: 'Channel Pools', icon: Layers },
  { key: 'links', label: 'Links', icon: Link2 },
  { key: 'performance', label: 'Performance', icon: BarChart3 },
];

const CATEGORIES = [
  'All',
  'Software',
  'SaaS',
  'Course',
  'Physical',
  'Service',
  'Digital',
  'Subscription',
  'Other',
];

const STATUSES = ['All', 'active', 'inactive', 'expired'];

// ---------------------------------------------------------------------------
// Skeleton helpers
// ---------------------------------------------------------------------------

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="border-b border-border">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-bg-tertiary rounded animate-pulse w-3/4" />
        </td>
      ))}
    </tr>
  );
}

function SkeletonCard() {
  return (
    <div className="card space-y-3 animate-pulse">
      <div className="h-4 bg-bg-tertiary rounded w-2/3" />
      <div className="h-3 bg-bg-tertiary rounded w-1/2" />
      <div className="h-3 bg-bg-tertiary rounded w-1/3" />
    </div>
  );
}

function TableSkeleton({ rows, cols }: { rows: number; cols: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} cols={cols} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Modal wrapper
// ---------------------------------------------------------------------------

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-bg-secondary border border-border rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          <button onClick={onClose} className="btn-ghost p-1">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AffiliatePage() {
  const [activeTab, setActiveTab] = useState<TabKey>('products');

  // --- Products state ---
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<AffiliateProduct | null>(null);

  // --- Channel Pools state ---
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  // --- Links state ---
  const [showCreateLink, setShowCreateLink] = useState(false);

  // Build query params for products
  const productParams = useMemo(() => {
    const p = new URLSearchParams();
    if (searchQuery) p.set('search', searchQuery);
    if (categoryFilter !== 'All') p.set('category', categoryFilter);
    if (statusFilter !== 'All') p.set('status', statusFilter);
    p.set('limit', '50');
    return p.toString();
  }, [searchQuery, categoryFilter, statusFilter]);

  // Data hooks
  const {
    data: productsRes,
    isLoading: productsLoading,
    mutate: mutateProducts,
  } = useAffiliateProducts(productParams);

  const {
    data: channelsRes,
    isLoading: channelsLoading,
  } = useChannels();

  const {
    data: linksRes,
    isLoading: linksLoading,
    mutate: mutateLinks,
  } = useApi<AffiliateLink[]>(activeTab === 'links' ? '/affiliate/links' : null);

  const {
    data: revenueRes,
    isLoading: revenueLoading,
  } = useApi<RevenueData>(activeTab === 'performance' ? '/affiliate/revenue' : null);

  const {
    data: poolRes,
    isLoading: poolLoading,
    mutate: mutatePool,
  } = useApi<PoolEntry[]>(
    activeTab === 'pools' && selectedChannelId
      ? `/channels/${selectedChannelId}/affiliate-pool`
      : null,
  );

  const products: AffiliateProduct[] = productsRes?.data as unknown as AffiliateProduct[] ?? [];
  const channels: Channel[] = (channelsRes?.data as unknown as Channel[]) ?? [];
  const links: AffiliateLink[] = (linksRes?.data as unknown as AffiliateLink[]) ?? [];
  const poolProducts: PoolEntry[] = (poolRes?.data as unknown as PoolEntry[]) ?? [];
  const revenue: RevenueData | null = (revenueRes?.data as unknown as RevenueData) ?? null;

  // Channel pools: products not already assigned
  const unassignedProducts = useMemo(() => {
    const assignedIds = new Set(poolProducts.map((p) => p.id));
    return products.filter((p) => !assignedIds.has(p.id));
  }, [products, poolProducts]);

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Affiliate Manager</h1>
          <p className="text-text-secondary mt-1">
            Manage products, links, and track performance
          </p>
        </div>
        <button
          onClick={() => setShowAddProduct(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} /> Add Product
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
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

      {/* Tab Content */}
      {activeTab === 'products' && (
        <ProductsTab
          products={products}
          loading={productsLoading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          onSelectProduct={setSelectedProduct}
        />
      )}

      {activeTab === 'pools' && (
        <ChannelPoolsTab
          channels={channels}
          channelsLoading={channelsLoading}
          selectedChannelId={selectedChannelId}
          onSelectChannel={setSelectedChannelId}
          poolProducts={poolProducts}
          poolLoading={poolLoading}
          suggestedProducts={unassignedProducts}
          onAddToPool={async (productId: string) => {
            if (!selectedChannelId) return;
            try {
              await apiPost(`/channels/${selectedChannelId}/affiliate-pool`, {
                affiliateProductId: productId,
              });
              mutatePool();
              toast.success('Product added to pool');
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Failed to add product to pool');
            }
          }}
          onRemoveFromPool={async (productId: string) => {
            if (!selectedChannelId) return;
            try {
              await apiDelete(`/channels/${selectedChannelId}/affiliate-pool?affiliateProductId=${productId}`);
              mutatePool();
              toast.success('Product removed from pool');
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Failed to remove product from pool');
            }
          }}
        />
      )}

      {activeTab === 'links' && (
        <LinksTab
          links={links}
          loading={linksLoading}
          onCreateLink={() => setShowCreateLink(true)}
        />
      )}

      {activeTab === 'performance' && (
        <PerformanceTab
          revenue={revenue}
          loading={revenueLoading}
          channels={channels}
          products={products}
        />
      )}

      {/* Add Product Modal */}
      <AddProductModal
        open={showAddProduct}
        onClose={() => setShowAddProduct(false)}
        onCreated={() => {
          setShowAddProduct(false);
          mutateProducts();
        }}
      />

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onUpdated={() => {
          setSelectedProduct(null);
          mutateProducts();
        }}
      />

      {/* Create Link Modal */}
      <CreateLinkModal
        open={showCreateLink}
        products={products}
        onClose={() => setShowCreateLink(false)}
        onCreated={() => {
          setShowCreateLink(false);
          mutateLinks();
        }}
      />
    </AppLayout>
  );
}

// ---------------------------------------------------------------------------
// Products Tab
// ---------------------------------------------------------------------------

function ProductsTab({
  products,
  loading,
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  statusFilter,
  onStatusChange,
  onSelectProduct,
}: {
  products: AffiliateProduct[];
  loading: boolean;
  searchQuery: string;
  onSearchChange: (v: string) => void;
  categoryFilter: string;
  onCategoryChange: (v: string) => void;
  statusFilter: string;
  onStatusChange: (v: string) => void;
  onSelectProduct: (p: AffiliateProduct) => void;
}) {
  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
          />
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="input w-full pl-9"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="input"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c === 'All' ? 'All Categories' : c}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className="input"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === 'All' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg-tertiary text-text-secondary text-left">
              <th className="px-4 py-3 font-medium w-10" />
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Commission</th>
              <th className="px-4 py-3 font-medium text-right">Clicks</th>
              <th className="px-4 py-3 font-medium text-right">Revenue</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton rows={6} cols={7} />
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-text-secondary">
                  No products found. Add your first affiliate product to get started.
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr
                  key={product.id}
                  onClick={() => onSelectProduct(product)}
                  className="border-b border-border hover:bg-bg-tertiary/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="w-8 h-8 rounded bg-bg-tertiary flex items-center justify-center text-text-secondary">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt=""
                          className="w-8 h-8 rounded object-cover"
                        />
                      ) : (
                        <Package size={14} />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-text-primary">{product.name}</div>
                    {product.brand && (
                      <div className="text-xs text-text-secondary">{product.brand}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge-idle text-xs">
                      {product.category ?? 'Uncategorized'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-primary">
                    {product.commissionRate != null
                      ? `${Number(product.commissionRate)}%`
                      : '--'}
                  </td>
                  <td className="px-4 py-3 text-right text-text-primary">
                    {formatNumber(product.totalClicks)}
                  </td>
                  <td className="px-4 py-3 text-right text-accent-green font-medium">
                    {formatCurrency(Number(product.totalRevenue))}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded', statusColor(product.status))}>
                      {product.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Channel Pools Tab
// ---------------------------------------------------------------------------

function ChannelPoolsTab({
  channels,
  channelsLoading,
  selectedChannelId,
  onSelectChannel,
  poolProducts,
  poolLoading,
  suggestedProducts,
  onAddToPool,
  onRemoveFromPool,
}: {
  channels: Channel[];
  channelsLoading: boolean;
  selectedChannelId: string | null;
  onSelectChannel: (id: string | null) => void;
  poolProducts: PoolEntry[];
  poolLoading: boolean;
  suggestedProducts: AffiliateProduct[];
  onAddToPool: (productId: string) => Promise<void>;
  onRemoveFromPool: (productId: string) => Promise<void>;
}) {
  const [addingId, setAddingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleAdd = async (productId: string) => {
    setAddingId(productId);
    await onAddToPool(productId);
    setAddingId(null);
  };

  const handleRemove = async (productId: string) => {
    setRemovingId(productId);
    await onRemoveFromPool(productId);
    setRemovingId(null);
  };

  return (
    <div>
      {/* Channel selector */}
      <div className="mb-6">
        <label className="block text-sm text-text-secondary mb-1.5">Select Channel</label>
        {channelsLoading ? (
          <div className="h-10 bg-bg-tertiary rounded animate-pulse w-64" />
        ) : (
          <select
            value={selectedChannelId ?? ''}
            onChange={(e) => onSelectChannel(e.target.value || null)}
            className="input w-full max-w-sm"
          >
            <option value="">-- Choose a channel --</option>
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.name}
                {ch.socialAccount ? ` (@${ch.socialAccount.username})` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {!selectedChannelId ? (
        <div className="text-center py-12 text-text-secondary">
          Select a channel above to manage its affiliate product pool.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Assigned products */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3 uppercase tracking-wide">
              Assigned Products ({poolProducts.length})
            </h3>
            {poolLoading ? (
              <div className="space-y-3">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : poolProducts.length === 0 ? (
              <div className="card text-center text-text-secondary py-8">
                No products assigned to this channel yet.
              </div>
            ) : (
              <div className="space-y-2">
                {poolProducts.map((product) => (
                  <div
                    key={product.id}
                    className="card flex items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-text-primary truncate">
                        {product.name}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-text-secondary mt-1">
                        <span>{product.category ?? 'Uncategorized'}</span>
                        {product.commissionRate != null && (
                          <span>{Number(product.commissionRate)}% commission</span>
                        )}
                        <span>Score: {Number(product.performanceScore ?? 0)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemove(product.id)}
                      disabled={removingId === product.id}
                      className="btn-danger btn-sm flex items-center gap-1"
                    >
                      {removingId === product.id ? (
                        <span className="animate-spin h-3 w-3 border border-current border-t-transparent rounded-full" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Suggested / available products */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3 uppercase tracking-wide">
              Suggested Products ({suggestedProducts.length})
            </h3>
            {suggestedProducts.length === 0 ? (
              <div className="card text-center text-text-secondary py-8">
                All products are already assigned to this channel.
              </div>
            ) : (
              <div className="space-y-2">
                {suggestedProducts.map((product) => (
                  <div
                    key={product.id}
                    className="card flex items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-text-primary truncate">
                        {product.name}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-text-secondary mt-1">
                        <span>{product.category ?? 'Uncategorized'}</span>
                        {product.commissionRate != null && (
                          <span>{Number(product.commissionRate)}%</span>
                        )}
                        <span>{formatCurrency(Number(product.totalRevenue))} rev</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAdd(product.id)}
                      disabled={addingId === product.id}
                      className="btn-primary btn-sm flex items-center gap-1"
                    >
                      {addingId === product.id ? (
                        <span className="animate-spin h-3 w-3 border border-current border-t-transparent rounded-full" />
                      ) : (
                        <Plus size={14} />
                      )}
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Links Tab
// ---------------------------------------------------------------------------

function LinksTab({
  links,
  loading,
  onCreateLink,
}: {
  links: AffiliateLink[];
  loading: boolean;
  onCreateLink: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-text-secondary">
          Shortened affiliate links for tracking clicks.
        </p>
        <button onClick={onCreateLink} className="btn-secondary flex items-center gap-2 text-sm">
          <Link2 size={14} /> Create Link
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg-tertiary text-text-secondary text-left">
              <th className="px-4 py-3 font-medium">Original URL</th>
              <th className="px-4 py-3 font-medium">Short URL</th>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium text-right">Clicks</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton rows={5} cols={5} />
            ) : links.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-text-secondary">
                  No affiliate links created yet.
                </td>
              </tr>
            ) : (
              links.map((link) => (
                <tr
                  key={link.id}
                  className="border-b border-border hover:bg-bg-tertiary/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 max-w-xs">
                      <span className="truncate text-text-primary">{link.url}</span>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-text-secondary hover:text-accent-blue flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {link.shortUrl ? (
                      <div className="flex items-center gap-2">
                        <code className="text-accent-blue text-xs bg-bg-tertiary px-2 py-0.5 rounded">
                          {link.shortUrl}
                        </code>
                      </div>
                    ) : (
                      <span className="text-text-secondary">--</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-primary">{link.name}</td>
                  <td className="px-4 py-3 text-right text-text-primary">
                    {formatNumber(link.totalClicks)}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {formatRelativeTime(link.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Performance Tab
// ---------------------------------------------------------------------------

function PerformanceTab({
  revenue,
  loading,
  channels,
  products,
}: {
  revenue: RevenueData | null;
  loading: boolean;
  channels: Channel[];
  products: AffiliateProduct[];
}) {
  // Build product x channel matrix from revenue data
  const matrix = useMemo(() => {
    if (!revenue) return { rows: [], channelNames: [], bestCell: null as { productId: string; channelName: string } | null };

    const channelNames = revenue.byChannel.map((c) => c.channelName);
    const productRows = revenue.byProduct.map((p) => ({
      productId: p.productId,
      productName: p.productName,
      category: p.category,
      totalRevenue: Number(p.revenue),
    }));

    // We don't have a cross-product-channel breakdown from the API,
    // so we show a simplified matrix using available data.
    // Find the best performer overall
    let bestProduct: string | null = null;
    let bestChannel: string | null = null;
    let bestRevenue = 0;

    for (const bp of revenue.byProduct) {
      if (bp.revenue > bestRevenue) {
        bestRevenue = bp.revenue;
        bestProduct = bp.productId;
      }
    }

    for (const bc of revenue.byChannel) {
      if (bc.revenue > bestRevenue / 2) {
        bestChannel = bc.channelName;
      }
    }

    return {
      rows: productRows,
      channelNames,
      bestCell: bestProduct && bestChannel
        ? { productId: bestProduct, channelName: bestChannel }
        : null,
    };
  }, [revenue]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <div className="card animate-pulse">
          <div className="h-48 bg-bg-tertiary rounded" />
        </div>
      </div>
    );
  }

  if (!revenue) {
    return (
      <div className="text-center py-12 text-text-secondary">
        No performance data available yet. Start tracking affiliate clicks to see results.
      </div>
    );
  }

  const { summary } = revenue;

  return (
    <div className="space-y-6">
      {/* Performance Matrix */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-3 uppercase tracking-wide">
          Product x Channel Matrix
        </h3>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg-tertiary text-text-secondary text-left">
                <th className="px-4 py-3 font-medium">Product</th>
                {matrix.channelNames.length > 0 ? (
                  matrix.channelNames.map((name) => (
                    <th key={name} className="px-4 py-3 font-medium text-center">
                      {name}
                    </th>
                  ))
                ) : (
                  <th className="px-4 py-3 font-medium text-center">Revenue</th>
                )}
              </tr>
            </thead>
            <tbody>
              {matrix.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={Math.max(matrix.channelNames.length + 1, 2)}
                    className="px-4 py-8 text-center text-text-secondary"
                  >
                    No product performance data to display.
                  </td>
                </tr>
              ) : (
                matrix.rows.map((row) => {
                  const isBestProduct = matrix.bestCell?.productId === row.productId;
                  return (
                    <tr
                      key={row.productId}
                      className="border-b border-border hover:bg-bg-tertiary/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-text-primary">{row.productName}</div>
                        {row.category && (
                          <div className="text-xs text-text-secondary">{row.category}</div>
                        )}
                      </td>
                      {matrix.channelNames.length > 0 ? (
                        matrix.channelNames.map((channelName) => {
                          const isBest =
                            isBestProduct && matrix.bestCell?.channelName === channelName;
                          return (
                            <td
                              key={channelName}
                              className={cn(
                                'px-4 py-3 text-center',
                                isBest && 'bg-accent-yellow/10',
                              )}
                            >
                              <div className="flex items-center justify-center gap-1">
                                {isBest && (
                                  <Star
                                    size={14}
                                    className="text-accent-yellow fill-accent-yellow"
                                  />
                                )}
                                <span
                                  className={cn(
                                    'font-medium',
                                    isBest ? 'text-accent-yellow' : 'text-accent-green',
                                  )}
                                >
                                  {formatCurrency(Number(row.totalRevenue))}
                                </span>
                              </div>
                            </td>
                          );
                        })
                      ) : (
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {isBestProduct && (
                              <Star
                                size={14}
                                className="text-accent-yellow fill-accent-yellow"
                              />
                            )}
                            <span
                              className={cn(
                                'font-medium',
                                isBestProduct ? 'text-accent-yellow' : 'text-accent-green',
                              )}
                            >
                              {formatCurrency(Number(row.totalRevenue))}
                            </span>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Stats */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-3 uppercase tracking-wide">
          Summary
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card">
            <p className="text-sm text-text-secondary">Total Revenue</p>
            <p className="text-2xl font-bold text-accent-green mt-1">
              {formatCurrency(Number(summary.totalRevenue))}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-text-secondary">Total Clicks</p>
            <p className="text-2xl font-bold text-text-primary mt-1">
              {formatNumber(summary.totalClicks)}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-text-secondary">Conversions</p>
            <p className="text-2xl font-bold text-accent-blue mt-1">
              {formatNumber(summary.totalConversions)}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-text-secondary">Conversion Rate</p>
            <p className="text-2xl font-bold text-accent-purple mt-1">
              {(summary.conversionRate * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* By Channel breakdown */}
      {revenue.byChannel.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3 uppercase tracking-wide">
            Revenue by Channel
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {revenue.byChannel.map((ch) => (
              <div key={ch.channelId ?? 'direct'} className="card flex items-center justify-between">
                <div>
                  <p className="font-medium text-text-primary">{ch.channelName}</p>
                  <p className="text-xs text-text-secondary">
                    {formatNumber(ch.conversions)} conversions
                  </p>
                </div>
                <p className="text-lg font-semibold text-accent-green">
                  {formatCurrency(Number(ch.revenue))}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Product Modal
// ---------------------------------------------------------------------------

function AddProductModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [salesAngle, setSalesAngle] = useState('');
  const [commissionRate, setCommissionRate] = useState('');
  const [category, setCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const resetForm = useCallback(() => {
    setName('');
    setUrl('');
    setSalesAngle('');
    setCommissionRate('');
    setCategory('');
    setErrorMsg('');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;

    setSubmitting(true);
    setErrorMsg('');

    try {
      await apiPost('/affiliate/products', {
        name: name.trim(),
        url: url.trim(),
        salesAngle: salesAngle.trim() || undefined,
        commissionRate: commissionRate ? parseFloat(commissionRate) : undefined,
        category: category || undefined,
      });
      resetForm();
      onCreated();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create product');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        resetForm();
        onClose();
      }}
      title="Add Affiliate Product"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {errorMsg}
          </div>
        )}

        <div>
          <label className="block text-sm text-text-secondary mb-1">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input w-full"
            placeholder="Product name"
            required
          />
        </div>

        <div>
          <label className="block text-sm text-text-secondary mb-1">
            URL <span className="text-red-400">*</span>
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="input w-full"
            placeholder="https://example.com/product"
            required
          />
        </div>

        <div>
          <label className="block text-sm text-text-secondary mb-1">Sales Angle</label>
          <textarea
            value={salesAngle}
            onChange={(e) => setSalesAngle(e.target.value)}
            className="input w-full h-20 resize-none"
            placeholder="How should this product be pitched?"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">Commission Rate (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={commissionRate}
              onChange={(e) => setCommissionRate(e.target.value)}
              className="input w-full"
              placeholder="e.g. 15"
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input w-full"
            >
              <option value="">Select category</option>
              {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={submitting} className="btn-primary flex-1">
            {submitting ? 'Adding...' : 'Add Product'}
          </button>
          <button
            type="button"
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Product Detail Modal
// ---------------------------------------------------------------------------

function ProductDetailModal({
  product,
  onClose,
  onUpdated,
}: {
  product: AffiliateProduct | null;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [salesAngle, setSalesAngle] = useState('');
  const [commissionRate, setCommissionRate] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Populate form on product change
  const populateForm = useCallback((p: AffiliateProduct) => {
    setName(p.name);
    setSalesAngle(p.salesAngle ?? '');
    setCommissionRate(p.commissionRate?.toString() ?? '');
    setCategory(p.category ?? '');
    setStatus(p.status);
    setErrorMsg('');
  }, []);

  // Reset editing state on product change
  useMemo(() => {
    if (product) {
      populateForm(product);
      setEditing(false);
    }
  }, [product, populateForm]);

  const handleSave = async () => {
    if (!product) return;
    setSubmitting(true);
    setErrorMsg('');

    try {
      await apiPut(`/affiliate/products/${product.id}`, {
        name: name.trim(),
        salesAngle: salesAngle.trim() || null,
        commissionRate: commissionRate ? parseFloat(commissionRate) : null,
        category: category || null,
        status,
      });
      setEditing(false);
      onUpdated();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update product');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={product !== null}
      onClose={() => {
        setEditing(false);
        onClose();
      }}
      title="Product Details"
    >
      {product && (
        <div className="space-y-4">
          {errorMsg && (
            <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {errorMsg}
            </div>
          )}

          {editing ? (
            /* Edit mode */
            <>
              <div>
                <label className="block text-sm text-text-secondary mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">Sales Angle</label>
                <textarea
                  value={salesAngle}
                  onChange={(e) => setSalesAngle(e.target.value)}
                  className="input w-full h-20 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Commission (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={commissionRate}
                    onChange={(e) => setCommissionRate(e.target.value)}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="input w-full"
                  >
                    <option value="">Uncategorized</option>
                    {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="input w-full"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSave}
                  disabled={submitting}
                  className="btn-primary flex-1"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => {
                    populateForm(product);
                    setEditing(false);
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            /* View mode */
            <>
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-lg bg-bg-tertiary flex items-center justify-center text-text-secondary flex-shrink-0">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt=""
                      className="w-14 h-14 rounded-lg object-cover"
                    />
                  ) : (
                    <Package size={24} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-text-primary text-lg">{product.name}</h3>
                  {product.brand && (
                    <p className="text-sm text-text-secondary">{product.brand}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn('text-xs px-2 py-0.5 rounded', statusColor(product.status))}>
                      {product.status}
                    </span>
                    {product.category && (
                      <span className="badge-idle text-xs">{product.category}</span>
                    )}
                  </div>
                </div>
              </div>

              {product.salesAngle && (
                <div>
                  <p className="text-xs text-text-secondary uppercase tracking-wide mb-1">Sales Angle</p>
                  <p className="text-sm text-text-primary">{product.salesAngle}</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-xs text-text-secondary">Commission</p>
                  <p className="text-lg font-bold text-text-primary">
                    {product.commissionRate != null ? `${Number(product.commissionRate)}%` : '--'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-text-secondary">Clicks</p>
                  <p className="text-lg font-bold text-text-primary">
                    {formatNumber(product.totalClicks)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-text-secondary">Revenue</p>
                  <p className="text-lg font-bold text-accent-green">
                    {formatCurrency(Number(product.totalRevenue))}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs text-text-secondary uppercase tracking-wide mb-1">URL</p>
                <a
                  href={product.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-accent-blue hover:underline flex items-center gap-1 break-all"
                >
                  {product.url}
                  <ExternalLink size={12} />
                </a>
              </div>

              {product.shortUrl && (
                <div>
                  <p className="text-xs text-text-secondary uppercase tracking-wide mb-1">
                    Short URL
                  </p>
                  <code className="text-sm text-accent-blue bg-bg-tertiary px-2 py-0.5 rounded">
                    {product.shortUrl}
                  </code>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button onClick={() => setEditing(true)} className="btn-primary flex-1">
                  Edit Product
                </button>
                <button onClick={onClose} className="btn-secondary">
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Create Link Modal
// ---------------------------------------------------------------------------

function CreateLinkModal({
  open,
  products,
  onClose,
  onCreated,
}: {
  open: boolean;
  products: AffiliateProduct[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [productId, setProductId] = useState('');
  const [shortUrl, setShortUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const resetForm = useCallback(() => {
    setProductId('');
    setShortUrl('');
    setErrorMsg('');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) return;

    setSubmitting(true);
    setErrorMsg('');

    try {
      await apiPost('/affiliate/links', {
        productId,
        shortUrl: shortUrl.trim() || undefined,
      });
      resetForm();
      onCreated();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create link');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        resetForm();
        onClose();
      }}
      title="Create Affiliate Link"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {errorMsg}
          </div>
        )}

        <div>
          <label className="block text-sm text-text-secondary mb-1">
            Product <span className="text-red-400">*</span>
          </label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="input w-full"
            required
          >
            <option value="">-- Select a product --</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.category ? ` (${p.category})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-text-secondary mb-1">
            Custom Short URL <span className="text-text-secondary text-xs">(optional)</span>
          </label>
          <input
            type="url"
            value={shortUrl}
            onChange={(e) => setShortUrl(e.target.value)}
            className="input w-full"
            placeholder="Leave blank to auto-generate"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={submitting} className="btn-primary flex-1">
            {submitting ? 'Creating...' : 'Create Link'}
          </button>
          <button
            type="button"
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
