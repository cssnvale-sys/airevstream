'use client';

import { useCallback, useState } from 'react';
import { useApi, apiPost, apiDelete } from '@/hooks/use-api';
import type { Preset, PresetFamily } from '@airevstream/shared';

const LS_KEY = 'airevstream:user-presets';

// ─── Types ───

interface UserPresetRecord {
  id: string;
  tenantId: string;
  userId: string;
  presetId: string;
  name: string;
  family: string;
  description: string | null;
  tags: string[];
  overrides: Record<string, unknown>;
  tier: string | null;
  ranges: Record<string, { min: number; max: number }> | null;
  source: string;
  aiPrompt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface GenerateResponse {
  success: boolean;
  data: { preset: Preset; model: string };
}

interface SaveResponse {
  success: boolean;
  data: UserPresetRecord;
}

// ─── localStorage helpers ───

function readLocalPresets(): Preset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocalPresets(presets: Preset[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(presets));
  } catch {
    // Storage full — ignore
  }
}

/** Convert a DB record into a Preset object */
function recordToPreset(r: UserPresetRecord): Preset {
  return {
    id: r.presetId,
    name: r.name,
    family: r.family as PresetFamily,
    description: r.description ?? undefined,
    tags: r.tags,
    builtIn: false,
    overrides: r.overrides,
    ...(r.tier ? { tier: r.tier as Preset['tier'] } : {}),
    ...(r.ranges ? { ranges: r.ranges } : {}),
  };
}

// ─── useUserPresets ───

export function useUserPresets(family?: string) {
  const queryParams = family ? `?family=${family}&limit=100` : '?limit=100';
  const { data, error, isLoading, mutate } = useApi<UserPresetRecord[]>(
    `/presets${queryParams}`,
  );

  const presets: Preset[] = (data?.data ?? []).map(recordToPreset);

  // Sync to localStorage when API data loads
  if (data?.data) {
    writeLocalPresets(data.data.map(recordToPreset));
  }

  return { presets, error, isLoading, mutate };
}

// ─── useGeneratePreset ───

export function useGeneratePreset() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<{ preset: Preset; model: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (description: string) => {
    setIsGenerating(true);
    setError(null);
    setResult(null);
    try {
      const res = await apiPost<GenerateResponse>('/presets/generate', { description });
      setResult(res.data);
      return res.data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed';
      setError(msg);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { generate, isGenerating, result, error, reset };
}

// ─── savePreset ───

export async function savePreset(
  preset: Preset,
  aiPrompt?: string,
  mutate?: () => void,
): Promise<UserPresetRecord | null> {
  // Optimistic: write to localStorage immediately
  const local = readLocalPresets();
  const updated = [...local.filter((p) => p.id !== preset.id), preset];
  writeLocalPresets(updated);

  try {
    const res = await apiPost<SaveResponse>('/presets', {
      name: preset.name,
      family: preset.family,
      description: preset.description ?? null,
      tags: preset.tags,
      overrides: preset.overrides,
      tier: preset.tier ?? null,
      ranges: preset.ranges ?? null,
      source: aiPrompt ? 'ai' : 'manual',
      aiPrompt: aiPrompt ?? null,
    });
    mutate?.();
    return res.data;
  } catch (err) {
    console.error('Failed to save preset to server:', err);
    // localStorage still has it — will sync on next load
    return null;
  }
}

// ─── deletePreset ───

export async function deleteUserPreset(
  id: string,
  presetId: string,
  mutate?: () => void,
): Promise<void> {
  // Remove from localStorage
  const local = readLocalPresets();
  writeLocalPresets(local.filter((p) => p.id !== presetId));

  try {
    await apiDelete(`/presets/${id}`);
    mutate?.();
  } catch (err) {
    console.error('Failed to delete preset from server:', err);
  }
}
