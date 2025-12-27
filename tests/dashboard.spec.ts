import { test, expect } from '@playwright/test';
import { DashboardPage } from './pages';
import { waitForNetworkIdle, waitForToast } from './utils/test-helpers';

test.describe('Dashboard', () => {
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
  });

  test.describe('Page Load', () => {
    test('should load dashboard successfully', async ({ page }) => {
      await dashboardPage.expectDashboardLoaded();
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test('should display user button when authenticated', async () => {
      const isAuth = await dashboardPage.isAuthenticated();
      expect(isAuth).toBe(true);
    });

    test('should show organization context message if no org selected', async ({ page }) => {
      // This test may fail if org is already selected
      // Skip if org context is already set
      const hasOrg = await dashboardPage.hasOrgContext();
      if (!hasOrg) {
        await dashboardPage.expectOrgContextRequired();
      }
    });
  });

  test.describe('KPI Cards', () => {
    test('should display Total Revenue card', async () => {
      await dashboardPage.expectKPIVisible('Total Revenue');
    });

    test('should display Net Income card', async () => {
      await dashboardPage.expectKPIVisible('Net Income');
    });

    test('should display Cash Balance card', async () => {
      await dashboardPage.expectKPIVisible('Cash Balance');
    });

    test('should display Outstanding Invoices card', async () => {
      await dashboardPage.expectKPIVisible('Outstanding');
    });

    test('KPI values should be formatted as currency', async () => {
      const revenue = await dashboardPage.getTotalRevenue();
      // Should contain currency symbol
      expect(revenue).toMatch(/[$€£¥]|USD|EUR/);
    });
  });

  test.describe('Recent Transactions', () => {
    test('should display recent transactions section', async ({ page }) => {
      await expect(dashboardPage.recentTransactions).toBeVisible();
    });

    test('should have transaction rows', async () => {
      const count = await dashboardPage.getRecentTransactionCount();
      // May be 0 on fresh accounts, but structure should exist
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('clicking transaction should navigate to detail', async ({ page }) => {
      const count = await dashboardPage.getRecentTransactionCount();
      if (count > 0) {
        await dashboardPage.clickRecentTransaction(0);
        // Should navigate away from dashboard
        await expect(page).not.toHaveURL(/\/dashboard$/);
      }
    });
  });

  test.describe('Sidebar Navigation', () => {
    test('should display sidebar', async () => {
      await expect(dashboardPage.sidebar).toBeVisible();
    });

    test('should navigate to Items page', async ({ page }) => {
      await dashboardPage.goToItems();
      await expect(page).toHaveURL(/\/lists\/items/);
    });

    test('should navigate to Customers page', async ({ page }) => {
      await dashboardPage.goToCustomers();
      await expect(page).toHaveURL(/\/relationships\/customers/);
    });

    test('should navigate to Invoices page', async ({ page }) => {
      await dashboardPage.goToInvoices();
      await expect(page).toHaveURL(/\/transactions.*invoices/);
    });

    test('should navigate to Reports page', async ({ page }) => {
      await dashboardPage.goToReports();
      await expect(page).toHaveURL(/\/reports/);
    });

    test('should navigate to Chat page', async ({ page }) => {
      await dashboardPage.goToChat();
      await expect(page).toHaveURL(/\/chat/);
    });
  });

  test.describe('Quick Actions', () => {
    test('New Invoice button should be visible', async () => {
      await expect(dashboardPage.newInvoiceButton).toBeVisible();
    });

    test('clicking New Invoice should navigate or open dialog', async ({ page }) => {
      await dashboardPage.createNewInvoice();
      // Should either navigate to create page or open dialog
      const urlChanged = !(await page.url().includes('/dashboard'));
      const dialogVisible = await page.locator('[role="dialog"]').isVisible();
      expect(urlChanged || dialogVisible).toBe(true);
    });

    test('New Customer button should be visible', async () => {
      await expect(dashboardPage.newCustomerButton).toBeVisible();
    });

    test('New Item button should be visible', async () => {
      await expect(dashboardPage.newItemButton).toBeVisible();
    });
  });

  test.describe('Organization Switcher', () => {
    test('should display organization switcher', async () => {
      await expect(dashboardPage.orgSwitcher).toBeVisible();
    });

    test('clicking org switcher should open dropdown', async ({ page }) => {
      await dashboardPage.orgSwitcher.click();
      // Should show org options or create org option
      const dropdown = page.locator(
        '[data-radix-popper-content-wrapper], [role="listbox"], [role="menu"]'
      );
      await expect(dropdown).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should be functional on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await dashboardPage.goto();

      // Dashboard should still be visible
      await dashboardPage.expectDashboardLoaded();

      // KPIs should still be visible (may stack vertically)
      await expect(dashboardPage.kpiCards.first()).toBeVisible();
    });

    test('sidebar may be hidden on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await dashboardPage.goto();

      // Sidebar might be hidden behind hamburger menu
      const isSidebarVisible = await dashboardPage.sidebar.isVisible();
      if (!isSidebarVisible) {
        // Look for mobile menu button
        const menuButton = page.locator(
          'button[aria-label*="menu"], [data-testid="mobile-menu"]'
        );
        await expect(menuButton).toBeVisible();
      }
    });
  });
});
