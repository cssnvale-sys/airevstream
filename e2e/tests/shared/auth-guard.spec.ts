import { test, expect } from '@playwright/test';

// Run all tests in this file WITHOUT authentication
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Auth guard — unauthenticated redirects', () => {
  test('navigating to /dashboard without auth redirects to /auth/login with redirect param', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/auth\/login/);
    // The redirect query param should contain the original path
    const url = new URL(page.url());
    expect(url.searchParams.get('redirect')).toBe('/dashboard');
  });

  test('navigating to /settings without auth redirects to /auth/login', async ({ page }) => {
    await page.goto('/settings');

    await expect(page).toHaveURL(/\/auth\/login/);
    const url = new URL(page.url());
    expect(url.searchParams.get('redirect')).toBe('/settings');
  });

  test('navigating to /auth/login without auth stays on login page', async ({ page }) => {
    await page.goto('/auth/login');

    await expect(page).toHaveURL(/\/auth\/login/);
    // Should NOT have a redirect param since we navigated directly to login
    const url = new URL(page.url());
    expect(url.searchParams.has('redirect')).toBe(false);
  });

  test('navigating to /auth/register without auth stays on register page', async ({ page }) => {
    await page.goto('/auth/register');

    await expect(page).toHaveURL(/\/auth\/register/);
  });
});
