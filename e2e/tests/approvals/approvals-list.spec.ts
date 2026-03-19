import { test, expect } from '@playwright/test';
import { CONTENT } from '../../fixtures/test-data';
import { waitForToast } from '../../helpers/wait.helper';

test.describe('Approvals list page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/approvals');
    await page.waitForLoadState('networkidle');
  });

  test('page loads with approval queue heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Approval Queue' })
    ).toBeVisible();
  });

  test('seed pending content item is visible', async ({ page }) => {
    // The seed data includes a pending_approval item titled "AI in 2026: What Changed Everything"
    await expect(
      page.getByText(CONTENT.pendingApproval.title).first()
    ).toBeVisible();
  });

  test('content type filter dropdown is present with options', async ({ page }) => {
    const typeSelect = page.locator('select').filter({ hasText: 'All Types' });
    await expect(typeSelect).toBeVisible();

    // Verify expected content type options exist
    await expect(typeSelect.locator('option', { hasText: 'All Types' })).toBeAttached();
    await expect(typeSelect.locator('option', { hasText: 'Video Short' })).toBeAttached();
    await expect(typeSelect.locator('option', { hasText: 'Video Long' })).toBeAttached();
    await expect(typeSelect.locator('option', { hasText: 'Image' })).toBeAttached();
  });

  test('pending count text is displayed', async ({ page }) => {
    // The page shows "{total} pending" next to the filter
    await expect(page.getByText(/\d+ pending/)).toBeVisible();
  });

  test('content cards have checkboxes', async ({ page }) => {
    // Each card has a checkbox with aria-label "Select {title}"
    const checkboxes = page.locator('input[type="checkbox"]');
    // At least 1 item checkbox + the "Select all" checkbox
    await expect(checkboxes.first()).toBeVisible();

    // Verify the "Select all" checkbox exists
    await expect(
      page.getByRole('checkbox', { name: 'Select all' })
    ).toBeVisible();
  });

  test('content cards display title and metadata', async ({ page }) => {
    // Each card shows title, channel name, content type, and relative time
    const card = page.locator('.card').filter({ hasText: CONTENT.pendingApproval.title });
    await expect(card).toBeVisible();

    // Metadata line includes channel name (or "No channel"), content type, and time
    await expect(card.getByText(/video_short|video_long|image|article|post/)).toBeVisible();
  });

  test('checkboxes can be selected and deselected', async ({ page }) => {
    // Click the first item checkbox (skip "Select all" which is the first checkbox)
    const itemCheckbox = page.locator('input[type="checkbox"]').nth(1);
    await expect(itemCheckbox).toBeVisible();

    // Select
    await itemCheckbox.check();
    await expect(itemCheckbox).toBeChecked();

    // Deselect
    await itemCheckbox.uncheck();
    await expect(itemCheckbox).not.toBeChecked();
  });

  test('bulk action toolbar appears when items are selected', async ({ page }) => {
    // Initially the bulk toolbar should not be visible
    await expect(page.getByText('Approve All')).not.toBeVisible();

    // Select an item via its checkbox
    const itemCheckbox = page.locator('input[type="checkbox"]').nth(1);
    await itemCheckbox.check();

    // Bulk toolbar should now appear with count and action buttons
    await expect(page.getByText(/\d+ selected/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve All' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reject All' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear' })).toBeVisible();
  });

  test('clear button dismisses the bulk action toolbar', async ({ page }) => {
    // Select an item
    const itemCheckbox = page.locator('input[type="checkbox"]').nth(1);
    await itemCheckbox.check();

    // Toolbar visible
    await expect(page.getByText(/\d+ selected/)).toBeVisible();

    // Click Clear
    await page.getByRole('button', { name: 'Clear' }).click();

    // Toolbar should disappear
    await expect(page.getByText(/\d+ selected/)).not.toBeVisible();
    await expect(itemCheckbox).not.toBeChecked();
  });

  test('select all checkbox toggles all items', async ({ page }) => {
    const selectAll = page.getByRole('checkbox', { name: 'Select all' });
    await selectAll.check();

    // All item checkboxes should be checked
    const allCheckboxes = page.locator('input[type="checkbox"]');
    const count = await allCheckboxes.count();
    for (let i = 0; i < count; i++) {
      await expect(allCheckboxes.nth(i)).toBeChecked();
    }

    // Bulk toolbar should show the selected count
    await expect(page.getByText(/\d+ selected/)).toBeVisible();
  });

  test('each card has Approve and Reject action buttons', async ({ page }) => {
    // Each card should have an Approve button and a Reject button
    const approveButtons = page.getByRole('button', { name: 'Approve', exact: true });
    const rejectButtons = page.getByRole('button', { name: 'Reject', exact: true });

    await expect(approveButtons.first()).toBeVisible();
    await expect(rejectButtons.first()).toBeVisible();
  });
});
