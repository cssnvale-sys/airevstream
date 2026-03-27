'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useApi, apiPut, apiPost } from '@/hooks/use-api';
import { toast } from '@/lib/toast';
import { ShotEditorPanel } from '@/components/cinema/shot-editor-panel';
import { ShotTable } from '@/components/cinema/shot-table';
import { Timeline } from '@/components/cinema/timeline';
import { PipelineProgress } from '@/components/cinema/pipeline-progress';
import { AiGuidancePanel } from '@/components/cinema/ai-guidance-panel';
import { CostPreviewPanel } from '@/components/cinema/cost-preview-panel';
import type { ShotData } from '@/components/cinema/shot-editor-panel';
import type { GuidanceSuggestion } from '@/components/cinema/ai-guidance-panel';
import Link from 'next/link';
import { List, Table2, ImageIcon, Film as FilmIcon, Check, X, RotateCcw } from 'lucide-react';
import { LoadingButton } from '@/components/ui/loading-button';
import { MediaPreview } from '@/components/ui/media-preview';
import { QualityBadge } from '@/components/ui/quality-badge';
import { ComplexityToggle } from '@/components/ui/complexity-toggle';
import { ExportVariants } from '@/components/cinema/export-variants';
import { ProvenanceViewer } from '@/components/cinema/provenance-viewer';
import { ViralScorePanel } from '@/components/cinema/viral-score-panel';
import { useComplexityMode } from '@/hooks/use-complexity-mode';
import { isVisible } from '@/lib/complexity-fields';
import { cn } from '@/lib/utils';
import { useJobStatus } from '@/hooks/use-job-status';

interface StudioContent {
  id: string;
  title: string;
  status: string;
  contentType: string;
  channelId: string;
  channel?: { id: string; name: string };
  storyboards: Array<{
    id: string;
    status: string;
    totalDurationSec: number | null;
    shots: Array<{
      id: string;
      shotNumber: number;
      status: string;
      startSec: number;
      endSec: number;
      keyframeUrls: string[];
      plateVideoUrl: string | null;
      qualityScore: number | null;
      shotspec: Record<string, unknown>;
    }>;
  }>;
}

function parseStorageUrl(url: string): { bucket: string; key: string } | null {
  const slashIdx = url.indexOf('/');
  if (slashIdx <= 0) return null;
  return { bucket: url.slice(0, slashIdx), key: url.slice(slashIdx + 1) };
}

export default function StudioPage() {
  const { contentId } = useParams<{ contentId: string }>();
  const { data, error, isLoading, mutate } = useApi<StudioContent>(`/content/${contentId}?include=storyboards`);
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'editor' | 'table'>('editor');
  const [previewMode, setPreviewMode] = useState<'keyframe' | 'video'>('keyframe');
  const [reviewActing, setReviewActing] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<GuidanceSuggestion[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const { progress: jobProgress, status: jobStatus, isComplete: jobDone } = useJobStatus(activeJobId);
  const guidanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { mode } = useComplexityMode();

  const content = data?.data;
  const storyboard = content?.storyboards?.[0];
  const shots: ShotData[] = storyboard?.shots ?? [];

  const handleUpdateShot = useCallback(async (shotId: string, spec: Record<string, unknown>) => {
    try {
      await apiPut(`/storyboard-shots/${shotId}`, { shotspec: spec });
      await mutate();
    } catch (err) {
      console.error('Failed to update shot:', err);
      toast.error('Failed to update shot');
    }
  }, [mutate]);

  const handleGenerateShot = useCallback(async (shotId: string) => {
    try {
      await apiPost(`/storyboard-shots/${shotId}/generate`, {});
      toast.success('Shot generation started');
      await mutate();
    } catch (err) {
      console.error('Failed to start shot generation:', err);
      toast.error('Failed to start generation');
    }
  }, [mutate]);

  const handleRepairShot = useCallback(async (shotId: string, repairType: 'inpaint' | 'face-fix' | 'lighting-harmonize') => {
    if (!storyboard) return;
    try {
      await apiPost('/content/repair-shot', {
        shotId,
        storyboardId: storyboard.id,
        contentId,
        channelId: content?.channelId ?? content?.channel?.id ?? '',
        repairType,
      });
      toast.success(`Shot ${repairType} repair started`);
      await mutate();
    } catch (err) {
      console.error('Failed to start shot repair:', err);
      toast.error('Failed to start repair');
    }
  }, [storyboard, contentId, content, mutate]);

  const handleGenerateAll = useCallback(async () => {
    if (!storyboard) return;
    try {
      const res = await apiPost<{ success: boolean; data: { flowJobId?: string } }>(`/pipeline/cinema`, {
        contentId,
        channelId: content?.channelId ?? content?.channel?.id ?? '',
        topic: content?.title ?? 'Untitled',
        contentType: content?.contentType ?? 'short',
        storyboardId: storyboard.id,
        shotIds: shots.map(s => s.id),
      });
      if (res?.data?.flowJobId) setActiveJobId(res.data.flowJobId);
      toast.success('Cinema pipeline started');
      await mutate();
    } catch (err) {
      console.error('Failed to start cinema pipeline:', err);
      toast.error('Failed to start pipeline');
    }
  }, [storyboard, contentId, content, shots, mutate]);

  const handleApplyGuidance = useCallback(async (patch: Record<string, unknown>) => {
    if (!selectedShotId) return;
    const shot = shots.find(s => s.id === selectedShotId);
    if (!shot) return;
    await handleUpdateShot(selectedShotId, { ...shot.shotspec, ...patch });
  }, [selectedShotId, shots, handleUpdateShot]);

  const handleShotAction = useCallback(async (shotId: string, action: 'approve' | 'reject' | 'regenerate') => {
    setReviewActing(shotId);
    try {
      await apiPost(`/storyboard-shots/${shotId}/approve`, { action });
      toast.success(`Shot ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'regenerating'}`);
      await mutate();
    } catch (err) {
      console.error(`Failed to ${action} shot:`, err);
      toast.error(`Failed to ${action} shot`);
    } finally {
      setReviewActing(null);
    }
  }, [mutate]);

  const handleApproveAllAndRender = useCallback(async () => {
    if (!storyboard) return;
    setReviewActing('all');
    try {
      await apiPost(`/storyboards/${storyboard.id}/approve`);
      toast.success('Storyboard approved — pipeline resuming');
      await mutate();
    } catch (err) {
      console.error('Failed to approve storyboard:', err);
      toast.error('Failed to approve storyboard');
    } finally {
      setReviewActing(null);
    }
  }, [storyboard, mutate]);

  // Derive a stable key for the selected shot's spec to avoid re-triggering
  // the guidance effect when SWR creates new object references on refetch.
  // JSON.stringify provides a content-based comparison.
  const selectedShotSpec = useMemo(() => {
    const shot = shots.find(s => s.id === selectedShotId);
    return shot?.shotspec ?? null;
  }, [selectedShotId, shots]);
  const selectedShotSpecKey = useMemo(
    () => selectedShotSpec ? JSON.stringify(selectedShotSpec) : null,
    [selectedShotSpec],
  );

  // Fetch AI guidance when selected shot changes (debounced)
  useEffect(() => {
    if (guidanceTimerRef.current) clearTimeout(guidanceTimerRef.current);

    if (!selectedShotSpec) {
      setSuggestions([]);
      return;
    }

    // Capture the spec at the time the effect runs
    const specSnapshot = selectedShotSpec;

    guidanceTimerRef.current = setTimeout(async () => {
      try {
        const res = await apiPost<{ success: boolean; data: { suggestions: GuidanceSuggestion[] } }>('/ai/guidance', {
          shotSpec: specSnapshot,
        });
        setSuggestions(res?.data?.suggestions ?? []);
      } catch (err) {
        console.error('AI guidance fetch failed:', err);
        setSuggestions([]);
      }
    }, 500);

    return () => {
      if (guidanceTimerRef.current) clearTimeout(guidanceTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShotSpecKey]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen animate-pulse">
        {/* Top bar skeleton */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-bg-secondary shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-4 w-10 bg-bg-tertiary rounded" />
            <div className="h-4 w-48 bg-bg-tertiary rounded" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-8 w-24 bg-bg-tertiary rounded" />
            <div className="h-8 w-16 bg-bg-tertiary rounded" />
          </div>
        </div>
        {/* Main content skeleton */}
        <div className="flex-1 overflow-hidden">
          <div className="grid grid-cols-12 h-full">
            <div className="col-span-10 p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 bg-bg-tertiary rounded-lg" />
              ))}
            </div>
            <div className="col-span-2 border-l border-border p-3 space-y-4">
              <div className="h-32 bg-bg-tertiary rounded-lg" />
              <div className="h-24 bg-bg-tertiary rounded-lg" />
            </div>
          </div>
        </div>
        {/* Timeline skeleton */}
        <div className="h-16 border-t border-border bg-bg-secondary px-4 py-2">
          <div className="h-full bg-bg-tertiary rounded" />
        </div>
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-secondary">Failed to load content</p>
          <Link href="/library" className="text-accent-blue text-sm hover:underline mt-2 inline-block">
            Back to Library
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-0px)]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-bg-secondary shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/library" className="text-text-secondary hover:text-text-primary text-sm">
            Back
          </Link>
          <span className="text-border">|</span>
          <h1 className="text-sm font-medium text-text-primary truncate max-w-md" title={content.title ?? undefined}>{content.title}</h1>
          <span className="text-xs text-text-secondary bg-bg-tertiary px-2 py-0.5 rounded">{content.status}</span>
        </div>
        <div className="flex items-center gap-3">
          <ComplexityToggle />
          {isVisible('advanced', mode) && (
            <div className="flex items-center border border-border rounded-md">
              <button
                type="button"
                onClick={() => setViewMode('editor')}
                className={cn('p-1.5', viewMode === 'editor' ? 'bg-bg-tertiary text-text-primary' : 'text-text-tertiary hover:text-text-secondary')}
                title="Editor view"
                aria-label="Editor view"
              >
                <List size={14} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={cn('p-1.5', viewMode === 'table' ? 'bg-bg-tertiary text-text-primary' : 'text-text-tertiary hover:text-text-secondary')}
                title="Table view"
                aria-label="Table view"
              >
                <Table2 size={14} />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={handleGenerateAll}
            disabled={!!activeJobId}
            className="btn-primary btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {activeJobId ? 'Rendering...' : 'Render'}
          </button>
        </div>
      </div>

      {/* Storyboard review banner */}
      {storyboard?.status === 'pending_review' && (
        <div className="border-b border-accent-amber/30 bg-accent-amber/5 px-4 py-3 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Storyboard Ready for Review</h2>
              <p className="text-xs text-text-secondary mt-0.5">
                {shots.filter(s => s.status === 'approved').length}/{shots.length} shots approved
                {shots.filter(s => s.status === 'pending').length > 0 && `, ${shots.filter(s => s.status === 'pending').length} pending`}
                {shots.filter(s => s.status === 'failed').length > 0 && `, ${shots.filter(s => s.status === 'failed').length} failed`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <LoadingButton
                onClick={handleApproveAllAndRender}
                loading={reviewActing === 'all'}
                loadingText="Approve All & Render"
                className="btn-primary flex items-center gap-1.5 text-sm"
              >
                <Check size={14} />
                Approve All & Render
              </LoadingButton>
            </div>
          </div>
          {/* Per-shot review controls */}
          <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto">
            {shots.map(shot => (
              <div key={shot.id} className="flex items-center justify-between py-1 px-2 rounded bg-bg-secondary/50">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-text-primary w-8">#{shot.shotNumber}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    shot.status === 'approved' ? 'bg-accent-green/10 text-accent-green' :
                    shot.status === 'failed' ? 'bg-accent-red/10 text-accent-red' :
                    shot.status === 'generating' ? 'bg-accent-blue/10 text-accent-blue' :
                    'bg-bg-tertiary text-text-secondary'
                  }`}>
                    {shot.status}
                  </span>
                  {shot.qualityScore != null && <QualityBadge score={shot.qualityScore} size="sm" />}
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => handleShotAction(shot.id, 'approve')}
                    disabled={reviewActing === shot.id || shot.status === 'approved'}
                    className="p-2 rounded text-accent-green hover:bg-accent-green/10 disabled:opacity-30"
                    title="Approve shot"
                    aria-label="Approve shot"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShotAction(shot.id, 'reject')}
                    disabled={reviewActing === shot.id || shot.status === 'failed'}
                    className="p-2 rounded text-accent-red hover:bg-accent-red/10 disabled:opacity-30"
                    title="Reject shot"
                    aria-label="Reject shot"
                  >
                    <X size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShotAction(shot.id, 'regenerate')}
                    disabled={reviewActing === shot.id || shot.status === 'generating'}
                    className="p-2 rounded text-accent-blue hover:bg-accent-blue/10 disabled:opacity-30"
                    title="Regenerate shot"
                    aria-label="Regenerate shot"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shot preview bar */}
      {(() => {
        const selectedShot = shots.find(s => s.id === selectedShotId);
        if (!selectedShot) return null;
        const hasVideo = !!selectedShot.plateVideoUrl;
        const videoUrl = selectedShot.plateVideoUrl ? parseStorageUrl(selectedShot.plateVideoUrl) : null;
        const keyframeUrl = selectedShot.keyframeUrls?.[0] ? parseStorageUrl(selectedShot.keyframeUrls[0]) : null;

        return (
          <div className="border-b border-border bg-bg-secondary px-4 py-2 shrink-0">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs text-text-secondary">Shot {selectedShot.shotNumber} Preview</span>
              <div className="flex items-center border border-border rounded-md">
                <button
                  type="button"
                  onClick={() => setPreviewMode('keyframe')}
                  className={cn('px-2 py-1 text-xs flex items-center gap-1', previewMode === 'keyframe' ? 'bg-bg-tertiary text-text-primary' : 'text-text-tertiary hover:text-text-secondary')}
                >
                  <ImageIcon size={12} /> Keyframe
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('video')}
                  disabled={!hasVideo}
                  className={cn('px-2 py-1 text-xs flex items-center gap-1', previewMode === 'video' ? 'bg-bg-tertiary text-text-primary' : 'text-text-tertiary hover:text-text-secondary', !hasVideo && 'opacity-40 cursor-not-allowed')}
                >
                  <FilmIcon size={12} /> Video
                </button>
              </div>
            </div>
            <div className="max-w-md">
              {previewMode === 'video' && videoUrl ? (
                <MediaPreview bucket={videoUrl.bucket} objectKey={videoUrl.key} type="video" className="w-full aspect-video" />
              ) : keyframeUrl ? (
                <MediaPreview bucket={keyframeUrl.bucket} objectKey={keyframeUrl.key} type="image" className="w-full aspect-video" alt={`Shot ${selectedShot.shotNumber} keyframe`} />
              ) : (
                <div className="w-full aspect-video bg-bg-tertiary rounded-lg flex items-center justify-center">
                  <ImageIcon size={24} className="text-text-secondary opacity-40" />
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Main content area */}
      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-12 h-full">
          {/* Shot editor / table (10 cols) */}
          <div className="col-span-10 p-4 overflow-hidden">
            {shots.length > 0 ? (
              isVisible('advanced', mode) && viewMode === 'table' ? (
                <ShotTable
                  shots={shots}
                  selectedShotId={selectedShotId ?? undefined}
                  onSelectShot={setSelectedShotId}
                />
              ) : (
                <ShotEditorPanel
                  shots={shots}
                  onUpdateShot={handleUpdateShot}
                  onGenerateShot={handleGenerateShot}
                  onGenerateAll={handleGenerateAll}
                  onRepairShot={handleRepairShot}
                />
              )
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-text-secondary">No storyboard yet</p>
                  <button
                    type="button"
                    onClick={handleGenerateAll}
                    disabled={!!activeJobId}
                    className="btn-primary mt-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {activeJobId ? 'Generating...' : 'Generate Storyboard'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right panel: guidance + progress (2 cols) */}
          <div className="col-span-2 border-l border-border p-3 overflow-y-auto space-y-4">
            <PipelineProgress contentId={contentId} />
            {isVisible('advanced', mode) && (
              <AiGuidancePanel
                suggestions={suggestions}
                onApplyAction={handleApplyGuidance}
              />
            )}
            {activeJobId && !jobDone && (
              <div className="p-3 rounded-lg bg-bg-tertiary">
                <p className="text-xs text-text-secondary mb-1">Job Progress</p>
                <div className="w-full bg-bg-primary rounded-full h-2">
                  <div
                    className="bg-accent-blue h-2 rounded-full transition-all duration-300"
                    style={{ width: `${jobProgress}%` }}
                  />
                </div>
                <p className="text-xs text-text-secondary mt-1">{jobStatus ?? 'waiting'} — {jobProgress}%</p>
              </div>
            )}
            {isVisible('advanced', mode) && (
              <ViralScorePanel contentId={contentId} />
            )}
            {isVisible('advanced', mode) && (
              <ProvenanceViewer contentId={contentId} />
            )}
            {isVisible('advanced', mode) && storyboard && (
              <ExportVariants
                contentId={contentId}
                storyboardId={storyboard.id}
                channelId={content?.channelId ?? content?.channel?.id ?? ''}
                topic={content?.title ?? 'Untitled'}
                contentType={content?.contentType ?? 'short'}
                qualityTier="cinema"
              />
            )}
            {isVisible('advanced', mode) && shots.length > 0 && (
              <CostPreviewPanel
                shots={shots.map(s => ({
                  duration: s.endSec - s.startSec,
                  outputType: 'image',
                }))}
                qualityTier="standard"
              />
            )}
          </div>
        </div>
      </div>

      {/* Timeline */}
      {shots.length > 0 && (
        <Timeline
          shots={shots}
          totalDurationSec={storyboard?.totalDurationSec ?? 60}
          selectedShotId={selectedShotId}
          onSelectShot={setSelectedShotId}
        />
      )}
    </div>
  );
}
