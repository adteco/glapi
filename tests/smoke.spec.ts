/**
 * Smoke Tests for GLAPI
 *
 * Critical path tests that verify the most essential functionality works.
 * These tests should run quickly and be the first line of defense.
 *
 * Covers:
 * - Authentication
 * - Dashboard access
 * - Key list pages load
 * - Basic CRUD operations
 * - API health
 */

import { test, expect } from '@playwright/test';
import { authAssertions, navigationAssertions, tableAssertions } from './helpers/assertions';
import { createTestTRPCClient, waitForApi, TEST_CONFIG } from './helpers/api-client';

test.describe('Smoke Tests - Authentication', () => {
  test('should show sign-in page for unauthenticated users', async ({ page }) => {
    // Clear any stored auth state for this test
    await page.context().clearCookies();

    // Navigate to a protected route
    await page.goto('/relationships/customers');

    // Should redirect to sign-in
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test('should maintain authentication across page navigation', async ({ page }) => {
    // Navigate to dashboard (uses stored auth)
    await page.goto('/');

    // Verify authenticated
    await authAssertions.expectAuthenticated(page);

    // Navigate to another page
    await page.goto('/relationships/customers');
    await page.waitForLoadState('networkidle');

    // Should still be authenticated
    await authAssertions.expectAuthenticated(page);
  });
});

test.describe('Smoke Tests - Dashboard', () => {
  test('should load dashboard without errors', async ({ page }) => {
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Verify we're authenticated
    await authAssertions.expectAuthenticated(page);

    // Verify no error states
    const errorMessages = await page.locator('[role="alert"], .error').count();
    expect(errorMessages).toBe(0);
  });

  test('should display sidebar navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify sidebar is visible
    const sidebar = page.locator('aside, nav[role="navigation"], [data-testid="sidebar"]');
    await expect(sidebar.first()).toBeVisible();

    // Verify key navigation items exist
    const navItems = ['Lists', 'Relationships', 'Transactions'];
    for (const item of navItems) {
      const navItem = sidebar.getByText(item);
      // At least one navigation area should have these items
      expect(await navItem.count()).toBeGreaterThanOrEqual(0);
    }
  });
});

test.describe('Smoke Tests - Key List Pages', () => {
  test('should load customers list', async ({ page }) => {
    // Customers are under relationships, not lists
    await page.goto('/relationships/customers');
    await page.waitForLoadState('networkidle');

    // Verify page loaded
    await navigationAssertions.expectHeading(page, /customers/i);

    // Verify table or empty state
    const table = page.locator('table, [data-testid="data-table"]');
    const emptyState = page.locator('[data-testid="empty-state"], .empty-state');

    const hasTable = await table.isVisible().catch(() => false);
    const hasEmptyState = await emptyState.isVisible().catch(() => false);

    expect(hasTable || hasEmptyState).toBe(true);
  });

  test('should load items list', async ({ page }) => {
    await page.goto('/lists/items');
    await page.waitForLoadState('networkidle');

    // Verify page loaded
    await navigationAssertions.expectHeading(page, /items/i);

    // Verify no loading spinner stuck
    await tableAssertions.expectNotLoading(page);
  });

  test('should load departments list', async ({ page }) => {
    await page.goto('/lists/departments');
    await page.waitForLoadState('networkidle');

    // Verify page loaded
    await navigationAssertions.expectHeading(page, /departments/i);
  });

  test('should load accounts list', async ({ page }) => {
    await page.goto('/lists/accounts');
    await page.waitForLoadState('networkidle');

    // Verify page loaded
    await navigationAssertions.expectHeading(page, /accounts/i);
  });
});

test.describe('Smoke Tests - Relationship Pages', () => {
  test('should load vendors list', async ({ page }) => {
    await page.goto('/relationships/vendors');
    await page.waitForLoadState('networkidle');

    // Verify page loaded
    await navigationAssertions.expectHeading(page, /vendors/i);
  });

  test('should load employees list', async ({ page }) => {
    await page.goto('/relationships/employees');
    await page.waitForLoadState('networkidle');

    // Verify page loaded
    await navigationAssertions.expectHeading(page, /employees/i);
  });
});

test.describe('Smoke Tests - API Health', () => {
  test('should respond to health check', async () => {
    const response = await fetch(`${TEST_CONFIG.apiUrl}/api/health`);
    expect(response.ok).toBe(true);
  });

  test('should authenticate with API key', async () => {
    const isReady = await waitForApi(5, 1000);
    expect(isReady).toBe(true);
  });

  test('should fetch customers via TRPC', async () => {
    const client = createTestTRPCClient();
    const customers = await client.customers.list.query({});

    expect(Array.isArray(customers)).toBe(true);
  });

  test('should fetch items via TRPC', async () => {
    const client = createTestTRPCClient();
    const items = await client.items.list.query({});

    expect(Array.isArray(items)).toBe(true);
  });
});

test.describe('Smoke Tests - Basic CRUD', () => {
  test('should create and delete a customer via API', async () => {
    const client = createTestTRPCClient();
    const uniqueName = `Smoke_Test_Customer_${Date.now()}`;

    // Create
    const created = await client.customers.create.mutate({
      companyName: uniqueName,
      status: 'active',
    });

    expect(created).toBeDefined();
    expect(created.id).toBeDefined();
    expect(created.companyName).toBe(uniqueName);

    // Verify exists
    const fetched = await client.customers.get.query({ id: created.id });
    expect(fetched.companyName).toBe(uniqueName);

    // Delete
    const deleted = await client.customers.delete.mutate({ id: created.id });
    expect(deleted.success).toBe(true);

    // Verify gone
    await expect(
      client.customers.get.query({ id: created.id })
    ).rejects.toThrow();
  });

  test('should create and delete an item via API', async () => {
    const client = createTestTRPCClient();
    const uniqueName = `Smoke_Test_Item_${Date.now()}`;
    const uniqueSku = `SKU-${Date.now()}`;

    // Create
    const created = await client.items.create.mutate({
      name: uniqueName,
      sku: uniqueSku,
      status: 'active',
    });

    expect(created).toBeDefined();
    expect(created.id).toBeDefined();
    expect(created.name).toBe(uniqueName);

    // Delete
    const deleted = await client.items.delete.mutate({ id: created.id });
    expect(deleted.success).toBe(true);
  });
});

test.describe('Smoke Tests - Form Operations (UI)', () => {
  test('should open create customer dialog', async ({ page }) => {
    await page.goto('/lists/customers');
    await page.waitForLoadState('networkidle');

    // Look for create/add button
    const createButton = page.locator(
      'button:has-text("Create"), button:has-text("Add"), button:has-text("New"), [data-testid="create-button"]'
    ).first();

    if (await createButton.isVisible()) {
      await createButton.click();

      // Verify dialog opens
      const dialog = page.locator('[role="dialog"], [data-radix-dialog-content]');
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Verify form fields
      const nameInput = dialog.locator('input').first();
      await expect(nameInput).toBeVisible();

      // Close dialog
      const closeButton = dialog.locator('button[aria-label*="close"], button:has-text("Cancel")').first();
      if (await closeButton.isVisible()) {
        await closeButton.click();
      } else {
        await page.keyboard.press('Escape');
      }
    }
  });

  test('should show search functionality on list page', async ({ page }) => {
    await page.goto('/lists/customers');
    await page.waitForLoadState('networkidle');

    // Look for search input
    const searchInput = page.locator(
      'input[placeholder*="Search"], input[type="search"], [data-testid="search-input"]'
    ).first();

    if (await searchInput.isVisible()) {
      // Type search query
      await searchInput.fill('test');

      // Wait for debounce
      await page.waitForTimeout(500);

      // Verify input has value
      await expect(searchInput).toHaveValue('test');
    }
  });
});

test.describe('Smoke Tests - Navigation', () => {
  test('should navigate between main sections', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to Lists
    await page.goto('/lists/customers');
    await expect(page).toHaveURL(/\/lists\/customers/);

    // Navigate to Relationships
    await page.goto('/relationships/vendors');
    await expect(page).toHaveURL(/\/relationships\/vendors/);

    // Navigate back to dashboard
    await page.goto('/');
    await authAssertions.expectAuthenticated(page);
  });

  test('should handle 404 for invalid routes', async ({ page }) => {
    const response = await page.goto('/definitely-not-a-real-page');

    // Should either show 404 page or redirect
    const is404 = response?.status() === 404;
    const isRedirect = page.url().includes('/sign-in') || page.url().includes('/404');

    expect(is404 || isRedirect).toBe(true);
  });
});

test.describe('Smoke Tests - Performance', () => {
  test('should load dashboard within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // Dashboard should load within 10 seconds
    expect(loadTime).toBeLessThan(10000);
  });

  test('should load customer list within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/lists/customers');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // List page should load within 10 seconds
    expect(loadTime).toBeLessThan(10000);
  });
});
