/**
 * API Test Client for TRPC E2E Testing
 *
 * Provides authenticated TRPC client for testing API endpoints
 */

import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '@glapi/trpc';

// Test configuration - matches development API key in middleware
export const TEST_CONFIG = {
  apiKey: 'glapi_test_sk_1234567890abcdef',
  organizationId: 'ba3b8cdf-efc1-4a60-88be-ac203d263fe2',
  userId: 'api-key-user',
  apiUrl: process.env.TEST_API_URL || 'http://localhost:3031',
};

/**
 * Create an authenticated TRPC client for testing
 */
export function createTestTRPCClient(options?: {
  organizationId?: string;
  userId?: string;
  apiKey?: string;
  apiUrl?: string;
}) {
  const config = {
    organizationId: options?.organizationId || TEST_CONFIG.organizationId,
    userId: options?.userId || TEST_CONFIG.userId,
    apiKey: options?.apiKey || TEST_CONFIG.apiKey,
    apiUrl: options?.apiUrl || TEST_CONFIG.apiUrl,
  };

  return createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${config.apiUrl}/api/trpc`,
        transformer: superjson,
        headers() {
          return {
            'x-api-key': config.apiKey,
            'x-organization-id': config.organizationId,
            'x-user-id': config.userId,
          };
        },
      }),
    ],
  });
}

/**
 * Type-safe TRPC test client
 */
export type TestTRPCClient = ReturnType<typeof createTestTRPCClient>;

/**
 * Helper to make raw HTTP requests to the API (for non-TRPC endpoints)
 */
export async function apiRequest(
  endpoint: string,
  options?: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: object;
    headers?: Record<string, string>;
    organizationId?: string;
    userId?: string;
    apiKey?: string;
  }
) {
  const config = {
    organizationId: options?.organizationId || TEST_CONFIG.organizationId,
    userId: options?.userId || TEST_CONFIG.userId,
    apiKey: options?.apiKey || TEST_CONFIG.apiKey,
    apiUrl: TEST_CONFIG.apiUrl,
  };

  const url = `${config.apiUrl}${endpoint}`;
  const method = options?.method || 'GET';

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'x-organization-id': config.organizationId,
      'x-user-id': config.userId,
      ...options?.headers,
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => null);

  return {
    status: response.status,
    ok: response.ok,
    data,
    headers: response.headers,
  };
}

/**
 * Test assertion helpers
 */
export const apiAssert = {
  /**
   * Assert successful response (2xx status)
   */
  success(response: { status: number; ok: boolean }) {
    if (!response.ok) {
      throw new Error(`Expected success but got status ${response.status}`);
    }
  },

  /**
   * Assert specific status code
   */
  status(response: { status: number }, expected: number) {
    if (response.status !== expected) {
      throw new Error(`Expected status ${expected} but got ${response.status}`);
    }
  },

  /**
   * Assert 400 Bad Request
   */
  badRequest(response: { status: number }) {
    this.status(response, 400);
  },

  /**
   * Assert 401 Unauthorized
   */
  unauthorized(response: { status: number }) {
    this.status(response, 401);
  },

  /**
   * Assert 403 Forbidden
   */
  forbidden(response: { status: number }) {
    this.status(response, 403);
  },

  /**
   * Assert 404 Not Found
   */
  notFound(response: { status: number }) {
    this.status(response, 404);
  },

  /**
   * Assert 500 Internal Server Error
   */
  serverError(response: { status: number }) {
    this.status(response, 500);
  },
};

/**
 * Create test data cleanup helper
 * Tracks created entities and cleans them up after tests
 */
export function createCleanupHelper(client: TestTRPCClient) {
  const toCleanup: { type: string; id: string }[] = [];

  return {
    /**
     * Track an entity for cleanup
     */
    track(type: string, id: string) {
      toCleanup.push({ type, id });
    },

    /**
     * Clean up all tracked entities
     */
    async cleanupAll() {
      for (const { type, id } of toCleanup.reverse()) {
        try {
          switch (type) {
            case 'customer':
              await client.customers.delete.mutate({ id });
              break;
            case 'item':
              await client.items.delete.mutate({ id });
              break;
            case 'invoice':
              await client.invoices.delete.mutate({ id });
              break;
            // Add more entity types as needed
          }
        } catch (error) {
          // Ignore cleanup errors - entity might already be deleted
          console.log(`Cleanup warning: Failed to delete ${type} ${id}`);
        }
      }
      toCleanup.length = 0;
    },
  };
}

/**
 * Wait for API to be available
 */
export async function waitForApi(
  maxRetries = 30,
  retryDelay = 1000
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${TEST_CONFIG.apiUrl}/api/health`);
      if (response.ok) {
        return true;
      }
    } catch {
      // API not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelay));
  }
  return false;
}

/**
 * Generate unique test ID
 */
export function testId(prefix = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
}
