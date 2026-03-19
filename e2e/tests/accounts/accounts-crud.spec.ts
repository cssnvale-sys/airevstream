import { test, expect } from '@playwright/test';
import { EMAIL_ACCOUNT, E2E_PREFIX, testEmail } from '../../fixtures/test-data';
import { waitForToast, waitForDataLoad } from '../../helpers/wait.helper';

test.describe('Accounts CRUD operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/accounts');
    await waitForDataLoad(page);
  });

  test('add email account via modal', async ({ page }) => {
    const newEmail = testEmail('account');

    // Click "Add Email" button
    await page.getByRole('button', { name: 'Add Email' }).click();

    // Verify modal opens
    await expect(page.getByText('Add Email Account')).toBeVisible();

    // Fill in the form
    await page.getByPlaceholder('user@example.com').fill(newEmail);
    await page.getByPlaceholder('Account password').fill('TestPass123!');

    // Select a tier
    const tierSelect = page.locator('form select');
    await tierSelect.selectOption('tier1');

    // Submit the form
    await page.getByRole('button', { name: 'Add Account' }).click();

    // Verify success toast
    await waitForToast(page, 'Account added successfully');

    // Wait for data to reload and verify the new account appears in the list
    await waitForDataLoad(page);
    await expect(page.getByText(newEmail)).toBeVisible();
  });

  test('click row opens detail panel with Overview tab', async ({ page }) => {
    // Click on the seed account row
    const seedRow = page.locator('tr').filter({ hasText: EMAIL_ACCOUNT.email });
    await seedRow.click();

    // Verify the detail panel opens
    await expect(page.getByText('Account Detail').or(page.getByText(EMAIL_ACCOUNT.email))).toBeVisible();

    // Verify "Overview" tab is present and selected
    const overviewTab = page.getByRole('tab', { name: 'Overview' });
    await expect(overviewTab).toBeVisible();
    await expect(overviewTab).toHaveAttribute('aria-selected', 'true');

    // Verify detail panel content is visible (Status and Tier sections)
    const tabPanel = page.getByRole('tabpanel');
    await expect(tabPanel).toBeVisible();
    await expect(tabPanel.getByText('Status')).toBeVisible();
    await expect(tabPanel.getByText('Tier')).toBeVisible();
  });

  test('delete an e2e-created account', async ({ page }) => {
    // First, create an account to delete
    const deleteEmail = testEmail('delete');

    await page.getByRole('button', { name: 'Add Email' }).click();
    await expect(page.getByText('Add Email Account')).toBeVisible();

    await page.getByPlaceholder('user@example.com').fill(deleteEmail);
    await page.getByPlaceholder('Account password').fill('TestPass123!');
    await page.getByRole('button', { name: 'Add Account' }).click();

    await waitForToast(page, 'Account added successfully');
    await waitForDataLoad(page);

    // Verify the account exists in the list
    await expect(page.getByText(deleteEmail)).toBeVisible();

    // Select the account checkbox
    const accountRow = page.locator('tr').filter({ hasText: deleteEmail });
    const checkbox = accountRow.getByRole('checkbox');
    await checkbox.check();

    // Verify bulk toolbar appears
    await expect(page.getByText('1 selected')).toBeVisible();

    // Click "Delete Selected"
    await page.getByRole('button', { name: 'Delete Selected' }).click();

    // Verify confirm dialog appears
    await expect(page.getByText('Delete Selected Accounts')).toBeVisible();

    // Click the confirm button (e.g. "Delete 1 Account(s)")
    await page.getByRole('button', { name: /Delete \d+ Account/ }).click();

    // Verify success toast
    await waitForToast(page, 'Deleted');

    // Wait for data to reload and verify the account is gone
    await waitForDataLoad(page);
    await expect(page.getByText(deleteEmail)).not.toBeVisible();
  });
});
