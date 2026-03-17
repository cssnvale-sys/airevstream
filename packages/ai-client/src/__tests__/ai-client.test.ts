import { describe, it, expect } from 'vitest';
import { getAiClient, resetAiClient, generateText, chat, streamText, generateJSON, listModels } from '../index.js';

describe('@airevstream/ai-client', () => {
  it('exports getAiClient function', () => {
    expect(typeof getAiClient).toBe('function');
  });

  it('exports generateText function', () => {
    expect(typeof generateText).toBe('function');
  });

  it('exports chat function', () => {
    expect(typeof chat).toBe('function');
  });

  it('exports streamText function', () => {
    expect(typeof streamText).toBe('function');
  });

  it('exports generateJSON function', () => {
    expect(typeof generateJSON).toBe('function');
  });

  it('exports listModels function', () => {
    expect(typeof listModels).toBe('function');
  });

  it('creates an Ollama client', () => {
    resetAiClient();
    const client = getAiClient('http://localhost:11434');
    expect(client).toBeDefined();
    resetAiClient();
  });

  it('returns the same client on multiple calls', () => {
    resetAiClient();
    const c1 = getAiClient('http://localhost:11434');
    const c2 = getAiClient();
    expect(c1).toBe(c2);
    resetAiClient();
  });
});
