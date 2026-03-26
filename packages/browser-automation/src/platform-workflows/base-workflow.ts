import type { Page, BrowserContext } from 'playwright';
import type { Logger } from '@airevstream/shared';
import { createLogger } from '@airevstream/shared';
import type {
  AccountCredentials,
  DiscoveryResult,
  HumanBehaviorConfig,
  ProfileAssetsConfig,
  StepResult,
  WarmingConfig,
  WarmingSessionResult,
  WorkflowResult,
} from '../types';
import { HumanBehavior } from '../human-behavior';

export interface WorkflowOptions {
  screenshotDir?: string;
  humanConfig?: HumanBehaviorConfig;
}

/**
 * Abstract base class for all platform-specific browser workflows.
 *
 * Provides shared infrastructure for step execution, screenshot capture,
 * navigation, captcha detection, and result building. Each platform must
 * implement its own login, createAccount, warmAccount, and checkAccountHealth
 * methods using the helpers defined here.
 */
export abstract class BasePlatformWorkflow {
  protected context: BrowserContext;
  protected page!: Page;
  protected humanBehavior: HumanBehavior;
  protected logger: Logger;
  protected screenshots: string[] = [];
  protected steps: StepResult[] = [];
  private screenshotDir: string;

  constructor(context: BrowserContext, options?: WorkflowOptions) {
    this.context = context;
    this.screenshotDir = options?.screenshotDir ?? '/tmp/airevstream/screenshots';
    this.humanBehavior = new HumanBehavior(options?.humanConfig);
    this.logger = createLogger('platform-workflow');
  }

  /**
   * Initialize the workflow by creating a new page in the browser context.
   * Must be called before running any workflow methods.
   */
  protected async init(): Promise<void> {
    this.page = await this.context.newPage();
    this.screenshots = [];
    this.steps = [];
  }

  // ─── Abstract Methods (Platform-Specific) ───

  /**
   * Log in to the platform with the provided credentials.
   * Must handle CAPTCHA/2FA by returning needsHuman=true.
   */
  abstract login(credentials: AccountCredentials): Promise<WorkflowResult>;

  /**
   * Create a new account on the platform.
   * Must handle phone/email verification by returning needsHuman=true.
   */
  abstract createAccount(credentials: AccountCredentials): Promise<WorkflowResult>;

  /**
   * Warm an account by performing natural-looking platform activities.
   * Activities are selected from the config's activities list.
   */
  abstract warmAccount(config: WarmingConfig): Promise<WarmingSessionResult>;

  /**
   * Check whether the account is in good standing on the platform.
   * Returns health status and a list of any detected issues.
   */
  abstract checkAccountHealth(): Promise<{ healthy: boolean; issues: string[] }>;

  /**
   * Discover whether an email already has an account on this platform.
   * Uses login probe — navigates to login, enters email, checks platform response.
   */
  abstract discoverAccount(credentials: AccountCredentials): Promise<DiscoveryResult>;

  /**
   * Upload profile image, banner, and set display name/bio after account creation.
   * Platform workflows that don't support this should return success with no-op.
   */
  abstract setProfileAssets(config: ProfileAssetsConfig): Promise<WorkflowResult>;

  // ─── Shared Helpers ───

  /**
   * Execute a named workflow step, tracking its duration, success/failure,
   * and capturing a screenshot on error.
   */
  protected async executeStep(
    name: string,
    fn: () => Promise<Record<string, unknown> | void>,
  ): Promise<StepResult> {
    const startTime = Date.now();
    this.logger.debug({ step: name }, 'Executing workflow step');

    try {
      const data = await fn();
      const result: StepResult = {
        name,
        success: true,
        durationMs: Date.now() - startTime,
        data: data ?? undefined,
      };
      this.steps.push(result);
      this.logger.info({ step: name, durationMs: result.durationMs }, 'Step completed');
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const screenshot = await this.takeScreenshot(`error-${name}`);
      const result: StepResult = {
        name,
        success: false,
        durationMs: Date.now() - startTime,
        error: errorMessage,
        screenshot,
      };
      this.steps.push(result);
      this.logger.error({ step: name, error: errorMessage }, 'Step failed');
      return result;
    }
  }

  /**
   * Take a screenshot of the current page state.
   * Returns the file path on success, or undefined if the capture fails.
   */
  protected async takeScreenshot(name: string): Promise<string | undefined> {
    try {
      const timestamp = Date.now();
      const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filePath = `${this.screenshotDir}/${sanitizedName}-${timestamp}.png`;
      await this.page.screenshot({ path: filePath, fullPage: false });
      this.screenshots.push(filePath);
      this.logger.debug({ path: filePath }, 'Screenshot captured');
      return filePath;
    } catch (error) {
      this.logger.warn({ error }, 'Failed to capture screenshot');
      return undefined;
    }
  }

  /**
   * Wait for navigation to complete, optionally waiting until the URL
   * contains the specified substring.
   */
  protected async waitForNavigation(page: Page, url?: string): Promise<void> {
    if (url) {
      await page.waitForURL(`**${url}**`, { timeout: 30_000 });
    } else {
      await page.waitForLoadState('domcontentloaded', { timeout: 30_000 });
    }
  }

  /**
   * Check whether the user appears to be logged in.
   * Default implementation checks for common avatar/profile selectors.
   * Platform workflows should override this with platform-specific checks.
   */
  protected async isLoggedIn(): Promise<boolean> {
    try {
      // Generic check — platforms should override with specific selectors
      const avatarSelectors = [
        'img[alt*="avatar" i]',
        'img[alt*="profile" i]',
        '[data-testid="user-avatar"]',
        '#avatar',
      ];
      for (const selector of avatarSelectors) {
        const element = await this.page.$(selector);
        if (element) return true;
      }
      return false;
    } catch (err) {
      this.logger.debug({ err }, 'isLoggedIn check failed');
      return false;
    }
  }

  /**
   * Attempt to detect and handle CAPTCHA challenges.
   * Returns whether the CAPTCHA was solved, or if human intervention is needed.
   */
  protected async handleCaptcha(): Promise<{
    solved: boolean;
    needsHuman: boolean;
    taskDescription?: string;
  }> {
    // Common CAPTCHA frame selectors across platforms
    const captchaSelectors = [
      'iframe[src*="recaptcha"]',
      'iframe[src*="captcha"]',
      'iframe[title*="reCAPTCHA"]',
      '[class*="captcha" i]',
      '#captcha',
      'iframe[src*="hcaptcha"]',
      'iframe[src*="funcaptcha"]',
      'iframe[src*="arkoselabs"]',
    ];

    for (const selector of captchaSelectors) {
      const captchaElement = await this.page.$(selector);
      if (captchaElement) {
        this.logger.warn({ selector }, 'CAPTCHA detected');
        await this.takeScreenshot('captcha-detected');
        return {
          solved: false,
          needsHuman: true,
          taskDescription: `CAPTCHA detected (${selector}). Please solve the CAPTCHA manually and resume.`,
        };
      }
    }

    return { solved: true, needsHuman: false };
  }

  /**
   * Dismiss cookie consent banners that platforms typically show.
   * Tries common button selectors to accept/dismiss the dialog.
   */
  protected async dismissCookieDialog(): Promise<void> {
    // Common "Accept cookies" button selectors
    const acceptSelectors = [
      'button[id*="accept" i]',
      'button[class*="accept" i]',
      'button:has-text("Accept all")',
      'button:has-text("Accept All")',
      'button:has-text("Accept cookies")',
      'button:has-text("I agree")',
      'button:has-text("Agree")',
      'button:has-text("Allow all")',
      'button:has-text("Allow All")',
      'button:has-text("OK")',
      '[data-testid="cookie-policy-manage-dialog-btn-accept"]',
    ];

    for (const selector of acceptSelectors) {
      try {
        const button = await this.page.$(selector);
        if (button) {
          await this.humanBehavior.click(this.page, selector);
          this.logger.debug({ selector }, 'Cookie dialog dismissed');
          // Short pause after dismissing
          await this.humanBehavior.delay(500, 1000);
          return;
        }
      } catch (err) {
        // Selector not found or not clickable, try next
        this.logger.debug({ selector, err }, 'Cookie dialog selector not found or not clickable');
      }
    }
  }

  /**
   * Build the final WorkflowResult from accumulated steps and screenshots.
   */
  protected buildResult(
    success: boolean,
    error?: string,
    needsHuman?: boolean,
    humanTaskDesc?: string,
  ): WorkflowResult {
    return {
      success,
      steps: [...this.steps],
      screenshots: this.screenshots.length > 0 ? [...this.screenshots] : undefined,
      error,
      needsHuman,
      humanTaskDescription: humanTaskDesc,
    };
  }
}
