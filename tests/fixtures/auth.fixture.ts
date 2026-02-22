import { test as base, expect, type Page, type BrowserContext } from '@playwright/test';
import * as path from 'path';
import { waitForPageReady } from '../utils/test-helpers';

const STORAGE_STATE = path.join(__dirname, '../../playwright/.auth/user.json');

/**
 * Extended test fixtures for authentication scenarios
 */
export type AuthFixtures = {
  /** Authenticated page with logged-in user */
  authenticatedPage: Page;
  /** Unauthenticated page (fresh browser context) */
  unauthenticatedPage: Page;
  /** Browser context with authentication */
  authenticatedContext: BrowserContext;
};

/**
 * Test fixture that provides both authenticated and unauthenticated page instances.
 * Use this for tests that need to verify both states.
 */
export const test = base.extend<AuthFixtures>({
  // Authenticated page fixture - uses stored auth state
  authenticatedPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: STORAGE_STATE,
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  // Unauthenticated page fixture - clean browser state
  unauthenticatedPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  // Authenticated context fixture - for tests needing multiple pages
  authenticatedContext: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: STORAGE_STATE,
    });
    await use(context);
    await context.close();
  },
});

export { expect };

/**
 * Helper to check if user is authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    // Check for Clerk user button or other auth indicators
    const userButton = page.locator(
      '[data-clerk-user-button], .cl-userButton-root, [aria-label*="user menu"]'
    );
    return await userButton.isVisible({ timeout: 5000 });
  } catch {
    return false;
  }
}

/**
 * Helper to sign out the current user
 */
export async function signOut(page: Page): Promise<void> {
  // Click user button to open menu
  const userButton = page.locator(
    '[data-clerk-user-button], .cl-userButton-root, [aria-label*="user menu"]'
  ).first();
  await userButton.click();

  // Click sign out option
  const signOutButton = page.locator(
    'button:has-text("Sign out"), [data-clerk-sign-out]'
  ).first();
  await signOutButton.click();

  // Wait for redirect to sign-in or home
  await page.waitForURL(/\/(auth\/sign-in|sign-in)?$/, { timeout: 10000 });
}

/**
 * Helper to navigate to dashboard and verify auth
 */
export async function goToDashboard(page: Page): Promise<void> {
  await page.goto('/dashboard');
  // Should not redirect to sign-in if authenticated
  await expect(page).not.toHaveURL(/sign-in/);
}

/**
 * Helper to switch organization (if using Clerk organizations)
 */
export async function switchOrganization(page: Page, orgName: string): Promise<void> {
  const orgSwitcher = page.locator(
    '[data-clerk-organization-switcher], .cl-organizationSwitcher-root'
  ).first();

  if (await orgSwitcher.isVisible()) {
    await orgSwitcher.click();
    await page.locator(`text="${orgName}"`).click();
    await waitForPageReady(page);
  }
}

/**
 * Test annotation helpers
 */
export const authTest = {
  /**
   * Mark test as requiring authentication
   */
  requiresAuth: test,

  /**
   * Mark test as not requiring authentication (public routes)
   */
  noAuth: base,
};
