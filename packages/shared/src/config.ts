import { z } from 'zod';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from monorepo root (find project root relative to this file)
const rootDir = path.resolve(__dirname, '../../..');
dotenv.config({ path: path.resolve(rootDir, '.env') });

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url().default('postgresql://airevstream:airevstream_dev@localhost:5432/airevstream'),

  // Redis
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  // MinIO
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_ACCESS_KEY: z.string().default('airevstream'),
  MINIO_SECRET_KEY: z.string().default('airevstream_dev_secret_key_change_me'),

  // Encryption
  ENCRYPTION_KEY: z.string().min(1).optional(),

  // JWT
  JWT_SECRET: z.string().min(1).optional(),
  JWT_REFRESH_SECRET: z.string().min(1).optional(),

  // Ollama
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),

  // ComfyUI
  COMFYUI_URL: z.string().url().default('http://localhost:8188'),

  // CORS
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // App
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // OAuth — Google / YouTube
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),

  // OAuth — TikTok
  TIKTOK_CLIENT_KEY: z.string().min(1).optional(),
  TIKTOK_CLIENT_SECRET: z.string().min(1).optional(),

  // Frontend URL for OAuth redirects
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
});

export type EnvConfig = z.infer<typeof envSchema>;

let _config: EnvConfig | null = null;

export function getConfig(): EnvConfig {
  if (!_config) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      const formatted = result.error.format();
      console.error('Invalid environment variables:', JSON.stringify(formatted, null, 2));
      throw new Error('Invalid environment configuration');
    }
    _config = result.data;

    // Fail fast in production if ENCRYPTION_KEY is missing
    if (_config.NODE_ENV === 'production' && !_config.ENCRYPTION_KEY) {
      throw new Error('ENCRYPTION_KEY is required in production');
    }
  }
  return _config;
}

export function resetConfig(): void {
  _config = null;
}

/**
 * Assert that runtime-required secrets are present at service startup.
 *
 * Called by every service/app entrypoint (apps/web middleware, services/*,
 * workers) to fail loudly and immediately if the operator forgot to fill
 * in their `.env`. This avoids cryptic downstream errors from `jose`,
 * `jsonwebtoken`, or `crypto.createCipheriv` when secrets are missing.
 *
 * In `NODE_ENV=test`, validation is skipped — tests stub these values
 * per-case via `process.env.JWT_SECRET = 'test-secret'`.
 *
 * @throws if any required secret is missing, empty, or obviously too short.
 */
export function assertRequiredSecrets(context = 'service'): void {
  // Tests manage their own env — don't interfere.
  if (process.env.NODE_ENV === 'test') return;

  type Check = { name: string; value: string | undefined; minLen: number; hint: string };
  const checks: Check[] = [
    {
      name: 'JWT_SECRET',
      value: process.env.JWT_SECRET,
      minLen: 32,
      hint: 'generate with: openssl rand -hex 64',
    },
    {
      name: 'JWT_REFRESH_SECRET',
      value: process.env.JWT_REFRESH_SECRET,
      minLen: 32,
      hint: 'generate with: openssl rand -hex 64',
    },
    {
      name: 'ENCRYPTION_KEY',
      value: process.env.ENCRYPTION_KEY,
      minLen: 32,
      hint: 'generate with: openssl rand -hex 32 (must be a 64-char hex string = 32 bytes)',
    },
  ];

  const problems: string[] = [];
  for (const c of checks) {
    if (!c.value || c.value.trim().length === 0) {
      problems.push(`  - ${c.name} is missing (${c.hint})`);
    } else if (c.value.trim().length < c.minLen) {
      problems.push(`  - ${c.name} is too short (got ${c.value.length} chars, need ≥ ${c.minLen}; ${c.hint})`);
    }
  }

  if (problems.length > 0) {
    const banner = '═'.repeat(72);
    const message =
      `\n${banner}\n` +
      `AiRevStream cannot start (${context}): required secrets are missing.\n\n` +
      problems.join('\n') +
      `\n\nFix: edit .env at the monorepo root, fill in the values above, then restart.\n` +
      `     Run \`make doctor\` to verify your environment.\n` +
      `${banner}\n`;
    // eslint-disable-next-line no-console
    console.error(message);
    throw new Error(`Missing required secrets: ${problems.map((p) => p.trim().split(' ')[1]).join(', ')}`);
  }
}
