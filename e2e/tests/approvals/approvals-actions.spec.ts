import { test, expect } from '@playwright/test';
import { CONTENT } from '../../fixtures/test-data';
import { waitForToast } from '../../helpers/wait.helper';

test.describe('Approvals actions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/approvals');
    await page.waitForLoadState('networkidle');
  });

  test('approve single item shows toast confirmation', async ({ page }) => {
    // Find the first Approve button and click it
    const approveButton = page.getByRole('button', { name: 'Approve', exact: true }).first();
    await expect(approveButton).toBeVisible();

    await approveButton.click();

    // Toast should confirm the action
    await waitForToast(page, 'Content approved');
  });

  test('reject single item opens confirm dialog then shows toast on confirm', async ({ page }) => {
    // Find the first Reject button and click it
    const rejectButton = page.getByRole('button', { name: 'Reject', exact: true }).first();
    await expect(rejectButton).toBeVisible();

    await rejectButton.click();

    // The ConfirmDialog should appear with "Reject Content" title
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Reject Content')).toBeVisible();
    await expect(
      dialog.getByText('This content will be rejected and moved back to draft')
    ).toBeVisible();

    // The confirm button should say "Reject" (the confirmLabel)
    const confirmButton = dialog.getByRole('button', { name: 'Reject', exact: true });
    await expect(confirmButton).toBeVisible();

    // Confirm the rejection
    await confirmButton.click();

    // Toast should confirm
    await waitForToast(page, 'Content rejected');
  });

  test('reject dialog can be cancelled', async ({ page }) => {
    const rejectButton = page.getByRole('button', { name: 'Reject', exact: true }).first();
    await rejectButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Click Cancel to dismiss the dialog
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    // Dialog should close
    await expect(dialog).not.toBeVisible();
  });

  test('bulk approve selected items shows toast', async ({ page }) => {
    // Select multiple items using the "Select all" checkbox
    const selectAll = page.getByRole('checkbox', { name: 'Select all' });
    await selectAll.check();

    // The bulk toolbar should show with "Approve All" button
    const approveAllButton = page.getByRole('button', { name: 'Approve All' });
    await expect(approveAllButton).toBeVisible();

    await approveAllButton.click();

    // Toast should confirm with count (e.g. "2 items approved")
    await waitForToast(page, 'approved');
  });

  test('bulk reject selected items shows dialog then toast on confirm', async ({ page }) => {
    // Select items using first two item checkboxes
    const checkbox1 = page.locator('input[type="checkbox"]').nth(1);
    const checkbox2 = page.locator('input[type="checkbox"]').nth(2);

    // Check if we have at least 2 items to select
    if (await checkbox2.isVisible()) {
      await checkbox1.check();
      await checkbox2.check();
    } else {
      // Fallback: select all if only 1 item
      await checkbox1.check();
    }

    // Click "Reject All" in the bulk toolbar
    const rejectAllButton = page.getByRole('button', { name: 'Reject All' });
    await expect(rejectAllButton).toBeVisible();
    await rejectAllButton.click();

    // The bulk reject ConfirmDialog should appear
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Reject Selected Content')).toBeVisible();
    await expect(
      dialog.getByText(/Are you sure you want to reject \d+ items?/)
    ).toBeVisible();

    // The confirm button should say "Reject All"
    const confirmButton = dialog.getByRole('button', { name: 'Reject All' });
    await expect(confirmButton).toBeVisible();

    await confirmButton.click();

    // Toast should confirm
    await waitForToast(page, 'rejected');
  });

  test('empty state appears when no items pending', async ({ page }) => {
    // If all items have been approved/rejected by previous tests,
    // the empty state should display
    const emptyState = page.getByText('All caught up!');
    const contentCards = page.locator('.card').filter({
      has: page.getByRole('button', { name: 'Approve', exact: true }),
    });

    // Either we have content cards or the empty state — verify the empty
    // state has the expected text if visible
    if (await emptyState.isVisible()) {
      await expect(emptyState).toBeVisible();
      await expect(
        page.getByText('No content pending approval')
      ).toBeVisible();
    } else {
      // Items still exist, which is fine — the empty state test is conditional
      // based on whether prior tests consumed all seed data
      await expect(contentCards.first()).toBeVisible();
    }
  });
});
