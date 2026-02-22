/**
 * AI Tool Rate Limiter
 *
 * Implements sliding window rate limiting for AI tool calls.
 * Enforces limits from tool metadata to prevent abuse.
 */

import type { ExecutionContext } from '../generated/generated-executor';
import { AI_TOOLS_BY_NAME } from '../generated/generated-tools';

// Rate limit check result
export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
  remaining?: number;
  limit?: number;
  resetMs?: number;
}

// Rate limit statistics
export interface RateLimiterStats {
  totalChecks: number;
  allowed: number;
  denied: number;
  windowsActive: number;
}

// Configuration options
export interface RateLimiterConfig {
  defaultRequestsPerMinute?: number;
  cleanupIntervalMs?: number;
  overrides?: Record<string, number>; // Tool-specific overrides
}

const DEFAULT_REQUESTS_PER_MINUTE = 60;
const DEFAULT_CLEANUP_INTERVAL_MS = 60000; // 1 minute
const WINDOW_SIZE_MS = 60000; // 1 minute sliding window

// Window entry for tracking requests
interface WindowEntry {
  timestamps: number[];
  lastCleanup: number;
}

/**
 * Sliding window rate limiter for AI tools.
 *
 * Features:
 * - Per-tool rate limits from metadata
 * - Per-user or per-organization scoping
 * - Sliding window algorithm for smooth limiting
 * - Automatic cleanup of old windows
 */
export class RateLimiter {
  private windows = new Map<string, WindowEntry>();
  private defaultRpm: number;
  private overrides: Record<string, number>;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  // Statistics
  private totalChecks = 0;
  private allowed = 0;
  private denied = 0;

  constructor(config: RateLimiterConfig = {}) {
    this.defaultRpm = config.defaultRequestsPerMinute ?? DEFAULT_REQUESTS_PER_MINUTE;
    this.overrides = config.overrides ?? {};

    // Start periodic cleanup
    if (typeof setInterval !== 'undefined') {
      this.cleanupTimer = setInterval(
        () => this.cleanup(),
        config.cleanupIntervalMs ?? DEFAULT_CLEANUP_INTERVAL_MS
      );
    }
  }

  /**
   * Check if a tool call is allowed under rate limits.
   * Records the request if allowed.
   */
  async check(
    toolName: string,
    context: ExecutionContext
  ): Promise<RateLimitResult> {
    this.totalChecks++;
    const now = Date.now();

    // Get rate limit for this tool
    const limit = this.getLimitForTool(toolName);
    const windowKey = this.buildWindowKey(toolName, context);

    // Get or create window
    let window = this.windows.get(windowKey);
    if (!window) {
      window = { timestamps: [], lastCleanup: now };
      this.windows.set(windowKey, window);
    }

    // Remove expired timestamps from window
    const windowStart = now - WINDOW_SIZE_MS;
    window.timestamps = window.timestamps.filter((ts) => ts > windowStart);

    // Check limit
    if (window.timestamps.length >= limit) {
      this.denied++;

      // Calculate retry-after based on oldest timestamp in window
      const oldestTimestamp = window.timestamps[0];
      const retryAfterMs = oldestTimestamp + WINDOW_SIZE_MS - now;

      return {
        allowed: false,
        retryAfterMs: Math.max(0, retryAfterMs),
        remaining: 0,
        limit,
        resetMs: retryAfterMs,
      };
    }

    // Record this request
    window.timestamps.push(now);
    this.allowed++;

    return {
      allowed: true,
      remaining: limit - window.timestamps.length,
      limit,
      resetMs: window.timestamps.length > 0 ? window.timestamps[0] + WINDOW_SIZE_MS - now : WINDOW_SIZE_MS,
    };
  }

  /**
   * Get the current rate limit status without recording a request.
   */
  async peek(
    toolName: string,
    context: ExecutionContext
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const limit = this.getLimitForTool(toolName);
    const windowKey = this.buildWindowKey(toolName, context);
    const window = this.windows.get(windowKey);

    if (!window) {
      return {
        allowed: true,
        remaining: limit,
        limit,
        resetMs: WINDOW_SIZE_MS,
      };
    }

    const windowStart = now - WINDOW_SIZE_MS;
    const activeTimestamps = window.timestamps.filter((ts) => ts > windowStart);
    const remaining = limit - activeTimestamps.length;

    if (remaining <= 0) {
      const oldestTimestamp = activeTimestamps[0];
      const retryAfterMs = oldestTimestamp + WINDOW_SIZE_MS - now;

      return {
        allowed: false,
        retryAfterMs: Math.max(0, retryAfterMs),
        remaining: 0,
        limit,
        resetMs: retryAfterMs,
      };
    }

    return {
      allowed: true,
      remaining,
      limit,
      resetMs: activeTimestamps.length > 0 ? activeTimestamps[0] + WINDOW_SIZE_MS - now : WINDOW_SIZE_MS,
    };
  }

  /**
   * Reset rate limit for a specific key.
   */
  reset(toolName: string, context: ExecutionContext): void {
    const windowKey = this.buildWindowKey(toolName, context);
    this.windows.delete(windowKey);
  }

  /**
   * Reset all rate limits.
   */
  resetAll(): void {
    this.windows.clear();
  }

  /**
   * Get rate limiter statistics.
   */
  getStats(): RateLimiterStats {
    return {
      totalChecks: this.totalChecks,
      allowed: this.allowed,
      denied: this.denied,
      windowsActive: this.windows.size,
    };
  }

  /**
   * Stop the rate limiter and cleanup resources.
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.windows.clear();
  }

  // Private helper methods

  private getLimitForTool(toolName: string): number {
    // Check for override first
    if (this.overrides[toolName] !== undefined) {
      return this.overrides[toolName];
    }

    // Get limit from tool metadata
    const tool = AI_TOOLS_BY_NAME.get(toolName);
    if (tool?.metadata.rateLimit?.requestsPerMinute) {
      return tool.metadata.rateLimit.requestsPerMinute;
    }

    return this.defaultRpm;
  }

  private buildWindowKey(toolName: string, context: ExecutionContext): string {
    // Get scope from tool metadata
    const tool = AI_TOOLS_BY_NAME.get(toolName);
    const scope = tool?.metadata.rateLimit?.scope ?? 'user';

    switch (scope) {
      case 'global':
        return `global:${toolName}`;
      case 'organization':
        return `org:${context.organizationId}:${toolName}`;
      case 'user':
      default:
        return `user:${context.userId}:${toolName}`;
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - WINDOW_SIZE_MS;

    for (const [key, window] of this.windows.entries()) {
      // Remove expired timestamps
      window.timestamps = window.timestamps.filter((ts) => ts > windowStart);

      // Remove empty windows that haven't been accessed recently
      if (window.timestamps.length === 0 && now - window.lastCleanup > WINDOW_SIZE_MS * 2) {
        this.windows.delete(key);
      } else {
        window.lastCleanup = now;
      }
    }
  }
}

// Singleton instance
let globalRateLimiter: RateLimiter | null = null;

/**
 * Get the global rate limiter instance.
 */
export function getRateLimiter(config?: RateLimiterConfig): RateLimiter {
  if (!globalRateLimiter) {
    globalRateLimiter = new RateLimiter(config);
  }
  return globalRateLimiter;
}

/**
 * Create the rate limiter interface expected by the executor.
 */
export function createRateLimiterInterface(limiter: RateLimiter = getRateLimiter()) {
  return {
    check: (toolName: string, context: ExecutionContext) => limiter.check(toolName, context),
  };
}
