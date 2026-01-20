/**
 * External Connector Framework Types
 *
 * This module defines the core types and interfaces for the connector framework
 * that enables integration with external services (banks, payroll, CRM, etc.)
 */

// ============================================================================
// Authentication Types
// ============================================================================

/**
 * Supported authentication methods
 */
export type AuthMethod = 'oauth2' | 'api_key' | 'basic' | 'bearer' | 'custom';

/**
 * OAuth2 grant types
 */
export type OAuth2GrantType = 'authorization_code' | 'client_credentials' | 'refresh_token';

/**
 * Base credentials interface
 */
export interface BaseCredentials {
  method: AuthMethod;
  expiresAt?: Date;
  lastRefreshedAt?: Date;
}

/**
 * OAuth2 credentials
 */
export interface OAuth2Credentials extends BaseCredentials {
  method: 'oauth2';
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
  scope?: string[];
  grantType: OAuth2GrantType;
  authorizationUrl?: string;
  tokenUrl: string;
  redirectUri?: string;
}

/**
 * API Key credentials
 */
export interface ApiKeyCredentials extends BaseCredentials {
  method: 'api_key';
  apiKey: string;
  headerName?: string; // Default: 'X-API-Key'
  queryParamName?: string; // Alternative: pass as query param
  placement?: 'header' | 'query';
}

/**
 * Basic Auth credentials
 */
export interface BasicAuthCredentials extends BaseCredentials {
  method: 'basic';
  username: string;
  password: string;
}

/**
 * Bearer token credentials
 */
export interface BearerTokenCredentials extends BaseCredentials {
  method: 'bearer';
  token: string;
}

/**
 * Custom authentication credentials
 */
export interface CustomAuthCredentials extends BaseCredentials {
  method: 'custom';
  customData: Record<string, unknown>;
}

/**
 * Union type for all credential types
 */
export type ConnectorCredentials =
  | OAuth2Credentials
  | ApiKeyCredentials
  | BasicAuthCredentials
  | BearerTokenCredentials
  | CustomAuthCredentials;

// ============================================================================
// Rate Limiting Types
// ============================================================================

/**
 * Rate limit window types
 */
export type RateLimitWindow = 'second' | 'minute' | 'hour' | 'day';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum requests per window */
  maxRequests: number;
  /** Time window for the limit */
  window: RateLimitWindow;
  /** Custom window duration in ms (overrides window if set) */
  windowMs?: number;
  /** Burst allowance (extra requests allowed temporarily) */
  burstLimit?: number;
  /** Queue requests when rate limited instead of rejecting */
  queueWhenLimited?: boolean;
  /** Maximum queue size */
  maxQueueSize?: number;
  /** Retry-After header handling */
  respectRetryAfter?: boolean;
}

/**
 * Rate limit state for tracking
 */
export interface RateLimitState {
  /** Number of requests in current window */
  requestCount: number;
  /** Window start time */
  windowStart: Date;
  /** Window end time */
  windowEnd: Date;
  /** Whether currently rate limited */
  isLimited: boolean;
  /** Queued request count */
  queuedRequests: number;
  /** Time until rate limit resets (ms) */
  resetIn?: number;
}

// ============================================================================
// Retry Types
// ============================================================================

/**
 * Backoff strategy for retries
 */
export type BackoffStrategy = 'exponential' | 'linear' | 'constant' | 'fibonacci';

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial delay between retries (ms) */
  initialDelayMs: number;
  /** Maximum delay between retries (ms) */
  maxDelayMs: number;
  /** Backoff strategy */
  backoffStrategy: BackoffStrategy;
  /** Multiplier for exponential/linear backoff */
  backoffMultiplier?: number;
  /** Jitter percentage (0-1) to add randomness */
  jitterFactor?: number;
  /** HTTP status codes that trigger retry */
  retryableStatusCodes?: number[];
  /** Error codes that trigger retry */
  retryableErrorCodes?: string[];
  /** Whether to retry on timeout */
  retryOnTimeout?: boolean;
  /** Whether to retry on network errors */
  retryOnNetworkError?: boolean;
}

/**
 * Retry attempt tracking
 */
export interface RetryAttempt {
  attemptNumber: number;
  error?: Error;
  statusCode?: number;
  delayMs: number;
  timestamp: Date;
}

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * HTTP methods supported
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/**
 * Connector request configuration
 */
export interface ConnectorRequest {
  /** HTTP method */
  method: HttpMethod;
  /** Endpoint path (appended to base URL) */
  path: string;
  /** Query parameters */
  params?: Record<string, string | number | boolean | undefined>;
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body (will be JSON stringified if object) */
  body?: unknown;
  /** Request timeout in ms */
  timeout?: number;
  /** Skip authentication for this request */
  skipAuth?: boolean;
  /** Custom retry policy for this request */
  retryPolicy?: Partial<RetryPolicy>;
  /** Tags for monitoring/logging */
  tags?: Record<string, string>;
  /** Idempotency key for safe retries */
  idempotencyKey?: string;
}

/**
 * Connector response
 */
export interface ConnectorResponse<T = unknown> {
  /** Response data (parsed JSON) */
  data: T;
  /** HTTP status code */
  status: number;
  /** Response headers */
  headers: Record<string, string>;
  /** Request duration in ms */
  durationMs: number;
  /** Number of retry attempts made */
  retryAttempts: number;
  /** Rate limit information from response */
  rateLimit?: {
    limit: number;
    remaining: number;
    resetAt?: Date;
  };
}

/**
 * Connector error
 */
export interface ConnectorError {
  /** Error code */
  code: string;
  /** Human-readable message */
  message: string;
  /** HTTP status code if applicable */
  statusCode?: number;
  /** Original error */
  cause?: Error;
  /** Whether this error is retryable */
  retryable: boolean;
  /** Retry attempts made */
  retryAttempts: number;
  /** Request that caused the error */
  request?: ConnectorRequest;
  /** Response if any */
  response?: Partial<ConnectorResponse>;
}

// ============================================================================
// Monitoring Types
// ============================================================================

/**
 * Health status
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

/**
 * Health check result
 */
export interface HealthCheckResult {
  status: HealthStatus;
  latencyMs?: number;
  lastSuccessfulRequest?: Date;
  lastFailedRequest?: Date;
  errorRate?: number;
  message?: string;
  details?: Record<string, unknown>;
}

/**
 * Connector metrics
 */
export interface ConnectorMetrics {
  /** Total requests made */
  totalRequests: number;
  /** Successful requests */
  successfulRequests: number;
  /** Failed requests */
  failedRequests: number;
  /** Retried requests */
  retriedRequests: number;
  /** Rate limited requests */
  rateLimitedRequests: number;
  /** Average latency in ms */
  avgLatencyMs: number;
  /** P95 latency in ms */
  p95LatencyMs: number;
  /** P99 latency in ms */
  p99LatencyMs: number;
  /** Requests per minute */
  requestsPerMinute: number;
  /** Error rate (0-1) */
  errorRate: number;
  /** Current health status */
  health: HealthStatus;
  /** Metrics collection timestamp */
  timestamp: Date;
}

/**
 * Monitoring event types
 */
export type MonitoringEventType =
  | 'request_start'
  | 'request_success'
  | 'request_failure'
  | 'request_retry'
  | 'rate_limit_hit'
  | 'auth_refresh'
  | 'auth_failure'
  | 'health_check'
  | 'circuit_breaker_open'
  | 'circuit_breaker_close';

/**
 * Monitoring event
 */
export interface MonitoringEvent {
  type: MonitoringEventType;
  connectorId: string;
  connectorType: string;
  timestamp: Date;
  durationMs?: number;
  request?: ConnectorRequest;
  response?: Partial<ConnectorResponse>;
  error?: ConnectorError;
  metadata?: Record<string, unknown>;
}

/**
 * Monitoring hooks interface
 */
export interface MonitoringHooks {
  /** Called when a request starts */
  onRequestStart?: (event: MonitoringEvent) => void | Promise<void>;
  /** Called when a request succeeds */
  onRequestSuccess?: (event: MonitoringEvent) => void | Promise<void>;
  /** Called when a request fails */
  onRequestFailure?: (event: MonitoringEvent) => void | Promise<void>;
  /** Called when a request is retried */
  onRequestRetry?: (event: MonitoringEvent) => void | Promise<void>;
  /** Called when rate limit is hit */
  onRateLimitHit?: (event: MonitoringEvent) => void | Promise<void>;
  /** Called when auth is refreshed */
  onAuthRefresh?: (event: MonitoringEvent) => void | Promise<void>;
  /** Called when auth refresh fails */
  onAuthFailure?: (event: MonitoringEvent) => void | Promise<void>;
  /** Called after health check */
  onHealthCheck?: (event: MonitoringEvent) => void | Promise<void>;
}

// ============================================================================
// Connector Configuration Types
// ============================================================================

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Whether circuit breaker is enabled */
  enabled: boolean;
  /** Failure threshold to open circuit */
  failureThreshold: number;
  /** Success threshold to close circuit */
  successThreshold: number;
  /** Time to wait before half-open (ms) */
  resetTimeoutMs: number;
  /** Window size for counting failures */
  windowSize: number;
}

/**
 * Full connector configuration
 */
export interface ConnectorConfig {
  /** Unique connector ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Connector type (e.g., 'plaid', 'quickbooks', 'salesforce') */
  type: string;
  /** Base URL for API requests */
  baseUrl: string;
  /** API version (if applicable) */
  apiVersion?: string;
  /** Default timeout for requests (ms) */
  defaultTimeoutMs?: number;
  /** Default headers for all requests */
  defaultHeaders?: Record<string, string>;
  /** Authentication credentials */
  credentials: ConnectorCredentials;
  /** Rate limit configuration */
  rateLimit?: RateLimitConfig;
  /** Default retry policy */
  retryPolicy?: RetryPolicy;
  /** Circuit breaker configuration */
  circuitBreaker?: CircuitBreakerConfig;
  /** Monitoring hooks */
  monitoring?: MonitoringHooks;
  /** Custom configuration for specific connector types */
  customConfig?: Record<string, unknown>;
  /** Tags for categorization */
  tags?: Record<string, string>;
  /** Whether connector is enabled */
  enabled?: boolean;
  /** Organization ID this connector belongs to */
  organizationId?: string;
}

// ============================================================================
// Connector Instance Types
// ============================================================================

/**
 * Circuit breaker state
 */
export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

/**
 * Connector runtime state
 */
export interface ConnectorState {
  /** Current circuit breaker state */
  circuitBreakerState: CircuitBreakerState;
  /** Last health check result */
  lastHealthCheck?: HealthCheckResult;
  /** Current rate limit state */
  rateLimitState?: RateLimitState;
  /** Token expiration time */
  tokenExpiresAt?: Date;
  /** Whether connector is currently healthy */
  isHealthy: boolean;
  /** Recent errors for debugging */
  recentErrors: ConnectorError[];
  /** Connector start time */
  startedAt: Date;
  /** Last request time */
  lastRequestAt?: Date;
}

/**
 * Connection test result
 */
export interface ConnectionTestResult {
  success: boolean;
  latencyMs: number;
  message: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// Data Mapping Types
// ============================================================================

/**
 * Field mapping definition
 */
export interface FieldMapping {
  /** Source field path (dot notation) */
  source: string;
  /** Target field path (dot notation) */
  target: string;
  /** Transform function name or inline expression */
  transform?: string;
  /** Default value if source is missing */
  defaultValue?: unknown;
  /** Whether this field is required */
  required?: boolean;
}

/**
 * Data transformation configuration
 */
export interface DataTransformConfig {
  /** Field mappings */
  mappings: FieldMapping[];
  /** Whether to include unmapped fields */
  includeUnmapped?: boolean;
  /** Fields to exclude */
  excludeFields?: string[];
  /** Custom transform functions by name */
  customTransforms?: Record<string, (value: unknown) => unknown>;
}

// ============================================================================
// Sync Types
// ============================================================================

/**
 * Sync direction
 */
export type SyncDirection = 'inbound' | 'outbound' | 'bidirectional';

/**
 * Sync mode
 */
export type SyncMode = 'full' | 'incremental' | 'delta';

/**
 * Sync configuration
 */
export interface SyncConfig {
  /** Sync direction */
  direction: SyncDirection;
  /** Sync mode */
  mode: SyncMode;
  /** Entity types to sync */
  entities: string[];
  /** Schedule (cron expression) */
  schedule?: string;
  /** Whether sync is enabled */
  enabled: boolean;
  /** Last sync timestamp */
  lastSyncAt?: Date;
  /** Batch size for syncing */
  batchSize?: number;
  /** Data transformation config */
  transform?: DataTransformConfig;
}

/**
 * Sync result
 */
export interface SyncResult {
  success: boolean;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsDeleted: number;
  recordsFailed: number;
  errors: ConnectorError[];
  nextSyncToken?: string;
}

// ============================================================================
// Connector Store Types (for persistence)
// ============================================================================

/**
 * Stored connector configuration
 */
export interface StoredConnector {
  id: string;
  organizationId: string;
  name: string;
  type: string;
  config: Omit<ConnectorConfig, 'credentials'>;
  /** Encrypted credentials reference */
  credentialsRef: string;
  enabled: boolean;
  lastHealthCheck?: HealthCheckResult;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy?: string;
}

/**
 * Connector type definition (for registry)
 */
export interface ConnectorTypeDefinition {
  type: string;
  name: string;
  description: string;
  category: 'banking' | 'payroll' | 'crm' | 'erp' | 'accounting' | 'other';
  supportedAuthMethods: AuthMethod[];
  defaultConfig: Partial<ConnectorConfig>;
  requiredCredentialFields: string[];
  optionalCredentialFields?: string[];
  documentationUrl?: string;
  logoUrl?: string;
}
