/**
 * AI Tool Cache Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolCache, buildCacheKey, createCacheInterface } from '../caching';
import type { ExecutionContext } from '../generated/generated-executor';

describe('ToolCache', () => {
  let cache: ToolCache;

  beforeEach(() => {
    cache = new ToolCache({ maxEntries: 10 });
  });

  describe('basic operations', () => {
    it('should store and retrieve values', async () => {
      await cache.set('key1', { data: 'test' }, 300);
      const result = await cache.get('key1');
      expect(result).toEqual({ data: 'test' });
    });

    it('should return null for missing keys', async () => {
      const result = await cache.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should update statistics on get/set', async () => {
      await cache.set('key1', 'value1', 300);
      await cache.get('key1'); // hit
      await cache.get('key1'); // hit
      await cache.get('missing'); // miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.sets).toBe(1);
      expect(stats.size).toBe(1);
    });

    it('should calculate hit rate correctly', async () => {
      await cache.set('key1', 'value1', 300);
      await cache.get('key1'); // hit
      await cache.get('key1'); // hit
      await cache.get('missing'); // miss
      await cache.get('missing'); // miss

      expect(cache.getHitRate()).toBe(50);
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', async () => {
      vi.useFakeTimers();

      await cache.set('key1', 'value1', 1); // 1 second TTL

      // Should be available immediately
      expect(await cache.get('key1')).toBe('value1');

      // Advance time past TTL
      vi.advanceTimersByTime(1500);

      // Should be expired
      expect(await cache.get('key1')).toBeNull();

      vi.useRealTimers();
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest entries when at capacity', async () => {
      const smallCache = new ToolCache({ maxEntries: 3 });

      await smallCache.set('key1', 'value1', 300);
      await smallCache.set('key2', 'value2', 300);
      await smallCache.set('key3', 'value3', 300);

      // All three should be present
      expect(await smallCache.get('key1')).toBe('value1');

      // Adding a fourth should evict the oldest (key1 was just accessed, so key2 is oldest)
      await smallCache.get('key1'); // Access key1 to make it most recent
      await smallCache.set('key4', 'value4', 300);

      // key2 should be evicted (it was oldest)
      expect(await smallCache.get('key2')).toBeNull();
      expect(await smallCache.get('key3')).toBe('value3');
      expect(await smallCache.get('key4')).toBe('value4');
    });

    it('should call onEviction callback when evicting', async () => {
      const onEviction = vi.fn();
      const smallCache = new ToolCache({ maxEntries: 2, onEviction });

      await smallCache.set('key1', 'value1', 300);
      await smallCache.set('key2', 'value2', 300);
      await smallCache.set('key3', 'value3', 300); // Should trigger eviction

      expect(onEviction).toHaveBeenCalledWith('key1', 'value1');
    });

    it('should track eviction count in stats', async () => {
      const smallCache = new ToolCache({ maxEntries: 2 });

      await smallCache.set('key1', 'value1', 300);
      await smallCache.set('key2', 'value2', 300);
      await smallCache.set('key3', 'value3', 300);

      const stats = smallCache.getStats();
      expect(stats.evictions).toBe(1);
    });
  });

  describe('invalidation', () => {
    it('should invalidate specific keys', async () => {
      await cache.set('key1', 'value1', 300);
      await cache.set('key2', 'value2', 300);

      const removed = cache.invalidate('key1');
      expect(removed).toBe(true);
      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBe('value2');
    });

    it('should return false when invalidating non-existent key', async () => {
      const removed = cache.invalidate('nonexistent');
      expect(removed).toBe(false);
    });

    it('should invalidate by pattern', async () => {
      await cache.set('tool:org1:list_customers:abc', 'data1', 300);
      await cache.set('tool:org1:list_vendors:def', 'data2', 300);
      await cache.set('tool:org2:list_customers:ghi', 'data3', 300);

      const count = cache.invalidatePattern(/^tool:org1:/);
      expect(count).toBe(2);
      expect(await cache.get('tool:org2:list_customers:ghi')).toBe('data3');
    });

    it('should clear all entries', async () => {
      await cache.set('key1', 'value1', 300);
      await cache.set('key2', 'value2', 300);

      cache.clear();

      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
      expect(cache.getStats().size).toBe(0);
    });
  });
});

describe('buildCacheKey', () => {
  const mockContext: ExecutionContext = {
    userId: 'user-123',
    organizationId: 'org-456',
    userRole: 'staff',
    authToken: 'token',
  };

  it('should include organization in cache key', () => {
    const key = buildCacheKey('list_customers', {}, mockContext);
    expect(key).toContain('org-456');
    expect(key).toContain('list_customers');
  });

  it('should generate different keys for different parameters', () => {
    const key1 = buildCacheKey('list_customers', { limit: 10 }, mockContext);
    const key2 = buildCacheKey('list_customers', { limit: 20 }, mockContext);
    expect(key1).not.toBe(key2);
  });

  it('should generate same key for same parameters', () => {
    const key1 = buildCacheKey('list_customers', { a: 1, b: 2 }, mockContext);
    const key2 = buildCacheKey('list_customers', { b: 2, a: 1 }, mockContext);
    expect(key1).toBe(key2);
  });

  it('should generate different keys for different organizations', () => {
    const key1 = buildCacheKey('list_customers', {}, mockContext);
    const key2 = buildCacheKey('list_customers', {}, { ...mockContext, organizationId: 'org-789' });
    expect(key1).not.toBe(key2);
  });
});

describe('createCacheInterface', () => {
  it('should create interface compatible with executor', async () => {
    const cache = new ToolCache();
    const cacheInterface = createCacheInterface(cache);

    expect(typeof cacheInterface.get).toBe('function');
    expect(typeof cacheInterface.set).toBe('function');

    await cacheInterface.set('key', 'value', 300);
    const result = await cacheInterface.get('key');
    expect(result).toBe('value');
  });
});
