import { test, expect } from '@playwright/test';

test.describe('Bill Payments Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/transactions/procurement/bill-payments');
  });

  test('displays the bill payments page with header and actions', async ({ page }) => {
    // Check page title
    await expect(page.getByRole('heading', { name: 'Bill Payments' })).toBeVisible();

    // Check action buttons
    await expect(page.getByRole('button', { name: /Export/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /New Payment/i })).toBeVisible();
  });

  test('displays summary cards with metrics', async ({ page }) => {
    await expect(page.getByText('Total Payments')).toBeVisible();
    await expect(page.getByText('Total Amount')).toBeVisible();
    await expect(page.getByText('Pending')).toBeVisible();
    await expect(page.getByText('Cleared')).toBeVisible();
  });

  test('displays payments table with correct columns', async ({ page }) => {
    // Check table headers
    await expect(page.getByRole('columnheader', { name: 'Payment Number' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Vendor' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Date' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Method' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Check #' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Bank Account' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Amount' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
  });

  test('can filter payments by search term', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search payments...');
    await searchInput.fill('PMT-2026-001');

    // Verify filtered results
    await expect(page.getByText('PMT-2026-001')).toBeVisible();
  });

  test('can filter payments by status', async ({ page }) => {
    // Open status filter
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Cleared' }).click();

    // Check that filter is applied
    await expect(page.getByText('CLEARED')).toBeVisible();
  });

  test('can view payment details in dialog', async ({ page }) => {
    // Click view button on first payment row
    const viewButton = page.locator('button').filter({ has: page.locator('[class*="Eye"]') }).first();
    await viewButton.click();

    // Check dialog appears with details
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Payment Details')).toBeVisible();
    await expect(page.getByText('Applied Bills')).toBeVisible();
  });

  test('can open create payment dialog', async ({ page }) => {
    // Click new payment button
    await page.getByRole('button', { name: /New Payment/i }).click();

    // Check dialog appears
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Create Bill Payment')).toBeVisible();
    await expect(page.getByText('Select Bills to Pay')).toBeVisible();
  });

  test('create payment dialog shows vendor and payment method fields', async ({ page }) => {
    await page.getByRole('button', { name: /New Payment/i }).click();

    // Check form fields are present
    await expect(page.getByLabel('Vendor')).toBeVisible();
    await expect(page.getByLabel('Payment Date')).toBeVisible();
    await expect(page.getByLabel('Payment Method')).toBeVisible();
    await expect(page.getByLabel('Bank Account')).toBeVisible();
  });

  test('create payment button is disabled when no bills selected', async ({ page }) => {
    await page.getByRole('button', { name: /New Payment/i }).click();

    // Check create button is disabled
    const createButton = page.getByRole('button', { name: 'Create Payment' });
    await expect(createButton).toBeDisabled();
  });

  test('can export payments to CSV', async ({ page }) => {
    // Set up download listener
    const downloadPromise = page.waitForEvent('download');

    // Click export button
    await page.getByRole('button', { name: /Export/i }).click();

    // Verify download started
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('bill-payments');
    expect(download.suggestedFilename()).toContain('.csv');
  });
});
