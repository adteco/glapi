/**
 * AI Async Tool Polling
 *
 * Provides polling support for long-running AI tool operations.
 * Allows tools to return async job IDs and poll for completion.
 *
 * @module async-tools
 */

import type { ExecutionResult } from '../generated/generated-executor';

// =============================================================================
// Types
// =============================================================================

/**
 * Status of an async operation
 */
export type AsyncOperationStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

/**
 * Async operation record
 */
export interface AsyncOperation<T = unknown> {
  /** Unique operation ID */
  id: string;
  /** Tool name */
  toolName: string;
  /** Current status */
  status: AsyncOperationStatus;
  /** Progress percentage (0-100) */
  progress?: number;
  /** Status message */
  message?: string;
  /** Result when completed */
  result?: T;
  /** Error when failed */
  error?: ExecutionResult['error'];
  /** When the operation started */
  startedAt: number;
  /** When the operation completed/failed */
  completedAt?: number;
  /** Organization ID */
  organizationId: string;
  /** User who initiated */
  userId: string;
  /** Estimated completion time (if available) */
  estimatedCompletionMs?: number;
}

/**
 * Polling configuration
 */
export interface PollingConfig {
  /** Initial polling interval in ms (default: 1000) */
  initialIntervalMs?: number;
  /** Maximum polling interval in ms (default: 10000) */
  maxIntervalMs?: number;
  /** Interval multiplier for backoff (default: 1.5) */
  intervalMultiplier?: number;
  /** Maximum time to poll in ms (default: 300000 = 5 minutes) */
  maxPollingTimeMs?: number;
  /** Maximum number of polls (default: 60) */
  maxPolls?: number;
  /** Callback on each poll */
  onPoll?: (operation: AsyncOperation) => void;
  /** Callback on progress update */
  onProgress?: (progress: number, message?: string) => void;
}

/**
 * Async result that may include a job ID
 */
export interface AsyncToolResult<T = unknown> {
  /** Whether the result is async (needs polling) */
  async: boolean;
  /** Job ID for polling (if async) */
  jobId?: string;
  /** Immediate result (if not async) */
  result?: T;
  /** Polling hint (suggested interval) */
  pollIntervalMs?: number;
  /** Estimated completion time */
  estimatedCompletionMs?: number;
}

/**
 * Polling result
 */
export interface PollingResult<T> {
  /** Whether operation completed successfully */
  success: boolean;
  /** Final operation state */
  operation: AsyncOperation<T>;
  /** Total polling time in ms */
  totalTimeMs: number;
  /** Number of polls made */
  pollCount: number;
  /** Whether polling timed out */
  timedOut: boolean;
}

/**
 * Stats for async operation tracking
 */
export interface AsyncToolStats {
  activeOperations: number;
  completedOperations: number;
  failedOperations: number;
  averageCompletionTimeMs: number;
  timeoutCount: number;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_POLLING_CONFIG: Required<Omit<PollingConfig, 'onPoll' | 'onProgress'>> = {
  initialIntervalMs: 1000,
  maxIntervalMs: 10000,
  intervalMultiplier: 1.5,
  maxPollingTimeMs: 300000, // 5 minutes
  maxPolls: 60,
};

// =============================================================================
// Async Operation Store
// =============================================================================

/**
 * In-memory store for async operations.
 * In production, consider using Redis or a database for persistence.
 */
export class AsyncOperationStore {
  private operations = new Map<string, AsyncOperation>();
  private completionTimes: number[] = [];
  private stats = {
    completed: 0,
    failed: 0,
    timeout: 0,
  };

  /**
   * Register a new async operation.
   */
  register<T>(
    jobId: string,
    toolName: string,
    organizationId: string,
    userId: string,
    estimatedCompletionMs?: number
  ): AsyncOperation<T> {
    const operation: AsyncOperation<T> = {
      id: jobId,
      toolName,
      status: 'pending',
      startedAt: Date.now(),
      organizationId,
      userId,
      estimatedCompletionMs,
    };

    this.operations.set(jobId, operation);
    return operation;
  }

  /**
   * Get an operation by ID.
   */
  get<T>(jobId: string): AsyncOperation<T> | undefined {
    return this.operations.get(jobId) as AsyncOperation<T> | undefined;
  }

  /**
   * Update operation progress.
   */
  updateProgress(jobId: string, progress: number, message?: string): void {
    const operation = this.operations.get(jobId);
    if (operation) {
      operation.status = 'running';
      operation.progress = progress;
      if (message) {
        operation.message = message;
      }
    }
  }

  /**
   * Mark operation as completed.
   */
  complete<T>(jobId: string, result: T): void {
    const operation = this.operations.get(jobId);
    if (operation) {
      operation.status = 'completed';
      operation.result = result;
      operation.completedAt = Date.now();
      operation.progress = 100;

      this.stats.completed++;
      this.completionTimes.push(operation.completedAt - operation.startedAt);
    }
  }

  /**
   * Mark operation as failed.
   */
  fail(jobId: string, error: ExecutionResult['error']): void {
    const operation = this.operations.get(jobId);
    if (operation) {
      operation.status = 'failed';
      operation.error = error;
      operation.completedAt = Date.now();

      this.stats.failed++;
    }
  }

  /**
   * Cancel an operation.
   */
  cancel(jobId: string): boolean {
    const operation = this.operations.get(jobId);
    if (operation && (operation.status === 'pending' || operation.status === 'running')) {
      operation.status = 'cancelled';
      operation.completedAt = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Mark operation as timed out.
   */
  timeout(jobId: string): void {
    const operation = this.operations.get(jobId);
    if (operation) {
      operation.status = 'timeout';
      operation.completedAt = Date.now();
      this.stats.timeout++;
    }
  }

  /**
   * Get all active operations for an organization.
   */
  getActiveForOrganization(organizationId: string): AsyncOperation[] {
    return Array.from(this.operations.values()).filter(
      (op) =>
        op.organizationId === organizationId &&
        (op.status === 'pending' || op.status === 'running')
    );
  }

  /**
   * Get statistics.
   */
  getStats(): AsyncToolStats {
    const activeOps = Array.from(this.operations.values()).filter(
      (op) => op.status === 'pending' || op.status === 'running'
    );

    const avgTime = this.completionTimes.length > 0
      ? this.completionTimes.reduce((a, b) => a + b, 0) / this.completionTimes.length
      : 0;

    return {
      activeOperations: activeOps.length,
      completedOperations: this.stats.completed,
      failedOperations: this.stats.failed,
      averageCompletionTimeMs: Math.round(avgTime),
      timeoutCount: this.stats.timeout,
    };
  }

  /**
   * Cleanup old completed operations.
   */
  cleanup(maxAgeMs: number = 3600000): number {
    const cutoff = Date.now() - maxAgeMs;
    let removed = 0;

    for (const [id, operation] of this.operations.entries()) {
      if (
        operation.completedAt &&
        operation.completedAt < cutoff &&
        operation.status !== 'pending' &&
        operation.status !== 'running'
      ) {
        this.operations.delete(id);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Clear all operations.
   */
  clear(): void {
    this.operations.clear();
    this.completionTimes = [];
    this.stats = { completed: 0, failed: 0, timeout: 0 };
  }
}

// =============================================================================
// Polling Implementation
// =============================================================================

/**
 * Poll for async operation completion.
 */
export async function pollForCompletion<T>(
  jobId: string,
  checkStatus: (jobId: string) => Promise<AsyncOperation<T>>,
  config: PollingConfig = {}
): Promise<PollingResult<T>> {
  const options = { ...DEFAULT_POLLING_CONFIG, ...config };
  const startTime = Date.now();
  let pollCount = 0;
  let currentInterval = options.initialIntervalMs;

  while (pollCount < options.maxPolls) {
    // Check timeout
    if (Date.now() - startTime > options.maxPollingTimeMs) {
      const operation = await checkStatus(jobId);
      return {
        success: false,
        operation: { ...operation, status: 'timeout' },
        totalTimeMs: Date.now() - startTime,
        pollCount,
        timedOut: true,
      };
    }

    // Wait before polling
    if (pollCount > 0) {
      await sleep(currentInterval);
      currentInterval = Math.min(
        currentInterval * options.intervalMultiplier,
        options.maxIntervalMs
      );
    }

    // Poll for status
    const operation = await checkStatus(jobId);
    pollCount++;

    // Notify callbacks
    if (config.onPoll) {
      config.onPoll(operation);
    }
    if (config.onProgress && operation.progress !== undefined) {
      config.onProgress(operation.progress, operation.message);
    }

    // Check if completed
    if (operation.status === 'completed') {
      return {
        success: true,
        operation,
        totalTimeMs: Date.now() - startTime,
        pollCount,
        timedOut: false,
      };
    }

    // Check if failed
    if (operation.status === 'failed' || operation.status === 'cancelled') {
      return {
        success: false,
        operation,
        totalTimeMs: Date.now() - startTime,
        pollCount,
        timedOut: false,
      };
    }
  }

  // Max polls reached
  const finalOperation = await checkStatus(jobId);
  return {
    success: false,
    operation: { ...finalOperation, status: 'timeout' },
    totalTimeMs: Date.now() - startTime,
    pollCount,
    timedOut: true,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// Singleton & Helpers
// =============================================================================

let globalAsyncStore: AsyncOperationStore | null = null;

/**
 * Get the global async operation store.
 */
export function getAsyncStore(): AsyncOperationStore {
  if (!globalAsyncStore) {
    globalAsyncStore = new AsyncOperationStore();
  }
  return globalAsyncStore;
}

/**
 * Check if a tool result indicates async processing.
 */
export function isAsyncResult(result: unknown): result is AsyncToolResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    'async' in result &&
    (result as AsyncToolResult).async === true
  );
}

/**
 * Generate a unique job ID for async operations.
 */
export function generateJobId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `job_${timestamp}_${random}`;
}

/**
 * Wrap a tool executor to handle async results automatically.
 */
export async function executeWithAsyncSupport<T>(
  execute: () => Promise<T>,
  checkStatus: (jobId: string) => Promise<AsyncOperation<T>>,
  pollingConfig?: PollingConfig
): Promise<T | undefined> {
  const result = await execute();

  // If not async, return directly
  if (!isAsyncResult(result)) {
    return result;
  }

  // If async, poll for completion
  if (!result.jobId) {
    throw new Error('Async result missing jobId');
  }

  const pollResult = await pollForCompletion<T>(
    result.jobId,
    checkStatus,
    {
      ...pollingConfig,
      initialIntervalMs: result.pollIntervalMs ?? pollingConfig?.initialIntervalMs,
    }
  );

  if (!pollResult.success) {
    if (pollResult.operation.error) {
      throw new Error(pollResult.operation.error.message);
    }
    throw new Error(`Async operation ${pollResult.timedOut ? 'timed out' : 'failed'}`);
  }

  return pollResult.operation.result;
}
