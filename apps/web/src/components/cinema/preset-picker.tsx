'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  ALL_BUILT_IN_PRESETS,
  BUILT_IN_RECIPES,
} from '@airevstream/shared';
import type { Preset, Recipe, PresetFamily } from '@airevstream/shared';

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
  story: 'Story',
  dialogue: 'Dialogue',
  continuity: 'Continuity',
};

const FAMILY_COLORS: Record<PresetFamily, string> = {
  visual: 'bg-purple-500/15 border-purple-500/30 text-purple-400',
  camera: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
  audio: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
  edit: 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400',
  output: 'bg-orange-500/15 border-orange-500/30 text-orange-400',
  project: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400',
  story: 'bg-pink-500/15 border-pink-500/30 text-pink-400',
  dialogue: 'bg-teal-500/15 border-teal-500/30 text-teal-400',
  continuity: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400',
};

type TabValue = 'recipes' | PresetFamily;

export function PresetPicker({ onApplyPreset, onApplyRecipe }: PresetPickerProps) {
  const [activeTab, setActiveTab] = useState<TabValue>('recipes');
  const [search, setSearch] = useState('');

  const tabs: { value: TabValue; label: string }[] = [
    { value: 'recipes', label: 'Recipes' },
    ...(['visual', 'camera', 'audio', 'output'] as PresetFamily[]).map((f) => ({
      value: f as TabValue,
      label: FAMILY_LABELS[f],
    })),
  ];

  const filteredPresets = useMemo(() => {
    if (activeTab === 'recipes') return [];
    return ALL_BUILT_IN_PRESETS.filter((p) => {
      if (p.family !== activeTab) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.tags.some((t) => t.includes(q));
    });
  }, [activeTab, search]);

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

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <div className="px-3 py-2 bg-bg-tertiary border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-text-primary">Presets</span>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search presets..."
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
              <RecipeCard key={recipe.id} recipe={recipe} onApply={onApplyRecipe} />
            ))
          )
        ) : (
          filteredPresets.length === 0 ? (
            <p className="text-xs text-text-tertiary text-center py-4">No presets found</p>
          ) : (
            filteredPresets.map((preset) => (
              <PresetCard key={preset.id} preset={preset} onApply={onApplyPreset} />
            ))
          )
        )}
      </div>
    </div>
  );
}

function PresetCard({ preset, onApply }: { preset: Preset; onApply: (overrides: Record<string, unknown>) => void }) {
  return (
    <button
      onClick={() => onApply(preset.overrides)}
      className="w-full text-left p-2 rounded border border-border hover:border-accent-blue/50 hover:bg-accent-blue/5 transition-colors"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium text-text-primary">{preset.name}</span>
        <span className={cn('text-[10px] px-1.5 py-0.5 rounded border', FAMILY_COLORS[preset.family])}>
          {FAMILY_LABELS[preset.family]}
        </span>
      </div>
      {preset.description && (
        <p className="text-[11px] text-text-tertiary">{preset.description}</p>
      )}
    </button>
  );
}

function RecipeCard({ recipe, onApply }: { recipe: Recipe; onApply: (recipe: Recipe) => void }) {
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
          <span key={tag} className="text-[10px] bg-bg-tertiary text-text-tertiary px-1 rounded">
            {tag}
          </span>
        ))}
      </div>
    </button>
  );
}
