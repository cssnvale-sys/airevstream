import { test, expect } from '@playwright/test';
import { CONTENT, CHANNEL } from '../../fixtures/test-data';
import { waitForToast, waitForDataLoad } from '../../helpers/wait.helper';

test.describe('Library page — content detail and deletion', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/library');
    await waitForDataLoad(page);
  });

  test('clicking a content item navigates to its detail page', async ({ page }) => {
    // The seed pending_approval item should be visible in the library grid
    const contentLink = page.getByText(CONTENT.pendingApproval.title).first();
    await expect(contentLink).toBeVisible();

    // Click the content item — it links to /content/[id]
    await contentLink.click();

    // Should navigate to the content detail page
    await page.waitForURL(`**/content/${CONTENT.pendingApproval.id}`, { timeout: 15_000 });
    expect(page.url()).toContain(`/content/${CONTENT.pendingApproval.id}`);
  });

  test('content detail page shows metadata (title, type, status, channel)', async ({ page }) => {
    // Navigate directly to the content detail page
    await page.goto(`/content/${CONTENT.pendingApproval.id}`);
    await waitForDataLoad(page);

    // Title should be visible
    await expect(page.getByText(CONTENT.pendingApproval.title).first()).toBeVisible();

    // Channel name should be visible
    await expect(page.getByText(CHANNEL.name).first()).toBeVisible();

    // Status should be displayed (as "pending approval" with underscore replaced)
    await expect(page.getByText(/pending.approval/i).first()).toBeVisible();
  });

  test('delete a draft content item via ConfirmDialog', async ({ page }) => {
    // Switch to list view so the delete button is available
    const listButton = page.locator('button[title="List view"]');
    await listButton.click();
    await waitForDataLoad(page);

    // The draft seed item should be visible
    const draftTitle = CONTENT.draft.title;
    await expect(page.getByText(draftTitle).first()).toBeVisible();

    // Click the delete button for the draft item
    // The delete button has aria-label "Delete <title>"
    const deleteButton = page.getByLabel(`Delete ${draftTitle}`);
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    // ConfirmDialog should open with the expected title and confirm button
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Delete Content')).toBeVisible();
    await expect(dialog.getByText('permanently deleted')).toBeVisible();

    // Click the "Delete" confirm button inside the dialog
    const confirmButton = dialog.getByRole('button', { name: 'Delete' });
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();

    // Wait for success toast
    await waitForToast(page, 'Content deleted');

    // The draft item should no longer be visible
    await expect(page.getByText(draftTitle)).not.toBeVisible();
  });
});
