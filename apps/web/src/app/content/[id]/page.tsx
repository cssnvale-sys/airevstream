'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useApi, apiPost, apiPut } from '@/hooks/use-api';
import { cn, formatRelativeTime, statusColor } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CopyButton } from '@/components/ui/copy-button';
import { QualityBreakdown } from '@/components/content/quality-breakdown';
import { ShotGallery } from '@/components/content/shot-gallery';
import { MediaPreview } from '@/components/ui/media-preview';
import { QualityBadge } from '@/components/ui/quality-badge';
import {
  ArrowLeft, Check, X, Clock, Send, Archive,
  FileText, Film, Video, Image, Mic, ImageIcon,
  Loader2, Calendar, Globe, Tag, Cpu, BarChart3,
  Copy, Share2, Eye, ThumbsUp, MessageCircle,
  MoreHorizontal,
} from 'lucide-react';

interface ContentDetail {
  id: string;
  title: string | null;
  contentType: string;
  status: string;
  prompt: string | null;
  qualityScore: number | null;
  durationSec: number | null;
  version: number;
  language: string;
  fileUrl: string | null;
  thumbnailUrl: string | null;
  platformMetadata: Record<string, unknown> | null;
  generationParams: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  channel: { id: string; name: string; primaryLanguage: string; niches: string[]; tone: string | null } | null;
  aiService: { id: string; name: string; provider: string; serviceType: string } | null;
  performance: Record<string, unknown> | null;
  affiliateProduct: { id: string; name: string; url: string; category: string } | null;
  storyboards: Array<{
    id: string;
    status: string;
    totalDurationSec: number | null;
    shots: Array<{
      id: string;
      shotNumber: number;
      startSec: number;
      endSec: number;
      shotspec: Record<string, unknown> | null;
      keyframeUrls: string[] | null;
      status: string;
      qualityScore: number | null;
    }>;
  }>;
  scheduledPosts: Array<{
    id: string;
    scheduledAt: string;
    platform: string;
    status: string;
  }>;
  children: Array<{
    id: string;
    version: number;
    status: string;
    title: string | null;
    createdAt: string;
  }>;
}

function contentTypeIcon(type: string) {
  switch (type) {
    case 'text': return FileText;
    case 'image': return Image;
    case 'video_short': return Film;
    case 'video_long': return Video;
    case 'voice': return Mic;
    case 'thumbnail': return ImageIcon;
    default: return FileText;
  }
}

function parseMinioUrl(url: string): { bucket: string; objectKey: string } | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    return { bucket: parts[0], objectKey: parts.slice(1).join('/') };
  } catch {
    return null;
  }
}

function mediaTypeFromContentType(type: string): 'image' | 'video' | 'audio' {
  if (type === 'voice') return 'audio';
  if (type.startsWith('video') || type === 'video_short' || type === 'video_long') return 'video';
  return 'image';
}

function contentTypeLabel(type: string): string {
  switch (type) {
    case 'text': return 'Text';
    case 'image': return 'Image';
    case 'video_short': return 'Short Video';
    case 'video_long': return 'Long Video';
    case 'voice': return 'Voice';
    case 'thumbnail': return 'Thumbnail';
    default: return type;
  }
}

export default function ContentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data, isLoading, error, mutate } = useApi<ContentDetail>(`/content/${id}`);
  const item = data?.data;

  const [acting, setActing] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [repurposeOpen, setRepurposeOpen] = useState(false);
  const [repurposeFormat, setRepurposeFormat] = useState<'short' | 'reel' | 'story'>('short');
  const [distributeOpen, setDistributeOpen] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [distributeSchedule, setDistributeSchedule] = useState('');
  const { data: channelsData } = useApi<{ id: string; name: string; platform: string }[]>('/channels?limit=100');
  const channels = channelsData?.data ?? [];

  const handleAction = async (action: 'approve' | 'reject' | 'schedule' | 'archive' | 'publish' | 'rescore') => {
    setActing(true);
    try {
      if (action === 'approve') {
        await apiPost(`/content/${id}/approve`);
        toast.success('Content approved');
      } else if (action === 'reject') {
        await apiPost(`/content/${id}/reject`, { feedback: rejectReason || undefined });
        toast.success('Content rejected');
        setRejectOpen(false);
        setRejectReason('');
      } else if (action === 'schedule') {
        router.push(`/calendar?schedule=${id}`);
        return;
      } else if (action === 'archive') {
        await apiPut(`/content/${id}`, { status: 'archived' });
        toast.success('Content archived');
      } else if (action === 'publish') {
        await apiPost(`/content/${id}/publish`);
        toast.success('Publish started');
      } else if (action === 'rescore') {
        await apiPost(`/content/${id}/rescore`);
        toast.success('Rescore started');
      }
      mutate();
    } catch (err) {
      console.error(`Failed to ${action} content:`, err);
      toast.error(`Failed to ${action} content`);
    } finally {
      setActing(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-6xl mx-auto animate-pulse">
          <div className="h-8 w-48 bg-bg-tertiary rounded mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="card h-40" />
              <div className="card h-60" />
            </div>
            <div className="space-y-4">
              <div className="card h-32" />
              <div className="card h-48" />
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !item) {
    return (
      <AppLayout>
        <div className="max-w-6xl mx-auto text-center py-20">
          <p className="text-red-400 mb-3">Content not found or failed to load.</p>
          <button onClick={() => router.back()} className="btn-secondary">Go Back</button>
        </div>
      </AppLayout>
    );
  }

  const Icon = contentTypeIcon(item.contentType);
  const script = (item.platformMetadata?.script as string) ?? null;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="btn-secondary p-2" aria-label="Go back">
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-text-primary truncate">{item.title ?? 'Untitled'}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn('badge text-xs', statusColor(item.status))}>{item.status.replace(/_/g, ' ')}</span>
              <span className="text-xs text-text-secondary">{contentTypeLabel(item.contentType)}</span>
              <span className="text-xs text-text-secondary">v{item.version}</span>
              {item.qualityScore != null && <QualityBadge score={item.qualityScore} size="sm" />}
            </div>
          </div>
          {/* Action buttons based on status */}
          <div className="flex items-center gap-2">
            {(item.status === 'pending_approval' || item.status === 'generated') && (
              <>
                <button onClick={() => handleAction('approve')} disabled={acting} className="btn-primary flex items-center gap-1.5">
                  {acting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Approve
                </button>
                <button onClick={() => setRejectOpen(true)} disabled={acting} className="btn-secondary flex items-center gap-1.5 text-accent-red">
                  <X size={14} /> Reject
                </button>
              </>
            )}
            {item.status === 'approved' && (
              <>
                <button onClick={() => handleAction('schedule')} disabled={acting} className="btn-primary flex items-center gap-1.5">
                  <Send size={14} /> Schedule
                </button>
                <button onClick={() => handleAction('publish')} disabled={acting} className="btn-secondary flex items-center gap-1.5">
                  {acting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Publish Now
                </button>
              </>
            )}
            {/* Secondary actions dropdown */}
            {(() => {
              const hasRescore = item.storyboards.length > 0 && item.status !== 'draft';
              const hasRepurpose = ['generated', 'approved', 'posted'].includes(item.status);
              const hasDistribute = item.status === 'approved';
              const hasArchive = !['archived', 'failed'].includes(item.status);
              if (!hasRescore && !hasRepurpose && !hasDistribute && !hasArchive) return null;
              return (
                <div className="relative">
                  <button
                    onClick={() => setMoreMenuOpen(v => !v)}
                    disabled={acting}
                    className="btn-secondary flex items-center gap-1.5"
                  >
                    <MoreHorizontal size={14} /> More
                  </button>
                  {moreMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-border bg-bg-secondary shadow-lg z-20 py-1">
                      {hasRescore && (
                        <button onClick={() => { handleAction('rescore'); setMoreMenuOpen(false); }} disabled={acting} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text-primary hover:bg-bg-tertiary">
                          <BarChart3 size={14} /> Rescore
                        </button>
                      )}
                      {hasRepurpose && (
                        <button onClick={() => { setRepurposeOpen(true); setMoreMenuOpen(false); }} disabled={acting} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text-primary hover:bg-bg-tertiary">
                          <Copy size={14} /> Repurpose
                        </button>
                      )}
                      {hasDistribute && (
                        <button onClick={() => { setDistributeOpen(true); setMoreMenuOpen(false); }} disabled={acting} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text-primary hover:bg-bg-tertiary">
                          <Share2 size={14} /> Distribute
                        </button>
                      )}
                      {hasArchive && (
                        <button onClick={() => { setArchiveOpen(true); setMoreMenuOpen(false); }} disabled={acting} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text-primary hover:bg-bg-tertiary">
                          <Archive size={14} /> Archive
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left panel: Content info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Metadata grid */}
            <div className="card">
              <h2 className="text-sm font-semibold text-text-primary mb-3">Details</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                {item.channel && (
                  <div>
                    <p className="text-xs text-text-secondary mb-0.5">Channel</p>
                    <p className="text-text-primary font-medium">{item.channel.name}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-text-secondary mb-0.5">Type</p>
                  <div className="flex items-center gap-1">
                    <Icon size={14} className="text-text-secondary" />
                    <p className="text-text-primary">{contentTypeLabel(item.contentType)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-text-secondary mb-0.5">Language</p>
                  <div className="flex items-center gap-1">
                    <Globe size={14} className="text-text-secondary" />
                    <p className="text-text-primary">{item.language}</p>
                  </div>
                </div>
                {item.aiService && (
                  <div>
                    <p className="text-xs text-text-secondary mb-0.5">AI Model</p>
                    <div className="flex items-center gap-1">
                      <Cpu size={14} className="text-text-secondary" />
                      <p className="text-text-primary">{item.aiService.name}</p>
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-xs text-text-secondary mb-0.5">Created</p>
                  <div className="flex items-center gap-1">
                    <Calendar size={14} className="text-text-secondary" />
                    <p className="text-text-primary">{formatRelativeTime(item.createdAt)}</p>
                  </div>
                </div>
                {item.durationSec != null && (
                  <div>
                    <p className="text-xs text-text-secondary mb-0.5">Duration</p>
                    <div className="flex items-center gap-1">
                      <Clock size={14} className="text-text-secondary" />
                      <p className="text-text-primary">{Math.floor(item.durationSec / 60)}:{String(Math.round(item.durationSec % 60)).padStart(2, '0')}</p>
                    </div>
                  </div>
                )}
                {item.affiliateProduct && (
                  <div>
                    <p className="text-xs text-text-secondary mb-0.5">Product</p>
                    <div className="flex items-center gap-1">
                      <Tag size={14} className="text-text-secondary" />
                      <p className="text-text-primary">{item.affiliateProduct.name}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Script */}
            {script && (
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-text-primary">Script</h2>
                  <CopyButton value={script} label="Copy script" />
                </div>
                <div className="bg-bg-tertiary rounded-lg p-4 text-sm text-text-primary whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {script}
                </div>
              </div>
            )}

            {/* Storyboard shots */}
            {item.storyboards.length > 0 && (
              <div className="card">
                <h2 className="text-sm font-semibold text-text-primary mb-3">Storyboard</h2>
                <ShotGallery storyboards={item.storyboards} />
              </div>
            )}

            {/* Scheduled posts */}
            {item.scheduledPosts.length > 0 && (
              <div className="card">
                <h2 className="text-sm font-semibold text-text-primary mb-3">Scheduled Posts</h2>
                <div className="space-y-2">
                  {item.scheduledPosts.map((post) => (
                    <div key={post.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-2">
                        <Send size={14} className="text-text-secondary" />
                        <span className="text-sm text-text-primary">{post.platform}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-text-secondary">{formatRelativeTime(post.scheduledAt)}</span>
                        <span className={cn('badge text-xs', statusColor(post.status))}>{post.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Engagement metrics for posted content */}
            {item.status === 'posted' && (
              <div className="card">
                <h2 className="text-sm font-semibold text-text-primary mb-3">Engagement</h2>
                {(() => {
                  const perf = (item.performance as Record<string, unknown>) ?? {};
                  const views = Number(perf.views ?? 0);
                  const likes = Number(perf.likes ?? 0);
                  const comments = Number(perf.comments ?? 0);
                  const shares = Number(perf.shares ?? 0);
                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="text-center p-3 bg-bg-tertiary rounded-lg">
                        <Eye size={16} className="mx-auto text-accent-blue mb-1" />
                        <p className="text-lg font-semibold text-text-primary">{views.toLocaleString()}</p>
                        <p className="text-xs text-text-secondary">Views</p>
                      </div>
                      <div className="text-center p-3 bg-bg-tertiary rounded-lg">
                        <ThumbsUp size={16} className="mx-auto text-accent-green mb-1" />
                        <p className="text-lg font-semibold text-text-primary">{likes.toLocaleString()}</p>
                        <p className="text-xs text-text-secondary">Likes</p>
                      </div>
                      <div className="text-center p-3 bg-bg-tertiary rounded-lg">
                        <MessageCircle size={16} className="mx-auto text-accent-amber mb-1" />
                        <p className="text-lg font-semibold text-text-primary">{comments.toLocaleString()}</p>
                        <p className="text-xs text-text-secondary">Comments</p>
                      </div>
                      <div className="text-center p-3 bg-bg-tertiary rounded-lg">
                        <Share2 size={16} className="mx-auto text-accent-purple mb-1" />
                        <p className="text-lg font-semibold text-text-primary">{shares.toLocaleString()}</p>
                        <p className="text-xs text-text-secondary">Shares</p>
                      </div>
                    </div>
                  );
                })()}
                <p className="text-xs text-text-secondary mt-3">
                  Connect platform APIs in{' '}
                  <Link href="/settings" className="text-accent-blue hover:underline">Settings</Link>
                  {' '}to enable auto-tracking.
                </p>
              </div>
            )}

            {/* Versions / Variants */}
            {item.children.length > 0 && (
              <div className="card">
                <h2 className="text-sm font-semibold text-text-primary mb-3">Versions</h2>
                <div className="space-y-2">
                  {item.children.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => router.push(`/content/${child.id}`)}
                      className="flex items-center justify-between w-full py-2 px-3 rounded hover:bg-bg-tertiary transition-colors"
                    >
                      <div>
                        <span className="text-sm text-text-primary font-medium">{child.title ?? 'Untitled'}</span>
                        <span className="text-xs text-text-secondary ml-2">v{child.version}</span>
                      </div>
                      <span className={cn('badge text-xs', statusColor(child.status))}>{child.status}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right panel: Quality, actions */}
          <div className="space-y-6">
            {/* Media preview */}
            {(() => {
              const mediaUrl = item.fileUrl ?? item.thumbnailUrl;
              const parsed = mediaUrl ? parseMinioUrl(mediaUrl) : null;
              if (!parsed) return null;
              const mediaType = item.fileUrl
                ? mediaTypeFromContentType(item.contentType)
                : 'image';
              return (
                <div className="card">
                  <h2 className="text-sm font-semibold text-text-primary mb-3">Preview</h2>
                  <MediaPreview
                    bucket={parsed.bucket}
                    objectKey={parsed.objectKey}
                    type={mediaType}
                    className="w-full aspect-video"
                    alt={item.title ?? 'Content preview'}
                  />
                </div>
              );
            })()}

            {/* Quality score breakdown */}
            <div className="card">
              <h2 className="text-sm font-semibold text-text-primary mb-3">Quality Score</h2>
              <QualityBreakdown contentId={id} />
            </div>

            {/* Prompt */}
            {item.prompt && (
              <div className="card">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold text-text-primary">Prompt</h2>
                  <CopyButton value={item.prompt} label="Copy prompt" />
                </div>
                <p className="text-sm text-text-secondary">{item.prompt}</p>
              </div>
            )}

            {/* Generation params */}
            {item.generationParams && (
              <div className="card">
                <h2 className="text-sm font-semibold text-text-primary mb-2">Generation Info</h2>
                <div className="space-y-1.5 text-xs">
                  {Boolean((item.generationParams as Record<string, unknown>).aiModel) && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Model</span>
                      <span className="text-text-primary">{String((item.generationParams as Record<string, unknown>).aiModel)}</span>
                    </div>
                  )}
                  {Boolean((item.generationParams as Record<string, unknown>).generatedAt) && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Generated</span>
                      <span className="text-text-primary">{formatRelativeTime(String((item.generationParams as Record<string, unknown>).generatedAt))}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Channel niches */}
            {item.channel && item.channel.niches.length > 0 && (
              <div className="card">
                <h2 className="text-sm font-semibold text-text-primary mb-2">Niches</h2>
                <div className="flex flex-wrap gap-1.5">
                  {item.channel.niches.map((niche) => (
                    <span key={niche} className="badge badge-idle text-xs">{niche}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Reject dialog */}
        {rejectOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={() => !acting && (setRejectOpen(false), setRejectReason(''))}
            role="dialog"
            aria-modal="true"
          >
            <div className="card w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 rounded-lg shrink-0 bg-accent-amber/10">
                  <X size={18} className="text-accent-amber" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-text-primary">Reject Content</h3>
                  <p className="text-sm text-text-secondary mt-1">
                    This content will be rejected and moved back to draft.
                  </p>
                </div>
              </div>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain what needs to change..."
                required
                rows={3}
                className="w-full px-3 py-2 mb-4 text-sm rounded-lg bg-bg-tertiary border border-border text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent-blue resize-none"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setRejectOpen(false); setRejectReason(''); }}
                  disabled={acting}
                  className="btn-secondary text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAction('reject')}
                  disabled={acting || !rejectReason.trim()}
                  className="btn-primary text-sm"
                >
                  {acting ? 'Rejecting...' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Repurpose dialog */}
        {repurposeOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={() => setRepurposeOpen(false)}
            role="dialog"
            aria-modal="true"
          >
            <div className="card w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-sm font-semibold text-text-primary mb-4">Repurpose Content</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Target Format</label>
                  <select
                    value={repurposeFormat}
                    onChange={(e) => setRepurposeFormat(e.target.value as 'short' | 'reel' | 'story')}
                    className="input w-full"
                  >
                    <option value="short">Short (YouTube Shorts, TikTok)</option>
                    <option value="reel">Reel (Instagram Reels)</option>
                    <option value="story">Story (Instagram/Facebook Stories)</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <button onClick={() => setRepurposeOpen(false)} className="btn-secondary text-sm">Cancel</button>
                <button
                  onClick={async () => {
                    setActing(true);
                    try {
                      const res = await apiPost<{ success: boolean; data: { id: string } }>(`/content/${id}/repurpose`, {
                        targetFormat: repurposeFormat,
                        targetPlatforms: [repurposeFormat === 'short' ? 'youtube' : repurposeFormat === 'reel' ? 'instagram' : 'instagram'],
                      });
                      toast.success('Content repurposed');
                      setRepurposeOpen(false);
                      router.push(`/content/${res.data.id}`);
                    } catch (err) {
                      console.error('Failed to repurpose content:', err);
                      toast.error('Failed to repurpose content');
                    } finally {
                      setActing(false);
                    }
                  }}
                  disabled={acting}
                  className="btn-primary text-sm flex items-center gap-1"
                >
                  {acting ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
                  Repurpose
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Distribute dialog */}
        {distributeOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={() => setDistributeOpen(false)}
            role="dialog"
            aria-modal="true"
          >
            <div className="card w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-sm font-semibold text-text-primary mb-4">Distribute to Channels</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Select Channels</label>
                  <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
                    {channels.length === 0 ? (
                      <p className="text-xs text-text-secondary p-2">No channels available</p>
                    ) : channels.map((ch) => (
                      <label key={ch.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-bg-tertiary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedChannels.includes(ch.id)}
                          onChange={(e) => {
                            setSelectedChannels(prev =>
                              e.target.checked ? [...prev, ch.id] : prev.filter(x => x !== ch.id)
                            );
                          }}
                          className="rounded border-border"
                        />
                        <span className="text-sm text-text-primary">{ch.name}</span>
                        <span className="text-xs text-text-secondary ml-auto">{ch.platform}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Schedule For (optional)</label>
                  <input
                    type="datetime-local"
                    value={distributeSchedule}
                    onChange={(e) => setDistributeSchedule(e.target.value)}
                    className="input w-full"
                  />
                  <p className="text-xs text-text-secondary mt-1">Leave empty for immediate distribution</p>
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <button onClick={() => { setDistributeOpen(false); setSelectedChannels([]); setDistributeSchedule(''); }} className="btn-secondary text-sm">Cancel</button>
                <button
                  onClick={async () => {
                    if (selectedChannels.length === 0) {
                      toast.error('Select at least one channel');
                      return;
                    }
                    setActing(true);
                    try {
                      await apiPost(`/content/${id}/distribute`, {
                        channelIds: selectedChannels,
                        scheduledFor: distributeSchedule ? new Date(distributeSchedule).toISOString() : undefined,
                      });
                      toast.success(`Distributed to ${selectedChannels.length} channel(s)`);
                      setDistributeOpen(false);
                      setSelectedChannels([]);
                      setDistributeSchedule('');
                      mutate();
                    } catch (err) {
                      console.error('Failed to distribute content:', err);
                      toast.error('Failed to distribute content');
                    } finally {
                      setActing(false);
                    }
                  }}
                  disabled={acting || selectedChannels.length === 0}
                  className="btn-primary text-sm flex items-center gap-1"
                >
                  {acting ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                  Distribute
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={archiveOpen}
        title="Archive Content"
        message="This will archive the content. Archived content can be found in the library with the 'archived' filter."
        confirmLabel="Archive"
        variant="warning"
        onConfirm={() => { setArchiveOpen(false); handleAction('archive'); }}
        onCancel={() => setArchiveOpen(false)}
        loading={acting}
      />
    </AppLayout>
  );
}
