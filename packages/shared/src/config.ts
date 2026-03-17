import { z } from 'zod';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from monorepo root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

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
  COMFYUI_BASE_URL: z.string().url().default('http://localhost:8188'),

  // App
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
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
  }
  return _config;
}

export function resetConfig(): void {
  _config = null;
}
