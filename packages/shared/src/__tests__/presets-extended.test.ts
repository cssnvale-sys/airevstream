import { describe, it, expect } from 'vitest';
import {
  ALL_BUILT_IN_PRESETS,
  PROJECT_PRESETS,
  CHARACTER_PRESETS,
  STORY_PRESETS,
  DIALOGUE_PRESETS,
  CONTINUITY_PRESETS,
  EDIT_PRESETS,
  BUILT_IN_RECIPES,
  MASTER_BUNDLES,
} from '../presets/index.js';

describe('extended presets', () => {
  it('should have 5 project presets', () => {
    expect(PROJECT_PRESETS).toHaveLength(5);
    for (const p of PROJECT_PRESETS) {
      expect(p.family).toBe('project');
    }
  });

  it('should have 5 character presets', () => {
    expect(CHARACTER_PRESETS).toHaveLength(5);
    for (const p of CHARACTER_PRESETS) {
      expect(p.family).toBe('character');
    }
  });

  it('should have 3 story presets', () => {
    expect(STORY_PRESETS).toHaveLength(3);
    for (const p of STORY_PRESETS) {
      expect(p.family).toBe('story');
    }
  });

  it('should have 2 dialogue presets', () => {
    expect(DIALOGUE_PRESETS).toHaveLength(2);
    for (const p of DIALOGUE_PRESETS) {
      expect(p.family).toBe('dialogue');
    }
  });

  it('should have 3 continuity presets', () => {
    expect(CONTINUITY_PRESETS).toHaveLength(3);
    for (const p of CONTINUITY_PRESETS) {
      expect(p.family).toBe('continuity');
    }
  });

  it('should have 3 edit presets', () => {
    expect(EDIT_PRESETS).toHaveLength(3);
    for (const p of EDIT_PRESETS) {
      expect(p.family).toBe('edit');
    }
  });

  it('should include all new families in ALL_BUILT_IN_PRESETS', () => {
    const families = new Set(ALL_BUILT_IN_PRESETS.map(p => p.family));
    expect(families.has('project')).toBe(true);
    expect(families.has('story')).toBe(true);
    expect(families.has('dialogue')).toBe(true);
    expect(families.has('continuity')).toBe(true);
    expect(families.has('edit')).toBe(true);
    expect(families.has('character')).toBe(true);
  });

  it('should have ranges on film-noir preset', () => {
    const filmNoir = ALL_BUILT_IN_PRESETS.find(p => p.id === 'visual.film-noir.v1');
    expect(filmNoir).toBeDefined();
    expect(filmNoir!.ranges).toBeDefined();
    expect(filmNoir!.ranges!['colorGrade.saturation']).toEqual({ min: -80, max: -30 });
  });

  it('should have tier on project presets', () => {
    for (const p of PROJECT_PRESETS) {
      expect(p.tier).toBeDefined();
    }
  });

  it('should have unique IDs across all presets', () => {
    const ids = ALL_BUILT_IN_PRESETS.map(p => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should have valid ID format on all presets', () => {
    for (const p of ALL_BUILT_IN_PRESETS) {
      // IDs follow the pattern: family.name.version e.g. "visual.film-noir.v1"
      expect(p.id).toMatch(/^[a-z]+\.[a-z0-9-]+\.v\d+$/);
    }
  });

  it('should have 41 total built-in presets', () => {
    expect(ALL_BUILT_IN_PRESETS).toHaveLength(41);
  });

  it('should have 15 total built-in recipes', () => {
    expect(BUILT_IN_RECIPES).toHaveLength(15);
  });

  it('should have 12 master bundles', () => {
    expect(MASTER_BUNDLES).toHaveLength(12);
  });
});
