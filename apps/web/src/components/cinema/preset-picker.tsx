'use client';

import { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  ALL_BUILT_IN_PRESETS,
  BUILT_IN_RECIPES,
} from '@airevstream/shared';
import type { Preset, Recipe, PresetFamily } from '@airevstream/shared';
import { useUserPresets, deleteUserPreset } from '@/hooks/use-user-presets';
import { useComplexityMode } from '@/hooks/use-complexity-mode';
import { CreatePresetModal } from './create-preset-modal';

interface PresetPickerProps {
  onApplyPreset: (overrides: Record<string, unknown>) => void;
  onApplyRecipe: (recipe: Recipe) => void;
}

const FAMILY_LABELS: Record<PresetFamily, string> = {
  visual: 'Visual',
  camera: 'Camera',
  audio: 'Audio',
  edit: 'Edit',
  output: 'Output',
  project: 'Project',
  character: 'Character',
  story: 'Story',
  dialogue: 'Dialogue',
  continuity: 'Continuity',
};

const FAMILY_COLORS: Record<PresetFamily, string> = {
  visual: 'bg-accent-purple/15 border-accent-purple/30 text-accent-purple',
  camera: 'bg-accent-blue/15 border-accent-blue/30 text-accent-blue',
  audio: 'bg-accent-green/15 border-accent-green/30 text-accent-green',
  edit: 'bg-accent-amber/15 border-accent-amber/30 text-accent-amber',
  output: 'bg-accent-red/15 border-accent-red/30 text-accent-red',
  project: 'bg-accent-blue/15 border-accent-blue/30 text-accent-blue',
  character: 'bg-accent-red/15 border-accent-red/30 text-accent-red',
  story: 'bg-accent-red/15 border-accent-red/30 text-accent-red',
  dialogue: 'bg-accent-green/15 border-accent-green/30 text-accent-green',
  continuity: 'bg-accent-blue/15 border-accent-blue/30 text-accent-blue',
};

type TabValue = 'recipes' | 'my-presets' | PresetFamily;

export function PresetPicker({ onApplyPreset, onApplyRecipe }: PresetPickerProps) {
  const [activeTab, setActiveTab] = useState<TabValue>('recipes');
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { mode } = useComplexityMode();

  const { presets: userPresets, records: userRecords, mutate } = useUserPresets();

  const tabs: { value: TabValue; label: string }[] = [
    { value: 'recipes', label: 'Recipes' },
    { value: 'my-presets', label: 'My Presets' },
    ...(['visual', 'camera', 'audio', 'character', 'output'] as PresetFamily[]).map((f) => ({
      value: f as TabValue,
      label: FAMILY_LABELS[f],
    })),
  ];

  // Merge built-in + user presets for family tabs
  const allPresets = useMemo(
    () => [...ALL_BUILT_IN_PRESETS, ...userPresets],
    [userPresets],
  );

  // User preset IDs for marking custom badge
  const userPresetIds = useMemo(
    () => new Set(userPresets.map((p) => p.id)),
    [userPresets],
  );

  const filteredPresets = useMemo(() => {
    if (activeTab === 'recipes' || activeTab === 'my-presets') return [];
    return allPresets.filter((p) => {
      if (p.family !== activeTab) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.tags.some((t) => t.includes(q));
    });
  }, [activeTab, search, allPresets]);

  const filteredUserPresets = useMemo(() => {
    if (activeTab !== 'my-presets') return [];
    if (!search) return userPresets;
    const q = search.toLowerCase();
    return userPresets.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q) ||
      p.tags.some((t) => t.includes(q)),
    );
  }, [activeTab, search, userPresets]);

  const filteredRecipes = useMemo(() => {
    if (activeTab !== 'recipes') return [];
    if (!search) return BUILT_IN_RECIPES;
    const q = search.toLowerCase();
    return BUILT_IN_RECIPES.filter((r) =>
      r.name.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q) ||
      r.tags.some((t) => t.includes(q)),
    );
  }, [activeTab, search]);

  const handleDelete = useCallback(async (preset: Preset) => {
    // Find the DB record to get the UUID
    const record = userRecords.find((r) => r.presetId === preset.id);
    if (!record) return;
    await deleteUserPreset(record.id, preset.id, mutate);
  }, [userRecords, mutate]);

  return (
    <>
      <div className="border border-border rounded-md overflow-hidden">
        <div className="px-3 py-2 bg-bg-tertiary border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-text-primary">Presets</span>
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-[10px] px-2 py-0.5 rounded border border-accent-blue/30 text-accent-blue hover:bg-accent-blue/10 transition-colors"
            >
              + Create
            </button>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search presets..."
            aria-label="Search presets"
            className="w-full bg-bg-primary text-text-primary border border-border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-accent-blue outline-none"
          />
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border overflow-x-auto">
          {tabs.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setActiveTab(value)}
              className={cn(
                'px-3 py-1.5 text-xs whitespace-nowrap transition-colors',
                activeTab === value
                  ? 'text-accent-blue border-b-2 border-accent-blue'
                  : 'text-text-tertiary hover:text-text-secondary',
              )}
            >
              {label}
              {value === 'my-presets' && userPresets.length > 0 && (
                <span className="ml-1 text-[10px] text-text-tertiary">({userPresets.length})</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-2 max-h-64 overflow-y-auto space-y-1.5">
          {activeTab === 'recipes' ? (
            filteredRecipes.length === 0 ? (
              <p className="text-xs text-text-tertiary text-center py-4">No recipes found</p>
            ) : (
              filteredRecipes.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} onApply={onApplyRecipe} mode={mode} />
              ))
            )
          ) : activeTab === 'my-presets' ? (
            filteredUserPresets.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-xs text-text-tertiary mb-2">No custom presets yet</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="text-xs text-accent-blue hover:text-accent-blue/80 transition-colors"
                >
                  Create your first preset
                </button>
              </div>
            ) : (
              filteredUserPresets.map((preset) => (
                <PresetCard
                  key={preset.id}
                  preset={preset}
                  onApply={onApplyPreset}
                  isCustom
                  onDelete={() => handleDelete(preset)}
                />
              ))
            )
          ) : (
            filteredPresets.length === 0 ? (
              <p className="text-xs text-text-tertiary text-center py-4">No presets found</p>
            ) : (
              filteredPresets.map((preset) => (
                <PresetCard
                  key={preset.id}
                  preset={preset}
                  onApply={onApplyPreset}
                  isCustom={userPresetIds.has(preset.id)}
                  onDelete={userPresetIds.has(preset.id) ? () => handleDelete(preset) : undefined}
                />
              ))
            )
          )}
        </div>
      </div>

      <CreatePresetModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSaved={() => mutate()}
      />
    </>
  );
}

function PresetCard({
  preset,
  onApply,
  isCustom,
  onDelete,
}: {
  preset: Preset;
  onApply: (overrides: Record<string, unknown>) => void;
  isCustom?: boolean;
  onDelete?: () => void;
}) {
  return (
    <div className="relative group">
      <button
        onClick={() => onApply(preset.overrides)}
        className="w-full text-left p-2 rounded border border-border hover:border-accent-blue/50 hover:bg-accent-blue/5 transition-colors"
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-text-primary">{preset.name}</span>
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded border', FAMILY_COLORS[preset.family])}>
            {FAMILY_LABELS[preset.family]}
          </span>
          {isCustom && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border bg-accent-blue/15 border-accent-blue/30 text-accent-blue">
              Custom
            </span>
          )}
        </div>
        {preset.description && (
          <p className="text-[11px] text-text-tertiary">{preset.description}</p>
        )}
      </button>
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-accent-red transition-all text-xs leading-none p-0.5"
          title="Delete preset"
          aria-label="Delete preset"
        >
          &times;
        </button>
      )}
    </div>
  );
}

function RecipeCard({ recipe, onApply, mode }: { recipe: Recipe; onApply: (recipe: Recipe) => void; mode?: string }) {
  return (
    <button
      onClick={() => onApply(recipe)}
      className="w-full text-left p-2 rounded border border-border hover:border-accent-purple/50 hover:bg-accent-purple/5 transition-colors"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium text-text-primary">{recipe.name}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded border bg-accent-purple/15 border-accent-purple/30 text-accent-purple">
          Recipe
        </span>
      </div>
      {recipe.description && (
        <p className="text-[11px] text-text-tertiary">{recipe.description}</p>
      )}
      <div className="flex gap-1 mt-1.5 flex-wrap">
        {recipe.tags.map((tag) => (
          <span key={tag} className="text-[10px] bg-bg-tertiary text-text-secondary px-1 rounded">
            {tag}
          </span>
        ))}
      </div>
      {mode && mode !== 'simple' && (recipe.routing || recipe.constraints) && (
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {recipe.routing && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border bg-accent-blue/10 border-accent-blue/20 text-accent-blue">
              {[recipe.routing.keyframeEngine, recipe.routing.motionEngine].filter(Boolean).join(' + ')} &rarr; {recipe.routing.assemblyEngine ?? 'remotion'}
            </span>
          )}
          {recipe.constraints?.maxRuntimeSeconds && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border bg-accent-amber/10 border-accent-amber/20 text-accent-amber">
              max {recipe.constraints.maxRuntimeSeconds}s
            </span>
          )}
          {recipe.constraints?.maxCostUsd && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border bg-accent-green/10 border-accent-green/20 text-accent-green">
              ${recipe.constraints.maxCostUsd}
            </span>
          )}
          {recipe.constraints?.allowedAspects && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border bg-accent-blue/10 border-accent-blue/20 text-accent-blue">
              {recipe.constraints.allowedAspects.join(', ')}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
