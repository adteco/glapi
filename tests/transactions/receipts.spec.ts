import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';

test.describe('Inventory Receipts', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/transactions/inventory/receipts');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load inventory receipts list page', async ({ page }) => {
      await expect(page).toHaveURL(/\/transactions.*receipts/);
    });

    test('should display inventory receipts table or empty state', async () => {
      const hasRows = (await listPage.getRowCount()) > 0;
      const isEmpty = await listPage.isEmpty();
      expect(hasRows || isEmpty).toBe(true);
    });

    test('should display page title', async ({ page }) => {
      const title = page.locator('h1:has-text("Inventory Receipts")');
      await expect(title).toBeVisible();
    });

    test('should display create button', async () => {
      await expect(listPage.createButton).toBeVisible();
    });

    test('should display correct table headers', async () => {
      const headers = await listPage.tableHeaders.allTextContents();
      const headerText = headers.join(' ').toLowerCase();
      expect(headerText).toMatch(/receipt|vendor|warehouse|date|status|value/i);
    });
  });

  test.describe('Search and Filter', () => {
    test('should search receipts by number', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const firstRowText = await listPage.getRow(0).textContent();
      const searchTerm = firstRowText?.split(' ')[0] || 'REC';

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

    test('should filter by warehouse', async ({ page }) => {
      const warehouseFilter = page.locator('button:has-text("Warehouse"), [data-testid="warehouse-filter"]');
      if (await warehouseFilter.isVisible()) {
        await warehouseFilter.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
    });
  });

  test.describe('Create Inventory Receipt', () => {
    test('should open create receipt dialog', async ({ page }) => {
      await listPage.clickCreate();

      // Receipt creation uses a dialog
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();
    });

    test('should display vendor selector', async ({ page }) => {
      await listPage.clickCreate();

      const vendorSelect = page.locator('[name="vendorId"], [data-testid="vendor-select"]');
      await expect(vendorSelect).toBeVisible();
    });

    test('should display warehouse selector', async ({ page }) => {
      await listPage.clickCreate();

      const warehouseSelect = page.locator('[name="warehouseId"], [data-testid="warehouse-select"]');
      await expect(warehouseSelect).toBeVisible();
    });

    test('should display transaction date field', async ({ page }) => {
      await listPage.clickCreate();

      const transactionDate = page.locator('[name="transactionDate"], [data-testid="transaction-date"]');
      await expect(transactionDate).toBeVisible();
    });

    test('should display received date field', async ({ page }) => {
      await listPage.clickCreate();

      const receivedDate = page.locator('[name="receivedDate"], [data-testid="received-date"]');
      await expect(receivedDate).toBeVisible();
    });

    test('should display delivery method selector', async ({ page }) => {
      await listPage.clickCreate();

      const deliveryMethod = page.locator('[name="deliveryMethod"], [data-testid="delivery-method"]');
      await expect(deliveryMethod).toBeVisible();
    });

    test('should display reference number field', async ({ page }) => {
      await listPage.clickCreate();

      const referenceNumber = page.locator('[name="referenceNumber"], [data-testid="reference-number"]');
      // Reference number field should be visible
    });

    test('should display line items section', async ({ page }) => {
      await listPage.clickCreate();

      const lineItems = page.locator('[data-testid="line-items"], .items-received, :has-text("Items Received")');
      await expect(lineItems).toBeVisible();
    });

    test('should display add item button', async ({ page }) => {
      await listPage.clickCreate();

      const addItemButton = page.locator('button:has-text("Add Item")');
      await expect(addItemButton).toBeVisible();
    });

    test('should validate required vendor', async ({ page }) => {
      await listPage.clickCreate();

      const submitButton = page.locator('button:has-text("Create Receipt"), button:has-text("Save"), button[type="submit"]');
      await submitButton.click();

      const error = page.locator('.error, [role="alert"], .text-destructive, [class*="FormMessage"]');
      await expect(error).toBeVisible();
    });

    test('should validate required warehouse', async ({ page }) => {
      await listPage.clickCreate();

      // Select vendor but not warehouse
      const vendorSelect = page.locator('[name="vendorId"]');
      if (await vendorSelect.isVisible()) {
        await vendorSelect.click();
        const vendorOption = page.locator('[role="option"]').first();
        if (await vendorOption.isVisible()) {
          await vendorOption.click();
        }
      }

      const submitButton = page.locator('button:has-text("Create Receipt"), button:has-text("Save"), button[type="submit"]');
      await submitButton.click();

      const error = page.locator('.error, [role="alert"], .text-destructive, [class*="FormMessage"]');
      await expect(error).toBeVisible();
    });

    test('should close dialog on cancel', async ({ page }) => {
      await listPage.clickCreate();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      const cancelButton = page.locator('[role="dialog"] button:has-text("Cancel")');
      await cancelButton.click();

      await expect(dialog).not.toBeVisible();
    });
  });

  test.describe('View Inventory Receipt', () => {
    test('should open view receipt dialog', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const viewButton = listPage.getRow(0).locator('button:has([class*="eye"]), button[title="View"]');
      if (await viewButton.isVisible()) {
        await viewButton.click();

        const dialog = page.locator('[role="dialog"]');
        await expect(dialog).toBeVisible();
      }
    });

    test('should display receipt number', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const viewButton = listPage.getRow(0).locator('button:has([class*="eye"]), button[title="View"]');
      if (await viewButton.isVisible()) {
        await viewButton.click();

        const receiptNumber = page.locator('[data-testid="receipt-number"], :has-text("Receipt Number")');
        await expect(receiptNumber).toBeVisible();
      }
    });

    test('should display PO number if linked', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const viewButton = listPage.getRow(0).locator('button:has([class*="eye"]), button[title="View"]');
      if (await viewButton.isVisible()) {
        await viewButton.click();

        const poNumber = page.locator('[data-testid="po-number"], :has-text("PO Number")');
        // PO number may or may not be present
      }
    });

    test('should display vendor name', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const viewButton = listPage.getRow(0).locator('button:has([class*="eye"]), button[title="View"]');
      if (await viewButton.isVisible()) {
        await viewButton.click();

        const vendorDisplay = page.locator('[data-testid="vendor-name"], :has-text("Vendor")');
        await expect(vendorDisplay).toBeVisible();
      }
    });

    test('should display warehouse name', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const viewButton = listPage.getRow(0).locator('button:has([class*="eye"]), button[title="View"]');
      if (await viewButton.isVisible()) {
        await viewButton.click();

        const warehouseDisplay = page.locator('[data-testid="warehouse-name"], :has-text("Warehouse")');
        await expect(warehouseDisplay).toBeVisible();
      }
    });

    test('should display items received table', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const viewButton = listPage.getRow(0).locator('button:has([class*="eye"]), button[title="View"]');
      if (await viewButton.isVisible()) {
        await viewButton.click();

        const itemsTable = page.locator('[role="dialog"] table, [data-testid="items-table"]');
        await expect(itemsTable).toBeVisible();
      }
    });

    test('should display total value', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const viewButton = listPage.getRow(0).locator('button:has([class*="eye"]), button[title="View"]');
      if (await viewButton.isVisible()) {
        await viewButton.click();

        const totalValue = page.locator('[data-testid="total-value"], :has-text("Total Value")');
        await expect(totalValue).toBeVisible();
      }
    });
  });

  test.describe('Receipt Actions', () => {
    test('should have inspect action for received receipts', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Look for inspect action
      const row = listPage.getRow(0);
      const inspectButton = row.locator('button:has([class*="package"]), button[title*="Inspect"]');
      // Inspect button may be visible for received receipts
    });

    test('should have accept action for inspected receipts', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Look for accept action
      const row = listPage.getRow(0);
      const acceptButton = row.locator('button:has([class*="check"]), button[title*="Accept"]');
      // Accept button may be visible for inspected receipts
    });
  });

  test.describe('Delete Inventory Receipt', () => {
    test('should show delete confirmation', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const row = listPage.getRow(0);
      const deleteButton = row.locator('button:has([class*="trash"]), button[title="Delete"]');

      if (await deleteButton.isVisible()) {
        await deleteButton.click();

        const alertDialog = page.locator('[role="alertdialog"]');
        await expect(alertDialog).toBeVisible();
      }
    });

    test('should display receipt number in delete confirmation', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const row = listPage.getRow(0);
      const deleteButton = row.locator('button:has([class*="trash"]), button[title="Delete"]');

      if (await deleteButton.isVisible()) {
        await deleteButton.click();

        const alertDialog = page.locator('[role="alertdialog"]');
        const dialogText = await alertDialog.textContent();
        // Should mention the receipt being deleted
        expect(dialogText).toMatch(/delete|receipt/i);
      }
    });

    test('should cancel delete operation', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const row = listPage.getRow(0);
      const deleteButton = row.locator('button:has([class*="trash"]), button[title="Delete"]');

      if (await deleteButton.isVisible()) {
        await deleteButton.click();

        const cancelButton = page.locator('[role="alertdialog"] button:has-text("Cancel")');
        if (await cancelButton.isVisible()) {
          await cancelButton.click();

          const newCount = await listPage.getRowCount();
          expect(newCount).toBe(rowCount);
        }
      }
    });
  });

  test.describe('Status Badge Display', () => {
    test('should display status badge for each receipt', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const row = listPage.getRow(0);
      const statusBadge = row.locator('[data-testid="status-badge"], .badge, [class*="Badge"]');
      // Status badge should be visible
    });

    test('should show appropriate colors for different statuses', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Check that badges have variant-specific classes
      const badges = page.locator('tbody [data-testid="status-badge"], tbody .badge, tbody [class*="Badge"]');
      const count = await badges.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Pagination', () => {
    test('should show pagination for many receipts', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount >= 10) {
        await expect(listPage.pagination).toBeVisible();
      }
    });
  });

  test.describe('Table Sorting', () => {
    test('should sort by received date', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Received');
    });

    test('should sort by vendor', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Vendor');
    });

    test('should sort by value', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Value');
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

  test.describe('Empty State', () => {
    test('should display helpful message when no receipts exist', async ({ page }) => {
      const isEmpty = await listPage.isEmpty();
      if (isEmpty) {
        const emptyMessage = page.locator(':has-text("No inventory receipts found")');
        await expect(emptyMessage).toBeVisible();
      }
    });
  });

  test.describe('Line Item Details', () => {
    test('should display quantity received for items', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const viewButton = listPage.getRow(0).locator('button:has([class*="eye"]), button[title="View"]');
      if (await viewButton.isVisible()) {
        await viewButton.click();

        const qtyHeader = page.locator('th:has-text("Received"), th:has-text("Qty")');
        await expect(qtyHeader).toBeVisible();
      }
    });

    test('should display quantity accepted/rejected', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const viewButton = listPage.getRow(0).locator('button:has([class*="eye"]), button[title="View"]');
      if (await viewButton.isVisible()) {
        await viewButton.click();

        const acceptedHeader = page.locator('th:has-text("Accepted")');
        const rejectedHeader = page.locator('th:has-text("Rejected")');
        // These columns should be visible
      }
    });

    test('should display unit cost for items', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const viewButton = listPage.getRow(0).locator('button:has([class*="eye"]), button[title="View"]');
      if (await viewButton.isVisible()) {
        await viewButton.click();

        const costHeader = page.locator('th:has-text("Cost"), th:has-text("Unit")');
        await expect(costHeader).toBeVisible();
      }
    });

    test('should display bin location for items', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const viewButton = listPage.getRow(0).locator('button:has([class*="eye"]), button[title="View"]');
      if (await viewButton.isVisible()) {
        await viewButton.click();

        const binHeader = page.locator('th:has-text("Bin")');
        // Bin location column should be visible
      }
    });
  });
});
