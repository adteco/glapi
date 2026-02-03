/**
 * AI Tool Idempotency Handler
 *
 * Provides idempotency for mutation operations to prevent duplicate writes
 * when AI requests are retried due to network issues or timeouts.
 *
 * @module idempotency
 */

import type { ExecutionContext, ExecutionResult } from '../generated/generated-executor';

// =============================================================================
// Types
// =============================================================================

/**
 * Idempotency record stored for each request
 */
export interface IdempotencyRecord {
  /** The idempotency key */
  key: string;
  /** Result of the operation (if completed) */
  result?: ExecutionResult;
  /** Status of the operation */
  status: 'pending' | 'completed' | 'failed';
  /** When the record was created */
  createdAt: number;
  /** When the record expires */
  expiresAt: number;
  /** Organization ID (for scoping) */
  organizationId: string;
  /** User ID who initiated the request */
  userId: string;
  /** Tool name */
  toolName: string;
  /** Parameter hash for verification */
  parameterHash: string;
}

/**
 * Result of idempotency check
 */
export interface IdempotencyCheckResult {
  /** Whether this is a duplicate request */
  isDuplicate: boolean;
  /** The existing record if duplicate */
  existingRecord?: IdempotencyRecord;
  /** Whether we should proceed with execution */
  shouldExecute: boolean;
  /** Error message if conflict */
  error?: string;
}

/**
 * Configuration for idempotency handler
 */
export interface IdempotencyConfig {
  /** Default TTL for idempotency keys in seconds (default: 24 hours) */
  defaultTtlSeconds?: number;
  /** Maximum concurrent in-flight requests per key */
  maxConcurrentPerKey?: number;
  /** Whether to verify parameters match on duplicate */
  verifyParameters?: boolean;
  /** Callback when duplicate detected */
  onDuplicateDetected?: (key: string, record: IdempotencyRecord) => void;
}

/**
 * Statistics for idempotency handler
 */
export interface IdempotencyStats {
  totalChecks: number;
  duplicatesDetected: number;
  recordsStored: number;
  recordsExpired: number;
  activeRecords: number;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_TTL_SECONDS = 86400; // 24 hours
const CLEANUP_INTERVAL_MS = 300000; // 5 minutes

// =============================================================================
// Idempotency Store
// =============================================================================

/**
 * In-memory idempotency store.
 *
 * Features:
 * - Stores operation results keyed by idempotency key
 * - Automatic expiration of old records
 * - Concurrent request detection
 * - Parameter verification to prevent misuse
 *
 * Note: In production, consider using Redis for distributed systems.
 */
export class IdempotencyStore {
  private records = new Map<string, IdempotencyRecord>();
  private config: Required<IdempotencyConfig>;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  // Statistics
  private stats: IdempotencyStats = {
    totalChecks: 0,
    duplicatesDetected: 0,
    recordsStored: 0,
    recordsExpired: 0,
    activeRecords: 0,
  };

  constructor(config: IdempotencyConfig = {}) {
    this.config = {
      defaultTtlSeconds: config.defaultTtlSeconds ?? DEFAULT_TTL_SECONDS,
      maxConcurrentPerKey: config.maxConcurrentPerKey ?? 1,
      verifyParameters: config.verifyParameters ?? true,
      onDuplicateDetected: config.onDuplicateDetected ?? (() => {}),
    };

    // Start periodic cleanup
    if (typeof setInterval !== 'undefined') {
      this.cleanupTimer = setInterval(
        () => this.cleanup(),
        CLEANUP_INTERVAL_MS
      );
    }
  }

  /**
   * Check if a request should proceed based on idempotency key.
   */
  check(
    idempotencyKey: string,
    toolName: string,
    parameters: unknown,
    context: ExecutionContext
  ): IdempotencyCheckResult {
    this.stats.totalChecks++;

    const parameterHash = this.hashParameters(parameters);
    const existing = this.records.get(idempotencyKey);

    // No existing record - proceed with execution
    if (!existing) {
      return {
        isDuplicate: false,
        shouldExecute: true,
      };
    }

    // Check if record has expired
    if (Date.now() > existing.expiresAt) {
      this.records.delete(idempotencyKey);
      this.stats.recordsExpired++;
      return {
        isDuplicate: false,
        shouldExecute: true,
      };
    }

    // Existing record found - check for conflicts
    this.stats.duplicatesDetected++;
    this.config.onDuplicateDetected(idempotencyKey, existing);

    // Verify organization matches
    if (existing.organizationId !== context.organizationId) {
      return {
        isDuplicate: true,
        existingRecord: existing,
        shouldExecute: false,
        error: 'Idempotency key belongs to a different organization',
      };
    }

    // Verify tool matches
    if (existing.toolName !== toolName) {
      return {
        isDuplicate: true,
        existingRecord: existing,
        shouldExecute: false,
        error: `Idempotency key was used for a different tool: ${existing.toolName}`,
      };
    }

    // Verify parameters match (if enabled)
    if (this.config.verifyParameters && existing.parameterHash !== parameterHash) {
      return {
        isDuplicate: true,
        existingRecord: existing,
        shouldExecute: false,
        error: 'Idempotency key was used with different parameters',
      };
    }

    // Check if the previous request is still pending
    if (existing.status === 'pending') {
      return {
        isDuplicate: true,
        existingRecord: existing,
        shouldExecute: false,
        error: 'A request with this idempotency key is still being processed',
      };
    }

    // Return the cached result (completed or failed)
    return {
      isDuplicate: true,
      existingRecord: existing,
      shouldExecute: false,
    };
  }

  /**
   * Start tracking a new idempotent request.
   */
  startRequest(
    idempotencyKey: string,
    toolName: string,
    parameters: unknown,
    context: ExecutionContext,
    ttlSeconds?: number
  ): void {
    const now = Date.now();
    const ttl = ttlSeconds ?? this.config.defaultTtlSeconds;

    this.records.set(idempotencyKey, {
      key: idempotencyKey,
      status: 'pending',
      createdAt: now,
      expiresAt: now + ttl * 1000,
      organizationId: context.organizationId,
      userId: context.userId,
      toolName,
      parameterHash: this.hashParameters(parameters),
    });

    this.stats.recordsStored++;
    this.stats.activeRecords = this.records.size;
  }

  /**
   * Complete a request with its result.
   */
  completeRequest(
    idempotencyKey: string,
    result: ExecutionResult
  ): void {
    const record = this.records.get(idempotencyKey);
    if (record) {
      record.status = result.success ? 'completed' : 'failed';
      record.result = result;
    }
  }

  /**
   * Mark a request as failed.
   */
  failRequest(
    idempotencyKey: string,
    error: ExecutionResult['error']
  ): void {
    const record = this.records.get(idempotencyKey);
    if (record) {
      record.status = 'failed';
      record.result = {
        success: false,
        error,
      };
    }
  }

  /**
   * Remove a record (e.g., if we want to allow retry).
   */
  remove(idempotencyKey: string): boolean {
    const existed = this.records.delete(idempotencyKey);
    if (existed) {
      this.stats.activeRecords = this.records.size;
    }
    return existed;
  }

  /**
   * Get a specific record by key.
   */
  get(idempotencyKey: string): IdempotencyRecord | undefined {
    return this.records.get(idempotencyKey);
  }

  /**
   * Get statistics.
   */
  getStats(): IdempotencyStats {
    this.stats.activeRecords = this.records.size;
    return { ...this.stats };
  }

  /**
   * Clear all records.
   */
  clear(): void {
    this.records.clear();
    this.stats.activeRecords = 0;
  }

  /**
   * Stop the store and cleanup resources.
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.records.clear();
  }

  // Private methods

  private hashParameters(params: unknown): string {
    const json = JSON.stringify(params ?? {}, Object.keys(params ?? {}).sort());
    let hash = 0;
    for (let i = 0; i < json.length; i++) {
      const char = json.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private cleanup(): void {
    const now = Date.now();
    let expired = 0;

    for (const [key, record] of this.records.entries()) {
      if (now > record.expiresAt) {
        this.records.delete(key);
        expired++;
      }
    }

    this.stats.recordsExpired += expired;
    this.stats.activeRecords = this.records.size;
  }
}

// =============================================================================
// Singleton & Factory
// =============================================================================

let globalIdempotencyStore: IdempotencyStore | null = null;

/**
 * Get the global idempotency store instance.
 */
export function getIdempotencyStore(config?: IdempotencyConfig): IdempotencyStore {
  if (!globalIdempotencyStore) {
    globalIdempotencyStore = new IdempotencyStore(config);
  }
  return globalIdempotencyStore;
}

/**
 * Generate an idempotency key from tool invocation details.
 * Useful when the client doesn't provide one.
 */
export function generateIdempotencyKey(
  toolName: string,
  parameters: unknown,
  context: ExecutionContext
): string {
  const paramJson = JSON.stringify(parameters ?? {});
  const timestamp = Math.floor(Date.now() / 1000); // Second precision
  const data = `${context.organizationId}:${context.userId}:${toolName}:${paramJson}:${timestamp}`;

  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  return `idem_${Math.abs(hash).toString(36)}_${timestamp.toString(36)}`;
}

/**
 * Check if a tool should use idempotency (mutations only).
 */
export function shouldUseIdempotency(toolName: string, method: string): boolean {
  // Only mutations need idempotency
  return method !== 'GET';
}
