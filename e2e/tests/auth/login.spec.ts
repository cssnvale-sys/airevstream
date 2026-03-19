import { test, expect } from '@playwright/test';
import { ADMIN } from '../../fixtures/test-data';
import { waitForToast, waitForNav } from '../../helpers/wait.helper';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
  });

  test('renders email, password inputs and sign in button', async ({ page }) => {
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('successful login redirects to /dashboard', async ({ page }) => {
    await page.getByLabel('Email').fill(ADMIN.email);
    await page.getByLabel('Password').fill(ADMIN.password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await waitForNav(page, '**/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('wrong password shows "Invalid email or password" error', async ({ page }) => {
    await page.getByLabel('Email').fill(ADMIN.email);
    await page.getByLabel('Password').fill('wrongpassword123');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await waitForToast(page, 'Invalid email or password');
  });

  test('show/hide password toggle works', async ({ page }) => {
    const passwordInput = page.getByLabel('Password');
    await passwordInput.fill('secret123');

    // Password should be hidden by default
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click show password toggle
    await page.getByLabel('Show password').click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // Click hide password toggle
    await page.getByLabel('Hide password').click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('"Forgot password?" and "Register" links are present and navigate correctly', async ({ page }) => {
    // Check forgot password link
    const forgotLink = page.getByRole('link', { name: /forgot password/i });
    await expect(forgotLink).toBeVisible();
    await forgotLink.click();
    await waitForNav(page, '**/auth/forgot-password');
    await expect(page).toHaveURL(/\/auth\/forgot-password/);

    // Go back and check register link
    await page.goto('/auth/login');
    const registerLink = page.getByRole('link', { name: /register|create account|sign up/i });
    await expect(registerLink).toBeVisible();
    await registerLink.click();
    await waitForNav(page, '**/auth/register');
    await expect(page).toHaveURL(/\/auth\/register/);
  });
});
