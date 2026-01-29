import { clerk } from '@clerk/testing/playwright';
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

  ensureAuthDir();

  // Quick validation of cached auth by hitting a protected route.
  if (isAuthValid()) {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    const redirectedToSignIn = /sign-in/.test(page.url());
    if (!redirectedToSignIn) {
      console.log('Skipping authentication - reusing valid cached session');
      return;
    }
  }

  console.log('Authenticating test user via Clerk test helpers:', email);

  // Navigate to an unprotected page that loads Clerk
  await page.goto('/sign-in');

  await clerk.signIn({
    page,
    signInParams: {
      strategy: 'password',
      identifier: email,
      password,
    },
  });

  // Navigate to a protected page to verify auth
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page).not.toHaveURL(/sign-in/);

  // Verify logged in by checking for user button
  const userButton = page.locator(
    '[data-clerk-user-button], [aria-label*="user"], .cl-userButton-root'
  ).first();
  await expect(userButton).toBeVisible({ timeout: 10000 });

  // Save state
  await page.context().storageState({ path: authFile });
  console.log('Authentication successful. State saved to:', authFile);
});
