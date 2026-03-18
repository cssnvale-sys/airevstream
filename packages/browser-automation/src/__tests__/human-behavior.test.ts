import { describe, it, expect } from 'vitest';
import { HumanBehavior } from '../human-behavior.js';

describe('HumanBehavior', () => {
  it('should create an instance with default config', () => {
    const hb = new HumanBehavior();
    expect(hb).toBeInstanceOf(HumanBehavior);
  });

  it('should create an instance with custom config', () => {
    const hb = new HumanBehavior({
      minDelay: 100,
      maxDelay: 500,
      mouseJitter: false,
      scrollBehavior: 'smooth',
      typingSpeed: { wpm: 80, errorRate: 0.02 },
    });
    expect(hb).toBeInstanceOf(HumanBehavior);
  });

  it('delay should resolve within a reasonable time', async () => {
    const hb = new HumanBehavior({ minDelay: 10, maxDelay: 50 });
    const start = Date.now();
    await hb.delay(10, 50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(5);
    expect(elapsed).toBeLessThan(200);
  });
});
