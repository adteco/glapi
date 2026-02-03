import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Test helper utilities for Playwright E2E tests
 */

/**
 * Wait for network to be idle
 * @deprecated Use waitForPageReady instead - networkidle never resolves with persistent tRPC connections
 */
export async function waitForNetworkIdle(page: Page, timeout = 10000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Wait for page to be ready for interaction.
 *
 * Unlike waitForNetworkIdle, this doesn't wait for all network activity to stop
 * (which never happens with tRPC/React Query persistent connections). Instead it:
 * 1. Waits for DOM to be loaded
 * 2. Waits briefly for React hydration
 * 3. Waits for loading indicators to disappear
 *
 * @param page - Playwright page object
 * @param options - Optional configuration
 */
export async function waitForPageReady(
  page: Page,
  options?: { timeout?: number; hydrationDelay?: number }
): Promise<void> {
  const { timeout = 30000, hydrationDelay = 500 } = options || {};

  // Wait for DOM content to be loaded
  await page.waitForLoadState('domcontentloaded', { timeout });

  // Brief wait for React hydration
  await page.waitForTimeout(hydrationDelay);

  // Wait for common loading indicators to disappear
  const loadingSpinner = page.locator(
    '[data-testid="loading"], .loading, [role="progressbar"], .animate-spin'
  );
  if (await loadingSpinner.isVisible({ timeout: 2000 }).catch(() => false)) {
    await loadingSpinner.waitFor({ state: 'hidden', timeout });
  }

  // Wait for "Loading..." text patterns to disappear
  const loadingText = page.locator('text=/Loading\\.\\.\\.|Loading [a-z]+\\.\\.\\./i');
  if (await loadingText.isVisible({ timeout: 1000 }).catch(() => false)) {
    await loadingText.waitFor({ state: 'hidden', timeout });
  }
}

/**
 * Wait for API response
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  options?: { timeout?: number; status?: number }
): Promise<void> {
  const { timeout = 10000, status = 200 } = options || {};
  await page.waitForResponse(
    (response) => {
      const matches =
        typeof urlPattern === 'string'
          ? response.url().includes(urlPattern)
          : urlPattern.test(response.url());
      return matches && response.status() === status;
    },
    { timeout }
  );
}

/**
 * Generate random string for test data
 */
export function randomString(length = 8): string {
  return Math.random().toString(36).substring(2, 2 + length);
}

/**
 * Generate random email
 */
export function randomEmail(domain = 'test.example.com'): string {
  return `test-${randomString()}@${domain}`;
}

/**
 * Generate random phone number
 */
export function randomPhone(): string {
  return `555-${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

/**
 * Generate unique ID for test data
 */
export function uniqueId(prefix = 'test'): string {
  return `${prefix}-${Date.now()}-${randomString(4)}`;
}

/**
 * Format date for input fields
 */
export function formatDate(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format currency for display comparison
 */
export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Wait for element to be visible and stable
 */
export async function waitForStableElement(locator: Locator, timeout = 10000): Promise<void> {
  await locator.waitFor({ state: 'visible', timeout });
  // Wait for any animations to complete
  await locator.page().waitForTimeout(100);
}

/**
 * Retry action with exponential backoff
 */
export async function retryAction<T>(
  action: () => Promise<T>,
  options?: { maxRetries?: number; initialDelay?: number }
): Promise<T> {
  const { maxRetries = 3, initialDelay = 100 } = options || {};
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await action();
    } catch (error) {
      lastError = error as Error;
      const delay = initialDelay * Math.pow(2, i);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Screenshot helper with timestamp
 */
export async function takeScreenshot(
  page: Page,
  name: string,
  options?: { fullPage?: boolean }
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `test-results/screenshots/${name}-${timestamp}.png`;
  await page.screenshot({
    path: filename,
    fullPage: options?.fullPage ?? true,
  });
  return filename;
}

/**
 * Log test step for better debugging
 */
export function logStep(step: string): void {
  console.log(`[TEST STEP] ${step}`);
}

/**
 * Wait for toast notification
 */
export async function waitForToast(
  page: Page,
  message?: string | RegExp,
  timeout = 10000
): Promise<Locator> {
  const toastContainer = page.locator('[data-sonner-toaster], [role="status"]');
  await toastContainer.waitFor({ state: 'visible', timeout });

  if (message) {
    const toast = toastContainer.locator(`text=${message}`).first();
    await toast.waitFor({ state: 'visible', timeout });
    return toast;
  }

  return toastContainer;
}

/**
 * Dismiss all toasts
 */
export async function dismissAllToasts(page: Page): Promise<void> {
  const closeButtons = page.locator('[data-sonner-toaster] button[aria-label*="close"]');
  const count = await closeButtons.count();
  for (let i = 0; i < count; i++) {
    await closeButtons.nth(0).click().catch(() => {
      // Toast might have auto-dismissed
    });
  }
}

/**
 * Scroll to bottom of page
 */
export async function scrollToBottom(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
}

/**
 * Scroll to top of page
 */
export async function scrollToTop(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
}

/**
 * Check if element is in viewport
 */
export async function isInViewport(locator: Locator): Promise<boolean> {
  return await locator.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.right <= window.innerWidth
    );
  });
}

/**
 * Wait for navigation to complete
 */
export async function waitForNavigation(page: Page, urlPattern: string | RegExp): Promise<void> {
  await page.waitForURL(urlPattern, { timeout: 15000 });
}

/**
 * Get all table data as array of objects
 */
export async function getTableData(page: Page, tableLocator: Locator): Promise<Record<string, string>[]> {
  const headers = await tableLocator.locator('thead th').allTextContents();
  const rows = await tableLocator.locator('tbody tr').all();

  const data: Record<string, string>[] = [];
  for (const row of rows) {
    const cells = await row.locator('td').allTextContents();
    const rowData: Record<string, string> = {};
    headers.forEach((header, index) => {
      rowData[header.trim()] = cells[index]?.trim() || '';
    });
    data.push(rowData);
  }

  return data;
}

/**
 * Assert visible text on page
 */
export async function assertTextVisible(page: Page, text: string | RegExp): Promise<void> {
  await expect(page.locator(`text=${text}`).first()).toBeVisible();
}

/**
 * Assert text not visible on page
 */
export async function assertTextNotVisible(page: Page, text: string | RegExp): Promise<void> {
  await expect(page.locator(`text=${text}`)).not.toBeVisible();
}

/**
 * Wait for element count
 */
export async function waitForCount(locator: Locator, count: number, timeout = 10000): Promise<void> {
  await expect(locator).toHaveCount(count, { timeout });
}

/**
 * Get computed style of element
 */
export async function getComputedStyle(
  locator: Locator,
  property: string
): Promise<string> {
  return await locator.evaluate(
    (el, prop) => window.getComputedStyle(el).getPropertyValue(prop),
    property
  );
}
