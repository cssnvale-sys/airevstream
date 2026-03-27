import { test, expect } from '@playwright/test';
import { CONTENT } from '../../fixtures/test-data';
import { waitForDataLoad } from '../../helpers/wait.helper';

test.describe('Dashboard page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await waitForDataLoad(page);
  });

  test('page loads with greeting text', async ({ page }) => {
    // Greeting should contain one of the time-of-day variants
    const greeting = page.locator('text=/Good (morning|afternoon|evening)/');
    await expect(greeting.first()).toBeVisible();
  });

  test('4 KPI cards are visible', async ({ page }) => {
    const kpiLabels = ['Pending Approvals', 'Posted Today', 'Accounts Healthy', 'Revenue'];

    for (const label of kpiLabels) {
      await expect(page.getByText(label, { exact: false }).first()).toBeVisible();
    }
  });

  test('approval queue shows seed pending item', async ({ page }) => {
    // Verify the approval queue section heading
    await expect(page.getByRole('heading', { name: 'Approval Queue' })).toBeVisible();

    // The seed content item with pending_approval status should appear
    await expect(
      page.getByText(CONTENT.pendingApproval.title).first()
    ).toBeVisible();
  });

  test('system health metrics are displayed', async ({ page }) => {
    // System health section should show CPU and RAM labels
    await expect(page.getByText('CPU').first()).toBeVisible();
    await expect(page.getByText('RAM').first()).toBeVisible();
  });

  test('platform coverage section is visible', async ({ page }) => {
    const platforms = ['YouTube', 'TikTok', 'Instagram', 'Facebook'];

    for (const platform of platforms) {
      await expect(page.getByText(platform, { exact: false }).first()).toBeVisible();
    }
  });
});
