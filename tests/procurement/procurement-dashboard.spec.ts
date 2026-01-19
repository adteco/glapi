import { test, expect } from '@playwright/test';

test.describe('Procurement Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/transactions/procurement');
  });

  test('displays the procurement dashboard with key metrics', async ({ page }) => {
    // Check page title
    await expect(page.getByRole('heading', { name: 'Procure-to-Pay' })).toBeVisible();

    // Check metric cards are displayed
    await expect(page.getByText('Open POs')).toBeVisible();
    await expect(page.getByText('Pending Receipts')).toBeVisible();
    await expect(page.getByText('Outstanding Payables')).toBeVisible();
    await expect(page.getByText('Payments This Month')).toBeVisible();
  });

  test('displays quick action cards for navigation', async ({ page }) => {
    // Check quick action cards
    await expect(page.getByRole('heading', { name: 'Purchase Orders' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'PO Receipts' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Vendor Bills' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Bill Payments' })).toBeVisible();
  });

  test('navigates to Purchase Orders page', async ({ page }) => {
    await page.getByRole('heading', { name: 'Purchase Orders' }).click();
    await expect(page).toHaveURL(/purchase-orders/);
  });

  test('navigates to Vendor Bills page', async ({ page }) => {
    await page.getByRole('heading', { name: 'Vendor Bills' }).click();
    await expect(page).toHaveURL(/vendor-bills/);
  });

  test('navigates to Bill Payments page', async ({ page }) => {
    await page.getByRole('heading', { name: 'Bill Payments' }).click();
    await expect(page).toHaveURL(/bill-payments/);
  });

  test('shows processing metrics section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Processing Metrics' })).toBeVisible();
    await expect(page.getByText('Avg. Days to Process')).toBeVisible();
    await expect(page.getByText('3-Way Match Rate')).toBeVisible();
    await expect(page.getByText('Total Paid (YTD)')).toBeVisible();
  });
});
