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

describe('lib/utils', () => {
  it('utils module exports are defined', async () => {
    const mod = await import('../lib/utils');
    expect(typeof mod.cn).toBe('function');
    expect(typeof mod.formatNumber).toBe('function');
    expect(typeof mod.formatCurrency).toBe('function');
    expect(typeof mod.formatRelativeTime).toBe('function');
    expect(typeof mod.statusColor).toBe('function');
    expect(typeof mod.platformIcon).toBe('function');
  });

  it('formatNumber formats correctly', async () => {
    const { formatNumber } = await import('../lib/utils');
    expect(formatNumber(500)).toBe('500');
    expect(formatNumber(1_500)).toBe('1.5K');
    expect(formatNumber(15_000)).toBe('15K');
    expect(formatNumber(1_500_000)).toBe('1.5M');
  });

  it('statusColor returns correct badge class', async () => {
    const { statusColor } = await import('../lib/utils');
    expect(statusColor('active')).toBe('badge-active');
    expect(statusColor('pending')).toBe('badge-pending');
    expect(statusColor('generating')).toBe('badge-working');
    expect(statusColor('failed')).toBe('badge-error');
    expect(statusColor('needs_human')).toBe('badge-human');
    expect(statusColor('archived')).toBe('badge-idle');
  });

  it('platformIcon returns correct emoji', async () => {
    const { platformIcon } = await import('../lib/utils');
    expect(platformIcon('youtube')).toBe('🎬');
    expect(platformIcon('tiktok')).toBe('📱');
    expect(platformIcon('instagram')).toBe('📷');
    expect(platformIcon('facebook')).toBe('📘');
  });
});
