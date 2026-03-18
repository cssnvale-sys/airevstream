import type {
  AccountCredentials,
  WarmingConfig,
  WarmingSessionResult,
  WarmingActivity,
  WarmingActivityResult,
  WorkflowResult,
} from '../types';
import { BasePlatformWorkflow } from './base-workflow';

/**
 * Instagram account workflow.
 *
 * Handles login via instagram.com, account creation via signup page,
 * account warming (browsing explore, liking posts, viewing stories,
 * following accounts), and health checking via settings page.
 */
export class InstagramWorkflow extends BasePlatformWorkflow {
  private readonly INSTAGRAM_URL = 'https://www.instagram.com';
  private readonly INSTAGRAM_LOGIN_URL = 'https://www.instagram.com/accounts/login/';
  private readonly INSTAGRAM_SIGNUP_URL = 'https://www.instagram.com/accounts/emailsignup/';
  private readonly INSTAGRAM_SETTINGS_URL = 'https://www.instagram.com/accounts/edit/';

  // ─── Login ───

  async login(credentials: AccountCredentials): Promise<WorkflowResult> {
    await this.init();
    this.logger.info({ email: credentials.email }, 'Starting Instagram login');

    try {
      // Step 1: Navigate to Instagram login page
      const navStep = await this.executeStep('navigate-to-login', async () => {
        await this.page.goto(this.INSTAGRAM_LOGIN_URL, { waitUntil: 'domcontentloaded' });
        await this.dismissCookieDialog();
        await this.humanBehavior.delay(1500, 3000);
      });
      if (!navStep.success) return this.buildResult(false, navStep.error);

      // Step 2: Enter username/email
      const emailStep = await this.executeStep('enter-email', async () => {
        // Instagram username input field on the login form
        const emailInput = 'input[name="username"], input[aria-label="Phone number, username, or email"]';
        await this.page.waitForSelector(emailInput, { timeout: 10_000 });
        await this.humanBehavior.type(this.page, emailInput, credentials.email);
      });
      if (!emailStep.success) return this.buildResult(false, emailStep.error);

      // Step 3: Enter password
      const passwordStep = await this.executeStep('enter-password', async () => {
        // Instagram password input field
        const passwordInput = 'input[name="password"], input[aria-label="Password"]';
        await this.page.waitForSelector(passwordInput, { timeout: 10_000 });
        await this.humanBehavior.type(this.page, passwordInput, credentials.password);
      });
      if (!passwordStep.success) return this.buildResult(false, passwordStep.error);

      // Step 4: Check for CAPTCHA
      const captchaCheck = await this.handleCaptcha();
      if (captchaCheck.needsHuman) {
        return this.buildResult(false, 'CAPTCHA detected', true, captchaCheck.taskDescription);
      }

      // Step 5: Click Log In button
      const loginStep = await this.executeStep('click-login', async () => {
        // Instagram "Log in" submit button
        const loginButton = 'button[type="submit"], button:has-text("Log in"), button:has-text("Log In")';
        await this.humanBehavior.click(this.page, loginButton);
        await this.humanBehavior.delay(3000, 6000);
      });
      if (!loginStep.success) return this.buildResult(false, loginStep.error);

      // Step 6: Handle "Save Your Login Info" dialog
      const saveInfoStep = await this.executeStep('handle-save-login-dialog', async () => {
        // Instagram prompts "Save Your Login Info?" after successful login
        const saveButton = 'button:has-text("Save Info"), button:has-text("Save info")';
        const notNowButton = 'button:has-text("Not Now"), button:has-text("Not now")';
        const saveEl = await this.page.$(saveButton);
        const notNowEl = await this.page.$(notNowButton);
        if (saveEl) {
          await this.humanBehavior.click(this.page, saveButton);
          await this.humanBehavior.delay(1000, 2000);
        } else if (notNowEl) {
          await this.humanBehavior.click(this.page, notNowButton);
          await this.humanBehavior.delay(1000, 2000);
        }
      });
      // This step is optional — don't fail the whole workflow
      if (!saveInfoStep.success) {
        this.logger.debug('Save login info dialog not found — continuing');
      }

      // Step 7: Handle "Turn on Notifications" dialog
      const notifStep = await this.executeStep('handle-notifications-dialog', async () => {
        // Instagram asks to turn on notifications
        const notNowButton = 'button:has-text("Not Now"), button:has-text("Not now")';
        const notNowEl = await this.page.$(notNowButton);
        if (notNowEl) {
          await this.humanBehavior.click(this.page, notNowButton);
          await this.humanBehavior.delay(1000, 2000);
        }
      });
      if (!notifStep.success) {
        this.logger.debug('Notifications dialog not found — continuing');
      }

      // Step 8: Handle 2FA if prompted
      const twoFaStep = await this.executeStep('check-2fa', async () => {
        const twoFaSelectors = [
          'input[name="verificationCode"]',        // Instagram 2FA code input
          'input[name="security_code"]',            // Suspicious login code
          'input[aria-label*="Security Code" i]',   // Security code variant
        ];
        for (const selector of twoFaSelectors) {
          const el = await this.page.$(selector);
          if (el) {
            await this.takeScreenshot('instagram-2fa');
            throw new Error(`2FA_REQUIRED:${selector}`);
          }
        }
      });
      if (!twoFaStep.success && twoFaStep.error?.startsWith('2FA_REQUIRED')) {
        return this.buildResult(
          false,
          '2FA verification required',
          true,
          'Instagram requires two-factor authentication or suspicious login verification. Enter the security code to continue.',
        );
      }

      // Step 9: Verify logged in
      const verifyStep = await this.executeStep('verify-login', async () => {
        await this.page.goto(this.INSTAGRAM_URL, { waitUntil: 'domcontentloaded' });
        await this.humanBehavior.delay(2000, 4000);
        // Instagram nav bar profile link or avatar present when logged in
        const loggedInSelector = 'a[href*="/direct/inbox"], svg[aria-label="Home"], nav a[href*="/accounts/"]';
        await this.page.waitForSelector(loggedInSelector, { timeout: 15_000 });
        await this.takeScreenshot('instagram-login-success');
      });
      if (!verifyStep.success) return this.buildResult(false, 'Login verification failed — not logged in');

      return this.buildResult(true);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error({ error: msg }, 'Instagram login failed');
      await this.takeScreenshot('instagram-login-error');
      return this.buildResult(false, msg);
    }
  }

  // ─── Account Creation ───

  async createAccount(credentials: AccountCredentials): Promise<WorkflowResult> {
    await this.init();
    this.logger.info({ email: credentials.email }, 'Starting Instagram account creation');

    try {
      // Step 1: Navigate to signup page
      const navStep = await this.executeStep('navigate-to-signup', async () => {
        await this.page.goto(this.INSTAGRAM_SIGNUP_URL, { waitUntil: 'domcontentloaded' });
        await this.dismissCookieDialog();
        await this.humanBehavior.delay(1500, 3000);
      });
      if (!navStep.success) return this.buildResult(false, navStep.error);

      // Step 2: Enter email address
      const emailStep = await this.executeStep('enter-email', async () => {
        // Instagram signup email field
        const emailInput = 'input[name="emailOrPhone"], input[aria-label="Mobile Number or Email"]';
        await this.page.waitForSelector(emailInput, { timeout: 10_000 });
        await this.humanBehavior.type(this.page, emailInput, credentials.email);
      });
      if (!emailStep.success) return this.buildResult(false, emailStep.error);

      // Step 3: Enter full name
      const nameStep = await this.executeStep('enter-fullname', async () => {
        // Instagram "Full Name" field
        const nameInput = 'input[name="fullName"], input[aria-label="Full Name"]';
        await this.page.waitForSelector(nameInput, { timeout: 10_000 });
        const fullName = this.deriveFullName(credentials.email);
        await this.humanBehavior.type(this.page, nameInput, fullName);
      });
      if (!nameStep.success) return this.buildResult(false, nameStep.error);

      // Step 4: Enter username
      const usernameStep = await this.executeStep('enter-username', async () => {
        // Instagram "Username" field
        const usernameInput = 'input[name="username"], input[aria-label="Username"]';
        await this.page.waitForSelector(usernameInput, { timeout: 10_000 });
        const username = credentials.email.split('@')[0].replace(/[^a-zA-Z0-9_.]/g, '');
        await this.humanBehavior.type(this.page, usernameInput, username);
      });
      if (!usernameStep.success) return this.buildResult(false, usernameStep.error);

      // Step 5: Enter password
      const passwordStep = await this.executeStep('enter-password', async () => {
        // Instagram "Password" field
        const passwordInput = 'input[name="password"], input[aria-label="Password"]';
        await this.page.waitForSelector(passwordInput, { timeout: 10_000 });
        await this.humanBehavior.type(this.page, passwordInput, credentials.password);
      });
      if (!passwordStep.success) return this.buildResult(false, passwordStep.error);

      // Step 6: Click Sign Up button
      const signupStep = await this.executeStep('click-signup', async () => {
        const signupButton = 'button[type="submit"], button:has-text("Sign up"), button:has-text("Sign Up")';
        await this.humanBehavior.click(this.page, signupButton);
        await this.humanBehavior.delay(3000, 6000);
      });
      if (!signupStep.success) return this.buildResult(false, signupStep.error);

      // Step 7: Handle CAPTCHA
      const captchaCheck = await this.handleCaptcha();
      if (captchaCheck.needsHuman) {
        return this.buildResult(false, 'CAPTCHA detected during signup', true, captchaCheck.taskDescription);
      }

      // Step 8: Birthdate entry
      const birthdateStep = await this.executeStep('enter-birthdate', async () => {
        // Instagram asks for birthday after initial signup form
        const monthSelect = 'select[title="Month:"], select[aria-label*="Month"]';
        const daySelect = 'select[title="Day:"], select[aria-label*="Day"]';
        const yearSelect = 'select[title="Year:"], select[aria-label*="Year"]';

        const monthEl = await this.page.$(monthSelect);
        if (monthEl) {
          await this.page.selectOption(monthSelect, { index: Math.floor(Math.random() * 12) + 1 });
          await this.humanBehavior.delay(300, 600);
          await this.page.selectOption(daySelect, { index: Math.floor(Math.random() * 28) + 1 });
          await this.humanBehavior.delay(300, 600);
          const currentYear = new Date().getFullYear();
          const birthYear = currentYear - 20 - Math.floor(Math.random() * 10);
          await this.page.selectOption(yearSelect, { value: String(birthYear) });
          await this.humanBehavior.delay(500, 1000);
          // Click Next button on birthday page
          const nextButton = 'button:has-text("Next"), button:has-text("Submit")';
          await this.humanBehavior.click(this.page, nextButton);
          await this.humanBehavior.delay(2000, 4000);
        }
      });
      if (!birthdateStep.success) return this.buildResult(false, birthdateStep.error);

      // Step 9: Email/phone verification (mark as needs-human)
      const verificationStep = await this.executeStep('email-verification', async () => {
        // Instagram sends a confirmation code to the email
        const codeInput = 'input[name="email_confirmation_code"], input[aria-label*="Confirmation Code" i]';
        const codeEl = await this.page.$(codeInput);
        if (codeEl) {
          await this.takeScreenshot('instagram-verification-required');
          throw new Error('EMAIL_VERIFICATION_REQUIRED');
        }
      });
      if (!verificationStep.success && verificationStep.error === 'EMAIL_VERIFICATION_REQUIRED') {
        return this.buildResult(
          false,
          'Email confirmation code required',
          true,
          'Instagram sent a confirmation code to the email. Enter the code to complete account creation.',
        );
      }

      // Step 10: Verify account created
      const verifyStep = await this.executeStep('verify-account', async () => {
        await this.page.goto(this.INSTAGRAM_URL, { waitUntil: 'domcontentloaded' });
        await this.humanBehavior.delay(2000, 4000);
        // Dismiss any post-signup dialogs
        const skipButtons = [
          'button:has-text("Not Now")',
          'button:has-text("Skip")',
        ];
        for (const selector of skipButtons) {
          const el = await this.page.$(selector);
          if (el) {
            await this.humanBehavior.click(this.page, selector);
            await this.humanBehavior.delay(1000, 2000);
          }
        }
        const loggedInSelector = 'svg[aria-label="Home"], nav a[href*="/accounts/"]';
        await this.page.waitForSelector(loggedInSelector, { timeout: 15_000 });
        await this.takeScreenshot('instagram-account-created');
      });
      if (!verifyStep.success) return this.buildResult(false, 'Account creation verification failed');

      return this.buildResult(true);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error({ error: msg }, 'Instagram account creation failed');
      await this.takeScreenshot('instagram-create-error');
      return this.buildResult(false, msg);
    }
  }

  // ─── Account Warming ───

  async warmAccount(config: WarmingConfig): Promise<WarmingSessionResult> {
    await this.init();
    this.logger.info({ config }, 'Starting Instagram account warming');

    const activityResults: WarmingActivityResult[] = [];
    const startTime = Date.now();
    const durationMs = config.durationMinutes * 60 * 1000;
    let flagged = false;

    try {
      await this.page.goto(this.INSTAGRAM_URL, { waitUntil: 'domcontentloaded' });
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
          this.logger.warn({ activity, error }, 'Instagram warming activity failed');
          // Check for action block — Instagram throttles aggressively
          const actionBlocked = await this.checkActionBlock();
          if (actionBlocked) {
            flagged = true;
            this.logger.warn('Action block detected — stopping warming session');
            break;
          }
          const failCount = activityResults.filter((r) => r.count === 0).length;
          if (failCount > 5) {
            flagged = true;
            break;
          }
        }

        const delayMap = { low: [10_000, 20_000], medium: [5000, 12_000], high: [3000, 8000] } as const;
        const [min, max] = delayMap[config.intensity];
        await this.humanBehavior.delay(min, max);
      }
    } catch (error) {
      this.logger.error({ error }, 'Instagram warming session failed');
      flagged = true;
    }

    const screenshot = await this.takeScreenshot('instagram-warming-complete');

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
        return await this.warmBrowseExplore();
      case 'like':
        return await this.warmLikePost();
      case 'follow':
        return await this.warmFollowAccount();
      case 'search':
        return await this.warmSearch(config.nicheTags);
      case 'watch':
        return await this.warmViewStories();
      case 'comment':
        return await this.warmComment();
      default:
        return 0;
    }
  }

  /** Browse the Instagram Explore page. */
  private async warmBrowseExplore(): Promise<number> {
    await this.page.goto(`${this.INSTAGRAM_URL}/explore/`, { waitUntil: 'domcontentloaded' });
    await this.humanBehavior.delay(2000, 4000);
    const scrollCount = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < scrollCount; i++) {
      await this.humanBehavior.scroll(this.page, 'down',400 + Math.floor(Math.random() * 400));
      await this.humanBehavior.delay(2000, 5000);
    }
    // Occasionally click on a post to view it
    if (Math.random() > 0.5) {
      const postSelector = 'article a[href*="/p/"], div[class*="explore"] a[href*="/p/"]';
      const posts = await this.page.$$(postSelector);
      if (posts.length > 0) {
        const idx = Math.floor(Math.random() * Math.min(posts.length, 12));
        await posts[idx].click();
        await this.humanBehavior.delay(3000, 8000);
        // Close the post modal by pressing Escape
        await this.page.keyboard.press('Escape');
        await this.humanBehavior.delay(500, 1000);
      }
    }
    return scrollCount;
  }

  /** Like a post on the feed or explore page. */
  private async warmLikePost(): Promise<number> {
    // Instagram like button (heart SVG) on post detail or feed
    const likeSelector = 'svg[aria-label="Like"], span[class*="like"] button, button svg[aria-label="Like"]';
    const likeButtons = await this.page.$$(likeSelector);
    if (likeButtons.length === 0) return 0;
    // Like the first unliked post
    const randomIdx = Math.floor(Math.random() * Math.min(likeButtons.length, 5));
    await likeButtons[randomIdx].click();
    await this.humanBehavior.delay(800, 2000);
    return 1;
  }

  /** Follow an account from a post or profile. */
  private async warmFollowAccount(): Promise<number> {
    // Instagram follow button on a post or profile
    const followSelector = 'button:has-text("Follow"):not(:has-text("Following")), header button:has-text("Follow")';
    const followButtons = await this.page.$$(followSelector);
    if (followButtons.length === 0) return 0;
    const idx = Math.floor(Math.random() * Math.min(followButtons.length, 3));
    const buttonText = await followButtons[idx].textContent();
    if (buttonText?.includes('Following')) return 0;
    await followButtons[idx].click();
    await this.humanBehavior.delay(1000, 3000);
    return 1;
  }

  /** Search for niche-relevant content. */
  private async warmSearch(nicheTags?: string[]): Promise<number> {
    const defaultSearches = ['photography', 'fitness', 'travel', 'food', 'fashion', 'art'];
    const terms = nicheTags && nicheTags.length > 0 ? nicheTags : defaultSearches;
    const searchTerm = terms[Math.floor(Math.random() * terms.length)];
    // Click the search/explore icon in the nav
    const searchNav = 'a[href="/explore/"], svg[aria-label="Search"]';
    const searchEl = await this.page.$(searchNav);
    if (searchEl) {
      await this.humanBehavior.click(this.page, searchNav);
      await this.humanBehavior.delay(1000, 2000);
    }
    // Type into the search input
    const searchInput = 'input[aria-label="Search input"], input[placeholder="Search"]';
    const inputEl = await this.page.$(searchInput);
    if (inputEl) {
      await this.humanBehavior.type(this.page, searchInput, searchTerm);
      await this.humanBehavior.delay(1500, 3000);
      // Click the first search result
      const resultSelector = 'a[href*="/explore/tags/"], a[class*="search-result"]';
      const results = await this.page.$$(resultSelector);
      if (results.length > 0) {
        await results[0].click();
        await this.humanBehavior.delay(2000, 4000);
      }
    }
    return 1;
  }

  /** View stories from the feed. */
  private async warmViewStories(): Promise<number> {
    await this.page.goto(this.INSTAGRAM_URL, { waitUntil: 'domcontentloaded' });
    await this.humanBehavior.delay(2000, 4000);
    // Instagram stories appear in the top row of the feed as circular avatars
    const storySelector = 'div[role="button"] canvas, button[class*="story"], div[class*="stories"] button';
    const stories = await this.page.$$(storySelector);
    if (stories.length === 0) return 0;
    // Click first available story
    await stories[0].click();
    await this.humanBehavior.delay(3000, 5000);
    // Watch 2-5 stories by clicking to advance
    const storyCount = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < storyCount; i++) {
      // Click right side of story to advance, or press right arrow
      await this.page.keyboard.press('ArrowRight');
      await this.humanBehavior.delay(3000, 7000);
    }
    // Close story viewer
    const closeSelector = 'button[aria-label="Close"], svg[aria-label="Close"]';
    const closeEl = await this.page.$(closeSelector);
    if (closeEl) {
      await this.humanBehavior.click(this.page, closeSelector);
    } else {
      await this.page.keyboard.press('Escape');
    }
    await this.humanBehavior.delay(1000, 2000);
    return storyCount;
  }

  /** Post a generic comment on a post. */
  private async warmComment(): Promise<number> {
    const comments = [
      'Love this!', 'Beautiful!', 'So inspiring', 'Amazing shot!',
      'Great content!', 'Wow!', 'This is stunning', 'Gorgeous!',
      'Absolutely love it', 'Incredible!',
    ];
    // Instagram comment input (textarea or contenteditable)
    const commentInput = 'textarea[aria-label="Add a comment…"], form textarea[placeholder*="comment" i]';
    const commentEl = await this.page.$(commentInput);
    if (!commentEl) return 0;
    await this.humanBehavior.click(this.page, commentInput);
    await this.humanBehavior.delay(500, 1000);
    const comment = comments[Math.floor(Math.random() * comments.length)];
    await this.humanBehavior.type(this.page, commentInput, comment);
    await this.humanBehavior.delay(500, 1500);
    // Submit comment via Post button or Enter
    const postButton = 'button:has-text("Post"), div[role="button"]:has-text("Post")';
    const postEl = await this.page.$(postButton);
    if (postEl) {
      await this.humanBehavior.click(this.page, postButton);
    } else {
      await this.page.keyboard.press('Enter');
    }
    await this.humanBehavior.delay(2000, 4000);
    return 1;
  }

  // ─── Health Check ───

  async checkAccountHealth(): Promise<{ healthy: boolean; issues: string[] }> {
    await this.init();
    const issues: string[] = [];
    this.logger.info('Checking Instagram account health');

    try {
      // Check: can access Instagram settings
      await this.page.goto(this.INSTAGRAM_SETTINGS_URL, { waitUntil: 'domcontentloaded' });
      await this.humanBehavior.delay(3000, 5000);

      // Check if redirected to login page
      if (this.page.url().includes('/accounts/login')) {
        issues.push('Not logged in — redirected to Instagram login page');
        return { healthy: false, issues };
      }

      // Check for action block dialog
      const actionBlocked = await this.checkActionBlock();
      if (actionBlocked) {
        issues.push('Account is currently action-blocked by Instagram');
      }

      // Check for account disabled/suspended notice
      const disabledSelectors = [
        'div:has-text("account has been disabled")',
        'div:has-text("Your account has been suspended")',
        'div:has-text("We suspended your account")',
      ];
      for (const selector of disabledSelectors) {
        const el = await this.page.$(selector);
        if (el) {
          issues.push('Account appears to be disabled or suspended');
          break;
        }
      }

      // Check that the settings page loaded (profile edit form)
      const settingsSelector = 'form[class*="edit"], input[name="username"], section[class*="settings"]';
      const settingsEl = await this.page.$(settingsSelector);
      if (!settingsEl) {
        issues.push('Instagram settings page did not load properly');
      }

      await this.takeScreenshot('instagram-health-check');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      issues.push(`Health check error: ${msg}`);
    }

    return {
      healthy: issues.length === 0,
      issues,
    };
  }

  // ─── Instagram-Specific Helpers ───

  /**
   * Check if Instagram has applied an action block to the account.
   * Action blocks prevent liking, commenting, and following.
   */
  private async checkActionBlock(): Promise<boolean> {
    const blockSelectors = [
      'div:has-text("Action Blocked")',
      'div:has-text("Try Again Later")',
      'div:has-text("We restrict certain activity")',
      'div[role="dialog"]:has-text("blocked")',
    ];
    for (const selector of blockSelectors) {
      const el = await this.page.$(selector);
      if (el) return true;
    }
    return false;
  }

  protected override async isLoggedIn(): Promise<boolean> {
    try {
      const loggedInSelector = 'svg[aria-label="Home"], a[href*="/direct/inbox"]';
      const el = await this.page.$(loggedInSelector);
      return el !== null;
    } catch {
      return false;
    }
  }

  /**
   * Derive a plausible full name from an email address.
   */
  private deriveFullName(email: string): string {
    const local = email.split('@')[0];
    const parts = local.split(/[._-]/);
    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    if (parts.length >= 2) {
      return `${capitalize(parts[0])} ${capitalize(parts[1])}`;
    }
    return capitalize(local);
  }
}
