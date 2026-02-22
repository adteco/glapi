/**
 * AI Tool Retry & Circuit Breaker
 *
 * Provides retry logic with exponential backoff and circuit breaker pattern
 * to handle transient failures gracefully.
 *
 * @module retry
 */

import type { ExecutionResult } from '../generated/generated-executor';

// =============================================================================
// Types
// =============================================================================

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay between retries in ms (default: 1000) */
  initialDelayMs?: number;
  /** Maximum delay between retries in ms (default: 30000) */
  maxDelayMs?: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Add random jitter to delays (default: true) */
  jitter?: boolean;
  /** Timeout for each attempt in ms (default: 30000) */
  timeoutMs?: number;
  /** Function to determine if error is retryable */
  isRetryable?: (error: ExecutionResult['error']) => boolean;
  /** Callback on each retry */
  onRetry?: (attempt: number, error: ExecutionResult['error'], delayMs: number) => void;
}

/**
 * Result of retry operation
 */
export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: ExecutionResult['error'];
  attempts: number;
  totalTimeMs: number;
  retriedErrors: ExecutionResult['error'][];
}

/**
 * Circuit breaker state
 */
export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit (default: 5) */
  failureThreshold?: number;
  /** Success threshold to close circuit from half-open (default: 2) */
  successThreshold?: number;
  /** Time in ms before attempting half-open (default: 30000) */
  resetTimeoutMs?: number;
  /** Time window in ms for failure counting (default: 60000) */
  failureWindowMs?: number;
  /** Callback when state changes */
  onStateChange?: (from: CircuitState, to: CircuitState, toolName: string) => void;
}

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  consecutiveSuccesses: number;
  lastFailureTime?: number;
  lastStateChangeTime?: number;
  rejectedCalls: number;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_RETRY_CONFIG: Required<Omit<RetryConfig, 'isRetryable' | 'onRetry'>> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
  timeoutMs: 30000,
};

const DEFAULT_CIRCUIT_CONFIG: Required<Omit<CircuitBreakerConfig, 'onStateChange'>> = {
  failureThreshold: 5,
  successThreshold: 2,
  resetTimeoutMs: 30000,
  failureWindowMs: 60000,
};

// Default retryable error codes
const RETRYABLE_CODES = new Set([
  'INTERNAL_SERVER_ERROR',
  'SERVICE_UNAVAILABLE',
  'GATEWAY_TIMEOUT',
  'REQUEST_TIMEOUT',
  'TOO_MANY_REQUESTS',
  'RATE_LIMITED',
  'NETWORK_ERROR',
  'CONNECTION_REFUSED',
  'TIMEOUT',
]);

// =============================================================================
// Retry Implementation
// =============================================================================

/**
 * Execute a function with retry logic.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<RetryResult<T>> {
  const options = { ...DEFAULT_RETRY_CONFIG, ...config };
  const isRetryable = config.isRetryable ?? defaultIsRetryable;
  const retriedErrors: ExecutionResult['error'][] = [];

  const startTime = Date.now();
  let lastError: ExecutionResult['error'] | undefined;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      // Execute with timeout
      const result = await withTimeout(fn, options.timeoutMs);

      return {
        success: true,
        result,
        attempts: attempt,
        totalTimeMs: Date.now() - startTime,
        retriedErrors,
      };
    } catch (error) {
      lastError = normalizeError(error);

      // Don't retry if error is not retryable
      if (!isRetryable(lastError)) {
        return {
          success: false,
          error: lastError,
          attempts: attempt,
          totalTimeMs: Date.now() - startTime,
          retriedErrors,
        };
      }

      // Don't retry if this was the last attempt
      if (attempt >= options.maxAttempts) {
        break;
      }

      // Store this error
      retriedErrors.push(lastError);

      // Calculate delay with exponential backoff
      let delay = Math.min(
        options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt - 1),
        options.maxDelayMs
      );

      // Add jitter
      if (options.jitter) {
        delay = delay * (0.5 + Math.random());
      }

      // Notify about retry
      if (config.onRetry) {
        config.onRetry(attempt, lastError, delay);
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: options.maxAttempts,
    totalTimeMs: Date.now() - startTime,
    retriedErrors,
  };
}

/**
 * Execute a function with a timeout.
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    fn()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * Default function to determine if an error is retryable.
 */
function defaultIsRetryable(error: ExecutionResult['error'] | undefined): boolean {
  if (!error) return false;
  return error.retryable === true || RETRYABLE_CODES.has(error.code);
}

/**
 * Normalize various error types to ExecutionResult error format.
 */
function normalizeError(error: unknown): ExecutionResult['error'] {
  if (error && typeof error === 'object' && 'code' in error) {
    return error as ExecutionResult['error'];
  }

  if (error instanceof Error) {
    const code = error.message.includes('timed out') ? 'TIMEOUT' : 'EXECUTION_ERROR';
    return {
      code,
      message: error.message,
      retryable: code === 'TIMEOUT',
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: String(error),
    retryable: false,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// Circuit Breaker Implementation
// =============================================================================

/**
 * Circuit breaker to prevent cascading failures.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failing fast, requests rejected immediately
 * - HALF-OPEN: Testing if service recovered
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures: number[] = [];
  private successes = 0;
  private consecutiveSuccesses = 0;
  private lastStateChangeTime = Date.now();
  private rejectedCalls = 0;
  private config: Required<Omit<CircuitBreakerConfig, 'onStateChange'>>;
  private onStateChange?: CircuitBreakerConfig['onStateChange'];
  private toolName: string;

  constructor(toolName: string, config: CircuitBreakerConfig = {}) {
    this.toolName = toolName;
    this.config = { ...DEFAULT_CIRCUIT_CONFIG, ...config };
    this.onStateChange = config.onStateChange;
  }

  /**
   * Check if request can proceed.
   */
  canRequest(): boolean {
    this.cleanupOldFailures();

    switch (this.state) {
      case 'closed':
        return true;

      case 'open':
        // Check if reset timeout has passed
        if (Date.now() - this.lastStateChangeTime >= this.config.resetTimeoutMs) {
          this.transitionTo('half-open');
          return true;
        }
        this.rejectedCalls++;
        return false;

      case 'half-open':
        // Allow limited requests in half-open state
        return true;

      default:
        return false;
    }
  }

  /**
   * Record a successful call.
   */
  recordSuccess(): void {
    this.successes++;
    this.consecutiveSuccesses++;

    if (this.state === 'half-open') {
      // Check if we have enough consecutive successes to close
      if (this.consecutiveSuccesses >= this.config.successThreshold) {
        this.transitionTo('closed');
      }
    }
  }

  /**
   * Record a failed call.
   */
  recordFailure(): void {
    this.failures.push(Date.now());
    this.consecutiveSuccesses = 0;

    if (this.state === 'half-open') {
      // Any failure in half-open state reopens the circuit
      this.transitionTo('open');
    } else if (this.state === 'closed') {
      // Check if we should open the circuit
      this.cleanupOldFailures();
      if (this.failures.length >= this.config.failureThreshold) {
        this.transitionTo('open');
      }
    }
  }

  /**
   * Get current state.
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get statistics.
   */
  getStats(): CircuitBreakerStats {
    this.cleanupOldFailures();
    return {
      state: this.state,
      failures: this.failures.length,
      successes: this.successes,
      consecutiveSuccesses: this.consecutiveSuccesses,
      lastFailureTime: this.failures.length > 0 ? this.failures[this.failures.length - 1] : undefined,
      lastStateChangeTime: this.lastStateChangeTime,
      rejectedCalls: this.rejectedCalls,
    };
  }

  /**
   * Reset the circuit breaker.
   */
  reset(): void {
    this.failures = [];
    this.successes = 0;
    this.consecutiveSuccesses = 0;
    this.rejectedCalls = 0;
    this.transitionTo('closed');
  }

  // Private methods

  private transitionTo(newState: CircuitState): void {
    if (this.state === newState) return;

    const oldState = this.state;
    this.state = newState;
    this.lastStateChangeTime = Date.now();

    if (newState === 'closed') {
      this.failures = [];
    }

    if (this.onStateChange) {
      this.onStateChange(oldState, newState, this.toolName);
    }
  }

  private cleanupOldFailures(): void {
    const cutoff = Date.now() - this.config.failureWindowMs;
    this.failures = this.failures.filter((time) => time > cutoff);
  }
}

// =============================================================================
// Circuit Breaker Registry
// =============================================================================

const circuitBreakers = new Map<string, CircuitBreaker>();

/**
 * Get or create a circuit breaker for a tool.
 */
export function getCircuitBreaker(
  toolName: string,
  config?: CircuitBreakerConfig
): CircuitBreaker {
  let breaker = circuitBreakers.get(toolName);
  if (!breaker) {
    breaker = new CircuitBreaker(toolName, config);
    circuitBreakers.set(toolName, breaker);
  }
  return breaker;
}

/**
 * Get all circuit breaker statistics.
 */
export function getAllCircuitBreakerStats(): Record<string, CircuitBreakerStats> {
  const stats: Record<string, CircuitBreakerStats> = {};
  for (const [name, breaker] of circuitBreakers.entries()) {
    stats[name] = breaker.getStats();
  }
  return stats;
}

/**
 * Reset all circuit breakers.
 */
export function resetAllCircuitBreakers(): void {
  for (const breaker of circuitBreakers.values()) {
    breaker.reset();
  }
}

// =============================================================================
// Combined Executor with Retry & Circuit Breaker
// =============================================================================

/**
 * Execute a function with both retry logic and circuit breaker protection.
 */
export async function withReliability<T>(
  toolName: string,
  fn: () => Promise<T>,
  options: {
    retry?: RetryConfig;
    circuitBreaker?: CircuitBreakerConfig;
  } = {}
): Promise<RetryResult<T>> {
  const breaker = getCircuitBreaker(toolName, options.circuitBreaker);

  // Check circuit breaker
  if (!breaker.canRequest()) {
    return {
      success: false,
      error: {
        code: 'CIRCUIT_OPEN',
        message: `Circuit breaker is open for tool: ${toolName}. Service may be unavailable.`,
        retryable: false,
      },
      attempts: 0,
      totalTimeMs: 0,
      retriedErrors: [],
    };
  }

  // Execute with retry
  const result = await withRetry(fn, {
    ...options.retry,
    onRetry: (attempt, error, delay) => {
      // Record failure on each retry
      breaker.recordFailure();
      options.retry?.onRetry?.(attempt, error, delay);
    },
  });

  // Update circuit breaker based on final result
  if (result.success) {
    breaker.recordSuccess();
  } else {
    breaker.recordFailure();
  }

  return result;
}
