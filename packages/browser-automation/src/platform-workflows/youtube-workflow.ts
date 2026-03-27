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
import { BasePlatformWorkflow, MAX_WARM_FAILURES } from './base-workflow';

/**
 * YouTube / Google account workflow.
 *
 * Handles login through Google's authentication flow, account creation,
 * account warming (browsing, watching, liking, commenting, subscribing),
 * and health checking via YouTube Studio.
 */
export class YouTubeWorkflow extends BasePlatformWorkflow {
  private readonly YOUTUBE_URL = 'https://www.youtube.com';
  private readonly GOOGLE_LOGIN_URL = 'https://accounts.google.com/signin';
  private readonly GOOGLE_SIGNUP_URL = 'https://accounts.google.com/signup';
  private readonly YOUTUBE_STUDIO_URL = 'https://studio.youtube.com';

  // ─── Login ───

  async login(credentials: AccountCredentials): Promise<WorkflowResult> {
    await this.init();
    this.logger.info({ email: credentials.email }, 'Starting YouTube login');

    try {
      // Step 1: Navigate to YouTube
      const navStep = await this.executeStep('navigate-to-youtube', async () => {
        await this.page.goto(this.YOUTUBE_URL, { waitUntil: 'domcontentloaded' });
        await this.dismissCookieDialog();
      });
      if (!navStep.success) return this.buildResult(false, navStep.error);

      // Step 2: Click Sign In button
      const signInStep = await this.executeStep('click-sign-in', async () => {
        // YouTube "Sign in" button in the top-right header area
        const signInSelector = 'a[href*="accounts.google.com/ServiceLogin"], ytd-button-renderer a[aria-label="Sign in"]';
        await this.page.waitForSelector(signInSelector, { timeout: 10_000 });
        await this.humanBehavior.click(this.page, signInSelector);
        await this.waitForNavigation(this.page, 'accounts.google.com');
      });
      if (!signInStep.success) return this.buildResult(false, signInStep.error);

      // Step 3: Enter email on Google login page
      const emailStep = await this.executeStep('enter-email', async () => {
        // Google email input field
        const emailInput = 'input[type="email"]#identifierId, input[type="email"][name="identifier"]';
        await this.page.waitForSelector(emailInput, { timeout: 10_000 });
        await this.humanBehavior.type(this.page, emailInput, credentials.email);
      });
      if (!emailStep.success) return this.buildResult(false, emailStep.error);

      // Step 4: Click Next after email
      const emailNextStep = await this.executeStep('click-email-next', async () => {
        // Google "Next" button after email entry
        const nextButton = '#identifierNext button, #identifierNext div[role="button"]';
        await this.humanBehavior.click(this.page, nextButton);
        await this.humanBehavior.delay(2000, 4000);
      });
      if (!emailNextStep.success) return this.buildResult(false, emailNextStep.error);

      // Check for CAPTCHA after email submission
      const captchaCheck = await this.handleCaptcha();
      if (captchaCheck.needsHuman) {
        return this.buildResult(false, 'CAPTCHA detected', true, captchaCheck.taskDescription);
      }

      // Step 5: Enter password
      const passwordStep = await this.executeStep('enter-password', async () => {
        // Google password input field
        const passwordInput = 'input[type="password"][name="Passwd"], input[type="password"]';
        await this.page.waitForSelector(passwordInput, { timeout: 10_000, state: 'visible' });
        await this.humanBehavior.type(this.page, passwordInput, credentials.password);
      });
      if (!passwordStep.success) return this.buildResult(false, passwordStep.error);

      // Step 6: Click Next after password
      const passwordNextStep = await this.executeStep('click-password-next', async () => {
        // Google "Next" button after password entry
        const nextButton = '#passwordNext button, #passwordNext div[role="button"]';
        await this.humanBehavior.click(this.page, nextButton);
        await this.humanBehavior.delay(3000, 6000);
      });
      if (!passwordNextStep.success) return this.buildResult(false, passwordNextStep.error);

      // Step 7: Handle 2FA if prompted
      const twoFaStep = await this.executeStep('check-2fa', async () => {
        // Check for 2FA challenge page indicators
        const twoFaSelectors = [
          '#totpPin',                                    // TOTP code input
          'input[name="totpPin"]',                       // TOTP code input (alt)
          '[data-challengetype="6"]',                    // Google Prompt challenge
          '#idvPreregisteredPhonePin',                   // Phone verification
          'div[data-challengeid]',                       // Generic challenge
        ];
        for (const selector of twoFaSelectors) {
          const element = await this.page.$(selector);
          if (element) {
            await this.takeScreenshot('2fa-challenge');
            throw new Error(`2FA_REQUIRED:${selector}`);
          }
        }
      });
      if (!twoFaStep.success && twoFaStep.error?.startsWith('2FA_REQUIRED')) {
        return this.buildResult(
          false,
          '2FA verification required',
          true,
          'Two-factor authentication is required. Please complete the 2FA challenge in the browser and confirm.',
        );
      }

      // Step 8: Verify logged in by checking for YouTube avatar
      const verifyStep = await this.executeStep('verify-login', async () => {
        await this.page.goto(this.YOUTUBE_URL, { waitUntil: 'domcontentloaded' });
        await this.humanBehavior.delay(2000, 4000);
        // YouTube avatar button in the top-right when logged in
        const avatarSelector = 'button#avatar-btn, img#img[alt="Avatar image"]';
        await this.page.waitForSelector(avatarSelector, { timeout: 15_000 });
        await this.takeScreenshot('login-success');
      });
      if (!verifyStep.success) return this.buildResult(false, 'Login verification failed — avatar not found');

      return this.buildResult(true);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error({ error: msg }, 'YouTube login failed');
      await this.takeScreenshot('login-error');
      return this.buildResult(false, msg);
    }
  }

  // ─── Account Creation ───

  async createAccount(credentials: AccountCredentials): Promise<WorkflowResult> {
    await this.init();
    this.logger.info({ email: credentials.email }, 'Starting YouTube/Google account creation');

    try {
      // Step 1: Navigate to Google signup
      const navStep = await this.executeStep('navigate-to-signup', async () => {
        await this.page.goto(this.GOOGLE_SIGNUP_URL, { waitUntil: 'domcontentloaded' });
        await this.dismissCookieDialog();
        await this.humanBehavior.delay(1000, 2000);
      });
      if (!navStep.success) return this.buildResult(false, navStep.error);

      // Step 2: Fill first and last name
      const nameStep = await this.executeStep('fill-name', async () => {
        // Google signup name fields
        const firstNameInput = 'input[name="firstName"], #firstName';
        const lastNameInput = 'input[name="lastName"], #lastName';
        await this.page.waitForSelector(firstNameInput, { timeout: 10_000 });
        const [firstName, lastName] = this.splitEmail(credentials.email);
        await this.humanBehavior.type(this.page, firstNameInput, firstName);
        await this.humanBehavior.delay(300, 800);
        await this.humanBehavior.type(this.page, lastNameInput, lastName);
      });
      if (!nameStep.success) return this.buildResult(false, nameStep.error);

      // Step 3: Click Next after name
      const nameNextStep = await this.executeStep('click-name-next', async () => {
        const nextButton = 'button:has-text("Next"), div[id="collectNameNext"] button';
        await this.humanBehavior.click(this.page, nextButton);
        await this.humanBehavior.delay(2000, 4000);
      });
      if (!nameNextStep.success) return this.buildResult(false, nameNextStep.error);

      // Step 4: Fill birthdate and gender
      const birthdateStep = await this.executeStep('fill-birthdate-gender', async () => {
        // Month dropdown
        const monthSelect = 'select#month, select[name="month"]';
        await this.page.waitForSelector(monthSelect, { timeout: 10_000 });
        await this.page.selectOption(monthSelect, { index: Math.floor(Math.random() * 12) + 1 });
        await this.humanBehavior.delay(300, 600);

        // Day input
        const dayInput = 'input#day, input[name="day"]';
        await this.humanBehavior.type(this.page, dayInput, String(Math.floor(Math.random() * 28) + 1));
        await this.humanBehavior.delay(300, 600);

        // Year input
        const yearInput = 'input#year, input[name="year"]';
        const year = 1985 + Math.floor(Math.random() * 15);
        await this.humanBehavior.type(this.page, yearInput, String(year));
        await this.humanBehavior.delay(300, 600);

        // Gender dropdown
        const genderSelect = 'select#gender, select[name="gender"]';
        await this.page.selectOption(genderSelect, { index: Math.floor(Math.random() * 2) + 1 });
      });
      if (!birthdateStep.success) return this.buildResult(false, birthdateStep.error);

      // Step 5: Click Next after birthdate
      const birthdateNextStep = await this.executeStep('click-birthdate-next', async () => {
        const nextButton = 'button:has-text("Next"), div[id="birthdayNext"] button';
        await this.humanBehavior.click(this.page, nextButton);
        await this.humanBehavior.delay(2000, 4000);
      });
      if (!birthdateNextStep.success) return this.buildResult(false, birthdateNextStep.error);

      // Step 6: Choose email / fill username
      const emailStep = await this.executeStep('fill-email', async () => {
        // Google may offer "Create your own" option or a username input
        const customEmailOption = 'div[data-value="custom"], span:has-text("Create your own Gmail address")';
        const customEl = await this.page.$(customEmailOption);
        if (customEl) {
          await this.humanBehavior.click(this.page, customEmailOption);
          await this.humanBehavior.delay(500, 1000);
        }
        const usernameInput = 'input[name="Username"], input#username';
        await this.page.waitForSelector(usernameInput, { timeout: 10_000 });
        const username = credentials.email.split('@')[0];
        await this.humanBehavior.type(this.page, usernameInput, username);
      });
      if (!emailStep.success) return this.buildResult(false, emailStep.error);

      // Step 7: Click Next after email
      const emailNextStep = await this.executeStep('click-email-next', async () => {
        const nextButton = 'button:has-text("Next"), div[id="next"] button';
        await this.humanBehavior.click(this.page, nextButton);
        await this.humanBehavior.delay(2000, 4000);
      });
      if (!emailNextStep.success) return this.buildResult(false, emailNextStep.error);

      // Step 8: Fill password and confirm
      const passwordStep = await this.executeStep('fill-password', async () => {
        const passwordInput = 'input[name="Passwd"], input[type="password"]';
        const confirmInput = 'input[name="PasswdAgain"], input[name="ConfirmPasswd"]';
        await this.page.waitForSelector(passwordInput, { timeout: 10_000 });
        await this.humanBehavior.type(this.page, passwordInput, credentials.password);
        await this.humanBehavior.delay(500, 1000);
        await this.humanBehavior.type(this.page, confirmInput, credentials.password);
      });
      if (!passwordStep.success) return this.buildResult(false, passwordStep.error);

      // Step 9: Click Next after password
      const passwordNextStep = await this.executeStep('click-password-next', async () => {
        const nextButton = 'button:has-text("Next"), div[id="createpasswordNext"] button';
        await this.humanBehavior.click(this.page, nextButton);
        await this.humanBehavior.delay(2000, 4000);
      });
      if (!passwordNextStep.success) return this.buildResult(false, passwordNextStep.error);

      // Step 10: Phone verification (mark as needs-human)
      const phoneStep = await this.executeStep('phone-verification', async () => {
        const phoneInput = 'input#phoneNumberId, input[type="tel"]';
        const phoneEl = await this.page.$(phoneInput);
        if (phoneEl) {
          await this.takeScreenshot('phone-verification-required');
          throw new Error('PHONE_VERIFICATION_REQUIRED');
        }
      });
      if (!phoneStep.success && phoneStep.error === 'PHONE_VERIFICATION_REQUIRED') {
        return this.buildResult(
          false,
          'Phone verification required during account creation',
          true,
          'Google requires phone number verification. Enter the phone number and verification code to continue.',
        );
      }

      // Step 11: Fill recovery email if field present
      const recoveryStep = await this.executeStep('fill-recovery-email', async () => {
        const recoveryInput = 'input[name="recovery"], input#recoveryEmail';
        const recoveryEl = await this.page.$(recoveryInput);
        if (recoveryEl && credentials.recoveryEmail) {
          await this.humanBehavior.type(this.page, recoveryInput, credentials.recoveryEmail);
          const nextButton = 'button:has-text("Next")';
          await this.humanBehavior.click(this.page, nextButton);
          await this.humanBehavior.delay(2000, 3000);
        }
      });
      if (!recoveryStep.success) return this.buildResult(false, recoveryStep.error);

      // Step 12: Accept Terms of Service
      const tosStep = await this.executeStep('accept-tos', async () => {
        // Google ToS "I agree" button
        const agreeButton = 'button:has-text("I agree"), button:has-text("Agree"), div[id="termsofserviceNext"] button';
        const agreeEl = await this.page.$(agreeButton);
        if (agreeEl) {
          await this.humanBehavior.click(this.page, agreeButton);
          await this.humanBehavior.delay(3000, 5000);
        }
      });
      if (!tosStep.success) return this.buildResult(false, tosStep.error);

      // Step 13: Navigate to YouTube and create channel
      const channelStep = await this.executeStep('create-youtube-channel', async () => {
        await this.page.goto(this.YOUTUBE_URL, { waitUntil: 'domcontentloaded' });
        await this.humanBehavior.delay(2000, 4000);
        // YouTube may prompt to create a channel on first visit
        const createChannelButton = 'button:has-text("Create channel"), yt-button-renderer:has-text("Create channel")';
        const createEl = await this.page.$(createChannelButton);
        if (createEl) {
          await this.humanBehavior.click(this.page, createChannelButton);
          await this.humanBehavior.delay(2000, 4000);
        }
        await this.takeScreenshot('account-created');
      });
      if (!channelStep.success) return this.buildResult(false, channelStep.error);

      return this.buildResult(true);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error({ error: msg }, 'YouTube account creation failed');
      await this.takeScreenshot('create-account-error');
      return this.buildResult(false, msg);
    }
  }

  // ─── Account Warming ───

  async warmAccount(config: WarmingConfig): Promise<WarmingSessionResult> {
    await this.init();
    this.logger.info({ config }, 'Starting YouTube account warming');

    const activityResults: WarmingActivityResult[] = [];
    const startTime = Date.now();
    const durationMs = config.durationMinutes * 60 * 1000;
    let flagged = false;

    try {
      await this.page.goto(this.YOUTUBE_URL, { waitUntil: 'domcontentloaded' });
      await this.dismissCookieDialog();
      await this.humanBehavior.delay(2000, 4000);

      while (Date.now() - startTime < durationMs) {
        // Randomly select an activity from the configured list
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
          this.logger.warn({ activity, error }, 'Warming activity failed');
          // If too many failures, flag the session
          const failCount = activityResults.filter((r) => r.count === 0).length;
          if (failCount > MAX_WARM_FAILURES) {
            flagged = true;
            break;
          }
        }

        // Delay between activities based on intensity
        const delayMap = { low: [8000, 15000], medium: [4000, 10000], high: [2000, 6000] } as const;
        const [min, max] = delayMap[config.intensity];
        await this.humanBehavior.delay(min, max);
      }
    } catch (error) {
      this.logger.error({ error }, 'Warming session failed');
      flagged = true;
    }

    const screenshot = await this.takeScreenshot('warming-complete');

    return {
      activitiesPerformed: activityResults,
      totalDurationMs: Date.now() - startTime,
      flagged,
      screenshot: screenshot ?? undefined,
    };
  }

  /**
   * Perform a single warming activity on YouTube.
   * Returns the number of actions taken (e.g., videos watched, likes given).
   */
  private async performWarmingActivity(activity: WarmingActivity, config: WarmingConfig): Promise<number> {
    switch (activity) {
      case 'browse':
        return await this.warmBrowse();
      case 'watch':
        return await this.warmWatch();
      case 'like':
        return await this.warmLike();
      case 'search':
        return await this.warmSearch(config.nicheTags);
      case 'comment':
        return await this.warmComment();
      case 'subscribe':
        return await this.warmSubscribe();
      default:
        return 0;
    }
  }

  /** Browse the trending page and scroll through recommendations. */
  private async warmBrowse(): Promise<number> {
    const pages = ['/', '/feed/trending', '/feed/explore'];
    const target = pages[Math.floor(Math.random() * pages.length)];
    await this.page.goto(`${this.YOUTUBE_URL}${target}`, { waitUntil: 'domcontentloaded' });
    await this.humanBehavior.delay(2000, 4000);
    // Scroll through the page 3-6 times to simulate browsing
    const scrollCount = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < scrollCount; i++) {
      await this.humanBehavior.scroll(this.page, 'down',300 + Math.floor(Math.random() * 500));
      await this.humanBehavior.delay(1500, 4000);
    }
    return scrollCount;
  }

  /** Click on a video and watch for 30-120 seconds. */
  private async warmWatch(): Promise<number> {
    // Click a video thumbnail from the current page
    const videoSelector = 'ytd-rich-item-renderer a#thumbnail, ytd-video-renderer a#thumbnail';
    const videos = await this.page.$$(videoSelector);
    if (videos.length === 0) return 0;
    const randomIndex = Math.floor(Math.random() * Math.min(videos.length, 10));
    await videos[randomIndex].click();
    await this.humanBehavior.delay(3000, 5000);
    // Watch for 30-120 seconds with occasional scrolls
    const watchTime = 30_000 + Math.floor(Math.random() * 90_000);
    const scrollIntervals = Math.floor(watchTime / 15_000);
    for (let i = 0; i < scrollIntervals; i++) {
      await this.humanBehavior.delay(10_000, 20_000);
      await this.humanBehavior.scroll(this.page, 'down',100 + Math.floor(Math.random() * 200));
    }
    return 1;
  }

  /** Like the currently playing video. */
  private async warmLike(): Promise<number> {
    // YouTube like button — segmented like button or standalone
    const likeSelector = 'ytd-menu-renderer button[aria-label*="like" i]:not([aria-label*="dislike"]),' +
      'like-button-view-model button';
    const likeButton = await this.page.$(likeSelector);
    if (!likeButton) return 0;
    const ariaPressed = await likeButton.getAttribute('aria-pressed');
    if (ariaPressed === 'true') return 0; // Already liked
    await this.humanBehavior.click(this.page, likeSelector);
    await this.humanBehavior.delay(1000, 2000);
    return 1;
  }

  /** Search for niche-relevant topics. */
  private async warmSearch(nicheTags?: string[]): Promise<number> {
    const defaultSearches = ['trending videos', 'popular music', 'how to cook', 'tech review', 'travel vlog'];
    const terms = nicheTags && nicheTags.length > 0 ? nicheTags : defaultSearches;
    const searchTerm = terms[Math.floor(Math.random() * terms.length)];
    // YouTube search box
    const searchInput = 'input#search, input[name="search_query"]';
    await this.page.waitForSelector(searchInput, { timeout: 5000 });
    await this.humanBehavior.click(this.page, searchInput);
    await this.humanBehavior.type(this.page, searchInput, searchTerm);
    await this.humanBehavior.delay(500, 1000);
    // Press Enter to search
    await this.page.keyboard.press('Enter');
    await this.humanBehavior.delay(2000, 4000);
    // Scroll through results
    const scrollCount = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < scrollCount; i++) {
      await this.humanBehavior.scroll(this.page, 'down',300 + Math.floor(Math.random() * 400));
      await this.humanBehavior.delay(1500, 3000);
    }
    return 1;
  }

  /** Post a generic, safe comment on the current video. */
  private async warmComment(): Promise<number> {
    const comments = [
      'Great video!', 'Really enjoyed this.', 'Very informative, thanks!',
      'Love this content!', 'This was helpful, thank you.', 'Awesome work!',
      'Interesting perspective.', 'Well done!', 'Keep it up!', 'Nice one!',
    ];
    // Scroll down to comments section
    await this.humanBehavior.scroll(this.page, 'down',600);
    await this.humanBehavior.delay(2000, 4000);
    // Comment input placeholder
    const commentPlaceholder = 'ytd-comment-simplebox-renderer #placeholder-area, #simplebox-placeholder';
    const placeholderEl = await this.page.$(commentPlaceholder);
    if (!placeholderEl) return 0;
    await this.humanBehavior.click(this.page, commentPlaceholder);
    await this.humanBehavior.delay(1000, 2000);
    // Active comment input
    const commentInput = '#contenteditable-root, div[contenteditable="true"]';
    await this.page.waitForSelector(commentInput, { timeout: 5000 });
    const comment = comments[Math.floor(Math.random() * comments.length)];
    await this.humanBehavior.type(this.page, commentInput, comment);
    await this.humanBehavior.delay(500, 1500);
    // Submit comment
    const submitButton = '#submit-button button, ytd-button-renderer#submit-button button';
    await this.humanBehavior.click(this.page, submitButton);
    await this.humanBehavior.delay(2000, 4000);
    return 1;
  }

  /** Subscribe to a channel from the current video page. */
  private async warmSubscribe(): Promise<number> {
    // YouTube subscribe button on video watch page
    const subscribeSelector = 'ytd-subscribe-button-renderer button, #subscribe-button button';
    const subscribeButton = await this.page.$(subscribeSelector);
    if (!subscribeButton) return 0;
    const subscribed = await subscribeButton.getAttribute('aria-label');
    if (subscribed?.toLowerCase().includes('unsubscribe')) return 0; // Already subscribed
    await this.humanBehavior.click(this.page, subscribeSelector);
    await this.humanBehavior.delay(1000, 3000);
    return 1;
  }

  // ─── Health Check ───

  async checkAccountHealth(): Promise<{ healthy: boolean; issues: string[] }> {
    await this.init();
    const issues: string[] = [];
    this.logger.info('Checking YouTube account health');

    try {
      // Check: can access YouTube Studio
      await this.page.goto(this.YOUTUBE_STUDIO_URL, { waitUntil: 'domcontentloaded' });
      await this.humanBehavior.delay(3000, 5000);

      // Check if redirected to login (not authenticated)
      if (this.page.url().includes('accounts.google.com')) {
        issues.push('Not logged in — redirected to Google sign-in');
        return { healthy: false, issues };
      }

      // Check for channel suspension notice
      const suspensionSelector = 'div[class*="suspended" i], div:has-text("channel has been suspended")';
      const suspensionEl = await this.page.$(suspensionSelector);
      if (suspensionEl) {
        issues.push('Channel appears to be suspended');
      }

      // Check for community guidelines strike warnings
      const strikeSelector = 'div[class*="strike" i], div:has-text("Community Guidelines strike")';
      const strikeEl = await this.page.$(strikeSelector);
      if (strikeEl) {
        issues.push('Community Guidelines strike detected');
      }

      // Check that Studio dashboard loaded properly
      const dashboardSelector = '#dashboard, ytcp-entity-page';
      const dashboardEl = await this.page.$(dashboardSelector);
      if (!dashboardEl) {
        issues.push('YouTube Studio dashboard did not load properly');
      }

      await this.takeScreenshot('health-check');
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
      // YouTube-specific: check for avatar button that only appears when signed in
      const avatarSelector = 'button#avatar-btn, img#img[alt="Avatar image"]';
      const avatar = await this.page.$(avatarSelector);
      return avatar !== null;
    } catch (err) {
      this.logger.debug({ err }, 'YouTube isLoggedIn check failed');
      return false;
    }
  }

  // ─── Discovery ───

  /**
   * Discover whether a Google/YouTube account exists for this email.
   * Uses login probe: enter email on Google sign-in, check for password prompt vs error.
   */
  async discoverAccount(credentials: AccountCredentials): Promise<DiscoveryResult> {
    await this.init();
    this.logger.info({ email: credentials.email }, 'Starting YouTube account discovery');

    try {
      // Navigate to Google sign-in
      const navStep = await this.executeStep('navigate-to-google-signin', async () => {
        await this.page.goto(this.GOOGLE_LOGIN_URL, { waitUntil: 'domcontentloaded' });
        await this.dismissCookieDialog();
      });
      if (!navStep.success) return { exists: 'unknown', error: navStep.error };

      // Enter email
      const emailStep = await this.executeStep('enter-email', async () => {
        await this.humanBehavior.type(this.page, 'input[type="email"]', credentials.email);
        await this.humanBehavior.delay(300, 600);
        await this.page.click('#identifierNext');
        await this.humanBehavior.delay(2000, 4000);
      });
      if (!emailStep.success) return { exists: 'unknown', error: emailStep.error };

      // Check for CAPTCHA
      const captchaCheck = await this.handleCaptcha();
      if (captchaCheck.needsHuman) {
        return {
          exists: 'unknown',
          needsHuman: true,
          humanTaskDescription: captchaCheck.taskDescription,
        };
      }

      // Check what Google shows: password prompt (exists) or "Couldn't find" (doesn't exist)
      const result = await this.executeStep('check-result', async () => {
        // Check for "Couldn't find your Google Account"
        const notFoundText = await this.page.$('text=Couldn\'t find your Google Account');
        const notFoundText2 = await this.page.$('text=couldn\'t find your Google Account');
        if (notFoundText || notFoundText2) {
          return { found: false };
        }

        // Check for password input (account exists)
        const passwordInput = await this.page.$('input[type="password"]');
        if (passwordInput) {
          // Try to extract display name from header
          const displayName = await this.page.$eval(
            '[data-identifier], [data-email]',
            (el) => el.textContent?.trim(),
          ).catch(() => undefined);
          return { found: true, displayName };
        }

        // Ambiguous state
        return { ambiguous: true };
      });

      if (!result.success || !result.data) {
        return { exists: 'unknown', error: result.error ?? 'Discovery step failed' };
      }

      if (result.data.found === false) {
        return { exists: false };
      }

      if (result.data.found === true) {
        return {
          exists: true,
          accountInfo: {
            username: result.data.displayName as string | undefined,
          },
        };
      }

      return { exists: 'unknown' };
    } catch (err) {
      this.logger.error({ err, email: credentials.email }, 'YouTube discovery failed');
      return { exists: 'unknown', error: String(err) };
    }
  }

  // ─── Profile Setup ───

  /**
   * Upload profile image and banner to YouTube Studio channel customization.
   */
  async setProfileAssets(config: ProfileAssetsConfig): Promise<WorkflowResult> {
    await this.init();
    this.logger.info('Starting YouTube profile asset setup');

    try {
      // Navigate to YouTube Studio branding page
      const navStep = await this.executeStep('navigate-to-studio-branding', async () => {
        await this.page.goto(`${this.YOUTUBE_STUDIO_URL}/channel/editing/branding`, {
          waitUntil: 'domcontentloaded',
        });
        await this.humanBehavior.delay(2000, 3000);
      });
      if (!navStep.success) return this.buildResult(false, navStep.error);

      // Upload profile picture
      if (config.profileImagePath) {
        const uploadStep = await this.executeStep('upload-profile-picture', async () => {
          // Click the change/upload button for profile picture
          const uploadButton = await this.page.$('button:has-text("Upload"), button:has-text("Change")');
          if (uploadButton) {
            await uploadButton.click();
            await this.humanBehavior.delay(1000, 2000);
          }

          // Set file via input
          const fileInput = await this.page.$('input[type="file"][accept*="image"]');
          if (fileInput) {
            await fileInput.setInputFiles(config.profileImagePath!);
            await this.humanBehavior.delay(2000, 4000);

            // Click Done/Save if a crop dialog appears
            const doneButton = await this.page.$('button:has-text("Done"), button:has-text("DONE")');
            if (doneButton) {
              await doneButton.click();
              await this.humanBehavior.delay(1000, 2000);
            }
          }
        });
        if (!uploadStep.success) {
          this.logger.warn({ error: uploadStep.error }, 'Profile picture upload failed, continuing');
        }
      }

      // Upload banner
      if (config.bannerImagePath) {
        const bannerStep = await this.executeStep('upload-banner', async () => {
          // Look for the banner upload section
          const bannerSection = await this.page.$('text=Banner image');
          if (bannerSection) {
            const uploadButton = await bannerSection.$('xpath=../following-sibling::*//button');
            if (uploadButton) {
              await uploadButton.click();
              await this.humanBehavior.delay(1000, 2000);
            }
          }

          const fileInput = await this.page.$$('input[type="file"][accept*="image"]');
          if (fileInput.length > 1) {
            await fileInput[1].setInputFiles(config.bannerImagePath!);
            await this.humanBehavior.delay(3000, 5000);

            const doneButton = await this.page.$('button:has-text("Done"), button:has-text("DONE")');
            if (doneButton) {
              await doneButton.click();
              await this.humanBehavior.delay(1000, 2000);
            }
          }
        });
        if (!bannerStep.success) {
          this.logger.warn({ error: bannerStep.error }, 'Banner upload failed, continuing');
        }
      }

      // Set display name (via Basic info)
      if (config.displayName) {
        const nameStep = await this.executeStep('set-display-name', async () => {
          await this.page.goto(`${this.YOUTUBE_STUDIO_URL}/channel/editing/profile`, {
            waitUntil: 'domcontentloaded',
          });
          await this.humanBehavior.delay(2000, 3000);

          const nameInput = await this.page.$('input[aria-label*="Name"], #channel-name-input');
          if (nameInput) {
            await nameInput.click({ clickCount: 3 }); // Select all
            await this.humanBehavior.type(this.page, 'input[aria-label*="Name"], #channel-name-input', config.displayName!);
          }
        });
        if (!nameStep.success) {
          this.logger.warn({ error: nameStep.error }, 'Display name setup failed, continuing');
        }
      }

      // Publish changes
      const publishStep = await this.executeStep('publish-changes', async () => {
        const publishButton = await this.page.$('button:has-text("Publish"), button:has-text("PUBLISH")');
        if (publishButton) {
          await publishButton.click();
          await this.humanBehavior.delay(2000, 4000);
        }
      });

      return this.buildResult(true);
    } catch (err) {
      this.logger.error({ err }, 'YouTube profile setup failed');
      return this.buildResult(false, String(err));
    }
  }

  // ─── Utility ───

  /**
   * Derive a first and last name from an email address for account creation.
   * Falls back to "User" / "Account" if the email cannot be split meaningfully.
   */
  private splitEmail(email: string): [string, string] {
    const local = email.split('@')[0];
    // Try splitting on dots or underscores
    const parts = local.split(/[._-]/);
    if (parts.length >= 2) {
      const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
      return [capitalize(parts[0]), capitalize(parts[1])];
    }
    return [local.charAt(0).toUpperCase() + local.slice(1), 'User'];
  }
}
