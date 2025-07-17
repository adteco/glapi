import { test, expect } from '@playwright/test';

test.describe('Financial Reports', () => {
  // Skip auth for now - you'll need to implement proper auth setup
  test.beforeEach(async ({ page }) => {
    // TODO: Add authentication setup here
    // For now, assume user is logged in or mock auth
  });

  test('Dashboard should display financial reports section', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Check if dashboard loads without errors
    await expect(page).toHaveTitle(/Dashboard/);
    
    // Check for financial reports section
    await expect(page.locator('text=Financial Reports')).toBeVisible();
    
    // Check for report links
    await expect(page.locator('text=Balance Sheet')).toBeVisible();
    await expect(page.locator('text=Income Statement')).toBeVisible();
    await expect(page.locator('text=Cash Flow Statement')).toBeVisible();
    
    // Check "View All Reports" button
    await expect(page.locator('text=View All Reports')).toBeVisible();
  });

  test('Reports page should load and display all report categories', async ({ page }) => {
    await page.goto('/reports');
    
    // Check page title
    await expect(page.locator('h1')).toContainText('Reports');
    
    // Check for report categories
    await expect(page.locator('text=Financial Reports')).toBeVisible();
    await expect(page.locator('text=Transaction Reports')).toBeVisible();
    await expect(page.locator('text=Budget Reports')).toBeVisible();
    
    // Check for individual reports
    await expect(page.locator('text=Balance Sheet')).toBeVisible();
    await expect(page.locator('text=Income Statement')).toBeVisible();
    await expect(page.locator('text=Cash Flow Statement')).toBeVisible();
  });

  test('Balance Sheet page should load without errors', async ({ page }) => {
    await page.goto('/reports/financial/balance-sheet');
    
    // Check page loads
    await expect(page.locator('h1')).toContainText('Balance Sheet');
    
    // Check for main elements
    await expect(page.locator('text=Options')).toBeVisible();
    await expect(page.locator('text=Refresh')).toBeVisible();
    await expect(page.locator('text=Print')).toBeVisible();
    await expect(page.locator('text=Export')).toBeVisible();
    
    // Check initial state message
    await expect(page.locator('text=Click "Options" to configure and generate')).toBeVisible();
    
    // Test opening options dialog
    await page.click('text=Options');
    await expect(page.locator('text=Balance Sheet Options')).toBeVisible();
    
    // Check form fields
    await expect(page.locator('label:has-text("As of Date")')).toBeVisible();
    await expect(page.locator('label:has-text("Subsidiary")')).toBeVisible();
    await expect(page.locator('label:has-text("Report Basis")')).toBeVisible();
  });

  test('Income Statement page should load without errors', async ({ page }) => {
    await page.goto('/reports/financial/income-statement');
    
    // Check page loads
    await expect(page.locator('h1')).toContainText('Income Statement');
    
    // Check for main elements
    await expect(page.locator('text=Options')).toBeVisible();
    await expect(page.locator('text=Refresh')).toBeVisible();
    await expect(page.locator('text=Print')).toBeVisible();
    await expect(page.locator('text=Export')).toBeVisible();
    
    // Test opening options dialog
    await page.click('text=Options');
    await expect(page.locator('text=Income Statement Options')).toBeVisible();
    
    // Check form fields
    await expect(page.locator('label:has-text("Start Date")')).toBeVisible();
    await expect(page.locator('label:has-text("End Date")')).toBeVisible();
    await expect(page.locator('label:has-text("Report Period")')).toBeVisible();
  });

  test('Cash Flow Statement page should load without errors', async ({ page }) => {
    await page.goto('/reports/financial/cash-flow-statement');
    
    // Check page loads
    await expect(page.locator('h1')).toContainText('Cash Flow Statement');
    
    // Check for main elements
    await expect(page.locator('text=Options')).toBeVisible();
    await expect(page.locator('text=Refresh')).toBeVisible();
    await expect(page.locator('text=Print')).toBeVisible();
    await expect(page.locator('text=Export')).toBeVisible();
    
    // Test opening options dialog
    await page.click('text=Options');
    await expect(page.locator('text=Cash Flow Statement Options')).toBeVisible();
    
    // Check form fields
    await expect(page.locator('label:has-text("Start Date")')).toBeVisible();
    await expect(page.locator('label:has-text("End Date")')).toBeVisible();
    await expect(page.locator('label:has-text("Method")')).toBeVisible();
  });

  test('Budget management page should load without errors', async ({ page }) => {
    await page.goto('/transactions/management/budgets');
    
    // Check page loads
    await expect(page.locator('h1')).toContainText('Budgets');
    
    // Check for main elements
    await expect(page.locator('text=New Budget')).toBeVisible();
    
    // Check table headers
    await expect(page.locator('text=Budget Name')).toBeVisible();
    await expect(page.locator('text=Type')).toBeVisible();
    await expect(page.locator('text=Fiscal Year')).toBeVisible();
    await expect(page.locator('text=Status')).toBeVisible();
    
    // Test opening new budget dialog
    await page.click('text=New Budget');
    await expect(page.locator('text=New Budget')).toBeVisible();
    
    // Check form fields
    await expect(page.locator('label:has-text("Budget Name")')).toBeVisible();
    await expect(page.locator('label:has-text("Budget Type")')).toBeVisible();
    await expect(page.locator('label:has-text("Fiscal Year")')).toBeVisible();
  });

  test('Navigation links work correctly', async ({ page }) => {
    // Start from dashboard
    await page.goto('/dashboard');
    
    // Click on Balance Sheet link
    await page.click('text=Balance Sheet >> nth=0'); // First Balance Sheet link
    await expect(page).toHaveURL(/.*balance-sheet/);
    
    // Go back to dashboard
    await page.goto('/dashboard');
    
    // Click on View All Reports
    await page.click('text=View All Reports');
    await expect(page).toHaveURL(/.*reports$/);
    
    // Click on Income Statement from reports page
    await page.click('text=Income Statement >> nth=0');
    await expect(page).toHaveURL(/.*income-statement/);
  });

  test('Responsive design works on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/dashboard');
    
    // Check that key elements are still visible on mobile
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('text=Financial Reports')).toBeVisible();
    
    // Test mobile navigation (sidebar)
    // This would depend on your mobile menu implementation
  });

  test('Error handling for missing organization', async ({ page }) => {
    // This test would require mocking the auth state to not have an orgId
    // Implementation depends on your auth setup
  });
});