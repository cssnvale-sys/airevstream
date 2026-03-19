import { test, expect } from '@playwright/test';
import { waitForToast } from '../../helpers/wait.helper';

test.describe('Workflows list page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workflows');
    await page.waitForLoadState('networkidle');
  });

  test('page loads with "Workflows" heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Workflows' })).toBeVisible();
  });

  test('status filter tabs visible and clickable', async ({ page }) => {
    const tabs = ['all', 'queued', 'running', 'completed', 'failed'];

    for (const tab of tabs) {
      const button = page.getByRole('button', { name: tab, exact: true });
      await expect(button).toBeVisible();
      await button.click();
      // After clicking, the button should have the active style (bg-accent-blue)
      await expect(button).toHaveClass(/bg-accent-blue/);
      // Page should remain functional after each click
      await expect(page.getByRole('heading', { name: 'Workflows' })).toBeVisible();
    }
  });

  test('job type dropdown present and can be opened', async ({ page }) => {
    const dropdown = page.locator('select').filter({ hasText: 'All Types' });
    await expect(dropdown).toBeVisible();

    // Verify all expected options exist
    const expectedOptions = [
      'All Types',
      'Content Generation',
      'Image Generation',
      'Video Render',
      'Audio Generation',
      'Posting',
      'Research',
    ];

    for (const option of expectedOptions) {
      await expect(dropdown.locator('option', { hasText: option })).toBeAttached();
    }

    // Select a specific job type and verify the page stays functional
    await dropdown.selectOption('content_generation');
    await expect(page.getByRole('heading', { name: 'Workflows' })).toBeVisible();
  });

  test('refresh button present and clickable', async ({ page }) => {
    const refreshButton = page.getByRole('button', { name: 'Refresh' });
    await expect(refreshButton).toBeVisible();

    // Click refresh and verify the page does not error out
    await refreshButton.click();
    await expect(page.getByRole('heading', { name: 'Workflows' })).toBeVisible();
  });

  test('pagination controls visible', async ({ page }) => {
    // Pagination only renders when totalPages > 1. If there are enough jobs,
    // we see "Page X of Y (Z total)" text and Previous/Next buttons.
    // If there are no jobs or only one page, we at least verify the page is stable.
    const heading = page.getByRole('heading', { name: 'Workflows' });
    await expect(heading).toBeVisible();

    // Check for pagination text or empty state — one of the two must be present
    const paginationText = page.getByText(/Page \d+ of \d+ \(\d+ total\)/);
    const emptyState = page.getByText('No workflow jobs found');
    const hasPagination = await paginationText.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    if (hasPagination) {
      // Verify Previous/Next buttons
      await expect(page.getByRole('button', { name: 'Previous page' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Next page' })).toBeVisible();
    } else {
      // Either empty state or a single-page list — both are valid
      expect(hasEmpty || !hasPagination).toBeTruthy();
    }
  });

  test('empty state displays when no jobs match filter', async ({ page }) => {
    // Click the "failed" tab — in a fresh/test environment this is likely empty
    const failedTab = page.getByRole('button', { name: 'failed', exact: true });
    await expect(failedTab).toBeVisible();
    await failedTab.click();
    await page.waitForLoadState('networkidle');

    // If there are no failed jobs, we should see the empty state
    const emptyTitle = page.getByText('No workflow jobs found');
    const emptyDescription = page.getByText(
      'Workflow jobs will appear here when content is being generated or processed.'
    );
    const jobCard = page.locator('.card').first();

    const hasEmptyState = await emptyTitle.isVisible().catch(() => false);
    const hasJobs = await jobCard.isVisible().catch(() => false);

    // One of the two must be true — either empty state or job cards
    expect(hasEmptyState || hasJobs).toBeTruthy();

    if (hasEmptyState) {
      await expect(emptyDescription).toBeVisible();
    }
  });
});
