import { describe, it, expect, vi } from 'vitest';
import { composePrompt } from '../comfyui-composer.js';
import type { ShotSpec, PromptBible } from '../types.js';

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
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const spec: ShotSpec = {
      promptBlocks: ['a {mood} scene'],
      promptSlots: { mood: 'chaotic' },
    };
    const bible: PromptBible = {
      globalStyle: '',
      slotRules: { mood: ['calm', 'dramatic', 'tense'] },
    };
    composePrompt(spec, bible);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('Slot "mood" value "chaotic" not in allowed list'),
    );
    spy.mockRestore();
  });

  it('should not warn when slot value is in allowed list', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const spec: ShotSpec = {
      promptBlocks: ['a {mood} scene'],
      promptSlots: { mood: 'dramatic' },
    };
    const bible: PromptBible = {
      globalStyle: '',
      slotRules: { mood: ['calm', 'dramatic', 'tense'] },
    };
    composePrompt(spec, bible);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
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
