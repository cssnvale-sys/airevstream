'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { ShotList } from './shot-list';
import { ShotPreview } from './shot-preview';
import { ShotProperties } from './shot-properties';
import { PresetPicker } from './preset-picker';
import { StyleCardPicker } from './style-card-picker';
import { ProjectTypePicker } from './project-type-picker';
import { useComplexityMode } from '@/hooks/use-complexity-mode';
import { isVisible } from '@/lib/complexity-fields';
import {
  resolvePresets,
  resolvePresetsWithDirectives,
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

type RepairType = 'inpaint' | 'face-fix' | 'lighting-harmonize';

interface ShotEditorPanelProps {
  shots: ShotData[];
  onUpdateShot: (shotId: string, spec: Record<string, unknown>) => Promise<void>;
  onGenerateShot: (shotId: string) => Promise<void>;
  onGenerateAll: () => Promise<void>;
  onRepairShot?: (shotId: string, repairType: RepairType) => Promise<void>;
}

export function ShotEditorPanel({ shots, onUpdateShot, onGenerateShot, onGenerateAll, onRepairShot }: ShotEditorPanelProps) {
  const [selectedShotId, setSelectedShotId] = useState<string | null>(shots[0]?.id ?? null);
  const [selectedProjectType, setSelectedProjectType] = useState<string | undefined>();
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
    // Use directives-aware resolver to strip _directives from the shot spec
    // (directives are project-level, not shot-level — we discard them here)
    const { shotSpec } = resolvePresetsWithDirectives(selectedShot.shotspec as unknown as ShotSpec, {
      recipe,
      allPresets: ALL_BUILT_IN_PRESETS,
      recipeDirectives: recipe.directives,
    });
    await onUpdateShot(selectedShotId, shotSpec as unknown as Record<string, unknown>);
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
          {isVisible('advanced', mode) && onRepairShot && (selectedShot?.keyframeUrls?.length ?? 0) > 0 && (
            <RepairMenu
              onRepair={(type) => selectedShotId && onRepairShot(selectedShotId, type)}
            />
          )}
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
            {mode === 'simple' ? (
              <>
                <ProjectTypePicker
                  onSelect={(type, overrides) => {
                    setSelectedProjectType(type);
                    handleApplyPreset(overrides);
                  }}
                  selectedType={selectedProjectType}
                />
                <StyleCardPicker onApply={handleApplyPreset} />
              </>
            ) : (
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

// ─── Repair Dropdown Menu ───

function RepairMenu({ onRepair }: { onRepair: (type: RepairType) => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const items: { type: RepairType; label: string; desc: string }[] = [
    { type: 'inpaint', label: 'Inpaint', desc: 'Fix a masked region' },
    { type: 'face-fix', label: 'Face Fix', desc: 'Auto-detect and repair faces' },
    { type: 'lighting-harmonize', label: 'Lighting Match', desc: 'Match lighting to reference' },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="px-3 py-1.5 bg-bg-tertiary text-text-primary rounded-md text-sm hover:bg-border border border-border"
      >
        Repair
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-52 bg-bg-secondary border border-border rounded-lg shadow-lg z-20">
          {items.map((item) => (
            <button
              key={item.type}
              onClick={() => { onRepair(item.type); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-bg-tertiary first:rounded-t-lg last:rounded-b-lg"
            >
              <div className="text-sm text-text-primary">{item.label}</div>
              <div className="text-xs text-text-secondary">{item.desc}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
