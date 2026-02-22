/**
 * AI Tool Reliability Module
 *
 * Provides reliability features for AI tool execution:
 * - Idempotency for mutation safety
 * - Retry with exponential backoff
 * - Circuit breaker for failure protection
 * - Async tool polling for long-running operations
 */

// Idempotency
export {
  IdempotencyStore,
  getIdempotencyStore,
  generateIdempotencyKey,
  shouldUseIdempotency,
  type IdempotencyRecord,
  type IdempotencyCheckResult,
  type IdempotencyConfig,
  type IdempotencyStats,
} from './idempotency';

// Retry & Circuit Breaker
export {
  withRetry,
  withTimeout,
  withReliability,
  CircuitBreaker,
  getCircuitBreaker,
  getAllCircuitBreakerStats,
  resetAllCircuitBreakers,
  type RetryConfig,
  type RetryResult,
  type CircuitState,
  type CircuitBreakerConfig,
  type CircuitBreakerStats,
} from './retry';

// Async Tools
export {
  AsyncOperationStore,
  getAsyncStore,
  pollForCompletion,
  isAsyncResult,
  generateJobId,
  executeWithAsyncSupport,
  type AsyncOperationStatus,
  type AsyncOperation,
  type PollingConfig,
  type AsyncToolResult,
  type PollingResult,
  type AsyncToolStats,
} from './async-tools';
