import { test, expect } from '@playwright/test';
import { waitForDataLoad } from '../../helpers/wait.helper';

test.describe('Notification center', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await waitForDataLoad(page);
  });

  test('notification bell button is visible in the layout', async ({ page }) => {
    const bellButton = page.getByRole('button', { name: /Notifications/ });
    await expect(bellButton).toBeVisible();
  });

  test('clicking the bell opens dropdown panel with "Notifications" heading', async ({ page }) => {
    const bellButton = page.getByRole('button', { name: /Notifications/ });
    await bellButton.click();

    const panel = page.locator('[role="dialog"][aria-label="Notifications"]');
    await expect(panel).toBeVisible();

    // Panel header
    await expect(panel.getByText('Notifications', { exact: true }).first()).toBeVisible();
  });

  test('"Mark all read" button is visible when notifications exist, or empty state is shown', async ({ page }) => {
    const bellButton = page.getByRole('button', { name: /Notifications/ });
    await bellButton.click();

    const panel = page.locator('[role="dialog"][aria-label="Notifications"]');
    await expect(panel).toBeVisible();

    // Either "Mark all read" is visible (notifications exist) or empty state is shown
    const markAllRead = panel.getByText('Mark all read');
    const emptyState = panel.getByText('No notifications');

    const hasNotifications = await markAllRead.isVisible().catch(() => false);
    const hasEmptyState = await emptyState.isVisible().catch(() => false);

    expect(hasNotifications || hasEmptyState).toBe(true);

    if (hasEmptyState) {
      await expect(panel.getByText("You're all caught up")).toBeVisible();
    }
  });

  test('panel can be dismissed by pressing Escape', async ({ page }) => {
    const bellButton = page.getByRole('button', { name: /Notifications/ });
    await bellButton.click();

    const panel = page.locator('[role="dialog"][aria-label="Notifications"]');
    await expect(panel).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
  });

  test('panel can be dismissed by clicking outside', async ({ page }) => {
    const bellButton = page.getByRole('button', { name: /Notifications/ });
    await bellButton.click();

    const panel = page.locator('[role="dialog"][aria-label="Notifications"]');
    await expect(panel).toBeVisible();

    // Click on the page body, far from the panel
    await page.locator('body').click({ position: { x: 10, y: 10 }, force: true });
    await expect(panel).toBeHidden();
  });
});
