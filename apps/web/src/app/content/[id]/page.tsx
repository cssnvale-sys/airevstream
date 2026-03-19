'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useApi, apiPost, apiPut } from '@/hooks/use-api';
import { cn, formatRelativeTime, statusColor } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CopyButton } from '@/components/ui/copy-button';
import { QualityBreakdown } from '@/components/content/quality-breakdown';
import { ShotGallery } from '@/components/content/shot-gallery';
import {
  ArrowLeft, Check, X, Clock, Send, Archive,
  FileText, Film, Video, Image, Mic, ImageIcon,
  Loader2, Calendar, Globe, Tag, Cpu,
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
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const handleAction = async (action: 'approve' | 'reject' | 'schedule' | 'archive') => {
    setActing(true);
    try {
      if (action === 'approve') {
        await apiPost(`/content/${id}/approve`);
        toast.success('Content approved');
      } else if (action === 'reject') {
        await apiPost(`/content/${id}/reject`, { reason: rejectReason });
        toast.success('Content rejected');
        setRejectOpen(false);
        setRejectReason('');
      } else if (action === 'archive') {
        await apiPut(`/content/${id}`, { status: 'archived' });
        toast.success('Content archived');
      }
      mutate();
    } catch (err) {
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
              <button onClick={() => handleAction('schedule')} disabled={acting} className="btn-primary flex items-center gap-1.5">
                <Send size={14} /> Schedule
              </button>
            )}
            {!['archived', 'failed'].includes(item.status) && (
              <button onClick={() => handleAction('archive')} disabled={acting} className="btn-secondary flex items-center gap-1.5">
                <Archive size={14} /> Archive
              </button>
            )}
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
        <ConfirmDialog
          open={rejectOpen}
          title="Reject Content"
          message="This content will be rejected and moved back to draft. Optionally provide a reason."
          confirmLabel="Reject"
          variant="warning"
          onConfirm={() => handleAction('reject')}
          onCancel={() => { setRejectOpen(false); setRejectReason(''); }}
          loading={acting}
        />
      </div>
    </AppLayout>
  );
}
