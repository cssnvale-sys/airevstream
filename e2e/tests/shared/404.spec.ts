import { test, expect } from '@playwright/test';

test.describe('404 Not Found page', () => {
  test('navigating to a nonexistent route renders the 404 page', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz');

    // "404" heading text is visible
    await expect(page.getByText('404')).toBeVisible();
  });

  test('"Page not found" message is visible', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz');

    await expect(page.getByText('Page not found')).toBeVisible();
  });

  test('"Go to Dashboard" link navigates to /dashboard', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz');

    const dashboardLink = page.getByRole('link', { name: 'Go to Dashboard' });
    await expect(dashboardLink).toBeVisible();

    await dashboardLink.click();
    await page.waitForURL('**/dashboard', { timeout: 15_000 });

    expect(page.url()).toContain('/dashboard');
  });
});
