import { describe, it, expect } from 'vitest';
import {
  composePrompt,
  buildBaseWorkflow,
  addLoraNodes,
  addControlNetNodes,
  addUpscaleNodes,
  composeWorkflow,
  getPresetDefaults,
} from '../comfyui-composer.js';
import type { ShotSpec, PromptBible, LoraSpec, ControlNetSpec, UpscaleSpec } from '../types.js';

describe('ComfyUI Composer', () => {
  describe('composePrompt', () => {
    it('should compose positive prompt from shot spec blocks', () => {
      const spec: ShotSpec = { promptBlocks: ['a beautiful landscape', 'sunset'] };
      const result = composePrompt(spec);
      expect(result.positive).toContain('a beautiful landscape');
      expect(result.positive).toContain('sunset');
    });

    it('should include bible quality tokens', () => {
      const spec: ShotSpec = { promptBlocks: ['landscape'] };
      const bible: PromptBible = { qualityTokens: 'masterpiece, best quality' };
      const result = composePrompt(spec, bible);
      expect(result.positive).toContain('masterpiece');
    });

    it('should include default negative prompt when no bible', () => {
      const spec: ShotSpec = { promptBlocks: ['test'] };
      const result = composePrompt(spec);
      expect(result.negative).toContain('worst quality');
    });

    it('should use bible negative block', () => {
      const spec: ShotSpec = { promptBlocks: ['test'] };
      const bible: PromptBible = { negativeBlock: 'no watermarks' };
      const result = composePrompt(spec, bible);
      expect(result.negative).toContain('no watermarks');
    });

    it('should include camera framing and lens in prompt', () => {
      const spec: ShotSpec = {
        promptBlocks: ['portrait'],
        camera: { lens: '85mm', framing: 'close-up' },
      };
      const result = composePrompt(spec);
      expect(result.positive).toContain('close-up');
      expect(result.positive).toContain('85mm lens');
    });

    it('should include LoRA trigger words', () => {
      const spec: ShotSpec = {
        promptBlocks: ['scene'],
        generation: { loras: [{ name: 'test.safetensors', strength: 0.7, triggerWords: ['cinematic lighting'] }] },
      };
      const result = composePrompt(spec);
      expect(result.positive).toContain('cinematic lighting');
    });
  });

  describe('buildBaseWorkflow', () => {
    it('should create a 7-node base workflow', () => {
      const spec: ShotSpec = { promptBlocks: ['test'] };
      const { workflow, ctx } = buildBaseWorkflow(spec);
      expect(Object.keys(workflow)).toHaveLength(7);
      expect(workflow['1'].class_type).toBe('CheckpointLoaderSimple');
      expect(workflow['5'].class_type).toBe('KSampler');
      expect(workflow['7'].class_type).toBe('SaveImage');
      expect(ctx.resolvedSeed).toBeDefined();
    });

    it('should use spec generation parameters', () => {
      const spec: ShotSpec = {
        promptBlocks: ['test'],
        generation: { steps: 40, cfg: 10, sampler: 'euler_ancestral', width: 768, height: 512 },
      };
      const { workflow } = buildBaseWorkflow(spec);
      expect(workflow['5'].inputs.steps).toBe(40);
      expect(workflow['5'].inputs.cfg).toBe(10);
      expect(workflow['4'].inputs.width).toBe(768);
      expect(workflow['4'].inputs.height).toBe(512);
    });

    it('should use default model when not specified', () => {
      const spec: ShotSpec = { promptBlocks: ['test'] };
      const { workflow } = buildBaseWorkflow(spec);
      expect(workflow['1'].inputs.ckpt_name).toBe('sd_xl_base_1.0.safetensors');
    });
  });

  describe('addLoraNodes', () => {
    it('should add LoRA loader nodes and rewire model connections', () => {
      const spec: ShotSpec = { promptBlocks: ['test'] };
      const { workflow, ctx } = buildBaseWorkflow(spec);
      const loras: LoraSpec[] = [
        { name: 'lora1.safetensors', strength: 0.7 },
        { name: 'lora2.safetensors', strength: 0.5, clipStrength: 0.3 },
      ];
      const newCtx = addLoraNodes(workflow, ctx, loras);
      // Should have added 2 LoRA nodes
      expect(Object.keys(workflow).length).toBeGreaterThan(7);
      // Sampler should be rewired to last LoRA
      expect(newCtx.modelNodeId).not.toBe('1');
    });
  });

  describe('addControlNetNodes', () => {
    it('should add ControlNet loader and apply nodes', () => {
      const spec: ShotSpec = { promptBlocks: ['test'] };
      const { workflow, ctx } = buildBaseWorkflow(spec);
      const controlNets: ControlNetSpec[] = [
        { type: 'depth', model: 'depth_model.safetensors', strength: 0.8 },
      ];
      const newCtx = addControlNetNodes(workflow, ctx, controlNets);
      expect(Object.keys(workflow).length).toBeGreaterThan(7);
      // Verify ControlNet nodes were created
      const nodeTypes = Object.values(workflow).map(n => n.class_type);
      expect(nodeTypes).toContain('ControlNetLoader');
      expect(nodeTypes).toContain('ControlNetApplyAdvanced');
    });
  });

  describe('composeWorkflow', () => {
    it('should compose a complete workflow from spec', () => {
      const spec: ShotSpec = {
        promptBlocks: ['cinematic landscape'],
        model: 'my_model.safetensors',
        seed: 42,
        generation: { steps: 30, cfg: 7 },
      };
      const workflow = composeWorkflow(spec);
      expect(workflow['1'].inputs.ckpt_name).toBe('my_model.safetensors');
      expect(workflow['5'].inputs.seed).toBe(42);
      expect(workflow.resolvedSeed).toBe(42);
    });

    it('should add LoRAs when specified', () => {
      const spec: ShotSpec = {
        promptBlocks: ['test'],
        generation: { loras: [{ name: 'style.safetensors', strength: 0.6 }] },
      };
      const workflow = composeWorkflow(spec);
      const nodeTypes = Object.values(workflow).map(n => (n as any).class_type).filter(Boolean);
      expect(nodeTypes).toContain('LoraLoader');
    });

    it('should add upscale when specified', () => {
      const spec: ShotSpec = {
        promptBlocks: ['test'],
        generation: { upscale: { model: '4x-UltraSharp' } },
      };
      const workflow = composeWorkflow(spec);
      const nodeTypes = Object.values(workflow).map(n => (n as any).class_type).filter(Boolean);
      expect(nodeTypes).toContain('UpscaleModelLoader');
    });
  });

  describe('getPresetDefaults', () => {
    it('should return defaults for storyboard-frame', () => {
      const defaults = getPresetDefaults('storyboard-frame');
      expect(defaults.aspect).toBe('16:9');
      expect(defaults.generation?.width).toBe(1024);
    });

    it('should return defaults for avatar-generation', () => {
      const defaults = getPresetDefaults('avatar-generation');
      expect(defaults.aspect).toBe('1:1');
      expect(defaults.generation?.width).toBe(512);
    });
  });
});
