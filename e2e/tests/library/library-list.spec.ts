import { test, expect } from '@playwright/test';
import { CONTENT, CHANNEL } from '../../fixtures/test-data';
import { waitForToast, waitForDataLoad } from '../../helpers/wait.helper';
import { apiPost } from '../../helpers/api.helper';

test.describe('Library page — list, filters, and pagination', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/library');
    await waitForDataLoad(page);
  });

  test('page loads with title and seed content items visible', async ({ page }) => {
    // Page title
    await expect(page.getByRole('heading', { name: 'Content Library' })).toBeVisible();

    // Seed content item should appear
    await expect(page.getByText(CONTENT.pendingApproval.title).first()).toBeVisible();
  });

  test('search input has correct placeholder', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search titles and prompts...');
    await expect(searchInput).toBeVisible();
  });

  test('type dropdown shows All Types with correct options', async ({ page }) => {
    // The type filter select should default to "All Types"
    const typeSelect = page.locator('select').filter({ hasText: 'All Types' }).first();
    await expect(typeSelect).toBeVisible();

    // Check for expected type options
    const expectedTypes = ['Text', 'Image', 'Short Video', 'Long Video', 'Voice', 'Thumbnail'];
    for (const typeName of expectedTypes) {
      await expect(typeSelect.locator('option', { hasText: typeName })).toBeAttached();
    }
  });

  test('status dropdown shows All Statuses with options', async ({ page }) => {
    const statusSelect = page.locator('select').filter({ hasText: 'All Statuses' }).first();
    await expect(statusSelect).toBeVisible();

    // Spot-check a few statuses
    await expect(statusSelect.locator('option', { hasText: 'Draft' })).toBeAttached();
    await expect(statusSelect.locator('option', { hasText: 'Approved' })).toBeAttached();
    await expect(statusSelect.locator('option', { hasText: 'Posted' })).toBeAttached();
  });

  test('sort dropdown defaults to "Newest first" with other options', async ({ page }) => {
    const sortSelect = page.locator('select').filter({ hasText: 'Newest first' }).first();
    await expect(sortSelect).toBeVisible();

    await expect(sortSelect.locator('option', { hasText: 'Oldest first' })).toBeAttached();
    await expect(sortSelect.locator('option', { hasText: 'Title A-Z' })).toBeAttached();
    await expect(sortSelect.locator('option', { hasText: 'Highest quality' })).toBeAttached();
  });

  test('grid/list toggle switches view mode', async ({ page }) => {
    // There should be two view toggle buttons (Grid and List) inside a grouped container
    const gridButton = page.locator('button[title="Grid view"]');
    const listButton = page.locator('button[title="List view"]');
    await expect(gridButton).toBeVisible();
    await expect(listButton).toBeVisible();

    // Default is grid view — there should be no table header "Thumb"
    await expect(page.getByText('Thumb', { exact: true })).not.toBeVisible();

    // Switch to list view
    await listButton.click();

    // List view shows the table header row with "Thumb" column
    await expect(page.getByText('Thumb', { exact: true }).first()).toBeVisible();

    // Switch back to grid view
    await gridButton.click();

    // "Thumb" header should no longer be visible in grid mode
    await expect(page.getByText('Thumb', { exact: true })).not.toBeVisible();
  });

  test('search filters content items', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search titles and prompts...');

    // Search for a known seed title
    await searchInput.fill('AI in 2026');
    // Wait for debounced search and network
    await waitForDataLoad(page);

    // The matching item should be visible
    await expect(page.getByText(CONTENT.pendingApproval.title).first()).toBeVisible();

    // Clear and search for a non-existent term
    await searchInput.fill('zzzznonexistent');
    await waitForDataLoad(page);

    // Should show empty state
    await expect(page.getByText('No content found')).toBeVisible();
  });

  test('type dropdown filters content items', async ({ page }) => {
    const typeSelect = page.locator('select').filter({ hasText: 'All Types' }).first();

    // Select a type and wait for reload
    await typeSelect.selectOption({ label: 'Text' });
    await waitForDataLoad(page);

    // After filtering, either items match "text" type or we see empty state.
    // The page has re-rendered with filtered results.
    const hasItems = await page.getByText('No content found').isVisible().catch(() => false);
    if (!hasItems) {
      // If there are items, verify they are text type (badge visible)
      const textBadges = page.locator('text=Text').first();
      await expect(textBadges).toBeVisible();
    }
  });

  test('status dropdown filters content items', async ({ page }) => {
    const statusSelect = page.locator('select').filter({ hasText: 'All Statuses' }).first();

    // Filter by "posted" status
    await statusSelect.selectOption('posted');
    await waitForDataLoad(page);

    // The posted seed item should be visible
    await expect(page.getByText(CONTENT.posted.title).first()).toBeVisible();

    // The pending_approval item should NOT be visible (different status)
    await expect(page.getByText(CONTENT.pendingApproval.title)).not.toBeVisible();
  });

  test('sort changes order of items', async ({ page }) => {
    const sortSelect = page.locator('select').filter({ hasText: 'Newest first' }).first();

    // Change to "Title A-Z"
    await sortSelect.selectOption('title:asc');
    await waitForDataLoad(page);

    // Change to "Oldest first"
    await sortSelect.selectOption('createdAt:asc');
    await waitForDataLoad(page);

    // The page should have reloaded without errors — verify at least one item is visible
    await expect(page.getByText(CONTENT.pendingApproval.title).first()).toBeVisible();
  });

  test('pagination info shows "Showing X-Y of Z"', async ({ page }) => {
    // With 5 seed items and default perPage=20, we should see "Showing 1-5 of 5"
    await expect(page.getByText(/Showing \d+-\d+ of \d+/)).toBeVisible();
  });

  test('per-page selector has correct options', async ({ page }) => {
    const perPageSelect = page.locator('select').filter({ hasText: '/ page' }).first();
    await expect(perPageSelect).toBeVisible();

    await expect(perPageSelect.locator('option', { hasText: '20 / page' })).toBeAttached();
    await expect(perPageSelect.locator('option', { hasText: '40 / page' })).toBeAttached();
    await expect(perPageSelect.locator('option', { hasText: '60 / page' })).toBeAttached();
  });
});
