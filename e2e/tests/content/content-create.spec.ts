import { test, expect } from '@playwright/test';
import { CHANNEL } from '../../fixtures/test-data';
import { waitForDataLoad } from '../../helpers/wait.helper';

test.describe('Create page — content wizard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/create');
    await waitForDataLoad(page);
  });

  test('wizard renders with Step 1 visible and correct page title', async ({ page }) => {
    // Page title
    await expect(page.getByRole('main').getByRole('heading', { name: 'Create Content' })).toBeVisible();

    // Step indicator shows "Step 1 of 6"
    await expect(page.getByText('Step 1 of 6')).toBeVisible();

    // Progress bar exists (percentage text "17%")
    await expect(page.getByText('17%')).toBeVisible();

    // Step 1 heading: "Select Channel"
    await expect(page.getByRole('heading', { name: 'Select Channel' })).toBeVisible();

    // Channel dropdown present with placeholder
    const channelSelect = page.locator('select').filter({ hasText: 'Select a channel...' }).first();
    await expect(channelSelect).toBeVisible();
  });

  test('Back button is disabled on Step 1', async ({ page }) => {
    const backButton = page.getByRole('button', { name: 'Back' });
    await expect(backButton).toBeVisible();
    await expect(backButton).toBeDisabled();
  });

  test('Next button is disabled until a channel is selected', async ({ page }) => {
    const nextButton = page.getByRole('button', { name: 'Next' });
    await expect(nextButton).toBeVisible();
    await expect(nextButton).toBeDisabled();

    // Select TechVerse channel
    const channelSelect = page.locator('select').filter({ hasText: 'Select a channel...' }).first();
    await channelSelect.selectOption({ value: CHANNEL.id });

    // Next should now be enabled
    await expect(nextButton).toBeEnabled();
  });

  test('select channel and advance to Step 2', async ({ page }) => {
    // Select TechVerse channel
    const channelSelect = page.locator('select').filter({ hasText: 'Select a channel...' }).first();
    await channelSelect.selectOption({ value: CHANNEL.id });

    // Click Next
    const nextButton = page.getByRole('button', { name: 'Next' });
    await nextButton.click();

    // Step 2: "Concept & Configuration" should be visible
    await expect(page.getByText('Step 2 of 6')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Concept & Configuration' })).toBeVisible();

    // Progress bar should show 33%
    await expect(page.getByText('33%')).toBeVisible();
  });

  test('Step 2 renders topic input, content type, and platform checkboxes', async ({ page }) => {
    // Navigate to Step 2
    const channelSelect = page.locator('select').filter({ hasText: 'Select a channel...' }).first();
    await channelSelect.selectOption({ value: CHANNEL.id });
    await page.getByRole('button', { name: 'Next' }).click();

    // Topic input with correct placeholder
    const topicInput = page.getByPlaceholder('e.g. Top 5 AI Tools');
    await expect(topicInput).toBeVisible();

    // Content Type select
    const contentTypeSelect = page.locator('select').filter({ hasText: 'Short Video' }).first();
    await expect(contentTypeSelect).toBeVisible();

    // Platform checkboxes
    await expect(page.getByText('YouTube', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('TikTok', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Instagram', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Facebook', { exact: false }).first()).toBeVisible();
  });

  test('fill Step 2 and advance to Step 3 (Script)', async ({ page }) => {
    // Step 1: Select channel
    const channelSelect = page.locator('select').filter({ hasText: 'Select a channel...' }).first();
    await channelSelect.selectOption({ value: CHANNEL.id });
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 2: Fill topic and select platform
    const topicInput = page.getByPlaceholder('e.g. Top 5 AI Tools');
    await topicInput.fill('E2E Test Topic');

    // Check YouTube checkbox
    const youtubeLabel = page.locator('label').filter({ hasText: 'YouTube' }).first();
    await youtubeLabel.click();

    // Next should be enabled
    const nextButton = page.getByRole('button', { name: 'Next' });
    await expect(nextButton).toBeEnabled();

    // Click Next to go to Step 3
    await nextButton.click();

    // Step 3: "Script" heading should be visible
    await expect(page.getByText('Step 3 of 6')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'Script' })).toBeVisible();

    // "Regenerate" button should be present (may take a moment to render)
    await expect(page.getByRole('button', { name: 'Regenerate' })).toBeVisible({ timeout: 10_000 });

    // Script area should be visible — either a textarea (after generation)
    // or a generating indicator (if AI service is running)
    const textarea = page.locator('textarea');
    const generating = page.getByText('Generating script');
    await expect(textarea.or(generating).first()).toBeVisible({ timeout: 10_000 });
  });

  test('Back button navigates to previous step', async ({ page }) => {
    // Navigate to Step 2
    const channelSelect = page.locator('select').filter({ hasText: 'Select a channel...' }).first();
    await channelSelect.selectOption({ value: CHANNEL.id });
    await page.getByRole('button', { name: 'Next' }).click();

    // Verify we are on Step 2
    await expect(page.getByText('Step 2 of 6')).toBeVisible();

    // Click Back
    const backButton = page.getByRole('button', { name: 'Back' });
    await expect(backButton).toBeEnabled();
    await backButton.click();

    // Should be back on Step 1
    await expect(page.getByText('Step 1 of 6')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Select Channel' })).toBeVisible();
  });

  test('step indicator buttons show correct progress', async ({ page }) => {
    // Step 1 indicator should be active (the "Channel" button)
    const step1Button = page.locator('button').filter({ hasText: 'Channel' }).first();
    await expect(step1Button).toBeVisible();

    // Step 2 "Concept" should be visible but not yet active
    const step2Button = page.locator('button').filter({ hasText: 'Concept' }).first();
    await expect(step2Button).toBeVisible();

    // Navigate to step 2
    const channelSelect = page.locator('select').filter({ hasText: 'Select a channel...' }).first();
    await channelSelect.selectOption({ value: CHANNEL.id });
    await page.getByRole('button', { name: 'Next' }).click();

    // Now Step 2 indicator should be current — "Step 2 of 6"
    await expect(page.getByText('Step 2 of 6')).toBeVisible();

    // Step 1 should now show as completed (green checkmark)
    // Clicking step 1 indicator should navigate back
    await step1Button.click();
    await expect(page.getByText('Step 1 of 6')).toBeVisible();
  });
});
