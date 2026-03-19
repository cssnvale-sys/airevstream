import { test as base, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { ADMIN } from './fixtures/test-data';

const STORAGE_STATE = path.resolve(__dirname, '.auth/admin.json');

const test = base.extend({});

test('authenticate as admin', async ({ page }) => {
  // Ensure .auth directory exists
  const authDir = path.dirname(STORAGE_STATE);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  await page.goto('/auth/login');

  // Wait for React hydration — Next.js SSR renders HTML first, then React attaches
  // event handlers during hydration. Clicking before hydration triggers native form
  // submit instead of React's onSubmit handler.
  await page.waitForFunction(() => {
    const btn = document.querySelector('button[type="submit"]');
    return btn && Object.keys(btn).some(
      (k) => k.startsWith('__reactFiber') || k.startsWith('__reactProps')
    );
  }, { timeout: 15_000 });

  const emailInput = page.locator('#login-email');
  await emailInput.fill(ADMIN.email);

  const passwordInput = page.locator('#login-password');
  await passwordInput.fill(ADMIN.password);

  // Set up response listener BEFORE clicking
  const responsePromise = page.waitForResponse(
    (resp) => resp.url().includes('/api/v1/auth/login'),
    { timeout: 15_000 }
  );

  await page.getByRole('button', { name: 'Sign In' }).click();

  // Wait for login API response
  const loginResponse = await responsePromise;
  const status = loginResponse.status();
  if (status !== 200) {
    const body = await loginResponse.json();
    throw new Error(`Login failed (${status}): ${JSON.stringify(body)}`);
  }

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard', { timeout: 15_000 });
  await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible();

  // Save authenticated state
  await page.context().storageState({ path: STORAGE_STATE });
});

export { test, expect };
