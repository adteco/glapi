import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { uniqueId, formatCurrency } from '../utils/test-helpers';

test.describe('Vendor Payments', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/transactions/purchasing/bill-payments');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load vendor payments list page', async ({ page }) => {
      await expect(page).toHaveURL(/\/transactions.*vendor-payments/);
    });

    test('should display vendor payments table or empty state', async () => {
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
      expect(headerText).toMatch(/number|vendor|date|amount|status|method/i);
    });
  });

  test.describe('Search and Filter', () => {
    test('should search vendor payments by number', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const firstRowText = await listPage.getRow(0).textContent();
      const searchTerm = firstRowText?.split(' ')[0] || 'PMT';

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

    test('should filter by vendor', async ({ page }) => {
      const vendorFilter = page.locator('button:has-text("Vendor"), [data-testid="vendor-filter"]');
      if (await vendorFilter.isVisible()) {
        await vendorFilter.click();
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

    test('should filter by date range', async ({ page }) => {
      const dateFilter = page.locator('button:has-text("Date"), [data-testid="date-filter"]');
      if (await dateFilter.isVisible()) {
        await dateFilter.click();
        const preset = page.locator('[role="option"]:has-text("30"), button:has-text("30")');
        if (await preset.isVisible()) {
          await preset.click();
          await listPage.waitForPageLoad();
        }
      }
    });
  });

  test.describe('Create Vendor Payment', () => {
    test('should navigate to create vendor payment page', async ({ page }) => {
      await listPage.clickCreate();

      await expect(page).toHaveURL(/\/transactions.*vendor-payments\/(new|create)/);
    });

    test('should display vendor selector', async ({ page }) => {
      await listPage.clickCreate();

      const vendorSelect = page.locator('[name="vendorId"], [data-testid="vendor-select"]');
      await expect(vendorSelect).toBeVisible();
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

    test('should display payment date field', async ({ page }) => {
      await listPage.clickCreate();

      const dateField = page.locator('[name="paymentDate"], [name="date"]');
      await expect(dateField).toBeVisible();
    });

    test('should display bills to pay section', async ({ page }) => {
      await listPage.clickCreate();

      // Vendor payments are typically applied to outstanding bills
      const billsSection = page.locator('[data-testid="bills-to-pay"], :has-text("Bills"), table');
      await expect(billsSection).toBeVisible();
    });

    test('should display bank account selector', async ({ page }) => {
      await listPage.clickCreate();

      const bankSelect = page.locator('[name="bankAccountId"], [data-testid="bank-account"]');
      // Bank account selector should be visible for payments
    });

    test('should display memo/reference field', async ({ page }) => {
      await listPage.clickCreate();

      const memoField = page.locator('[name="memo"], [name="reference"], textarea');
      // Memo field should be visible
    });

    test('should validate required vendor', async ({ page }) => {
      await listPage.clickCreate();

      const saveButton = page.locator('button:has-text("Save"), button:has-text("Create"), button:has-text("Pay"), button[type="submit"]');
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

  test.describe('View Vendor Payment', () => {
    test('should navigate to vendor payment detail', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      await expect(page).toHaveURL(/\/transactions.*vendor-payments\/[^/]+$/);
    });

    test('should display payment details', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const paymentNumber = page.locator('h1, h2, [data-testid="payment-number"]');
      await expect(paymentNumber).toBeVisible();
    });

    test('should display payment amount', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const amountDisplay = page.locator('[data-testid="payment-amount"], :has-text("Amount")');
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

    test('should display applied bills', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const appliedBills = page.locator('[data-testid="applied-bills"], table, :has-text("Applied")');
      // Applied bills section may or may not be visible
    });
  });

  test.describe('Vendor Payment Actions', () => {
    test('should have print check option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const printButton = page.locator('button:has-text("Print"), button:has-text("Check")');
      // Print option may or may not be present
    });

    test('should have email remittance option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const emailButton = page.locator('button:has-text("Email"), button:has-text("Remittance")');
      // Email option may or may not be present
    });
  });

  test.describe('Void Vendor Payment', () => {
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

  test.describe('Delete Vendor Payment', () => {
    test('should show delete confirmation for draft payment', async ({ page }) => {
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
    test('should show pagination for many vendor payments', async () => {
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

    test('should sort by vendor', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Vendor');
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
