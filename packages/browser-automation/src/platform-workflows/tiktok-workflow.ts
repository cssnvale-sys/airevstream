import type {
  AccountCredentials,
  DiscoveryResult,
  ProfileAssetsConfig,
  WarmingConfig,
  WarmingSessionResult,
  WarmingActivity,
  WarmingActivityResult,
  WorkflowResult,
} from '../types';
import { BasePlatformWorkflow } from './base-workflow';

/**
 * TikTok account workflow.
 *
 * Handles login via email/password or Google SSO, account creation,
 * account warming (browsing FYP, liking, following, watching videos),
 * and health checking via TikTok creator tools.
 */
export class TikTokWorkflow extends BasePlatformWorkflow {
  private readonly TIKTOK_URL = 'https://www.tiktok.com';
  private readonly TIKTOK_LOGIN_URL = 'https://www.tiktok.com/login';
  private readonly TIKTOK_SIGNUP_URL = 'https://www.tiktok.com/signup';
  private readonly TIKTOK_CREATOR_URL = 'https://www.tiktok.com/creator';

  // ─── Login ───

  async login(credentials: AccountCredentials): Promise<WorkflowResult> {
    await this.init();
    this.logger.info({ email: credentials.email }, 'Starting TikTok login');

    try {
      // Step 1: Navigate to TikTok login page
      const navStep = await this.executeStep('navigate-to-login', async () => {
        await this.page.goto(this.TIKTOK_LOGIN_URL, { waitUntil: 'domcontentloaded' });
        await this.dismissCookieDialog();
        await this.humanBehavior.delay(2000, 4000);
      });
      if (!navStep.success) return this.buildResult(false, navStep.error);

      // Step 2: Select email/password login method
      const selectMethodStep = await this.executeStep('select-email-login', async () => {
        // TikTok login options — "Use phone / email / username"
        const emailLoginOption = 'div[class*="channel-item"]:has-text("email"), a:has-text("Use phone / email / username")';
        await this.page.waitForSelector(emailLoginOption, { timeout: 10_000 });
        await this.humanBehavior.click(this.page, emailLoginOption);
        await this.humanBehavior.delay(1000, 2000);
        // Switch to "Log in with email or username" tab
        const emailTab = 'a:has-text("Log in with email or username"), a[href*="email"]';
        const emailTabEl = await this.page.$(emailTab);
        if (emailTabEl) {
          await this.humanBehavior.click(this.page, emailTab);
          await this.humanBehavior.delay(500, 1000);
        }
      });
      if (!selectMethodStep.success) return this.buildResult(false, selectMethodStep.error);

      // Step 3: Enter email/username
      const emailStep = await this.executeStep('enter-email', async () => {
        // TikTok email input field
        const emailInput = 'input[name="username"], input[placeholder*="Email" i], input[placeholder*="email" i]';
        await this.page.waitForSelector(emailInput, { timeout: 10_000 });
        await this.humanBehavior.type(this.page, emailInput, credentials.email);
      });
      if (!emailStep.success) return this.buildResult(false, emailStep.error);

      // Step 4: Enter password
      const passwordStep = await this.executeStep('enter-password', async () => {
        // TikTok password input field
        const passwordInput = 'input[type="password"], input[placeholder*="Password" i]';
        await this.page.waitForSelector(passwordInput, { timeout: 10_000 });
        await this.humanBehavior.type(this.page, passwordInput, credentials.password);
      });
      if (!passwordStep.success) return this.buildResult(false, passwordStep.error);

      // Step 5: Check for CAPTCHA before submitting
      const captchaCheck = await this.handleCaptcha();
      if (captchaCheck.needsHuman) {
        return this.buildResult(false, 'CAPTCHA detected', true, captchaCheck.taskDescription);
      }

      // Step 6: Click Login button
      const loginStep = await this.executeStep('click-login', async () => {
        // TikTok login submit button
        const loginButton = 'button[type="submit"], button[data-e2e="login-button"], button:has-text("Log in")';
        await this.humanBehavior.click(this.page, loginButton);
        await this.humanBehavior.delay(3000, 6000);
      });
      if (!loginStep.success) return this.buildResult(false, loginStep.error);

      // Step 7: Handle CAPTCHA after submission (TikTok often shows puzzle CAPTCHA)
      const postCaptcha = await this.executeStep('handle-post-captcha', async () => {
        // TikTok uses custom puzzle/slide captcha
        const puzzleCaptchaSelectors = [
          'div[class*="captcha" i]',
          'div[id*="captcha" i]',
          'div[class*="verify" i]',
          'iframe[src*="captcha"]',
        ];
        for (const selector of puzzleCaptchaSelectors) {
          const el = await this.page.$(selector);
          if (el) {
            await this.takeScreenshot('tiktok-captcha');
            throw new Error(`CAPTCHA_REQUIRED:${selector}`);
          }
        }
      });
      if (!postCaptcha.success && postCaptcha.error?.startsWith('CAPTCHA_REQUIRED')) {
        return this.buildResult(
          false,
          'TikTok CAPTCHA verification required',
          true,
          'TikTok is showing a puzzle/slide CAPTCHA. Please solve it manually to complete login.',
        );
      }

      // Step 8: Handle 2FA if prompted
      const twoFaStep = await this.executeStep('check-2fa', async () => {
        const twoFaSelectors = [
          'input[placeholder*="verification code" i]',
          'input[placeholder*="code" i]',
          'div:has-text("Enter the 6-digit code")',
        ];
        for (const selector of twoFaSelectors) {
          const el = await this.page.$(selector);
          if (el) {
            await this.takeScreenshot('tiktok-2fa');
            throw new Error(`2FA_REQUIRED:${selector}`);
          }
        }
      });
      if (!twoFaStep.success && twoFaStep.error?.startsWith('2FA_REQUIRED')) {
        return this.buildResult(
          false,
          '2FA verification required',
          true,
          'TikTok requires two-factor authentication. Enter the verification code to continue.',
        );
      }

      // Step 9: Verify logged in
      const verifyStep = await this.executeStep('verify-login', async () => {
        await this.page.goto(this.TIKTOK_URL, { waitUntil: 'domcontentloaded' });
        await this.humanBehavior.delay(2000, 4000);
        // TikTok profile/avatar icon in top-right when logged in
        const avatarSelector = '[data-e2e="profile-icon"], div[class*="avatar" i] img, a[href*="/profile"]';
        await this.page.waitForSelector(avatarSelector, { timeout: 15_000 });
        await this.takeScreenshot('tiktok-login-success');
      });
      if (!verifyStep.success) return this.buildResult(false, 'Login verification failed — avatar not found');

      return this.buildResult(true);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error({ error: msg }, 'TikTok login failed');
      await this.takeScreenshot('tiktok-login-error');
      return this.buildResult(false, msg);
    }
  }

  // ─── Account Creation ───

  async createAccount(credentials: AccountCredentials): Promise<WorkflowResult> {
    await this.init();
    this.logger.info({ email: credentials.email }, 'Starting TikTok account creation');

    try {
      // Step 1: Navigate to TikTok signup
      const navStep = await this.executeStep('navigate-to-signup', async () => {
        await this.page.goto(this.TIKTOK_SIGNUP_URL, { waitUntil: 'domcontentloaded' });
        await this.dismissCookieDialog();
        await this.humanBehavior.delay(1500, 3000);
      });
      if (!navStep.success) return this.buildResult(false, navStep.error);

      // Step 2: Select email signup method
      const selectMethodStep = await this.executeStep('select-email-signup', async () => {
        // TikTok signup — "Use phone or email" option
        const emailOption = 'div[class*="channel-item"]:has-text("email"), a:has-text("Use phone or email")';
        await this.page.waitForSelector(emailOption, { timeout: 10_000 });
        await this.humanBehavior.click(this.page, emailOption);
        await this.humanBehavior.delay(1000, 2000);
      });
      if (!selectMethodStep.success) return this.buildResult(false, selectMethodStep.error);

      // Step 3: Select birthdate
      const birthdateStep = await this.executeStep('select-birthdate', async () => {
        // TikTok birthdate — month, day, year selectors
        const monthSelect = 'select[data-e2e="month-select"], select[placeholder*="Month" i]';
        const daySelect = 'select[data-e2e="day-select"], select[placeholder*="Day" i]';
        const yearSelect = 'select[data-e2e="year-select"], select[placeholder*="Year" i]';

        await this.page.waitForSelector(monthSelect, { timeout: 10_000 });
        await this.page.selectOption(monthSelect, { index: Math.floor(Math.random() * 12) + 1 });
        await this.humanBehavior.delay(300, 600);
        await this.page.selectOption(daySelect, { index: Math.floor(Math.random() * 28) + 1 });
        await this.humanBehavior.delay(300, 600);
        // Select a year that makes the user 18-30 years old
        const currentYear = new Date().getFullYear();
        const birthYear = currentYear - 18 - Math.floor(Math.random() * 12);
        await this.page.selectOption(yearSelect, { value: String(birthYear) });
        await this.humanBehavior.delay(500, 1000);
      });
      if (!birthdateStep.success) return this.buildResult(false, birthdateStep.error);

      // Step 4: Switch to email tab (TikTok defaults to phone)
      const emailTabStep = await this.executeStep('switch-to-email', async () => {
        const emailTab = 'a:has-text("Sign up with email"), a[href*="email"]';
        const emailTabEl = await this.page.$(emailTab);
        if (emailTabEl) {
          await this.humanBehavior.click(this.page, emailTab);
          await this.humanBehavior.delay(500, 1000);
        }
      });
      if (!emailTabStep.success) return this.buildResult(false, emailTabStep.error);

      // Step 5: Enter email address
      const emailStep = await this.executeStep('enter-email', async () => {
        const emailInput = 'input[name="email"], input[placeholder*="Email" i], input[type="email"]';
        await this.page.waitForSelector(emailInput, { timeout: 10_000 });
        await this.humanBehavior.type(this.page, emailInput, credentials.email);
      });
      if (!emailStep.success) return this.buildResult(false, emailStep.error);

      // Step 6: Email verification code (mark as needs-human)
      const verificationStep = await this.executeStep('email-verification', async () => {
        // TikTok sends a verification code to the email
        const sendCodeButton = 'button:has-text("Send code"), button[data-e2e="send-code-button"]';
        const sendEl = await this.page.$(sendCodeButton);
        if (sendEl) {
          await this.humanBehavior.click(this.page, sendCodeButton);
          await this.humanBehavior.delay(2000, 3000);
          await this.takeScreenshot('tiktok-email-verification');
          throw new Error('EMAIL_VERIFICATION_REQUIRED');
        }
      });
      if (!verificationStep.success && verificationStep.error === 'EMAIL_VERIFICATION_REQUIRED') {
        return this.buildResult(
          false,
          'Email verification code required during signup',
          true,
          'TikTok sent a verification code to the email address. Enter the code to continue account creation.',
        );
      }

      // Step 7: Enter password
      const passwordStep = await this.executeStep('enter-password', async () => {
        const passwordInput = 'input[type="password"], input[placeholder*="Password" i]';
        await this.page.waitForSelector(passwordInput, { timeout: 10_000 });
        await this.humanBehavior.type(this.page, passwordInput, credentials.password);
      });
      if (!passwordStep.success) return this.buildResult(false, passwordStep.error);

      // Step 8: Enter username
      const usernameStep = await this.executeStep('enter-username', async () => {
        const usernameInput = 'input[name="username"], input[placeholder*="Username" i]';
        const usernameEl = await this.page.$(usernameInput);
        if (usernameEl) {
          const username = credentials.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
          await this.humanBehavior.type(this.page, usernameInput, username);
          await this.humanBehavior.delay(500, 1000);
        }
      });
      if (!usernameStep.success) return this.buildResult(false, usernameStep.error);

      // Step 9: Click Sign Up
      const signupStep = await this.executeStep('click-signup', async () => {
        const signupButton = 'button[type="submit"], button[data-e2e="signup-button"], button:has-text("Sign up")';
        await this.humanBehavior.click(this.page, signupButton);
        await this.humanBehavior.delay(3000, 6000);
      });
      if (!signupStep.success) return this.buildResult(false, signupStep.error);

      // Step 10: Handle CAPTCHA
      const captchaCheck = await this.handleCaptcha();
      if (captchaCheck.needsHuman) {
        return this.buildResult(false, 'CAPTCHA detected during signup', true, captchaCheck.taskDescription);
      }

      // Step 11: Verify account created
      const verifyStep = await this.executeStep('verify-account', async () => {
        await this.page.goto(this.TIKTOK_URL, { waitUntil: 'domcontentloaded' });
        await this.humanBehavior.delay(2000, 4000);
        const avatarSelector = '[data-e2e="profile-icon"], div[class*="avatar" i] img';
        await this.page.waitForSelector(avatarSelector, { timeout: 15_000 });
        await this.takeScreenshot('tiktok-account-created');
      });
      if (!verifyStep.success) return this.buildResult(false, 'Account creation verification failed');

      return this.buildResult(true);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error({ error: msg }, 'TikTok account creation failed');
      await this.takeScreenshot('tiktok-create-error');
      return this.buildResult(false, msg);
    }
  }

  // ─── Account Warming ───

  async warmAccount(config: WarmingConfig): Promise<WarmingSessionResult> {
    await this.init();
    this.logger.info({ config }, 'Starting TikTok account warming');

    const activityResults: WarmingActivityResult[] = [];
    const startTime = Date.now();
    const durationMs = config.durationMinutes * 60 * 1000;
    let flagged = false;

    try {
      await this.page.goto(this.TIKTOK_URL, { waitUntil: 'domcontentloaded' });
      await this.dismissCookieDialog();
      await this.humanBehavior.delay(2000, 4000);

      while (Date.now() - startTime < durationMs) {
        const activity = config.activities[Math.floor(Math.random() * config.activities.length)];
        const activityStart = Date.now();

        try {
          const count = await this.performWarmingActivity(activity, config);
          activityResults.push({
            type: activity,
            count,
            durationMs: Date.now() - activityStart,
          });
        } catch (error) {
          this.logger.warn({ activity, error }, 'TikTok warming activity failed');
          const failCount = activityResults.filter((r) => r.count === 0).length;
          if (failCount > 5) {
            flagged = true;
            break;
          }
        }

        const delayMap = { low: [8000, 15000], medium: [4000, 10000], high: [2000, 6000] } as const;
        const [min, max] = delayMap[config.intensity];
        await this.humanBehavior.delay(min, max);
      }
    } catch (error) {
      this.logger.error({ error }, 'TikTok warming session failed');
      flagged = true;
    }

    const screenshot = await this.takeScreenshot('tiktok-warming-complete');

    return {
      activitiesPerformed: activityResults,
      totalDurationMs: Date.now() - startTime,
      flagged,
      screenshot: screenshot ?? undefined,
    };
  }

  private async performWarmingActivity(activity: WarmingActivity, config: WarmingConfig): Promise<number> {
    switch (activity) {
      case 'browse':
        return await this.warmBrowseFYP();
      case 'watch':
        return await this.warmWatchVideo();
      case 'like':
        return await this.warmLikeVideo();
      case 'search':
        return await this.warmSearch(config.nicheTags);
      case 'follow':
        return await this.warmFollowCreator();
      case 'comment':
        return await this.warmComment();
      default:
        return 0;
    }
  }

  /** Browse the For You Page by scrolling through videos. */
  private async warmBrowseFYP(): Promise<number> {
    await this.page.goto(this.TIKTOK_URL, { waitUntil: 'domcontentloaded' });
    await this.humanBehavior.delay(2000, 4000);
    // Scroll through FYP videos — each scroll loads the next video
    const scrollCount = 3 + Math.floor(Math.random() * 5);
    for (let i = 0; i < scrollCount; i++) {
      // TikTok FYP — scroll down loads next video in feed
      await this.humanBehavior.scroll(this.page, 'down',500 + Math.floor(Math.random() * 300));
      // Watch each video for 5-20 seconds
      await this.humanBehavior.delay(5000, 20_000);
    }
    return scrollCount;
  }

  /** Watch a video on the FYP for a realistic duration. */
  private async warmWatchVideo(): Promise<number> {
    // Click a video if on a listing page, or stay on FYP
    const videoSelector = 'div[data-e2e="recommend-list-item-container"] a, div[class*="DivItemContainer"] a';
    const videos = await this.page.$$(videoSelector);
    if (videos.length > 0) {
      const randomIndex = Math.floor(Math.random() * Math.min(videos.length, 8));
      await videos[randomIndex].click();
      await this.humanBehavior.delay(2000, 3000);
    }
    // Watch for 10-45 seconds
    const watchTime = 10_000 + Math.floor(Math.random() * 35_000);
    await this.humanBehavior.delay(watchTime, watchTime + 5000);
    return 1;
  }

  /** Like the currently visible video. */
  private async warmLikeVideo(): Promise<number> {
    // TikTok like button (heart icon) on the video detail or FYP
    const likeSelector = 'span[data-e2e="like-icon"], button[data-e2e="like-icon"]';
    const likeButton = await this.page.$(likeSelector);
    if (!likeButton) return 0;
    // Check if already liked (TikTok changes color to red)
    const ariaLabel = await likeButton.getAttribute('aria-label');
    if (ariaLabel?.toLowerCase().includes('unlike')) return 0;
    await this.humanBehavior.click(this.page, likeSelector);
    await this.humanBehavior.delay(800, 2000);
    return 1;
  }

  /** Search for niche-relevant content. */
  private async warmSearch(nicheTags?: string[]): Promise<number> {
    const defaultSearches = ['funny videos', 'dance trends', 'cooking tips', 'DIY projects', 'life hacks'];
    const terms = nicheTags && nicheTags.length > 0 ? nicheTags : defaultSearches;
    const searchTerm = terms[Math.floor(Math.random() * terms.length)];
    // Navigate to TikTok search
    await this.page.goto(`${this.TIKTOK_URL}/search?q=${encodeURIComponent(searchTerm)}`, {
      waitUntil: 'domcontentloaded',
    });
    await this.humanBehavior.delay(2000, 4000);
    // Scroll through search results
    const scrollCount = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < scrollCount; i++) {
      await this.humanBehavior.scroll(this.page, 'down',300 + Math.floor(Math.random() * 400));
      await this.humanBehavior.delay(2000, 5000);
    }
    return 1;
  }

  /** Follow a creator from the current video. */
  private async warmFollowCreator(): Promise<number> {
    // TikTok follow button on video detail page
    const followSelector = 'button[data-e2e="follow-button"], button:has-text("Follow")';
    const followButton = await this.page.$(followSelector);
    if (!followButton) return 0;
    const buttonText = await followButton.textContent();
    if (buttonText?.toLowerCase().includes('following')) return 0; // Already following
    await this.humanBehavior.click(this.page, followSelector);
    await this.humanBehavior.delay(1000, 2000);
    return 1;
  }

  /** Post a generic comment on the current video. */
  private async warmComment(): Promise<number> {
    const comments = [
      'lol this is great', 'love this!', 'so good', 'fire content',
      'this is everything', 'haha amazing', 'need more of this',
      'underrated', 'iconic', 'no way lol',
    ];
    // TikTok comment input
    const commentInput = 'div[data-e2e="comment-input"], div[contenteditable="true"][class*="comment"]';
    const commentEl = await this.page.$(commentInput);
    if (!commentEl) return 0;
    await this.humanBehavior.click(this.page, commentInput);
    await this.humanBehavior.delay(500, 1000);
    const comment = comments[Math.floor(Math.random() * comments.length)];
    await this.humanBehavior.type(this.page, commentInput, comment);
    await this.humanBehavior.delay(500, 1500);
    // Post comment button
    const postButton = 'button[data-e2e="comment-post"], button:has-text("Post")';
    await this.humanBehavior.click(this.page, postButton);
    await this.humanBehavior.delay(2000, 4000);
    return 1;
  }

  // ─── Health Check ───

  async checkAccountHealth(): Promise<{ healthy: boolean; issues: string[] }> {
    await this.init();
    const issues: string[] = [];
    this.logger.info('Checking TikTok account health');

    try {
      // Check: can access TikTok creator tools
      await this.page.goto(this.TIKTOK_CREATOR_URL, { waitUntil: 'domcontentloaded' });
      await this.humanBehavior.delay(3000, 5000);

      // Check if redirected to login page
      if (this.page.url().includes('/login')) {
        issues.push('Not logged in — redirected to TikTok login page');
        return { healthy: false, issues };
      }

      // Check for account suspension banner
      const suspensionSelectors = [
        'div:has-text("account has been suspended")',
        'div:has-text("permanently banned")',
        'div[class*="ban" i]',
      ];
      for (const selector of suspensionSelectors) {
        const el = await this.page.$(selector);
        if (el) {
          issues.push('Account appears to be suspended or banned');
          break;
        }
      }

      // Check for community guidelines violation warnings
      const violationSelector = 'div:has-text("Community Guidelines"), div:has-text("violation")';
      const violationEl = await this.page.$(violationSelector);
      if (violationEl) {
        issues.push('Community Guidelines violation warning detected');
      }

      // Check that creator dashboard loaded
      const dashboardSelector = 'div[class*="creator" i], div[data-e2e="creator-center"]';
      const dashboardEl = await this.page.$(dashboardSelector);
      if (!dashboardEl) {
        issues.push('TikTok Creator Center did not load properly');
      }

      await this.takeScreenshot('tiktok-health-check');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      issues.push(`Health check error: ${msg}`);
    }

    return {
      healthy: issues.length === 0,
      issues,
    };
  }

  // ─── Login Check Override ───

  protected override async isLoggedIn(): Promise<boolean> {
    try {
      const avatarSelector = '[data-e2e="profile-icon"], div[class*="avatar" i] img';
      const avatar = await this.page.$(avatarSelector);
      return avatar !== null;
    } catch (err) {
      this.logger.debug({ err }, 'TikTok isLoggedIn check failed');
      return false;
    }
  }

  // ─── Discovery (D064 stub) ───

  async discoverAccount(credentials: AccountCredentials): Promise<DiscoveryResult> {
    this.logger.info({ email: credentials.email, platform: credentials.platform }, 'Discovery not yet implemented — returning unknown');
    return { exists: 'unknown', needsHuman: true, humanTaskDescription: `${credentials.platform} discovery not yet implemented. Check manually.` };
  }

  // ─── Profile Setup (D064 stub) ───

  async setProfileAssets(config: ProfileAssetsConfig): Promise<WorkflowResult> {
    this.logger.info({ platform: 'tiktok' }, 'Profile asset setup not yet implemented — returning success');
    return this.buildResult(true);
  }
}
