/**
 * @deprecated DEAD CODE — This file is not referenced by any spec or config.
 * Auth setup is handled by e2e/global-setup.ts (configured in playwright.config.ts).
 * This file is a stale duplicate with a less-robust auth flow (no hydration wait,
 * no API response check). Safe to delete.
 */
import { test as base, expect } from '@playwright/test';
import path from 'path';
import { ADMIN } from './test-data';

const STORAGE_STATE = path.resolve(__dirname, '../.auth/admin.json');

export const test = base.extend({});

test('authenticate as admin', async ({ page }) => {
  await page.goto('/auth/login');
  await page.getByLabel('Email').fill(ADMIN.email);
  await page.getByLabel('Password').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await page.waitForURL('**/dashboard', { timeout: 15_000 });
  await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible();

  await page.context().storageState({ path: STORAGE_STATE });
});
