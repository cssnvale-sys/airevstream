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

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await waitForHydration(page);
  });

  test('renders email, password inputs and sign in button', async ({ page }) => {
    await expect(page.locator('#login-email')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('successful login redirects to /dashboard', async ({ page }) => {
    await page.locator('#login-email').fill(ADMIN.email);
    await page.locator('#login-password').fill(ADMIN.password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await waitForNav(page, '**/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('wrong password shows "Invalid email or password" error', async ({ page }) => {
    await page.locator('#login-email').fill(ADMIN.email);
    await page.locator('#login-password').fill('wrongpassword123');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.getByText('Invalid email or password')).toBeVisible({ timeout: 10_000 });
  });

  test('show/hide password toggle works', async ({ page }) => {
    const passwordInput = page.locator('#login-password');
    await passwordInput.fill('secret123');

    // Password should be hidden by default
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click show password toggle
    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // Click hide password toggle
    await page.getByRole('button', { name: 'Hide password' }).click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('"Forgot password?" and "Register" links are present and navigate correctly', async ({ page }) => {
    // Check forgot password link
    const forgotLink = page.getByRole('link', { name: /forgot password/i });
    await expect(forgotLink).toBeVisible();
    await forgotLink.click();
    await waitForNav(page, '**/auth/forgot-password');
    await expect(page).toHaveURL(/\/auth\/forgot-password/);

    // Go back and check register link
    await page.goto('/auth/login');
    const registerLink = page.getByRole('link', { name: /register|create account|sign up/i });
    await expect(registerLink).toBeVisible();
    await registerLink.click();
    await waitForNav(page, '**/auth/register');
    await expect(page).toHaveURL(/\/auth\/register/);
  });
});
