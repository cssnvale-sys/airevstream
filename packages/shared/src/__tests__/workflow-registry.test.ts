import { describe, it, expect } from 'vitest';
import {
  WORKFLOW_REGISTRY,
  SHOT_CLASSES,
  getWorkflowForShotClass,
  getWorkflowsForProvider,
  getWorkflowWithDefaults,
  validateWorkflowRequirements,
  getWorkflowsByTags,
} from '../workflow-registry.js';
import type { ShotSpec } from '../types.js';

describe('workflow-registry', () => {
  it('should have at least 4 registered workflows', () => {
    expect(WORKFLOW_REGISTRY.length).toBeGreaterThanOrEqual(4);
  });

  it('should have 8 standard shot classes', () => {
    expect(SHOT_CLASSES).toHaveLength(8);
  });

  it('should find workflow for Dialogue_Closeup', () => {
    const workflow = getWorkflowForShotClass('Dialogue_Closeup');
    expect(workflow).toBeDefined();
    expect(workflow!.shotClasses).toContain('Dialogue_Closeup');
  });

  it('should find workflow for Establishing_Wide', () => {
    const workflow = getWorkflowForShotClass('Establishing_Wide');
    expect(workflow).toBeDefined();
  });

  it('should return undefined for unknown shot class', () => {
    const workflow = getWorkflowForShotClass('NonExistent_Class');
    expect(workflow).toBeUndefined();
  });

  it('should return all comfyui workflows', () => {
    const workflows = getWorkflowsForProvider('comfyui');
    expect(workflows.length).toBe(WORKFLOW_REGISTRY.length);
  });

  it('should return empty for unknown provider', () => {
    const workflows = getWorkflowsForProvider('unknown');
    expect(workflows).toHaveLength(0);
  });

  it('should have valid metadata on all entries', () => {
    for (const w of WORKFLOW_REGISTRY) {
      expect(w.id).toBeTruthy();
      expect(w.name).toBeTruthy();
      expect(w.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(w.provider).toBe('comfyui');
      expect(Array.isArray(w.allowedOverrides)).toBe(true);
    }
  });

  it('should have qualityTiers on all entries', () => {
    for (const w of WORKFLOW_REGISTRY) {
      expect(w.qualityTiers).toBeDefined();
      expect(w.qualityTiers!.length).toBeGreaterThan(0);
    }
  });

  it('should have tierDefaults matching qualityTiers', () => {
    for (const w of WORKFLOW_REGISTRY) {
      if (w.tierDefaults) {
        for (const tier of Object.keys(w.tierDefaults)) {
          expect(w.qualityTiers).toContain(tier);
        }
      }
    }
  });

  it('should have tags on all entries', () => {
    for (const w of WORKFLOW_REGISTRY) {
      expect(w.tags).toBeDefined();
      expect(w.tags!.length).toBeGreaterThan(0);
    }
  });

  describe('getWorkflowWithDefaults', () => {
    it('should return workflow with tier defaults for known shot class', () => {
      const result = getWorkflowWithDefaults('Dialogue_Closeup', 'cinema');
      expect(result).toBeDefined();
      expect(result!.workflow.shotClasses).toContain('Dialogue_Closeup');
      expect(result!.defaults.steps).toBeGreaterThan(0);
      expect(result!.defaults.sampler).toBeTruthy();
    });

    it('should return undefined for unknown shot class', () => {
      const result = getWorkflowWithDefaults('NonExistent', 'standard');
      expect(result).toBeUndefined();
    });

    it('should fall back to highest supported tier if requested tier unavailable', () => {
      // dialogue-closeup only supports standard + cinema
      const result = getWorkflowWithDefaults('Dialogue_Closeup', 'draft');
      expect(result).toBeDefined();
      // Should fall back to the last tier in qualityTiers array
      expect(result!.defaults).toBeDefined();
    });

    it('should return draft defaults for storyboard-frame', () => {
      const result = getWorkflowWithDefaults('Montage_Quick', 'draft');
      expect(result).toBeDefined();
      expect(result!.defaults.steps).toBe(15);
      expect(result!.defaults.width).toBe(768);
    });
  });

  describe('validateWorkflowRequirements', () => {
    it('should return empty array for valid spec', () => {
      const workflow = getWorkflowForShotClass('Dialogue_Closeup')!;
      const spec: ShotSpec = {
        promptBlocks: ['a portrait'],
        camera: { lens: '85mm', framing: 'close-up', movement: 'static' },
      };
      const violations = validateWorkflowRequirements(spec, workflow);
      expect(violations).toHaveLength(0);
    });

    it('should report missing required fields', () => {
      const workflow = getWorkflowForShotClass('Dialogue_Closeup')!;
      const spec: ShotSpec = {
        promptBlocks: [],
      };
      const violations = validateWorkflowRequirements(spec, workflow);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some(v => v.field === 'promptBlocks')).toBe(true);
    });

    it('should return empty for workflow without requiredFields', () => {
      const workflow: any = { ...getWorkflowForShotClass('Dialogue_Closeup')!, requiredFields: undefined };
      const spec: ShotSpec = { promptBlocks: [] };
      const violations = validateWorkflowRequirements(spec, workflow);
      expect(violations).toHaveLength(0);
    });
  });

  describe('getWorkflowsByTags', () => {
    it('should return all workflows for empty tags', () => {
      const results = getWorkflowsByTags([]);
      expect(results.length).toBe(WORKFLOW_REGISTRY.length);
    });

    it('should filter by single tag', () => {
      const results = getWorkflowsByTags(['character']);
      expect(results.length).toBeGreaterThan(0);
      for (const w of results) {
        expect(w.tags).toContain('character');
      }
    });

    it('should filter by multiple tags (AND)', () => {
      const results = getWorkflowsByTags(['character', 'portrait']);
      expect(results.length).toBeGreaterThan(0);
      for (const w of results) {
        expect(w.tags).toContain('character');
        expect(w.tags).toContain('portrait');
      }
    });

    it('should return empty for non-matching tags', () => {
      const results = getWorkflowsByTags(['nonexistent-tag']);
      expect(results).toHaveLength(0);
    });
  });
});
