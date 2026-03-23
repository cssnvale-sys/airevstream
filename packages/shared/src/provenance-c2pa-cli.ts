/**
 * C2PA CLI Embedding (c2patool)
 *
 * Runtime functions for embedding Content Credentials into media files
 * using the c2patool CLI. Separated from provenance.ts because these
 * functions use Node.js modules that can't be bundled by webpack.
 *
 * Import directly: `import { embedC2PAManifest } from '@airevstream/shared/dist/provenance-c2pa-cli.js'`
 * Or from barrel for types only.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { C2PAManifest, C2PAExecFn, C2PAEmbedOptions, C2PAEmbedResult, C2PAVerifyResult } from './provenance.js';

// Re-export types for convenience
export type { C2PAExecFn, C2PAEmbedOptions, C2PAEmbedResult, C2PAVerifyResult };

const execFileAsync = promisify(execFile);

const defaultExecFn: C2PAExecFn = (cmd: string, args: string[]) =>
  execFileAsync(cmd, args, { timeout: 120_000 });

/**
 * Check if c2patool is available on the system.
 */
export async function isC2PAToolAvailable(execFn?: C2PAExecFn): Promise<boolean> {
  const exec = execFn ?? defaultExecFn;
  try {
    const { stdout } = await exec('c2patool', ['--version']);
    return stdout.includes('c2patool');
  } catch {
    return false;
  }
}

/**
 * Convert an internal C2PAManifest to c2patool's expected JSON format.
 *
 * c2patool expects:
 * - claim_generator, title
 * - assertions[] with labels and data
 * - ingredients[] with title, format, relationship
 */
export function manifestToC2PAToolFormat(manifest: C2PAManifest): Record<string, unknown> {
  const assertions: Array<Record<string, unknown>> = [];

  // Add actions assertion
  if (manifest.actions.length > 0) {
    assertions.push({
      label: 'c2pa.actions',
      data: {
        actions: manifest.actions.map(a => ({
          action: a.action,
          softwareAgent: a.softwareAgent,
          when: a.when,
          ...(a.parameters ? { parameters: a.parameters } : {}),
        })),
      },
    });
  }

  // Add creative work assertion
  assertions.push({
    label: 'stds.schema-org.CreativeWork',
    data: {
      '@type': 'CreativeWork',
      '@context': 'https://schema.org',
      name: manifest.title,
      dateCreated: manifest.created,
      encodingFormat: 'application/octet-stream',
    },
  });

  // Add custom assertions from manifest
  for (const assertion of manifest.assertions) {
    assertions.push({
      label: assertion.label,
      data: assertion.data,
    });
  }

  // Build ingredients
  const ingredients = manifest.ingredients.map(i => ({
    title: i.title,
    format: i.format,
    relationship: i.relationship,
    ...(i.hash ? { hash: i.hash } : {}),
  }));

  return {
    claim_generator: manifest.claimGenerator,
    title: manifest.title,
    assertions,
    ingredients,
  };
}

/**
 * Embed a C2PA manifest directly into a media file using c2patool CLI.
 */
export async function embedC2PAManifest(
  options: C2PAEmbedOptions,
  execFn?: C2PAExecFn,
): Promise<C2PAEmbedResult> {
  const exec = execFn ?? defaultExecFn;
  const manifestPath = join(tmpdir(), `c2pa-manifest-${randomUUID()}.json`);
  const toolFormat = manifestToC2PAToolFormat(options.manifest);

  try {
    await writeFile(manifestPath, JSON.stringify(toolFormat, null, 2), 'utf-8');

    const args = [
      manifestPath,
      '--media', options.mediaPath,
      '--output', options.outputPath,
    ];

    if (options.certPath) args.push('--cert', options.certPath);
    if (options.keyPath) args.push('--key', options.keyPath);

    await exec('c2patool', args);

    return { success: true, outputPath: options.outputPath };
  } catch (err) {
    return {
      success: false,
      outputPath: options.outputPath,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    await unlink(manifestPath).catch(() => {});
  }
}

/**
 * Verify C2PA content credentials embedded in a media file.
 */
export async function verifyC2PA(
  mediaPath: string,
  execFn?: C2PAExecFn,
): Promise<C2PAVerifyResult> {
  const exec = execFn ?? defaultExecFn;

  try {
    const { stdout } = await exec('c2patool', [mediaPath, '--detailed']);
    const manifest = JSON.parse(stdout) as Record<string, unknown>;
    return { valid: true, manifest };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
