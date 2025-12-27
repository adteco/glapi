import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Base Page Object class that all page objects extend.
 * Provides common functionality for navigation, waiting, and element interactions.
 */
export class BasePage {
  readonly page: Page;
  readonly baseURL: string;

  // Common UI elements
  readonly sidebar: Locator;
  readonly userButton: Locator;
  readonly orgSwitcher: Locator;
  readonly loadingSpinner: Locator;
  readonly toastContainer: Locator;

  constructor(page: Page) {
    this.page = page;
    this.baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

    // Initialize common locators
    this.sidebar = page.locator('[data-testid="sidebar"], aside, nav[role="navigation"]');
    this.userButton = page.locator(
      '[data-clerk-user-button], .cl-userButton-root, [aria-label*="user"]'
    );
    this.orgSwitcher = page.locator(
      '[data-clerk-organization-switcher], .cl-organizationSwitcher-root'
    );
    this.loadingSpinner = page.locator(
      '[data-testid="loading"], .loading, [role="progressbar"], .animate-spin'
    );
    this.toastContainer = page.locator('[data-sonner-toaster], [role="status"]');
  }

  /**
   * Navigate to a specific path
   */
  async goto(path: string): Promise<void> {
    await this.page.goto(path);
    await this.waitForPageLoad();
  }

  /**
   * Wait for page to finish loading
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    // Wait for any loading spinners to disappear
    if (await this.loadingSpinner.isVisible({ timeout: 1000 }).catch(() => false)) {
      await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 30000 });
    }
  }

  /**
   * Wait for a specific element to be visible
   */
  async waitForElement(locator: Locator, timeout = 10000): Promise<void> {
    await locator.waitFor({ state: 'visible', timeout });
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      return await this.userButton.isVisible({ timeout: 5000 });
    } catch {
      return false;
    }
  }

  /**
   * Verify we're on the expected URL
   */
  async expectURL(urlPattern: string | RegExp): Promise<void> {
    await expect(this.page).toHaveURL(urlPattern);
  }

  /**
   * Get current URL path
   */
  getCurrentPath(): string {
    return new URL(this.page.url()).pathname;
  }

  /**
   * Click sidebar navigation link
   */
  async navigateTo(linkText: string): Promise<void> {
    await this.sidebar.getByRole('link', { name: linkText }).click();
    await this.waitForPageLoad();
  }

  /**
   * Expand sidebar section if collapsed
   */
  async expandSidebarSection(sectionName: string): Promise<void> {
    const section = this.sidebar.locator(`text="${sectionName}"`).first();
    const isExpanded = await section.getAttribute('aria-expanded');
    if (isExpanded === 'false') {
      await section.click();
    }
  }

  /**
   * Wait for and verify toast notification
   */
  async expectToast(message: string | RegExp, type?: 'success' | 'error' | 'info'): Promise<void> {
    const toast = this.toastContainer.locator(`text=${message}`).first();
    await expect(toast).toBeVisible({ timeout: 10000 });

    if (type) {
      // Verify toast type via class or data attribute
      await expect(toast.locator('..')).toHaveAttribute('data-type', type);
    }
  }

  /**
   * Dismiss any visible toast notifications
   */
  async dismissToasts(): Promise<void> {
    const closeButtons = this.toastContainer.locator('button[aria-label*="close"], button[aria-label*="dismiss"]');
    const count = await closeButtons.count();
    for (let i = 0; i < count; i++) {
      await closeButtons.nth(i).click();
    }
  }

  /**
   * Take a screenshot with a descriptive name
   */
  async screenshot(name: string): Promise<void> {
    await this.page.screenshot({
      path: `test-results/screenshots/${name}.png`,
      fullPage: true,
    });
  }

  /**
   * Fill input field by label or placeholder
   */
  async fillField(labelOrPlaceholder: string, value: string): Promise<void> {
    const input = this.page
      .getByLabel(labelOrPlaceholder)
      .or(this.page.getByPlaceholder(labelOrPlaceholder))
      .first();
    await input.fill(value);
  }

  /**
   * Select option from dropdown by label
   */
  async selectOption(labelOrPlaceholder: string, optionText: string): Promise<void> {
    const select = this.page
      .getByLabel(labelOrPlaceholder)
      .or(this.page.locator(`select[placeholder="${labelOrPlaceholder}"]`))
      .first();

    // Check if it's a native select or custom dropdown
    const tagName = await select.evaluate((el) => el.tagName.toLowerCase());
    if (tagName === 'select') {
      await select.selectOption({ label: optionText });
    } else {
      // Custom dropdown (shadcn/radix)
      await select.click();
      await this.page.locator(`[role="option"]:has-text("${optionText}")`).click();
    }
  }

  /**
   * Click button by text
   */
  async clickButton(text: string): Promise<void> {
    await this.page.getByRole('button', { name: text }).click();
  }

  /**
   * Verify page title
   */
  async expectTitle(title: string | RegExp): Promise<void> {
    await expect(this.page).toHaveTitle(title);
  }

  /**
   * Verify heading is visible
   */
  async expectHeading(text: string, level?: 1 | 2 | 3 | 4 | 5 | 6): Promise<void> {
    const heading = level
      ? this.page.getByRole('heading', { name: text, level })
      : this.page.getByRole('heading', { name: text });
    await expect(heading).toBeVisible();
  }

  /**
   * Press keyboard shortcut
   */
  async pressKey(key: string): Promise<void> {
    await this.page.keyboard.press(key);
  }

  /**
   * Scroll to element
   */
  async scrollTo(locator: Locator): Promise<void> {
    await locator.scrollIntoViewIfNeeded();
  }

  /**
   * Get text content of element
   */
  async getText(locator: Locator): Promise<string> {
    return (await locator.textContent()) || '';
  }

  /**
   * Check if element exists (doesn't throw if not found)
   */
  async exists(locator: Locator): Promise<boolean> {
    return (await locator.count()) > 0;
  }
}
