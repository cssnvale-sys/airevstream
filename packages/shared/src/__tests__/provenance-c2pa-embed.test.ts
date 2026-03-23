import { describe, it, expect } from 'vitest';
import {
  generateC2PAManifest,
  createProvenanceRecord,
} from '../provenance.js';
import {
  manifestToC2PAToolFormat,
  embedC2PAManifest,
  verifyC2PA,
  isC2PAToolAvailable,
} from '../provenance-c2pa-cli.js';
import type { C2PAExecFn } from '../provenance.js';

// ─── Fixtures ───

function createTestManifest(): C2PAManifest {
  const record = createProvenanceRecord(
    'image',
    { name: 'sd_xl_base_1.0', provider: 'comfyui' },
    { prompt: 'test prompt', seed: 42, steps: 30 },
    { storageKey: 'production/images/test.png' },
    'shot-generation',
  );

  return generateC2PAManifest('Test Content', [record]);
}

// ─── Mock ExecFn ───

function createMockExec(overrides?: {
  versionOutput?: string;
  verifyOutput?: string;
  shouldFail?: boolean;
}): C2PAExecFn {
  return async (cmd: string, args: string[]) => {
    if (overrides?.shouldFail) {
      throw new Error('c2patool not found');
    }

    if (args.includes('--version')) {
      return {
        stdout: overrides?.versionOutput ?? 'c2patool 0.9.0',
        stderr: '',
      };
    }

    if (args.includes('--detailed')) {
      return {
        stdout: overrides?.verifyOutput ?? JSON.stringify({
          claim_generator: 'AiRevStream/1.0',
          title: 'Test Content',
          assertions: [],
        }),
        stderr: '',
      };
    }

    // Embed command — check manifest file was passed
    if (args.includes('--media') && args.includes('--output')) {
      return { stdout: 'Manifest embedded successfully', stderr: '' };
    }

    return { stdout: '', stderr: '' };
  };
}

// ─── Tests ───

describe('manifestToC2PAToolFormat', () => {
  it('converts internal manifest to c2patool format', () => {
    const manifest = createTestManifest();
    const result = manifestToC2PAToolFormat(manifest);

    expect(result.claim_generator).toBe('AiRevStream/1.0');
    expect(result.title).toBe('Test Content');
    expect(Array.isArray(result.assertions)).toBe(true);
    expect(Array.isArray(result.ingredients)).toBe(true);
  });

  it('includes actions assertion', () => {
    const manifest = createTestManifest();
    const result = manifestToC2PAToolFormat(manifest);
    const assertions = result.assertions as Array<Record<string, unknown>>;

    const actionsAssertion = assertions.find(a => a.label === 'c2pa.actions');
    expect(actionsAssertion).toBeDefined();
  });

  it('includes CreativeWork assertion', () => {
    const manifest = createTestManifest();
    const result = manifestToC2PAToolFormat(manifest);
    const assertions = result.assertions as Array<Record<string, unknown>>;

    const creativeWork = assertions.find(a => a.label === 'stds.schema-org.CreativeWork');
    expect(creativeWork).toBeDefined();
    const data = creativeWork!.data as Record<string, unknown>;
    expect(data['@type']).toBe('CreativeWork');
  });

  it('preserves custom assertions from manifest', () => {
    const manifest = createTestManifest();
    const result = manifestToC2PAToolFormat(manifest);
    const assertions = result.assertions as Array<Record<string, unknown>>;

    // Manifest has c2pa.ai_generated and c2pa.quality assertions
    const aiGenerated = assertions.find(a => a.label === 'c2pa.ai_generated');
    expect(aiGenerated).toBeDefined();
  });
});

describe('isC2PAToolAvailable', () => {
  it('returns true when c2patool is installed', async () => {
    const exec = createMockExec();
    expect(await isC2PAToolAvailable(exec)).toBe(true);
  });

  it('returns false when c2patool is not installed', async () => {
    const exec = createMockExec({ shouldFail: true });
    expect(await isC2PAToolAvailable(exec)).toBe(false);
  });

  it('returns false when output does not contain c2patool', async () => {
    const exec = createMockExec({ versionOutput: 'some other tool' });
    expect(await isC2PAToolAvailable(exec)).toBe(false);
  });
});

describe('embedC2PAManifest', () => {
  it('returns success when c2patool succeeds', async () => {
    const exec = createMockExec();
    const manifest = createTestManifest();

    const result = await embedC2PAManifest(
      {
        mediaPath: '/tmp/test.mp4',
        outputPath: '/tmp/signed.mp4',
        manifest,
      },
      exec,
    );

    expect(result.success).toBe(true);
    expect(result.outputPath).toBe('/tmp/signed.mp4');
    expect(result.error).toBeUndefined();
  });

  it('returns failure when c2patool fails', async () => {
    const exec = createMockExec({ shouldFail: true });
    const manifest = createTestManifest();

    const result = await embedC2PAManifest(
      {
        mediaPath: '/tmp/test.mp4',
        outputPath: '/tmp/signed.mp4',
        manifest,
      },
      exec,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('verifyC2PA', () => {
  it('returns valid with manifest when verification passes', async () => {
    const exec = createMockExec();

    const result = await verifyC2PA('/tmp/signed.mp4', exec);
    expect(result.valid).toBe(true);
    expect(result.manifest).toBeDefined();
    expect(result.manifest!.claim_generator).toBe('AiRevStream/1.0');
  });

  it('returns invalid when verification fails', async () => {
    const exec = createMockExec({ shouldFail: true });

    const result = await verifyC2PA('/tmp/unsigned.mp4', exec);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
});
