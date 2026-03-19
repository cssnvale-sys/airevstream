import { test, expect, type Page } from '@playwright/test';
import { ADMIN, testEmail } from '../../fixtures/test-data';
import { waitForToast, waitForNav } from '../../helpers/wait.helper';

async function waitForHydration(page: Page) {
  await page.waitForFunction(() => {
    const btn = document.querySelector('button[type="submit"]');
    return btn && Object.keys(btn).some(
      (k) => k.startsWith('__reactFiber') || k.startsWith('__reactProps')
    );
  }, { timeout: 10_000 });
}

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Register page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/register');
    await waitForHydration(page);
  });

  test('renders name, email, and password inputs', async ({ page }) => {
    await expect(page.getByLabel('Name')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password (min 8 characters)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
  });

  test('successful registration with unique email redirects to /dashboard', async ({ page }) => {
    const uniqueEmail = testEmail('register');

    await page.getByLabel('Name').fill('E2E Test User');
    await page.getByLabel('Email').fill(uniqueEmail);
    await page.getByLabel('Password (min 8 characters)').fill('TestPass123!');
    await page.getByRole('button', { name: 'Create Account' }).click();

    await waitForNav(page, '**/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('duplicate email shows "A user with this email already exists" error', async ({ page }) => {
    await page.getByLabel('Name').fill('Duplicate User');
    await page.getByLabel('Email').fill(ADMIN.email);
    await page.getByLabel('Password (min 8 characters)').fill('TestPass123!');
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Error is displayed inline (not as a toast)
    await expect(page.getByText('A user with this email already exists')).toBeVisible({ timeout: 10_000 });
  });

  test('short password shows validation error', async ({ page }) => {
    await page.getByLabel('Name').fill('Short Pass User');
    await page.getByLabel('Email').fill(testEmail('shortpass'));
    await page.getByLabel('Password (min 8 characters)').fill('short');
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Expect a validation error about password length
    const errorText = page.getByText(/password.*8|8.*characters|too short/i);
    await expect(errorText).toBeVisible({ timeout: 5_000 });
  });

  test('link to sign in works', async ({ page }) => {
    const signInLink = page.getByRole('link', { name: /sign in|log in|already have/i });
    await expect(signInLink).toBeVisible();
    await signInLink.click();

    await waitForNav(page, '**/auth/login');
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
