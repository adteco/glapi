import { test, expect } from '@playwright/test';

test.describe('Vendor Bills Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/transactions/procurement/vendor-bills');
  });

  test('displays the vendor bills page with header and actions', async ({ page }) => {
    // Check page title
    await expect(page.getByRole('heading', { name: 'Vendor Bills' })).toBeVisible();

    // Check action buttons
    await expect(page.getByRole('button', { name: /Export/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /New Bill/i })).toBeVisible();
  });

  test('displays summary cards with metrics', async ({ page }) => {
    await expect(page.getByText('Total Bills')).toBeVisible();
    await expect(page.getByText('Outstanding Balance')).toBeVisible();
    await expect(page.getByText('Overdue')).toBeVisible();
    await expect(page.getByText('With Variances')).toBeVisible();
  });

  test('displays bills table with correct columns', async ({ page }) => {
    // Check table headers
    await expect(page.getByRole('columnheader', { name: 'Bill Number' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Vendor' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'PO Number' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Bill Date' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Due Date' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Total' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Balance Due' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Match' })).toBeVisible();
  });

  test('can filter bills by search term', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search bills...');
    await searchInput.fill('BILL-2026-001');

    // Verify filtered results
    await expect(page.getByText('BILL-2026-001')).toBeVisible();
  });

  test('can filter bills by status', async ({ page }) => {
    // Open status filter
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Approved' }).click();

    // Check that filter is applied (status badge should be visible)
    await expect(page.getByText('APPROVED')).toBeVisible();
  });

  test('can view bill details in dialog', async ({ page }) => {
    // Click view button on first bill row
    const viewButton = page.locator('button').filter({ has: page.locator('[class*="Eye"]') }).first();
    await viewButton.click();

    // Check dialog appears with details
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Bill Details')).toBeVisible();
    await expect(page.getByText('Vendor')).toBeVisible();
    await expect(page.getByText('Bill Date')).toBeVisible();
    await expect(page.getByText('Due Date')).toBeVisible();
  });

  test('shows variance warning for bills with variances', async ({ page }) => {
    // Filter to show a bill with variance
    const searchInput = page.getByPlaceholder('Search bills...');
    await searchInput.fill('BILL-2026-002');

    // Check variance badge is visible
    await expect(page.getByText('VARIANCE')).toBeVisible();
  });

  test('can export bills to CSV', async ({ page }) => {
    // Set up download listener
    const downloadPromise = page.waitForEvent('download');

    // Click export button
    await page.getByRole('button', { name: /Export/i }).click();

    // Verify download started
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('vendor-bills');
    expect(download.suggestedFilename()).toContain('.csv');
  });
});
