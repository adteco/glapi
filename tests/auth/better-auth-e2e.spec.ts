/**
 * Better Auth E2E browser tests
 *
 * Tests that Better Auth authentication works end-to-end in the browser,
 * including page navigation, session persistence, and billing access.
 *
 * Requires:
 * - Web app and API server running
 * - AUTH_PROVIDER_MODE=dual or better-auth
 * - Better Auth test user provisioned
 */
import { test, expect } from '@playwright/test';

const API_URL = process.env.TEST_API_URL || 'http://localhost:3031';
const WEB_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3030';
const BETTER_AUTH_EMAIL = process.env.BETTER_AUTH_TEST_EMAIL || '';
const BETTER_AUTH_PASSWORD = process.env.BETTER_AUTH_TEST_PASSWORD || '';
const BETTER_AUTH_ORG_ID = process.env.BETTER_AUTH_TEST_ORG_ID || '';

test.describe('Better Auth E2E Browser Tests', () => {
  test.beforeEach(async () => {
    test.skip(!BETTER_AUTH_EMAIL, 'BETTER_AUTH_TEST_EMAIL not set');
  });

  test('should sign in via Better Auth API and access dashboard', async ({ page, request }) => {
    // Sign in via API to get session cookie
    const signInResponse = await request.post(`${API_URL}/api/auth/sign-in/email`, {
      data: {
        email: BETTER_AUTH_EMAIL,
        password: BETTER_AUTH_PASSWORD,
      },
    });
    expect(signInResponse.status()).toBe(200);

    // Extract session cookie
    const cookies = signInResponse.headers()['set-cookie'];
    const sessionMatch = cookies?.match(/better-auth\.session_token=([^;]+)/);
    expect(sessionMatch).toBeTruthy();

    // Set cookie in browser context
    await page.context().addCookies([{
      name: 'better-auth.session_token',
      value: sessionMatch![1],
      domain: 'localhost',
      path: '/',
    }]);

    // Set active organization
    if (BETTER_AUTH_ORG_ID) {
      await request.post(`${API_URL}/api/auth/organization/set-active`, {
        data: { organizationId: BETTER_AUTH_ORG_ID },
        headers: { cookie: `better-auth.session_token=${sessionMatch![1]}` },
      });
    }

    // Navigate to dashboard
    await page.goto(`${WEB_URL}/dashboard`);

    // Verify page loads without auth redirect
    await page.waitForLoadState('domcontentloaded');
    const url = page.url();
    expect(url).not.toContain('sign-in');
  });

  test('should not get 403 errors on network requests after Better Auth sign-in', async ({ page, request }) => {
    // Sign in via API
    const signInResponse = await request.post(`${API_URL}/api/auth/sign-in/email`, {
      data: {
        email: BETTER_AUTH_EMAIL,
        password: BETTER_AUTH_PASSWORD,
      },
    });
    expect(signInResponse.status()).toBe(200);

    const cookies = signInResponse.headers()['set-cookie'];
    const sessionMatch = cookies?.match(/better-auth\.session_token=([^;]+)/);
    expect(sessionMatch).toBeTruthy();

    await page.context().addCookies([{
      name: 'better-auth.session_token',
      value: sessionMatch![1],
      domain: 'localhost',
      path: '/',
    }]);

    if (BETTER_AUTH_ORG_ID) {
      await request.post(`${API_URL}/api/auth/organization/set-active`, {
        data: { organizationId: BETTER_AUTH_ORG_ID },
        headers: { cookie: `better-auth.session_token=${sessionMatch![1]}` },
      });
    }

    // Track 403 errors on network requests
    const forbiddenRequests: string[] = [];
    page.on('response', (response) => {
      if (response.status() === 403) {
        forbiddenRequests.push(response.url());
      }
    });

    // Navigate to dashboard
    await page.goto(`${WEB_URL}/dashboard`);
    await page.waitForLoadState('networkidle').catch(() => {
      // networkidle might timeout for tRPC polling, that's ok
    });

    // No 403 errors should have occurred
    expect(forbiddenRequests, `Got 403 on: ${forbiddenRequests.join(', ')}`).toHaveLength(0);
  });

  test('should persist session across page navigation', async ({ page, request }) => {
    // Sign in via API
    const signInResponse = await request.post(`${API_URL}/api/auth/sign-in/email`, {
      data: {
        email: BETTER_AUTH_EMAIL,
        password: BETTER_AUTH_PASSWORD,
      },
    });
    expect(signInResponse.status()).toBe(200);

    const cookies = signInResponse.headers()['set-cookie'];
    const sessionMatch = cookies?.match(/better-auth\.session_token=([^;]+)/);

    await page.context().addCookies([{
      name: 'better-auth.session_token',
      value: sessionMatch![1],
      domain: 'localhost',
      path: '/',
    }]);

    if (BETTER_AUTH_ORG_ID) {
      await request.post(`${API_URL}/api/auth/organization/set-active`, {
        data: { organizationId: BETTER_AUTH_ORG_ID },
        headers: { cookie: `better-auth.session_token=${sessionMatch![1]}` },
      });
    }

    // Navigate to multiple pages - track auth failures
    const authFailures: string[] = [];
    page.on('response', (response) => {
      if (response.status() === 401 || response.status() === 403) {
        authFailures.push(`${response.status()} ${response.url()}`);
      }
    });

    const pages = ['/dashboard', '/customers', '/accounts'];
    for (const pagePath of pages) {
      await page.goto(`${WEB_URL}${pagePath}`);
      await page.waitForLoadState('domcontentloaded');
    }

    expect(authFailures, `Auth failures during navigation: ${authFailures.join(', ')}`).toHaveLength(0);
  });
});
