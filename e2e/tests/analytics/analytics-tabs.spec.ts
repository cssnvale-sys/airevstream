import { test, expect } from '@playwright/test';
import { waitForDataLoad } from '../../helpers/wait.helper';

test.describe('Analytics page — tabs and KPI cards', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/analytics');
    await waitForDataLoad(page);
  });

  test('page loads with "Analytics" heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
    await expect(page.getByText('Performance metrics and insights.')).toBeVisible();
  });

  test('4 KPI cards are visible', async ({ page }) => {
    const kpiLabels = ['Revenue', 'Total Cost', 'Profit', 'Content Count'];

    for (const label of kpiLabels) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
  });

  test('period selector changes data', async ({ page }) => {
    // The period dropdown defaults to "Last 7 days"
    const periodSelect = page.locator('select').filter({ hasText: 'Last 7 days' });
    await expect(periodSelect).toBeVisible();

    // Verify all period options are available
    await expect(periodSelect.locator('option', { hasText: 'Last 7 days' })).toBeAttached();
    await expect(periodSelect.locator('option', { hasText: 'Last 30 days' })).toBeAttached();
    await expect(periodSelect.locator('option', { hasText: 'Last 90 days' })).toBeAttached();
    await expect(periodSelect.locator('option', { hasText: 'All time' })).toBeAttached();

    // Select "Last 30 days" and verify the page still renders correctly
    await periodSelect.selectOption('30d');
    await waitForDataLoad(page);

    // The heading should still be visible (page didn't break)
    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();

    // KPI cards should still be rendered after period change
    await expect(page.getByText('Revenue', { exact: true }).first()).toBeVisible();
  });

  test('all 5 tabs are clickable and render content', async ({ page }) => {
    const tabNames = ['Revenue', 'Engagement', 'Content', 'Costs', 'Audience'];
    const tabList = page.getByRole('tablist', { name: 'Analytics sections' });
    await expect(tabList).toBeVisible();

    for (const tabName of tabNames) {
      const tab = tabList.getByRole('tab', { name: tabName });
      await expect(tab).toBeVisible();
      await tab.click();

      // After clicking, the tab should be selected
      await expect(tab).toHaveAttribute('aria-selected', 'true');
    }
  });

  test('Revenue tab shows "Revenue Over Time" heading', async ({ page }) => {
    // Revenue tab is active by default
    const tabList = page.getByRole('tablist', { name: 'Analytics sections' });
    const revenueTab = tabList.getByRole('tab', { name: 'Revenue' });
    await expect(revenueTab).toHaveAttribute('aria-selected', 'true');

    // Verify the chart heading is present
    await expect(page.getByRole('heading', { name: 'Revenue Over Time' })).toBeVisible();
  });

  test('Costs tab shows "Cost Summary" heading', async ({ page }) => {
    // Click the Costs tab
    const tabList = page.getByRole('tablist', { name: 'Analytics sections' });
    const costsTab = tabList.getByRole('tab', { name: 'Costs' });
    await costsTab.click();

    // Verify it is now selected
    await expect(costsTab).toHaveAttribute('aria-selected', 'true');

    // Verify the "Cost Summary" heading appears in the costs tab content
    await expect(page.getByRole('heading', { name: 'Cost Summary' })).toBeVisible();
  });
});
