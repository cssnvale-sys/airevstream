import { test as base, expect } from '@playwright/test';
import path from 'path';
import { ADMIN } from './test-data';

const STORAGE_STATE = path.resolve(__dirname, '../.auth/admin.json');

/**
 * Setup project: log in as admin and save storageState.
 * This runs once before all other tests.
 */
export const test = base.extend({});

test('authenticate as admin', async ({ page }) => {
  await page.goto('/auth/login');
  await page.getByLabel('Email').fill(ADMIN.email);
  await page.getByLabel('Password').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard', { timeout: 15_000 });
  await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible();

  // Save authenticated state
  await page.context().storageState({ path: STORAGE_STATE });
});
