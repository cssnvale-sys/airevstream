'use client';

import { useChannelViralStats, useChannelTopicSuggestions } from '@/hooks/use-channel-viral';
import { useSuggestionStats } from '@/hooks/use-suggestion-stats';
import { cn } from '@/lib/utils';
import { TrendingUp, Sparkles, Target, BarChart3 } from 'lucide-react';

interface ViralStatsData {
  channel: { id: string; name: string };
  totalContent: number;
  scoredContent: number;
  avgScore: number;
  maxScore: number;
  minScore: number;
  topContent: Array<{
    id: string;
    title: string | null;
    contentType: string;
    viralScore: number | null;
    viralTier: string | null;
    createdAt: string;
  }>;
  trend: Array<{ date: string; score: number | null }>;
  tierCounts: Record<string, number>;
}

interface TopicSuggestion {
  topic: string;
  relevanceScore: number;
  matchedKeywords: string[];
  channelNiches: string[];
}

interface TopicSuggestionsData {
  suggestions: TopicSuggestion[];
  channelId: string;
  channelName: string;
  platform: string | null;
  message?: string;
}

interface SuggestionStatsData {
  totalShown: number;
  accepted: number;
  rejected: number;
  acceptanceRate: number;
  avgImprovement: number;
  topPreset: { presetId: string; shown: number; accepted: number; acceptanceRate: number } | null;
  presetRates: Array<{ presetId: string; shown: number; accepted: number; acceptanceRate: number }>;
}

interface ChannelViralDashboardProps {
  channelId: string;
}

const TIER_COLORS: Record<string, string> = {
  viral: 'bg-accent-green',
  high: 'bg-accent-blue',
  medium: 'bg-accent-orange',
  low: 'bg-accent-red',
};

export function ChannelViralDashboard({ channelId }: ChannelViralDashboardProps) {
  const { data: viralRaw, isLoading: viralLoading } = useChannelViralStats<ViralStatsData>(channelId);
  const { data: topicsRaw } = useChannelTopicSuggestions<TopicSuggestionsData>(channelId);
  const { data: statsRaw } = useSuggestionStats<SuggestionStatsData>(`channelId=${channelId}`);

  // useApi<T> returns SWR<{ success, data: T }>, so .data gives the API envelope, .data.data gives T
  const stats = viralRaw?.data;
  const topics = topicsRaw?.data;
  const suggestionStats = statsRaw?.data;

  if (viralLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="card text-center py-8 text-text-secondary">
        No viral data available for this channel.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Score summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-caption text-text-secondary">Avg Score</span>
            <BarChart3 size={18} className="text-accent-blue" />
          </div>
          <p className="text-page-title text-text-primary">{stats.avgScore}</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-caption text-text-secondary">Best Score</span>
            <TrendingUp size={18} className="text-accent-green" />
          </div>
          <p className="text-page-title text-text-primary">{stats.maxScore}</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-caption text-text-secondary">Scored Content</span>
            <Target size={18} className="text-accent-purple" />
          </div>
          <p className="text-page-title text-text-primary">{stats.scoredContent}/{stats.totalContent}</p>
        </div>
        {suggestionStats && (
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-caption text-text-secondary">Acceptance Rate</span>
              <Sparkles size={18} className="text-accent-orange" />
            </div>
            <p className="text-page-title text-text-primary">{(suggestionStats.acceptanceRate * 100).toFixed(0)}%</p>
          </div>
        )}
      </div>

      {/* Viral score trend */}
      {stats.trend.length > 0 && (
        <div className="card">
          <h3 className="text-card-title text-text-primary mb-4">Viral Score Trend</h3>
          <div className="flex items-end gap-1 h-32">
            {stats.trend.map((point, i) => {
              const score = point.score ?? 0;
              const height = Math.max(4, (score / 100) * 100);
              const color = score >= 70 ? 'bg-accent-green' : score >= 50 ? 'bg-accent-blue' : score >= 30 ? 'bg-accent-orange' : 'bg-accent-red';
              return (
                <div
                  key={i}
                  className={cn('flex-1 rounded-t transition-all', color)}
                  style={{ height: `${height}%` }}
                  title={`${new Date(point.date).toLocaleDateString()}: ${score}`}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-caption text-text-tertiary">
              {stats.trend.length > 0 ? new Date(stats.trend[0].date).toLocaleDateString() : ''}
            </span>
            <span className="text-caption text-text-tertiary">
              {stats.trend.length > 0 ? new Date(stats.trend[stats.trend.length - 1].date).toLocaleDateString() : ''}
            </span>
          </div>
        </div>
      )}

      {/* Tier distribution */}
      <div className="card">
        <h3 className="text-card-title text-text-primary mb-4">Tier Distribution</h3>
        <div className="flex gap-3">
          {Object.entries(stats.tierCounts).map(([tier, count]) => {
            const total = Object.values(stats.tierCounts).reduce((a, b) => a + b, 0);
            const pct = total > 0 ? ((count / total) * 100).toFixed(0) : '0';
            return (
              <div key={tier} className="flex-1 text-center">
                <div className="h-2 rounded-full bg-bg-tertiary overflow-hidden mb-1">
                  <div className={cn('h-full rounded-full', TIER_COLORS[tier] ?? 'bg-bg-tertiary')} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-caption text-text-secondary capitalize">{tier}</span>
                <p className="text-body text-text-primary font-medium">{count} ({pct}%)</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Topic suggestions */}
      {topics && (
        <div className="card">
          <h3 className="text-card-title text-text-primary mb-4">Topic Suggestions</h3>
          {topics.message ? (
            <p className="text-text-secondary">{topics.message}</p>
          ) : topics.suggestions.length > 0 ? (
            <div className="space-y-2">
              {topics.suggestions.map((topic, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded border border-border">
                  <div>
                    <span className="text-body text-text-primary font-medium">{topic.topic}</span>
                    <div className="flex gap-1 mt-0.5">
                      {topic.matchedKeywords.map((kw) => (
                        <span key={kw} className="text-caption px-1 bg-accent-purple/10 text-accent-purple rounded">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="text-caption text-text-tertiary">{(topic.relevanceScore * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-text-secondary">No matching trends found. Try adding more niches.</p>
          )}
        </div>
      )}

      {/* Suggestion acceptance stats */}
      {suggestionStats && suggestionStats.totalShown > 0 && (
        <div className="card">
          <h3 className="text-card-title text-text-primary mb-4">Suggestion Performance</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <p className="text-page-title text-text-primary">{suggestionStats.totalShown}</p>
              <p className="text-caption text-text-secondary">Shown</p>
            </div>
            <div className="text-center">
              <p className="text-page-title text-accent-green">{suggestionStats.accepted}</p>
              <p className="text-caption text-text-secondary">Accepted</p>
            </div>
            <div className="text-center">
              <p className="text-page-title text-text-primary">{suggestionStats.avgImprovement > 0 ? `+${suggestionStats.avgImprovement.toFixed(0)}` : '-'}</p>
              <p className="text-caption text-text-secondary">Avg Improvement</p>
            </div>
          </div>
          {suggestionStats.topPreset && (
            <p className="text-caption text-text-secondary">
              Top preset: <span className="text-accent-blue font-medium">{suggestionStats.topPreset.presetId}</span>
              {' '}({(suggestionStats.topPreset.acceptanceRate * 100).toFixed(0)}% acceptance)
            </p>
          )}
        </div>
      )}
    </div>
  );
}
