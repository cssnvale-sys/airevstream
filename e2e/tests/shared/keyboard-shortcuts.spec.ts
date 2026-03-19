import { test, expect } from '@playwright/test';
import { waitForDataLoad } from '../../helpers/wait.helper';

test.describe('Keyboard shortcuts modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await waitForDataLoad(page);
  });

  test('pressing "?" opens the modal with "Keyboard Shortcuts" title', async ({ page }) => {
    await page.keyboard.press('?');

    const modal = page.locator('[aria-label="Keyboard shortcuts"]');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Keyboard Shortcuts')).toBeVisible();
  });

  test('modal shows shortcut descriptions for Navigation and Content sections', async ({ page }) => {
    await page.keyboard.press('?');

    const modal = page.locator('[aria-label="Keyboard shortcuts"]');
    await expect(modal).toBeVisible();

    // Section headings
    await expect(modal.getByText('Navigation')).toBeVisible();
    await expect(modal.getByText('Content')).toBeVisible();

    // Navigation shortcuts
    await expect(modal.getByText('Open this shortcuts modal')).toBeVisible();
    await expect(modal.getByText('Close panels and modals')).toBeVisible();

    // Content shortcuts
    await expect(modal.getByText('Go to Create page')).toBeVisible();
    await expect(modal.getByText('Go to Library')).toBeVisible();
    await expect(modal.getByText('Go to Analytics')).toBeVisible();
  });

  test('Escape key closes the modal', async ({ page }) => {
    await page.keyboard.press('?');

    const modal = page.locator('[aria-label="Keyboard shortcuts"]');
    await expect(modal).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
  });

  test('close button closes the modal', async ({ page }) => {
    await page.keyboard.press('?');

    const modal = page.locator('[aria-label="Keyboard shortcuts"]');
    await expect(modal).toBeVisible();

    await modal.getByRole('button', { name: 'Close shortcuts modal' }).click();
    await expect(modal).toBeHidden();
  });

  test('pressing "N" navigates to /create', async ({ page }) => {
    await page.keyboard.press('n');
    await page.waitForURL('**/create', { timeout: 15_000 });

    expect(page.url()).toContain('/create');
  });

  test('pressing "L" navigates to /library', async ({ page }) => {
    await page.keyboard.press('l');
    await page.waitForURL('**/library', { timeout: 15_000 });

    expect(page.url()).toContain('/library');
  });
});
