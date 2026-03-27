'use client';

import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useAnalytics } from '@/hooks/use-api';
import { cn, formatNumber, formatCurrency } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PiggyBank,
  BarChart3,
  FileText,
  Download,
  FlaskConical,
  Trophy,
  Play,
} from 'lucide-react';
import { exportToCSV } from '@/lib/export';
import { useExperiments } from '@/hooks/use-experiments';
import { useSuggestionStats } from '@/hooks/use-suggestion-stats';
import { toast } from '@/lib/toast';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Period = '7d' | '30d' | '90d' | 'all';
type TabKey = 'revenue' | 'engagement' | 'content' | 'costs' | 'audience' | 'experiments';

interface KpiCard {
  label: string;
  value: string;
  trend: number;
  icon: typeof DollarSign;
  color: string;
}

interface RevenueDataPoint {
  date: string;
  revenue: number;
}

interface ChannelRevenue {
  channel: string;
  revenue: number;
  contentCount: number;
}

interface ProductRevenue {
  product: string;
  revenue: number;
  clicks: number;
}

interface RoiByType {
  type: string;
  cost: number;
  revenue: number;
  roi: number;
}

interface EngagementDataPoint {
  date: string;
  views: number;
  likes: number;
  shares: number;
}

interface ContentMetric {
  label: string;
  value: number;
}

interface QualityBucket {
  range: string;
  count: number;
}

interface CostItem {
  service: string;
  cost: number;
}

interface AudienceDataPoint {
  date: string;
  followers: number;
  subscribers: number;
}

interface AnalyticsData {
  kpis?: {
    revenue: number;
    revenueTrend: number;
    totalCost: number;
    costTrend: number;
    profit: number;
    profitTrend: number;
    contentCount: number;
    contentTrend: number;
  };
  revenueOverTime?: RevenueDataPoint[];
  revenueByChannel?: ChannelRevenue[];
  revenueByProduct?: ProductRevenue[];
  roiByType?: RoiByType[];
  engagement?: EngagementDataPoint[];
  contentMetrics?: ContentMetric[];
  qualityDistribution?: QualityBucket[];
  costByService?: CostItem[];
  costByModel?: CostItem[];
  audience?: AudienceDataPoint[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
];

const TABS: { key: TabKey; label: string }[] = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'engagement', label: 'Engagement' },
  { key: 'content', label: 'Content' },
  { key: 'costs', label: 'Costs' },
  { key: 'audience', label: 'Audience' },
  { key: 'experiments', label: 'Experiments' },
];

// Empty fallbacks (no mock data — charts show empty state)
const EMPTY_REVENUE_OVER_TIME: RevenueDataPoint[] = [];
const EMPTY_CHANNEL_REVENUE: ChannelRevenue[] = [];
const EMPTY_PRODUCT_REVENUE: ProductRevenue[] = [];
const EMPTY_ROI_BY_TYPE: RoiByType[] = [];
const EMPTY_ENGAGEMENT: EngagementDataPoint[] = [];
const EMPTY_CONTENT_METRICS: ContentMetric[] = [];
const EMPTY_QUALITY_DISTRIBUTION: QualityBucket[] = [];
const EMPTY_COST_BY_SERVICE: CostItem[] = [];
const EMPTY_COST_BY_MODEL: CostItem[] = [];
const EMPTY_AUDIENCE: AudienceDataPoint[] = [];

// ---------------------------------------------------------------------------
// Chart styling
// ---------------------------------------------------------------------------

const CHART_COLORS = {
  blue: '#3b82f6',    // accent-blue (dark mode)
  green: '#22c55e',   // accent-green
  amber: '#f59e0b',   // accent-amber
  red: '#ef4444',     // accent-red
  purple: '#a855f7',  // accent-purple
  grid: '#2a2a2d',    // border
  text: '#9a9aa0',    // text-secondary
};

const tooltipStyle = {
  backgroundColor: '#141416',
  border: '1px solid #2a2a2d',
  borderRadius: '8px',
  color: '#f0f0f2',
  fontSize: '12px',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('7d');
  const [activeTab, setActiveTab] = useState<TabKey>('revenue');

  // API hooks
  const { data: analyticsData, isLoading, error: analyticsError } = useAnalytics('overview', `period=${period}`);
  const { data: experimentsRaw } = useExperiments<{ data: Array<{ id: string; name: string; status: string; primaryMetric: string; significance: number | null; winnerId: string | null; createdAt: string; _count: { variants: number } }>; total: number }>('limit=20');
  const { data: suggestionStatsRaw } = useSuggestionStats<{
    totalShown: number;
    accepted: number;
    rejected: number;
    acceptanceRate: number;
    avgImprovement: number;
    topPreset: { presetId: string; acceptanceRate: number } | null;
    recent: Array<{ id: string; presetId: string; dimension: string; outcome: string; createdAt: string; content: { id: string; title: string | null } | null }>;
  }>();

  const analytics: AnalyticsData = (analyticsData?.data as AnalyticsData | undefined) ?? {};

  // KPI cards
  const kpiCards: KpiCard[] = useMemo(() => {
    const kpis = analytics.kpis;
    return [
      {
        label: 'Revenue',
        value: formatCurrency(kpis?.revenue ?? 0),
        trend: kpis?.revenueTrend ?? 0,
        icon: DollarSign,
        color: 'text-accent-green',
      },
      {
        label: 'Total Cost',
        value: formatCurrency(kpis?.totalCost ?? 0),
        trend: kpis?.costTrend ?? 0,
        icon: PiggyBank,
        color: 'text-accent-amber',
      },
      {
        label: 'Profit',
        value: formatCurrency(kpis?.profit ?? 0),
        trend: kpis?.profitTrend ?? 0,
        icon: TrendingUp,
        color: 'text-accent-blue',
      },
      {
        label: 'Content Count',
        value: formatNumber(kpis?.contentCount ?? 0),
        trend: kpis?.contentTrend ?? 0,
        icon: FileText,
        color: 'text-accent-purple',
      },
    ];
  }, [analytics.kpis]);

  // Resolved data (API or empty fallback)
  const revenueOverTime = analytics.revenueOverTime ?? EMPTY_REVENUE_OVER_TIME;
  const revenueByChannel = analytics.revenueByChannel ?? EMPTY_CHANNEL_REVENUE;
  const revenueByProduct = analytics.revenueByProduct ?? EMPTY_PRODUCT_REVENUE;
  const roiByType = analytics.roiByType ?? EMPTY_ROI_BY_TYPE;
  const engagementData = analytics.engagement ?? EMPTY_ENGAGEMENT;
  const contentMetrics = analytics.contentMetrics ?? EMPTY_CONTENT_METRICS;
  const qualityDistribution = analytics.qualityDistribution ?? EMPTY_QUALITY_DISTRIBUTION;
  const costByService = analytics.costByService ?? EMPTY_COST_BY_SERVICE;
  const costByModel = analytics.costByModel ?? EMPTY_COST_BY_MODEL;
  const audienceData = analytics.audience ?? EMPTY_AUDIENCE;

  // Export handlers
  const handleExportCSV = () => {
    try {
      switch (activeTab) {
        case 'revenue':
          if (revenueOverTime.length > 0) {
            exportToCSV(revenueOverTime, [
              { header: 'Date', accessor: 'date' },
              { header: 'Revenue', accessor: 'revenue' },
            ], `revenue-${period}.csv`);
          } else if (revenueByChannel.length > 0) {
            exportToCSV(revenueByChannel, [
              { header: 'Channel', accessor: 'channel' },
              { header: 'Revenue', accessor: 'revenue' },
              { header: 'Content Count', accessor: 'contentCount' },
            ], `revenue-by-channel-${period}.csv`);
          }
          break;
        case 'engagement':
          exportToCSV(engagementData, [
            { header: 'Date', accessor: 'date' },
            { header: 'Views', accessor: 'views' },
            { header: 'Likes', accessor: 'likes' },
            { header: 'Shares', accessor: 'shares' },
          ], `engagement-${period}.csv`);
          break;
        case 'content':
          exportToCSV(contentMetrics, [
            { header: 'Metric', accessor: 'label' },
            { header: 'Value', accessor: 'value' },
          ], `content-metrics-${period}.csv`);
          break;
        case 'costs':
          exportToCSV(costByService, [
            { header: 'Service', accessor: 'service' },
            { header: 'Cost', accessor: 'cost' },
          ], `costs-${period}.csv`);
          break;
        case 'audience':
          exportToCSV(audienceData, [
            { header: 'Date', accessor: 'date' },
            { header: 'Followers', accessor: 'followers' },
            { header: 'Subscribers', accessor: 'subscribers' },
          ], `audience-${period}.csv`);
          break;
      }
      toast.success('CSV exported');
    } catch (err) {
      console.error('CSV export failed:', err);
      toast.error('No data available to export');
    }
  };

  const handleExportPDF = () => {
    toast.info('PDF export is not yet available. Use CSV export instead.');
  };

  // -------------------------------------------------------------------------
  // Tab renderers
  // -------------------------------------------------------------------------

  const renderRevenueTab = () => (
    <div className="space-y-6">
      {/* Revenue over time chart */}
      <div className="card">
        <h3 className="text-card-title text-text-primary mb-4">Revenue Over Time</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revenueOverTime}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis
                dataKey="date"
                stroke={CHART_COLORS.text}
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke={CHART_COLORS.text}
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `$${v}`}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Revenue']}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke={CHART_COLORS.green}
                strokeWidth={2}
                dot={{ fill: CHART_COLORS.green, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Side-by-side tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Channel */}
        <div className="card">
          <h3 className="text-card-title text-text-primary mb-4">Revenue by Channel (Top 5)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-body">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-text-secondary font-medium">Channel</th>
                  <th className="text-right py-2 text-text-secondary font-medium">Revenue</th>
                  <th className="text-right py-2 text-text-secondary font-medium">Content</th>
                </tr>
              </thead>
              <tbody>
                {revenueByChannel.slice(0, 5).map((row) => (
                  <tr key={row.channel} className="border-b border-border last:border-b-0 hover:bg-bg-tertiary/50 transition-colors">
                    <td className="py-2.5 text-text-primary">{row.channel}</td>
                    <td className="py-2.5 text-right text-accent-green font-medium">
                      {formatCurrency(row.revenue)}
                    </td>
                    <td className="py-2.5 text-right text-text-secondary">{row.contentCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Revenue by Product */}
        <div className="card">
          <h3 className="text-card-title text-text-primary mb-4">Revenue by Product (Top 5)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-body">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-text-secondary font-medium">Product</th>
                  <th className="text-right py-2 text-text-secondary font-medium">Revenue</th>
                  <th className="text-right py-2 text-text-secondary font-medium">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {revenueByProduct.slice(0, 5).map((row) => (
                  <tr key={row.product} className="border-b border-border last:border-b-0 hover:bg-bg-tertiary/50 transition-colors">
                    <td className="py-2.5 text-text-primary">{row.product}</td>
                    <td className="py-2.5 text-right text-accent-green font-medium">
                      {formatCurrency(row.revenue)}
                    </td>
                    <td className="py-2.5 text-right text-text-secondary">
                      {formatNumber(row.clicks)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ROI by Content Type */}
      <div className="card">
        <h3 className="text-card-title text-text-primary mb-4">ROI by Content Type</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {roiByType.map((item) => (
            <div key={item.type} className="bg-bg-tertiary rounded-md p-4 border border-border">
              <p className="text-caption text-text-secondary mb-1">{item.type}</p>
              <p className="text-section-heading text-accent-blue">{item.roi}% ROI</p>
              <div className="flex justify-between mt-2 text-caption">
                <span className="text-text-secondary">
                  Cost: {formatCurrency(item.cost)}
                </span>
                <span className="text-accent-green">
                  Rev: {formatCurrency(item.revenue)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderEngagementTab = () => (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-card-title text-text-primary mb-4">Views, Likes & Shares</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={engagementData}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis
                dataKey="date"
                stroke={CHART_COLORS.text}
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke={CHART_COLORS.text}
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => formatNumber(v)}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value, name) => [formatNumber(Number(value)), String(name)]}
              />
              <Line
                type="monotone"
                dataKey="views"
                stroke={CHART_COLORS.blue}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="likes"
                stroke={CHART_COLORS.green}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="shares"
                stroke={CHART_COLORS.amber}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: CHART_COLORS.blue }} />
            <span className="text-caption text-text-secondary">Views</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: CHART_COLORS.green }} />
            <span className="text-caption text-text-secondary">Likes</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: CHART_COLORS.amber }} />
            <span className="text-caption text-text-secondary">Shares</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderContentTab = () => (
    <div className="space-y-6">
      {/* Content production metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {contentMetrics.map((metric) => (
          <div key={metric.label} className="card">
            <p className="text-caption text-text-secondary">{metric.label}</p>
            <p className="text-page-title text-text-primary mt-1">{metric.value}</p>
          </div>
        ))}
      </div>

      {/* Quality score distribution */}
      <div className="card">
        <h3 className="text-card-title text-text-primary mb-4">Quality Score Distribution</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={qualityDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis
                dataKey="range"
                stroke={CHART_COLORS.text}
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke={CHART_COLORS.text}
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill={CHART_COLORS.purple} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  const renderCostsTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost by Service */}
        <div className="card">
          <h3 className="text-card-title text-text-primary mb-4">Cost by Service</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costByService} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                <XAxis
                  type="number"
                  stroke={CHART_COLORS.text}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `$${v}`}
                />
                <YAxis
                  type="category"
                  dataKey="service"
                  stroke={CHART_COLORS.text}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  width={100}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Cost']}
                />
                <Bar dataKey="cost" fill={CHART_COLORS.amber} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cost by Model */}
        <div className="card">
          <h3 className="text-card-title text-text-primary mb-4">Cost by Model</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costByModel} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                <XAxis
                  type="number"
                  stroke={CHART_COLORS.text}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `$${v}`}
                />
                <YAxis
                  type="category"
                  dataKey="service"
                  stroke={CHART_COLORS.text}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  width={100}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Cost']}
                />
                <Bar dataKey="cost" fill={CHART_COLORS.red} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Total cost summary */}
      <div className="card">
        <h3 className="text-card-title text-text-primary mb-4">Cost Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-body">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-text-secondary font-medium">Category</th>
                <th className="text-right py-2 text-text-secondary font-medium">Amount</th>
                <th className="text-right py-2 text-text-secondary font-medium">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {costByService.map((item) => {
                const total = costByService.reduce((sum, i) => sum + i.cost, 0);
                const pct = total > 0 ? ((item.cost / total) * 100).toFixed(1) : '0.0';
                return (
                  <tr key={item.service} className="border-b border-border last:border-b-0 hover:bg-bg-tertiary/50 transition-colors">
                    <td className="py-2.5 text-text-primary">{item.service}</td>
                    <td className="py-2.5 text-right text-accent-amber font-medium">
                      {formatCurrency(item.cost)}
                    </td>
                    <td className="py-2.5 text-right text-text-secondary">{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border">
                <td className="py-2.5 text-text-primary font-semibold">Total</td>
                <td className="py-2.5 text-right text-accent-amber font-semibold">
                  {formatCurrency(costByService.reduce((sum, i) => sum + i.cost, 0))}
                </td>
                <td className="py-2.5 text-right text-text-secondary">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );

  const renderAudienceTab = () => (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-card-title text-text-primary mb-4">Audience Growth</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={audienceData}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis
                dataKey="date"
                stroke={CHART_COLORS.text}
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke={CHART_COLORS.text}
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => formatNumber(v)}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value, name) => [formatNumber(Number(value)), String(name)]}
              />
              <Line
                type="monotone"
                dataKey="followers"
                stroke={CHART_COLORS.blue}
                strokeWidth={2}
                dot={{ fill: CHART_COLORS.blue, r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="subscribers"
                stroke={CHART_COLORS.purple}
                strokeWidth={2}
                dot={{ fill: CHART_COLORS.purple, r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: CHART_COLORS.blue }} />
            <span className="text-caption text-text-secondary">Followers</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: CHART_COLORS.purple }} />
            <span className="text-caption text-text-secondary">Subscribers</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderExperimentsTab = () => {
    const expData = (experimentsRaw as { data: Array<{ id: string; name: string; status: string; primaryMetric: string; significance: number | null; winnerId: string | null; createdAt: string; _count: { variants: number } }>; total: number } | undefined);
    const experiments = expData?.data ?? [];
    const activeExps = experiments.filter(e => e.status === 'running');
    const completedExps = experiments.filter(e => e.status === 'completed');
    const withWinner = experiments.filter(e => e.winnerId);
    const winRate = completedExps.length > 0
      ? ((withWinner.length / completedExps.length) * 100).toFixed(0)
      : '0';

    return (
      <div className="space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-caption text-text-secondary">Active</span>
              <Play size={18} className="text-accent-green" />
            </div>
            <p className="text-page-title text-text-primary">{activeExps.length}</p>
          </div>
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-caption text-text-secondary">Completed</span>
              <FlaskConical size={18} className="text-accent-blue" />
            </div>
            <p className="text-page-title text-text-primary">{completedExps.length}</p>
          </div>
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-caption text-text-secondary">Win Rate</span>
              <Trophy size={18} className="text-accent-orange" />
            </div>
            <p className="text-page-title text-text-primary">{winRate}%</p>
          </div>
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-caption text-text-secondary">Total Variants</span>
              <BarChart3 size={18} className="text-accent-purple" />
            </div>
            <p className="text-page-title text-text-primary">
              {experiments.reduce((sum, e) => sum + e._count.variants, 0)}
            </p>
          </div>
        </div>

        {/* Recent completions */}
        {completedExps.length > 0 && (
          <div className="card">
            <h3 className="text-card-title text-text-primary mb-4">Recent Completions</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-body">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-text-secondary font-medium">Name</th>
                    <th className="text-left py-2 text-text-secondary font-medium">Metric</th>
                    <th className="text-right py-2 text-text-secondary font-medium">Significance</th>
                    <th className="text-center py-2 text-text-secondary font-medium">Winner</th>
                  </tr>
                </thead>
                <tbody>
                  {completedExps.slice(0, 10).map((exp) => (
                    <tr key={exp.id} className="border-b border-border last:border-b-0 hover:bg-bg-tertiary/50 transition-colors">
                      <td className="py-2.5 text-text-primary">{exp.name}</td>
                      <td className="py-2.5 text-text-secondary capitalize">{exp.primaryMetric}</td>
                      <td className="py-2.5 text-right font-mono text-text-secondary">
                        {exp.significance != null ? `p=${exp.significance.toFixed(4)}` : '-'}
                      </td>
                      <td className="py-2.5 text-center">
                        {exp.winnerId ? (
                          <Trophy size={14} className="text-accent-green inline" />
                        ) : (
                          <span className="text-text-tertiary">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {experiments.length === 0 && (
          <div className="card flex flex-col items-center justify-center py-12 text-center">
            <FlaskConical size={32} className="text-text-secondary mb-3" />
            <h3 className="text-lg font-medium text-text-primary">No experiments yet</h3>
            <p className="text-sm text-text-secondary mt-1">
              Create experiments from the Experiments page to start tracking results here.
            </p>
          </div>
        )}

        {/* Suggestion Performance */}
        {suggestionStatsRaw?.data && suggestionStatsRaw.data.totalShown > 0 && (() => {
          const sugStats = suggestionStatsRaw.data;
          return (
            <>
              <h3 className="text-card-title text-text-primary mt-8 mb-4">Suggestion Performance</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-caption text-text-secondary">Suggestions Shown</span>
                  </div>
                  <p className="text-page-title text-text-primary">{sugStats.totalShown}</p>
                </div>
                <div className="card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-caption text-text-secondary">Acceptance Rate</span>
                  </div>
                  <p className="text-page-title text-text-primary">{(sugStats.acceptanceRate * 100).toFixed(0)}%</p>
                </div>
                <div className="card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-caption text-text-secondary">Avg Improvement</span>
                  </div>
                  <p className="text-page-title text-text-primary">{sugStats.avgImprovement > 0 ? `+${sugStats.avgImprovement.toFixed(0)}` : '-'}</p>
                </div>
                <div className="card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-caption text-text-secondary">Top Preset</span>
                  </div>
                  <p className="text-body text-accent-blue font-medium truncate">{sugStats.topPreset?.presetId ?? '-'}</p>
                </div>
              </div>

              {sugStats.recent.length > 0 && (
                <div className="card mt-4">
                  <h3 className="text-card-title text-text-primary mb-4">Recent Suggestions</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-body">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 text-text-secondary font-medium">Preset</th>
                          <th className="text-left py-2 text-text-secondary font-medium">Dimension</th>
                          <th className="text-left py-2 text-text-secondary font-medium">Content</th>
                          <th className="text-left py-2 text-text-secondary font-medium">Outcome</th>
                          <th className="text-right py-2 text-text-secondary font-medium">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sugStats.recent.map((log) => (
                          <tr key={log.id} className="border-b border-border last:border-b-0 hover:bg-bg-tertiary/50 transition-colors">
                            <td className="py-2 text-text-primary font-mono text-caption">{log.presetId}</td>
                            <td className="py-2 text-text-secondary capitalize">{log.dimension}</td>
                            <td className="py-2 text-text-secondary truncate max-w-[150px]">{log.content?.title ?? '-'}</td>
                            <td className="py-2">
                              <span className={cn(
                                'px-2 py-0.5 rounded-full text-caption font-medium capitalize',
                                log.outcome === 'accepted' ? 'bg-accent-green/10 text-accent-green' :
                                log.outcome === 'rejected' ? 'bg-accent-red/10 text-accent-red' :
                                'bg-bg-tertiary text-text-secondary',
                              )}>
                                {log.outcome}
                              </span>
                            </td>
                            <td className="py-2 text-right text-text-tertiary">{new Date(log.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>
    );
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'revenue':
        return renderRevenueTab();
      case 'engagement':
        return renderEngagementTab();
      case 'content':
        return renderContentTab();
      case 'costs':
        return renderCostsTab();
      case 'audience':
        return renderAudienceTab();
      case 'experiments':
        return renderExperimentsTab();
    }
  };

  return (
    <AppLayout>
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-page-title text-text-primary">Analytics</h1>
          <p className="text-text-secondary mt-1">Performance metrics and insights.</p>
        </div>

        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
          className="input"
        >
          {PERIOD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* ---- KPI Cards ---- */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue" />
        </div>
      ) : analyticsError ? (
        <div className="card flex flex-col items-center justify-center py-12 text-center">
          <BarChart3 size={32} className="text-text-secondary mb-3" />
          <h3 className="text-lg font-medium text-text-primary">Failed to load analytics</h3>
          <p className="text-sm text-text-secondary mt-1">There was an error loading your analytics data. Please try again later.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {kpiCards.map((card) => {
              const Icon = card.icon;
              const isPositive = card.trend >= 0;
              return (
                <div key={card.label} className="card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-caption text-text-secondary">{card.label}</span>
                    <Icon size={18} className={card.color} />
                  </div>
                  <p className="text-page-title text-text-primary">{card.value}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {isPositive ? (
                      <TrendingUp size={14} className="text-accent-green" />
                    ) : (
                      <TrendingDown size={14} className="text-accent-red" />
                    )}
                    <span
                      className={cn(
                        'text-caption font-medium',
                        isPositive ? 'text-accent-green' : 'text-accent-red',
                      )}
                    >
                      {isPositive ? '+' : ''}{card.trend}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ---- Tabs ---- */}
          <div role="tablist" aria-label="Analytics sections" className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                role="tab"
                aria-selected={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'px-4 py-2.5 text-body font-medium transition-colors border-b-2 -mb-px',
                  activeTab === tab.key
                    ? 'border-accent-blue text-accent-blue'
                    : 'border-transparent text-text-secondary hover:text-text-primary',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ---- Tab Content ---- */}
          {renderActiveTab()}

          {/* ---- Export Buttons ---- */}
          <div className="flex gap-3 mt-8 pt-6 border-t border-border">
            <button onClick={handleExportCSV} className="btn-secondary flex items-center gap-2">
              <Download size={16} />
              Export CSV
            </button>
            <button onClick={handleExportPDF} className="btn-secondary flex items-center gap-2 opacity-50 cursor-not-allowed" title="PDF export not yet implemented">
              <Download size={16} />
              Export PDF
            </button>
          </div>
        </>
      )}
    </AppLayout>
  );
}
