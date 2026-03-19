import { test, expect } from '@playwright/test';
import { ADMIN } from '../../fixtures/test-data';
import { waitForToast, waitForDataLoad } from '../../helpers/wait.helper';

test.describe('Settings — Security tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await waitForDataLoad(page);

    // Navigate to Security tab
    await page.getByRole('tab', { name: 'Security' }).click();
    await waitForDataLoad(page);
  });

  test('security tab is selected after clicking', async ({ page }) => {
    const securityTab = page.getByRole('tab', { name: 'Security' });
    await expect(securityTab).toHaveAttribute('aria-selected', 'true');
  });

  test('change password form is visible with all 3 inputs', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Change Password' })).toBeVisible();

    // All 3 password inputs should be present
    await expect(page.getByText('Current Password')).toBeVisible();
    await expect(page.getByText('New Password', { exact: true })).toBeVisible();
    await expect(page.getByText('Confirm New Password')).toBeVisible();

    // All inputs should be password type
    const passwordInputs = page.locator('input[type="password"]');
    await expect(passwordInputs).toHaveCount(3);

    // Change Password button should be visible
    await expect(page.getByRole('button', { name: 'Change Password' })).toBeVisible();
  });

  test('password visibility toggles work', async ({ page }) => {
    // Initially all inputs are password type (3 of them)
    const passwordInputs = page.locator('input[type="password"]');
    await expect(passwordInputs).toHaveCount(3);

    // Click the first show/hide toggle (for Current Password)
    const toggleButtons = page.locator('form button[type="button"]');
    await toggleButtons.first().click();

    // Now one input should be text type (visible), two still password
    await expect(page.locator('input[type="text"]').first()).toBeVisible();
  });

  test('mismatched passwords show validation error', async ({ page }) => {
    // Fill the form with mismatched passwords
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill('currentpass123');
    await passwordInputs.nth(1).fill('newpassword123');
    await passwordInputs.nth(2).fill('differentpassword');

    // Submit the form
    await page.getByRole('button', { name: 'Change Password' }).click();

    // Validation error should appear
    await expect(page.getByText('New passwords do not match.')).toBeVisible();
  });

  test('short password shows validation error', async ({ page }) => {
    // Fill the form with a short new password
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill('currentpass123');
    await passwordInputs.nth(1).fill('short');
    await passwordInputs.nth(2).fill('short');

    // Submit the form
    await page.getByRole('button', { name: 'Change Password' }).click();

    // Validation error should appear
    await expect(page.getByText('Password must be at least 8 characters.')).toBeVisible();
  });

  test('API key section is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'API Keys' })).toBeVisible();

    // Key name input and Generate button should be visible
    await expect(page.getByPlaceholder('My integration')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Generate' })).toBeVisible();
  });

  test('generate API key and copy it', async ({ page }) => {
    const keyNameInput = page.getByPlaceholder('My integration');
    await keyNameInput.fill(`E2E Test Key ${Date.now()}`);

    // Click Generate
    await page.getByRole('button', { name: 'Generate' }).click();

    // Toast should confirm key creation
    await waitForToast(page, 'API key generated');

    // New key banner should appear with the key value and Copy button
    await expect(page.getByText('Your new API key')).toBeVisible();
    const keyBanner = page.locator('.card').filter({ hasText: 'Your new API key' });
    await expect(keyBanner.getByRole('button', { name: 'Copy' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dismiss' }).or(page.getByText('Dismiss'))).toBeVisible();

    // Click Copy (scoped to the key banner)
    await keyBanner.getByRole('button', { name: 'Copy' }).click();

    // Button should change to "Copied"
    await expect(keyBanner.getByRole('button', { name: 'Copied' })).toBeVisible();
  });

  test('revoke API key with confirmation dialog', async ({ page }) => {
    // First, generate a key to revoke
    const keyName = `E2E Revoke Key ${Date.now()}`;
    await page.getByPlaceholder('My integration').fill(keyName);
    await page.getByRole('button', { name: 'Generate' }).click();
    await waitForToast(page, 'API key generated');

    // Dismiss the new key banner
    await page.getByText('Dismiss').click();

    // Wait for the key list to update
    await waitForDataLoad(page);

    // Find the Revoke button for the newly created key and click it
    const keyRow = page.locator('.card').filter({ hasText: keyName });
    await keyRow.getByRole('button', { name: 'Revoke' }).click();

    // Confirm dialog should appear
    await expect(page.getByText('Revoke API Key')).toBeVisible();
    await expect(page.getByText('This key will be permanently revoked')).toBeVisible();

    // Click the confirm button
    await page.getByRole('button', { name: 'Revoke Key' }).click();

    // Toast should confirm revocation
    await waitForToast(page, 'API key revoked');
  });
});
