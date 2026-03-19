import { test, expect } from '@playwright/test';

test('cleanup: verify test run completed', async ({ page }) => {
  // Navigate to login page to verify app is still healthy after tests
  // (teardown has no auth state, so just check the app responds)
  await page.goto('/auth/login');
  await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });
});
