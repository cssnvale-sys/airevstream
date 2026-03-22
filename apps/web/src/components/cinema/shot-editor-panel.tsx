'use client';

import { useState, useCallback } from 'react';
import { ShotList } from './shot-list';
import { ShotPreview } from './shot-preview';
import { ShotProperties } from './shot-properties';
import { PresetPicker } from './preset-picker';
import { useComplexityMode } from '@/hooks/use-complexity-mode';
import { isVisible } from '@/lib/complexity-fields';
import {
  resolvePresets,
  ALL_BUILT_IN_PRESETS,
} from '@airevstream/shared';
import type { Recipe, ShotSpec } from '@airevstream/shared';

export interface ShotData {
  id: string;
  shotNumber: number;
  status: string;
  startSec: number;
  endSec: number;
  keyframeUrls: string[];
  qualityScore: number | null;
  shotspec: Record<string, unknown>;
}

interface ShotEditorPanelProps {
  shots: ShotData[];
  onUpdateShot: (shotId: string, spec: Record<string, unknown>) => Promise<void>;
  onGenerateShot: (shotId: string) => Promise<void>;
  onGenerateAll: () => Promise<void>;
}

export function ShotEditorPanel({ shots, onUpdateShot, onGenerateShot, onGenerateAll }: ShotEditorPanelProps) {
  const [selectedShotId, setSelectedShotId] = useState<string | null>(shots[0]?.id ?? null);
  const selectedShot = shots.find((s) => s.id === selectedShotId) ?? null;
  const { mode } = useComplexityMode();

  const handleSpecChange = useCallback(async (spec: Record<string, unknown>) => {
    if (selectedShotId) {
      await onUpdateShot(selectedShotId, spec);
    }
  }, [selectedShotId, onUpdateShot]);

  const handleApplyPreset = useCallback(async (overrides: Record<string, unknown>) => {
    if (!selectedShotId || !selectedShot) return;
    const resolved = resolvePresets(selectedShot.shotspec as unknown as ShotSpec, {
      userOverrides: overrides as unknown as Partial<ShotSpec>,
    });
    await onUpdateShot(selectedShotId, resolved as unknown as Record<string, unknown>);
  }, [selectedShotId, selectedShot, onUpdateShot]);

  const handleApplyRecipe = useCallback(async (recipe: Recipe) => {
    if (!selectedShotId || !selectedShot) return;
    const resolved = resolvePresets(selectedShot.shotspec as unknown as ShotSpec, {
      recipe,
      allPresets: ALL_BUILT_IN_PRESETS,
    });
    await onUpdateShot(selectedShotId, resolved as unknown as Record<string, unknown>);
  }, [selectedShotId, selectedShot, onUpdateShot]);

  return (
    <div className="grid grid-cols-12 gap-4 h-full">
      {/* Left: Shot list */}
      <div className="col-span-2 overflow-y-auto border-r border-border pr-2">
        <ShotList
          shots={shots}
          selectedId={selectedShotId}
          onSelect={setSelectedShotId}
        />
      </div>

      {/* Center: Preview */}
      <div className="col-span-5 flex flex-col">
        <ShotPreview shot={selectedShot} />
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => selectedShotId && onGenerateShot(selectedShotId)}
            disabled={!selectedShotId}
            className="px-3 py-1.5 bg-accent-blue text-white rounded-md text-sm hover:bg-accent-blue/90 disabled:opacity-50"
          >
            Generate Shot
          </button>
          <button
            onClick={onGenerateAll}
            className="px-3 py-1.5 bg-bg-tertiary text-text-primary rounded-md text-sm hover:bg-border"
          >
            Generate All
          </button>
        </div>
      </div>

      {/* Right: Properties */}
      <div className="col-span-5 overflow-y-auto space-y-4">
        {selectedShot ? (
          <>
            <ShotProperties
              spec={selectedShot.shotspec}
              onChange={handleSpecChange}
            />
            {isVisible('advanced', mode) && (
              <PresetPicker
                onApplyPreset={handleApplyPreset}
                onApplyRecipe={handleApplyRecipe}
              />
            )}
          </>
        ) : (
          <div className="text-center py-8 text-text-secondary text-sm">
            Select a shot to edit properties
          </div>
        )}
      </div>
    </div>
  );
}
