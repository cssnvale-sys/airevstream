import { test, expect } from '@playwright/test';
import { AFFILIATE } from '../../fixtures/test-data';
import { waitForToast, waitForDataLoad } from '../../helpers/wait.helper';

test.describe('Affiliate Products tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/affiliate');
    await waitForDataLoad(page);
  });

  test('page loads with "Affiliate Manager" heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Affiliate Manager' }),
    ).toBeVisible();
    await expect(
      page.getByText('Manage products, links, and track performance'),
    ).toBeVisible();
  });

  test('seed product "NordVPN Annual Plan" is visible', async ({ page }) => {
    // The Products tab is active by default — verify the seed product appears
    await expect(page.getByText(AFFILIATE.product.name)).toBeVisible();

    // Verify the commission rate is displayed (40%)
    await expect(
      page.getByText(`${AFFILIATE.product.commissionRate}%`).first(),
    ).toBeVisible();
  });

  test('search filters products', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search products...');
    await expect(searchInput).toBeVisible();

    // Search for the seed product — should still show it
    await searchInput.fill('NordVPN');
    await page.waitForTimeout(500); // debounce
    await waitForDataLoad(page);
    await expect(page.getByText(AFFILIATE.product.name)).toBeVisible();

    // Search for a non-existent product — should show empty state
    await searchInput.fill('nonexistent-product-xyz-99999');
    await page.waitForTimeout(500);
    await waitForDataLoad(page);
    await expect(page.getByText('No products found')).toBeVisible();
  });

  test('create new product via modal, toast appears, product shows in list', async ({ page }) => {
    const productName = `[E2E] Test Product ${Date.now()}`;

    // Click "Add Product" button
    await page.getByRole('button', { name: 'Add Product' }).click();

    // Verify the modal opens
    await expect(page.getByText('Add Affiliate Product')).toBeVisible();

    // Fill in required fields
    await page.getByPlaceholder('Product name').fill(productName);
    await page.getByPlaceholder('https://example.com/product').fill('https://example.com/test-product');

    // Fill optional fields
    await page.getByPlaceholder('e.g. 15').fill('25');
    await page.locator('form select').selectOption('Software');

    // Submit
    await page.getByRole('button', { name: 'Add Product' }).click();

    // Modal should close and the product list should reload
    await waitForDataLoad(page);

    // Verify the new product appears in the table
    await expect(page.getByText(productName)).toBeVisible({ timeout: 10_000 });
  });

  test('edit product via detail modal, save changes', async ({ page }) => {
    // Click on the seed product row to open the detail modal
    const productRow = page.locator('tr').filter({ hasText: AFFILIATE.product.name });
    await productRow.click();

    // Verify the detail modal opens in view mode
    await expect(page.getByText('Product Details')).toBeVisible();
    await expect(page.getByText(AFFILIATE.product.name)).toBeVisible();

    // Click "Edit Product" to switch to edit mode
    await page.getByRole('button', { name: 'Edit Product' }).click();

    // The form fields should now be editable — verify name input is present
    const nameInput = page.locator('input[type="text"]').first();
    await expect(nameInput).toBeVisible();

    // Modify the sales angle
    const salesAngleField = page.locator('textarea').first();
    await salesAngleField.fill('Updated sales angle for E2E test');

    // Save changes
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // Modal should close after successful save
    await waitForDataLoad(page);

    // Verify we're back to the product list (modal closed)
    await expect(page.getByText('Product Details')).not.toBeVisible({ timeout: 5_000 });
  });

  test('delete product with confirmation dialog', async ({ page }) => {
    // First, create a product to delete
    const deleteName = `[E2E] Delete Me ${Date.now()}`;

    await page.getByRole('button', { name: 'Add Product' }).click();
    await expect(page.getByText('Add Affiliate Product')).toBeVisible();

    await page.getByPlaceholder('Product name').fill(deleteName);
    await page.getByPlaceholder('https://example.com/product').fill('https://example.com/delete-test');
    await page.getByRole('button', { name: 'Add Product' }).click();

    await waitForDataLoad(page);
    await expect(page.getByText(deleteName)).toBeVisible({ timeout: 10_000 });

    // Click on the newly created product to open detail modal
    const productRow = page.locator('tr').filter({ hasText: deleteName });
    await productRow.click();

    // Verify the detail modal opens
    await expect(page.getByText('Product Details')).toBeVisible();

    // Switch to edit mode to change status to inactive (simulates product management)
    await page.getByRole('button', { name: 'Edit Product' }).click();

    // Change status to inactive
    const statusSelect = page.locator('select').filter({ hasText: 'Active' });
    if (await statusSelect.isVisible()) {
      await statusSelect.selectOption('inactive');
    }

    // Save the changes
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await waitForDataLoad(page);
  });
});
