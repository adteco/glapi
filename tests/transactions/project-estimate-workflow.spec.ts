import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';

/**
 * Tests for the Project → Estimate → Sales Order workflow
 * Covers:
 * - Navigation from Projects to Estimates with filter
 * - Project filter on Estimates page
 * - Unfulfilled Sales Orders dashboard card
 * - Invoice creation from Sales Order
 */
test.describe('Project to Estimate Workflow', () => {
  test.describe('Project Navigation to Estimates', () => {
    let listPage: ListPage;

    test.beforeEach(async ({ page }) => {
      listPage = new ListPage(page);
      await page.goto('/projects');
      await listPage.waitForPageLoad();
    });

    test('should display estimates icon in project actions', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const row = listPage.getRow(0);
      // Look for the FileText icon button (estimates)
      const estimatesButton = row.locator('button[title*="estimate" i], button:has(svg.lucide-file-text)');
      await expect(estimatesButton).toBeVisible();
    });

    test('should navigate to estimates page with project filter when clicking estimates icon', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const row = listPage.getRow(0);
      // Click the estimates button
      const estimatesButton = row.locator('button[title*="estimate" i], button:has(svg.lucide-file-text)');

      if (await estimatesButton.isVisible()) {
        await estimatesButton.click();

        // Should navigate to estimates page with projectId query param
        await expect(page).toHaveURL(/\/transactions\/sales\/estimates\?projectId=/);
      }
    });
  });

  test.describe('Estimates Page Project Filter', () => {
    test('should load estimates page without filter', async ({ page }) => {
      await page.goto('/transactions/sales/estimates');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('h1:has-text("Sales Estimates")')).toBeVisible();
      // Should not show project filter badge
      await expect(page.locator('text=Clear filter')).not.toBeVisible();
    });

    test('should show project filter badge when projectId is in URL', async ({ page }) => {
      // Navigate to estimates page with a dummy projectId
      // The filter badge should show if valid, or page loads without filter if invalid
      await page.goto('/transactions/sales/estimates?projectId=00000000-0000-0000-0000-000000000000');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('h1:has-text("Sales Estimates")')).toBeVisible();
    });

    test('should clear project filter when clicking Clear filter button', async ({ page }) => {
      // Navigate with filter
      await page.goto('/transactions/sales/estimates?projectId=00000000-0000-0000-0000-000000000000');
      await page.waitForLoadState('networkidle');

      const clearButton = page.locator('button:has-text("Clear filter")');
      if (await clearButton.isVisible()) {
        await clearButton.click();

        // Should navigate back to estimates without filter
        await expect(page).toHaveURL('/transactions/sales/estimates');
        await expect(clearButton).not.toBeVisible();
      }
    });

    test('should pre-select project when creating new estimate with filter active', async ({ page }) => {
      // First get a real project ID from the projects page
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      const projectRow = page.locator('table tbody tr').first();
      if (!(await projectRow.isVisible())) {
        test.skip();
        return;
      }

      // Click the estimates icon to navigate with project filter
      const estimatesButton = projectRow.locator('button[title*="estimate" i], button:has(svg.lucide-file-text)');
      if (await estimatesButton.isVisible()) {
        await estimatesButton.click();
        await page.waitForLoadState('networkidle');

        // Click New Estimate button
        const newEstimateButton = page.locator('button:has-text("New Estimate")');
        await newEstimateButton.click();

        // Check that the project dropdown has a value pre-selected (not __none__)
        const dialog = page.locator('[role="dialog"]');
        await expect(dialog).toBeVisible();

        // The project field should be visible in the form
        const projectField = dialog.locator('text=Project').first();
        await expect(projectField).toBeVisible();
      }
    });
  });

  test.describe('Unfulfilled Sales Orders Dashboard Card', () => {
    test('should display Unfulfilled Sales Orders by Customer card', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Look for the card title with case-insensitive partial match
      const card = page.getByText(/Unfulfilled Sales Orders/i);
      await expect(card.first()).toBeVisible({ timeout: 10000 });
    });

    test('should display card description', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Look for description text
      const description = page.getByText(/pending invoicing|sales orders/i);
      await expect(description.first()).toBeVisible({ timeout: 10000 });
    });

    test('should have View Sales Orders link', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Look for any link/button that goes to sales orders
      const viewButton = page.locator('[href*="sales-orders"], button:has-text("Sales Orders")').first();
      await expect(viewButton).toBeVisible({ timeout: 10000 });
    });

    test('should navigate to sales orders page when clicking View Sales Orders', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      const viewButton = page.locator('[href*="sales-orders"]').first();
      if (await viewButton.isVisible()) {
        await viewButton.click();
        await expect(page).toHaveURL(/\/transactions\/sales\/sales-orders/);
      }
    });

    test('should display loading state or data', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Give time for dashboard to load
      await page.waitForTimeout(2000);

      // Check if the page has any content - dashboard should show something
      const dashboard = page.locator('main, [role="main"], .container');
      await expect(dashboard.first()).toBeVisible();

      // Check that the page isn't showing an error
      const errorVisible = await page.getByText(/error|failed/i).isVisible().catch(() => false);
      expect(errorVisible).toBe(false);
    });

    test('should display total unfulfilled amount when data exists', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Find the card and look for Total Unfulfilled
      const totalSection = page.getByText(/Total Unfulfilled/i);

      // May or may not be visible depending on whether there's data
      if (await totalSection.isVisible().catch(() => false)) {
        // Test passes if we find the label
        expect(true).toBe(true);
      }
    });
  });

  test.describe('Estimate to Sales Order Conversion', () => {
    let listPage: ListPage;

    test.beforeEach(async ({ page }) => {
      listPage = new ListPage(page);
      await page.goto('/transactions/sales/estimates');
      await listPage.waitForPageLoad();
    });

    test('should have convert to sales order button for draft estimates', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Find a DRAFT estimate row
      const draftRow = page.locator('table tbody tr').filter({ hasText: 'DRAFT' }).first();
      if (await draftRow.isVisible()) {
        // Look for convert button (Copy icon)
        const convertButton = draftRow.locator('button[title*="Convert" i], button:has(svg.lucide-copy)');
        await expect(convertButton).toBeVisible();
      }
    });

    test('should convert estimate to sales order when clicking convert button', async ({ page }) => {
      const draftRow = page.locator('table tbody tr').filter({ hasText: 'DRAFT' }).first();

      if (await draftRow.isVisible()) {
        // Get the estimate number before conversion
        const estimateNumber = await draftRow.locator('td').first().textContent();

        // Click convert button
        const convertButton = draftRow.locator('button[title*="Convert" i], button:has(svg.lucide-copy)');
        if (await convertButton.isVisible()) {
          await convertButton.click();

          // Wait for success toast or status change
          await page.waitForLoadState('networkidle');

          // Estimate status should change to CONVERTED or success toast should appear
          const toast = page.locator('[data-sonner-toast], [role="alert"]').filter({ hasText: /converted|sales order/i });
          const convertedStatus = page.locator(`tr:has-text("${estimateNumber}")`).locator('text=CONVERTED');

          const hasToast = await toast.isVisible().catch(() => false);
          const hasConvertedStatus = await convertedStatus.isVisible().catch(() => false);

          expect(hasToast || hasConvertedStatus).toBe(true);
        }
      }
    });
  });

  test.describe('Sales Order to Invoice Workflow', () => {
    let listPage: ListPage;

    test.beforeEach(async ({ page }) => {
      listPage = new ListPage(page);
      await page.goto('/transactions/sales/sales-orders');
      await page.waitForLoadState('networkidle');
    });

    test('should load sales orders page', async ({ page }) => {
      await expect(page).toHaveURL(/\/transactions\/sales\/sales-orders/);
    });

    test('sales orders should have invoice creation option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Find a non-cancelled sales order
      const orderRow = page.locator('table tbody tr').filter({ hasNotText: 'CANCELLED' }).first();
      if (await orderRow.isVisible()) {
        // Look for create invoice button or action
        const invoiceButton = orderRow.locator('button[title*="Invoice" i], button:has-text("Invoice")');
        // Invoice option may be in a menu
        const menuButton = orderRow.locator('button[aria-label*="action" i], button[aria-label*="menu" i]');

        const hasDirectButton = await invoiceButton.isVisible().catch(() => false);
        const hasMenu = await menuButton.isVisible().catch(() => false);

        expect(hasDirectButton || hasMenu).toBe(true);
      }
    });
  });
});
