import { describe, it, expect } from 'vitest';
import { slugify, parsePagination, paginate, truncate, pick, omit, retry } from '../utils.js';

describe('slugify', () => {
  it('converts text to URL-safe slug', () => {
    expect(slugify('Hello World')).toBe('hello-world');
    expect(slugify('  Multiple   Spaces  ')).toBe('multiple-spaces');
    expect(slugify('Special @#$ Characters!')).toBe('special-characters');
    expect(slugify('already-slugged')).toBe('already-slugged');
  });
});

describe('parsePagination', () => {
  it('returns defaults when no params provided', () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: 50 });
  });

  it('clamps page to minimum of 1', () => {
    expect(parsePagination({ page: -1 })).toEqual({ page: 1, limit: 50 });
    expect(parsePagination({ page: 0 })).toEqual({ page: 1, limit: 50 });
  });

  it('clamps limit to max of 100', () => {
    expect(parsePagination({ limit: 200 })).toEqual({ page: 1, limit: 100 });
  });
});

describe('paginate', () => {
  it('creates paginated result', () => {
    const items = [1, 2, 3];
    const result = paginate(items, 10, { page: 1, limit: 3 });
    expect(result).toEqual({
      data: [1, 2, 3],
      meta: { total: 10, page: 1, limit: 3, pages: 4 },
    });
  });
});

describe('truncate', () => {
  it('truncates long strings with ellipsis', () => {
    expect(truncate('Hello World', 8)).toBe('Hello...');
    expect(truncate('Short', 10)).toBe('Short');
  });
});

describe('pick', () => {
  it('picks specified keys from object', () => {
    const obj = { a: 1, b: 2, c: 3 };
    expect(pick(obj, ['a', 'c'])).toEqual({ a: 1, c: 3 });
  });
});

describe('omit', () => {
  it('omits specified keys from object', () => {
    const obj = { a: 1, b: 2, c: 3 };
    expect(omit(obj, ['b'])).toEqual({ a: 1, c: 3 });
  });
});

describe('retry', () => {
  it('returns result on first success', async () => {
    const result = await retry(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it('retries on failure and eventually succeeds', async () => {
    let attempts = 0;
    const result = await retry(
      () => {
        attempts++;
        if (attempts < 3) throw new Error('fail');
        return Promise.resolve('success');
      },
      { baseDelay: 10 },
    );
    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('throws after max retries', async () => {
    await expect(
      retry(() => Promise.reject(new Error('always fails')), { maxRetries: 2, baseDelay: 10 }),
    ).rejects.toThrow('always fails');
  });
});
