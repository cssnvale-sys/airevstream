import { test, expect, type Page } from '@playwright/test';
import { ADMIN } from '../../fixtures/test-data';
import { waitForNav } from '../../helpers/wait.helper';

async function waitForHydration(page: Page) {
  await page.waitForFunction(() => {
    const btn = document.querySelector('button[type="submit"]');
    return btn && Object.keys(btn).some(
      (k) => k.startsWith('__reactFiber') || k.startsWith('__reactProps')
    );
  }, { timeout: 10_000 });
}

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Forgot password page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/forgot-password');
    await waitForHydration(page);
  });

  test('renders email input and submit button', async ({ page }) => {
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send Reset Link' })).toBeVisible();
  });

  test('submit shows success message', async ({ page }) => {
    await page.getByLabel('Email').fill(ADMIN.email);
    await page.getByRole('button', { name: 'Send Reset Link' }).click();

    const successMessage = page.getByText(
      'If an account with that email exists, a password reset link has been sent.'
    );
    await expect(successMessage).toBeVisible({ timeout: 10_000 });
  });

  test('"Back to Sign In" link works after success', async ({ page }) => {
    // Submit the form first to get to the success state
    await page.getByLabel('Email').fill(ADMIN.email);
    await page.getByRole('button', { name: 'Send Reset Link' }).click();

    // Wait for the success message to appear
    await expect(
      page.getByText('If an account with that email exists, a password reset link has been sent.')
    ).toBeVisible({ timeout: 10_000 });

    // Click "Back to Sign In" link
    const backLink = page.getByRole('link', { name: /back to sign in/i });
    await expect(backLink).toBeVisible();
    await backLink.click();

    await waitForNav(page, '**/auth/login');
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('"Sign In" link in form works before submit', async ({ page }) => {
    const signInLink = page.getByRole('link', { name: /sign in/i });
    await expect(signInLink).toBeVisible();
    await signInLink.click();

    await waitForNav(page, '**/auth/login');
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
