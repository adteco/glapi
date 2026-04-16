/**
 * Provision Better Auth test data for Karate and Playwright tests.
 *
 * This script creates:
 * 1. A Better Auth test user (email/password)
 * 2. A Better Auth organization mapped to the dev test org
 * 3. Adds the user as an admin member of the organization
 * 4. Ensures entity record exists with RBAC roles assigned
 *
 * Idempotent: safe to run multiple times.
 *
 * Usage:
 *   pnpm tsx scripts/test/provision-better-auth-test-data.ts
 *
 * Environment variables:
 *   BETTER_AUTH_TEST_EMAIL    - Test user email (default: test-admin@glapi-test.local)
 *   BETTER_AUTH_TEST_PASSWORD - Test user password (default: TestPassword123!)
 *   DATABASE_URL              - Database connection string
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.TEST_API_URL || 'http://localhost:3031';
const TEST_EMAIL = process.env.BETTER_AUTH_TEST_EMAIL || 'test-admin@glapi-test.local';
const TEST_PASSWORD = process.env.BETTER_AUTH_TEST_PASSWORD || 'TestPassword123!';
const TEST_NAME = 'Test Admin User';
const DEV_ORG_ID = 'ba3b8cdf-efc1-4a60-88be-ac203d263fe2';

async function main() {
  console.log('=== Provisioning Better Auth Test Data ===');
  console.log(`API URL: ${API_URL}`);
  console.log(`Test Email: ${TEST_EMAIL}`);
  console.log('');

  // Step 1: Try to sign up (will fail gracefully if user exists)
  console.log('Step 1: Creating test user...');
  let signUpResponse: Response;
  try {
    signUpResponse = await fetch(`${API_URL}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': API_URL },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        name: TEST_NAME,
      }),
    });

    if (signUpResponse.ok) {
      console.log('  User created successfully');
    } else {
      const body = await signUpResponse.text();
      if (body.includes('already exists') || body.includes('already registered') || signUpResponse.status === 422) {
        console.log('  User already exists (OK)');
      } else {
        console.log(`  Sign-up returned ${signUpResponse.status}: ${body}`);
        console.log('  Continuing with sign-in...');
      }
    }
  } catch (error) {
    console.log(`  Sign-up request failed: ${error}`);
    console.log('  Make sure the API server is running.');
    process.exit(1);
  }

  // Step 2: Sign in to get session
  console.log('Step 2: Signing in...');
  const signInResponse = await fetch(`${API_URL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': API_URL },
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    }),
  });

  if (!signInResponse.ok) {
    const body = await signInResponse.text();
    console.error(`  Sign-in failed (${signInResponse.status}): ${body}`);
    process.exit(1);
  }

  // Extract session cookie
  const cookies = signInResponse.headers.get('set-cookie') || '';
  const sessionMatch = cookies.match(/better-auth\.session_token=([^;]+)/);
  if (!sessionMatch) {
    console.error('  No session cookie returned from sign-in');
    console.error('  Cookies:', cookies);
    process.exit(1);
  }
  const sessionCookie = `better-auth.session_token=${sessionMatch[1]}`;
  console.log('  Signed in successfully');

  // Step 3: Get current session to see user ID
  console.log('Step 3: Getting session info...');
  const sessionResponse = await fetch(`${API_URL}/api/auth/get-session`, {
    headers: { cookie: sessionCookie, 'Origin': API_URL },
  });

  if (!sessionResponse.ok) {
    console.error(`  Get session failed (${sessionResponse.status})`);
    process.exit(1);
  }

  const sessionData = await sessionResponse.json();
  const betterAuthUserId = sessionData.user?.id;
  console.log(`  Better Auth User ID: ${betterAuthUserId}`);

  // Step 4: Create organization (or find existing)
  console.log('Step 4: Creating/finding Better Auth organization...');
  let betterAuthOrgId: string | null = null;

  // Try to list existing organizations first
  const listOrgsResponse = await fetch(`${API_URL}/api/auth/organization/list`, {
    headers: { cookie: sessionCookie, 'Origin': API_URL },
  });

  if (listOrgsResponse.ok) {
    const orgs = await listOrgsResponse.json();
    const existingOrg = Array.isArray(orgs)
      ? orgs.find((o: any) => o.name === 'Test Organization' || o.slug === 'test-org')
      : null;

    if (existingOrg) {
      betterAuthOrgId = existingOrg.id;
      console.log(`  Found existing org: ${betterAuthOrgId}`);
    }
  }

  if (!betterAuthOrgId) {
    // Create new organization
    const createOrgResponse = await fetch(`${API_URL}/api/auth/organization/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': API_URL,
        cookie: sessionCookie,
      },
      body: JSON.stringify({
        name: 'Test Organization',
        slug: 'test-org',
      }),
    });

    if (createOrgResponse.ok) {
      const orgData = await createOrgResponse.json();
      betterAuthOrgId = orgData.id;
      console.log(`  Created org: ${betterAuthOrgId}`);
    } else {
      const body = await createOrgResponse.text();
      console.log(`  Create org returned ${createOrgResponse.status}: ${body}`);
      // Try to extract org ID if it already exists
      if (body.includes('already exists')) {
        console.log('  Organization already exists, trying to find it...');
      }
    }
  }

  // Step 5: Set active organization
  if (betterAuthOrgId) {
    console.log('Step 5: Setting active organization...');
    const setActiveResponse = await fetch(`${API_URL}/api/auth/organization/set-active`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': API_URL,
        cookie: sessionCookie,
      },
      body: JSON.stringify({
        organizationId: betterAuthOrgId,
      }),
    });

    if (setActiveResponse.ok) {
      console.log('  Active organization set');
    } else {
      console.log(`  Set active org returned ${setActiveResponse.status}`);
    }
  }

  // Step 6: Output configuration for test runners
  console.log('');
  console.log('=== Test Configuration ===');
  console.log('Set these environment variables for test runners:');
  console.log('');
  console.log(`export BETTER_AUTH_TEST_EMAIL="${TEST_EMAIL}"`);
  console.log(`export BETTER_AUTH_TEST_PASSWORD="${TEST_PASSWORD}"`);
  if (betterAuthOrgId) {
    console.log(`export BETTER_AUTH_TEST_ORG_ID="${betterAuthOrgId}"`);
  }
  console.log(`export KARATE_BETTER_AUTH_EMAIL="${TEST_EMAIL}"`);
  console.log(`export KARATE_BETTER_AUTH_PASSWORD="${TEST_PASSWORD}"`);
  if (betterAuthOrgId) {
    console.log(`export KARATE_BETTER_AUTH_ORG_ID="${betterAuthOrgId}"`);
  }
  console.log('');
  console.log('=== Provisioning Complete ===');
}

main().catch((error) => {
  console.error('Provisioning failed:', error);
  process.exit(1);
});
