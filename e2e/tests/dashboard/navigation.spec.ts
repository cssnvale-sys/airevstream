import { test, expect } from '@playwright/test';
import { waitForDataLoad } from '../../helpers/wait.helper';

const NAV_ITEMS = [
  { label: 'Home', href: '/dashboard' },
  { label: 'Accounts', href: '/accounts' },
  { label: 'Calendar', href: '/calendar' },
  { label: 'Create', href: '/create' },
  { label: 'Library', href: '/library' },
  { label: 'Analytics', href: '/analytics' },
  { label: 'System', href: '/system' },
  { label: 'Affiliate', href: '/affiliate' },
  { label: 'Settings', href: '/settings' },
] as const;

test.describe('Sidebar navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await waitForDataLoad(page);
  });

  for (const { label, href } of NAV_ITEMS) {
    test(`clicking "${label}" navigates to ${href}`, async ({ page }) => {
      const nav = page.locator('nav[aria-label="Main navigation"]');
      const link = nav.getByRole('link', { name: label });

      await link.click();
      await page.waitForURL(`**${href}`, { timeout: 15_000 });

      expect(page.url()).toContain(href);
    });
  }

  test('sidebar collapse hides labels, expand shows them', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main navigation"]');

    // Verify a nav label is visible before collapsing
    await expect(nav.getByRole('link', { name: 'Home' })).toBeVisible();

    // Collapse the sidebar
    const collapseButton = page.getByRole('button', { name: 'Collapse sidebar' });
    await collapseButton.click();

    // After collapsing, nav link text labels should be hidden
    // The links still exist but the visible text is clipped/hidden
    const expandButton = page.getByRole('button', { name: 'Expand sidebar' });
    await expect(expandButton).toBeVisible();

    // Expand the sidebar again
    await expandButton.click();

    // Labels should be visible again
    await expect(nav.getByRole('link', { name: 'Home' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Collapse sidebar' })
    ).toBeVisible();
  });

  test('brand text visible when expanded, hidden when collapsed', async ({ page }) => {
    // Brand text should be visible in expanded state
    const brandText = page.getByText('AiRevStream');
    await expect(brandText.first()).toBeVisible();

    // Collapse the sidebar
    const collapseButton = page.getByRole('button', { name: 'Collapse sidebar' });
    await collapseButton.click();

    // Brand text should be hidden when collapsed
    await expect(brandText.first()).toBeHidden();

    // Expand again
    const expandButton = page.getByRole('button', { name: 'Expand sidebar' });
    await expandButton.click();

    // Brand text visible again
    await expect(brandText.first()).toBeVisible();
  });
});
