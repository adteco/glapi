/**
 * AI Tool Response Cache
 *
 * Implements in-memory caching for AI tool responses with LRU eviction.
 * Used by the generated executor for caching read-only operations.
 */

import type { ExecutionContext } from '../generated/generated-executor';

// Cache entry with TTL tracking
interface CacheEntry {
  value: unknown;
  expiresAt: number;
  createdAt: number;
}

// Cache statistics for monitoring
export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
  size: number;
  maxSize: number;
}

// Configuration options
export interface ToolCacheConfig {
  maxEntries?: number;
  defaultTtlSeconds?: number;
  onEviction?: (key: string, value: unknown) => void;
}

const DEFAULT_MAX_ENTRIES = 1000;
const DEFAULT_TTL_SECONDS = 300; // 5 minutes

/**
 * In-memory LRU cache for AI tool responses.
 *
 * Features:
 * - LRU eviction when max entries exceeded
 * - TTL-based expiration
 * - Per-organization isolation via cache keys
 * - Thread-safe for single-process Node.js
 */
export class ToolCache {
  private cache = new Map<string, CacheEntry>();
  private accessOrder: string[] = [];
  private maxEntries: number;
  private defaultTtlSeconds: number;
  private onEviction?: (key: string, value: unknown) => void;

  // Statistics
  private hits = 0;
  private misses = 0;
  private sets = 0;
  private evictions = 0;

  constructor(config: ToolCacheConfig = {}) {
    this.maxEntries = config.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.defaultTtlSeconds = config.defaultTtlSeconds ?? DEFAULT_TTL_SECONDS;
    this.onEviction = config.onEviction;
  }

  /**
   * Get a cached value by key.
   * Returns null if not found or expired.
   */
  async get(key: string): Promise<unknown | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.misses++;
      return null;
    }

    // Update access order for LRU
    this.updateAccessOrder(key);
    this.hits++;

    return entry.value;
  }

  /**
   * Set a cached value with TTL.
   */
  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const now = Date.now();
    const expiresAt = now + ttlSeconds * 1000;

    // Evict if at capacity (before adding new entry)
    while (this.cache.size >= this.maxEntries) {
      this.evictOldest();
    }

    // Remove existing entry from access order if updating
    if (this.cache.has(key)) {
      this.removeFromAccessOrder(key);
    }

    this.cache.set(key, {
      value,
      expiresAt,
      createdAt: now,
    });

    this.accessOrder.push(key);
    this.sets++;
  }

  /**
   * Invalidate a specific cache entry.
   */
  invalidate(key: string): boolean {
    const existed = this.cache.delete(key);
    if (existed) {
      this.removeFromAccessOrder(key);
    }
    return existed;
  }

  /**
   * Invalidate all entries matching a pattern.
   * Useful for invalidating all entries for a tool or organization.
   */
  invalidatePattern(pattern: string | RegExp): number {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    let count = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        count++;
      }
    }

    return count;
  }

  /**
   * Clear all cache entries.
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get cache statistics.
   */
  getStats(): CacheStats {
    // Clean up expired entries first
    this.cleanupExpired();

    return {
      hits: this.hits,
      misses: this.misses,
      sets: this.sets,
      evictions: this.evictions,
      size: this.cache.size,
      maxSize: this.maxEntries,
    };
  }

  /**
   * Get hit rate as a percentage.
   */
  getHitRate(): number {
    const total = this.hits + this.misses;
    if (total === 0) return 0;
    return (this.hits / total) * 100;
  }

  // Private helper methods

  private evictOldest(): void {
    const oldestKey = this.accessOrder.shift();
    if (oldestKey) {
      const entry = this.cache.get(oldestKey);
      this.cache.delete(oldestKey);
      this.evictions++;

      if (this.onEviction && entry) {
        this.onEviction(oldestKey, entry.value);
      }
    }
  }

  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
      }
    }
  }
}

/**
 * Build a cache key from tool execution parameters.
 * Keys are scoped by organization to ensure data isolation.
 */
export function buildCacheKey(
  toolName: string,
  parameters: unknown,
  context: ExecutionContext
): string {
  const paramHash = hashParameters(parameters);
  return `tool:${context.organizationId}:${toolName}:${paramHash}`;
}

/**
 * Create a simple hash of parameters for cache key.
 * Uses JSON serialization and a basic hash function.
 */
function hashParameters(params: unknown): string {
  const json = JSON.stringify(params ?? {}, Object.keys(params ?? {}).sort());
  let hash = 0;
  for (let i = 0; i < json.length; i++) {
    const char = json.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// Singleton instance for application-wide caching
let globalCache: ToolCache | null = null;

/**
 * Get the global tool cache instance.
 */
export function getToolCache(config?: ToolCacheConfig): ToolCache {
  if (!globalCache) {
    globalCache = new ToolCache(config);
  }
  return globalCache;
}

/**
 * Create the cache interface expected by the executor.
 */
export function createCacheInterface(cache: ToolCache = getToolCache()) {
  return {
    get: (key: string) => cache.get(key),
    set: (key: string, value: unknown, ttlSeconds: number) => cache.set(key, value, ttlSeconds),
  };
}
