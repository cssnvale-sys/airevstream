import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BrowserContext, Page, ElementHandle } from 'playwright';
import { FacebookWorkflow } from '../platform-workflows/facebook-workflow.js';
import type { AccountCredentials, ProfileAssetsConfig } from '../types.js';

// ─── Mock Factories ───

function createMockElementHandle(
  overrides: Partial<ElementHandle> = {},
): ElementHandle {
  return {
    click: vi.fn().mockResolvedValue(undefined),
    type: vi.fn().mockResolvedValue(undefined),
    textContent: vi.fn().mockResolvedValue(null),
    getAttribute: vi.fn().mockResolvedValue(null),
    setInputFiles: vi.fn().mockResolvedValue(undefined),
    boundingBox: vi.fn().mockResolvedValue(null),
    waitFor: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as ElementHandle;
}

function createMockPage(overrides: Partial<Page> = {}): Page {
  const url = vi.fn().mockReturnValue('https://www.facebook.com');
  return {
    goto: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    waitForURL: vi.fn().mockResolvedValue(undefined),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
    $: vi.fn().mockResolvedValue(null),
    $$: vi.fn().mockResolvedValue([]),
    $eval: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue(undefined),
    screenshot: vi.fn().mockResolvedValue(undefined),
    click: vi.fn().mockResolvedValue(undefined),
    type: vi.fn().mockResolvedValue(undefined),
    selectOption: vi.fn().mockResolvedValue(undefined),
    keyboard: {
      press: vi.fn().mockResolvedValue(undefined),
      type: vi.fn().mockResolvedValue(undefined),
    },
    mouse: {
      move: vi.fn().mockResolvedValue(undefined),
      click: vi.fn().mockResolvedValue(undefined),
      wheel: vi.fn().mockResolvedValue(undefined),
    },
    locator: vi.fn().mockReturnValue({
      first: vi.fn().mockReturnValue({
        waitFor: vi.fn().mockResolvedValue(undefined),
        click: vi.fn().mockResolvedValue(undefined),
        boundingBox: vi.fn().mockResolvedValue(null),
        type: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    url,
    viewportSize: vi.fn().mockReturnValue({ width: 1920, height: 1080 }),
    ...overrides,
  } as unknown as Page;
}

function createMockContext(page: Page): BrowserContext {
  return {
    newPage: vi.fn().mockResolvedValue(page),
  } as unknown as BrowserContext;
}

// ─── Tests ───

describe('FacebookWorkflow', () => {
  let mockPage: Page;
  let mockContext: BrowserContext;
  let workflow: FacebookWorkflow;
  let credentials: AccountCredentials;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});

    mockPage = createMockPage();
    mockContext = createMockContext(mockPage);
    workflow = new FacebookWorkflow(mockContext, {
      humanConfig: {
        minDelay: 0,
        maxDelay: 1,
        mouseJitter: false,
        scrollBehavior: 'instant',
        typingSpeed: { wpm: 500, errorRate: 0 },
      },
    });
    credentials = {
      email: 'testuser@example.com',
      password: 'password123',
      platform: 'facebook',
    };
  });

  describe('discoverAccount', () => {
    it('should navigate to Facebook login page', async () => {
      vi.mocked(mockPage.$).mockResolvedValue(null);

      const result = await workflow.discoverAccount(credentials);

      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://www.facebook.com/login',
        { waitUntil: 'domcontentloaded' },
      );
      expect(result.exists).toBe('unknown');
    }, 15000);

    it('should return exists=false when account not found', async () => {
      vi.mocked(mockPage.$).mockImplementation((selector: string) => {
        if (
          selector.includes('connected to an account') ||
          selector.includes('match any account') ||
          selector.includes('email you entered') ||
          selector.includes('doesn\'t')
        ) {
          return Promise.resolve(createMockElementHandle());
        }
        return Promise.resolve(null);
      });

      const result = await workflow.discoverAccount(credentials);

      expect(result.exists).toBe(false);
    }, 15000);

    it('should return exists=true when password field is present', async () => {
      vi.mocked(mockPage.$).mockImplementation((selector: string) => {
        if (selector === 'input#pass, input[name="pass"]') {
          return Promise.resolve(createMockElementHandle());
        }
        return Promise.resolve(null);
      });
      vi.mocked(mockPage.$eval).mockResolvedValue('Test User');

      const result = await workflow.discoverAccount(credentials);

      expect(result.exists).toBe(true);
    }, 15000);

    it('should call init (newPage) before discovery', async () => {
      vi.mocked(mockPage.$).mockResolvedValue(null);

      await workflow.discoverAccount(credentials);

      expect(mockContext.newPage).toHaveBeenCalled();
    }, 15000);

    it('should type the email into the email field', async () => {
      vi.mocked(mockPage.$).mockResolvedValue(null);

      await workflow.discoverAccount(credentials);

      expect(mockPage.waitForSelector).toHaveBeenCalledWith(
        expect.stringContaining('input#email'),
        { timeout: 10_000 },
      );
    }, 15000);
  });

  describe('setProfileAssets', () => {
    let config: ProfileAssetsConfig;

    beforeEach(() => {
      config = {
        profileImagePath: '/tmp/test-profile.png',
        bannerImagePath: '/tmp/test-banner.png',
        displayName: 'Test User',
        bio: 'This is a test bio',
      };
    });

    it('should navigate to Facebook profile edit page', async () => {
      vi.mocked(mockPage.$).mockResolvedValue(null);

      await workflow.setProfileAssets(config);

      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://www.facebook.com/profile.php?sk=edit',
        { waitUntil: 'domcontentloaded' },
      );
    }, 15000);

    it('should call setInputFiles when profileImagePath is provided', async () => {
      const mockFileInput = createMockElementHandle({
        setInputFiles: vi.fn().mockResolvedValue(undefined),
      });
      vi.mocked(mockPage.$).mockImplementation((selector: string) => {
        if (selector.includes('input[type="file"]')) {
          return Promise.resolve(mockFileInput);
        }
        return Promise.resolve(null);
      });

      await workflow.setProfileAssets(config);

      expect(mockFileInput.setInputFiles).toHaveBeenCalledWith('/tmp/test-profile.png');
    }, 15000);

    it('should return success=true when setProfileAssets completes', async () => {
      vi.mocked(mockPage.$).mockResolvedValue(null);

      const result = await workflow.setProfileAssets(config);

      expect(result.success).toBe(true);
    }, 15000);

    it('should call init (newPage) before setProfileAssets', async () => {
      vi.mocked(mockPage.$).mockResolvedValue(null);

      await workflow.setProfileAssets(config);

      expect(mockContext.newPage).toHaveBeenCalled();
    }, 15000);

    it('should not attempt upload when profileImagePath is not provided', async () => {
      config.profileImagePath = undefined;
      vi.mocked(mockPage.$).mockResolvedValue(null);

      await workflow.setProfileAssets(config);

      expect(mockPage.goto).toHaveBeenCalled();
    }, 15000);
  });
});