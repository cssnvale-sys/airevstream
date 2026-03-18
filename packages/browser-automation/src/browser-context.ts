import { chromium, type Browser, type BrowserContext } from 'playwright';
import { randomUUID } from 'node:crypto';
import { createLogger } from '@airevstream/shared';
import type { BrowserSessionConfig, ManagedContext } from './types.js';

const logger = createLogger('browser-context');

/**
 * Anti-detection script injected into every browser context.
 * Overrides common fingerprinting vectors that automation detectors check.
 */
function buildStealthScript(config: BrowserSessionConfig): string {
  const fp = config.fingerprint ?? {};

  return `
    // ── Remove navigator.webdriver flag ──
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });

    // ── Fake chrome.runtime to mimic a real Chrome install ──
    if (!window.chrome) {
      window.chrome = {};
    }
    if (!window.chrome.runtime) {
      window.chrome.runtime = {
        connect: function() {},
        sendMessage: function() {},
        onMessage: {
          addListener: function() {},
          removeListener: function() {},
        },
        id: undefined,
      };
    }

    // ── Override Notification.permission ──
    if (typeof Notification !== 'undefined') {
      Object.defineProperty(Notification, 'permission', {
        get: () => 'default',
      });
    }

    // ── Override navigator.languages ──
    ${
      fp.languages
        ? `Object.defineProperty(navigator, 'languages', {
            get: () => ${JSON.stringify(fp.languages)},
          });`
        : ''
    }

    // ── Override navigator.platform ──
    ${
      fp.platform
        ? `Object.defineProperty(navigator, 'platform', {
            get: () => ${JSON.stringify(fp.platform)},
          });`
        : ''
    }

    // ── Fake navigator.plugins to look like a real browser ──
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const plugins = [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
          { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
        ];
        plugins.length = 3;
        return plugins;
      },
    });

    // ── Override WebGL vendor/renderer ──
    ${
      fp.webglVendor || fp.webglRenderer
        ? `
    const getParameterOrig = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter) {
      const UNMASKED_VENDOR_WEBGL = 0x9245;
      const UNMASKED_RENDERER_WEBGL = 0x9246;
      ${fp.webglVendor ? `if (parameter === UNMASKED_VENDOR_WEBGL) return ${JSON.stringify(fp.webglVendor)};` : ''}
      ${fp.webglRenderer ? `if (parameter === UNMASKED_RENDERER_WEBGL) return ${JSON.stringify(fp.webglRenderer)};` : ''}
      return getParameterOrig.call(this, parameter);
    };

    const getParameterOrig2 = WebGL2RenderingContext.prototype.getParameter;
    WebGL2RenderingContext.prototype.getParameter = function(parameter) {
      const UNMASKED_VENDOR_WEBGL = 0x9245;
      const UNMASKED_RENDERER_WEBGL = 0x9246;
      ${fp.webglVendor ? `if (parameter === UNMASKED_VENDOR_WEBGL) return ${JSON.stringify(fp.webglVendor)};` : ''}
      ${fp.webglRenderer ? `if (parameter === UNMASKED_RENDERER_WEBGL) return ${JSON.stringify(fp.webglRenderer)};` : ''}
      return getParameterOrig2.call(this, parameter);
    };
    `
        : ''
    }

    // ── Override hardwareConcurrency ──
    ${
      fp.hardwareConcurrency
        ? `Object.defineProperty(navigator, 'hardwareConcurrency', {
            get: () => ${fp.hardwareConcurrency},
          });`
        : ''
    }

    // ── Override deviceMemory ──
    ${
      fp.deviceMemory
        ? `Object.defineProperty(navigator, 'deviceMemory', {
            get: () => ${fp.deviceMemory},
          });`
        : ''
    }

    // ── Override screen properties ──
    ${
      fp.screenResolution
        ? `
    Object.defineProperty(screen, 'width', { get: () => ${fp.screenResolution.width} });
    Object.defineProperty(screen, 'height', { get: () => ${fp.screenResolution.height} });
    Object.defineProperty(screen, 'availWidth', { get: () => ${fp.screenResolution.width} });
    Object.defineProperty(screen, 'availHeight', { get: () => ${fp.screenResolution.height - 40} });
    `
        : ''
    }

    ${
      fp.colorDepth
        ? `Object.defineProperty(screen, 'colorDepth', { get: () => ${fp.colorDepth} });`
        : ''
    }

    // ── Prevent detection via permissions API ──
    if (navigator.permissions) {
      const originalQuery = navigator.permissions.query;
      navigator.permissions.query = (params) => {
        if (params.name === 'notifications') {
          return Promise.resolve({ state: Notification.permission, onchange: null });
        }
        return originalQuery.call(navigator.permissions, params);
      };
    }

    // ── Remove Playwright/automation traces from Error stacks ──
    const originalError = Error;
    Error = class extends originalError {
      constructor(message) {
        super(message);
        if (this.stack) {
          this.stack = this.stack.replace(/playwright|puppeteer|automation/gi, 'native');
        }
      }
    };
  `;
}

/**
 * Manages isolated Playwright browser contexts with anti-detection features.
 * Each context is tracked by a UUID and can be independently created/destroyed.
 */
export class BrowserContextManager {
  private browser: Browser | null = null;
  private contexts: Map<string, ManagedContext> = new Map();
  private launchOptions: Record<string, unknown>;

  constructor(launchOptions?: Record<string, unknown>) {
    this.launchOptions = launchOptions ?? {};
  }

  /**
   * Lazily launch the shared Chromium browser instance.
   */
  private async ensureBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      logger.info('Launching Chromium browser');
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-infobars',
          '--no-first-run',
          '--no-default-browser-check',
        ],
        ...this.launchOptions,
      });

      this.browser.on('disconnected', () => {
        logger.warn('Browser disconnected unexpectedly');
        this.browser = null;
      });
    }

    return this.browser;
  }

  /**
   * Create an isolated browser context with full anti-detection configuration.
   * Returns the context ID for later reference.
   */
  async createContext(config: BrowserSessionConfig = {}): Promise<{
    id: string;
    context: BrowserContext;
  }> {
    const browser = await this.ensureBrowser();
    const id = randomUUID();

    // Build context options from config
    const contextOptions: Record<string, unknown> = {
      viewport: config.viewport ?? { width: 1920, height: 1080 },
      locale: config.locale ?? 'en-US',
      timezoneId: config.timezone ?? 'America/New_York',
      ignoreHTTPSErrors: true,
      javaScriptEnabled: true,
    };

    // Apply proxy if configured
    if (config.proxy) {
      contextOptions.proxy = {
        server: config.proxy.server,
        username: config.proxy.username,
        password: config.proxy.password,
      };
    }

    // Apply user agent from fingerprint
    if (config.fingerprint?.userAgent) {
      contextOptions.userAgent = config.fingerprint.userAgent;
    }

    // Apply geolocation
    if (config.geolocation) {
      contextOptions.geolocation = config.geolocation;
      contextOptions.permissions = ['geolocation'];
    }

    // Persistent context uses userDataDir; ephemeral context does not
    let context: BrowserContext;
    if (config.userDataDir) {
      // For persistent contexts we need to launch a separate browser instance
      const persistentBrowser = await chromium.launchPersistentContext(
        config.userDataDir,
        {
          headless: config.headless ?? true,
          args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-infobars',
            '--no-first-run',
            '--no-default-browser-check',
          ],
          ...contextOptions,
        },
      );
      context = persistentBrowser;
    } else {
      context = await browser.newContext(contextOptions);
    }

    // Inject stealth/anti-detection script into every new page
    await context.addInitScript(buildStealthScript(config));

    const managed: ManagedContext = {
      id,
      context,
      config,
      createdAt: Date.now(),
    };

    this.contexts.set(id, managed);
    logger.info({ contextId: id }, 'Created browser context');

    return { id, context };
  }

  /**
   * Get a managed context by its ID.
   */
  getContext(contextId: string): ManagedContext | undefined {
    return this.contexts.get(contextId);
  }

  /**
   * Close a specific context and remove it from tracking.
   */
  async closeContext(contextId: string): Promise<void> {
    const managed = this.contexts.get(contextId);
    if (!managed) {
      logger.warn({ contextId }, 'Attempted to close unknown context');
      return;
    }

    try {
      await managed.context.close();
    } catch (err) {
      logger.error({ contextId, err }, 'Error closing context');
    }

    this.contexts.delete(contextId);
    logger.info({ contextId }, 'Closed browser context');
  }

  /**
   * Close all managed contexts and shut down the browser.
   */
  async closeAll(): Promise<void> {
    const contextIds = [...this.contexts.keys()];

    for (const id of contextIds) {
      await this.closeContext(id);
    }

    if (this.browser) {
      try {
        await this.browser.close();
      } catch (err) {
        logger.error({ err }, 'Error closing browser');
      }
      this.browser = null;
    }

    logger.info('All browser contexts and browser closed');
  }

  /**
   * Return the number of active contexts.
   */
  get activeCount(): number {
    return this.contexts.size;
  }

  /**
   * Return a list of all active context IDs.
   */
  get activeContextIds(): string[] {
    return [...this.contexts.keys()];
  }
}
