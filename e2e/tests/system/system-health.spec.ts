import { test, expect } from '@playwright/test';
import { waitForToast } from '../../helpers/wait.helper';

test.describe('System health page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/system');
    await page.waitForLoadState('networkidle');
  });

  test('page loads with "System Health" heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'System Health' })).toBeVisible();

    // Status dot and overall status text should be adjacent to heading
    // The status dot is a span with rounded-full class
    const statusDot = page.locator('span.rounded-full').first();
    await expect(statusDot).toBeVisible();

    // Overall status text (e.g., "healthy", "degraded", "unknown")
    const statusText = page.locator('span.capitalize').filter({ hasText: /healthy|degraded|unhealthy|critical|unknown/ });
    await expect(statusText.first()).toBeVisible();
  });

  test('CPU, RAM, Disk resource cards visible with percentages', async ({ page }) => {
    const resourceLabels = ['CPU', 'RAM', 'Disk'];

    for (const label of resourceLabels) {
      // Each resource card shows the label and a percentage value
      const card = page.locator('.card').filter({ hasText: label });
      await expect(card.first()).toBeVisible();

      // Verify the percentage text is present (e.g., "42%")
      await expect(card.first().getByText(/\d+%/)).toBeVisible();
    }

    // Verify progress bars are rendered (h-2.5 rounded-full bars inside resource cards)
    const progressBars = page.locator('.h-2\\.5.rounded-full.bg-bg-tertiary');
    await expect(progressBars.first()).toBeVisible();
  });

  test('services section visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Services' })).toBeVisible();

    // Known default services should be displayed
    const expectedServices = ['PostgreSQL', 'Next.js Web', 'Workflow Engine', 'Ollama', 'BullMQ Workers', 'MinIO'];

    for (const service of expectedServices) {
      await expect(page.getByText(service, { exact: false }).first()).toBeVisible();
    }

    // Each service card should have a health status dot
    const serviceDots = page.locator('.h-2\\.5.w-2\\.5.rounded-full');
    const dotCount = await serviceDots.count();
    expect(dotCount).toBeGreaterThanOrEqual(expectedServices.length);
  });

  test('alerts section visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Alerts' })).toBeVisible();

    // Either alert cards are visible or the "No active alerts" message
    const noAlerts = page.getByText('No active alerts');
    const alertCard = page.locator('.card.border-l-4');

    const hasNoAlerts = await noAlerts.isVisible().catch(() => false);
    const hasAlertCards = await alertCard.first().isVisible().catch(() => false);

    // One of the two states must be present
    expect(hasNoAlerts || hasAlertCards).toBeTruthy();
  });

  test('refresh button works', async ({ page }) => {
    const refreshButton = page.getByRole('button', { name: 'Refresh health data' });
    await expect(refreshButton).toBeVisible();

    // Click refresh
    await refreshButton.click();

    // Verify toast appears confirming refresh
    await waitForToast(page, 'Refreshing health data...');

    // Verify the page does not error out — heading should still be visible
    await expect(page.getByRole('heading', { name: 'System Health' })).toBeVisible();
  });
});
