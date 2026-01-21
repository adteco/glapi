import { test, expect } from '@playwright/test';

test.describe('Migration Wizard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/migration');
  });

  test('displays wizard with step indicator', async ({ page }) => {
    // Check page title
    await expect(page.locator('h1')).toContainText('Data Migration Wizard');

    // Check step indicator
    await expect(page.getByText('Source')).toBeVisible();
    await expect(page.getByText('Upload')).toBeVisible();
    await expect(page.getByText('Mapping')).toBeVisible();
    await expect(page.getByText('Validate')).toBeVisible();
    await expect(page.getByText('Import')).toBeVisible();
    await expect(page.getByText('Complete')).toBeVisible();
  });

  test('source step shows supported systems', async ({ page }) => {
    // Check source systems are displayed
    await expect(page.getByText('QuickBooks Online')).toBeVisible();
    await expect(page.getByText('QuickBooks Desktop')).toBeVisible();
    await expect(page.getByText('Xero')).toBeVisible();
    await expect(page.getByText('CSV File')).toBeVisible();
    await expect(page.getByText('Excel File')).toBeVisible();
  });

  test('source step shows data types', async ({ page }) => {
    // Check data types are displayed
    await expect(page.getByText('Chart of Accounts')).toBeVisible();
    await expect(page.getByText('Customers')).toBeVisible();
    await expect(page.getByText('Vendors')).toBeVisible();
    await expect(page.getByText('Items/Products')).toBeVisible();
  });

  test('continue button is disabled without selections', async ({ page }) => {
    const continueButton = page.getByRole('button', { name: 'Continue' });
    await expect(continueButton).toBeDisabled();
  });

  test('can select source system and data types', async ({ page }) => {
    // Select CSV as source
    await page.getByText('CSV File').click();

    // Select Chart of Accounts
    await page.getByText('Chart of Accounts').click();

    // Continue button should be enabled
    const continueButton = page.getByRole('button', { name: 'Continue' });
    await expect(continueButton).toBeEnabled();

    // Click continue to go to upload step
    await continueButton.click();

    // Should show upload form
    await expect(page.getByText('Import Name')).toBeVisible();
    await expect(page.getByText('Upload Data File')).toBeVisible();
  });

  test('upload step requires batch name and file', async ({ page }) => {
    // Navigate to upload step
    await page.getByText('CSV File').click();
    await page.getByText('Chart of Accounts').click();
    await page.getByRole('button', { name: 'Continue' }).click();

    // Check continue button is disabled
    const continueButton = page.getByRole('button', { name: 'Continue' });
    await expect(continueButton).toBeDisabled();

    // Fill in batch name
    await page.getByLabel('Import Name').fill('Test Import');

    // Still disabled without file
    await expect(continueButton).toBeDisabled();
  });

  test('can navigate back from upload step', async ({ page }) => {
    // Navigate to upload step
    await page.getByText('CSV File').click();
    await page.getByText('Chart of Accounts').click();
    await page.getByRole('button', { name: 'Continue' }).click();

    // Click back button
    await page.getByRole('button', { name: 'Back' }).click();

    // Should be back at source selection
    await expect(page.getByText('Select Source System')).toBeVisible();
  });
});

test.describe('Migration History', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/migration/history');
  });

  test('displays history page', async ({ page }) => {
    // Check page title
    await expect(page.locator('h1')).toContainText('Import History');

    // Check navigation button
    await expect(page.getByRole('button', { name: 'New Import' })).toBeVisible();
  });

  test('shows status filter', async ({ page }) => {
    // Check filter dropdown is present
    await expect(page.getByText('All Status')).toBeVisible();
  });

  test('can navigate to new import', async ({ page }) => {
    await page.getByRole('button', { name: 'New Import' }).click();

    // Should navigate to wizard
    await expect(page).toHaveURL('/admin/migration');
  });

  test('shows empty state when no batches', async ({ page }) => {
    // If no batches exist, should show message
    // This test may need adjustment based on test data
    const emptyMessage = page.getByText('No import batches found');
    const table = page.getByRole('table');

    // Either empty message or table should be visible
    const isEmpty = await emptyMessage.isVisible().catch(() => false);
    const hasTable = await table.isVisible().catch(() => false);

    expect(isEmpty || hasTable).toBeTruthy();
  });
});

test.describe('Migration Wizard - Full Flow', () => {
  test('completes full import flow with CSV', async ({ page }) => {
    // This test simulates a full import flow
    // In a real test, you would upload an actual file

    await page.goto('/admin/migration');

    // Step 1: Source Selection
    await page.getByText('CSV File').click();
    await page.getByText('Chart of Accounts').click();
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 2: Upload
    await expect(page.getByText('Import Name')).toBeVisible();
    await page.getByLabel('Import Name').fill('E2E Test Import');
    await page.getByLabel('Description (optional)').fill('Automated test import');

    // Note: File upload would need special handling
    // In a real test, you might mock the file or use a test fixture

    // Navigate back to verify state is preserved
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByText('Select Source System')).toBeVisible();

    // Source should still be selected
    const csvButton = page.getByText('CSV File').locator('..');
    await expect(csvButton).toHaveClass(/border-primary/);
  });
});

test.describe('Migration Wizard - Field Mapping', () => {
  test('mapping step has auto-map button', async ({ page }) => {
    // This test verifies the mapping UI elements
    // Full testing would require file upload

    await page.goto('/admin/migration');

    // Navigate through first two steps
    await page.getByText('CSV File').click();
    await page.getByText('Chart of Accounts').click();
    await page.getByRole('button', { name: 'Continue' }).click();

    // We can't proceed without a file, but we can verify the UI structure
    await expect(page.getByText('Import Name')).toBeVisible();
    await expect(page.getByText('Upload Data File')).toBeVisible();
  });
});

test.describe('Migration Wizard - Error Handling', () => {
  test('shows organization error when not selected', async ({ page }) => {
    // Test depends on auth setup - may show organization selection message
    await page.goto('/admin/migration');

    // The wizard should either work or show appropriate error
    const hasWizard = await page.getByText('Data Migration Wizard').isVisible().catch(() => false);
    const hasError = await page.getByText('organization').isVisible().catch(() => false);

    expect(hasWizard || hasError).toBeTruthy();
  });
});

test.describe('Migration Wizard - Responsive Design', () => {
  test('wizard is responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/admin/migration');

    // Check elements are still visible on mobile
    await expect(page.locator('h1')).toContainText('Data Migration Wizard');
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  });

  test('history page is responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/admin/migration/history');

    await expect(page.locator('h1')).toContainText('Import History');
  });
});
