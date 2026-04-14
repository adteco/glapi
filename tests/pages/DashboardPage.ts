import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Dashboard Page Object for the main application dashboard
 */
export class DashboardPage extends BasePage {
  // KPI Cards
  readonly kpiCards: Locator;
  readonly totalRevenueCard: Locator;
  readonly netIncomeCard: Locator;
  readonly cashBalanceCard: Locator;
  readonly outstandingInvoicesCard: Locator;

  // Recent Transactions
  readonly recentTransactions: Locator;
  readonly transactionRows: Locator;

  // Quick Actions
  readonly quickActions: Locator;
  readonly newInvoiceButton: Locator;
  readonly newCustomerButton: Locator;
  readonly newItemButton: Locator;

  // Organization context
  readonly orgContextMessage: Locator;
  readonly selectOrgButton: Locator;

  constructor(page: Page) {
    super(page);

    // KPI Cards
    this.kpiCards = page.locator(
      'text=/^(Total Revenue|Net Income|Cash Balance|Outstanding|Active Customers)$/'
    );
    this.totalRevenueCard = page.locator('[data-testid="total-revenue"], text="Total Revenue"').locator('..');
    this.netIncomeCard = page.locator('[data-testid="net-income"], text="Net Income"').locator('..');
    this.cashBalanceCard = page.locator('[data-testid="cash-balance"], text="Cash Balance"').locator('..');
    this.outstandingInvoicesCard = page.locator('[data-testid="outstanding-invoices"], text="Outstanding"').locator('..');

    // Recent Transactions
    this.recentTransactions = page.locator(
      '[data-testid="recent-transactions"], section:has-text("Recent Transactions")'
    );
    this.transactionRows = this.recentTransactions.locator('tbody tr, [data-testid="transaction-row"]');

    // Quick Actions
    this.quickActions = page.locator('[data-testid="quick-actions"], section:has-text("Quick Actions")');
    this.newInvoiceButton = page.locator(
      'button:has-text("New Invoice"), a:has-text("New Invoice"), [data-testid="new-invoice"]'
    );
    this.newCustomerButton = page.locator(
      'button:has-text("New Customer"), a:has-text("New Customer"), [data-testid="new-customer"]'
    );
    this.newItemButton = page.locator(
      'button:has-text("New Item"), a:has-text("New Item"), [data-testid="new-item"]'
    );

    // Org context
    this.orgContextMessage = page.locator(
      'text="Please select an organization", text="No organization selected"'
    );
    this.selectOrgButton = page.locator(
      'button:has-text("Select Organization"), a:has-text("Select Organization")'
    );
  }

  /**
   * Navigate to dashboard
   */
  async goto(): Promise<void> {
    await this.page.goto('/dashboard');
    await this.waitForPageLoad();
  }

  /**
   * Check if organization context is set
   */
  async hasOrgContext(): Promise<boolean> {
    return !(await this.orgContextMessage.isVisible());
  }

  /**
   * Wait for dashboard to fully load
   */
  async waitForDashboardLoad(): Promise<void> {
    await this.waitForPageLoad();
    // Wait for KPI cards to load data
    await this.page.waitForResponse(
      (response) => response.url().includes('/api/') && response.status() === 200,
      { timeout: 15000 }
    ).catch(() => {
      // API might already be loaded
    });
  }

  /**
   * Get KPI value by card name
   */
  async getKPIValue(cardName: string): Promise<string> {
    const card = this.page.locator(`text="${cardName}"`).locator('..').locator('[data-testid="value"], .value, h2, h3');
    return (await card.textContent()) || '';
  }

  /**
   * Get total revenue value
   */
  async getTotalRevenue(): Promise<string> {
    return await this.getKPIValue('Total Revenue');
  }

  /**
   * Get net income value
   */
  async getNetIncome(): Promise<string> {
    return await this.getKPIValue('Net Income');
  }

  /**
   * Get number of recent transactions
   */
  async getRecentTransactionCount(): Promise<number> {
    return await this.transactionRows.count();
  }

  /**
   * Click recent transaction row
   */
  async clickRecentTransaction(index: number): Promise<void> {
    await this.transactionRows.nth(index).click();
    await this.waitForPageLoad();
  }

  /**
   * Create new invoice via quick action
   */
  async createNewInvoice(): Promise<void> {
    await this.newInvoiceButton.click();
    await this.waitForPageLoad();
  }

  /**
   * Create new customer via quick action
   */
  async createNewCustomer(): Promise<void> {
    await this.newCustomerButton.click();
    await this.waitForPageLoad();
  }

  /**
   * Create new item via quick action
   */
  async createNewItem(): Promise<void> {
    await this.newItemButton.click();
    await this.waitForPageLoad();
  }

  /**
   * Navigate to section via sidebar
   */
  async navigateToSection(section: string, subsection?: string): Promise<void> {
    // Expand section if needed
    const sectionLink = this.sidebar.getByRole('link', { name: section }).or(
      this.sidebar.locator(`text="${section}"`).first()
    );

    // Check if it's expandable
    const isExpandable = await sectionLink.getAttribute('aria-expanded');
    if (isExpandable !== null) {
      const isExpanded = isExpandable === 'true';
      if (!isExpanded) {
        await sectionLink.click();
      }
    }

    if (subsection) {
      await this.sidebar.getByRole('link', { name: subsection }).click();
    } else if (isExpandable === null) {
      await sectionLink.click();
    }

    await this.waitForPageLoad();
  }

  /**
   * Navigate to Lists > Items
   */
  async goToItems(): Promise<void> {
    await this.navigateToSection('Lists', 'Items');
  }

  /**
   * Navigate to Relationships > Customers
   */
  async goToCustomers(): Promise<void> {
    await this.navigateToSection('Relationships', 'Customers');
  }

  /**
   * Navigate to Transactions > Invoices
   */
  async goToInvoices(): Promise<void> {
    await this.navigateToSection('Transactions', 'Invoices');
  }

  /**
   * Navigate to Reports
   */
  async goToReports(): Promise<void> {
    await this.navigateToSection('Reports');
  }

  /**
   * Navigate to Chat
   */
  async goToChat(): Promise<void> {
    await this.navigateToSection('Chat');
  }

  /**
   * Verify dashboard loaded correctly
   */
  async expectDashboardLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/\/dashboard/);
    // Should have at least one KPI card
    await expect(this.kpiCards.first()).toBeVisible();
  }

  /**
   * Verify specific KPI is displayed
   */
  async expectKPIVisible(name: string): Promise<void> {
    await expect(this.page.locator(`text="${name}"`)).toBeVisible();
  }

  /**
   * Verify org context required message
   */
  async expectOrgContextRequired(): Promise<void> {
    await expect(this.orgContextMessage).toBeVisible();
  }

  /**
   * Get all sidebar navigation items
   */
  async getSidebarItems(): Promise<string[]> {
    const items = this.sidebar.locator('a, button');
    return await items.allTextContents();
  }

  /**
   * Check if sidebar section is expanded
   */
  async isSidebarSectionExpanded(sectionName: string): Promise<boolean> {
    const section = this.sidebar.locator(`text="${sectionName}"`).first();
    const expanded = await section.getAttribute('aria-expanded');
    return expanded === 'true';
  }
}
