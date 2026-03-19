import { test, expect } from '@playwright/test';
import { CONTENT, CHANNEL } from '../../fixtures/test-data';
import { waitForToast, waitForDataLoad, resetContentStatus } from '../../helpers/wait.helper';
import { apiPost, apiPut } from '../../helpers/api.helper';

test.describe('Content approval flow', () => {
  test('approvals page shows seed pending_approval item', async ({ page }) => {
    await page.goto('/approvals');
    await waitForDataLoad(page);
    // Ensure the seed item is in pending_approval state
    await resetContentStatus(page, CONTENT.pendingApproval.id, 'pending_approval');
    await page.reload();
    await waitForDataLoad(page);

    // Page title
    await expect(page.getByRole('main').getByRole('heading', { name: 'Approval Queue' })).toBeVisible();

    // The seed pending_approval item should be listed
    await expect(page.getByText(CONTENT.pendingApproval.title).first()).toBeVisible();

    // Channel name should be shown in the item detail
    await expect(page.getByText(CHANNEL.name).first()).toBeVisible();
  });

  test('approve a pending content item via UI and see toast confirmation', async ({ page }) => {
    await page.goto('/approvals');
    await waitForDataLoad(page);

    // Verify the seed item is present
    const itemTitle = CONTENT.pendingApproval.title;
    await expect(page.getByText(itemTitle).first()).toBeVisible();

    // Find the approval card containing the item title and click its Approve button
    const itemCard = page.locator('.card').filter({ hasText: itemTitle }).first();
    const approveButton = itemCard.getByRole('button', { name: 'Approve' });
    await expect(approveButton).toBeVisible();
    await approveButton.click();

    // Wait for the success toast
    await waitForToast(page, 'Content approved');

    // After approval, the item should no longer appear in the pending queue
    // (the page auto-refreshes via SWR mutate)
    await expect(page.getByText(itemTitle)).not.toBeVisible({ timeout: 10_000 });
  });

  test('approved item no longer appears in the approval queue on reload', async ({ page }) => {
    // First, ensure the item is in pending_approval state by resetting it via API
    // Use the API helper to reset the item back to pending_approval before this test
    await page.goto('/approvals');
    await waitForDataLoad(page);

    // Use the API to put the item back to pending_approval if needed
    await apiPut(page, `/api/v1/content/${CONTENT.pendingApproval.id}`, {
      status: 'pending_approval',
    });

    // Reload the page so the reset takes effect
    await page.reload();
    await waitForDataLoad(page);

    // The item should be visible again
    await expect(page.getByText(CONTENT.pendingApproval.title).first()).toBeVisible();

    // Now approve it
    const itemCard = page.locator('.card').filter({ hasText: CONTENT.pendingApproval.title }).first();
    const approveButton = itemCard.getByRole('button', { name: 'Approve' });
    await approveButton.click();

    await waitForToast(page, 'Content approved');

    // Reload the page to confirm persistence
    await page.reload();
    await waitForDataLoad(page);

    // The item should not be in the pending queue after reload
    // Either it's gone entirely, or if the queue is now empty we see the empty state
    const itemVisible = await page.getByText(CONTENT.pendingApproval.title).isVisible().catch(() => false);
    const emptyState = await page.getByText('All caught up!').isVisible().catch(() => false);

    // Either the item is gone from the list, or the entire queue is empty
    expect(itemVisible === false || emptyState === true).toBeTruthy();
  });

  test('reject button opens confirm dialog', async ({ page }) => {
    // Reset item to pending_approval via API
    await page.goto('/approvals');
    await waitForDataLoad(page);
    await apiPut(page, `/api/v1/content/${CONTENT.pendingApproval.id}`, {
      status: 'pending_approval',
    });
    await page.reload();
    await waitForDataLoad(page);

    // Find the item and click Reject
    const itemCard = page.locator('.card').filter({ hasText: CONTENT.pendingApproval.title }).first();
    const rejectButton = itemCard.getByRole('button', { name: 'Reject' });
    await expect(rejectButton).toBeVisible();
    await rejectButton.click();

    // ConfirmDialog should open with "Reject Content" title
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Reject Content')).toBeVisible();
    await expect(dialog.getByText('moved back to draft')).toBeVisible();

    // Confirm button should say "Reject"
    const confirmButton = dialog.getByRole('button', { name: 'Reject' });
    await expect(confirmButton).toBeVisible();

    // Cancel the dialog
    const cancelButton = dialog.getByRole('button', { name: 'Cancel' });
    await cancelButton.click();

    // Dialog should close
    await expect(dialog).not.toBeVisible();

    // Item should still be in the queue
    await expect(page.getByText(CONTENT.pendingApproval.title).first()).toBeVisible();
  });

  test('bulk select and approve flow', async ({ page }) => {
    // Reset item to pending_approval via API
    await page.goto('/approvals');
    await waitForDataLoad(page);
    await apiPut(page, `/api/v1/content/${CONTENT.pendingApproval.id}`, {
      status: 'pending_approval',
    });
    await page.reload();
    await waitForDataLoad(page);

    // Click "Select all" checkbox
    const selectAllCheckbox = page.getByLabel('Select all');
    await expect(selectAllCheckbox).toBeVisible();
    await selectAllCheckbox.check();

    // Bulk actions toolbar should appear with "selected" count
    await expect(page.getByText(/\d+ selected/)).toBeVisible();

    // "Approve All" button should be visible in the bulk toolbar
    const approveAllButton = page.getByRole('button', { name: 'Approve All' });
    await expect(approveAllButton).toBeVisible();
  });
});
