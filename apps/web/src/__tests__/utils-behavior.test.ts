import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cn, formatNumber, formatCurrency, formatRelativeTime, statusColor, platformIcon } from '../lib/utils';

describe('cn (class merge)', () => {
  it('merges multiple class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles undefined/null/false inputs', () => {
    expect(cn('foo', undefined, null, false, 'bar')).toBe('foo bar');
  });

  it('deduplicates conflicting Tailwind classes', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('handles conditional classes', () => {
    const isActive = true;
    expect(cn('base', isActive && 'active')).toBe('base active');
    expect(cn('base', !isActive && 'active')).toBe('base');
  });

  it('returns empty string for no args', () => {
    expect(cn()).toBe('');
  });
});

describe('formatNumber', () => {
  it('formats small numbers as-is', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(999)).toBe('999');
  });

  it('formats thousands with K suffix', () => {
    expect(formatNumber(1_000)).toBe('1.0K');
    expect(formatNumber(1_500)).toBe('1.5K');
    expect(formatNumber(9_999)).toBe('10.0K');
  });

  it('formats 10K+ without decimal', () => {
    expect(formatNumber(10_000)).toBe('10K');
    expect(formatNumber(15_000)).toBe('15K');
    expect(formatNumber(999_999)).toBe('1000K');
  });

  it('formats millions with M suffix', () => {
    expect(formatNumber(1_000_000)).toBe('1.0M');
    expect(formatNumber(2_500_000)).toBe('2.5M');
  });
});

describe('formatCurrency', () => {
  it('formats whole dollars', () => {
    expect(formatCurrency(100)).toBe('$100.00');
  });

  it('formats with cents', () => {
    expect(formatCurrency(12.5)).toBe('$12.50');
    expect(formatCurrency(99.99)).toBe('$99.99');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('formats large numbers with commas', () => {
    expect(formatCurrency(1000000)).toBe('$1,000,000.00');
  });

  it('formats negative numbers', () => {
    expect(formatCurrency(-50)).toBe('-$50.00');
  });
});

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-18T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for times less than 1 minute ago', () => {
    const date = new Date('2026-03-18T11:59:30Z');
    expect(formatRelativeTime(date)).toBe('just now');
  });

  it('returns minutes for times less than 1 hour ago', () => {
    const date = new Date('2026-03-18T11:15:00Z');
    expect(formatRelativeTime(date)).toBe('45m ago');
  });

  it('returns hours for times less than 1 day ago', () => {
    const date = new Date('2026-03-18T09:00:00Z');
    expect(formatRelativeTime(date)).toBe('3h ago');
  });

  it('returns days for times less than 30 days ago', () => {
    const date = new Date('2026-03-11T12:00:00Z');
    expect(formatRelativeTime(date)).toBe('7d ago');
  });

  it('returns full date for times over 30 days ago', () => {
    const date = new Date('2026-01-01T12:00:00Z');
    const result = formatRelativeTime(date);
    // Should be a formatted date string, not relative
    expect(result).not.toContain('ago');
    expect(result).not.toBe('just now');
  });

  it('accepts string date input', () => {
    const result = formatRelativeTime('2026-03-18T11:59:00Z');
    expect(result).toBe('1m ago');
  });
});

describe('statusColor', () => {
  it('maps all active statuses', () => {
    for (const s of ['active', 'healthy', 'posted', 'approved', 'completed']) {
      expect(statusColor(s)).toBe('badge-active');
    }
  });

  it('maps all pending statuses', () => {
    for (const s of ['warming', 'pending', 'pending_approval', 'queued', 'scheduled']) {
      expect(statusColor(s)).toBe('badge-pending');
    }
  });

  it('maps all working statuses', () => {
    for (const s of ['generating', 'rendering', 'running', 'in_progress', 'posting']) {
      expect(statusColor(s)).toBe('badge-working');
    }
  });

  it('maps all error statuses', () => {
    for (const s of ['failed', 'error', 'flagged', 'disabled', 'banned']) {
      expect(statusColor(s)).toBe('badge-error');
    }
  });

  it('maps human statuses', () => {
    expect(statusColor('needs_human')).toBe('badge-human');
    expect(statusColor('human')).toBe('badge-human');
  });

  it('returns idle for unknown status', () => {
    expect(statusColor('archived')).toBe('badge-idle');
    expect(statusColor('unknown')).toBe('badge-idle');
  });
});

describe('platformIcon', () => {
  it('returns correct icons for all platforms', () => {
    expect(platformIcon('youtube')).toBe('🎬');
    expect(platformIcon('tiktok')).toBe('📱');
    expect(platformIcon('instagram')).toBe('📷');
    expect(platformIcon('facebook')).toBe('📘');
  });

  it('returns generic icon for unknown platform', () => {
    expect(platformIcon('twitter')).toBe('🌐');
    expect(platformIcon('')).toBe('🌐');
  });
});
