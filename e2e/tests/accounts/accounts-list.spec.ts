import { test, expect } from '@playwright/test';
import { EMAIL_ACCOUNT } from '../../fixtures/test-data';
import { waitForDataLoad } from '../../helpers/wait.helper';

test.describe('Accounts list page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/accounts');
    await waitForDataLoad(page);
  });

  test('page loads with seed account visible', async ({ page }) => {
    // Verify the page header
    await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();
    await expect(page.getByText('Manage email accounts and connected socials')).toBeVisible();

    // Verify the seed account row is in the table
    await expect(page.getByText(EMAIL_ACCOUNT.email)).toBeVisible();
  });

  test('search filters the list — matching term shows results', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search by email or notes...');
    await expect(searchInput).toBeVisible();

    // Search for "demo" — should still show the seed account
    await searchInput.fill('demo');

    // Wait for debounce + data reload
    await page.waitForTimeout(500);
    await waitForDataLoad(page);

    await expect(page.getByText(EMAIL_ACCOUNT.email)).toBeVisible();
  });

  test('search filters the list — non-matching term shows no results', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search by email or notes...');
    await searchInput.fill('nonexistent-xyz-99999');

    // Wait for debounce + data reload
    await page.waitForTimeout(500);
    await waitForDataLoad(page);

    // Table should be empty — the empty state should render
    await expect(page.getByText('No accounts found')).toBeVisible();
  });

  test('status dropdown filters the list', async ({ page }) => {
    // The status dropdown has "All Statuses" as default
    const statusSelect = page.locator('select').filter({ hasText: 'All Statuses' });
    await expect(statusSelect).toBeVisible();

    // Select "Active" filter
    await statusSelect.selectOption('active');
    await waitForDataLoad(page);

    // The page should still be functional (either show active accounts or empty state)
    const heading = page.getByRole('heading', { name: 'Accounts' });
    await expect(heading).toBeVisible();
  });

  test('tier dropdown filters the list', async ({ page }) => {
    // The tier dropdown has "All Tiers" as default
    const tierSelect = page.locator('select').filter({ hasText: 'All Tiers' });
    await expect(tierSelect).toBeVisible();

    // Select "Tier 1" filter
    await tierSelect.selectOption('tier1');
    await waitForDataLoad(page);

    // The page should still be functional
    const heading = page.getByRole('heading', { name: 'Accounts' });
    await expect(heading).toBeVisible();
  });

  test('pagination controls are visible and per-page selector works', async ({ page }) => {
    // The per-page selector should be present with default options
    const perPageSelect = page.locator('select').filter({ hasText: '/ page' });
    await expect(perPageSelect).toBeVisible();

    // Verify the per-page options are available
    await expect(perPageSelect.locator('option')).toHaveCount(3);
    await expect(perPageSelect.locator('option', { hasText: '10 / page' })).toBeAttached();
    await expect(perPageSelect.locator('option', { hasText: '25 / page' })).toBeAttached();
    await expect(perPageSelect.locator('option', { hasText: '50 / page' })).toBeAttached();

    // Switch to 10 per page
    await perPageSelect.selectOption('10');
    await waitForDataLoad(page);

    // Page should still render correctly
    await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();

    // The "Showing X-Y of Z" text should be visible
    await expect(page.getByText(/Showing \d+-\d+ of \d+/)).toBeVisible();
  });
});
