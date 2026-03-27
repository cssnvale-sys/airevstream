import { test, expect } from '@playwright/test';
import { waitForToast, waitForDataLoad } from '../../helpers/wait.helper';

test.describe('Settings — Appearance tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await waitForDataLoad(page);

    // Navigate to Appearance tab
    await page.getByRole('tab', { name: 'Appearance' }).click();
    await waitForDataLoad(page);
  });

  test('appearance tab is selected after clicking', async ({ page }) => {
    const appearanceTab = page.getByRole('tab', { name: 'Appearance' });
    await expect(appearanceTab).toHaveAttribute('aria-selected', 'true');
  });

  test('theme buttons are visible (Dark, Light, System)', async ({ page }) => {
    await expect(page.getByText('Theme')).toBeVisible();

    // All 3 theme option buttons should be visible
    const tabPanel = page.getByRole('tabpanel');
    await expect(tabPanel.getByRole('button', { name: 'Dark' })).toBeVisible();
    await expect(tabPanel.getByRole('button', { name: 'Light' })).toBeVisible();
    await expect(tabPanel.getByRole('button', { name: 'System' })).toBeVisible();
  });

  test('sidebar position buttons are visible (Left, Right)', async ({ page }) => {
    await expect(page.getByText('Sidebar Position')).toBeVisible();

    const tabPanel = page.getByRole('tabpanel');
    await expect(tabPanel.getByRole('button', { name: 'Left' })).toBeVisible();
    await expect(tabPanel.getByRole('button', { name: 'Right' })).toBeVisible();
  });

  test('select Light theme and save shows toast', async ({ page }) => {
    const tabPanel = page.getByRole('tabpanel');

    // Click "Light" theme button
    await tabPanel.getByRole('button', { name: 'Light' }).click();

    // Click Save Changes
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // Toast should confirm save
    await waitForToast(page, 'Appearance settings saved');

    // Button should change to "Saved"
    await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible();

    // Restore Dark theme to avoid side effects on other tests
    await tabPanel.getByRole('button', { name: 'Dark' }).click();
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await waitForToast(page, 'Appearance settings saved');
  });

  test('select Right sidebar position and save shows toast', async ({ page }) => {
    const tabPanel = page.getByRole('tabpanel');

    // Click "Right" sidebar position button
    await tabPanel.getByRole('button', { name: 'Right' }).click();

    // Click Save Changes
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // Toast should confirm save
    await waitForToast(page, 'Appearance settings saved');

    // Button should change to "Saved"
    await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible();

    // Restore Left position to avoid side effects on other tests
    await tabPanel.getByRole('button', { name: 'Left' }).click();
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await waitForToast(page, 'Appearance settings saved');
  });

  test('Save Changes button is present', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible();
  });
});
