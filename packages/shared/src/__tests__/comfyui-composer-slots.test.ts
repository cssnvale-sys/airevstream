import { describe, it, expect, vi } from 'vitest';
import type { ShotSpec, PromptBible } from '../types.js';

// Mock pino logger to capture warn calls (hoisted before imports)
const { mockWarn } = vi.hoisted(() => {
  const mockWarn = vi.fn();
  return { mockWarn };
});
vi.mock('../logger.js', () => ({
  createLogger: () => ({ warn: mockWarn, info: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { composePrompt } from '../comfyui-composer.js';

describe('composePrompt — slot substitution', () => {
  it('should substitute {slotName} from promptSlots', () => {
    const spec: ShotSpec = {
      promptBlocks: ['a {mood} scene in a {location}'],
      promptSlots: { mood: 'dramatic', location: 'forest' },
    };
    const { positive } = composePrompt(spec);
    expect(positive).toContain('a dramatic scene in a forest');
    expect(positive).not.toContain('{mood}');
    expect(positive).not.toContain('{location}');
  });

  it('should substitute {char:key} from bible perCharacterBlocks', () => {
    const spec: ShotSpec = {
      promptBlocks: ['the hero {char:hero} stands tall'],
    };
    const bible: PromptBible = {
      globalStyle: '',
      perCharacterBlocks: { hero: ['tall man', 'brown hair', 'blue eyes'] },
    };
    const { positive } = composePrompt(spec, bible);
    expect(positive).toContain('tall man, brown hair, blue eyes');
    expect(positive).not.toContain('{char:hero}');
  });

  it('should substitute {env:key} from bible perEnvironmentBlocks', () => {
    const spec: ShotSpec = {
      promptBlocks: ['setting: {env:castle}'],
    };
    const bible: PromptBible = {
      globalStyle: '',
      perEnvironmentBlocks: { castle: ['stone walls', 'medieval', 'torchlit'] },
    };
    const { positive } = composePrompt(spec, bible);
    expect(positive).toContain('stone walls, medieval, torchlit');
  });

  it('should warn on slot values outside slotRules', () => {
    mockWarn.mockClear();
    const spec: ShotSpec = {
      promptBlocks: ['a {mood} scene'],
      promptSlots: { mood: 'chaotic' },
    };
    const bible: PromptBible = {
      globalStyle: '',
      slotRules: { mood: ['calm', 'dramatic', 'tense'] },
    };
    composePrompt(spec, bible);
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({ slot: 'mood', value: 'chaotic' }),
      expect.stringContaining('Slot value not in allowed list'),
    );
  });

  it('should not warn when slot value is in allowed list', () => {
    mockWarn.mockClear();
    const spec: ShotSpec = {
      promptBlocks: ['a {mood} scene'],
      promptSlots: { mood: 'dramatic' },
    };
    const bible: PromptBible = {
      globalStyle: '',
      slotRules: { mood: ['calm', 'dramatic', 'tense'] },
    };
    composePrompt(spec, bible);
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('should leave un-substituted slots as-is if no matching key', () => {
    const spec: ShotSpec = {
      promptBlocks: ['a {unknown} thing'],
      promptSlots: { mood: 'happy' },
    };
    const { positive } = composePrompt(spec);
    expect(positive).toContain('{unknown}');
  });
});
