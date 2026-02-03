import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Generic List Page Object for CRUD list views
 * Handles common patterns: search, filter, pagination, table interactions
 */
export class ListPage extends BasePage {
  // Search and filter elements
  readonly searchInput: Locator;
  readonly filterDropdown: Locator;
  readonly clearFiltersButton: Locator;

  // Table elements
  readonly table: Locator;
  readonly tableHeaders: Locator;
  readonly tableRows: Locator;
  readonly emptyState: Locator;

  // Pagination elements
  readonly pagination: Locator;
  readonly prevPageButton: Locator;
  readonly nextPageButton: Locator;
  readonly pageInfo: Locator;

  // Action buttons
  readonly createButton: Locator;
  readonly deleteButton: Locator;
  readonly editButton: Locator;

  // Dialog/Modal
  readonly dialog: Locator;
  readonly dialogCloseButton: Locator;

  constructor(page: Page) {
    super(page);

    // Search and filter
    this.searchInput = page.locator(
      'input[placeholder*="Search"], input[type="search"], [data-testid="search-input"]'
    );
    this.filterDropdown = page.locator(
      '[data-testid="filter-dropdown"], select[name*="filter"], button:has-text("Filter")'
    );
    this.clearFiltersButton = page.locator('button:has-text("Clear"), button:has-text("Reset")');

    // Table
    this.table = page.locator('table, [role="table"], [data-testid="data-table"]');
    this.tableHeaders = this.table.locator('thead th, [role="columnheader"]');
    this.tableRows = this.table.locator('tbody tr, [role="row"]:not(:first-child)');
    this.emptyState = page.locator(
      '[data-testid="empty-state"], .empty-state'
    ).or(page.getByText('No results')).or(page.getByText('No items'));

    // Pagination
    this.pagination = page.locator(
      '[data-testid="pagination"], nav[aria-label*="pagination"], .pagination'
    );
    this.prevPageButton = this.pagination.locator(
      'button:has-text("Previous"), button[aria-label*="previous"]'
    );
    this.nextPageButton = this.pagination.locator(
      'button:has-text("Next"), button[aria-label*="next"]'
    );
    this.pageInfo = this.pagination.locator('[data-testid="page-info"], .page-info');

    // Actions
    this.createButton = page.locator(
      'button:has-text("Create"), button:has-text("Add"), button:has-text("New"), [data-testid="create-button"]'
    );
    this.deleteButton = page.locator('button:has-text("Delete"), [data-testid="delete-button"]');
    this.editButton = page.locator('button:has-text("Edit"), [data-testid="edit-button"]');

    // Dialog
    this.dialog = page.locator('[role="dialog"], [data-radix-dialog-content]');
    this.dialogCloseButton = this.dialog.locator(
      'button[aria-label*="close"], button:has-text("Cancel"), button:has-text("Close")'
    );
  }

  /**
   * Search for items by text
   */
  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    // Wait for debounce and results to load
    await this.page.waitForTimeout(500);
    await this.waitForPageLoad();
  }

  /**
   * Clear search input
   */
  async clearSearch(): Promise<void> {
    await this.searchInput.clear();
    await this.waitForPageLoad();
  }

  /**
   * Select filter option
   */
  async selectFilter(filterName: string, optionText: string): Promise<void> {
    const filterButton = this.page.locator(`button:has-text("${filterName}")`).first();
    await filterButton.click();
    await this.page.locator(`[role="option"]:has-text("${optionText}")`).click();
    await this.waitForPageLoad();
  }

  /**
   * Clear all filters
   */
  async clearFilters(): Promise<void> {
    if (await this.clearFiltersButton.isVisible()) {
      await this.clearFiltersButton.click();
      await this.waitForPageLoad();
    }
  }

  /**
   * Get number of rows in table
   */
  async getRowCount(): Promise<number> {
    return await this.tableRows.count();
  }

  /**
   * Check if table is empty
   */
  async isEmpty(): Promise<boolean> {
    const rowCount = await this.getRowCount();
    return rowCount === 0 || (await this.emptyState.isVisible());
  }

  /**
   * Get row by index (0-based)
   */
  getRow(index: number): Locator {
    return this.tableRows.nth(index);
  }

  /**
   * Get cell value by row index and column name
   */
  async getCellValue(rowIndex: number, columnName: string): Promise<string> {
    const headers = await this.tableHeaders.allTextContents();
    const columnIndex = headers.findIndex(
      (h) => h.toLowerCase().includes(columnName.toLowerCase())
    );
    if (columnIndex === -1) {
      throw new Error(`Column "${columnName}" not found`);
    }
    const cell = this.getRow(rowIndex).locator('td, [role="cell"]').nth(columnIndex);
    return (await cell.textContent()) || '';
  }

  /**
   * Click row by index
   */
  async clickRow(index: number): Promise<void> {
    await this.getRow(index).click();
  }

  /**
   * Find row containing text
   */
  async findRowByText(text: string): Promise<Locator> {
    return this.tableRows.filter({ hasText: text }).first();
  }

  /**
   * Click action button in row
   */
  async clickRowAction(rowIndex: number, actionName: string): Promise<void> {
    const row = this.getRow(rowIndex);
    const actionButton = row.locator(`button:has-text("${actionName}")`).first();

    // If action button not directly visible, check for menu
    if (!(await actionButton.isVisible())) {
      const menuButton = row.locator(
        'button[aria-label*="actions"], button[aria-label*="menu"], button:has([data-testid="more-icon"])'
      );
      if (await menuButton.isVisible()) {
        await menuButton.click();
        await this.page.locator(`[role="menuitem"]:has-text("${actionName}")`).click();
        return;
      }
    }

    await actionButton.click();
  }

  /**
   * Click edit button for row
   */
  async editRow(rowIndex: number): Promise<void> {
    await this.clickRowAction(rowIndex, 'Edit');
  }

  /**
   * Click delete button for row
   */
  async deleteRow(rowIndex: number): Promise<void> {
    await this.clickRowAction(rowIndex, 'Delete');
  }

  /**
   * Confirm delete in dialog
   */
  async confirmDelete(): Promise<void> {
    const confirmButton = this.dialog.locator(
      'button:has-text("Delete"), button:has-text("Confirm"), button:has-text("Yes")'
    );
    await confirmButton.click();
    await this.waitForPageLoad();
  }

  /**
   * Cancel delete in dialog
   */
  async cancelDelete(): Promise<void> {
    await this.dialogCloseButton.click();
  }

  /**
   * Click create/add button
   */
  async clickCreate(): Promise<void> {
    await this.createButton.click();
    // Wait for dialog or page navigation
    await this.page.waitForTimeout(500);
  }

  /**
   * Go to next page
   */
  async nextPage(): Promise<void> {
    await this.nextPageButton.click();
    await this.waitForPageLoad();
  }

  /**
   * Go to previous page
   */
  async prevPage(): Promise<void> {
    await this.prevPageButton.click();
    await this.waitForPageLoad();
  }

  /**
   * Check if there are more pages
   */
  async hasNextPage(): Promise<boolean> {
    return await this.nextPageButton.isEnabled();
  }

  /**
   * Check if there are previous pages
   */
  async hasPrevPage(): Promise<boolean> {
    return await this.prevPageButton.isEnabled();
  }

  /**
   * Sort by column
   */
  async sortByColumn(columnName: string): Promise<void> {
    const header = this.tableHeaders.filter({ hasText: columnName }).first();
    await header.click();
    await this.waitForPageLoad();
  }

  /**
   * Verify row exists with specific text
   */
  async expectRowWithText(text: string): Promise<void> {
    await expect(this.tableRows.filter({ hasText: text }).first()).toBeVisible();
  }

  /**
   * Verify no row with specific text
   */
  async expectNoRowWithText(text: string): Promise<void> {
    await expect(this.tableRows.filter({ hasText: text })).toHaveCount(0);
  }

  /**
   * Close any open dialog
   */
  async closeDialog(): Promise<void> {
    if (await this.dialog.isVisible()) {
      await this.dialogCloseButton.click();
      await this.dialog.waitFor({ state: 'hidden' });
    }
  }
}
