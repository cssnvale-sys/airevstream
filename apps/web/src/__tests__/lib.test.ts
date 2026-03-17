import { describe, it, expect } from 'vitest';

describe('lib/auth', () => {
  it('auth module exports are defined', async () => {
    const mod = await import('../lib/auth');
    expect(typeof mod.getToken).toBe('function');
    expect(typeof mod.setToken).toBe('function');
    expect(typeof mod.removeToken).toBe('function');
    expect(typeof mod.isAuthenticated).toBe('function');
  });
});

describe('lib/api', () => {
  it('api module exports are defined', async () => {
    const mod = await import('../lib/api');
    expect(mod.auth).toBeDefined();
    expect(mod.content).toBeDefined();
    expect(mod.accounts).toBeDefined();
    expect(mod.workflows).toBeDefined();
    expect(mod.chat).toBeDefined();
    expect(mod.generate).toBeDefined();
  });
});
