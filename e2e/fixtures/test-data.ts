/**
 * Seed data constants — IDs and credentials matching packages/db/prisma/seed.ts
 */

export const ADMIN = {
  email: 'admin@airevstream.local',
  password: 'changeme123',
  name: 'Admin',
  role: 'admin',
} as const;

export const TENANT = {
  slug: 'default',
  name: 'Default Workspace',
  plan: 'enterprise',
} as const;

export const CHANNEL = {
  id: '00000000-0000-0000-0000-000000000020',
  name: 'TechVerse',
  platform: 'youtube',
} as const;

export const CONTENT = {
  pendingApproval: {
    id: '00000000-0000-0000-0000-000000000040',
    title: 'AI in 2026: What Changed Everything',
    status: 'pending_approval',
  },
  approved: {
    id: '00000000-0000-0000-0000-000000000041',
    title: '5 Gadgets That Will Blow Your Mind',
    status: 'approved',
  },
  posted: {
    id: '00000000-0000-0000-0000-000000000042',
    title: 'Best Budget Laptop 2026',
    status: 'posted',
  },
  generating: {
    id: '00000000-0000-0000-0000-000000000043',
    title: 'Coding with AI Assistants',
    status: 'generating',
  },
  draft: {
    id: '00000000-0000-0000-0000-000000000044',
    title: 'Why Privacy Matters in the AI Age',
    status: 'draft',
  },
} as const;

export const AFFILIATE = {
  product: {
    id: '00000000-0000-0000-0000-000000000050',
    name: 'NordVPN Annual Plan',
    commissionRate: 40,
    category: 'VPN',
  },
} as const;

export const AI_SERVICES = {
  ollama: { id: '00000000-0000-0000-0000-000000000001', name: 'ollama-qwen3' },
  comfyui: { id: '00000000-0000-0000-0000-000000000002', name: 'comfyui-local' },
  openai: { id: '00000000-0000-0000-0000-000000000003', name: 'openai-gpt4o-mini' },
} as const;

export const EMAIL_ACCOUNT = {
  email: 'demo@airevstream.example',
} as const;

export const SOCIAL_ACCOUNT = {
  id: '00000000-0000-0000-0000-000000000010',
  platform: 'youtube',
  username: 'DemoChannel',
} as const;

/** Prefix for test-created data so cleanup can target it */
export const E2E_PREFIX = '[E2E]';
export const E2E_EMAIL_DOMAIN = 'e2e-test.local';

/** Generate a unique email for test user creation */
export function testEmail(label = 'user'): string {
  return `e2e-${label}-${Date.now()}@${E2E_EMAIL_DOMAIN}`;
}
