/**
 * Custom Test Assertions for E2E Testing
 *
 * Provides reusable assertion helpers for common test patterns
 */

import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Toast notification assertions
 */
export const toastAssertions = {
  /**
   * Assert a success toast appears with the given message
   */
  async expectSuccess(page: Page, message: string | RegExp): Promise<void> {
    const toast = page.locator('[data-sonner-toaster] [data-type="success"], [role="status"]')
      .filter({ hasText: message });
    await expect(toast).toBeVisible({ timeout: 10000 });
  },

  /**
   * Assert an error toast appears with the given message
   */
  async expectError(page: Page, message: string | RegExp): Promise<void> {
    const toast = page.locator('[data-sonner-toaster] [data-type="error"], [role="alert"]')
      .filter({ hasText: message });
    await expect(toast).toBeVisible({ timeout: 10000 });
  },

  /**
   * Assert a toast appears with the given message (any type)
   */
  async expectMessage(page: Page, message: string | RegExp): Promise<void> {
    const toast = page.locator('[data-sonner-toaster], [role="status"], [role="alert"]')
      .filter({ hasText: message });
    await expect(toast).toBeVisible({ timeout: 10000 });
  },

  /**
   * Wait for toast to disappear
   */
  async waitForDismiss(page: Page, message: string | RegExp): Promise<void> {
    const toast = page.locator('[data-sonner-toaster]')
      .filter({ hasText: message });
    await expect(toast).toBeHidden({ timeout: 15000 });
  },
};

/**
 * Form validation assertions
 */
export const formAssertions = {
  /**
   * Assert a field shows a validation error
   */
  async expectFieldError(page: Page, fieldLabel: string, errorMessage?: string | RegExp): Promise<void> {
    const field = page.getByLabel(fieldLabel);
    await expect(field).toHaveAttribute('aria-invalid', 'true');

    if (errorMessage) {
      const errorEl = page.locator(`[id="${await field.getAttribute('aria-describedby')}"]`)
        .or(field.locator('..').locator('[role="alert"]'))
        .filter({ hasText: errorMessage });
      await expect(errorEl).toBeVisible();
    }
  },

  /**
   * Assert a field has no validation error
   */
  async expectFieldValid(page: Page, fieldLabel: string): Promise<void> {
    const field = page.getByLabel(fieldLabel);
    const ariaInvalid = await field.getAttribute('aria-invalid');
    expect(ariaInvalid).not.toBe('true');
  },

  /**
   * Assert form cannot be submitted (button disabled)
   */
  async expectSubmitDisabled(page: Page, buttonText = 'Submit'): Promise<void> {
    const button = page.getByRole('button', { name: buttonText });
    await expect(button).toBeDisabled();
  },

  /**
   * Assert form can be submitted (button enabled)
   */
  async expectSubmitEnabled(page: Page, buttonText = 'Submit'): Promise<void> {
    const button = page.getByRole('button', { name: buttonText });
    await expect(button).toBeEnabled();
  },
};

/**
 * Table/List assertions
 */
export const tableAssertions = {
  /**
   * Assert table has exactly N rows
   */
  async expectRowCount(page: Page, count: number, tableSelector = 'table'): Promise<void> {
    const table = page.locator(tableSelector);
    const rows = table.locator('tbody tr');
    await expect(rows).toHaveCount(count);
  },

  /**
   * Assert table has at least N rows
   */
  async expectMinRowCount(page: Page, minCount: number, tableSelector = 'table'): Promise<void> {
    const table = page.locator(tableSelector);
    const rows = table.locator('tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(minCount);
  },

  /**
   * Assert table contains row with text
   */
  async expectRowWithText(page: Page, text: string | RegExp, tableSelector = 'table'): Promise<void> {
    const table = page.locator(tableSelector);
    const row = table.locator('tbody tr').filter({ hasText: text });
    await expect(row.first()).toBeVisible();
  },

  /**
   * Assert table does not contain row with text
   */
  async expectNoRowWithText(page: Page, text: string | RegExp, tableSelector = 'table'): Promise<void> {
    const table = page.locator(tableSelector);
    const row = table.locator('tbody tr').filter({ hasText: text });
    await expect(row).toHaveCount(0);
  },

  /**
   * Assert empty state is shown
   */
  async expectEmpty(page: Page): Promise<void> {
    const emptyState = page.locator('[data-testid="empty-state"], .empty-state')
      .or(page.getByText(/no results|no items|no data/i));
    await expect(emptyState.first()).toBeVisible();
  },

  /**
   * Assert loading state is shown
   */
  async expectLoading(page: Page): Promise<void> {
    const loading = page.locator('[data-testid="loading"], .loading, [role="progressbar"]')
      .or(page.locator('.animate-spin'));
    await expect(loading.first()).toBeVisible();
  },

  /**
   * Assert loading state is not shown
   */
  async expectNotLoading(page: Page): Promise<void> {
    const loading = page.locator('[data-testid="loading"], [role="progressbar"]')
      .or(page.locator('.animate-spin'));
    await expect(loading).toBeHidden({ timeout: 30000 });
  },
};

/**
 * Dialog/Modal assertions
 */
export const dialogAssertions = {
  /**
   * Assert dialog is open with title
   */
  async expectOpen(page: Page, title: string | RegExp): Promise<void> {
    const dialog = page.locator('[role="dialog"], [data-radix-dialog-content]');
    await expect(dialog).toBeVisible();
    const heading = dialog.getByRole('heading').filter({ hasText: title });
    await expect(heading).toBeVisible();
  },

  /**
   * Assert dialog is closed
   */
  async expectClosed(page: Page): Promise<void> {
    const dialog = page.locator('[role="dialog"], [data-radix-dialog-content]');
    await expect(dialog).toBeHidden();
  },

  /**
   * Assert confirmation dialog is shown
   */
  async expectConfirmation(page: Page, message?: string | RegExp): Promise<void> {
    const dialog = page.locator('[role="alertdialog"], [role="dialog"]')
      .filter({ has: page.locator('button:has-text("Confirm"), button:has-text("Delete"), button:has-text("Yes")') });
    await expect(dialog).toBeVisible();

    if (message) {
      await expect(dialog).toContainText(message);
    }
  },
};

/**
 * Navigation assertions
 */
export const navigationAssertions = {
  /**
   * Assert current URL matches pattern
   */
  async expectURL(page: Page, pattern: string | RegExp): Promise<void> {
    await expect(page).toHaveURL(pattern);
  },

  /**
   * Assert page title matches
   */
  async expectTitle(page: Page, title: string | RegExp): Promise<void> {
    await expect(page).toHaveTitle(title);
  },

  /**
   * Assert heading is visible
   */
  async expectHeading(page: Page, text: string | RegExp, level?: 1 | 2 | 3 | 4 | 5 | 6): Promise<void> {
    const heading = level
      ? page.getByRole('heading', { name: text, level })
      : page.getByRole('heading', { name: text });
    await expect(heading.first()).toBeVisible();
  },

  /**
   * Assert breadcrumb contains text
   */
  async expectBreadcrumb(page: Page, text: string): Promise<void> {
    const breadcrumb = page.locator('nav[aria-label="breadcrumb"], [data-testid="breadcrumb"]');
    await expect(breadcrumb).toContainText(text);
  },
};

/**
 * Authentication assertions
 */
export const authAssertions = {
  /**
   * Assert user is authenticated (user button visible)
   */
  async expectAuthenticated(page: Page): Promise<void> {
    const userButton = page.locator(
      '[data-clerk-user-button], .cl-userButton-root, [aria-label*="user"]'
    );
    await expect(userButton).toBeVisible({ timeout: 10000 });
  },

  /**
   * Assert user is not authenticated (sign in button visible)
   */
  async expectNotAuthenticated(page: Page): Promise<void> {
    const signInButton = page.getByRole('link', { name: /sign in/i })
      .or(page.getByRole('button', { name: /sign in/i }));
    await expect(signInButton).toBeVisible({ timeout: 10000 });
  },

  /**
   * Assert on sign-in page
   */
  async expectSignInPage(page: Page): Promise<void> {
    await expect(page).toHaveURL(/\/sign-in/);
    const signInForm = page.locator('form').filter({
      has: page.locator('[name="identifier"], input[type="email"]'),
    });
    await expect(signInForm).toBeVisible();
  },
};

/**
 * API response assertions (for API tests)
 */
export const apiAssertions = {
  /**
   * Assert successful response
   */
  expectSuccess(response: { ok: boolean; status: number }): void {
    expect(response.ok).toBe(true);
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(300);
  },

  /**
   * Assert specific status code
   */
  expectStatus(response: { status: number }, expected: number): void {
    expect(response.status).toBe(expected);
  },

  /**
   * Assert created (201)
   */
  expectCreated(response: { status: number }): void {
    expect(response.status).toBe(201);
  },

  /**
   * Assert no content (204)
   */
  expectNoContent(response: { status: number }): void {
    expect(response.status).toBe(204);
  },

  /**
   * Assert bad request (400)
   */
  expectBadRequest(response: { status: number }): void {
    expect(response.status).toBe(400);
  },

  /**
   * Assert unauthorized (401)
   */
  expectUnauthorized(response: { status: number }): void {
    expect(response.status).toBe(401);
  },

  /**
   * Assert forbidden (403)
   */
  expectForbidden(response: { status: number }): void {
    expect(response.status).toBe(403);
  },

  /**
   * Assert not found (404)
   */
  expectNotFound(response: { status: number }): void {
    expect(response.status).toBe(404);
  },

  /**
   * Assert response contains expected fields
   */
  expectFields<T extends object>(data: T, fields: (keyof T)[]): void {
    for (const field of fields) {
      expect(data).toHaveProperty(field as string);
    }
  },

  /**
   * Assert array response has expected length
   */
  expectArrayLength(data: unknown[], expected: number): void {
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(expected);
  },

  /**
   * Assert array response has at least N items
   */
  expectMinLength(data: unknown[], minLength: number): void {
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(minLength);
  },
};

/**
 * Accessibility assertions
 */
export const a11yAssertions = {
  /**
   * Assert element has accessible name
   */
  async expectAccessibleName(locator: Locator, name: string): Promise<void> {
    await expect(locator).toHaveAccessibleName(name);
  },

  /**
   * Assert element has accessible description
   */
  async expectAccessibleDescription(locator: Locator, description: string): Promise<void> {
    await expect(locator).toHaveAccessibleDescription(description);
  },

  /**
   * Assert element is focusable
   */
  async expectFocusable(locator: Locator): Promise<void> {
    await locator.focus();
    await expect(locator).toBeFocused();
  },

  /**
   * Assert no accessibility violations (basic check)
   */
  async expectNoBasicViolations(page: Page): Promise<void> {
    // Check for images without alt text
    const imagesWithoutAlt = await page.locator('img:not([alt])').count();
    expect(imagesWithoutAlt).toBe(0);

    // Check for buttons without accessible text
    const buttonsWithoutText = await page.locator('button:not(:has-text(*)):not([aria-label])').count();
    expect(buttonsWithoutText).toBe(0);

    // Check for inputs without labels
    const inputsWithoutLabel = await page.locator('input:not([aria-label]):not([id])').count();
    expect(inputsWithoutLabel).toBe(0);
  },
};
