'use client';

import { useState, useCallback, useEffect, useRef, use } from 'react';
import { useApi, apiPut, apiPost } from '@/hooks/use-api';
import { toast } from '@/lib/toast';
import { ShotEditorPanel } from '@/components/cinema/shot-editor-panel';
import { Timeline } from '@/components/cinema/timeline';
import { PipelineProgress } from '@/components/cinema/pipeline-progress';
import { AiGuidancePanel } from '@/components/cinema/ai-guidance-panel';
import type { ShotData } from '@/components/cinema/shot-editor-panel';
import type { GuidanceSuggestion } from '@/components/cinema/ai-guidance-panel';
import Link from 'next/link';
import { ComplexityToggle } from '@/components/ui/complexity-toggle';
import { ExportVariants } from '@/components/cinema/export-variants';
import { ProvenanceViewer } from '@/components/cinema/provenance-viewer';
import { ViralScorePanel } from '@/components/cinema/viral-score-panel';
import { useComplexityMode } from '@/hooks/use-complexity-mode';
import { isVisible } from '@/lib/complexity-fields';

interface StudioContent {
  id: string;
  title: string;
  status: string;
  contentType: string;
  storyboards: Array<{
    id: string;
    status: string;
    totalDurationSec: number;
    shots: Array<{
      id: string;
      shotNumber: number;
      status: string;
      startSec: number;
      endSec: number;
      keyframeUrls: string[];
      qualityScore: number | null;
      shotspec: Record<string, unknown>;
    }>;
  }>;
}

export default function StudioPage({ params }: { params: Promise<{ contentId: string }> }) {
  const { contentId } = use(params);
  const { data, error, isLoading, mutate } = useApi<StudioContent>(`/content/${contentId}?include=storyboards`);
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<GuidanceSuggestion[]>([]);
  const guidanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { mode } = useComplexityMode();

  const content = data?.data;
  const storyboard = content?.storyboards?.[0];
  const shots: ShotData[] = storyboard?.shots ?? [];

  const handleUpdateShot = useCallback(async (shotId: string, spec: Record<string, unknown>) => {
    try {
      await apiPut(`/storyboard-shots/${shotId}`, { shotspec: spec });
      await mutate();
    } catch {
      toast.error('Failed to update shot');
    }
  }, [mutate]);

  const handleGenerateShot = useCallback(async (shotId: string) => {
    try {
      await apiPost(`/storyboard-shots/${shotId}/generate`, {});
      toast.success('Shot generation started');
      await mutate();
    } catch {
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
        channelId: '',
        repairType,
      });
      toast.success(`Shot ${repairType} repair started`);
      await mutate();
    } catch {
      toast.error('Failed to start repair');
    }
  }, [storyboard, contentId, mutate]);

  const handleGenerateAll = useCallback(async () => {
    if (!storyboard) return;
    try {
      await apiPost(`/pipeline/cinema`, {
        contentId,
        channelId: '',
        topic: content?.title ?? '',
        contentType: 'short',
        storyboardId: storyboard.id,
        shotIds: shots.map(s => s.id),
      });
      toast.success('Cinema pipeline started');
      await mutate();
    } catch {
      toast.error('Failed to start pipeline');
    }
  }, [storyboard, contentId, content, shots, mutate]);

  const handleApplyGuidance = useCallback(async (patch: Record<string, unknown>) => {
    if (!selectedShotId) return;
    const shot = shots.find(s => s.id === selectedShotId);
    if (!shot) return;
    await handleUpdateShot(selectedShotId, { ...shot.shotspec, ...patch });
  }, [selectedShotId, shots, handleUpdateShot]);

  // Fetch AI guidance when selected shot changes (debounced)
  useEffect(() => {
    if (guidanceTimerRef.current) clearTimeout(guidanceTimerRef.current);

    const selectedShot = shots.find(s => s.id === selectedShotId);
    if (!selectedShot?.shotspec) {
      setSuggestions([]);
      return;
    }

    guidanceTimerRef.current = setTimeout(async () => {
      try {
        const res = await apiPost<{ suggestions: GuidanceSuggestion[] }>('/ai/guidance', {
          shotSpec: selectedShot.shotspec,
        });
        setSuggestions(res?.suggestions ?? []);
      } catch {
        // Silently fail — guidance is non-critical
        setSuggestions([]);
      }
    }, 500);

    return () => {
      if (guidanceTimerRef.current) clearTimeout(guidanceTimerRef.current);
    };
  }, [selectedShotId, shots]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-pulse text-text-secondary">Loading studio...</div>
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
          <h1 className="text-sm font-medium text-text-primary truncate max-w-md">{content.title}</h1>
          <span className="text-xs text-text-tertiary bg-bg-tertiary px-2 py-0.5 rounded">{content.status}</span>
        </div>
        <div className="flex items-center gap-3">
          <ComplexityToggle />
          <button
            onClick={handleGenerateAll}
            className="px-3 py-1.5 bg-accent-blue text-white rounded-md text-sm hover:bg-accent-blue/90"
          >
            Render
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-12 h-full">
          {/* Shot editor (10 cols) */}
          <div className="col-span-10 p-4 overflow-hidden">
            {shots.length > 0 ? (
              <ShotEditorPanel
                shots={shots}
                onUpdateShot={handleUpdateShot}
                onGenerateShot={handleGenerateShot}
                onGenerateAll={handleGenerateAll}
                onRepairShot={handleRepairShot}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-text-secondary">No storyboard yet</p>
                  <button
                    onClick={handleGenerateAll}
                    className="mt-3 px-4 py-2 bg-accent-blue text-white rounded-md text-sm"
                  >
                    Generate Storyboard
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right panel: guidance + progress (2 cols) */}
          <div className="col-span-2 border-l border-border p-3 overflow-y-auto space-y-4">
            <AiGuidancePanel
              suggestions={suggestions}
              onApplyAction={handleApplyGuidance}
            />
            <PipelineProgress contentId={contentId} />
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
                channelId=""
                qualityPreset="cinema"
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
