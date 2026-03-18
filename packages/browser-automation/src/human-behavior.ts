import type { Page } from 'playwright';
import { createLogger } from '@airevstream/shared';
import type { HumanBehaviorConfig } from './types.js';

const logger = createLogger('human-behavior');

/**
 * Default human behavior configuration with moderate, realistic settings.
 */
const DEFAULT_CONFIG: HumanBehaviorConfig = {
  minDelay: 300,
  maxDelay: 1500,
  mouseJitter: true,
  scrollBehavior: 'human',
  typingSpeed: { wpm: 65, errorRate: 0.04 },
};

/**
 * Generate a random number from a Gaussian (normal) distribution
 * using the Box-Muller transform, clamped to [min, max].
 */
function gaussianRandom(mean: number, stddev: number, min: number, max: number): number {
  let u1 = Math.random();
  let u2 = Math.random();

  // Avoid log(0)
  while (u1 === 0) u1 = Math.random();

  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  const value = mean + z * stddev;

  return Math.max(min, Math.min(max, value));
}

/**
 * Generate a random integer in the range [min, max] inclusive.
 */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Compute a point on a cubic Bezier curve at parameter t in [0, 1].
 */
function bezierPoint(
  t: number,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
): { x: number; y: number } {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
}

/**
 * Generate waypoints along a cubic Bezier curve between two points,
 * with randomized control points to mimic human mouse movement.
 */
function generateBezierPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  steps: number,
): Array<{ x: number; y: number }> {
  const dx = endX - startX;
  const dy = endY - startY;

  // Randomize control points to create a natural curve
  const cp1 = {
    x: startX + dx * (0.2 + Math.random() * 0.3),
    y: startY + dy * (0.1 + Math.random() * 0.4) + (Math.random() - 0.5) * 60,
  };

  const cp2 = {
    x: startX + dx * (0.5 + Math.random() * 0.3),
    y: startY + dy * (0.6 + Math.random() * 0.3) + (Math.random() - 0.5) * 60,
  };

  const p0 = { x: startX, y: startY };
  const p3 = { x: endX, y: endY };

  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push(bezierPoint(t, p0, cp1, cp2, p3));
  }

  return points;
}

/**
 * Characters adjacent on a QWERTY keyboard layout, used for simulating realistic typos.
 */
const NEARBY_KEYS: Record<string, string[]> = {
  a: ['s', 'q', 'w', 'z'],
  b: ['v', 'g', 'h', 'n'],
  c: ['x', 'd', 'f', 'v'],
  d: ['s', 'e', 'r', 'f', 'c', 'x'],
  e: ['w', 'r', 'd', 's'],
  f: ['d', 'r', 't', 'g', 'v', 'c'],
  g: ['f', 't', 'y', 'h', 'b', 'v'],
  h: ['g', 'y', 'u', 'j', 'n', 'b'],
  i: ['u', 'o', 'k', 'j'],
  j: ['h', 'u', 'i', 'k', 'm', 'n'],
  k: ['j', 'i', 'o', 'l', 'm'],
  l: ['k', 'o', 'p'],
  m: ['n', 'j', 'k'],
  n: ['b', 'h', 'j', 'm'],
  o: ['i', 'p', 'l', 'k'],
  p: ['o', 'l'],
  q: ['w', 'a'],
  r: ['e', 't', 'f', 'd'],
  s: ['a', 'w', 'e', 'd', 'x', 'z'],
  t: ['r', 'y', 'g', 'f'],
  u: ['y', 'i', 'j', 'h'],
  v: ['c', 'f', 'g', 'b'],
  w: ['q', 'e', 's', 'a'],
  x: ['z', 's', 'd', 'c'],
  y: ['t', 'u', 'h', 'g'],
  z: ['a', 's', 'x'],
};

/**
 * Simulates realistic human-like browser interactions.
 * Uses Gaussian-distributed delays, Bezier curve mouse paths,
 * variable typing speeds with occasional typos, and natural scrolling.
 */
export class HumanBehavior {
  private config: HumanBehaviorConfig;

  constructor(config?: Partial<HumanBehaviorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Wait for a random duration using Gaussian distribution.
   * The mean is the midpoint of [minMs, maxMs] with stddev = range / 4.
   */
  async delay(minMs?: number, maxMs?: number): Promise<void> {
    const min = minMs ?? this.config.minDelay;
    const max = maxMs ?? this.config.maxDelay;
    const mean = (min + max) / 2;
    const stddev = (max - min) / 4;

    const ms = Math.round(gaussianRandom(mean, stddev, min, max));
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Move the mouse along a Bezier curve to the target coordinates.
   * Number of intermediate steps is proportional to the distance traveled.
   */
  async moveMouse(page: Page, targetX: number, targetY: number): Promise<void> {
    // Get current mouse position via page evaluate, defaulting to a random start
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- runs in browser context
    const currentPos = await page.evaluate(() => {
      const g = globalThis as any;
      return {
        x: (g.__mouseX as number | undefined) ?? Math.floor((g.innerWidth as number) * 0.5),
        y: (g.__mouseY as number | undefined) ?? Math.floor((g.innerHeight as number) * 0.5),
      };
    });

    const distance = Math.hypot(targetX - currentPos.x, targetY - currentPos.y);
    const steps = Math.max(8, Math.min(40, Math.round(distance / 15)));

    const path = generateBezierPath(
      currentPos.x,
      currentPos.y,
      targetX,
      targetY,
      steps,
    );

    for (const point of path) {
      let x = Math.round(point.x);
      let y = Math.round(point.y);

      // Add subtle jitter to each waypoint
      if (this.config.mouseJitter) {
        x += randInt(-2, 2);
        y += randInt(-2, 2);
      }

      await page.mouse.move(x, y);

      // Small per-step delay to make the movement visible
      const stepDelay = gaussianRandom(5, 3, 1, 15);
      await new Promise<void>((resolve) => setTimeout(resolve, Math.round(stepDelay)));
    }

    // Track position for subsequent movements
    await page.evaluate(
      ({ x, y }: { x: number; y: number }) => {
        const g = globalThis as any;
        g.__mouseX = x;
        g.__mouseY = y;
      },
      { x: targetX, y: targetY },
    );
  }

  /**
   * Perform a human-like click on an element:
   * 1. Locate the element and its bounding box
   * 2. Move the mouse to a randomly offset point within the element
   * 3. Pause briefly, then click
   */
  async click(page: Page, selector: string): Promise<void> {
    const element = page.locator(selector).first();
    await element.waitFor({ state: 'visible', timeout: 10000 });

    const box = await element.boundingBox();
    if (!box) {
      logger.warn({ selector }, 'Element not visible or has no bounding box, falling back to direct click');
      await element.click();
      return;
    }

    // Click at a random offset within the element bounds (avoid exact center)
    const offsetX = box.x + box.width * (0.2 + Math.random() * 0.6);
    const offsetY = box.y + box.height * (0.2 + Math.random() * 0.6);

    await this.moveMouse(page, offsetX, offsetY);
    await this.delay(50, 200);
    await page.mouse.click(offsetX, offsetY);
    await this.delay(100, 300);
  }

  /**
   * Type text with human-like characteristics:
   * - Variable delay per character based on configured WPM
   * - Occasional typos (nearby key on QWERTY layout) that get corrected
   * - Slight pauses after spaces and punctuation
   */
  async type(page: Page, selector: string, text: string): Promise<void> {
    const element = page.locator(selector).first();
    await element.waitFor({ state: 'visible', timeout: 10000 });
    await this.click(page, selector);

    // Average ms per character derived from WPM (5 chars per word)
    const avgCharDelayMs = 60000 / (this.config.typingSpeed.wpm * 5);

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // Decide whether to make a typo
      if (Math.random() < this.config.typingSpeed.errorRate && char.match(/[a-z]/i)) {
        const lowerChar = char.toLowerCase();
        const neighbors = NEARBY_KEYS[lowerChar];
        if (neighbors && neighbors.length > 0) {
          // Type the wrong key
          const typo = neighbors[randInt(0, neighbors.length - 1)];
          const typoChar = char === char.toUpperCase() ? typo.toUpperCase() : typo;
          await page.keyboard.type(typoChar, { delay: 0 });

          // Brief pause — "notice" the mistake
          await this.delay(200, 500);

          // Press backspace to correct
          await page.keyboard.press('Backspace');
          await this.delay(80, 180);
        }
      }

      // Type the correct character
      await page.keyboard.type(char, { delay: 0 });

      // Variable delay per character
      let charDelay = gaussianRandom(avgCharDelayMs, avgCharDelayMs * 0.3, avgCharDelayMs * 0.3, avgCharDelayMs * 2.5);

      // Longer pauses after spaces and punctuation
      if (char === ' ') {
        charDelay *= 1.3 + Math.random() * 0.4;
      } else if ('.!?,;:'.includes(char)) {
        charDelay *= 1.8 + Math.random() * 0.7;
      }

      await new Promise<void>((resolve) => setTimeout(resolve, Math.round(charDelay)));
    }
  }

  /**
   * Scroll the page with human-like characteristics.
   * In 'human' mode, scrolling happens in chunks with variable speed and pauses.
   */
  async scroll(
    page: Page,
    direction: 'up' | 'down',
    amount: number,
  ): Promise<void> {
    const sign = direction === 'down' ? 1 : -1;

    if (this.config.scrollBehavior === 'instant') {
      await page.evaluate(
        ({ scrollAmount }: { scrollAmount: number }) => {
          (globalThis as any).scrollBy(0, scrollAmount);
        },
        { scrollAmount: sign * amount },
      );
      return;
    }

    if (this.config.scrollBehavior === 'smooth') {
      await page.evaluate(
        ({ scrollAmount }: { scrollAmount: number }) => {
          (globalThis as any).scrollBy({ top: scrollAmount, behavior: 'smooth' });
        },
        { scrollAmount: sign * amount },
      );
      await this.delay(300, 600);
      return;
    }

    // 'human' scroll: break into random-sized chunks with pauses
    let scrolled = 0;
    while (scrolled < amount) {
      // Each chunk is between 30 and 150 pixels
      const chunk = Math.min(randInt(30, 150), amount - scrolled);
      await page.mouse.wheel(0, sign * chunk);
      scrolled += chunk;

      // Variable delay between scroll ticks
      const tickDelay = gaussianRandom(30, 15, 10, 80);
      await new Promise<void>((resolve) => setTimeout(resolve, Math.round(tickDelay)));

      // Occasional longer pause (mimics user reading mid-scroll)
      if (Math.random() < 0.1) {
        await this.delay(300, 800);
      }
    }
  }

  /**
   * Simulate reading a page for a given duration.
   * Scrolls slowly, pauses at random points, and moves the mouse occasionally.
   */
  async readPage(page: Page, durationMs: number): Promise<void> {
    const startTime = Date.now();
    const viewport = page.viewportSize() ?? { width: 1920, height: 1080 };

    logger.debug({ durationMs }, 'Simulating page reading');

    while (Date.now() - startTime < durationMs) {
      const elapsed = Date.now() - startTime;
      const remaining = durationMs - elapsed;
      if (remaining < 200) break;

      // Pick a random action: scroll, move mouse, or just wait
      const action = Math.random();

      if (action < 0.4) {
        // Scroll down a bit
        const scrollAmount = randInt(80, 300);
        await this.scroll(page, 'down', scrollAmount);
      } else if (action < 0.65) {
        // Move mouse to a random position (mimics eyes following cursor)
        const x = randInt(100, viewport.width - 100);
        const y = randInt(100, viewport.height - 100);
        await this.moveMouse(page, x, y);
      } else if (action < 0.8) {
        // Occasionally scroll back up slightly
        const scrollAmount = randInt(30, 120);
        await this.scroll(page, 'up', scrollAmount);
      } else {
        // Just pause, simulating reading
        await this.delay(800, 2500);
      }

      // Standard reading pause between actions
      const pauseLimit = Math.min(remaining, 2000);
      if (pauseLimit > 200) {
        await this.delay(200, pauseLimit);
      }
    }

    logger.debug('Page reading simulation complete');
  }
}
