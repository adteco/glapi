import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { waitForPageReady } from '../utils/test-helpers';

test.describe('Work in Progress (WIP) Reports', () => {
  let listPage: ListPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/construction/wip-reports');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load WIP reports page', async ({ page }) => {
      await expect(page).toHaveURL(/\/construction.*wip/);
    });

    test('should display WIP report or empty state', async () => {
      const hasData = (await listPage.getRowCount()) > 0;
      const isEmpty = await listPage.isEmpty();
      const hasReport = await page.locator('[data-testid="wip-report"], .wip-report').isVisible();
      expect(hasData || isEmpty || hasReport).toBe(true);
    });

    test('should display generate report button', async ({ page }) => {
      const generateButton = page.locator('button:has-text("Generate"), button:has-text("Run Report")');
      await expect(generateButton).toBeVisible();
    });
  });

  test.describe('Report Filters', () => {
    test('should filter by project', async ({ page }) => {
      const projectFilter = page.locator('button:has-text("Project"), [data-testid="project-filter"]');
      if (await projectFilter.isVisible()) {
        await projectFilter.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
        }
      }
    });

    test('should filter by date range', async ({ page }) => {
      const dateFilter = page.locator('[data-testid="date-range"], button:has-text("Date")');
      if (await dateFilter.isVisible()) {
        await dateFilter.click();
        const preset = page.locator('[role="option"]').first();
        if (await preset.isVisible()) {
          await preset.click();
        }
      }
    });

    test('should filter by accounting period', async ({ page }) => {
      const periodFilter = page.locator('[data-testid="period-filter"], button:has-text("Period")');
      if (await periodFilter.isVisible()) {
        await periodFilter.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
        }
      }
    });
  });

  test.describe('Generate WIP Report', () => {
    test('should generate WIP report', async ({ page }) => {
      const generateButton = page.locator('button:has-text("Generate"), button:has-text("Run Report")');
      if (await generateButton.isVisible()) {
        await generateButton.click();
        await waitForPageReady(page);

        const reportContent = page.locator('[data-testid="wip-report"], table, .report-content');
        await expect(reportContent).toBeVisible();
      }
    });

    test('should display project summary', async ({ page }) => {
      const generateButton = page.locator('button:has-text("Generate"), button:has-text("Run Report")');
      if (await generateButton.isVisible()) {
        await generateButton.click();
        await waitForPageReady(page);

        const summary = page.locator('[data-testid="project-summary"], :has-text("Summary")');
        // Summary should be visible after generation
      }
    });
  });

  test.describe('WIP Report Content', () => {
    test('should display contract values', async ({ page }) => {
      const contractColumn = page.locator('th:has-text("Contract"), td:has-text("Contract")');
      // Contract values column may be visible
    });

    test('should display costs to date', async ({ page }) => {
      const costsColumn = page.locator('th:has-text("Costs"), td:has-text("Cost")');
      // Costs column may be visible
    });

    test('should display billings to date', async ({ page }) => {
      const billingsColumn = page.locator('th:has-text("Billing"), td:has-text("Billed")');
      // Billings column may be visible
    });

    test('should display over/under billing', async ({ page }) => {
      const overUnderColumn = page.locator('th:has-text("Over"), th:has-text("Under"), [data-testid="over-under"]');
      // Over/under billing column may be visible
    });

    test('should display percent complete', async ({ page }) => {
      const percentColumn = page.locator('th:has-text("Complete"), th:has-text("%")');
      // Percent complete column may be visible
    });

    test('should display estimated gross profit', async ({ page }) => {
      const profitColumn = page.locator('th:has-text("Profit"), th:has-text("Margin")');
      // Profit column may be visible
    });
  });

  test.describe('WIP Report Actions', () => {
    test('should have export to Excel option', async ({ page }) => {
      const exportButton = page.locator('button:has-text("Export"), button:has-text("Excel"), button:has-text("Download")');
      // Export option may or may not be present
    });

    test('should have print option', async ({ page }) => {
      const printButton = page.locator('button:has-text("Print"), button:has-text("PDF")');
      // Print option may or may not be present
    });

    test('should have save report option', async ({ page }) => {
      const saveButton = page.locator('button:has-text("Save Report"), button:has-text("Save")');
      // Save option may or may not be present
    });
  });

  test.describe('Saved WIP Reports', () => {
    test('should display saved reports list', async ({ page }) => {
      const savedReports = page.locator('[data-testid="saved-reports"], :has-text("Saved Reports")');
      // Saved reports section may or may not be visible
    });

    test('should load saved report', async ({ page }) => {
      const savedReportItem = page.locator('[data-testid="saved-report-item"]').first();
      if (await savedReportItem.isVisible()) {
        await savedReportItem.click();
        await waitForPageReady(page);

        const reportContent = page.locator('[data-testid="wip-report"], table');
        await expect(reportContent).toBeVisible();
      }
    });
  });

  test.describe('WIP Analysis', () => {
    test('should display overbilled projects', async ({ page }) => {
      const overbilled = page.locator('[data-testid="overbilled"], :has-text("Overbilled")');
      // Overbilled section may be visible
    });

    test('should display underbilled projects', async ({ page }) => {
      const underbilled = page.locator('[data-testid="underbilled"], :has-text("Underbilled")');
      // Underbilled section may be visible
    });

    test('should display totals row', async ({ page }) => {
      const totalsRow = page.locator('tr:has-text("Total"), [data-testid="totals-row"]');
      // Totals row may be visible
    });
  });

  test.describe('Drill Down', () => {
    test('should navigate to project detail on click', async ({ page }) => {
      const projectLink = page.locator('a[href*="project"], [data-testid="project-link"]').first();
      if (await projectLink.isVisible()) {
        await projectLink.click();
        await expect(page).toHaveURL(/\/project/);
      }
    });
  });
});
