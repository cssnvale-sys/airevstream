import { test, expect } from '@playwright/test';
import { waitForNav } from '../../helpers/wait.helper';

// Use default storageState (authenticated as admin via setup project)

test.describe('Logout', () => {
  test('clicking "Sign Out" in sidebar clears auth and goes to login', async ({ page }) => {
    // Start on the dashboard (authenticated)
    await page.goto('/dashboard');
    await page.waitForURL('**/dashboard', { timeout: 15_000 });

    // Click the sign out button in the sidebar
    const signOutButton = page.getByLabel('Sign out');
    await expect(signOutButton).toBeVisible();
    await signOutButton.click();

    // Should redirect to login page
    await waitForNav(page, '**/auth/login**');
    await expect(page).toHaveURL(/\/auth\/login/);

    // Verify auth token is cleared from localStorage
    const token = await page.evaluate(() =>
      localStorage.getItem('airevstream_token')
    );
    expect(token).toBeNull();
  });

  test('after logout, navigating to /dashboard redirects to login', async ({ page }) => {
    // Start on the dashboard (authenticated)
    await page.goto('/dashboard');
    await page.waitForURL('**/dashboard', { timeout: 15_000 });

    // Click the sign out button
    const signOutButton = page.getByLabel('Sign out');
    await expect(signOutButton).toBeVisible();
    await signOutButton.click();

    // Wait for redirect to login
    await waitForNav(page, '**/auth/login**');

    // Now try to navigate to /dashboard again
    await page.goto('/dashboard');

    // Middleware should redirect to login with redirect param
    await waitForNav(page, '**/auth/login**');
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page).toHaveURL(/redirect/);
  });
});
