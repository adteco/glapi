/**
 * AI Tool Rate Limiter Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimiter, createRateLimiterInterface } from '../rate-limit';
import type { ExecutionContext } from '../generated/generated-executor';

describe('RateLimiter', () => {
  let limiter: RateLimiter;
  const mockContext: ExecutionContext = {
    userId: 'user-123',
    organizationId: 'org-456',
    userRole: 'staff',
    authToken: 'token',
  };

  // Use a tool name that doesn't exist in metadata to test default limits
  const TEST_TOOL = 'test_tool_no_metadata';

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = new RateLimiter({
      defaultRequestsPerMinute: 5,
      cleanupIntervalMs: 60000,
    });
  });

  afterEach(() => {
    limiter.stop();
    vi.useRealTimers();
  });

  describe('check', () => {
    it('should allow requests within limit', async () => {
      const result = await limiter.check(TEST_TOOL, mockContext);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.limit).toBe(5);
    });

    it('should deny requests exceeding limit', async () => {
      // Use all 5 allowed requests
      for (let i = 0; i < 5; i++) {
        await limiter.check(TEST_TOOL, mockContext);
      }

      // 6th request should be denied
      const result = await limiter.check(TEST_TOOL, mockContext);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it('should allow requests after window expires', async () => {
      // Exhaust the limit
      for (let i = 0; i < 5; i++) {
        await limiter.check(TEST_TOOL, mockContext);
      }

      // Should be denied
      const deniedResult = await limiter.check(TEST_TOOL, mockContext);
      expect(deniedResult.allowed).toBe(false);

      // Advance time by 1 minute
      vi.advanceTimersByTime(60000);

      // Should be allowed again
      const allowedResult = await limiter.check(TEST_TOOL, mockContext);
      expect(allowedResult.allowed).toBe(true);
    });

    it('should track statistics', async () => {
      await limiter.check(TEST_TOOL, mockContext);
      await limiter.check(TEST_TOOL, mockContext);
      await limiter.check(TEST_TOOL, mockContext);
      await limiter.check(TEST_TOOL, mockContext);
      await limiter.check(TEST_TOOL, mockContext);
      await limiter.check(TEST_TOOL, mockContext); // This one should be denied

      const stats = limiter.getStats();
      expect(stats.totalChecks).toBe(6);
      expect(stats.allowed).toBe(5);
      expect(stats.denied).toBe(1);
    });
  });

  describe('peek', () => {
    it('should return status without recording request', async () => {
      // Check status
      const peekResult = await limiter.peek(TEST_TOOL, mockContext);
      expect(peekResult.allowed).toBe(true);
      expect(peekResult.remaining).toBe(5); // Still at max

      // Actually record a request
      await limiter.check(TEST_TOOL, mockContext);

      // Peek should show updated status
      const peekResult2 = await limiter.peek(TEST_TOOL, mockContext);
      expect(peekResult2.remaining).toBe(4);
    });
  });

  describe('per-user isolation', () => {
    it('should track limits separately per user', async () => {
      const user1Context = { ...mockContext, userId: 'user-1' };
      const user2Context = { ...mockContext, userId: 'user-2' };

      // User 1 exhausts their limit
      for (let i = 0; i < 5; i++) {
        await limiter.check(TEST_TOOL, user1Context);
      }

      // User 1 should be denied
      const user1Result = await limiter.check(TEST_TOOL, user1Context);
      expect(user1Result.allowed).toBe(false);

      // User 2 should still be allowed
      const user2Result = await limiter.check(TEST_TOOL, user2Context);
      expect(user2Result.allowed).toBe(true);
    });
  });

  describe('tool-specific limits from metadata', () => {
    it('should use default limit when tool has no metadata', async () => {
      const result = await limiter.check('unknown_tool', mockContext);
      // Default is 5 from config
      expect(result.limit).toBe(5);
    });

    it('should use rate limit from tool metadata when available', async () => {
      // list_customers has 60 requests per minute in metadata
      const result = await limiter.check('list_customers', mockContext);
      expect(result.limit).toBe(60);
      expect(result.remaining).toBe(59);
    });
  });

  describe('reset', () => {
    it('should reset limit for specific tool/context', async () => {
      // Exhaust the limit
      for (let i = 0; i < 5; i++) {
        await limiter.check(TEST_TOOL, mockContext);
      }

      // Should be denied
      const deniedResult = await limiter.check(TEST_TOOL, mockContext);
      expect(deniedResult.allowed).toBe(false);

      // Reset
      limiter.reset(TEST_TOOL, mockContext);

      // Should be allowed again
      const allowedResult = await limiter.check(TEST_TOOL, mockContext);
      expect(allowedResult.allowed).toBe(true);
      expect(allowedResult.remaining).toBe(4);
    });

    it('should reset all limits', async () => {
      // Exhaust limits for multiple tools (use test tools without metadata)
      for (let i = 0; i < 5; i++) {
        await limiter.check('test_tool_1', mockContext);
        await limiter.check('test_tool_2', mockContext);
      }

      // Reset all
      limiter.resetAll();

      // Both should be allowed
      const tool1Result = await limiter.check('test_tool_1', mockContext);
      const tool2Result = await limiter.check('test_tool_2', mockContext);
      expect(tool1Result.allowed).toBe(true);
      expect(tool2Result.allowed).toBe(true);
    });
  });

  describe('overrides', () => {
    it('should respect tool-specific overrides', async () => {
      const limiterWithOverrides = new RateLimiter({
        defaultRequestsPerMinute: 5,
        overrides: {
          special_tool: 2,
        },
      });

      // Should only allow 2 requests
      await limiterWithOverrides.check('special_tool', mockContext);
      await limiterWithOverrides.check('special_tool', mockContext);
      const result = await limiterWithOverrides.check('special_tool', mockContext);

      expect(result.allowed).toBe(false);
      expect(result.limit).toBe(2);

      limiterWithOverrides.stop();
    });
  });
});

describe('createRateLimiterInterface', () => {
  it('should create interface compatible with executor', async () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter({ defaultRequestsPerMinute: 10 });
    const limiterInterface = createRateLimiterInterface(limiter);

    const mockContext: ExecutionContext = {
      userId: 'user-123',
      organizationId: 'org-456',
      userRole: 'staff',
      authToken: 'token',
    };

    expect(typeof limiterInterface.check).toBe('function');

    const result = await limiterInterface.check('list_customers', mockContext);
    expect(result.allowed).toBe(true);

    limiter.stop();
    vi.useRealTimers();
  });
});
