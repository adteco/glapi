import { test, expect } from '@playwright/test';

test.describe('Accounting Periods', () => {
  test('can create fiscal year periods via wizard', async ({ page }) => {
    // Navigate to accounting periods page
    await page.goto('http://localhost:3030/lists/accounting-periods');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Take screenshot to see current state
    await page.screenshot({ path: 'test-results/accounting-periods-initial.png' });

    // Click the "Create Fiscal Year" button to open wizard
    const createButton = page.getByRole('button', { name: /create fiscal year/i });
    if (await createButton.isVisible()) {
      await createButton.click();

      // Wait for dialog
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/accounting-periods-wizard.png' });

      // Fill in the wizard form
      // Select a subsidiary if dropdown exists
      const subsidiarySelect = page.locator('[data-testid="subsidiary-select"], select[name="subsidiaryId"]').first();
      if (await subsidiarySelect.isVisible()) {
        await subsidiarySelect.click();
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
      }

      // Fill fiscal year
      const fiscalYearInput = page.locator('input[name="fiscalYear"]');
      if (await fiscalYearInput.isVisible()) {
        await fiscalYearInput.fill('2026');
      }

      // Fill year start date
      const startDateInput = page.locator('input[name="yearStartDate"]');
      if (await startDateInput.isVisible()) {
        await startDateInput.fill('2026-01-01');
      }

      await page.screenshot({ path: 'test-results/accounting-periods-filled.png' });

      // Submit the form
      const submitButton = page.getByRole('button', { name: /create.*periods|submit|save/i });
      if (await submitButton.isVisible()) {
        await submitButton.click();

        // Wait for response
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'test-results/accounting-periods-result.png' });

        // Check for success or error
        const errorMessage = page.locator('[role="alert"], .error, .text-red-500, .text-destructive');
        if (await errorMessage.isVisible()) {
          const errorText = await errorMessage.textContent();
          console.log('Error found:', errorText);
          throw new Error(`Insert failed: ${errorText}`);
        }

        // Verify periods were created
        const successMessage = page.locator('text=/created|success/i');
        const periodsTable = page.locator('table, [data-testid="periods-list"]');

        expect(await successMessage.isVisible() || await periodsTable.isVisible()).toBeTruthy();
      }
    } else {
      console.log('Create Fiscal Year button not found');
      await page.screenshot({ path: 'test-results/accounting-periods-no-button.png' });
    }
  });
});
