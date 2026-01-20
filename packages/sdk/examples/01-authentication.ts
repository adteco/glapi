/**
 * GLAPI SDK Example: Authentication
 *
 * This example demonstrates different authentication patterns.
 *
 * Run with: npx tsx examples/01-authentication.ts
 */

import { GlapiClient, configure, glapi } from '@glapi/sdk';

// =============================================================================
// Pattern 1: Direct client instantiation with static token
// =============================================================================
function staticTokenExample() {
  const client = new GlapiClient({
    baseUrl: 'https://api.glapi.io/api',
    token: 'your-clerk-bearer-token',
  });

  // Use the client
  return client;
}

// =============================================================================
// Pattern 2: Global configuration with default client
// =============================================================================
function globalConfigExample() {
  // Configure once at application startup
  configure({
    baseUrl: process.env.GLAPI_BASE_URL || 'https://api.glapi.io/api',
    token: process.env.GLAPI_TOKEN,
  });

  // Use the pre-configured default client anywhere
  // await glapi.customers.list();
  return glapi;
}

// =============================================================================
// Pattern 3: Dynamic token (for React/Next.js with Clerk)
// =============================================================================
function dynamicTokenExample() {
  // In a real app, this would come from Clerk's useAuth hook
  const getToken = async () => {
    // const { getToken } = useAuth();
    // return await getToken() ?? '';
    return process.env.GLAPI_TOKEN ?? '';
  };

  const client = new GlapiClient({
    baseUrl: 'https://api.glapi.io/api',
    token: getToken,
  });

  return client;
}

// =============================================================================
// Pattern 4: Custom headers for additional context
// =============================================================================
function customHeadersExample() {
  const client = new GlapiClient({
    baseUrl: 'https://api.glapi.io/api',
    token: process.env.GLAPI_TOKEN,
    headers: {
      'X-Request-ID': crypto.randomUUID(),
      'X-Client-Version': '1.0.0',
    },
  });

  return client;
}

// =============================================================================
// Main
// =============================================================================
async function main() {
  console.log('GLAPI SDK - Authentication Examples');
  console.log('====================================\n');

  console.log('Pattern 1: Static token');
  const client1 = staticTokenExample();
  console.log('  Client created with static token\n');

  console.log('Pattern 2: Global configuration');
  const client2 = globalConfigExample();
  console.log('  Global client configured\n');

  console.log('Pattern 3: Dynamic token');
  const client3 = dynamicTokenExample();
  console.log('  Client created with dynamic token function\n');

  console.log('Pattern 4: Custom headers');
  const client4 = customHeadersExample();
  console.log('  Client created with custom headers\n');

  console.log('All authentication patterns demonstrated successfully!');
}

main().catch(console.error);
