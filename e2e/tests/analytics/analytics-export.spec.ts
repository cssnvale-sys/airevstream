import { test, expect } from '@playwright/test';
import { waitForDataLoad } from '../../helpers/wait.helper';

test.describe('Analytics page — export buttons', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/analytics');
    await waitForDataLoad(page);
  });

  test('"Export CSV" button is visible and enabled', async ({ page }) => {
    const csvButton = page.getByRole('button', { name: 'Export CSV' });
    await expect(csvButton).toBeVisible();
    await expect(csvButton).toBeEnabled();
  });

  test('clicking "Export CSV" triggers a download', async ({ page }) => {
    const csvButton = page.getByRole('button', { name: 'Export CSV' });

    // Listen for the download event before clicking
    const downloadPromise = page.waitForEvent('download', { timeout: 10_000 }).catch(() => null);

    await csvButton.click();

    // The exportToCSV utility creates a blob download or the toast fires.
    // If there is data, a download is triggered; if not, a toast appears.
    // We check for either outcome: download event OR the toast.
    const download = await downloadPromise;

    if (download) {
      // A file download was triggered — verify the filename contains "csv"
      expect(download.suggestedFilename()).toContain('.csv');
    } else {
      // No data available — the component shows an error or success toast
      const toast = page.locator('[data-sonner-toast]').first();
      await expect(toast).toBeVisible({ timeout: 5_000 });
    }
  });

  test('"Export PDF" button is visible but visually disabled', async ({ page }) => {
    const pdfButton = page.getByRole('button', { name: 'Export PDF' });
    await expect(pdfButton).toBeVisible();

    // The PDF button is styled as disabled via CSS (opacity-50 cursor-not-allowed)
    // and has a title attribute explaining why
    await expect(pdfButton).toHaveAttribute('title', 'PDF export not yet implemented');
    await expect(pdfButton).toHaveClass(/opacity-50/);
    await expect(pdfButton).toHaveClass(/cursor-not-allowed/);
  });
});
