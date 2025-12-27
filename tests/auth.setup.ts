import { test as setup, expect } from '@playwright/test';
import * as path from 'path';

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

/**
 * Authentication setup for Playwright E2E tests
 *
 * This setup file handles Clerk authentication and saves the session state
 * for reuse across all authenticated test suites.
 *
 * Required environment variables:
 * - TEST_USER_EMAIL: Test user email address
 * - TEST_USER_PASSWORD: Test user password
 *
 * @see https://playwright.dev/docs/auth
 */
setup('authenticate', async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  if (!email || !password) {
    console.warn(
      'WARNING: TEST_USER_EMAIL and TEST_USER_PASSWORD environment variables are not set.\n' +
        'Skipping authentication setup. Tests requiring auth will fail.\n' +
        'See .env.test.example for required variables.'
    );
    // Create empty auth state to prevent file not found errors
    await page.context().storageState({ path: authFile });
    return;
  }

  // Navigate to sign-in page
  await page.goto('/auth/sign-in');

  // Wait for Clerk sign-in form to load
  // Clerk uses specific input names/identifiers
  await page.waitForSelector('[name="identifier"], input[type="email"]', {
    timeout: 10000,
  });

  // Enter email address
  // Clerk might show email first, then password
  const emailInput = page.locator('[name="identifier"], input[type="email"]').first();
  await emailInput.fill(email);

  // Look for continue/next button or direct sign-in
  const continueButton = page.locator(
    'button:has-text("Continue"), button:has-text("Sign in"), button[type="submit"]'
  ).first();
  await continueButton.click();

  // Wait for password field (Clerk shows this after email verification)
  await page.waitForSelector('[name="password"], input[type="password"]', {
    timeout: 10000,
  });

  // Enter password
  const passwordInput = page.locator('[name="password"], input[type="password"]').first();
  await passwordInput.fill(password);

  // Submit sign-in form
  const signInButton = page.locator(
    'button:has-text("Sign in"), button:has-text("Continue"), button[type="submit"]'
  ).first();
  await signInButton.click();

  // Wait for successful authentication
  // This should redirect to dashboard or home page
  await page.waitForURL(/\/(dashboard|home)?$/, { timeout: 15000 });

  // Verify we're logged in by checking for user-specific elements
  // Clerk typically shows a UserButton when authenticated
  await expect(
    page.locator('[data-clerk-user-button], [aria-label*="user"], .cl-userButton-root')
  ).toBeVisible({ timeout: 10000 });

  // Save signed-in state to file
  await page.context().storageState({ path: authFile });

  console.log('Authentication successful. State saved to:', authFile);
});

/**
 * Optional: Organization selection setup
 * Uncomment if your app requires organization context
 */
// setup('select organization', async ({ page }) => {
//   const orgId = process.env.CLERK_TEST_ORG_ID;
//
//   if (!orgId) {
//     console.log('No CLERK_TEST_ORG_ID set, skipping org selection');
//     return;
//   }
//
//   await page.goto('/dashboard');
//
//   // Click organization switcher
//   const orgSwitcher = page.locator('[data-clerk-organization-switcher]');
//   if (await orgSwitcher.isVisible()) {
//     await orgSwitcher.click();
//     // Select the test organization
//     await page.locator(`[data-org-id="${orgId}"]`).click();
//     await page.waitForLoadState('networkidle');
//   }
//
//   // Save updated state
//   await page.context().storageState({ path: authFile });
// });
