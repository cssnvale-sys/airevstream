import { test, expect } from '@playwright/test';
import { CONTENT } from '../../fixtures/test-data';
import { waitForToast } from '../../helpers/wait.helper';

test.describe('Calendar page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/calendar');
    await page.waitForLoadState('networkidle');
  });

  test('page loads with Content Calendar heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Content Calendar' })
    ).toBeVisible();
  });

  test('date range subtitle is displayed', async ({ page }) => {
    // The subtitle shows a date range like "Mar 16 - Mar 22, 2026"
    // Match the pattern: abbreviated month + day + dash + abbreviated month + day + comma + year
    await expect(
      page.getByText(/[A-Z][a-z]{2} \d{1,2}\s.*\d{1,2}, \d{4}/)
    ).toBeVisible();
  });

  test('calendar grid renders with day headers', async ({ page }) => {
    // The weekly grid should have day abbreviation headers (Mon, Tue, Wed, etc.)
    const grid = page.locator('[role="grid"]');
    await expect(grid).toBeVisible();

    // Check for day abbreviations in the header row
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    for (const day of dayNames) {
      await expect(grid.getByText(day, { exact: true })).toBeVisible();
    }
  });

  test('calendar grid has time slot labels', async ({ page }) => {
    // Time labels from 8am to 6pm in 2-hour steps
    const grid = page.locator('[role="grid"]');
    const timeLabels = ['8am', '10am', '12pm', '2pm', '4pm', '6pm'];

    for (const label of timeLabels) {
      await expect(grid.getByText(label, { exact: true })).toBeVisible();
    }
  });

  test('view toggle buttons are present for day, week, month', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'day' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'week' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'month' })).toBeVisible();
  });

  test('week view is active by default', async ({ page }) => {
    // The "week" button should have the active style (bg-accent-blue)
    const weekButton = page.getByRole('button', { name: 'week' });
    await expect(weekButton).toBeVisible();

    // The active button has the accent-blue background class
    await expect(weekButton).toHaveClass(/bg-accent-blue/);
  });

  test('previous week navigation changes the date range', async ({ page }) => {
    // Capture the current date range text
    const subtitle = page.locator('h1').locator('..').locator('p');
    const initialText = await subtitle.textContent();

    // Click "Previous week"
    await page.getByRole('button', { name: 'Previous week' }).click();
    await page.waitForLoadState('networkidle');

    // The date range text should change
    const updatedText = await subtitle.textContent();
    expect(updatedText).not.toBe(initialText);
  });

  test('next week navigation changes the date range', async ({ page }) => {
    // Capture the current date range text
    const subtitle = page.locator('h1').locator('..').locator('p');
    const initialText = await subtitle.textContent();

    // Click "Next week"
    await page.getByRole('button', { name: 'Next week' }).click();
    await page.waitForLoadState('networkidle');

    // The date range text should change
    const updatedText = await subtitle.textContent();
    expect(updatedText).not.toBe(initialText);
  });

  test('Today button resets to current week', async ({ page }) => {
    // Navigate away from current week first
    await page.getByRole('button', { name: 'Next week' }).click();
    await page.waitForLoadState('networkidle');

    const awayText = await page.locator('h1').locator('..').locator('p').textContent();

    // Click "Today" to return to current week
    await page.getByRole('button', { name: 'Today' }).click();
    await page.waitForLoadState('networkidle');

    const todayText = await page.locator('h1').locator('..').locator('p').textContent();
    expect(todayText).not.toBe(awayText);
  });

  test('channel filter dropdown is present with "All Channels" default', async ({ page }) => {
    const channelSelect = page.locator('select').filter({ hasText: 'All Channels' });
    await expect(channelSelect).toBeVisible();

    // Default value should be "All Channels"
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

    // Select a specific option if available (channels loaded from API)
    const options = channelSelect.locator('option');
    const count = await options.count();

    if (count > 1) {
      // Select the second option (first real channel after "All Channels")
      const secondOption = await options.nth(1).getAttribute('value');
      if (secondOption) {
        await channelSelect.selectOption(secondOption);
        await page.waitForLoadState('networkidle');
      }
    }

    // Page should remain functional
    await expect(
      page.getByRole('heading', { name: 'Content Calendar' })
    ).toBeVisible();
  });

  test('platform filter can be changed', async ({ page }) => {
    const platformSelect = page.locator('select').filter({ hasText: 'All Platforms' });
    await platformSelect.selectOption('youtube');
    await page.waitForLoadState('networkidle');

    // Page should remain functional after filtering
    await expect(
      page.getByRole('heading', { name: 'Content Calendar' })
    ).toBeVisible();
  });

  test('legend is visible with all status indicators', async ({ page }) => {
    // Legend items: Posted (green), Scheduled (amber), Needs Approval (purple), Failed (red)
    await expect(page.getByText('Posted', { exact: true })).toBeVisible();
    await expect(page.getByText('Scheduled', { exact: true })).toBeVisible();
    await expect(page.getByText('Needs Approval', { exact: true })).toBeVisible();
    await expect(page.getByText('Failed', { exact: true })).toBeVisible();
  });
});
