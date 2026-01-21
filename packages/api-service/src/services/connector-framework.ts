/**
 * External Connector Framework
 *
 * This module provides a robust framework for building integrations with external services
 * such as banks, payroll systems, CRM platforms, and more.
 *
 * Features:
 * - Multiple authentication methods (OAuth2, API Key, Basic, Bearer)
 * - Rate limiting with queue support
 * - Retry logic with configurable backoff strategies
 * - Circuit breaker pattern
 * - Monitoring hooks for observability
 * - Health checks
 */

// Import types directly from connector.types to avoid database dependency chain
import type {
  AuthMethod,
  ConnectorCredentials,
  OAuth2Credentials,
  ApiKeyCredentials,
  BasicAuthCredentials,
  BearerTokenCredentials,
  RateLimitConfig,
  RateLimitState,
  RateLimitWindow,
  RetryPolicy,
  RetryAttempt,
  BackoffStrategy,
  ConnectorRequest,
  ConnectorResponse,
  ConnectorError,
  HealthCheckResult,
  HealthStatus,
  ConnectorMetrics,
  MonitoringEvent,
  MonitoringEventType,
  MonitoringHooks,
  CircuitBreakerConfig,
  CircuitBreakerState,
  ConnectorConfig,
  ConnectorState,
  ConnectionTestResult,
  ConnectorTypeDefinition,
} from '../types/connector.types';

// Re-export types for consumers
export type {
  ConnectorConfig,
  ConnectionTestResult,
  CircuitBreakerConfig,
  ConnectorCredentials,
  OAuth2Credentials,
  ApiKeyCredentials,
  RateLimitConfig,
  RetryPolicy,
  HealthCheckResult,
  ConnectorMetrics,
  MonitoringHooks,
};

// ============================================================================
// Self-contained types to avoid database dependency
// ============================================================================

/**
 * Service context - self-contained to avoid database import
 */
export interface ConnectorServiceContext {
  organizationId?: string;
  userId?: string;
}

/**
 * Connector-specific error class
 */
export class ConnectorServiceError extends Error {
  code: string;
  statusCode: number;
  details?: Record<string, unknown>;

  constructor(message: string, code: string, statusCode: number = 400, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ConnectorServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Base class for connector services - self-contained
 */
export abstract class ConnectorBaseService {
  protected context: ConnectorServiceContext;

  constructor(context: ConnectorServiceContext = {}) {
    this.context = context;
  }

  protected requireOrganizationContext(): string {
    if (!this.context.organizationId) {
      throw new ConnectorServiceError(
        'Organization context is required for this operation',
        'MISSING_ORGANIZATION_CONTEXT',
        401
      );
    }
    return this.context.organizationId;
  }

  protected requireUserContext(): string {
    if (!this.context.userId) {
      throw new ConnectorServiceError(
        'User context is required for this operation',
        'MISSING_USER_CONTEXT',
        401
      );
    }
    return this.context.userId;
  }
}

// ============================================================================
// Authentication Providers
// ============================================================================

/**
 * Base interface for authentication providers
 */
export interface AuthProvider {
  readonly method: AuthMethod;
  getAuthHeaders(): Promise<Record<string, string>>;
  refreshIfNeeded(): Promise<boolean>;
  isExpired(): boolean;
  getExpiresAt(): Date | undefined;
}

/**
 * OAuth2 authentication provider
 */
export class OAuth2AuthProvider implements AuthProvider {
  readonly method: AuthMethod = 'oauth2';
  private credentials: OAuth2Credentials;
  private httpClient: HttpClientInterface;
  private tokenRefreshBuffer: number = 5 * 60 * 1000; // 5 minutes

  constructor(credentials: OAuth2Credentials, httpClient?: HttpClientInterface) {
    this.credentials = credentials;
    this.httpClient = httpClient ?? new DefaultHttpClient();
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    await this.refreshIfNeeded();
    if (!this.credentials.accessToken) {
      throw new Error('No access token available');
    }
    const tokenType = this.credentials.tokenType ?? 'Bearer';
    return {
      Authorization: `${tokenType} ${this.credentials.accessToken}`,
    };
  }

  async refreshIfNeeded(): Promise<boolean> {
    if (!this.shouldRefresh()) {
      return false;
    }

    if (!this.credentials.refreshToken && this.credentials.grantType !== 'client_credentials') {
      throw new Error('No refresh token available and not using client_credentials grant');
    }

    try {
      const tokenResponse = await this.requestToken();
      this.credentials.accessToken = tokenResponse.access_token;
      if (tokenResponse.refresh_token) {
        this.credentials.refreshToken = tokenResponse.refresh_token;
      }
      if (tokenResponse.expires_in) {
        this.credentials.expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);
      }
      this.credentials.lastRefreshedAt = new Date();
      return true;
    } catch (error) {
      throw new Error(`Failed to refresh OAuth2 token: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  isExpired(): boolean {
    if (!this.credentials.expiresAt) {
      return false;
    }
    return Date.now() >= this.credentials.expiresAt.getTime();
  }

  getExpiresAt(): Date | undefined {
    return this.credentials.expiresAt;
  }

  private shouldRefresh(): boolean {
    if (!this.credentials.accessToken) {
      return true;
    }
    if (!this.credentials.expiresAt) {
      return false;
    }
    return Date.now() >= this.credentials.expiresAt.getTime() - this.tokenRefreshBuffer;
  }

  private async requestToken(): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
  }> {
    const params = new URLSearchParams();

    if (this.credentials.grantType === 'client_credentials') {
      params.set('grant_type', 'client_credentials');
      params.set('client_id', this.credentials.clientId);
      params.set('client_secret', this.credentials.clientSecret);
    } else if (this.credentials.grantType === 'refresh_token' && this.credentials.refreshToken) {
      params.set('grant_type', 'refresh_token');
      params.set('refresh_token', this.credentials.refreshToken);
      params.set('client_id', this.credentials.clientId);
      params.set('client_secret', this.credentials.clientSecret);
    } else {
      throw new Error(`Unsupported grant type: ${this.credentials.grantType}`);
    }

    if (this.credentials.scope?.length) {
      params.set('scope', this.credentials.scope.join(' '));
    }

    const response = await this.httpClient.post(this.credentials.tokenUrl, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (response.status !== 200) {
      throw new Error(`Token request failed with status ${response.status}: ${response.body}`);
    }

    return JSON.parse(response.body);
  }
}

/**
 * API Key authentication provider
 */
export class ApiKeyAuthProvider implements AuthProvider {
  readonly method: AuthMethod = 'api_key';
  private credentials: ApiKeyCredentials;

  constructor(credentials: ApiKeyCredentials) {
    this.credentials = credentials;
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    if (this.credentials.placement === 'query') {
      return {}; // Query params are handled separately
    }
    const headerName = this.credentials.headerName ?? 'X-API-Key';
    return {
      [headerName]: this.credentials.apiKey,
    };
  }

  getAuthQueryParams(): Record<string, string> {
    if (this.credentials.placement !== 'query') {
      return {};
    }
    const paramName = this.credentials.queryParamName ?? 'api_key';
    return {
      [paramName]: this.credentials.apiKey,
    };
  }

  async refreshIfNeeded(): Promise<boolean> {
    return false; // API keys don't need refresh
  }

  isExpired(): boolean {
    return false; // API keys don't expire (from our perspective)
  }

  getExpiresAt(): Date | undefined {
    return this.credentials.expiresAt;
  }
}

/**
 * Basic Auth provider
 */
export class BasicAuthProvider implements AuthProvider {
  readonly method: AuthMethod = 'basic';
  private credentials: BasicAuthCredentials;

  constructor(credentials: BasicAuthCredentials) {
    this.credentials = credentials;
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    const encoded = Buffer.from(
      `${this.credentials.username}:${this.credentials.password}`
    ).toString('base64');
    return {
      Authorization: `Basic ${encoded}`,
    };
  }

  async refreshIfNeeded(): Promise<boolean> {
    return false;
  }

  isExpired(): boolean {
    return false;
  }

  getExpiresAt(): Date | undefined {
    return this.credentials.expiresAt;
  }
}

/**
 * Bearer token provider
 */
export class BearerTokenProvider implements AuthProvider {
  readonly method: AuthMethod = 'bearer';
  private credentials: BearerTokenCredentials;

  constructor(credentials: BearerTokenCredentials) {
    this.credentials = credentials;
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    return {
      Authorization: `Bearer ${this.credentials.token}`,
    };
  }

  async refreshIfNeeded(): Promise<boolean> {
    return false;
  }

  isExpired(): boolean {
    if (!this.credentials.expiresAt) return false;
    return Date.now() >= this.credentials.expiresAt.getTime();
  }

  getExpiresAt(): Date | undefined {
    return this.credentials.expiresAt;
  }
}

/**
 * Custom auth provider (no-op)
 * Used when subclasses handle authentication themselves
 */
export class CustomAuthProvider implements AuthProvider {
  readonly method: AuthMethod = 'custom';

  async getAuthHeaders(): Promise<Record<string, string>> {
    // Custom auth is handled by the connector subclass
    return {};
  }

  async refreshIfNeeded(): Promise<boolean> {
    return false;
  }

  isExpired(): boolean {
    return false;
  }

  getExpiresAt(): Date | undefined {
    return undefined;
  }
}

/**
 * Create an auth provider from credentials
 */
export function createAuthProvider(
  credentials: ConnectorCredentials,
  httpClient?: HttpClientInterface
): AuthProvider {
  switch (credentials.method) {
    case 'oauth2':
      return new OAuth2AuthProvider(credentials as OAuth2Credentials, httpClient);
    case 'api_key':
      return new ApiKeyAuthProvider(credentials as ApiKeyCredentials);
    case 'basic':
      return new BasicAuthProvider(credentials as BasicAuthCredentials);
    case 'bearer':
      return new BearerTokenProvider(credentials as BearerTokenCredentials);
    case 'custom':
      // Return a no-op auth provider for custom auth
      // Subclasses should override auth handling
      return new CustomAuthProvider();
    default:
      throw new Error(`Unsupported auth method: ${(credentials as any).method}`);
  }
}

// ============================================================================
// Rate Limiter
// ============================================================================

/**
 * Rate limiter implementation with sliding window
 */
export class RateLimiter {
  private config: RateLimitConfig;
  private requests: number[] = [];
  private queue: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
  }> = [];
  private windowMs: number;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.windowMs = config.windowMs ?? this.getWindowMs(config.window);
  }

  private getWindowMs(window: RateLimitWindow): number {
    switch (window) {
      case 'second':
        return 1000;
      case 'minute':
        return 60 * 1000;
      case 'hour':
        return 60 * 60 * 1000;
      case 'day':
        return 24 * 60 * 60 * 1000;
      default:
        return 60 * 1000;
    }
  }

  /**
   * Acquire a slot for making a request
   * @returns Promise that resolves when a slot is available
   */
  async acquire(): Promise<void> {
    this.cleanExpiredRequests();

    const effectiveLimit = this.config.maxRequests + (this.config.burstLimit ?? 0);

    if (this.requests.length < effectiveLimit) {
      this.requests.push(Date.now());
      return;
    }

    if (!this.config.queueWhenLimited) {
      throw new Error('Rate limit exceeded');
    }

    if (this.config.maxQueueSize && this.queue.length >= this.config.maxQueueSize) {
      throw new Error('Rate limit queue is full');
    }

    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject });
      this.scheduleQueueProcessing();
    });
  }

  /**
   * Handle Retry-After header from response
   */
  handleRetryAfter(retryAfterSeconds: number): void {
    if (!this.config.respectRetryAfter) return;
    // Add artificial requests to block until retry-after expires
    const futureTime = Date.now() + retryAfterSeconds * 1000;
    for (let i = 0; i < this.config.maxRequests; i++) {
      this.requests.push(futureTime);
    }
  }

  /**
   * Get current rate limit state
   */
  getState(): RateLimitState {
    this.cleanExpiredRequests();
    const now = Date.now();
    const windowStart = new Date(now - this.windowMs);
    const windowEnd = new Date(now);

    const effectiveLimit = this.config.maxRequests + (this.config.burstLimit ?? 0);
    const isLimited = this.requests.length >= effectiveLimit;

    let resetIn: number | undefined;
    if (this.requests.length > 0) {
      const oldestRequest = Math.min(...this.requests);
      resetIn = Math.max(0, oldestRequest + this.windowMs - now);
    }

    return {
      requestCount: this.requests.length,
      windowStart,
      windowEnd,
      isLimited,
      queuedRequests: this.queue.length,
      resetIn,
    };
  }

  private cleanExpiredRequests(): void {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    this.requests = this.requests.filter((time) => time > cutoff);
  }

  private scheduleQueueProcessing(): void {
    if (this.requests.length === 0) {
      this.processQueue();
      return;
    }

    const oldestRequest = Math.min(...this.requests);
    const waitTime = Math.max(0, oldestRequest + this.windowMs - Date.now() + 10);

    setTimeout(() => this.processQueue(), waitTime);
  }

  private processQueue(): void {
    this.cleanExpiredRequests();

    const effectiveLimit = this.config.maxRequests + (this.config.burstLimit ?? 0);

    while (this.queue.length > 0 && this.requests.length < effectiveLimit) {
      const item = this.queue.shift();
      if (item) {
        this.requests.push(Date.now());
        item.resolve();
      }
    }

    if (this.queue.length > 0) {
      this.scheduleQueueProcessing();
    }
  }
}

// ============================================================================
// Retry Handler
// ============================================================================

/**
 * Default retry policy
 */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffStrategy: 'exponential',
  backoffMultiplier: 2,
  jitterFactor: 0.2,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  retryableErrorCodes: ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND'],
  retryOnTimeout: true,
  retryOnNetworkError: true,
};

/**
 * Retry handler with configurable backoff strategies
 */
export class RetryHandler {
  private policy: RetryPolicy;
  private fibonacciCache: number[] = [1, 1];

  constructor(policy: Partial<RetryPolicy> = {}) {
    this.policy = { ...DEFAULT_RETRY_POLICY, ...policy };
  }

  /**
   * Execute a function with retry logic
   */
  async execute<T>(
    fn: () => Promise<T>,
    onRetry?: (attempt: RetryAttempt) => void
  ): Promise<T> {
    let lastError: Error | undefined;
    let attempts: RetryAttempt[] = [];

    for (let attempt = 1; attempt <= this.policy.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        const shouldRetry = this.shouldRetry(error, attempt);

        if (!shouldRetry) {
          throw error;
        }

        const delay = this.calculateDelay(attempt);
        const retryAttempt: RetryAttempt = {
          attemptNumber: attempt,
          error: lastError,
          delayMs: delay,
          timestamp: new Date(),
        };
        attempts.push(retryAttempt);

        if (onRetry) {
          onRetry(retryAttempt);
        }

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Check if an error should trigger a retry
   */
  shouldRetry(error: unknown, attempt: number): boolean {
    if (attempt >= this.policy.maxAttempts) {
      return false;
    }

    // Check for timeout errors
    if (this.policy.retryOnTimeout && this.isTimeoutError(error)) {
      return true;
    }

    // Check for network errors
    if (this.policy.retryOnNetworkError && this.isNetworkError(error)) {
      return true;
    }

    // Check HTTP status codes
    if (this.policy.retryableStatusCodes && this.isHttpError(error)) {
      const statusCode = this.getStatusCode(error);
      if (statusCode && this.policy.retryableStatusCodes.includes(statusCode)) {
        return true;
      }
    }

    // Check error codes
    if (this.policy.retryableErrorCodes) {
      const errorCode = this.getErrorCode(error);
      if (errorCode && this.policy.retryableErrorCodes.includes(errorCode)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate delay for a given attempt using the configured strategy
   */
  calculateDelay(attempt: number): number {
    let baseDelay: number;

    switch (this.policy.backoffStrategy) {
      case 'constant':
        baseDelay = this.policy.initialDelayMs;
        break;
      case 'linear':
        baseDelay = this.policy.initialDelayMs * attempt * (this.policy.backoffMultiplier ?? 1);
        break;
      case 'fibonacci':
        baseDelay = this.policy.initialDelayMs * this.getFibonacci(attempt);
        break;
      case 'exponential':
      default:
        baseDelay =
          this.policy.initialDelayMs *
          Math.pow(this.policy.backoffMultiplier ?? 2, attempt - 1);
        break;
    }

    // Apply max delay cap
    baseDelay = Math.min(baseDelay, this.policy.maxDelayMs);

    // Apply jitter
    if (this.policy.jitterFactor) {
      const jitter = baseDelay * this.policy.jitterFactor * Math.random();
      baseDelay += jitter;
    }

    return Math.floor(baseDelay);
  }

  private getFibonacci(n: number): number {
    while (this.fibonacciCache.length <= n) {
      const len = this.fibonacciCache.length;
      this.fibonacciCache.push(this.fibonacciCache[len - 1] + this.fibonacciCache[len - 2]);
    }
    return this.fibonacciCache[n - 1];
  }

  private isTimeoutError(error: unknown): boolean {
    if (error instanceof Error) {
      return (
        error.name === 'TimeoutError' ||
        error.message.toLowerCase().includes('timeout') ||
        error.message.includes('ETIMEDOUT')
      );
    }
    return false;
  }

  private isNetworkError(error: unknown): boolean {
    if (error instanceof Error) {
      const networkErrors = ['ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'ENETUNREACH'];
      return networkErrors.some((e) => error.message.includes(e));
    }
    return false;
  }

  private isHttpError(error: unknown): boolean {
    return (
      error instanceof Error &&
      'statusCode' in error &&
      typeof (error as any).statusCode === 'number'
    );
  }

  private getStatusCode(error: unknown): number | undefined {
    if (error instanceof Error && 'statusCode' in error) {
      return (error as any).statusCode;
    }
    return undefined;
  }

  private getErrorCode(error: unknown): string | undefined {
    if (error instanceof Error && 'code' in error) {
      return (error as any).code;
    }
    return undefined;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Circuit Breaker
// ============================================================================

/**
 * Default circuit breaker configuration
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  enabled: true,
  failureThreshold: 5,
  successThreshold: 3,
  resetTimeoutMs: 30000,
  windowSize: 10,
};

/**
 * Circuit breaker implementation
 */
export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitBreakerState = 'closed';
  private failures: number[] = [];
  private successes: number = 0;
  private lastFailureTime?: number;
  private onStateChange?: (state: CircuitBreakerState) => void;

  constructor(config: Partial<CircuitBreakerConfig> = {}, onStateChange?: (state: CircuitBreakerState) => void) {
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
    this.onStateChange = onStateChange;
  }

  /**
   * Execute a function through the circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.config.enabled) {
      return fn();
    }

    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.transitionTo('half-open');
      } else {
        throw new CircuitBreakerOpenError('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Record a successful execution
   */
  recordSuccess(): void {
    if (this.state === 'half-open') {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.transitionTo('closed');
      }
    }
    // In closed state, just clean old failures
    this.cleanOldFailures();
  }

  /**
   * Record a failed execution
   */
  recordFailure(): void {
    const now = Date.now();
    this.failures.push(now);
    this.lastFailureTime = now;
    this.cleanOldFailures();

    if (this.state === 'half-open') {
      // Any failure in half-open state immediately opens the circuit
      this.transitionTo('open');
    } else if (this.state === 'closed') {
      if (this.failures.length >= this.config.failureThreshold) {
        this.transitionTo('open');
      }
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Force the circuit to a specific state
   */
  forceState(state: CircuitBreakerState): void {
    this.transitionTo(state);
  }

  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.failures = [];
    this.successes = 0;
    this.lastFailureTime = undefined;
    this.transitionTo('closed');
  }

  private transitionTo(newState: CircuitBreakerState): void {
    if (newState === this.state) return;

    const oldState = this.state;
    this.state = newState;

    if (newState === 'closed') {
      this.failures = [];
      this.successes = 0;
    } else if (newState === 'half-open') {
      this.successes = 0;
    }

    if (this.onStateChange) {
      this.onStateChange(newState);
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return true;
    return Date.now() - this.lastFailureTime >= this.config.resetTimeoutMs;
  }

  private cleanOldFailures(): void {
    const now = Date.now();
    const windowMs = this.config.resetTimeoutMs;
    this.failures = this.failures.filter((time) => now - time < windowMs);
  }
}

/**
 * Error thrown when circuit breaker is open
 */
export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

// ============================================================================
// HTTP Client Interface
// ============================================================================

export interface HttpClientInterface {
  request(
    method: string,
    url: string,
    options: {
      headers?: Record<string, string>;
      body?: string;
      timeout?: number;
    }
  ): Promise<{ status: number; body: string; headers: Record<string, string> }>;

  post(
    url: string,
    options: {
      headers?: Record<string, string>;
      body?: string;
      timeout?: number;
    }
  ): Promise<{ status: number; body: string; headers: Record<string, string> }>;

  get(
    url: string,
    options?: {
      headers?: Record<string, string>;
      timeout?: number;
    }
  ): Promise<{ status: number; body: string; headers: Record<string, string> }>;
}

/**
 * Default HTTP client using fetch
 */
export class DefaultHttpClient implements HttpClientInterface {
  async request(
    method: string,
    url: string,
    options: { headers?: Record<string, string>; body?: string; timeout?: number }
  ): Promise<{ status: number; body: string; headers: Record<string, string> }> {
    const controller = new AbortController();
    const timeout = options.timeout ?? 30000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: options.headers,
        body: options.body,
        signal: controller.signal,
      });

      const body = await response.text();
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return { status: response.status, body, headers };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async post(
    url: string,
    options: { headers?: Record<string, string>; body?: string; timeout?: number }
  ): Promise<{ status: number; body: string; headers: Record<string, string> }> {
    return this.request('POST', url, options);
  }

  async get(
    url: string,
    options?: { headers?: Record<string, string>; timeout?: number }
  ): Promise<{ status: number; body: string; headers: Record<string, string> }> {
    return this.request('GET', url, options ?? {});
  }
}

// ============================================================================
// Monitoring Manager
// ============================================================================

/**
 * Monitoring manager for tracking connector metrics
 */
export class MonitoringManager {
  private connectorId: string;
  private connectorType: string;
  private hooks: MonitoringHooks;
  private latencies: number[] = [];
  private metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    retriedRequests: number;
    rateLimitedRequests: number;
  } = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    retriedRequests: 0,
    rateLimitedRequests: 0,
  };
  private healthStatus: HealthStatus = 'unknown';
  private lastSuccessfulRequest?: Date;
  private lastFailedRequest?: Date;
  private maxLatencySamples: number = 1000;

  constructor(connectorId: string, connectorType: string, hooks: MonitoringHooks = {}) {
    this.connectorId = connectorId;
    this.connectorType = connectorType;
    this.hooks = hooks;
  }

  /**
   * Emit a monitoring event
   */
  async emit(type: MonitoringEventType, data: Partial<MonitoringEvent> = {}): Promise<void> {
    const event: MonitoringEvent = {
      type,
      connectorId: this.connectorId,
      connectorType: this.connectorType,
      timestamp: new Date(),
      ...data,
    };

    // Update internal metrics
    this.updateMetrics(event);

    // Call appropriate hook
    const hookMap: Record<MonitoringEventType, keyof MonitoringHooks> = {
      request_start: 'onRequestStart',
      request_success: 'onRequestSuccess',
      request_failure: 'onRequestFailure',
      request_retry: 'onRequestRetry',
      rate_limit_hit: 'onRateLimitHit',
      auth_refresh: 'onAuthRefresh',
      auth_failure: 'onAuthFailure',
      health_check: 'onHealthCheck',
      circuit_breaker_open: 'onRequestFailure',
      circuit_breaker_close: 'onRequestSuccess',
    };

    const hookName = hookMap[type];
    const hook = this.hooks[hookName];
    if (hook) {
      try {
        await hook(event);
      } catch (error) {
        console.error(`Monitoring hook error for ${type}:`, error);
      }
    }
  }

  /**
   * Record request latency
   */
  recordLatency(durationMs: number): void {
    this.latencies.push(durationMs);
    if (this.latencies.length > this.maxLatencySamples) {
      this.latencies.shift();
    }
  }

  /**
   * Update health status
   */
  setHealthStatus(status: HealthStatus): void {
    this.healthStatus = status;
  }

  /**
   * Get current metrics
   */
  getMetrics(): ConnectorMetrics {
    const sortedLatencies = [...this.latencies].sort((a, b) => a - b);
    const avgLatencyMs =
      sortedLatencies.length > 0
        ? sortedLatencies.reduce((a, b) => a + b, 0) / sortedLatencies.length
        : 0;
    const p95Index = Math.floor(sortedLatencies.length * 0.95);
    const p99Index = Math.floor(sortedLatencies.length * 0.99);

    return {
      totalRequests: this.metrics.totalRequests,
      successfulRequests: this.metrics.successfulRequests,
      failedRequests: this.metrics.failedRequests,
      retriedRequests: this.metrics.retriedRequests,
      rateLimitedRequests: this.metrics.rateLimitedRequests,
      avgLatencyMs: Math.round(avgLatencyMs),
      p95LatencyMs: sortedLatencies[p95Index] ?? 0,
      p99LatencyMs: sortedLatencies[p99Index] ?? 0,
      requestsPerMinute: this.calculateRequestsPerMinute(),
      errorRate:
        this.metrics.totalRequests > 0
          ? this.metrics.failedRequests / this.metrics.totalRequests
          : 0,
      health: this.healthStatus,
      timestamp: new Date(),
    };
  }

  private updateMetrics(event: MonitoringEvent): void {
    switch (event.type) {
      case 'request_start':
        this.metrics.totalRequests++;
        break;
      case 'request_success':
        this.metrics.successfulRequests++;
        this.lastSuccessfulRequest = event.timestamp;
        if (event.durationMs) {
          this.recordLatency(event.durationMs);
        }
        break;
      case 'request_failure':
        this.metrics.failedRequests++;
        this.lastFailedRequest = event.timestamp;
        if (event.durationMs) {
          this.recordLatency(event.durationMs);
        }
        break;
      case 'request_retry':
        this.metrics.retriedRequests++;
        break;
      case 'rate_limit_hit':
        this.metrics.rateLimitedRequests++;
        break;
    }
  }

  private calculateRequestsPerMinute(): number {
    // Simplified calculation - in production would use sliding window
    return this.metrics.totalRequests / Math.max(1, this.latencies.length / 60);
  }
}

// ============================================================================
// Base Connector
// ============================================================================

/**
 * Abstract base class for external connectors
 */
export abstract class BaseConnector extends ConnectorBaseService {
  protected config: ConnectorConfig;
  protected authProvider: AuthProvider;
  protected rateLimiter?: RateLimiter;
  protected retryHandler: RetryHandler;
  protected circuitBreaker: CircuitBreaker;
  protected httpClient: HttpClientInterface;
  protected monitoring: MonitoringManager;
  protected state: ConnectorState;

  constructor(
    context: ConnectorServiceContext,
    config: ConnectorConfig,
    httpClient?: HttpClientInterface
  ) {
    super(context);
    this.config = config;
    this.httpClient = httpClient ?? new DefaultHttpClient();
    this.authProvider = createAuthProvider(config.credentials, this.httpClient);

    if (config.rateLimit) {
      this.rateLimiter = new RateLimiter(config.rateLimit);
    }

    this.retryHandler = new RetryHandler(config.retryPolicy);

    this.circuitBreaker = new CircuitBreaker(
      config.circuitBreaker,
      (newState) => {
        const eventType: MonitoringEventType =
          newState === 'open' ? 'circuit_breaker_open' : 'circuit_breaker_close';
        this.monitoring.emit(eventType, {
          metadata: { circuitState: newState },
        });
      }
    );

    this.monitoring = new MonitoringManager(
      config.id,
      config.type,
      config.monitoring
    );

    this.state = {
      circuitBreakerState: 'closed',
      isHealthy: true,
      recentErrors: [],
      startedAt: new Date(),
    };
  }

  /**
   * Make an authenticated request to the external service
   */
  protected async request<T = unknown>(
    request: ConnectorRequest
  ): Promise<ConnectorResponse<T>> {
    const startTime = Date.now();

    // Emit request start event
    await this.monitoring.emit('request_start', { request });

    try {
      // Check circuit breaker
      return await this.circuitBreaker.execute(async () => {
        // Acquire rate limit slot
        if (this.rateLimiter) {
          try {
            await this.rateLimiter.acquire();
          } catch (error) {
            await this.monitoring.emit('rate_limit_hit', { request });
            throw error;
          }
        }

        // Get auth headers
        let authHeaders: Record<string, string> = {};
        if (!request.skipAuth) {
          try {
            const refreshed = await this.authProvider.refreshIfNeeded();
            if (refreshed) {
              await this.monitoring.emit('auth_refresh');
            }
            authHeaders = await this.authProvider.getAuthHeaders();
          } catch (error) {
            await this.monitoring.emit('auth_failure', {
              error: this.createConnectorError(error as Error, request),
            });
            throw error;
          }
        }

        // Build URL
        const url = this.buildUrl(request);

        // Merge headers
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...this.config.defaultHeaders,
          ...authHeaders,
          ...request.headers,
        };

        // Add idempotency key if provided
        if (request.idempotencyKey) {
          headers['Idempotency-Key'] = request.idempotencyKey;
        }

        // Execute request with retry
        let retryAttempts = 0;
        const mergedRetryPolicy = {
          ...this.config.retryPolicy,
          ...request.retryPolicy,
        };
        const requestRetryHandler = new RetryHandler(mergedRetryPolicy);

        const response = await requestRetryHandler.execute(
          async () => {
            const httpResponse = await this.httpClient.request(
              request.method,
              url,
              {
                headers,
                body: request.body ? JSON.stringify(request.body) : undefined,
                timeout: request.timeout ?? this.config.defaultTimeoutMs,
              }
            );

            // Handle rate limit headers
            const retryAfter = httpResponse.headers['retry-after'];
            if (retryAfter && this.rateLimiter) {
              this.rateLimiter.handleRetryAfter(parseInt(retryAfter, 10));
            }

            // Check for error status
            if (httpResponse.status >= 400) {
              const error = new Error(
                `HTTP ${httpResponse.status}: ${httpResponse.body.substring(0, 200)}`
              ) as Error & { statusCode: number };
              error.statusCode = httpResponse.status;
              throw error;
            }

            return httpResponse;
          },
          (attempt) => {
            retryAttempts++;
            this.monitoring.emit('request_retry', {
              request,
              metadata: {
                attemptNumber: attempt.attemptNumber,
                delayMs: attempt.delayMs,
                error: attempt.error?.message,
              },
            });
          }
        );

        const durationMs = Date.now() - startTime;

        // Parse response
        let data: T;
        try {
          data = response.body ? JSON.parse(response.body) : ({} as T);
        } catch {
          data = response.body as unknown as T;
        }

        // Extract rate limit info from headers
        const rateLimit = this.extractRateLimitHeaders(response.headers);

        const connectorResponse: ConnectorResponse<T> = {
          data,
          status: response.status,
          headers: response.headers,
          durationMs,
          retryAttempts,
          rateLimit,
        };

        // Emit success event
        await this.monitoring.emit('request_success', {
          request,
          response: connectorResponse,
          durationMs,
        });

        // Update state
        this.state.lastRequestAt = new Date();
        this.state.isHealthy = true;

        return connectorResponse;
      });
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const connectorError = this.createConnectorError(error as Error, request);

      // Track recent errors
      this.state.recentErrors.push(connectorError);
      if (this.state.recentErrors.length > 10) {
        this.state.recentErrors.shift();
      }

      // Emit failure event
      await this.monitoring.emit('request_failure', {
        request,
        error: connectorError,
        durationMs,
      });

      throw connectorError;
    }
  }

  /**
   * GET request helper
   */
  protected async get<T = unknown>(
    path: string,
    options: Omit<ConnectorRequest, 'method' | 'path'> = {}
  ): Promise<ConnectorResponse<T>> {
    return this.request<T>({ method: 'GET', path, ...options });
  }

  /**
   * POST request helper
   */
  protected async post<T = unknown>(
    path: string,
    body?: unknown,
    options: Omit<ConnectorRequest, 'method' | 'path' | 'body'> = {}
  ): Promise<ConnectorResponse<T>> {
    return this.request<T>({ method: 'POST', path, body, ...options });
  }

  /**
   * PUT request helper
   */
  protected async put<T = unknown>(
    path: string,
    body?: unknown,
    options: Omit<ConnectorRequest, 'method' | 'path' | 'body'> = {}
  ): Promise<ConnectorResponse<T>> {
    return this.request<T>({ method: 'PUT', path, body, ...options });
  }

  /**
   * PATCH request helper
   */
  protected async patch<T = unknown>(
    path: string,
    body?: unknown,
    options: Omit<ConnectorRequest, 'method' | 'path' | 'body'> = {}
  ): Promise<ConnectorResponse<T>> {
    return this.request<T>({ method: 'PATCH', path, body, ...options });
  }

  /**
   * DELETE request helper
   */
  protected async delete<T = unknown>(
    path: string,
    options: Omit<ConnectorRequest, 'method' | 'path'> = {}
  ): Promise<ConnectorResponse<T>> {
    return this.request<T>({ method: 'DELETE', path, ...options });
  }

  /**
   * Test the connection to the external service
   */
  abstract testConnection(): Promise<ConnectionTestResult>;

  /**
   * Perform a health check
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const testResult = await this.testConnection();
      const latencyMs = Date.now() - startTime;

      const result: HealthCheckResult = {
        status: testResult.success ? 'healthy' : 'unhealthy',
        latencyMs,
        lastSuccessfulRequest: this.state.lastRequestAt,
        message: testResult.message,
        details: testResult.details,
      };

      this.state.lastHealthCheck = result;
      this.monitoring.setHealthStatus(result.status);

      await this.monitoring.emit('health_check', {
        metadata: { result },
      });

      return result;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const result: HealthCheckResult = {
        status: 'unhealthy',
        latencyMs,
        message: error instanceof Error ? error.message : String(error),
      };

      this.state.lastHealthCheck = result;
      this.monitoring.setHealthStatus('unhealthy');

      await this.monitoring.emit('health_check', {
        metadata: { result },
        error: this.createConnectorError(error as Error),
      });

      return result;
    }
  }

  /**
   * Get current connector state
   */
  getState(): ConnectorState {
    return {
      ...this.state,
      circuitBreakerState: this.circuitBreaker.getState(),
      rateLimitState: this.rateLimiter?.getState(),
      tokenExpiresAt: this.authProvider.getExpiresAt(),
    };
  }

  /**
   * Get connector metrics
   */
  getMetrics(): ConnectorMetrics {
    return this.monitoring.getMetrics();
  }

  /**
   * Get connector configuration (without sensitive data)
   */
  getConfig(): Omit<ConnectorConfig, 'credentials'> {
    const { credentials, ...safeConfig } = this.config;
    return safeConfig;
  }

  /**
   * Reset the circuit breaker
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }

  private buildUrl(request: ConnectorRequest): string {
    let url = `${this.config.baseUrl}${request.path}`;

    // Add API version if configured
    if (this.config.apiVersion && !request.path.includes(this.config.apiVersion)) {
      url = `${this.config.baseUrl}/${this.config.apiVersion}${request.path}`;
    }

    // Add query parameters
    if (request.params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(request.params)) {
        if (value !== undefined) {
          searchParams.set(key, String(value));
        }
      }

      // Add auth query params if applicable
      if (this.authProvider instanceof ApiKeyAuthProvider) {
        const authParams = this.authProvider.getAuthQueryParams();
        for (const [key, value] of Object.entries(authParams)) {
          searchParams.set(key, value);
        }
      }

      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    return url;
  }

  private extractRateLimitHeaders(headers: Record<string, string>): {
    limit: number;
    remaining: number;
    resetAt?: Date;
  } | undefined {
    const limit =
      headers['x-ratelimit-limit'] ||
      headers['x-rate-limit-limit'] ||
      headers['ratelimit-limit'];
    const remaining =
      headers['x-ratelimit-remaining'] ||
      headers['x-rate-limit-remaining'] ||
      headers['ratelimit-remaining'];
    const reset =
      headers['x-ratelimit-reset'] ||
      headers['x-rate-limit-reset'] ||
      headers['ratelimit-reset'];

    if (!limit && !remaining) {
      return undefined;
    }

    return {
      limit: parseInt(limit, 10) || 0,
      remaining: parseInt(remaining, 10) || 0,
      resetAt: reset ? new Date(parseInt(reset, 10) * 1000) : undefined,
    };
  }

  private createConnectorError(
    error: Error,
    request?: ConnectorRequest
  ): ConnectorError {
    const statusCode = 'statusCode' in error ? (error as any).statusCode : undefined;

    return {
      code: 'code' in error ? (error as any).code : 'CONNECTOR_ERROR',
      message: error.message,
      statusCode,
      cause: error,
      retryable: this.retryHandler.shouldRetry(error, 0),
      retryAttempts: 0,
      request,
    };
  }
}

// ============================================================================
// Connector Registry
// ============================================================================

/**
 * Registry for connector type definitions
 */
export class ConnectorRegistry {
  private static instance: ConnectorRegistry;
  private types: Map<string, ConnectorTypeDefinition> = new Map();

  private constructor() {}

  static getInstance(): ConnectorRegistry {
    if (!ConnectorRegistry.instance) {
      ConnectorRegistry.instance = new ConnectorRegistry();
    }
    return ConnectorRegistry.instance;
  }

  /**
   * Register a connector type
   */
  register(definition: ConnectorTypeDefinition): void {
    this.types.set(definition.type, definition);
  }

  /**
   * Get a connector type definition
   */
  get(type: string): ConnectorTypeDefinition | undefined {
    return this.types.get(type);
  }

  /**
   * Get all registered connector types
   */
  getAll(): ConnectorTypeDefinition[] {
    return Array.from(this.types.values());
  }

  /**
   * Get connector types by category
   */
  getByCategory(category: ConnectorTypeDefinition['category']): ConnectorTypeDefinition[] {
    return this.getAll().filter((t) => t.category === category);
  }

  /**
   * Check if a connector type is registered
   */
  has(type: string): boolean {
    return this.types.has(type);
  }
}

// Export the singleton registry
export const connectorRegistry = ConnectorRegistry.getInstance();
