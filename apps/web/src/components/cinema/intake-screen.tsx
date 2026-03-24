'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useComplexityMode } from '@/hooks/use-complexity-mode';
import type { ComplexityMode } from '@/lib/complexity-fields';
import {
  MASTER_BUNDLES,
  ALL_BUILT_IN_PRESETS,
  resolvePresetsWithDirectives,
} from '@airevstream/shared';
import type { RecipeCategory, Recipe, ProductionDirectives, ShotSpec } from '@airevstream/shared';
import {
  BookOpen,
  Film,
  Smartphone,
  Clapperboard,
  ChevronRight,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IntakeResult {
  recipe: Recipe;
  resolvedOverrides: Record<string, unknown>;
  directives: ProductionDirectives;
  category: RecipeCategory;
  mood: string;
}

interface IntakeScreenProps {
  onComplete: (result: IntakeResult) => void;
}

// ---------------------------------------------------------------------------
// Category data
// ---------------------------------------------------------------------------

const CATEGORIES: { value: RecipeCategory; label: string; description: string; icon: typeof BookOpen }[] = [
  { value: 'one-off', label: 'One-off', description: 'A standalone video', icon: BookOpen },
  { value: 'series', label: 'Series', description: 'Recurring episodes', icon: Film },
  { value: 'shorts', label: 'Shorts', description: 'Vertical short-form', icon: Smartphone },
  { value: 'cinematic', label: 'Cinematic', description: 'Film-quality content', icon: Clapperboard },
];

const COMPLEXITY_OPTIONS: { value: ComplexityMode; label: string; description: string }[] = [
  { value: 'simple', label: 'Simple', description: 'Quick, guided creation' },
  { value: 'advanced', label: 'Advanced', description: 'More control over settings' },
  { value: 'complex', label: 'Complex', description: 'Full technical control' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IntakeScreen({ onComplete }: IntakeScreenProps) {
  const [selectedCategory, setSelectedCategory] = useState<RecipeCategory | null>(null);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const { mode, setMode } = useComplexityMode();

  // Filter bundles by selected category
  const moodOptions = useMemo(() => {
    if (!selectedCategory) return [];
    return MASTER_BUNDLES.filter((r) => r.category === selectedCategory);
  }, [selectedCategory]);

  // Reset mood when category changes
  const handleCategorySelect = (cat: RecipeCategory) => {
    setSelectedCategory(cat);
    setSelectedMood(null);
  };

  const canProceed = !!selectedCategory && !!selectedMood;

  const handleNext = () => {
    if (!canProceed) return;

    const recipe = MASTER_BUNDLES.find(
      (r) => r.category === selectedCategory && r.mood === selectedMood,
    );
    if (!recipe) return;

    // Resolve the recipe's preset stack
    const base = {} as ShotSpec;
    const { shotSpec, directives } = resolvePresetsWithDirectives(base, {
      recipe,
      allPresets: ALL_BUILT_IN_PRESETS,
      recipeDirectives: recipe.directives,
    });

    onComplete({
      recipe,
      resolvedOverrides: shotSpec as unknown as Record<string, unknown>,
      directives,
      category: selectedCategory,
      mood: selectedMood,
    });
  };

  return (
    <div className="space-y-8">
      {/* Question 1: Category */}
      <div>
        <h2 className="text-section-heading text-text-primary mb-1">What are you making?</h2>
        <p className="text-text-secondary text-caption mb-3">Pick a content category.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.value;
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => handleCategorySelect(cat.value)}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-lg border text-center transition-colors',
                  isSelected
                    ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                    : 'border-border bg-bg-secondary text-text-secondary hover:bg-bg-tertiary hover:text-text-primary',
                )}
              >
                <Icon size={24} />
                <span className="text-body font-medium">{cat.label}</span>
                <span className="text-caption opacity-70">{cat.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Question 2: Mood (filtered by category) */}
      {selectedCategory && (
        <div>
          <h2 className="text-section-heading text-text-primary mb-1">What should it feel like?</h2>
          <p className="text-text-secondary text-caption mb-3">
            Choose a style — each auto-configures visuals, audio, and pacing.
          </p>
          <div className="flex flex-wrap gap-2">
            {moodOptions.map((bundle) => {
              const isSelected = selectedMood === bundle.mood;
              return (
                <button
                  key={bundle.id}
                  type="button"
                  onClick={() => setSelectedMood(bundle.mood ?? null)}
                  className={cn(
                    'px-4 py-2 rounded-md border text-body font-medium transition-colors',
                    isSelected
                      ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                      : 'border-border text-text-secondary hover:bg-bg-tertiary hover:text-text-primary',
                  )}
                >
                  {bundle.mood}
                </button>
              );
            })}
          </div>
          {selectedMood && (
            <p className="text-caption text-text-secondary mt-2">
              {moodOptions.find((b) => b.mood === selectedMood)?.description}
            </p>
          )}
        </div>
      )}

      {/* Question 3: Complexity */}
      {selectedCategory && (
        <div>
          <h2 className="text-section-heading text-text-primary mb-1">How much control do you want?</h2>
          <p className="text-text-secondary text-caption mb-3">
            Simple uses the recipe as-is. Advanced and Complex unlock more settings.
          </p>
          <div className="grid grid-cols-3 gap-3 max-w-lg">
            {COMPLEXITY_OPTIONS.map((opt) => {
              const isSelected = mode === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMode(opt.value)}
                  className={cn(
                    'flex flex-col items-center gap-1 p-3 rounded-lg border text-center transition-colors',
                    isSelected
                      ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                      : 'border-border text-text-secondary hover:bg-bg-tertiary',
                  )}
                >
                  <span className="text-body font-medium">{opt.label}</span>
                  <span className="text-caption opacity-70">{opt.description}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Next button */}
      {canProceed && (
        <div className="flex justify-end">
          <button
            onClick={handleNext}
            className="btn-primary flex items-center gap-2"
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
