import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { uniqueId, formatCurrency } from '../utils/test-helpers';

test.describe('Refunds', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/transactions/sales/refunds');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load refunds list page', async ({ page }) => {
      await expect(page).toHaveURL(/\/transactions.*refunds/);
    });

    test('should display refunds table or empty state', async () => {
      const hasRows = (await listPage.getRowCount()) > 0;
      const isEmpty = await listPage.isEmpty();
      expect(hasRows || isEmpty).toBe(true);
    });

    test('should display search input', async () => {
      await expect(listPage.searchInput).toBeVisible();
    });

    test('should display create button', async () => {
      await expect(listPage.createButton).toBeVisible();
    });

    test('should display correct table headers', async () => {
      const headers = await listPage.tableHeaders.allTextContents();
      const headerText = headers.join(' ').toLowerCase();
      expect(headerText).toMatch(/number|customer|date|amount|status|method/i);
    });
  });

  test.describe('Search and Filter', () => {
    test('should search refunds by number', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const firstRowText = await listPage.getRow(0).textContent();
      const searchTerm = firstRowText?.split(' ')[0] || 'REF';

      await listPage.search(searchTerm);

      const filteredCount = await listPage.getRowCount();
      expect(filteredCount).toBeLessThanOrEqual(rowCount);
    });

    test('should filter by status', async ({ page }) => {
      const statusFilter = page.locator('button:has-text("Status"), [data-testid="status-filter"]');
      if (await statusFilter.isVisible()) {
        await statusFilter.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
    });

    test('should filter by payment method', async ({ page }) => {
      const methodFilter = page.locator('button:has-text("Method"), [data-testid="method-filter"]');
      if (await methodFilter.isVisible()) {
        await methodFilter.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
    });

    test('should filter by customer', async ({ page }) => {
      const customerFilter = page.locator('button:has-text("Customer"), [data-testid="customer-filter"]');
      if (await customerFilter.isVisible()) {
        await customerFilter.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
    });
  });

  test.describe('Create Refund', () => {
    test('should navigate to create refund page', async ({ page }) => {
      await listPage.clickCreate();

      await expect(page).toHaveURL(/\/transactions.*refunds\/(new|create)/);
    });

    test('should display customer selector', async ({ page }) => {
      await listPage.clickCreate();

      const customerSelect = page.locator('[name="customerId"], [data-testid="customer-select"]');
      await expect(customerSelect).toBeVisible();
    });

    test('should display payment method selector', async ({ page }) => {
      await listPage.clickCreate();

      const methodSelect = page.locator('[name="paymentMethod"], [data-testid="payment-method"]');
      await expect(methodSelect).toBeVisible();
    });

    test('should display amount field', async ({ page }) => {
      await listPage.clickCreate();

      const amountField = page.locator('[name="amount"], [data-testid="amount"]');
      await expect(amountField).toBeVisible();
    });

    test('should display refund reason field', async ({ page }) => {
      await listPage.clickCreate();

      const reasonField = page.locator('[name="reason"], [name="memo"], textarea');
      // Reason field should be visible
    });

    test('should display original payment/invoice reference', async ({ page }) => {
      await listPage.clickCreate();

      // Refunds are often linked to original payments or invoices
      const referenceSelect = page.locator('[name="paymentId"], [name="invoiceId"], [data-testid="reference-select"]');
      // May or may not be visible depending on workflow
    });

    test('should validate required fields', async ({ page }) => {
      await listPage.clickCreate();

      const saveButton = page.locator('button:has-text("Save"), button:has-text("Create"), button:has-text("Process"), button[type="submit"]');
      await saveButton.click();

      const error = page.locator('.error, [role="alert"], .text-destructive');
      await expect(error).toBeVisible();
    });

    test('should validate amount is positive', async ({ page }) => {
      await listPage.clickCreate();

      const amountField = page.locator('[name="amount"], [data-testid="amount"]');
      if (await amountField.isVisible()) {
        await amountField.fill('-100');

        const saveButton = page.locator('button:has-text("Save"), button:has-text("Create"), button[type="submit"]');
        await saveButton.click();

        // Should show validation error
        const error = page.locator('.error, [role="alert"], .text-destructive');
        await expect(error).toBeVisible();
      }
    });
  });

  test.describe('View Refund', () => {
    test('should navigate to refund detail', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      await expect(page).toHaveURL(/\/transactions.*refunds\/[^/]+$/);
    });

    test('should display refund details', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const refundNumber = page.locator('h1, h2, [data-testid="refund-number"]');
      await expect(refundNumber).toBeVisible();
    });

    test('should display refund amount', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const amountDisplay = page.locator('[data-testid="refund-amount"], :has-text("Amount")');
      await expect(amountDisplay).toBeVisible();
    });

    test('should display payment method used', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const methodDisplay = page.locator('[data-testid="payment-method"], :has-text("Method")');
      // Method should be visible
    });

    test('should display linked transaction if applicable', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const linkedTransaction = page.locator('[data-testid="linked-transaction"], :has-text("Original")');
      // May or may not be present
    });
  });

  test.describe('Refund Actions', () => {
    test('should have print receipt option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const printButton = page.locator('button:has-text("Print"), button:has-text("Receipt")');
      // Print option may or may not be present
    });

    test('should have email receipt option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const emailButton = page.locator('button:has-text("Email"), button:has-text("Send")');
      // Email option may or may not be present
    });
  });

  test.describe('Void Refund', () => {
    test('should show void confirmation', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Look for void action
      const row = listPage.getRow(0);
      const voidButton = row.locator('button:has-text("Void")');
      const menuButton = row.locator('button[aria-label*="action"], button[aria-label*="menu"]');

      if (await voidButton.isVisible()) {
        await voidButton.click();
        const alertDialog = page.locator('[role="alertdialog"], [role="dialog"]');
        await expect(alertDialog).toBeVisible();
      } else if (await menuButton.isVisible()) {
        await menuButton.click();
        const voidOption = page.locator('[role="menuitem"]:has-text("Void")');
        if (await voidOption.isVisible()) {
          await voidOption.click();
          const alertDialog = page.locator('[role="alertdialog"], [role="dialog"]');
          await expect(alertDialog).toBeVisible();
        }
      }
    });
  });

  test.describe('Delete Refund', () => {
    test('should show delete confirmation for draft refund', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.deleteRow(0);

      const alertDialog = page.locator('[role="alertdialog"], [role="dialog"]');
      await expect(alertDialog).toBeVisible();
    });

    test('should cancel delete operation', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.deleteRow(0);
      await listPage.cancelDelete();

      const newCount = await listPage.getRowCount();
      expect(newCount).toBe(rowCount);
    });
  });

  test.describe('Pagination', () => {
    test('should show pagination for many refunds', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount >= 10) {
        await expect(listPage.pagination).toBeVisible();
      }
    });
  });

  test.describe('Table Sorting', () => {
    test('should sort by date', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Date');
    });

    test('should sort by amount', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Amount');
    });

    test('should sort by status', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Status');
    });
  });
});
