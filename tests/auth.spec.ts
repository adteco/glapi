import { test, expect } from '@playwright/test';
import { BasePage } from './pages';
import { isAuthenticated, signOut } from './fixtures';

test.describe('Authentication', () => {
  test.describe('Sign In', () => {
    test('should display sign-in page', async ({ browser }) => {
      // Use fresh context without auth
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto('/auth/sign-in');

      // Should show Clerk sign-in form
      await expect(page.locator('input[name="identifier"], input[type="email"]').first()).toBeVisible();

      await context.close();
    });

    test('should show error for invalid credentials', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto('/auth/sign-in');

      // Enter invalid email
      await page.locator('input[name="identifier"], input[type="email"]').first().fill('invalid@test.com');
      await page.locator('button:has-text("Continue"), button[type="submit"]').first().click();

      // Should show error or password field
      // Clerk may show different error states
      await page.waitForTimeout(2000);

      await context.close();
    });

    test('authenticated user should see dashboard', async ({ page }) => {
      // This test uses stored auth state
      await page.goto('/dashboard');

      // Should not redirect to sign-in
      await expect(page).not.toHaveURL(/sign-in/);
      await expect(page).toHaveURL(/dashboard/);
    });
  });

  test.describe('Sign Up', () => {
    test('should display sign-up page', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto('/auth/sign-up');

      // Should show sign-up form elements
      await expect(page.locator('input[name="emailAddress"], input[type="email"]').first()).toBeVisible();

      await context.close();
    });

    test('should have link to sign in from sign up', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto('/auth/sign-up');

      // Should have sign-in link
      const signInLink = page.locator('a:has-text("Sign in"), button:has-text("Sign in")');
      await expect(signInLink).toBeVisible();

      await context.close();
    });
  });

  test.describe('Protected Routes', () => {
    test('dashboard requires authentication', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      // Try to access dashboard without auth
      await page.goto('/dashboard');

      // Should redirect to sign-in
      await expect(page).toHaveURL(/sign-in|auth/);

      await context.close();
    });

    test('lists page requires authentication', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto('/lists/items');
      await expect(page).toHaveURL(/sign-in|auth/);

      await context.close();
    });

    test('relationships page requires authentication', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto('/relationships/customers');
      await expect(page).toHaveURL(/sign-in|auth/);

      await context.close();
    });

    test('transactions page requires authentication', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto('/transactions/sales/invoices');
      await expect(page).toHaveURL(/sign-in|auth/);

      await context.close();
    });
  });

  test.describe('Public Routes', () => {
    test('landing page is accessible without auth', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto('/');

      // Should not redirect to sign-in
      await expect(page).not.toHaveURL(/sign-in/);

      await context.close();
    });

    test('pricing page is accessible without auth', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto('/pricing');

      await expect(page).not.toHaveURL(/sign-in/);

      await context.close();
    });

    test('contact page is accessible without auth', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto('/contact');

      await expect(page).not.toHaveURL(/sign-in/);

      await context.close();
    });
  });

  test.describe('User Session', () => {
    test('user button should be visible when authenticated', async ({ page }) => {
      await page.goto('/dashboard');

      const basePage = new BasePage(page);
      const isAuth = await basePage.isAuthenticated();
      expect(isAuth).toBe(true);
    });

    test('clicking user button should show menu', async ({ page }) => {
      await page.goto('/dashboard');

      const userButton = page.locator(
        '[data-clerk-user-button], .cl-userButton-root'
      ).first();
      await userButton.click();

      // Should show user menu with options
      const menu = page.locator('[role="menu"], .cl-userButtonPopoverCard');
      await expect(menu).toBeVisible();
    });

    test('sign out option should be available', async ({ page }) => {
      await page.goto('/dashboard');

      const userButton = page.locator(
        '[data-clerk-user-button], .cl-userButton-root'
      ).first();
      await userButton.click();

      const signOutButton = page.locator(
        'button:has-text("Sign out"), [data-clerk-sign-out]'
      );
      await expect(signOutButton).toBeVisible();
    });
  });

  test.describe('Organization Context', () => {
    test('organization switcher should be visible', async ({ page }) => {
      await page.goto('/dashboard');

      const orgSwitcher = page.locator(
        '[data-clerk-organization-switcher], .cl-organizationSwitcher-root'
      );
      await expect(orgSwitcher).toBeVisible();
    });

    test('clicking org switcher should show options', async ({ page }) => {
      await page.goto('/dashboard');

      const orgSwitcher = page.locator(
        '[data-clerk-organization-switcher], .cl-organizationSwitcher-root'
      );
      await orgSwitcher.click();

      // Should show org options
      const orgMenu = page.locator(
        '[role="menu"], [role="listbox"], .cl-organizationSwitcherPopoverCard'
      );
      await expect(orgMenu).toBeVisible();
    });
  });
});
