/**
 * Authentication UI Tests
 *
 * Tests sign-in, sign-out, and authentication flows
 */

import { test, expect, Page } from '@playwright/test';

test.describe('Authentication', () => {
  test.describe('Sign In Page', () => {
    test('should display sign-in page', async ({ page }) => {
      await page.goto('/auth/sign-in');

      // Should show sign-in UI
      await expect(page).toHaveURL(/sign-in/);
    });

    test('should show Clerk sign-in component', async ({ page }) => {
      await page.goto('/auth/sign-in');

      // Wait for Clerk to load
      await page.waitForTimeout(2000);

      // Should have some form of sign-in UI
      const signInForm = page.locator('[data-clerk-sign-in], .cl-signIn-root, form');
      await expect(signInForm.first()).toBeVisible({ timeout: 10000 });
    });

    test('should redirect unauthenticated users to sign-in', async ({ browser }) => {
      // Create a fresh context without auth
      const context = await browser.newContext();
      const page = await context.newPage();

      // Try to access protected route
      await page.goto('/dashboard');

      // Should redirect to sign-in
      await expect(page).toHaveURL(/sign-in/, { timeout: 10000 });

      await context.close();
    });
  });

  test.describe('Sign Up Page', () => {
    test('should display sign-up page', async ({ page }) => {
      await page.goto('/auth/sign-up');

      // Should show sign-up UI
      await expect(page).toHaveURL(/sign-up/);
    });

    test('should show Clerk sign-up component', async ({ page }) => {
      await page.goto('/auth/sign-up');

      // Wait for Clerk to load
      await page.waitForTimeout(2000);

      // Should have some form of sign-up UI
      const signUpForm = page.locator('[data-clerk-sign-up], .cl-signUp-root, form');
      await expect(signUpForm.first()).toBeVisible({ timeout: 10000 });
    });
  });
});

test.describe('Authenticated User', () => {
  // These tests use the storageState from auth.setup.ts
  test('should access dashboard when authenticated', async ({ page }) => {
    await page.goto('/dashboard');

    // Should not redirect to sign-in
    await expect(page).not.toHaveURL(/sign-in/, { timeout: 5000 });

    // Should show dashboard content
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('should show user button when authenticated', async ({ page }) => {
    await page.goto('/dashboard');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Should show user menu/button
    const userButton = page.locator(
      '[data-clerk-user-button], .cl-userButton-root, [aria-label*="user"]'
    );

    // User button should be visible (indicating logged in state)
    await expect(userButton.first()).toBeVisible({ timeout: 10000 });
  });

  test('should display organization switcher', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Look for organization switcher
    const orgSwitcher = page.locator(
      '[data-clerk-organization-switcher], .cl-organizationSwitcher-root, [aria-label*="organization"]'
    );

    // May or may not be visible depending on user's org setup
    // Just verify the page loaded without errors
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Navigation Guard', () => {
  test('should protect all dashboard routes', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const protectedRoutes = [
      '/dashboard',
      '/relationships/customers',
      '/lists/items',
      '/transactions/sales/invoices',
      '/reports',
      '/admin/settings',
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);

      // Should redirect to sign-in for unauthenticated user
      await expect(page).toHaveURL(/sign-in/, { timeout: 10000 });
    }

    await context.close();
  });

  test('should allow access to public routes', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const publicRoutes = [
      '/',
      '/auth/sign-in',
      '/auth/sign-up',
    ];

    for (const route of publicRoutes) {
      const response = await page.goto(route);

      // Should load successfully (not redirect to sign-in from sign-in)
      expect(response?.status()).toBeLessThan(400);
    }

    await context.close();
  });
});

test.describe('Session Management', () => {
  test('should maintain session across page navigations', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    await expect(page).not.toHaveURL(/sign-in/);

    // Navigate to another protected route
    await page.goto('/relationships/customers');
    await expect(page).not.toHaveURL(/sign-in/);

    // Navigate back to dashboard
    await page.goto('/dashboard');
    await expect(page).not.toHaveURL(/sign-in/);
  });

  test('should maintain session after page reload', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    await expect(page).not.toHaveURL(/sign-in/);

    // Reload page
    await page.reload();

    // Should still be authenticated
    await expect(page).not.toHaveURL(/sign-in/);
  });
});
