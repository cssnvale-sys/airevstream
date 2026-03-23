import { describe, it, expect } from 'vitest';
import {
  WORKFLOW_REGISTRY,
  SHOT_CLASSES,
  getWorkflowForShotClass,
  getWorkflowsForProvider,
} from '../workflow-registry.js';

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
});
