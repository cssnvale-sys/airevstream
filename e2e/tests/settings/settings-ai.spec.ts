import { test, expect } from '@playwright/test';
import { ADMIN, AI_SERVICES } from '../../fixtures/test-data';
import { waitForToast } from '../../helpers/wait.helper';

test.describe('Settings — AI Services tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Navigate to AI Services tab
    await page.getByRole('tab', { name: 'AI Services' }).click();
    await page.waitForLoadState('networkidle');
  });

  test('AI Services tab is selected after clicking', async ({ page }) => {
    const aiTab = page.getByRole('tab', { name: 'AI Services' });
    await expect(aiTab).toHaveAttribute('aria-selected', 'true');
  });

  test('3 seed services are visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Registered Services' })).toBeVisible();

    // Verify all 3 seed AI services from test-data
    await expect(page.getByText(AI_SERVICES.ollama.name)).toBeVisible();
    await expect(page.getByText(AI_SERVICES.comfyui.name)).toBeVisible();
    await expect(page.getByText(AI_SERVICES.openai.name)).toBeVisible();
  });

  test('service cards show name, type badge, endpoint, and status', async ({ page }) => {
    // Find the ollama service card and verify its contents
    const ollamaCard = page.locator('.card').filter({ hasText: AI_SERVICES.ollama.name });
    await expect(ollamaCard).toBeVisible();

    // Should have a type badge (text, image, etc.)
    await expect(ollamaCard.locator('.badge').first()).toBeVisible();

    // Should show an endpoint (monospace text)
    await expect(ollamaCard.locator('.font-mono').first()).toBeVisible();

    // Should show a status badge
    await expect(ollamaCard.locator('.badge').nth(1).or(ollamaCard.getByText(/active|healthy|disabled|degraded/))).toBeVisible();
  });

  test('Test All button is present', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Test All' })).toBeVisible();
  });

  test('Add Service button opens form and Cancel closes it', async ({ page }) => {
    // Click "Add Service" to open the form
    await page.getByRole('button', { name: 'Add Service' }).click();

    // Form should appear with Name, Type, Endpoint fields
    await expect(page.getByText('New AI Service')).toBeVisible();
    await expect(page.getByPlaceholder('Ollama Local')).toBeVisible();
    await expect(page.getByPlaceholder('http://localhost:11434')).toBeVisible();

    // Add and Cancel buttons in the form
    await expect(page.getByRole('button', { name: 'Add', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();

    // Click Cancel to close
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Form should disappear
    await expect(page.getByText('New AI Service')).not.toBeVisible();
  });

  test('fill add service form and submit shows toast', async ({ page }) => {
    // Open the add form
    await page.getByRole('button', { name: 'Add Service' }).click();
    await expect(page.getByText('New AI Service')).toBeVisible();

    // Fill in the form
    const serviceName = `e2e-test-svc-${Date.now()}`;
    await page.getByPlaceholder('Ollama Local').fill(serviceName);
    await page.getByPlaceholder('http://localhost:11434').fill('http://localhost:9999');

    // Select type (default is "Text Generation" which is fine)
    const typeSelect = page.locator('.card').filter({ hasText: 'New AI Service' }).locator('select');
    await typeSelect.selectOption('image');

    // Click Add
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    // Toast should confirm addition
    await waitForToast(page, 'AI service added');

    // The new service should appear in the list
    await expect(page.getByText(serviceName)).toBeVisible();

    // Clean up: remove the service we just added
    const newServiceCard = page.locator('.card').filter({ hasText: serviceName });
    await newServiceCard.getByTitle('Remove service').click();
    await waitForToast(page, 'Service removed');
  });

  test('Fallback Chains section is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Fallback Chains' })).toBeVisible();
  });
});
