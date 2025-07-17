import { test, expect } from '@playwright/test';

test.describe('Transaction Pages', () => {
  test.beforeEach(async ({ page }) => {
    // TODO: Add authentication setup here
  });

  test('Sales Invoices page should load without errors', async ({ page }) => {
    await page.goto('/transactions/sales/invoices');
    
    await expect(page.locator('h1')).toContainText('Sales Invoices');
    await expect(page.locator('text=New Invoice')).toBeVisible();
    
    // Test opening new invoice dialog
    await page.click('text=New Invoice');
    await expect(page.locator('text=New Sales Invoice')).toBeVisible();
    
    // Check required form fields
    await expect(page.locator('label:has-text("Customer")')).toBeVisible();
    await expect(page.locator('label:has-text("Invoice Date")')).toBeVisible();
    await expect(page.locator('label:has-text("Due Date")')).toBeVisible();
    await expect(page.locator('label:has-text("Payment Terms")')).toBeVisible();
    
    // Check approval workflow checkbox
    await expect(page.locator('text=Requires Approval')).toBeVisible();
  });

  test('Purchase Orders page should load without errors', async ({ page }) => {
    await page.goto('/transactions/inventory/purchase-orders');
    
    await expect(page.locator('h1')).toContainText('Purchase Orders');
    await expect(page.locator('text=New Purchase Order')).toBeVisible();
    
    // Test opening new PO dialog
    await page.click('text=New Purchase Order');
    await expect(page.locator('text=New Purchase Order')).toBeVisible();
    
    // Check required form fields
    await expect(page.locator('label:has-text("Vendor")')).toBeVisible();
    await expect(page.locator('label:has-text("Warehouse")')).toBeVisible();
    await expect(page.locator('label:has-text("Order Date")')).toBeVisible();
    await expect(page.locator('label:has-text("Expected Delivery")')).toBeVisible();
  });

  test('Journal Entry page should load without errors', async ({ page }) => {
    await page.goto('/transactions/management/journal');
    
    await expect(page.locator('h1')).toContainText('Journal Entries');
    await expect(page.locator('text=New Journal Entry')).toBeVisible();
    
    // Test opening new journal entry dialog
    await page.click('text=New Journal Entry');
    await expect(page.locator('text=New Journal Entry')).toBeVisible();
    
    // Check journal entry specific fields
    await expect(page.locator('label:has-text("Transaction Date")')).toBeVisible();
    await expect(page.locator('label:has-text("Reference")')).toBeVisible();
    await expect(page.locator('text=Line Items')).toBeVisible();
  });

  test('Sales Orders page should load without errors', async ({ page }) => {
    await page.goto('/transactions/sales/sales-orders');
    
    await expect(page.locator('h1')).toContainText('Sales Orders');
    await expect(page.locator('text=New Sales Order')).toBeVisible();
    
    // Test table structure
    await expect(page.locator('text=Order #')).toBeVisible();
    await expect(page.locator('text=Customer')).toBeVisible();
    await expect(page.locator('text=Status')).toBeVisible();
    await expect(page.locator('text=Amount')).toBeVisible();
  });

  test('Inventory Adjustments page should load without errors', async ({ page }) => {
    await page.goto('/transactions/inventory/adjustments');
    
    await expect(page.locator('h1')).toContainText('Inventory Adjustments');
    await expect(page.locator('text=New Adjustment')).toBeVisible();
    
    // Test opening new adjustment dialog
    await page.click('text=New Adjustment');
    await expect(page.locator('text=New Inventory Adjustment')).toBeVisible();
    
    // Check adjustment specific fields
    await expect(page.locator('label:has-text("Warehouse")')).toBeVisible();
    await expect(page.locator('label:has-text("Adjustment Date")')).toBeVisible();
    await expect(page.locator('label:has-text("Reason")')).toBeVisible();
  });

  test('Inventory Transfers page should load without errors', async ({ page }) => {
    await page.goto('/transactions/inventory/transfers');
    
    await expect(page.locator('h1')).toContainText('Inventory Transfers');
    await expect(page.locator('text=New Transfer')).toBeVisible();
    
    // Test table structure
    await expect(page.locator('text=Transfer #')).toBeVisible();
    await expect(page.locator('text=From Warehouse')).toBeVisible();
    await expect(page.locator('text=To Warehouse')).toBeVisible();
    await expect(page.locator('text=Status')).toBeVisible();
  });

  test('Inventory Receipts page should load without errors', async ({ page }) => {
    await page.goto('/transactions/inventory/receipts');
    
    await expect(page.locator('h1')).toContainText('Inventory Receipts');
    await expect(page.locator('text=New Receipt')).toBeVisible();
    
    // Test opening new receipt dialog
    await page.click('text=New Receipt');
    await expect(page.locator('text=New Inventory Receipt')).toBeVisible();
    
    // Check receipt specific fields
    await expect(page.locator('label:has-text("Vendor")')).toBeVisible();
    await expect(page.locator('label:has-text("Warehouse")')).toBeVisible();
    await expect(page.locator('label:has-text("Received Date")')).toBeVisible();
    await expect(page.locator('label:has-text("Delivery Method")')).toBeVisible();
  });

  test('Sales Estimates page should load without errors', async ({ page }) => {
    await page.goto('/transactions/sales/estimates');
    
    await expect(page.locator('h1')).toContainText('Sales Estimates');
    await expect(page.locator('text=New Estimate')).toBeVisible();
    
    // Test table structure
    await expect(page.locator('text=Estimate #')).toBeVisible();
    await expect(page.locator('text=Customer')).toBeVisible();
    await expect(page.locator('text=Win Probability')).toBeVisible();
    await expect(page.locator('text=Status')).toBeVisible();
  });

  test('Opportunities page should load without errors', async ({ page }) => {
    await page.goto('/transactions/sales/opportunities');
    
    await expect(page.locator('h1')).toContainText('Opportunities');
    await expect(page.locator('text=New Opportunity')).toBeVisible();
    
    // Test opening new opportunity dialog
    await page.click('text=New Opportunity');
    await expect(page.locator('text=New Opportunity')).toBeVisible();
    
    // Check opportunity specific fields
    await expect(page.locator('label:has-text("Opportunity Name")')).toBeVisible();
    await expect(page.locator('label:has-text("Customer")')).toBeVisible();
    await expect(page.locator('label:has-text("Sales Stage")')).toBeVisible();
    await expect(page.locator('label:has-text("Win Probability")')).toBeVisible();
  });

  test('Fulfillment page should load without errors', async ({ page }) => {
    await page.goto('/transactions/sales/fulfillment');
    
    await expect(page.locator('h1')).toContainText('Fulfillment');
    await expect(page.locator('text=New Fulfillment')).toBeVisible();
    
    // Test table structure
    await expect(page.locator('text=Fulfillment #')).toBeVisible();
    await expect(page.locator('text=Sales Order')).toBeVisible();
    await expect(page.locator('text=Ship Date')).toBeVisible();
    await expect(page.locator('text=Status')).toBeVisible();
  });

  test('Form validation works correctly', async ({ page }) => {
    await page.goto('/transactions/sales/invoices');
    
    // Open new invoice dialog
    await page.click('text=New Invoice');
    
    // Try to submit without required fields
    await page.click('text=Create Invoice');
    
    // Check for validation errors
    await expect(page.locator('text=Customer is required')).toBeVisible();
    await expect(page.locator('text=Payment terms are required')).toBeVisible();
  });

  test('Navigation between transaction types works', async ({ page }) => {
    // Start from sales invoices
    await page.goto('/transactions/sales/invoices');
    
    // Navigate to sales orders using sidebar
    // This would require implementing proper sidebar navigation test
    // For now, test direct navigation
    await page.goto('/transactions/sales/sales-orders');
    await expect(page.locator('h1')).toContainText('Sales Orders');
    
    // Navigate to purchase orders
    await page.goto('/transactions/inventory/purchase-orders');
    await expect(page.locator('h1')).toContainText('Purchase Orders');
    
    // Navigate to journal entries
    await page.goto('/transactions/management/journal');
    await expect(page.locator('h1')).toContainText('Journal Entries');
  });
});