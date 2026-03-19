import { test, expect } from '@playwright/test';
import { ADMIN } from '../../fixtures/test-data';
import { waitForToast, waitForDataLoad } from '../../helpers/wait.helper';

test.describe('Settings — General tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await waitForDataLoad(page);
  });

  test('page loads on General tab with fields visible', async ({ page }) => {
    // Page heading
    await expect(page.getByRole('main').getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.getByText('Configure your AiRevStream instance')).toBeVisible();

    // General tab should be selected by default
    const generalTab = page.getByRole('tab', { name: 'General' });
    await expect(generalTab).toBeVisible();
    await expect(generalTab).toHaveAttribute('aria-selected', 'true');

    // Form fields should be visible
    await expect(page.getByText('System Name')).toBeVisible();
    await expect(page.getByPlaceholder('AiRevStream')).toBeVisible();
    await expect(page.getByText('Timezone')).toBeVisible();
    await expect(page.getByText('Default Language')).toBeVisible();

    // Save button should be visible
    await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible();
  });

  test('edit system name and save shows "Saved" with checkmark', async ({ page }) => {
    const nameInput = page.getByPlaceholder('AiRevStream');
    await expect(nameInput).toBeVisible();

    // Clear and type a new name
    await nameInput.clear();
    await nameInput.fill('E2E Test Instance');

    // Unsaved changes indicator should appear
    await expect(page.getByText('Unsaved changes')).toBeVisible();

    // Click Save
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // Button text should change to "Saved"
    await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible();

    // Toast confirmation
    await waitForToast(page, 'Settings saved');

    // Restore original name to avoid side effects
    await nameInput.clear();
    await nameInput.fill('AiRevStream');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible();
  });

  test('timezone dropdown has expected options', async ({ page }) => {
    const timezoneSelect = page.locator('select').filter({ hasText: 'UTC' });
    await expect(timezoneSelect).toBeVisible();

    // Verify key timezone options
    await expect(timezoneSelect.locator('option', { hasText: 'UTC' })).toBeAttached();
    await expect(timezoneSelect.locator('option', { hasText: 'America/New_York' })).toBeAttached();
    await expect(timezoneSelect.locator('option', { hasText: 'Europe/London' })).toBeAttached();
    await expect(timezoneSelect.locator('option', { hasText: 'Asia/Tokyo' })).toBeAttached();
    await expect(timezoneSelect.locator('option', { hasText: 'Australia/Sydney' })).toBeAttached();
  });

  test('default language dropdown has expected options', async ({ page }) => {
    const languageSelect = page.locator('select').filter({ hasText: 'English' });
    await expect(languageSelect).toBeVisible();

    await expect(languageSelect.locator('option', { hasText: 'English' })).toBeAttached();
    await expect(languageSelect.locator('option', { hasText: 'Spanish' })).toBeAttached();
    await expect(languageSelect.locator('option', { hasText: 'French' })).toBeAttached();
    await expect(languageSelect.locator('option', { hasText: 'Japanese' })).toBeAttached();
  });
});
