import { test, expect } from '@playwright/test';

test.describe('Project Budgets - Construction Accounting', () => {
  test.beforeEach(async ({ page }) => {
    // Auth is handled by the setup project in playwright config
  });

  test.describe('Budget List Page', () => {
    test('should load project budgets list page', async ({ page }) => {
      await page.goto('/construction/budgets');

      // Check page loads
      await expect(page.locator('h1')).toContainText('Project Budgets');
      await expect(page.locator('text=Manage project budget versions')).toBeVisible();

      // Check for main elements
      await expect(page.locator('text=New Budget')).toBeVisible();
    });

    test('should display status filter dropdown', async ({ page }) => {
      await page.goto('/construction/budgets');

      // Check filter dropdown exists
      const filterTrigger = page.locator('button:has-text("All Statuses")');
      await expect(filterTrigger).toBeVisible();

      // Open dropdown and check options
      await filterTrigger.click();
      await expect(page.locator('text=Draft')).toBeVisible();
      await expect(page.locator('text=Submitted')).toBeVisible();
      await expect(page.locator('text=Approved')).toBeVisible();
      await expect(page.locator('text=Locked')).toBeVisible();
      await expect(page.locator('text=Superseded')).toBeVisible();
    });

    test('should display table headers', async ({ page }) => {
      await page.goto('/construction/budgets');

      // Check table headers
      await expect(page.locator('th:has-text("Version")')).toBeVisible();
      await expect(page.locator('th:has-text("Name")')).toBeVisible();
      await expect(page.locator('th:has-text("Status")')).toBeVisible();
      await expect(page.locator('th:has-text("Original Budget")')).toBeVisible();
      await expect(page.locator('th:has-text("Revised Budget")')).toBeVisible();
      await expect(page.locator('th:has-text("Actual Cost")')).toBeVisible();
    });

    test('should open create budget dialog', async ({ page }) => {
      await page.goto('/construction/budgets');

      // Click new budget button
      await page.click('text=New Budget');

      // Check dialog appears
      await expect(page.locator('text=Create Budget Version')).toBeVisible();
      await expect(page.locator('text=Create a new budget version for a project')).toBeVisible();

      // Check form fields
      await expect(page.locator('label:has-text("Project ID")')).toBeVisible();
      await expect(page.locator('label:has-text("Version Name")')).toBeVisible();
      await expect(page.locator('label:has-text("Description")')).toBeVisible();
      await expect(page.locator('label:has-text("Effective Date")')).toBeVisible();

      // Check buttons
      await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
      await expect(page.locator('button:has-text("Create Budget")')).toBeVisible();
    });

    test('should close create dialog on cancel', async ({ page }) => {
      await page.goto('/construction/budgets');

      // Open dialog
      await page.click('text=New Budget');
      await expect(page.locator('text=Create Budget Version')).toBeVisible();

      // Click cancel
      await page.click('button:has-text("Cancel")');

      // Dialog should be closed
      await expect(page.locator('text=Create Budget Version')).not.toBeVisible();
    });
  });

  test.describe('Budget Detail Page', () => {
    test('should handle missing budget gracefully', async ({ page }) => {
      // Navigate to non-existent budget
      await page.goto('/construction/budgets/00000000-0000-0000-0000-000000000000');

      // Should show not found message
      await expect(page.locator('text=Budget version not found')).toBeVisible();
      await expect(page.locator('text=Back to List')).toBeVisible();
    });
  });

  test.describe('Budget Inline Editing', () => {
    test('should show edit instructions for draft budgets', async ({ page }) => {
      // This test requires a DRAFT budget to exist
      // The test will verify the edit instructions appear
      await page.goto('/construction/budgets');

      // Look for any budget row with DRAFT status
      const draftRow = page.locator('tr:has(span:text("DRAFT"))').first();

      if (await draftRow.isVisible()) {
        // Click to view the budget
        await draftRow.locator('a').first().click();

        // Should show edit instructions
        await expect(page.locator('text=Click on amount cells to edit inline')).toBeVisible();
      }
    });

    test('should show locked warning for non-draft budgets', async ({ page }) => {
      // This test requires a non-DRAFT budget to exist
      await page.goto('/construction/budgets');

      // Look for any budget row with LOCKED or APPROVED status
      const lockedRow = page.locator('tr:has(span:text("LOCKED"))').first();
      const approvedRow = page.locator('tr:has(span:text("APPROVED"))').first();

      const targetRow = await lockedRow.isVisible() ? lockedRow : approvedRow;

      if (await targetRow.isVisible()) {
        // Click to view the budget
        await targetRow.locator('a').first().click();

        // Should show locked warning
        await expect(page.locator('text=Version Locked')).toBeVisible();
        await expect(page.locator('text=Editing is only allowed for DRAFT versions')).toBeVisible();
      }
    });
  });

  test.describe('Budget Variance View', () => {
    test('should display variance tab', async ({ page }) => {
      await page.goto('/construction/budgets');

      // Click on first budget if available
      const budgetLink = page.locator('table tbody a').first();
      if (await budgetLink.isVisible()) {
        await budgetLink.click();

        // Check tabs are visible
        await expect(page.locator('text=Budget Lines')).toBeVisible();
        await expect(page.locator('text=Variance Analysis')).toBeVisible();
        await expect(page.locator('text=Details')).toBeVisible();

        // Click variance tab
        await page.click('text=Variance Analysis');

        // Check variance content
        await expect(page.locator('text=Budget vs Actual Summary')).toBeVisible();
        await expect(page.locator('text=Total Lines')).toBeVisible();
        await expect(page.locator('text=Over Budget')).toBeVisible();
        await expect(page.locator('text=Under Budget')).toBeVisible();
      }
    });

    test('should display variance by cost type table', async ({ page }) => {
      await page.goto('/construction/budgets');

      // Click on first budget if available
      const budgetLink = page.locator('table tbody a').first();
      if (await budgetLink.isVisible()) {
        await budgetLink.click();

        // Click variance tab
        await page.click('text=Variance Analysis');

        // Check variance by cost type section
        await expect(page.locator('text=Variance by Cost Type')).toBeVisible();

        // Check table headers
        await expect(page.locator('th:has-text("Cost Type")')).toBeVisible();
        await expect(page.locator('th:has-text("Budget")')).toBeVisible();
        await expect(page.locator('th:has-text("Actual")')).toBeVisible();
        await expect(page.locator('th:has-text("Variance")')).toBeVisible();
      }
    });
  });

  test.describe('Budget Summary Cards', () => {
    test('should display summary cards on detail page', async ({ page }) => {
      await page.goto('/construction/budgets');

      // Click on first budget if available
      const budgetLink = page.locator('table tbody a').first();
      if (await budgetLink.isVisible()) {
        await budgetLink.click();

        // Check summary cards
        await expect(page.locator('text=Original Budget')).toBeVisible();
        await expect(page.locator('text=Revised Budget')).toBeVisible();
        await expect(page.locator('text=Actual Cost')).toBeVisible();
        await expect(page.locator('text=Committed Cost')).toBeVisible();
        await expect(page.locator('text=Variance')).toBeVisible();
      }
    });
  });

  test.describe('Budget Status Workflow', () => {
    test('should show submit button for draft budgets', async ({ page }) => {
      await page.goto('/construction/budgets');

      // Look for any budget row with DRAFT status
      const draftRow = page.locator('tr:has(span:text("DRAFT"))').first();

      if (await draftRow.isVisible()) {
        await draftRow.locator('a').first().click();

        // Should show submit button
        await expect(page.locator('button:has-text("Submit for Approval")')).toBeVisible();
      }
    });

    test('should show approve button for submitted budgets', async ({ page }) => {
      await page.goto('/construction/budgets');

      // Look for any budget row with SUBMITTED status
      const submittedRow = page.locator('tr:has(span:text("SUBMITTED"))').first();

      if (await submittedRow.isVisible()) {
        await submittedRow.locator('a').first().click();

        // Should show approve button
        await expect(page.locator('button:has-text("Approve")')).toBeVisible();
      }
    });

    test('should show lock button for approved budgets', async ({ page }) => {
      await page.goto('/construction/budgets');

      // Look for any budget row with APPROVED status
      const approvedRow = page.locator('tr:has(span:text("APPROVED"))').first();

      if (await approvedRow.isVisible()) {
        await approvedRow.locator('a').first().click();

        // Should show lock button
        await expect(page.locator('button:has-text("Lock Version")')).toBeVisible();
      }
    });
  });

  test.describe('Copy Budget Version', () => {
    test('should open copy dialog from list page', async ({ page }) => {
      await page.goto('/construction/budgets');

      // Find copy button (icon with title "Copy Budget")
      const copyButton = page.locator('button[title="Copy Budget"]').first();

      if (await copyButton.isVisible()) {
        await copyButton.click();

        // Check copy dialog appears
        await expect(page.locator('text=Copy Budget Version')).toBeVisible();
        await expect(page.locator('text=Create a new draft budget by copying')).toBeVisible();
        await expect(page.locator('label:has-text("New Version Name")')).toBeVisible();
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('should be usable on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/construction/budgets');

      // Main content should still be visible
      await expect(page.locator('h1')).toContainText('Project Budgets');
      await expect(page.locator('text=New Budget')).toBeVisible();
    });

    test('budget detail should be usable on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/construction/budgets');

      // Click on first budget if available
      const budgetLink = page.locator('table tbody a').first();
      if (await budgetLink.isVisible()) {
        await budgetLink.click();

        // Summary cards should be visible (will stack vertically)
        await expect(page.locator('text=Original Budget')).toBeVisible();
        await expect(page.locator('text=Actual Cost')).toBeVisible();
      }
    });
  });
});
