import { describe, it, expect } from 'vitest';
import {
  getAiClient,
  resetAiClient,
  generateText,
  chat,
  streamText,
  generateJSON,
  listModels,
  ServiceRegistry,
  OllamaProvider,
  OpenAICompatProvider,
  HttpProvider,
} from '../index.js';

describe('@airevstream/ai-client legacy API', () => {
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

  it('creates an Ollama client', async () => {
    resetAiClient();
    const client = await getAiClient('http://localhost:11434');
    expect(client).toBeDefined();
    resetAiClient();
  });
});

describe('ServiceRegistry', () => {
  it('exports ServiceRegistry class', () => {
    expect(ServiceRegistry).toBeDefined();
    expect(typeof ServiceRegistry).toBe('function');
  });

  it('can be instantiated with a service fetcher', () => {
    const registry = new ServiceRegistry({
      fetchServices: async () => [],
    });
    expect(registry).toBeDefined();
  });

  it('throws when no services available', async () => {
    const registry = new ServiceRegistry({
      fetchServices: async () => [],
    });
    await expect(
      registry.generate({
        type: 'text',
        task: 'test',
        prompt: 'hello',
      }),
    ).rejects.toThrow('No available AI services');
  });

  it('exposes getOllamaProvider', () => {
    const registry = new ServiceRegistry({
      fetchServices: async () => [],
    });
    const provider = registry.getOllamaProvider();
    expect(provider).toBeInstanceOf(OllamaProvider);
  });
});

describe('Providers', () => {
  it('exports OllamaProvider class', () => {
    expect(OllamaProvider).toBeDefined();
    const p = new OllamaProvider();
    expect(p.name).toBe('ollama');
    expect(p.providerType).toBe('ollama');
  });

  it('exports OpenAICompatProvider class', () => {
    expect(OpenAICompatProvider).toBeDefined();
    const p = new OpenAICompatProvider('test', 'openai');
    expect(p.name).toBe('test');
  });

  it('exports HttpProvider class', () => {
    expect(HttpProvider).toBeDefined();
    const p = new HttpProvider('comfyui', 'comfyui', ['image']);
    expect(p.name).toBe('comfyui');
    expect(p.supportedTypes).toContain('image');
  });
});
