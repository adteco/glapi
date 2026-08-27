/**
 * Better Auth Playwright Setup
 *
 * Authenticates via Better Auth API and saves browser storage state
 * for use by Better Auth E2E test projects.
 */
import { test as setup, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'path';

const API_URL = process.env.TEST_API_URL || 'http://localhost:3031';
const BETTER_AUTH_EMAIL = process.env.BETTER_AUTH_TEST_EMAIL || '';
const BETTER_AUTH_PASSWORD = process.env.BETTER_AUTH_TEST_PASSWORD || '';
const BETTER_AUTH_ORG_ID = process.env.BETTER_AUTH_TEST_ORG_ID || '';

export const betterAuthFile = path.join(
  __dirname,
  '../playwright/.auth/betterauth-user.json',
);

setup('authenticate with Better Auth', async ({ request, page }) => {
  setup.skip(!BETTER_AUTH_EMAIL, 'BETTER_AUTH_TEST_EMAIL not set');
  setup.skip(!BETTER_AUTH_PASSWORD, 'BETTER_AUTH_TEST_PASSWORD not set');

  // Sign in via Better Auth API
  const signInResponse = await request.post(`${API_URL}/auth/sign-in/email`, {
    data: {
      email: BETTER_AUTH_EMAIL,
      password: BETTER_AUTH_PASSWORD,
    },
    headers: { Origin: API_URL },
  });

  expect(signInResponse.status(), 'Better Auth sign-in should succeed').toBe(
    200,
  );

  // Extract session cookie
  const cookies = signInResponse.headers()['set-cookie'];
  expect(cookies, 'Sign-in should return set-cookie header').toBeTruthy();

  const sessionMatch = cookies?.match(/better-auth\.session_token=([^;]+)/);
  expect(
    sessionMatch,
    'Should get better-auth session token cookie',
  ).toBeTruthy();

  const sessionToken = sessionMatch![1];

  // Use the explicitly configured organization or the first organization
  // provisioned for this isolated test user.
  let organizationId = BETTER_AUTH_ORG_ID;
  if (!organizationId) {
    const organizationsResponse = await request.get(
      `${API_URL}/auth/organization/list`,
      {
        headers: {
          cookie: `better-auth.session_token=${sessionToken}`,
          Origin: API_URL,
        },
      },
    );
    expect(
      organizationsResponse.status(),
      'Better Auth organization list should succeed',
    ).toBe(200);

    const organizations = (await organizationsResponse.json()) as Array<{
      id?: string;
    }>;
    organizationId = organizations[0]?.id ?? '';
  }

  expect(
    organizationId,
    'Better Auth test user should belong to an organization',
  ).toBeTruthy();

  if (organizationId) {
    const setOrgResponse = await request.post(
      `${API_URL}/auth/organization/set-active`,
      {
        data: { organizationId },
        headers: {
          cookie: `better-auth.session_token=${sessionToken}`,
          Origin: API_URL,
        },
      },
    );
    expect(setOrgResponse.status(), 'Set active org should succeed').toBe(200);
  }

  // Set cookie in browser context for E2E tests
  await page.context().addCookies([
    {
      name: 'better-auth.session_token',
      value: sessionToken,
      domain: 'localhost',
      path: '/',
    },
  ]);

  // Navigate to verify session works
  await page.goto(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3030');
  await page.waitForLoadState('domcontentloaded');

  // Save storage state
  await mkdir(path.dirname(betterAuthFile), { recursive: true });
  await page.context().storageState({ path: betterAuthFile });
});
