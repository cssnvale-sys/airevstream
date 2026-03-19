import { test, expect } from '@playwright/test';
import { E2E_PREFIX, testEmail } from '../../fixtures/test-data';
import { waitForToast, waitForDataLoad } from '../../helpers/wait.helper';

test.describe('Accounts bulk operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/accounts');
    await waitForDataLoad(page);
  });

  test('bulk import via JSON modal', async ({ page }) => {
    const email1 = testEmail('import1');
    const email2 = testEmail('import2');
    const importJson = JSON.stringify([
      { email: email1, password: 'TestPass123!', tier: 'tier2' },
      { email: email2, password: 'TestPass123!', tier: 'tier1' },
    ]);

    // Click "Import" button
    await page.getByRole('button', { name: 'Import' }).click();

    // Verify import modal opens
    await expect(page.getByText('Bulk Import Accounts')).toBeVisible();

    // Paste JSON into the textarea
    const textarea = page.locator('textarea');
    await textarea.fill(importJson);

    // Submit the import
    await page.getByRole('button', { name: 'Import', exact: true }).click();

    // Verify success toast
    await waitForToast(page, 'Imported');

    // Close the modal and verify accounts appear in the list
    await page.keyboard.press('Escape');
    await waitForDataLoad(page);
    await expect(page.getByText(email1)).toBeVisible();
    await expect(page.getByText(email2)).toBeVisible();
  });

  test('selecting multiple accounts shows bulk toolbar with count', async ({ page }) => {
    // Ensure at least 2 accounts exist — create them via import
    const email1 = testEmail('bulk-sel1');
    const email2 = testEmail('bulk-sel2');
    const importJson = JSON.stringify([
      { email: email1, password: 'TestPass123!', tier: 'tier2' },
      { email: email2, password: 'TestPass123!', tier: 'tier2' },
    ]);

    await page.getByRole('button', { name: 'Import' }).click();
    await expect(page.getByText('Bulk Import Accounts')).toBeVisible();
    await page.locator('textarea').fill(importJson);
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await waitForToast(page, 'Imported');
    await page.keyboard.press('Escape');
    await waitForDataLoad(page);

    // Select the first account
    const row1 = page.locator('tr').filter({ hasText: email1 });
    await row1.getByRole('checkbox').check();
    await expect(page.getByText('1 selected')).toBeVisible();

    // Select the second account
    const row2 = page.locator('tr').filter({ hasText: email2 });
    await row2.getByRole('checkbox').check();
    await expect(page.getByText('2 selected')).toBeVisible();

    // Verify the bulk toolbar buttons are present
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete Selected' })).toBeVisible();
    await expect(page.getByText('Clear')).toBeVisible();

    // Click "Clear" and verify selection is reset
    await page.getByText('Clear').click();
    await expect(page.getByText('selected')).not.toBeVisible();
  });

  test('export CSV triggers download', async ({ page }) => {
    // Create an account to select and export
    const email = testEmail('export');
    const importJson = JSON.stringify([
      { email, password: 'TestPass123!', tier: 'tier2' },
    ]);

    await page.getByRole('button', { name: 'Import' }).click();
    await expect(page.getByText('Bulk Import Accounts')).toBeVisible();
    await page.locator('textarea').fill(importJson);
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await waitForToast(page, 'Imported');
    await page.keyboard.press('Escape');
    await waitForDataLoad(page);

    // Select the account
    const row = page.locator('tr').filter({ hasText: email });
    await row.getByRole('checkbox').check();
    await expect(page.getByText('1 selected')).toBeVisible();

    // Listen for download event then click Export CSV
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();

    // Verify export toast appears
    await waitForToast(page, 'Exported');

    // Verify the download was triggered
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('accounts-export');
  });

  test('bulk delete with confirmation', async ({ page }) => {
    // Create two accounts to bulk delete
    const email1 = testEmail('bdel1');
    const email2 = testEmail('bdel2');
    const importJson = JSON.stringify([
      { email: email1, password: 'TestPass123!', tier: 'tier3' },
      { email: email2, password: 'TestPass123!', tier: 'tier3' },
    ]);

    await page.getByRole('button', { name: 'Import' }).click();
    await expect(page.getByText('Bulk Import Accounts')).toBeVisible();
    await page.locator('textarea').fill(importJson);
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await waitForToast(page, 'Imported');
    await page.keyboard.press('Escape');
    await waitForDataLoad(page);

    // Select both accounts
    const row1 = page.locator('tr').filter({ hasText: email1 });
    await row1.getByRole('checkbox').check();
    const row2 = page.locator('tr').filter({ hasText: email2 });
    await row2.getByRole('checkbox').check();
    await expect(page.getByText('2 selected')).toBeVisible();

    // Click "Delete Selected"
    await page.getByRole('button', { name: 'Delete Selected' }).click();

    // Verify confirm dialog
    await expect(page.getByText('Delete Selected Accounts')).toBeVisible();
    await expect(page.getByText(/delete 2 account/i)).toBeVisible();

    // Confirm deletion
    await page.getByRole('button', { name: /Delete 2 Account/ }).click();

    // Verify success toast
    await waitForToast(page, 'Deleted');

    // Wait for data to reload and verify accounts are gone
    await waitForDataLoad(page);
    await expect(page.getByText(email1)).not.toBeVisible();
    await expect(page.getByText(email2)).not.toBeVisible();
  });
});
