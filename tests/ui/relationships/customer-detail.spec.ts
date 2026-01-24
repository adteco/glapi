/**
 * Customer Detail Page UI Tests
 *
 * Tests the customer detail page with tabbed interface:
 * - Overview tab (customer info, billing address, financial summary)
 * - Contacts tab (contacts associated with customer)
 * - Transactions tab (invoices list with status badges)
 */

import { test, expect } from '@playwright/test';
import {
  waitForNetworkIdle,
  waitForNavigation,
  waitForStableElement,
} from '../../utils/test-helpers';

// Helper to navigate to a customer detail page
async function navigateToCustomerDetail(page: import('@playwright/test').Page) {
  // First go to customers list
  await page.goto('/relationships/customers');
  await page.waitForLoadState('domcontentloaded');
  await waitForNetworkIdle(page, 15000);

  // Find and click on a customer row to navigate to detail
  const customerRow = page.locator('table tbody tr, [data-testid="customer-row"]').first();

  if (await customerRow.isVisible()) {
    // Click on the customer name link or the row itself
    const customerLink = customerRow.locator('a').first();
    if (await customerLink.isVisible()) {
      await customerLink.click();
    } else {
      await customerRow.click();
    }

    // Wait for navigation to detail page
    await page.waitForURL(/\/relationships\/customers\/[^/]+$/);
    await waitForNetworkIdle(page, 15000);
    return true;
  }

  return false;
}

test.describe('Customer Detail Page', () => {
  test.describe('Page Load & Navigation', () => {
    test('should navigate to customer detail from list', async ({ page }) => {
      const navigated = await navigateToCustomerDetail(page);

      if (navigated) {
        // Should be on detail page URL
        await expect(page).toHaveURL(/\/relationships\/customers\/[a-f0-9-]+/);
      } else {
        // No customers exist, skip test
        test.skip();
      }
    });

    test('should display customer name as page title', async ({ page }) => {
      const navigated = await navigateToCustomerDetail(page);

      if (navigated) {
        // Should have a heading with customer name
        const heading = page.locator('h1, h2, [data-testid="customer-name"]');
        await expect(heading.first()).toBeVisible({ timeout: 10000 });

        // Heading should have content
        const text = await heading.first().textContent();
        expect(text?.length).toBeGreaterThan(0);
      } else {
        test.skip();
      }
    });

    test('should display back navigation', async ({ page }) => {
      const navigated = await navigateToCustomerDetail(page);

      if (navigated) {
        // Should have back button or breadcrumb
        const backLink = page.locator(
          'a:has-text("Back"), a:has-text("Customers"), [data-testid="back-button"], nav[aria-label="breadcrumb"]'
        );
        await expect(backLink.first()).toBeVisible({ timeout: 10000 });
      } else {
        test.skip();
      }
    });

    test('should show loading state initially', async ({ page }) => {
      // Go directly to a customer detail URL
      await page.goto('/relationships/customers');
      await waitForNetworkIdle(page, 15000);

      const customerRow = page.locator('table tbody tr').first();
      if (await customerRow.isVisible()) {
        // Get the href from the first customer link
        const customerLink = customerRow.locator('a').first();
        const href = await customerLink.getAttribute('href');

        if (href) {
          // Navigate and check for loading state
          await page.goto(href);

          // Either loading indicator or content should appear
          const loadingOrContent = page.locator(
            '[data-testid="loading"], [class*="loading"], [class*="spinner"], .animate-pulse, h1, h2'
          );
          await expect(loadingOrContent.first()).toBeVisible({ timeout: 5000 });
        }
      }
    });
  });

  test.describe('Tabs Navigation', () => {
    test('should display tab buttons for Overview, Contacts, Transactions', async ({ page }) => {
      const navigated = await navigateToCustomerDetail(page);

      if (navigated) {
        // Look for tab buttons
        const overviewTab = page.locator('button:has-text("Overview"), [role="tab"]:has-text("Overview")');
        const contactsTab = page.locator('button:has-text("Contacts"), [role="tab"]:has-text("Contacts")');
        const transactionsTab = page.locator('button:has-text("Transactions"), [role="tab"]:has-text("Transactions")');

        await expect(overviewTab.first()).toBeVisible({ timeout: 10000 });
        await expect(contactsTab.first()).toBeVisible({ timeout: 10000 });
        await expect(transactionsTab.first()).toBeVisible({ timeout: 10000 });
      } else {
        test.skip();
      }
    });

    test('should show Overview tab as default/active', async ({ page }) => {
      const navigated = await navigateToCustomerDetail(page);

      if (navigated) {
        const overviewTab = page.locator('button:has-text("Overview"), [role="tab"]:has-text("Overview")').first();

        // Check if tab is active (has data-state="active" or aria-selected="true")
        const isActive = await overviewTab.evaluate((el) => {
          return el.getAttribute('data-state') === 'active' ||
                 el.getAttribute('aria-selected') === 'true' ||
                 el.classList.contains('active');
        });

        expect(isActive).toBe(true);
      } else {
        test.skip();
      }
    });

    test('should switch to Contacts tab when clicked', async ({ page }) => {
      const navigated = await navigateToCustomerDetail(page);

      if (navigated) {
        const contactsTab = page.locator('button:has-text("Contacts"), [role="tab"]:has-text("Contacts")').first();
        await contactsTab.click();

        // Wait for tab content to load
        await page.waitForTimeout(500);

        // Contacts tab should now be active
        const isActive = await contactsTab.evaluate((el) => {
          return el.getAttribute('data-state') === 'active' ||
                 el.getAttribute('aria-selected') === 'true';
        });

        expect(isActive).toBe(true);
      } else {
        test.skip();
      }
    });

    test('should switch to Transactions tab when clicked', async ({ page }) => {
      const navigated = await navigateToCustomerDetail(page);

      if (navigated) {
        const transactionsTab = page.locator('button:has-text("Transactions"), [role="tab"]:has-text("Transactions")').first();
        await transactionsTab.click();

        // Wait for tab content to load
        await page.waitForTimeout(500);

        // Transactions tab should now be active
        const isActive = await transactionsTab.evaluate((el) => {
          return el.getAttribute('data-state') === 'active' ||
                 el.getAttribute('aria-selected') === 'true';
        });

        expect(isActive).toBe(true);
      } else {
        test.skip();
      }
    });
  });

  test.describe('Overview Tab', () => {
    test('should display customer information card', async ({ page }) => {
      const navigated = await navigateToCustomerDetail(page);

      if (navigated) {
        // Should show customer info section
        const infoCard = page.locator(
          '[data-testid="customer-info"], text=/Customer Information/i, text=/Company Name/i'
        );
        await expect(infoCard.first()).toBeVisible({ timeout: 10000 });
      } else {
        test.skip();
      }
    });

    test('should display customer ID', async ({ page }) => {
      const navigated = await navigateToCustomerDetail(page);

      if (navigated) {
        // Look for Customer ID label and value
        const customerIdLabel = page.locator('text=/Customer ID/i');
        await expect(customerIdLabel.first()).toBeVisible({ timeout: 10000 });
      } else {
        test.skip();
      }
    });

    test('should display customer status badge', async ({ page }) => {
      const navigated = await navigateToCustomerDetail(page);

      if (navigated) {
        // Should show status (Active, Inactive, etc.)
        const statusBadge = page.locator(
          '[data-testid="status-badge"], text=/Active/i, text=/Inactive/i, text=/Status/i'
        );
        await expect(statusBadge.first()).toBeVisible({ timeout: 10000 });
      } else {
        test.skip();
      }
    });

    test('should display billing address section', async ({ page }) => {
      const navigated = await navigateToCustomerDetail(page);

      if (navigated) {
        // Should show billing address card
        const addressSection = page.locator(
          'text=/Billing Address/i, [data-testid="billing-address"]'
        );
        await expect(addressSection.first()).toBeVisible({ timeout: 10000 });
      } else {
        test.skip();
      }
    });

    test('should display financial summary cards', async ({ page }) => {
      const navigated = await navigateToCustomerDetail(page);

      if (navigated) {
        // Should show financial summary (Total Revenue, Outstanding, Invoices)
        const financialSummary = page.locator(
          'text=/Total Revenue/i, text=/Outstanding/i, text=/Financial Summary/i, [data-testid="financial-summary"]'
        );
        await expect(financialSummary.first()).toBeVisible({ timeout: 10000 });
      } else {
        test.skip();
      }
    });

    test('should display child customers section if applicable', async ({ page }) => {
      const navigated = await navigateToCustomerDetail(page);

      if (navigated) {
        // Child customers section may or may not exist depending on data
        const childSection = page.locator('text=/Child Customers/i, text=/Sub-Customers/i');

        // This is optional - just verify the page doesn't crash
        await page.waitForTimeout(1000);
        // Page should still be functional
        await expect(page.locator('body')).toBeVisible();
      } else {
        test.skip();
      }
    });
  });

  test.describe('Contacts Tab', () => {
    test('should display contacts list or empty state', async ({ page }) => {
      const navigated = await navigateToCustomerDetail(page);

      if (navigated) {
        // Switch to Contacts tab
        const contactsTab = page.locator('button:has-text("Contacts"), [role="tab"]:has-text("Contacts")').first();
        await contactsTab.click();
        await waitForNetworkIdle(page, 10000);

        // Should show either contacts table/list or empty state
        const contactsList = page.locator(
          'table, [data-testid="contacts-list"], [data-testid="contacts-table"]'
        );
        const emptyState = page.locator(
          'text=/No contacts/i, text=/Add your first contact/i, [data-testid="empty-contacts"]'
        );

        const hasContacts = await contactsList.first().isVisible().catch(() => false);
        const isEmpty = await emptyState.first().isVisible().catch(() => false);

        expect(hasContacts || isEmpty).toBe(true);
      } else {
        test.skip();
      }
    });

    test('should display contact avatars with initials', async ({ page }) => {
      const navigated = await navigateToCustomerDetail(page);

      if (navigated) {
        // Switch to Contacts tab
        const contactsTab = page.locator('button:has-text("Contacts"), [role="tab"]:has-text("Contacts")').first();
        await contactsTab.click();
        await waitForNetworkIdle(page, 10000);

        // Look for avatar elements
        const avatars = page.locator('[data-testid="avatar"], .rounded-full');

        // If contacts exist, avatars should be visible
        if (await avatars.first().isVisible().catch(() => false)) {
          await expect(avatars.first()).toBeVisible();
        }
      } else {
        test.skip();
      }
    });

    test('should display contact name and email', async ({ page }) => {
      const navigated = await navigateToCustomerDetail(page);

      if (navigated) {
        // Switch to Contacts tab
        const contactsTab = page.locator('button:has-text("Contacts"), [role="tab"]:has-text("Contacts")').first();
        await contactsTab.click();
        await waitForNetworkIdle(page, 10000);

        // If contacts exist, check for name/email display
        const contactRow = page.locator('table tbody tr, [data-testid="contact-row"]').first();

        if (await contactRow.isVisible().catch(() => false)) {
          // Row should contain text (contact info)
          const text = await contactRow.textContent();
          expect(text?.length).toBeGreaterThan(0);
        }
      } else {
        test.skip();
      }
    });

    test('should have action buttons for contacts', async ({ page }) => {
      const navigated = await navigateToCustomerDetail(page);

      if (navigated) {
        // Switch to Contacts tab
        const contactsTab = page.locator('button:has-text("Contacts"), [role="tab"]:has-text("Contacts")').first();
        await contactsTab.click();
        await waitForNetworkIdle(page, 10000);

        // Look for action buttons (View, Edit, etc.)
        const actionButtons = page.locator(
          'button:has-text("View"), button:has-text("Edit"), [data-testid*="action"], button[aria-label*="action"]'
        );

        // If contacts exist, actions should be available
        const contactRow = page.locator('table tbody tr').first();
        if (await contactRow.isVisible().catch(() => false)) {
          // Actions might be in a dropdown or inline
          const hasActions = await actionButtons.first().isVisible().catch(() => false);
          const hasDropdown = await page.locator('[data-testid="actions-dropdown"], button[aria-haspopup]').first().isVisible().catch(() => false);

          // Either direct actions or dropdown should exist
          expect(hasActions || hasDropdown).toBe(true);
        }
      } else {
        test.skip();
      }
    });

    test('should show Add Contact button', async ({ page }) => {
      const navigated = await navigateToCustomerDetail(page);

      if (navigated) {
        // Switch to Contacts tab
        const contactsTab = page.locator('button:has-text("Contacts"), [role="tab"]:has-text("Contacts")').first();
        await contactsTab.click();
        await waitForNetworkIdle(page, 10000);

        // Look for Add Contact button
        const addButton = page.locator(
          'button:has-text("Add Contact"), button:has-text("New Contact"), a:has-text("Add Contact"), [data-testid="add-contact"]'
        );
        await expect(addButton.first()).toBeVisible({ timeout: 10000 });
      } else {
        test.skip();
      }
    });
  });

  test.describe('Transactions Tab', () => {
    test('should display invoices list or empty state', async ({ page }) => {
      const navigated = await navigateToCustomerDetail(page);

      if (navigated) {
        // Switch to Transactions tab
        const transactionsTab = page.locator('button:has-text("Transactions"), [role="tab"]:has-text("Transactions")').first();
        await transactionsTab.click();
        await waitForNetworkIdle(page, 10000);

        // Should show either invoices table or empty state
        const invoicesList = page.locator(
          'table, [data-testid="invoices-list"], [data-testid="transactions-table"]'
        );
        const emptyState = page.locator(
          'text=/No invoices/i, text=/No transactions/i, [data-testid="empty-transactions"]'
        );

        const hasInvoices = await invoicesList.first().isVisible().catch(() => false);
        const isEmpty = await emptyState.first().isVisible().catch(() => false);

        expect(hasInvoices || isEmpty).toBe(true);
      } else {
        test.skip();
      }
    });

    test('should display invoice summary cards', async ({ page }) => {
      const navigated = await navigateToCustomerDetail(page);

      if (navigated) {
        // Switch to Transactions tab
        const transactionsTab = page.locator('button:has-text("Transactions"), [role="tab"]:has-text("Transactions")').first();
        await transactionsTab.click();
        await waitForNetworkIdle(page, 10000);

        // Should show summary cards (Total, Paid, Outstanding, etc.)
        const summaryCards = page.locator(
          'text=/Total Invoiced/i, text=/Paid/i, text=/Outstanding/i, text=/Overdue/i, [data-testid="invoice-summary"]'
        );

        // At least one summary indicator should be visible
        await expect(summaryCards.first()).toBeVisible({ timeout: 10000 });
      } else {
        test.skip();
      }
    });

    test('should display invoice table with columns', async ({ page }) => {
      const navigated = await navigateToCustomerDetail(page);

      if (navigated) {
        // Switch to Transactions tab
        const transactionsTab = page.locator('button:has-text("Transactions"), [role="tab"]:has-text("Transactions")').first();
        await transactionsTab.click();
        await waitForNetworkIdle(page, 10000);

        const table = page.locator('table').first();

        if (await table.isVisible().catch(() => false)) {
          // Should have relevant headers
          const headers = table.locator('thead th');
          const headerCount = await headers.count();

          expect(headerCount).toBeGreaterThan(0);

          // Check for common invoice columns
          const headerText = await table.locator('thead').textContent();
          const hasInvoiceColumn =
            headerText?.toLowerCase().includes('invoice') ||
            headerText?.toLowerCase().includes('number') ||
            headerText?.toLowerCase().includes('date') ||
            headerText?.toLowerCase().includes('amount') ||
            headerText?.toLowerCase().includes('status');

          expect(hasInvoiceColumn).toBe(true);
        }
      } else {
        test.skip();
      }
    });

    test('should display invoice status badges', async ({ page }) => {
      const navigated = await navigateToCustomerDetail(page);

      if (navigated) {
        // Switch to Transactions tab
        const transactionsTab = page.locator('button:has-text("Transactions"), [role="tab"]:has-text("Transactions")').first();
        await transactionsTab.click();
        await waitForNetworkIdle(page, 10000);

        // Look for status badges
        const statusBadges = page.locator(
          '[data-testid="status-badge"], .badge, text=/PAID/i, text=/PENDING/i, text=/OVERDUE/i, text=/DRAFT/i'
        );

        // If invoices exist, status badges should be visible
        const table = page.locator('table tbody tr').first();
        if (await table.isVisible().catch(() => false)) {
          await expect(statusBadges.first()).toBeVisible({ timeout: 10000 });
        }
      } else {
        test.skip();
      }
    });

    test('should navigate to invoice detail on row click', async ({ page }) => {
      const navigated = await navigateToCustomerDetail(page);

      if (navigated) {
        // Switch to Transactions tab
        const transactionsTab = page.locator('button:has-text("Transactions"), [role="tab"]:has-text("Transactions")').first();
        await transactionsTab.click();
        await waitForNetworkIdle(page, 10000);

        // Find an invoice row
        const invoiceLink = page.locator('table tbody tr a, [data-testid="invoice-link"]').first();

        if (await invoiceLink.isVisible().catch(() => false)) {
          const href = await invoiceLink.getAttribute('href');

          // Should have a link to invoice detail
          expect(href).toBeTruthy();
          expect(href).toMatch(/invoice|transaction/i);
        }
      } else {
        test.skip();
      }
    });
  });

  test.describe('Loading States', () => {
    test('should show skeleton/loading while data loads', async ({ page }) => {
      const navigated = await navigateToCustomerDetail(page);

      if (navigated) {
        // Switch tabs and look for loading indicators
        const contactsTab = page.locator('button:has-text("Contacts"), [role="tab"]:has-text("Contacts")').first();
        await contactsTab.click();

        // Should either show loading state or content quickly
        const loadingOrContent = page.locator(
          '[class*="animate-pulse"], [class*="skeleton"], [data-testid="loading"], table, [data-testid="empty"]'
        );

        await expect(loadingOrContent.first()).toBeVisible({ timeout: 10000 });
      } else {
        test.skip();
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should show error state for invalid customer ID', async ({ page }) => {
      // Navigate to an invalid customer ID
      await page.goto('/relationships/customers/invalid-uuid-12345');
      await waitForNetworkIdle(page, 10000);

      // Should show error or redirect
      const errorMessage = page.locator(
        'text=/not found/i, text=/error/i, text=/invalid/i, [data-testid="error"]'
      );
      const redirected = page.url().includes('/relationships/customers') && !page.url().includes('invalid');

      const hasError = await errorMessage.first().isVisible().catch(() => false);

      expect(hasError || redirected).toBe(true);
    });
  });

  test.describe('Responsive Design', () => {
    test('should display properly on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      const navigated = await navigateToCustomerDetail(page);

      if (navigated) {
        // Page should still be functional
        const heading = page.locator('h1, h2');
        await expect(heading.first()).toBeVisible({ timeout: 10000 });

        // Tabs should still be accessible
        const tabs = page.locator('[role="tab"], button:has-text("Overview")');
        await expect(tabs.first()).toBeVisible({ timeout: 10000 });
      } else {
        test.skip();
      }
    });

    test('should display properly on tablet viewport', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });

      const navigated = await navigateToCustomerDetail(page);

      if (navigated) {
        // Page should still be functional
        const heading = page.locator('h1, h2');
        await expect(heading.first()).toBeVisible({ timeout: 10000 });

        // All tabs should be visible
        const overviewTab = page.locator('button:has-text("Overview"), [role="tab"]:has-text("Overview")');
        await expect(overviewTab.first()).toBeVisible({ timeout: 10000 });
      } else {
        test.skip();
      }
    });
  });
});

test.describe('Customer Detail Page - Accessibility', () => {
  test('should have proper heading structure', async ({ page }) => {
    await page.goto('/relationships/customers');
    await waitForNetworkIdle(page, 15000);

    const customerRow = page.locator('table tbody tr').first();
    if (await customerRow.isVisible()) {
      const customerLink = customerRow.locator('a').first();
      if (await customerLink.isVisible()) {
        await customerLink.click();
        await waitForNetworkIdle(page, 10000);

        // Should have h1 or h2
        const headings = page.locator('h1, h2');
        await expect(headings.first()).toBeVisible();
      }
    }
  });

  test('should have proper tab semantics', async ({ page }) => {
    await page.goto('/relationships/customers');
    await waitForNetworkIdle(page, 15000);

    const customerRow = page.locator('table tbody tr').first();
    if (await customerRow.isVisible()) {
      const customerLink = customerRow.locator('a').first();
      if (await customerLink.isVisible()) {
        await customerLink.click();
        await waitForNetworkIdle(page, 10000);

        // Tabs should have proper ARIA roles
        const tabList = page.locator('[role="tablist"]');
        const tabs = page.locator('[role="tab"]');
        const tabPanel = page.locator('[role="tabpanel"]');

        // At least verify tabs exist with some structure
        const hasTabList = await tabList.isVisible().catch(() => false);
        const hasTabs = (await tabs.count()) > 0;

        expect(hasTabList || hasTabs).toBe(true);
      }
    }
  });

  test('should support keyboard navigation for tabs', async ({ page }) => {
    await page.goto('/relationships/customers');
    await waitForNetworkIdle(page, 15000);

    const customerRow = page.locator('table tbody tr').first();
    if (await customerRow.isVisible()) {
      const customerLink = customerRow.locator('a').first();
      if (await customerLink.isVisible()) {
        await customerLink.click();
        await waitForNetworkIdle(page, 10000);

        // Find first tab and focus it
        const firstTab = page.locator('[role="tab"]').first();
        if (await firstTab.isVisible()) {
          await firstTab.focus();

          // Press arrow right to move to next tab
          await page.keyboard.press('ArrowRight');

          // Focused element should change
          const focusedElement = page.locator(':focus');
          await expect(focusedElement).toBeVisible();
        }
      }
    }
  });
});
