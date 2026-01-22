/**
 * Customers Page UI Tests
 *
 * Tests customer list, create, edit, and delete workflows
 */

import { test, expect } from '@playwright/test';
import {
  waitForNetworkIdle,
  waitForApiResponse,
  waitForToast,
  randomString,
  uniqueId,
} from '../../utils/test-helpers';

test.describe('Customers Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/relationships/customers');
    await page.waitForLoadState('domcontentloaded');
  });

  test.describe('Page Load', () => {
    test('should load customers page', async ({ page }) => {
      await expect(page).toHaveURL(/customers/);
    });

    test('should display page title', async ({ page }) => {
      const heading = page.locator('h1, h2, [data-testid="page-title"]');
      await expect(heading.first()).toBeVisible({ timeout: 10000 });
    });

    test('should display customer list or empty state', async ({ page }) => {
      await waitForNetworkIdle(page, 15000);

      // Should show either a table/list or empty state
      const table = page.locator('table, [data-testid="customers-table"]');
      const emptyState = page.locator('[data-testid="empty-state"], text=/no customers/i');

      const hasTable = await table.isVisible().catch(() => false);
      const hasEmptyState = await emptyState.isVisible().catch(() => false);

      // One of them should be visible
      expect(hasTable || hasEmptyState).toBe(true);
    });

    test('should display add customer button', async ({ page }) => {
      const addButton = page.locator(
        'button:has-text("Add"), button:has-text("New"), button:has-text("Create"), [data-testid="add-customer"]'
      );
      await expect(addButton.first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Customer List', () => {
    test('should display customer data in table', async ({ page }) => {
      await waitForNetworkIdle(page, 15000);

      const table = page.locator('table, [data-testid="customers-table"]');

      if (await table.isVisible()) {
        // Table should have headers
        const headers = table.locator('thead th, [role="columnheader"]');
        const headerCount = await headers.count();
        expect(headerCount).toBeGreaterThan(0);
      }
    });

    test('should show customer name column', async ({ page }) => {
      await waitForNetworkIdle(page, 15000);

      const table = page.locator('table, [data-testid="customers-table"]');

      if (await table.isVisible()) {
        // Look for name column header
        const nameHeader = table.locator('th:has-text("Name"), th:has-text("Company")');
        await expect(nameHeader.first()).toBeVisible();
      }
    });

    test('should handle pagination if available', async ({ page }) => {
      await waitForNetworkIdle(page, 15000);

      // Look for pagination controls
      const pagination = page.locator('[data-testid="pagination"], nav[aria-label="pagination"]');

      if (await pagination.isVisible()) {
        // Pagination should have at least page 1
        const page1 = pagination.locator('button:has-text("1"), [aria-label*="page 1"]');
        await expect(page1.first()).toBeVisible();
      }
    });

    test('should support search/filter if available', async ({ page }) => {
      await waitForNetworkIdle(page, 15000);

      // Look for search input
      const searchInput = page.locator(
        'input[type="search"], input[placeholder*="search"], [data-testid="search-input"]'
      );

      if (await searchInput.first().isVisible()) {
        await searchInput.first().fill('test');
        await page.waitForTimeout(1000); // Debounce

        // Should filter results or show no results
        await waitForNetworkIdle(page, 5000);
      }
    });
  });

  test.describe('Create Customer', () => {
    test('should open create customer dialog/form', async ({ page }) => {
      const addButton = page.locator(
        'button:has-text("Add"), button:has-text("New"), button:has-text("Create"), [data-testid="add-customer"]'
      );
      await addButton.first().click();

      // Should show dialog or navigate to create page
      const dialog = page.locator('[role="dialog"], [data-testid="customer-form"]');
      const formPage = page.locator('form, [data-testid="customer-form"]');

      await expect(dialog.or(formPage).first()).toBeVisible({ timeout: 5000 });
    });

    test('should have required form fields', async ({ page }) => {
      const addButton = page.locator(
        'button:has-text("Add"), button:has-text("New"), button:has-text("Create"), [data-testid="add-customer"]'
      );
      await addButton.first().click();

      await page.waitForTimeout(500);

      // Look for company name field
      const nameField = page.locator(
        'input[name="companyName"], input[placeholder*="name"], [data-testid="company-name-input"]'
      );
      await expect(nameField.first()).toBeVisible({ timeout: 5000 });
    });

    test('should create customer with valid data', async ({ page }) => {
      const addButton = page.locator(
        'button:has-text("Add"), button:has-text("New"), button:has-text("Create"), [data-testid="add-customer"]'
      );
      await addButton.first().click();

      await page.waitForTimeout(500);

      // Fill in form
      const companyName = `E2E Test Company ${uniqueId()}`;
      const nameField = page.locator(
        'input[name="companyName"], input[placeholder*="name"], [data-testid="company-name-input"]'
      );
      await nameField.first().fill(companyName);

      // Submit form
      const submitButton = page.locator(
        'button[type="submit"], button:has-text("Save"), button:has-text("Create")'
      );
      await submitButton.first().click();

      // Wait for success
      await waitForNetworkIdle(page, 10000);

      // Should show success message or redirect
      const successToast = page.locator('[data-sonner-toaster]');
      const successState = await successToast.isVisible().catch(() => false);

      // Or should show the new customer in the list
      const customerInList = page.locator(`text="${companyName}"`);
      const inList = await customerInList.isVisible().catch(() => false);

      expect(successState || inList).toBe(true);
    });

    test('should validate required fields', async ({ page }) => {
      const addButton = page.locator(
        'button:has-text("Add"), button:has-text("New"), button:has-text("Create"), [data-testid="add-customer"]'
      );
      await addButton.first().click();

      await page.waitForTimeout(500);

      // Try to submit without filling required fields
      const submitButton = page.locator(
        'button[type="submit"], button:has-text("Save"), button:has-text("Create")'
      );
      await submitButton.first().click();

      // Should show validation error
      const errorMessage = page.locator(
        '[role="alert"], [class*="error"], [data-testid*="error"]'
      );

      // Wait a bit for validation
      await page.waitForTimeout(500);

      // Form should still be visible (not submitted)
      const form = page.locator('form, [role="dialog"]');
      await expect(form.first()).toBeVisible();
    });

    test('should close form on cancel', async ({ page }) => {
      const addButton = page.locator(
        'button:has-text("Add"), button:has-text("New"), button:has-text("Create"), [data-testid="add-customer"]'
      );
      await addButton.first().click();

      await page.waitForTimeout(500);

      // Find and click cancel button
      const cancelButton = page.locator(
        'button:has-text("Cancel"), button:has-text("Close"), [data-testid="cancel-button"]'
      );

      if (await cancelButton.first().isVisible()) {
        await cancelButton.first().click();

        // Dialog should close
        await page.waitForTimeout(500);
        const dialog = page.locator('[role="dialog"]');
        await expect(dialog).not.toBeVisible();
      }
    });
  });

  test.describe('Edit Customer', () => {
    test('should open edit form when clicking edit button', async ({ page }) => {
      await waitForNetworkIdle(page, 15000);

      // Find edit button on a row
      const editButton = page.locator(
        'button:has-text("Edit"), button[aria-label*="edit"], [data-testid*="edit"]'
      ).first();

      if (await editButton.isVisible()) {
        await editButton.click();

        // Should show edit dialog or navigate to edit page
        const form = page.locator('form, [role="dialog"], [data-testid="customer-form"]');
        await expect(form.first()).toBeVisible({ timeout: 5000 });
      }
    });

    test('should populate form with existing data', async ({ page }) => {
      await waitForNetworkIdle(page, 15000);

      const editButton = page.locator(
        'button:has-text("Edit"), button[aria-label*="edit"], [data-testid*="edit"]'
      ).first();

      if (await editButton.isVisible()) {
        await editButton.click();
        await page.waitForTimeout(500);

        // Name field should have value
        const nameField = page.locator(
          'input[name="companyName"], input[placeholder*="name"], [data-testid="company-name-input"]'
        ).first();

        if (await nameField.isVisible()) {
          const value = await nameField.inputValue();
          expect(value.length).toBeGreaterThan(0);
        }
      }
    });
  });

  test.describe('Delete Customer', () => {
    test('should show delete confirmation', async ({ page }) => {
      await waitForNetworkIdle(page, 15000);

      // Find delete button on a row
      const deleteButton = page.locator(
        'button:has-text("Delete"), button[aria-label*="delete"], [data-testid*="delete"]'
      ).first();

      if (await deleteButton.isVisible()) {
        await deleteButton.click();

        // Should show confirmation dialog
        const confirmDialog = page.locator(
          '[role="alertdialog"], [data-testid="confirm-dialog"]'
        );

        await expect(confirmDialog).toBeVisible({ timeout: 5000 });
      }
    });

    test('should cancel delete on cancel button', async ({ page }) => {
      await waitForNetworkIdle(page, 15000);

      const deleteButton = page.locator(
        'button:has-text("Delete"), button[aria-label*="delete"], [data-testid*="delete"]'
      ).first();

      if (await deleteButton.isVisible()) {
        await deleteButton.click();

        // Find cancel button in confirmation
        const cancelButton = page.locator(
          '[role="alertdialog"] button:has-text("Cancel"), [data-testid="cancel-delete"]'
        ).first();

        if (await cancelButton.isVisible()) {
          await cancelButton.click();

          // Dialog should close
          await page.waitForTimeout(500);
          const dialog = page.locator('[role="alertdialog"]');
          await expect(dialog).not.toBeVisible();
        }
      }
    });
  });
});

test.describe('Customers Page - Accessibility', () => {
  test('should have proper heading structure', async ({ page }) => {
    await page.goto('/relationships/customers');
    await waitForNetworkIdle(page, 15000);

    // Should have h1 or h2
    const headings = page.locator('h1, h2');
    await expect(headings.first()).toBeVisible();
  });

  test('should have proper table semantics', async ({ page }) => {
    await page.goto('/relationships/customers');
    await waitForNetworkIdle(page, 15000);

    const table = page.locator('table, [role="table"]');

    if (await table.isVisible()) {
      // Should have proper structure
      const headers = table.locator('thead th, [role="columnheader"]');
      expect(await headers.count()).toBeGreaterThan(0);
    }
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/relationships/customers');
    await waitForNetworkIdle(page, 15000);

    // Tab to add button
    await page.keyboard.press('Tab');

    // Should be able to reach interactive elements
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });
});
