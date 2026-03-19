import { Page, expect } from '@playwright/test';

/**
 * Wait for the page to finish loading data (no loading skeletons visible).
 */
export async function waitForDataLoad(page: Page, timeout = 10_000) {
  // Wait for all resources including JS bundles to load
  await page.waitForLoadState('load', { timeout });
  // Give SWR data fetches time to complete after hydration
  // networkidle doesn't work with Next.js dev server (HMR WebSocket stays open)
  await page.waitForTimeout(1500);
}

/**
 * Reset a content item to a specific status via API.
 * Useful for tests that depend on seed data being in a certain state.
 */
export async function resetContentStatus(page: Page, contentId: string, status: string) {
  await page.evaluate(
    async ({ contentId, status }) => {
      const token = localStorage.getItem('airevstream_token');
      await fetch(`/api/v1/content/${contentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status }),
      });
    },
    { contentId, status },
  );
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
