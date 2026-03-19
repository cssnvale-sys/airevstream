'use client';

import { useState, useCallback } from 'react';
import { ShotList } from './shot-list';
import { ShotPreview } from './shot-preview';
import { ShotProperties } from './shot-properties';

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

  const handleSpecChange = useCallback(async (spec: Record<string, unknown>) => {
    if (selectedShotId) {
      await onUpdateShot(selectedShotId, spec);
    }
  }, [selectedShotId, onUpdateShot]);

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
      <div className="col-span-5 overflow-y-auto">
        {selectedShot ? (
          <ShotProperties
            spec={selectedShot.shotspec}
            onChange={handleSpecChange}
          />
        ) : (
          <div className="text-center py-8 text-text-secondary text-sm">
            Select a shot to edit properties
          </div>
        )}
      </div>
    </div>
  );
}
