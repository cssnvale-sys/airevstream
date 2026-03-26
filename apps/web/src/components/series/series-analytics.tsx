'use client';

import { useSeriesAnalytics } from '@/hooks/use-series';
import { BarChart3, Film, Star, CheckCircle } from 'lucide-react';

interface AnalyticsData {
  seriesId: string;
  seriesName: string;
  totalEpisodes: number;
  publishedEpisodes: number;
  avgQualityScore: number;
  statusBreakdown: Record<string, number>;
}

interface Props {
  seriesId: string;
}

export function SeriesAnalytics({ seriesId }: Props) {
  const { data: rawData, isLoading } = useSeriesAnalytics<AnalyticsData>(seriesId);
  const analytics = rawData?.data;

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-bg-tertiary rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!analytics) {
    return <p className="text-text-secondary">No analytics data available.</p>;
  }

  const publishRate = analytics.totalEpisodes > 0
    ? Math.round((analytics.publishedEpisodes / analytics.totalEpisodes) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-caption text-text-secondary">Total Episodes</span>
            <Film size={18} className="text-accent-purple" />
          </div>
          <p className="text-page-title text-text-primary">{analytics.totalEpisodes}</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-caption text-text-secondary">Published</span>
            <CheckCircle size={18} className="text-accent-green" />
          </div>
          <p className="text-page-title text-text-primary">{analytics.publishedEpisodes}</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-caption text-text-secondary">Avg Quality</span>
            <Star size={18} className="text-accent-yellow" />
          </div>
          <p className="text-page-title text-text-primary">{analytics.avgQualityScore}</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-caption text-text-secondary">Publish Rate</span>
            <BarChart3 size={18} className="text-accent-blue" />
          </div>
          <p className="text-page-title text-text-primary">{publishRate}%</p>
        </div>
      </div>

      {/* Status breakdown */}
      <div className="card">
        <h3 className="text-card-title text-text-primary mb-4">Status Breakdown</h3>
        <div className="space-y-2">
          {Object.entries(analytics.statusBreakdown).map(([status, count]) => (
            <div key={status} className="flex items-center justify-between">
              <span className="text-sm text-text-secondary capitalize">{status}</span>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-bg-tertiary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent-blue rounded-full"
                    style={{ width: `${analytics.totalEpisodes > 0 ? (count / analytics.totalEpisodes) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-sm text-text-primary w-6 text-right">{count}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
