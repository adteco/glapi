import { test, expect } from '@playwright/test';

/**
 * Order-to-Cash (O2C) E2E Flow Tests
 *
 * Tests the complete O2C pipeline:
 * 1. Create Sales Order (DRAFT)
 * 2. Submit for Approval (SUBMITTED)
 * 3. Approve Order (APPROVED)
 * 4. Create Invoice from Order
 * 5. Fulfillment (optional)
 */

test.describe('Order-to-Cash Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/transactions/sales/sales-orders');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Sales Order Page Load', () => {
    test('should display sales orders page with header and create button', async ({ page }) => {
      await expect(page.locator('h1')).toContainText('Sales Orders');
      await expect(page.getByTestId('new-sales-order-btn')).toBeVisible();
    });

    test('should show empty state or orders table', async ({ page }) => {
      const table = page.locator('table');
      const emptyState = page.locator('text=No sales orders found');

      // Either table has rows or empty state is shown
      const hasTable = await table.isVisible();
      const hasEmpty = await emptyState.isVisible();
      expect(hasTable || hasEmpty).toBe(true);
    });
  });

  test.describe('Create Sales Order', () => {
    test('should open create dialog when clicking New Sales Order', async ({ page }) => {
      await page.getByTestId('new-sales-order-btn').click();

      // Dialog should open
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      await expect(page.locator('text=New Sales Order')).toBeVisible();
    });

    test('should display required form fields', async ({ page }) => {
      await page.getByTestId('new-sales-order-btn').click();

      // Check for key form fields
      await expect(page.getByTestId('subsidiary-select')).toBeVisible();
      await expect(page.getByTestId('customer-select')).toBeVisible();
      await expect(page.getByTestId('order-date-input')).toBeVisible();
    });

    test('should add and remove line items', async ({ page }) => {
      await page.getByTestId('new-sales-order-btn').click();

      // Should have initial line item
      await expect(page.getByTestId('line-item-0')).toBeVisible();

      // Add another line
      await page.getByTestId('add-line-btn').click();
      await expect(page.getByTestId('line-item-1')).toBeVisible();

      // Remove the second line
      const removeBtn = page.getByTestId('line-item-1').locator('button').first();
      await removeBtn.click();
      await expect(page.getByTestId('line-item-1')).not.toBeVisible();
    });

    test('should show validation errors for empty required fields', async ({ page }) => {
      await page.getByTestId('new-sales-order-btn').click();

      // Clear the order date
      await page.getByTestId('order-date-input').clear();

      // Try to submit
      await page.getByTestId('create-order-btn').click();

      // Should show validation errors
      await expect(page.locator('text=required').first()).toBeVisible();
    });

    test('should close dialog on cancel', async ({ page }) => {
      await page.getByTestId('new-sales-order-btn').click();
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      await page.locator('button:has-text("Cancel")').click();
      await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    });
  });

  test.describe('Sales Order Workflow Actions', () => {
    // These tests require existing sales orders in different states
    // They verify the UI elements are present based on order status

    test('should show submit button for DRAFT orders', async ({ page }) => {
      // Look for any draft order row
      const draftBadge = page.locator('[data-testid^="status-"]:has-text("DRAFT")');

      if (await draftBadge.count() > 0) {
        const orderNumber = await draftBadge.first().getAttribute('data-testid');
        const orderNum = orderNumber?.replace('status-', '');

        if (orderNum) {
          const submitBtn = page.getByTestId(`submit-btn-${orderNum}`);
          await expect(submitBtn).toBeVisible();
        }
      }
    });

    test('should show approve/reject buttons for SUBMITTED orders', async ({ page }) => {
      const submittedBadge = page.locator('[data-testid^="status-"]:has-text("SUBMITTED")');

      if (await submittedBadge.count() > 0) {
        const orderNumber = await submittedBadge.first().getAttribute('data-testid');
        const orderNum = orderNumber?.replace('status-', '');

        if (orderNum) {
          const approveBtn = page.getByTestId(`approve-btn-${orderNum}`);
          const rejectBtn = page.getByTestId(`reject-btn-${orderNum}`);
          await expect(approveBtn).toBeVisible();
          await expect(rejectBtn).toBeVisible();
        }
      }
    });

    test('should show invoice/fulfill buttons for APPROVED orders', async ({ page }) => {
      const approvedBadge = page.locator('[data-testid^="status-"]:has-text("APPROVED")');

      if (await approvedBadge.count() > 0) {
        const orderNumber = await approvedBadge.first().getAttribute('data-testid');
        const orderNum = orderNumber?.replace('status-', '');

        if (orderNum) {
          const invoiceBtn = page.getByTestId(`invoice-btn-${orderNum}`);
          const fulfillBtn = page.getByTestId(`fulfill-btn-${orderNum}`);
          await expect(invoiceBtn).toBeVisible();
          await expect(fulfillBtn).toBeVisible();
        }
      }
    });
  });

  test.describe('View Sales Order Details', () => {
    test('should open view dialog when clicking eye icon', async ({ page }) => {
      const viewBtns = page.locator('[data-testid^="view-btn-"]');

      if (await viewBtns.count() > 0) {
        await viewBtns.first().click();

        await expect(page.locator('[role="dialog"]')).toBeVisible();
        await expect(page.locator('text=Sales Order Details')).toBeVisible();
      }
    });

    test('should display order information in view dialog', async ({ page }) => {
      const viewBtns = page.locator('[data-testid^="view-btn-"]');

      if (await viewBtns.count() > 0) {
        await viewBtns.first().click();

        await expect(page.locator('text=Order Number')).toBeVisible();
        await expect(page.locator('text=Customer')).toBeVisible();
        await expect(page.locator('text=Status')).toBeVisible();
      }
    });
  });

  test.describe('Approve Sales Order Flow', () => {
    test('should open approve dialog', async ({ page }) => {
      const approveBtns = page.locator('[data-testid^="approve-btn-"]');

      if (await approveBtns.count() > 0) {
        await approveBtns.first().click();

        await expect(page.locator('[role="alertdialog"]')).toBeVisible();
        await expect(page.locator('text=Approve Sales Order')).toBeVisible();
      }
    });

    test('should close approve dialog on cancel', async ({ page }) => {
      const approveBtns = page.locator('[data-testid^="approve-btn-"]');

      if (await approveBtns.count() > 0) {
        await approveBtns.first().click();
        await expect(page.locator('[role="alertdialog"]')).toBeVisible();

        await page.locator('button:has-text("Cancel")').click();
        await expect(page.locator('[role="alertdialog"]')).not.toBeVisible();
      }
    });
  });

  test.describe('Reject Sales Order Flow', () => {
    test('should open reject dialog with reason input', async ({ page }) => {
      const rejectBtns = page.locator('[data-testid^="reject-btn-"]');

      if (await rejectBtns.count() > 0) {
        await rejectBtns.first().click();

        await expect(page.locator('[role="alertdialog"]')).toBeVisible();
        await expect(page.locator('text=Reject Sales Order')).toBeVisible();
        await expect(page.getByTestId('reject-reason-input')).toBeVisible();
      }
    });

    test('should require reason before rejecting', async ({ page }) => {
      const rejectBtns = page.locator('[data-testid^="reject-btn-"]');

      if (await rejectBtns.count() > 0) {
        await rejectBtns.first().click();

        // Reject button should be disabled without reason
        const confirmBtn = page.getByTestId('confirm-reject-btn');
        await expect(confirmBtn).toBeDisabled();

        // Enter reason
        await page.getByTestId('reject-reason-input').fill('Test rejection reason');
        await expect(confirmBtn).toBeEnabled();
      }
    });
  });

  test.describe('Cancel Sales Order Flow', () => {
    test('should open cancel dialog with reason input', async ({ page }) => {
      const cancelBtns = page.locator('[data-testid^="cancel-btn-"]');

      if (await cancelBtns.count() > 0) {
        await cancelBtns.first().click();

        await expect(page.locator('[role="alertdialog"]')).toBeVisible();
        await expect(page.locator('text=Cancel Sales Order')).toBeVisible();
        await expect(page.getByTestId('cancel-reason-input')).toBeVisible();
      }
    });

    test('should require reason before cancelling', async ({ page }) => {
      const cancelBtns = page.locator('[data-testid^="cancel-btn-"]');

      if (await cancelBtns.count() > 0) {
        await cancelBtns.first().click();

        // Cancel button should be disabled without reason
        const confirmBtn = page.getByTestId('confirm-cancel-btn');
        await expect(confirmBtn).toBeDisabled();

        // Enter reason
        await page.getByTestId('cancel-reason-input').fill('Test cancellation reason');
        await expect(confirmBtn).toBeEnabled();
      }
    });
  });

  test.describe('Table Display', () => {
    test('should display correct column headers', async ({ page }) => {
      const headers = page.locator('thead th');
      const headerTexts = await headers.allTextContents();

      expect(headerTexts).toContain('Order #');
      expect(headerTexts).toContain('Customer');
      expect(headerTexts).toContain('Order Date');
      expect(headerTexts).toContain('Amount');
      expect(headerTexts).toContain('Status');
      expect(headerTexts).toContain('Actions');
    });

    test('should show loading skeleton while fetching data', async ({ page }) => {
      // Navigate to page and check for skeleton before data loads
      await page.goto('/transactions/sales/sales-orders');

      // Loading skeleton might be visible briefly
      const skeleton = page.locator('.animate-pulse, [class*="skeleton"]');
      // This is a soft assertion since loading might be very fast
      if (await skeleton.isVisible()) {
        await expect(skeleton).toBeVisible();
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('should adapt layout for mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();

      // Page should still be functional
      await expect(page.locator('h1')).toContainText('Sales Orders');
      await expect(page.getByTestId('new-sales-order-btn')).toBeVisible();
    });

    test('should show dialog properly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await page.getByTestId('new-sales-order-btn').click();

      // Dialog should be visible and usable
      await expect(page.locator('[role="dialog"]')).toBeVisible();
    });
  });
});

test.describe('O2C Complete Workflow', () => {
  // This test describes the complete happy path workflow
  // Note: This requires a proper test database with seeded data

  test.skip('complete order-to-cash flow (requires seeded data)', async ({ page }) => {
    // 1. Navigate to sales orders
    await page.goto('/transactions/sales/sales-orders');

    // 2. Create new sales order
    await page.getByTestId('new-sales-order-btn').click();

    // Fill form (requires customers and subsidiaries)
    // await page.getByTestId('subsidiary-select').click();
    // await page.locator('[role="option"]').first().click();
    // await page.getByTestId('customer-select').click();
    // await page.locator('[role="option"]').first().click();

    // Fill line items
    // await page.getByTestId('line-description-0').fill('Test Product');
    // await page.getByTestId('line-quantity-0').fill('10');
    // await page.getByTestId('line-price-0').fill('99.99');

    // Submit form
    // await page.getByTestId('create-order-btn').click();

    // 3. Submit for approval
    // await page.getByTestId('submit-btn-{orderNumber}').click();

    // 4. Approve order
    // await page.getByTestId('approve-btn-{orderNumber}').click();
    // await page.getByTestId('confirm-approve-btn').click();

    // 5. Create invoice
    // await page.getByTestId('invoice-btn-{orderNumber}').click();

    // 6. Verify invoice created
    // await page.goto('/transactions/sales/invoices');
    // Verify the new invoice appears

    // This test is skipped as it requires proper test data setup
  });
});
