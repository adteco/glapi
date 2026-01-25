import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

/**
 * Check if existing auth state is still valid
 * Returns true if we can reuse the cached auth, false if we need to re-authenticate
 */
function isAuthValid(): boolean {
  if (!fs.existsSync(authFile)) {
    console.log('Auth cache: No existing auth file found');
    return false;
  }

  try {
    const data = JSON.parse(fs.readFileSync(authFile, 'utf-8'));

    // Check for Clerk session cookies
    const sessionCookie = data.cookies?.find((c: { name: string; expires: number }) =>
      c.name.includes('__session') || c.name.includes('__clerk')
    );

    if (!sessionCookie) {
      console.log('Auth cache: No session cookie found in cached state');
      return false;
    }

    // Check if cookie expires in more than 5 minutes (300 seconds buffer)
    const nowInSeconds = Date.now() / 1000;
    const expiresInSeconds = sessionCookie.expires;
    const bufferSeconds = 300;

    if (expiresInSeconds <= nowInSeconds + bufferSeconds) {
      console.log('Auth cache: Session cookie expired or expiring soon');
      return false;
    }

    console.log('Auth cache: Valid session found, reusing cached auth');
    return true;
  } catch (error) {
    console.log('Auth cache: Failed to parse auth file:', error);
    return false;
  }
}

/**
 * Ensure auth directory exists
 */
function ensureAuthDir(): void {
  const authDir = path.dirname(authFile);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }
}

/**
 * Authentication setup for Playwright E2E tests using Clerk Testing Tokens
 *
 * This setup uses Clerk's testing package to bypass normal auth flow.
 * Required environment variables:
 * - CLERK_PUBLISHABLE_KEY: From Clerk Dashboard
 * - CLERK_SECRET_KEY: From Clerk Dashboard (keep secret!)
 * - TEST_USER_EMAIL: Test user's email address
 * - TEST_USER_PASSWORD: Test user's password
 *
 * @see https://clerk.com/docs/guides/development/testing/playwright/overview
 */
setup('authenticate with Clerk', async ({ page }) => {
  // Check if we can reuse existing auth
  if (isAuthValid()) {
    console.log('Skipping authentication - reusing valid cached session');
    return;
  }

  ensureAuthDir();

  // Setup Clerk testing token - this bypasses bot detection and enables test auth
  await setupClerkTestingToken({ page });

  // Navigate to sign-in page (correct route - not /auth/sign-in)
  await page.goto('/sign-in');

  // Wait for Clerk sign-in form to load
  await page.waitForSelector('[name="identifier"], input[type="email"]', {
    timeout: 15000,
  });

  // Get test credentials from environment
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  if (!email || !password) {
    console.warn(
      'WARNING: TEST_USER_EMAIL and TEST_USER_PASSWORD environment variables are not set.\n' +
        'Skipping password auth. Tests requiring auth may fail.\n' +
        'See .env.test.example for required variables.'
    );
    // Save empty auth state to prevent retries
    await page.context().storageState({ path: authFile });
    return;
  }

  console.log('Authenticating test user:', email);

  // Enter email address
  const emailInput = page.locator('[name="identifier"], input[type="email"]').first();
  await emailInput.fill(email);

  // Click continue
  const continueButton = page.locator(
    'button:has-text("Continue"), button:has-text("Sign in"), button[type="submit"]'
  ).first();
  await continueButton.click();

  // Wait for password field
  await page.waitForSelector('[name="password"], input[type="password"]', {
    timeout: 10000,
  });

  // Enter password
  const passwordInput = page.locator('[name="password"], input[type="password"]').first();
  await passwordInput.fill(password);

  // Submit
  const signInButton = page.locator(
    'button:has-text("Sign in"), button:has-text("Continue"), button[type="submit"]'
  ).first();
  await signInButton.click();

  // Wait for redirect to authenticated page (dashboard, home, or lists)
  await page.waitForURL(/\/(dashboard|home|lists)?$/, { timeout: 20000 });

  // Verify logged in by checking for user button
  await expect(
    page.locator('[data-clerk-user-button], [aria-label*="user"], .cl-userButton-root')
  ).toBeVisible({ timeout: 10000 });

  // Save state
  await page.context().storageState({ path: authFile });
  console.log('Authentication successful. State saved to:', authFile);
});
