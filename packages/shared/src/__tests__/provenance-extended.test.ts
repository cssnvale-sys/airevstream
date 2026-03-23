import { describe, it, expect } from 'vitest';
import {
  buildProvenanceChain,
  buildProvenanceChainWithManifest,
  checkCopyrightCompliance,
  generateC2PASidecar,
  KNOWN_LICENSES,
  createProvenanceRecord,
  generateC2PAManifest,
} from '../provenance.js';
import type { CopyrightInfo } from '../provenance.js';

const makeRecord = (stage: string, timestamp: string) => {
  const record = createProvenanceRecord(
    'image',
    { name: 'sdxl', provider: 'comfyui', version: '1.0' },
    { prompt: 'test', steps: 30 },
    { storageKey: `output-${stage}` },
    stage,
  );
  record.timestamp = timestamp;
  return record;
};

describe('buildProvenanceChain', () => {
  it('should sort records chronologically', () => {
    const r1 = makeRecord('keyframe', '2024-01-01T00:00:00Z');
    const r2 = makeRecord('upscale', '2024-01-01T00:01:00Z');

    const chain = buildProvenanceChain([r2, r1]);
    expect(chain.records[0]!.stage).toBe('keyframe');
    expect(chain.records[1]!.stage).toBe('upscale');
  });

  it('should not include manifest', () => {
    const r = makeRecord('gen', '2024-01-01T00:00:00Z');
    const chain = buildProvenanceChain([r]);
    expect(chain.manifest).toBeUndefined();
  });
});

describe('buildProvenanceChainWithManifest', () => {
  it('should include C2PA manifest', () => {
    const r = makeRecord('gen', '2024-01-01T00:00:00Z');
    const chain = buildProvenanceChainWithManifest('Test Video', [r]);
    expect(chain.manifest).toBeDefined();
    expect(chain.manifest!.title).toBe('Test Video');
    expect(chain.manifest!.version).toBe('1.0');
  });
});

describe('checkCopyrightCompliance', () => {
  it('should pass for commercial-ok licenses', () => {
    const assets: CopyrightInfo[] = [
      { type: 'model', name: 'SDXL', license: 'openrail++', attribution: 'StabilityAI' },
    ];
    const result = checkCopyrightCompliance(assets, true);
    expect(result.compliant).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('should flag non-commercial license in commercial context', () => {
    const assets: CopyrightInfo[] = [
      { type: 'lora', name: 'MyLoRA', license: 'cc-by-nc-4.0' },
    ];
    const result = checkCopyrightCompliance(assets, true);
    expect(result.compliant).toBe(false);
    expect(result.issues.some(i => i.severity === 'error')).toBe(true);
  });

  it('should allow non-commercial license in non-commercial context', () => {
    const assets: CopyrightInfo[] = [
      { type: 'lora', name: 'MyLoRA', license: 'cc-by-nc-4.0' },
    ];
    const result = checkCopyrightCompliance(assets, false);
    expect(result.compliant).toBe(true);
  });

  it('should warn on missing attribution', () => {
    const assets: CopyrightInfo[] = [
      { type: 'model', name: 'MyModel', license: 'apache-2.0' },
    ];
    const result = checkCopyrightCompliance(assets, true);
    expect(result.issues.some(i => i.severity === 'warning' && i.issue.includes('attribution'))).toBe(true);
  });

  it('should warn on unknown license', () => {
    const assets: CopyrightInfo[] = [
      { type: 'model', name: 'CustomModel', license: 'custom-proprietary' },
    ];
    const result = checkCopyrightCompliance(assets, true);
    expect(result.issues.some(i => i.issue.includes('Unknown license'))).toBe(true);
  });
});

describe('generateC2PASidecar', () => {
  it('should generate a JSON sidecar', () => {
    const manifest = generateC2PAManifest('Test', []);
    const sidecar = generateC2PASidecar(manifest);
    expect(sidecar.filename).toMatch(/^c2pa-manifest-.+\.json$/);
    const parsed = JSON.parse(sidecar.content);
    expect(parsed.version).toBe('1.0');
    expect(parsed.claimGenerator).toBe('AiRevStream/1.0');
  });
});

describe('KNOWN_LICENSES', () => {
  it('should have at least 10 licenses', () => {
    expect(Object.keys(KNOWN_LICENSES).length).toBeGreaterThanOrEqual(10);
  });

  it('should mark cc0 as commercial+no attribution', () => {
    expect(KNOWN_LICENSES['cc0-1.0']!.commercial).toBe(true);
    expect(KNOWN_LICENSES['cc0-1.0']!.attribution).toBe(false);
  });
});
