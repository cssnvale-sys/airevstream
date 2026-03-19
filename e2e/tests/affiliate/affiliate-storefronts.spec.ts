import { test, expect } from '@playwright/test';
import { AFFILIATE } from '../../fixtures/test-data';
import { waitForToast, waitForDataLoad } from '../../helpers/wait.helper';

test.describe('Affiliate — Channel Pools tab (storefront management)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/affiliate');
    await waitForDataLoad(page);
  });

  test('click "Channel Pools" tab renders the channel selector', async ({ page }) => {
    // Click the Channel Pools tab
    const channelPoolsTab = page.getByRole('tab', { name: 'Channel Pools' });
    await expect(channelPoolsTab).toBeVisible();
    await channelPoolsTab.click();

    // Verify the tab is now selected
    await expect(channelPoolsTab).toHaveAttribute('aria-selected', 'true');

    // The channel selector should be visible
    await expect(page.getByText('Select Channel')).toBeVisible();
    const channelSelect = page.locator('select').filter({ hasText: 'Choose a channel' });
    await expect(channelSelect).toBeVisible();

    // Before selecting a channel, the prompt message should appear
    await expect(
      page.getByText('Select a channel above to manage its affiliate product pool.'),
    ).toBeVisible();
  });

  test('select a channel and view assigned/suggested products', async ({ page }) => {
    // Navigate to Channel Pools tab
    const channelPoolsTab = page.getByRole('tab', { name: 'Channel Pools' });
    await channelPoolsTab.click();
    await expect(channelPoolsTab).toHaveAttribute('aria-selected', 'true');

    // Select the first available channel
    const channelSelect = page.locator('select').filter({ hasText: 'Choose a channel' });
    await expect(channelSelect).toBeVisible();

    // Get the available options (skip the placeholder)
    const options = channelSelect.locator('option');
    const optionCount = await options.count();

    // If there are channels available (more than just the placeholder), select the first one
    if (optionCount > 1) {
      const firstChannelValue = await options.nth(1).getAttribute('value');
      if (firstChannelValue) {
        await channelSelect.selectOption(firstChannelValue);
        await waitForDataLoad(page);

        // The prompt message should disappear and pool sections should appear
        await expect(
          page.getByText('Select a channel above to manage its affiliate product pool.'),
        ).not.toBeVisible();

        // The "Assigned Products" and "Suggested Products" sections should be visible
        await expect(page.getByText('Assigned Products')).toBeVisible();
        await expect(page.getByText('Suggested Products')).toBeVisible();
      }
    }
  });

  test('add product to channel pool and remove it', async ({ page }) => {
    // Navigate to Channel Pools tab
    const channelPoolsTab = page.getByRole('tab', { name: 'Channel Pools' });
    await channelPoolsTab.click();

    // Select the first available channel
    const channelSelect = page.locator('select').filter({ hasText: 'Choose a channel' });
    await expect(channelSelect).toBeVisible();

    const options = channelSelect.locator('option');
    const optionCount = await options.count();

    // Skip if no channels available
    if (optionCount <= 1) {
      test.skip();
      return;
    }

    const firstChannelValue = await options.nth(1).getAttribute('value');
    if (!firstChannelValue) {
      test.skip();
      return;
    }

    await channelSelect.selectOption(firstChannelValue);
    await waitForDataLoad(page);

    // Check if there are suggested (unassigned) products to add
    const addButtons = page.getByRole('button', { name: 'Add' });
    const addButtonCount = await addButtons.count();

    if (addButtonCount > 0) {
      // Click "Add" on the first suggested product
      await addButtons.first().click();

      // Wait for the toast confirming the addition
      await waitForToast(page, 'Product added to pool');
      await waitForDataLoad(page);
    }

    // Check if there are assigned products that can be removed
    const removeButtons = page.getByRole('button', { name: 'Remove' });
    const removeButtonCount = await removeButtons.count();

    if (removeButtonCount > 0) {
      // Click "Remove" on the first assigned product
      await removeButtons.first().click();

      // Wait for the toast confirming the removal
      await waitForToast(page, 'Product removed from pool');
      await waitForDataLoad(page);
    }
  });
});
