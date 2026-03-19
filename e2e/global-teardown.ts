import { test, expect } from '@playwright/test';

test('cleanup: verify test run completed', async ({ page }) => {
  // Navigate to dashboard to verify app is still healthy after tests
  await page.goto('/dashboard');
  await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible();
});
