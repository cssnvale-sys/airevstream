import { test, expect } from '@playwright/test';
import { CONTENT } from '../../fixtures/test-data';
import { waitForToast, waitForDataLoad } from '../../helpers/wait.helper';

test.describe('Calendar page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/calendar');
    await waitForDataLoad(page);
  });

  test('page loads with Content Calendar heading', async ({ page }) => {
    await expect(
      page.getByRole('main').getByRole('heading', { name: 'Content Calendar' })
    ).toBeVisible();
  });

  test('date range subtitle is displayed', async ({ page }) => {
    // The subtitle shows a date range like "Mar 16 – Mar 22, 2026"
    await expect(
      page.getByText(/[A-Z][a-z]{2} \d{1,2}\s.*\d{1,2}, \d{4}/)
    ).toBeVisible();
  });

  test('calendar grid renders with day headers', async ({ page }) => {
    const grid = page.locator('[role="grid"]');
    await expect(grid).toBeVisible();

    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    for (const day of dayNames) {
      await expect(grid.getByText(day, { exact: true })).toBeVisible();
    }
  });

  test('calendar grid has time slot labels', async ({ page }) => {
    const grid = page.locator('[role="grid"]');
    const timeLabels = ['8am', '10am', '12pm', '2pm', '4pm', '6pm'];

    for (const label of timeLabels) {
      await expect(grid.getByText(label, { exact: true })).toBeVisible();
    }
  });

  test('view toggle buttons are present for day, week, month', async ({ page }) => {
    // day and month are disabled (not yet implemented) but still visible in the DOM
    // Use exact: true to avoid matching "Today", "Previous week", "Next week"
    await expect(page.getByRole('button', { name: 'day', exact: true })).toBeAttached();
    await expect(page.getByRole('button', { name: 'week', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'month', exact: true })).toBeAttached();
  });

  test('week view is active by default', async ({ page }) => {
    const weekButton = page.getByRole('button', { name: 'week', exact: true });
    await expect(weekButton).toBeVisible();
    await expect(weekButton).toHaveClass(/bg-accent-blue/);
  });

  test('previous week navigation changes the date range', async ({ page }) => {
    // Capture the current date range text from the subtitle below the heading
    const subtitle = page.getByRole('main').locator('p').first();
    const initialText = await subtitle.textContent();

    await page.getByRole('button', { name: 'Previous week' }).click();
    await waitForDataLoad(page);

    const updatedText = await subtitle.textContent();
    expect(updatedText).not.toBe(initialText);
  });

  test('next week navigation changes the date range', async ({ page }) => {
    const subtitle = page.getByRole('main').locator('p').first();
    const initialText = await subtitle.textContent();

    await page.getByRole('button', { name: 'Next week' }).click();
    await waitForDataLoad(page);

    const updatedText = await subtitle.textContent();
    expect(updatedText).not.toBe(initialText);
  });

  test('Today button resets to current week', async ({ page }) => {
    await page.getByRole('button', { name: 'Next week' }).click();
    await waitForDataLoad(page);

    const subtitle = page.getByRole('main').locator('p').first();
    const awayText = await subtitle.textContent();

    await page.getByRole('button', { name: 'Today' }).click();
    await waitForDataLoad(page);

    const todayText = await subtitle.textContent();
    expect(todayText).not.toBe(awayText);
  });

  test('channel filter dropdown is present with "All Channels" default', async ({ page }) => {
    const channelSelect = page.locator('select').filter({ hasText: 'All Channels' });
    await expect(channelSelect).toBeVisible();
    await expect(channelSelect.locator('option', { hasText: 'All Channels' })).toBeAttached();
  });

  test('platform filter dropdown is present with options', async ({ page }) => {
    const platformSelect = page.locator('select').filter({ hasText: 'All Platforms' });
    await expect(platformSelect).toBeVisible();

    await expect(platformSelect.locator('option', { hasText: 'All Platforms' })).toBeAttached();
    await expect(platformSelect.locator('option', { hasText: 'Youtube' })).toBeAttached();
    await expect(platformSelect.locator('option', { hasText: 'Tiktok' })).toBeAttached();
    await expect(platformSelect.locator('option', { hasText: 'Instagram' })).toBeAttached();
    await expect(platformSelect.locator('option', { hasText: 'Facebook' })).toBeAttached();
  });

  test('language filter dropdown is present', async ({ page }) => {
    const languageSelect = page.locator('select').filter({ hasText: 'All Languages' });
    await expect(languageSelect).toBeVisible();

    await expect(languageSelect.locator('option', { hasText: 'All Languages' })).toBeAttached();
    await expect(languageSelect.locator('option', { hasText: 'EN' })).toBeAttached();
  });

  test('status filter dropdown is present', async ({ page }) => {
    const statusSelect = page.locator('select').filter({ hasText: 'All Statuses' });
    await expect(statusSelect).toBeVisible();

    await expect(statusSelect.locator('option', { hasText: 'All Statuses' })).toBeAttached();
    await expect(statusSelect.locator('option', { hasText: 'Posted' })).toBeAttached();
    await expect(statusSelect.locator('option', { hasText: 'Scheduled' })).toBeAttached();
  });

  test('color-by dropdown is present with options', async ({ page }) => {
    const colorBySelect = page.locator('select').filter({ hasText: 'Color by Status' });
    await expect(colorBySelect).toBeVisible();

    await expect(colorBySelect.locator('option', { hasText: 'Color by Status' })).toBeAttached();
    await expect(colorBySelect.locator('option', { hasText: 'Color by Platform' })).toBeAttached();
    await expect(colorBySelect.locator('option', { hasText: 'Color by Channel' })).toBeAttached();
  });

  test('channel filter can be changed', async ({ page }) => {
    const channelSelect = page.locator('select').filter({ hasText: 'All Channels' });
    await expect(channelSelect).toBeVisible();

    const options = channelSelect.locator('option');
    const count = await options.count();

    if (count > 1) {
      const secondOption = await options.nth(1).getAttribute('value');
      if (secondOption) {
        await channelSelect.selectOption(secondOption);
        await waitForDataLoad(page);
      }
    }

    await expect(
      page.getByRole('main').getByRole('heading', { name: 'Content Calendar' })
    ).toBeVisible();
  });

  test('platform filter can be changed', async ({ page }) => {
    const platformSelect = page.locator('select').filter({ hasText: 'All Platforms' });
    await platformSelect.selectOption('youtube');
    await waitForDataLoad(page);

    await expect(
      page.getByRole('main').getByRole('heading', { name: 'Content Calendar' })
    ).toBeVisible();
  });

  test('legend is visible with all status indicators', async ({ page }) => {
    // Legend items — scope to main to avoid matching status dropdown options
    const main = page.getByRole('main');
    // The legend is the last section at the bottom — use span elements which are the legend labels
    await expect(main.locator('span').filter({ hasText: 'Posted' })).toBeVisible();
    await expect(main.locator('span').filter({ hasText: 'Scheduled' })).toBeVisible();
    await expect(main.getByText('Needs Approval', { exact: true })).toBeVisible();
    await expect(main.locator('span').filter({ hasText: 'Failed' })).toBeVisible();
  });
});
