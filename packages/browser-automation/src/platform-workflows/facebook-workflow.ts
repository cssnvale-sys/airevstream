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
 * Facebook account workflow.
 *
 * Handles login via facebook.com, account creation via the registration page,
 * account warming (browsing feed, liking posts, joining groups),
 * and health checking via the settings page.
 */
export class FacebookWorkflow extends BasePlatformWorkflow {
  private readonly FACEBOOK_URL = 'https://www.facebook.com';
  private readonly FACEBOOK_LOGIN_URL = 'https://www.facebook.com/login';
  private readonly FACEBOOK_SIGNUP_URL = 'https://www.facebook.com/r.php';
  private readonly FACEBOOK_SETTINGS_URL = 'https://www.facebook.com/settings';

  // ─── Login ───

  async login(credentials: AccountCredentials): Promise<WorkflowResult> {
    await this.init();
    this.logger.info({ email: credentials.email }, 'Starting Facebook login');

    try {
      // Step 1: Navigate to Facebook login page
      const navStep = await this.executeStep('navigate-to-login', async () => {
        await this.page.goto(this.FACEBOOK_LOGIN_URL, { waitUntil: 'domcontentloaded' });
        await this.dismissCookieDialog();
        await this.humanBehavior.delay(1500, 3000);
      });
      if (!navStep.success) return this.buildResult(false, navStep.error);

      // Step 2: Enter email
      const emailStep = await this.executeStep('enter-email', async () => {
        // Facebook email/phone input field
        const emailInput = 'input#email, input[name="email"]';
        await this.page.waitForSelector(emailInput, { timeout: 10_000 });
        await this.humanBehavior.type(this.page, emailInput, credentials.email);
      });
      if (!emailStep.success) return this.buildResult(false, emailStep.error);

      // Step 3: Enter password
      const passwordStep = await this.executeStep('enter-password', async () => {
        // Facebook password input field
        const passwordInput = 'input#pass, input[name="pass"]';
        await this.page.waitForSelector(passwordInput, { timeout: 10_000 });
        await this.humanBehavior.type(this.page, passwordInput, credentials.password);
      });
      if (!passwordStep.success) return this.buildResult(false, passwordStep.error);

      // Step 4: Click Log In button
      const loginStep = await this.executeStep('click-login', async () => {
        // Facebook "Log In" button
        const loginButton = 'button[name="login"], button[data-testid="royal_login_button"], button#loginbutton';
        await this.humanBehavior.click(this.page, loginButton);
        await this.humanBehavior.delay(3000, 6000);
      });
      if (!loginStep.success) return this.buildResult(false, loginStep.error);

      // Step 5: Handle CAPTCHA
      const captchaCheck = await this.handleCaptcha();
      if (captchaCheck.needsHuman) {
        return this.buildResult(false, 'CAPTCHA detected', true, captchaCheck.taskDescription);
      }

      // Step 6: Handle checkpoint / security check (Facebook "Is this you?" prompt)
      const checkpointStep = await this.executeStep('handle-checkpoint', async () => {
        const checkpointSelectors = [
          'div[id="checkpoint"]',                         // Facebook checkpoint page
          'form[action*="checkpoint"]',                   // Checkpoint form
          'input[name="approvals_code"]',                 // Code approval
          'div:has-text("Check your email")',             // Email verification prompt
          'div:has-text("Confirm your identity")',        // Identity confirmation
        ];
        for (const selector of checkpointSelectors) {
          const el = await this.page.$(selector);
          if (el) {
            await this.takeScreenshot('facebook-checkpoint');
            throw new Error(`CHECKPOINT_REQUIRED:${selector}`);
          }
        }
      });
      if (!checkpointStep.success && checkpointStep.error?.startsWith('CHECKPOINT_REQUIRED')) {
        return this.buildResult(
          false,
          'Facebook security checkpoint triggered',
          true,
          'Facebook requires identity verification or security check. Complete the checkpoint in the browser to continue.',
        );
      }

      // Step 7: Handle 2FA if prompted
      const twoFaStep = await this.executeStep('check-2fa', async () => {
        const twoFaSelectors = [
          'input[name="approvals_code"]',                // Facebook 2FA code input
          'input[id="approvals_code"]',                  // Alt 2FA code input
          'div:has-text("Enter the code")',              // Code prompt
        ];
        for (const selector of twoFaSelectors) {
          const el = await this.page.$(selector);
          if (el) {
            await this.takeScreenshot('facebook-2fa');
            throw new Error(`2FA_REQUIRED:${selector}`);
          }
        }
      });
      if (!twoFaStep.success && twoFaStep.error?.startsWith('2FA_REQUIRED')) {
        return this.buildResult(
          false,
          '2FA verification required',
          true,
          'Facebook requires two-factor authentication. Enter the code from your authenticator app or SMS.',
        );
      }

      // Step 8: Handle "Save browser" / "Remember this device" prompt
      const saveBrowserStep = await this.executeStep('handle-save-browser', async () => {
        const saveBrowserButton = 'button:has-text("Continue"), button[name="save_device"]';
        const notNowButton = 'button:has-text("Not Now"), a:has-text("Not Now")';
        const saveEl = await this.page.$(saveBrowserButton);
        const notNowEl = await this.page.$(notNowButton);
        if (saveEl) {
          await this.humanBehavior.click(this.page, saveBrowserButton);
          await this.humanBehavior.delay(1000, 2000);
        } else if (notNowEl) {
          await this.humanBehavior.click(this.page, notNowButton);
          await this.humanBehavior.delay(1000, 2000);
        }
      });
      if (!saveBrowserStep.success) {
        this.logger.debug('Save browser dialog not found — continuing');
      }

      // Step 9: Verify logged in
      const verifyStep = await this.executeStep('verify-login', async () => {
        await this.page.goto(this.FACEBOOK_URL, { waitUntil: 'domcontentloaded' });
        await this.humanBehavior.delay(2000, 4000);
        // Facebook nav bar elements present when logged in
        const loggedInSelector = 'div[role="navigation"] a[href*="/me"], a[aria-label="Facebook"], div[aria-label="Account"]';
        await this.page.waitForSelector(loggedInSelector, { timeout: 15_000 });
        await this.takeScreenshot('facebook-login-success');
      });
      if (!verifyStep.success) return this.buildResult(false, 'Login verification failed — not logged in');

      return this.buildResult(true);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error({ error: msg }, 'Facebook login failed');
      await this.takeScreenshot('facebook-login-error');
      return this.buildResult(false, msg);
    }
  }

  // ─── Account Creation ───

  async createAccount(credentials: AccountCredentials): Promise<WorkflowResult> {
    await this.init();
    this.logger.info({ email: credentials.email }, 'Starting Facebook account creation');

    try {
      // Step 1: Navigate to Facebook registration page
      const navStep = await this.executeStep('navigate-to-signup', async () => {
        await this.page.goto(this.FACEBOOK_SIGNUP_URL, { waitUntil: 'domcontentloaded' });
        await this.dismissCookieDialog();
        await this.humanBehavior.delay(1500, 3000);
      });
      if (!navStep.success) return this.buildResult(false, navStep.error);

      // Step 2: Fill first name
      const firstNameStep = await this.executeStep('fill-first-name', async () => {
        // Facebook registration — first name field
        const firstNameInput = 'input[name="firstname"], input[aria-label="First name"]';
        await this.page.waitForSelector(firstNameInput, { timeout: 10_000 });
        const [firstName] = this.splitEmail(credentials.email);
        await this.humanBehavior.type(this.page, firstNameInput, firstName);
      });
      if (!firstNameStep.success) return this.buildResult(false, firstNameStep.error);

      // Step 3: Fill last name
      const lastNameStep = await this.executeStep('fill-last-name', async () => {
        // Facebook registration — last name field
        const lastNameInput = 'input[name="lastname"], input[aria-label="Last name"]';
        await this.page.waitForSelector(lastNameInput, { timeout: 10_000 });
        const [, lastName] = this.splitEmail(credentials.email);
        await this.humanBehavior.type(this.page, lastNameInput, lastName);
      });
      if (!lastNameStep.success) return this.buildResult(false, lastNameStep.error);

      // Step 4: Fill email or phone
      const emailStep = await this.executeStep('fill-email', async () => {
        // Facebook registration — email or mobile number field
        const emailInput = 'input[name="reg_email__"], input[aria-label="Mobile number or email address"]';
        await this.page.waitForSelector(emailInput, { timeout: 10_000 });
        await this.humanBehavior.type(this.page, emailInput, credentials.email);
        await this.humanBehavior.delay(500, 1000);
        // Facebook may ask to re-enter email
        const confirmEmailInput = 'input[name="reg_email_confirmation__"], input[aria-label="Re-enter email address"]';
        const confirmEl = await this.page.$(confirmEmailInput);
        if (confirmEl) {
          await this.humanBehavior.type(this.page, confirmEmailInput, credentials.email);
        }
      });
      if (!emailStep.success) return this.buildResult(false, emailStep.error);

      // Step 5: Fill password
      const passwordStep = await this.executeStep('fill-password', async () => {
        // Facebook registration — password field
        const passwordInput = 'input[name="reg_passwd__"], input[aria-label="New password"], input[id="password_step_input"]';
        await this.page.waitForSelector(passwordInput, { timeout: 10_000 });
        await this.humanBehavior.type(this.page, passwordInput, credentials.password);
      });
      if (!passwordStep.success) return this.buildResult(false, passwordStep.error);

      // Step 6: Set birthdate
      const birthdateStep = await this.executeStep('set-birthdate', async () => {
        // Facebook registration birthday selectors
        const monthSelect = 'select[name="birthday_month"], select[id="month"]';
        const daySelect = 'select[name="birthday_day"], select[id="day"]';
        const yearSelect = 'select[name="birthday_year"], select[id="year"]';

        await this.page.waitForSelector(monthSelect, { timeout: 10_000 });
        const randomMonth = Math.floor(Math.random() * 12) + 1;
        await this.page.selectOption(monthSelect, { value: String(randomMonth) });
        await this.humanBehavior.delay(300, 600);

        const randomDay = Math.floor(Math.random() * 28) + 1;
        await this.page.selectOption(daySelect, { value: String(randomDay) });
        await this.humanBehavior.delay(300, 600);

        const currentYear = new Date().getFullYear();
        const birthYear = currentYear - 22 - Math.floor(Math.random() * 15);
        await this.page.selectOption(yearSelect, { value: String(birthYear) });
        await this.humanBehavior.delay(300, 600);
      });
      if (!birthdateStep.success) return this.buildResult(false, birthdateStep.error);

      // Step 7: Select gender
      const genderStep = await this.executeStep('select-gender', async () => {
        // Facebook registration gender radio buttons
        const genderOptions = [
          'input[name="sex"][value="2"]',   // Female
          'input[name="sex"][value="1"]',   // Male
        ];
        const selected = genderOptions[Math.floor(Math.random() * genderOptions.length)];
        const genderEl = await this.page.$(selected);
        if (genderEl) {
          await this.humanBehavior.click(this.page, selected);
          await this.humanBehavior.delay(300, 600);
        }
      });
      if (!genderStep.success) return this.buildResult(false, genderStep.error);

      // Step 8: Click Sign Up
      const signupStep = await this.executeStep('click-signup', async () => {
        const signupButton = 'button[name="websubmit"], button[type="submit"], button:has-text("Sign Up")';
        await this.humanBehavior.click(this.page, signupButton);
        await this.humanBehavior.delay(4000, 8000);
      });
      if (!signupStep.success) return this.buildResult(false, signupStep.error);

      // Step 9: Handle CAPTCHA
      const captchaCheck = await this.handleCaptcha();
      if (captchaCheck.needsHuman) {
        return this.buildResult(false, 'CAPTCHA detected during signup', true, captchaCheck.taskDescription);
      }

      // Step 10: Email verification (mark as needs-human)
      const verificationStep = await this.executeStep('email-verification', async () => {
        const codeInput = 'input[name="code"], input[id="code_in_cliff"]';
        const codeEl = await this.page.$(codeInput);
        if (codeEl) {
          await this.takeScreenshot('facebook-verification-required');
          throw new Error('EMAIL_VERIFICATION_REQUIRED');
        }
        // Check for phone verification prompt
        const phonePrompt = 'input[name="reg_instance_phone_number"], div:has-text("Enter your phone number")';
        const phoneEl = await this.page.$(phonePrompt);
        if (phoneEl) {
          await this.takeScreenshot('facebook-phone-verification');
          throw new Error('PHONE_VERIFICATION_REQUIRED');
        }
      });
      if (!verificationStep.success) {
        if (verificationStep.error === 'EMAIL_VERIFICATION_REQUIRED') {
          return this.buildResult(
            false,
            'Email verification code required',
            true,
            'Facebook sent a confirmation code to the email address. Enter the code to complete account creation.',
          );
        }
        if (verificationStep.error === 'PHONE_VERIFICATION_REQUIRED') {
          return this.buildResult(
            false,
            'Phone verification required',
            true,
            'Facebook requires phone number verification. Provide a phone number and enter the SMS code.',
          );
        }
        return this.buildResult(false, verificationStep.error);
      }

      // Step 11: Verify account created
      const verifyStep = await this.executeStep('verify-account', async () => {
        await this.page.goto(this.FACEBOOK_URL, { waitUntil: 'domcontentloaded' });
        await this.humanBehavior.delay(2000, 4000);
        // Skip any onboarding prompts
        const skipButtons = [
          'button:has-text("Skip")',
          'a:has-text("Skip")',
          'button:has-text("Not Now")',
        ];
        for (const selector of skipButtons) {
          const el = await this.page.$(selector);
          if (el) {
            await this.humanBehavior.click(this.page, selector);
            await this.humanBehavior.delay(1000, 2000);
          }
        }
        const loggedInSelector = 'div[role="navigation"] a[href*="/me"], div[aria-label="Account"]';
        await this.page.waitForSelector(loggedInSelector, { timeout: 15_000 });
        await this.takeScreenshot('facebook-account-created');
      });
      if (!verifyStep.success) return this.buildResult(false, 'Account creation verification failed');

      return this.buildResult(true);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error({ error: msg }, 'Facebook account creation failed');
      await this.takeScreenshot('facebook-create-error');
      return this.buildResult(false, msg);
    }
  }

  // ─── Account Warming ───

  async warmAccount(config: WarmingConfig): Promise<WarmingSessionResult> {
    await this.init();
    this.logger.info({ config }, 'Starting Facebook account warming');

    const activityResults: WarmingActivityResult[] = [];
    const startTime = Date.now();
    const durationMs = config.durationMinutes * 60 * 1000;
    let flagged = false;

    try {
      await this.page.goto(this.FACEBOOK_URL, { waitUntil: 'domcontentloaded' });
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
          this.logger.warn({ activity, error }, 'Facebook warming activity failed');
          // Check for restriction dialog
          const restricted = await this.checkRestriction();
          if (restricted) {
            flagged = true;
            this.logger.warn('Account restriction detected — stopping warming session');
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
      this.logger.error({ error }, 'Facebook warming session failed');
      flagged = true;
    }

    const screenshot = await this.takeScreenshot('facebook-warming-complete');

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
        return await this.warmBrowseFeed();
      case 'like':
        return await this.warmLikePost();
      case 'search':
        return await this.warmSearch(config.nicheTags);
      case 'follow':
        return await this.warmJoinGroup(config.nicheTags);
      case 'watch':
        return await this.warmWatchVideo();
      case 'comment':
        return await this.warmComment();
      default:
        return 0;
    }
  }

  /** Browse the Facebook News Feed by scrolling. */
  private async warmBrowseFeed(): Promise<number> {
    await this.page.goto(this.FACEBOOK_URL, { waitUntil: 'domcontentloaded' });
    await this.humanBehavior.delay(2000, 4000);
    const scrollCount = 4 + Math.floor(Math.random() * 5);
    for (let i = 0; i < scrollCount; i++) {
      await this.humanBehavior.scroll(this.page, 'down',400 + Math.floor(Math.random() * 500));
      // Pause to "read" each section of the feed
      await this.humanBehavior.delay(3000, 8000);
    }
    return scrollCount;
  }

  /** Like a post in the news feed. */
  private async warmLikePost(): Promise<number> {
    // Facebook Like button — the reaction button on feed posts
    const likeSelectors = [
      'div[aria-label="Like"][role="button"]',          // Like button on posts
      'span[data-testid="UFI2ReactionLink"]',           // Older reaction link
      'div[class*="reaction"] span:has-text("Like")',   // Newer reaction element
    ];
    for (const selector of likeSelectors) {
      const likeButtons = await this.page.$$(selector);
      if (likeButtons.length > 0) {
        // Pick a random like button from visible ones
        const idx = Math.floor(Math.random() * Math.min(likeButtons.length, 5));
        await likeButtons[idx].click();
        await this.humanBehavior.delay(800, 2000);
        return 1;
      }
    }
    return 0;
  }

  /** Search for content or pages. */
  private async warmSearch(nicheTags?: string[]): Promise<number> {
    const defaultSearches = ['news', 'recipes', 'technology', 'sports highlights', 'community events'];
    const terms = nicheTags && nicheTags.length > 0 ? nicheTags : defaultSearches;
    const searchTerm = terms[Math.floor(Math.random() * terms.length)];
    // Facebook search input in the top navigation bar
    const searchInput = 'input[type="search"], input[aria-label="Search Facebook"], input[placeholder="Search Facebook"]';
    const searchEl = await this.page.$(searchInput);
    if (searchEl) {
      await this.humanBehavior.click(this.page, searchInput);
      await this.humanBehavior.delay(500, 1000);
      await this.humanBehavior.type(this.page, searchInput, searchTerm);
      await this.humanBehavior.delay(500, 1000);
      await this.page.keyboard.press('Enter');
      await this.humanBehavior.delay(3000, 5000);
      // Scroll through results
      const scrollCount = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < scrollCount; i++) {
        await this.humanBehavior.scroll(this.page, 'down',300 + Math.floor(Math.random() * 400));
        await this.humanBehavior.delay(2000, 4000);
      }
      return 1;
    }
    return 0;
  }

  /** Join a public group related to the niche. */
  private async warmJoinGroup(nicheTags?: string[]): Promise<number> {
    const defaultTopics = ['cooking', 'technology', 'photography', 'gardening', 'fitness'];
    const terms = nicheTags && nicheTags.length > 0 ? nicheTags : defaultTopics;
    const topic = terms[Math.floor(Math.random() * terms.length)];
    // Navigate to groups search
    await this.page.goto(`${this.FACEBOOK_URL}/search/groups/?q=${encodeURIComponent(topic)}`, {
      waitUntil: 'domcontentloaded',
    });
    await this.humanBehavior.delay(3000, 5000);
    // Find and click "Join" on a public group
    const joinButton = 'div[aria-label="Join group"], a:has-text("Join"), div[role="button"]:has-text("Join Group")';
    const joinButtons = await this.page.$$(joinButton);
    if (joinButtons.length > 0) {
      const idx = Math.floor(Math.random() * Math.min(joinButtons.length, 3));
      await joinButtons[idx].click();
      await this.humanBehavior.delay(2000, 4000);
      return 1;
    }
    return 0;
  }

  /** Watch a video on Facebook Watch. */
  private async warmWatchVideo(): Promise<number> {
    await this.page.goto(`${this.FACEBOOK_URL}/watch/`, { waitUntil: 'domcontentloaded' });
    await this.humanBehavior.delay(2000, 4000);
    // Click on a video in the Watch feed
    const videoSelector = 'div[data-pagelet*="video"] a, a[href*="/watch/"]';
    const videos = await this.page.$$(videoSelector);
    if (videos.length > 0) {
      const idx = Math.floor(Math.random() * Math.min(videos.length, 6));
      await videos[idx].click();
      await this.humanBehavior.delay(3000, 5000);
      // Watch for 15-60 seconds
      const watchTime = 15_000 + Math.floor(Math.random() * 45_000);
      await this.humanBehavior.delay(watchTime, watchTime + 5000);
      return 1;
    }
    // Fallback: scroll through Watch feed
    await this.humanBehavior.scroll(this.page, 'down',500);
    await this.humanBehavior.delay(10_000, 20_000);
    return 1;
  }

  /** Post a generic comment on a feed post. */
  private async warmComment(): Promise<number> {
    const comments = [
      'Great post!', 'Thanks for sharing!', 'Very interesting.',
      'Love this!', 'So true!', 'Good to know!',
      'Helpful, thanks!', 'Awesome!', 'Really cool.', 'Nice!',
    ];
    // Scroll down to find a post with a visible comment box
    await this.humanBehavior.scroll(this.page, 'down',400);
    await this.humanBehavior.delay(2000, 4000);
    // Click "Comment" button on a post to open the comment input
    const commentButton = 'div[aria-label="Leave a comment"], div[aria-label="Write a comment"], span:has-text("Comment")';
    const commentButtons = await this.page.$$(commentButton);
    if (commentButtons.length === 0) return 0;
    const idx = Math.floor(Math.random() * Math.min(commentButtons.length, 3));
    await commentButtons[idx].click();
    await this.humanBehavior.delay(1000, 2000);
    // Type into the comment input (contenteditable div)
    const commentInput = 'div[contenteditable="true"][role="textbox"][aria-label*="comment" i], div[contenteditable="true"][aria-label*="Write a comment" i]';
    const inputEl = await this.page.$(commentInput);
    if (!inputEl) return 0;
    const comment = comments[Math.floor(Math.random() * comments.length)];
    await this.humanBehavior.type(this.page, commentInput, comment);
    await this.humanBehavior.delay(500, 1500);
    // Submit by pressing Enter
    await this.page.keyboard.press('Enter');
    await this.humanBehavior.delay(2000, 4000);
    return 1;
  }

  // ─── Health Check ───

  async checkAccountHealth(): Promise<{ healthy: boolean; issues: string[] }> {
    await this.init();
    const issues: string[] = [];
    this.logger.info('Checking Facebook account health');

    try {
      // Check: can access Facebook settings
      await this.page.goto(this.FACEBOOK_SETTINGS_URL, { waitUntil: 'domcontentloaded' });
      await this.humanBehavior.delay(3000, 5000);

      // Check if redirected to login page
      if (this.page.url().includes('/login')) {
        issues.push('Not logged in — redirected to Facebook login page');
        return { healthy: false, issues };
      }

      // Check for account restriction notice
      const restricted = await this.checkRestriction();
      if (restricted) {
        issues.push('Account is currently restricted by Facebook');
      }

      // Check for disabled account notice
      const disabledSelectors = [
        'div:has-text("Your account has been disabled")',
        'div:has-text("Account Disabled")',
        'div:has-text("account is locked")',
      ];
      for (const selector of disabledSelectors) {
        const el = await this.page.$(selector);
        if (el) {
          issues.push('Account appears to be disabled or locked');
          break;
        }
      }

      // Check for checkpoint requirement
      const checkpointSelector = 'div[id="checkpoint"], form[action*="checkpoint"]';
      const checkpointEl = await this.page.$(checkpointSelector);
      if (checkpointEl) {
        issues.push('Account has a pending security checkpoint');
      }

      // Check that settings page loaded
      const settingsSelector = 'div[role="main"] a[href*="settings"], div[aria-label*="Settings"]';
      const settingsEl = await this.page.$(settingsSelector);
      if (!settingsEl) {
        issues.push('Facebook settings page did not load properly');
      }

      await this.takeScreenshot('facebook-health-check');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      issues.push(`Health check error: ${msg}`);
    }

    return {
      healthy: issues.length === 0,
      issues,
    };
  }

  // ─── Facebook-Specific Helpers ───

  /**
   * Check if Facebook has applied a restriction to the account.
   * Restrictions prevent posting, commenting, or using certain features.
   */
  private async checkRestriction(): Promise<boolean> {
    const restrictionSelectors = [
      'div:has-text("Your account is restricted")',
      'div:has-text("temporarily restricted")',
      'div:has-text("can\'t use this feature")',
      'div[role="dialog"]:has-text("restricted")',
      'div:has-text("account quality")',
    ];
    for (const selector of restrictionSelectors) {
      const el = await this.page.$(selector);
      if (el) return true;
    }
    return false;
  }

  protected override async isLoggedIn(): Promise<boolean> {
    try {
      const loggedInSelector = 'div[role="navigation"] a[href*="/me"], div[aria-label="Account"]';
      const el = await this.page.$(loggedInSelector);
      return el !== null;
    } catch {
      return false;
    }
  }

  /**
   * Derive a first and last name from an email address.
   */
  private splitEmail(email: string): [string, string] {
    const local = email.split('@')[0];
    const parts = local.split(/[._-]/);
    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    if (parts.length >= 2) {
      return [capitalize(parts[0]), capitalize(parts[1])];
    }
    return [capitalize(local), 'Smith'];
  }
}
