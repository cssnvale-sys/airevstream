import { Page, expect } from '@playwright/test';

/**
 * Wait for the page to finish loading data (no loading skeletons visible).
 */
export async function waitForDataLoad(page: Page, timeout = 10_000) {
  // Wait for any loading indicators to disappear
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Wait for a sonner toast with specific text to appear.
 */
export async function waitForToast(page: Page, text: string, timeout = 10_000) {
  const toast = page.locator('[data-sonner-toast]').filter({ hasText: text });
  await expect(toast.first()).toBeVisible({ timeout });
}

/**
 * Wait for a sonner toast and verify it then disappears.
 */
export async function waitForToastAndDismiss(page: Page, text: string, timeout = 10_000) {
  await waitForToast(page, text, timeout);
  // Toasts auto-dismiss; no action needed
}

/**
 * Wait for navigation to complete after clicking a link/button.
 */
export async function waitForNav(page: Page, urlPattern: string | RegExp, timeout = 15_000) {
  await page.waitForURL(urlPattern, { timeout });
}
