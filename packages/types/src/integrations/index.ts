/**
 * Integration & Reporting types
 *
 * This module contains type definitions for:
 * - External connector framework (auth, rate limiting, retry, monitoring, sync)
 * - Metrics and KPI dashboard types
 * - Project reporting types (job cost)
 * - Data import/migration types
 */

// ============================================================================
// External Connector - Authentication Types
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
// External Connector - Rate Limiting Types
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
// External Connector - Retry Types
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
// External Connector - Request/Response Types
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
// External Connector - Monitoring Types
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
// External Connector - Configuration Types
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
// External Connector - Instance Types
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
// External Connector - Data Mapping Types
// ============================================================================

/**
 * Field mapping definition
 */
export interface ConnectorFieldMapping {
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
  mappings: ConnectorFieldMapping[];
  /** Whether to include unmapped fields */
  includeUnmapped?: boolean;
  /** Fields to exclude */
  excludeFields?: string[];
  /** Custom transform functions by name */
  customTransforms?: Record<string, (value: unknown) => unknown>;
}

// ============================================================================
// External Connector - Sync Types
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
// External Connector - Store Types (for persistence)
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

// ============================================================================
// Metrics & KPI Types
// ============================================================================

/**
 * Time granularity for metrics aggregation
 */
export type TimeGranularity = 'day' | 'week' | 'month' | 'quarter' | 'year';

/**
 * Aggregation type for metrics
 */
export type AggregationType = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'latest';

/**
 * Metric category for grouping
 */
export type MetricCategory =
  | 'revenue'
  | 'expenses'
  | 'profitability'
  | 'liquidity'
  | 'efficiency'
  | 'project'
  | 'custom';

/**
 * Dimension filters for segment reporting
 */
export interface DimensionFilters {
  subsidiaryIds?: string[];
  classIds?: string[];
  departmentIds?: string[];
  locationIds?: string[];
}

/**
 * Time range for metrics queries
 */
export interface TimeRange {
  from: string | Date;
  to: string | Date;
}

/**
 * Period-based filter (alternative to date range)
 */
export interface PeriodFilter {
  periodId?: string;
  periodIds?: string[];
  fiscalYear?: number;
  fiscalQuarter?: number;
}

/**
 * Metric definition for custom KPIs
 */
export interface MetricDefinition {
  id: string;
  name: string;
  description?: string;
  category: MetricCategory;
  formula: string; // e.g., "revenue - expenses" or SQL expression
  unit: string; // e.g., "USD", "%", "ratio"
  aggregation: AggregationType;
  isPercentage?: boolean;
  precision?: number;
  thresholds?: MetricThresholds;
}

/**
 * Thresholds for metric status indicators
 */
export interface MetricThresholds {
  good?: number;
  warning?: number;
  critical?: number;
  direction: 'higher_is_better' | 'lower_is_better' | 'target';
  target?: number;
}

/**
 * Metric value with metadata
 */
export interface MetricValue {
  metricId: string;
  value: number;
  previousValue?: number;
  change?: number;
  changePercent?: number;
  status?: 'good' | 'warning' | 'critical' | 'neutral';
  asOf: string;
  periodId?: string;
}

/**
 * Time series data point
 */
export interface TimeSeriesDataPoint {
  date: string;
  value: number;
  periodId?: string;
}

/**
 * Dimension breakdown data
 */
export interface DimensionBreakdown {
  dimensionType: 'class' | 'department' | 'location' | 'subsidiary';
  dimensionId: string;
  dimensionName: string;
  dimensionCode?: string;
  value: number;
  percentage: number;
}

// ============================================================================
// Dashboard Types
// ============================================================================

/**
 * KPI card for dashboard display
 */
export interface KpiCard {
  id: string;
  title: string;
  value: number;
  formattedValue: string;
  previousValue?: number;
  change?: number;
  changePercent?: number;
  changeDirection?: 'up' | 'down' | 'flat';
  status?: 'good' | 'warning' | 'critical' | 'neutral';
  unit?: string;
  sparklineData?: number[];
  period: string;
}

/**
 * Dashboard summary metrics
 */
export interface DashboardSummary {
  totalRevenue: MetricValue;
  totalExpenses: MetricValue;
  netIncome: MetricValue;
  grossMargin: MetricValue;
  operatingMargin: MetricValue;
  currentRatio?: MetricValue;
  quickRatio?: MetricValue;
  workingCapital?: MetricValue;
}

/**
 * Segment performance data
 */
export interface SegmentPerformance {
  dimensionType: 'class' | 'department' | 'location';
  segments: Array<{
    id: string;
    name: string;
    code?: string;
    revenue: number;
    expenses: number;
    netIncome: number;
    margin: number;
    percentOfTotal: number;
  }>;
  total: {
    revenue: number;
    expenses: number;
    netIncome: number;
  };
}

/**
 * Trend data for charts
 */
export interface TrendData {
  metricId: string;
  metricName: string;
  granularity: TimeGranularity;
  dataPoints: TimeSeriesDataPoint[];
  trend: 'increasing' | 'decreasing' | 'stable';
  trendStrength?: number;
}

// ============================================================================
// Saved Views Types
// ============================================================================

/**
 * Saved view configuration
 */
export interface SavedView {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  viewType: 'dashboard' | 'report' | 'analysis';
  configuration: SavedViewConfiguration;
  isDefault?: boolean;
  isShared?: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Saved view configuration details
 */
export interface SavedViewConfiguration {
  // Dimension filters
  filters: DimensionFilters;

  // Time settings
  timeRange?: TimeRange;
  periodFilter?: PeriodFilter;
  granularity?: TimeGranularity;

  // Display settings
  metrics?: string[]; // Metric IDs to display
  chartTypes?: Record<string, 'line' | 'bar' | 'pie' | 'area'>;
  comparePeriod?: boolean;
  showTrend?: boolean;

  // Layout
  layout?: Array<{
    id: string;
    type: 'kpi' | 'chart' | 'table' | 'breakdown';
    width: number; // 1-12 grid units
    height: number;
    config?: Record<string, unknown>;
  }>;
}

/**
 * Input for creating a saved view
 */
export interface CreateSavedViewInput {
  name: string;
  description?: string;
  viewType: 'dashboard' | 'report' | 'analysis';
  configuration: SavedViewConfiguration;
  isDefault?: boolean;
  isShared?: boolean;
}

/**
 * Input for updating a saved view
 */
export interface UpdateSavedViewInput {
  name?: string;
  description?: string;
  configuration?: Partial<SavedViewConfiguration>;
  isDefault?: boolean;
  isShared?: boolean;
}

// ============================================================================
// Dashboard Query Input Types
// ============================================================================

/**
 * Input for fetching dashboard data
 */
export interface DashboardQueryInput {
  periodId?: string;
  timeRange?: TimeRange;
  filters?: DimensionFilters;
  compareWithPrevious?: boolean;
  metrics?: string[];
}

/**
 * Input for segment analysis
 */
export interface SegmentAnalysisInput {
  periodId: string;
  dimensionType: 'class' | 'department' | 'location';
  metric: 'revenue' | 'expenses' | 'netIncome' | 'margin';
  filters?: DimensionFilters;
  topN?: number;
}

/**
 * Input for trend analysis
 */
export interface TrendAnalysisInput {
  metricId: string;
  periodIds?: string[];
  timeRange?: TimeRange;
  granularity: TimeGranularity;
  filters?: DimensionFilters;
}

/**
 * Input for metric comparison
 */
export interface MetricComparisonInput {
  metricIds: string[];
  currentPeriodId: string;
  comparePeriodId?: string;
  filters?: DimensionFilters;
}

// ============================================================================
// Dashboard Response Types
// ============================================================================

/**
 * Dashboard response with all components
 */
export interface DashboardResponse {
  summary: DashboardSummary;
  kpiCards: KpiCard[];
  trends?: TrendData[];
  segmentBreakdowns?: SegmentPerformance[];
  generatedAt: string;
  period: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
  };
  appliedFilters: DimensionFilters;
}

/**
 * Segment analysis response
 */
export interface SegmentAnalysisResponse {
  dimensionType: 'class' | 'department' | 'location';
  segments: DimensionBreakdown[];
  total: number;
  period: {
    id: string;
    name: string;
  };
  generatedAt: string;
}

/**
 * Comparison response
 */
export interface MetricComparisonResponse {
  metrics: Array<{
    metricId: string;
    metricName: string;
    current: MetricValue;
    previous?: MetricValue;
    variance?: number;
    variancePercent?: number;
  }>;
  currentPeriod: { id: string; name: string };
  comparePeriod?: { id: string; name: string };
  generatedAt: string;
}

// ============================================================================
// Project Reporting Types
// ============================================================================

export interface JobCostSummary {
  projectId: string;
  projectName: string;
  projectCode: string | null;
  subsidiaryId: string | null;
  totalBudgetAmount: string;
  totalCommittedAmount: string;
  totalActualCost: string;
  totalWipClearing: string;
  percentComplete: string;
  lastPostedAt: string | null;
}

export interface JobCostSummaryFilters {
  projectId?: string;
  projectIds?: string[];
  subsidiaryId?: string;
  search?: string;
}

export interface ProjectProgressSnapshot {
  id: string;
  projectId: string;
  snapshotDate: string;
  totalBudgetAmount: string;
  totalCommittedAmount: string;
  totalActualCost: string;
  totalWipClearing: string;
  percentComplete: string;
  sourceGlTransactionId?: string | null;
  createdAt: string;
}

export interface BudgetLineVariance {
  budgetLineId: string;
  costCodeId: string;
  costCode: string;
  costCodeName: string;
  costType: string;
  originalBudgetAmount: string;
  revisedBudgetAmount: string;
  committedAmount: string;
  actualAmount: string;
  encumberedAmount: string;
  varianceAmount: string;
  variancePercent: string;
  estimateToComplete: string;
  estimateAtCompletion: string;
}

export interface CostTypeVarianceSummary {
  costType: string;
  totalBudget: string;
  totalActual: string;
  totalCommitted: string;
  totalVariance: string;
  variancePercent: string;
}

export interface BudgetVarianceReport {
  projectId: string;
  projectName: string;
  projectCode: string | null;
  budgetVersionId: string;
  budgetVersionName: string;
  asOfDate: string;
  summary: {
    totalBudgetAmount: string;
    totalCommittedAmount: string;
    totalActualAmount: string;
    totalVarianceAmount: string;
    variancePercent: string;
    percentComplete: string;
  };
  byLine: BudgetLineVariance[];
  byCostType: CostTypeVarianceSummary[];
}

export interface BudgetVarianceFilters {
  projectId: string;
  budgetVersionId?: string;
  costType?: string;
}

// ============================================================================
// Data Import Types - Configuration
// ============================================================================

/**
 * Import batch status
 */
export type ImportBatchStatus =
  | 'pending'
  | 'validating'
  | 'validated'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'rolled_back'
  | 'cancelled';

/**
 * Import record status
 */
export type ImportRecordStatus =
  | 'pending'
  | 'valid'
  | 'invalid'
  | 'imported'
  | 'skipped'
  | 'failed';

/**
 * Import data type
 */
export type ImportDataType =
  // Master data
  | 'account'
  | 'customer'
  | 'vendor'
  | 'employee'
  | 'item'
  | 'department'
  | 'class'
  | 'location'
  | 'project'
  | 'cost_code'
  | 'subsidiary'
  // Transactional data
  | 'journal_entry'
  | 'invoice'
  | 'bill'
  | 'payment'
  | 'bill_payment'
  | 'opening_balance'
  | 'budget'
  | 'time_entry'
  | 'expense_entry';

/**
 * Import source system
 */
export type ImportSourceSystem =
  | 'quickbooks_online'
  | 'quickbooks_desktop'
  | 'xero'
  | 'sage'
  | 'netsuite'
  | 'dynamics'
  | 'freshbooks'
  | 'wave'
  | 'csv'
  | 'excel'
  | 'json'
  | 'other';

// ============================================================================
// Data Import Types - Validation
// ============================================================================

/**
 * Validation rule type
 */
export type ImportValidationRuleType =
  | 'required'
  | 'format'
  | 'range'
  | 'lookup'
  | 'unique'
  | 'custom'
  | 'dependency'
  | 'crossfield';

/**
 * Validation severity
 */
export type ImportValidationSeverity = 'error' | 'warning';

/**
 * Validation rule definition
 */
export interface ImportValidationRule {
  /** Field to validate */
  field: string;
  /** Rule type */
  type: ImportValidationRuleType;
  /** Rule parameters */
  params?: Record<string, unknown>;
  /** Error message template */
  message?: string;
  /** Severity */
  severity?: ImportValidationSeverity;
  /** Condition for applying the rule */
  condition?: ImportValidationCondition;
}

/**
 * Validation condition
 */
export interface ImportValidationCondition {
  /** Field to check */
  field: string;
  /** Operator */
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'notIn' | 'exists' | 'notExists';
  /** Value to compare */
  value?: unknown;
}

/**
 * Import validation error
 */
export interface ImportValidationError {
  /** Field with error */
  field: string;
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Expected value/format */
  expected?: string;
  /** Actual value */
  actual?: unknown;
  /** Row number if applicable */
  rowNumber?: number;
}

/**
 * Import validation warning
 */
export interface ImportValidationWarning {
  /** Field with warning */
  field: string;
  /** Warning code */
  code: string;
  /** Warning message */
  message: string;
  /** Suggestion */
  suggestion?: string;
}

/**
 * Validation result
 */
export interface ImportValidationResult {
  /** Is valid */
  isValid: boolean;
  /** Errors */
  errors: ImportValidationError[];
  /** Warnings */
  warnings: ImportValidationWarning[];
  /** Mapped/transformed data */
  mappedData?: Record<string, unknown>;
}

// ============================================================================
// Data Import Types - Field Mapping
// ============================================================================

/**
 * Import field mapping definition
 */
export interface ImportFieldMapping {
  /** Source field name */
  sourceField: string;
  /** Target field name */
  targetField: string;
  /** Is this mapping required */
  required?: boolean;
  /** Default value if source is empty */
  defaultValue?: unknown;
  /** Transformation to apply */
  transformation?: string;
}

/**
 * Field transformation type
 */
export type ImportTransformationType =
  | 'uppercase'
  | 'lowercase'
  | 'trim'
  | 'date'
  | 'number'
  | 'boolean'
  | 'lookup'
  | 'custom'
  | 'split'
  | 'join'
  | 'replace'
  | 'truncate';

/**
 * Field transformation
 */
export interface ImportFieldTransformation {
  /** Field to transform */
  field: string;
  /** Transformation type */
  type: ImportTransformationType;
  /** Transformation parameters */
  params?: Record<string, unknown>;
}

// ============================================================================
// Data Import Types - Options
// ============================================================================

/**
 * Import batch options
 */
export interface ImportBatchOptions {
  /** Skip duplicate records instead of failing */
  skipDuplicates?: boolean;
  /** Update existing records instead of skipping */
  updateExisting?: boolean;
  /** Continue on validation errors */
  continueOnErrors?: boolean;
  /** Maximum number of errors before stopping */
  maxErrors?: number;
  /** Dry run mode (validate only) */
  dryRun?: boolean;
  /** Enable rollback tracking */
  enableRollback?: boolean;
  /** Field mapping ID to use */
  fieldMappingId?: string;
  /** Custom validation rules */
  validationRules?: ImportValidationRule[];
  /** Date format for parsing */
  dateFormat?: string;
  /** Decimal separator */
  decimalSeparator?: string;
  /** Thousands separator */
  thousandsSeparator?: string;
}

/**
 * CSV import options
 */
export interface CsvImportOptions extends ImportBatchOptions {
  /** Header row number (1-based) */
  headerRow?: number;
  /** Data start row (1-based) */
  dataStartRow?: number;
  /** Column delimiter */
  delimiter?: string;
  /** Quote character */
  quoteChar?: string;
  /** Escape character */
  escapeChar?: string;
  /** Encoding */
  encoding?: BufferEncoding;
  /** Trim values */
  trimValues?: boolean;
  /** Skip empty rows */
  skipEmptyRows?: boolean;
}

/**
 * Excel import options
 */
export interface ExcelImportOptions extends ImportBatchOptions {
  /** Sheet name or index (0-based) */
  sheet?: string | number;
  /** Header row number (1-based) */
  headerRow?: number;
  /** Data start row (1-based) */
  dataStartRow?: number;
  /** Column range (e.g., "A:Z") */
  columnRange?: string;
}

// ============================================================================
// Data Import Types - Results
// ============================================================================

/**
 * Import error summary
 */
export interface ImportErrorSummary {
  /** Total errors */
  totalErrors: number;
  /** Errors by code */
  errorsByCode: Record<string, number>;
  /** Errors by field */
  errorsByField: Record<string, number>;
  /** Sample errors */
  sampleErrors: ImportValidationError[];
}

/**
 * Import batch result
 */
export interface ImportBatchResult {
  /** Batch ID */
  batchId: string;
  /** Batch number */
  batchNumber: string;
  /** Status */
  status: ImportBatchStatus;
  /** Total records */
  totalRecords: number;
  /** Valid records */
  validRecords: number;
  /** Invalid records */
  invalidRecords: number;
  /** Imported records */
  importedRecords: number;
  /** Skipped records */
  skippedRecords: number;
  /** Failed records */
  failedRecords: number;
  /** Error summary */
  errorSummary?: ImportErrorSummary;
  /** Start time */
  startedAt: Date;
  /** End time */
  completedAt?: Date;
  /** Duration in milliseconds */
  durationMs?: number;
}

// ============================================================================
// Data Import Types - Schemas
// ============================================================================

/**
 * Account import schema
 */
export interface AccountImportSchema {
  accountNumber: string;
  name: string;
  accountType: string;
  normalBalance?: 'debit' | 'credit';
  parentAccountNumber?: string;
  description?: string;
  isActive?: boolean;
  subsidiaryId?: string;
}

/**
 * Customer import schema
 */
export interface CustomerImportSchema {
  customerNumber: string;
  name: string;
  email?: string;
  phone?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  paymentTerms?: string;
  creditLimit?: number;
  taxExempt?: boolean;
  taxId?: string;
  isActive?: boolean;
}

/**
 * Vendor import schema
 */
export interface VendorImportSchema {
  vendorNumber: string;
  name: string;
  email?: string;
  phone?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  paymentTerms?: string;
  defaultExpenseAccount?: string;
  taxId?: string;
  is1099?: boolean;
  isActive?: boolean;
}

/**
 * Item import schema
 */
export interface ItemImportSchema {
  itemNumber: string;
  name: string;
  description?: string;
  itemType: 'inventory' | 'non_inventory' | 'service' | 'other';
  unitPrice?: number;
  cost?: number;
  incomeAccount?: string;
  expenseAccount?: string;
  assetAccount?: string;
  categoryId?: string;
  unitOfMeasure?: string;
  taxable?: boolean;
  isActive?: boolean;
}

/**
 * Journal entry import schema
 */
export interface JournalEntryImportSchema {
  entryNumber?: string;
  date: string;
  memo?: string;
  reference?: string;
  lines: JournalEntryLineImportSchema[];
}

/**
 * Journal entry line import schema
 */
export interface JournalEntryLineImportSchema {
  accountNumber: string;
  debit?: number;
  credit?: number;
  memo?: string;
  departmentId?: string;
  classId?: string;
  locationId?: string;
  projectId?: string;
  entityId?: string;
}

/**
 * Opening balance import schema
 */
export interface OpeningBalanceImportSchema {
  accountNumber: string;
  date: string;
  amount: number;
  subsidiaryId?: string;
  departmentId?: string;
  classId?: string;
  locationId?: string;
}

// ============================================================================
// Data Import Types - Predefined Validation Rules
// ============================================================================

/**
 * Account validation rules
 */
export const ACCOUNT_VALIDATION_RULES: ImportValidationRule[] = [
  {
    field: 'accountNumber',
    type: 'required',
    message: 'Account number is required',
  },
  {
    field: 'accountNumber',
    type: 'format',
    params: { pattern: '^[A-Za-z0-9-_.]+$', maxLength: 50 },
    message: 'Account number must be alphanumeric (max 50 chars)',
  },
  {
    field: 'accountNumber',
    type: 'unique',
    params: { scope: 'organization' },
    message: 'Account number must be unique within organization',
  },
  {
    field: 'name',
    type: 'required',
    message: 'Account name is required',
  },
  {
    field: 'name',
    type: 'format',
    params: { maxLength: 255 },
    message: 'Account name must not exceed 255 characters',
  },
  {
    field: 'accountType',
    type: 'required',
    message: 'Account type is required',
  },
  {
    field: 'accountType',
    type: 'lookup',
    params: {
      values: [
        'asset', 'liability', 'equity', 'revenue', 'expense',
        'bank', 'accounts_receivable', 'accounts_payable',
        'fixed_asset', 'other_asset', 'other_liability',
        'cost_of_goods_sold', 'other_income', 'other_expense',
      ],
    },
    message: 'Invalid account type',
  },
  {
    field: 'normalBalance',
    type: 'lookup',
    params: { values: ['debit', 'credit'] },
    severity: 'warning',
    message: 'Normal balance should be debit or credit',
  },
  {
    field: 'parentAccountNumber',
    type: 'lookup',
    params: { table: 'accounts', field: 'accountNumber' },
    severity: 'warning',
    message: 'Parent account not found',
    condition: { field: 'parentAccountNumber', operator: 'exists' },
  },
];

/**
 * Customer validation rules
 */
export const CUSTOMER_VALIDATION_RULES: ImportValidationRule[] = [
  {
    field: 'customerNumber',
    type: 'required',
    message: 'Customer number is required',
  },
  {
    field: 'customerNumber',
    type: 'format',
    params: { pattern: '^[A-Za-z0-9-_.]+$', maxLength: 50 },
    message: 'Customer number must be alphanumeric (max 50 chars)',
  },
  {
    field: 'customerNumber',
    type: 'unique',
    params: { scope: 'organization' },
    message: 'Customer number must be unique within organization',
  },
  {
    field: 'name',
    type: 'required',
    message: 'Customer name is required',
  },
  {
    field: 'name',
    type: 'format',
    params: { maxLength: 255 },
    message: 'Customer name must not exceed 255 characters',
  },
  {
    field: 'email',
    type: 'format',
    params: { pattern: '^[^@]+@[^@]+\\.[^@]+$' },
    severity: 'warning',
    message: 'Invalid email format',
    condition: { field: 'email', operator: 'exists' },
  },
  {
    field: 'creditLimit',
    type: 'range',
    params: { min: 0 },
    severity: 'warning',
    message: 'Credit limit must be non-negative',
    condition: { field: 'creditLimit', operator: 'exists' },
  },
];

/**
 * Vendor validation rules
 */
export const VENDOR_VALIDATION_RULES: ImportValidationRule[] = [
  {
    field: 'vendorNumber',
    type: 'required',
    message: 'Vendor number is required',
  },
  {
    field: 'vendorNumber',
    type: 'format',
    params: { pattern: '^[A-Za-z0-9-_.]+$', maxLength: 50 },
    message: 'Vendor number must be alphanumeric (max 50 chars)',
  },
  {
    field: 'vendorNumber',
    type: 'unique',
    params: { scope: 'organization' },
    message: 'Vendor number must be unique within organization',
  },
  {
    field: 'name',
    type: 'required',
    message: 'Vendor name is required',
  },
  {
    field: 'name',
    type: 'format',
    params: { maxLength: 255 },
    message: 'Vendor name must not exceed 255 characters',
  },
  {
    field: 'email',
    type: 'format',
    params: { pattern: '^[^@]+@[^@]+\\.[^@]+$' },
    severity: 'warning',
    message: 'Invalid email format',
    condition: { field: 'email', operator: 'exists' },
  },
  {
    field: 'defaultExpenseAccount',
    type: 'lookup',
    params: { table: 'accounts', field: 'accountNumber' },
    severity: 'warning',
    message: 'Default expense account not found',
    condition: { field: 'defaultExpenseAccount', operator: 'exists' },
  },
];

/**
 * Item validation rules
 */
export const ITEM_VALIDATION_RULES: ImportValidationRule[] = [
  {
    field: 'itemNumber',
    type: 'required',
    message: 'Item number is required',
  },
  {
    field: 'itemNumber',
    type: 'format',
    params: { pattern: '^[A-Za-z0-9-_.]+$', maxLength: 50 },
    message: 'Item number must be alphanumeric (max 50 chars)',
  },
  {
    field: 'itemNumber',
    type: 'unique',
    params: { scope: 'organization' },
    message: 'Item number must be unique within organization',
  },
  {
    field: 'name',
    type: 'required',
    message: 'Item name is required',
  },
  {
    field: 'itemType',
    type: 'required',
    message: 'Item type is required',
  },
  {
    field: 'itemType',
    type: 'lookup',
    params: { values: ['inventory', 'non_inventory', 'service', 'other'] },
    message: 'Invalid item type',
  },
  {
    field: 'unitPrice',
    type: 'range',
    params: { min: 0 },
    severity: 'warning',
    message: 'Unit price must be non-negative',
    condition: { field: 'unitPrice', operator: 'exists' },
  },
  {
    field: 'cost',
    type: 'range',
    params: { min: 0 },
    severity: 'warning',
    message: 'Cost must be non-negative',
    condition: { field: 'cost', operator: 'exists' },
  },
];

/**
 * Journal entry validation rules
 */
export const JOURNAL_ENTRY_VALIDATION_RULES: ImportValidationRule[] = [
  {
    field: 'date',
    type: 'required',
    message: 'Entry date is required',
  },
  {
    field: 'date',
    type: 'format',
    params: { pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    message: 'Date must be in YYYY-MM-DD format',
  },
  {
    field: 'lines',
    type: 'required',
    message: 'Journal entry must have at least one line',
  },
  {
    field: 'lines',
    type: 'custom',
    params: { validator: 'balancedEntry' },
    message: 'Journal entry debits and credits must balance',
  },
];

/**
 * Opening balance validation rules
 */
export const OPENING_BALANCE_VALIDATION_RULES: ImportValidationRule[] = [
  {
    field: 'accountNumber',
    type: 'required',
    message: 'Account number is required',
  },
  {
    field: 'accountNumber',
    type: 'lookup',
    params: { table: 'accounts', field: 'accountNumber' },
    message: 'Account not found',
  },
  {
    field: 'date',
    type: 'required',
    message: 'Date is required',
  },
  {
    field: 'date',
    type: 'format',
    params: { pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    message: 'Date must be in YYYY-MM-DD format',
  },
  {
    field: 'amount',
    type: 'required',
    message: 'Amount is required',
  },
  {
    field: 'amount',
    type: 'format',
    params: { type: 'number' },
    message: 'Amount must be a valid number',
  },
];

/**
 * Get validation rules for a data type
 */
export function getValidationRulesForDataType(dataType: ImportDataType): ImportValidationRule[] {
  switch (dataType) {
    case 'account':
      return ACCOUNT_VALIDATION_RULES;
    case 'customer':
      return CUSTOMER_VALIDATION_RULES;
    case 'vendor':
      return VENDOR_VALIDATION_RULES;
    case 'item':
      return ITEM_VALIDATION_RULES;
    case 'journal_entry':
      return JOURNAL_ENTRY_VALIDATION_RULES;
    case 'opening_balance':
      return OPENING_BALANCE_VALIDATION_RULES;
    default:
      return [];
  }
}

// ============================================================================
// Data Import Types - Source System Mappings
// ============================================================================

/**
 * QuickBooks Online to GLAPI account mapping
 */
export const QBO_ACCOUNT_MAPPING: ImportFieldMapping[] = [
  { sourceField: 'Id', targetField: 'externalId' },
  { sourceField: 'AcctNum', targetField: 'accountNumber' },
  { sourceField: 'Name', targetField: 'name' },
  { sourceField: 'AccountType', targetField: 'accountType', transformation: 'qboAccountType' },
  { sourceField: 'AccountSubType', targetField: 'accountSubType' },
  { sourceField: 'Description', targetField: 'description' },
  { sourceField: 'Active', targetField: 'isActive' },
  { sourceField: 'CurrentBalance', targetField: 'balance' },
];

/**
 * QuickBooks Online to GLAPI customer mapping
 */
export const QBO_CUSTOMER_MAPPING: ImportFieldMapping[] = [
  { sourceField: 'Id', targetField: 'externalId' },
  { sourceField: 'DisplayName', targetField: 'name' },
  { sourceField: 'PrimaryEmailAddr.Address', targetField: 'email' },
  { sourceField: 'PrimaryPhone.FreeFormNumber', targetField: 'phone' },
  { sourceField: 'BillAddr.Line1', targetField: 'address1' },
  { sourceField: 'BillAddr.Line2', targetField: 'address2' },
  { sourceField: 'BillAddr.City', targetField: 'city' },
  { sourceField: 'BillAddr.CountrySubDivisionCode', targetField: 'state' },
  { sourceField: 'BillAddr.PostalCode', targetField: 'postalCode' },
  { sourceField: 'BillAddr.Country', targetField: 'country' },
  { sourceField: 'Balance', targetField: 'balance' },
  { sourceField: 'Active', targetField: 'isActive' },
];

/**
 * Xero to GLAPI account mapping
 */
export const XERO_ACCOUNT_MAPPING: ImportFieldMapping[] = [
  { sourceField: 'AccountID', targetField: 'externalId' },
  { sourceField: 'Code', targetField: 'accountNumber' },
  { sourceField: 'Name', targetField: 'name' },
  { sourceField: 'Type', targetField: 'accountType', transformation: 'xeroAccountType' },
  { sourceField: 'Description', targetField: 'description' },
  { sourceField: 'Status', targetField: 'isActive', transformation: 'xeroStatus' },
  { sourceField: 'BankAccountNumber', targetField: 'bankAccountNumber' },
];

/**
 * CSV account mapping (generic)
 */
export const CSV_ACCOUNT_MAPPING: ImportFieldMapping[] = [
  { sourceField: 'Account Number', targetField: 'accountNumber' },
  { sourceField: 'Account Name', targetField: 'name' },
  { sourceField: 'Account Type', targetField: 'accountType' },
  { sourceField: 'Normal Balance', targetField: 'normalBalance' },
  { sourceField: 'Description', targetField: 'description' },
  { sourceField: 'Parent Account', targetField: 'parentAccountNumber' },
  { sourceField: 'Active', targetField: 'isActive', transformation: 'boolean' },
];

// ============================================================================
// Data Import Types - Events
// ============================================================================

/**
 * Import event type
 */
export type ImportEventType =
  | 'BATCH_CREATED'
  | 'BATCH_VALIDATION_STARTED'
  | 'BATCH_VALIDATION_COMPLETED'
  | 'BATCH_IMPORT_STARTED'
  | 'BATCH_IMPORT_COMPLETED'
  | 'BATCH_FAILED'
  | 'BATCH_CANCELLED'
  | 'BATCH_ROLLED_BACK'
  | 'RECORD_VALIDATED'
  | 'RECORD_IMPORTED'
  | 'RECORD_SKIPPED'
  | 'RECORD_FAILED';

/**
 * Import event
 */
export interface ImportEvent {
  type: ImportEventType;
  batchId: string;
  recordId?: string;
  timestamp: Date;
  userId: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// Data Import Types - Progress
// ============================================================================

/**
 * Import progress
 */
export interface ImportProgress {
  batchId: string;
  status: ImportBatchStatus;
  phase: 'validation' | 'import' | 'complete';
  totalRecords: number;
  processedRecords: number;
  percentComplete: number;
  currentRecord?: number;
  estimatedTimeRemaining?: number;
  errors: number;
  warnings: number;
}

// ============================================================================
// Data Import Types - Request/Response
// ============================================================================

/**
 * Create import batch request
 */
export interface CreateImportBatchRequest {
  organizationId: string;
  name: string;
  description?: string;
  sourceSystem: ImportSourceSystem;
  dataTypes: ImportDataType[];
  sourceFile?: string;
  options?: ImportBatchOptions;
  userId: string;
}

/**
 * Add records to batch request
 */
export interface AddRecordsToBatchRequest {
  batchId: string;
  records: Array<{
    rowNumber: number;
    externalId?: string;
    dataType: ImportDataType;
    rawData: Record<string, unknown>;
  }>;
}

/**
 * Validate batch request
 */
export interface ValidateBatchRequest {
  batchId: string;
  fieldMappingId?: string;
  options?: ImportBatchOptions;
}

/**
 * Execute import request
 */
export interface ExecuteImportRequest {
  batchId: string;
  options?: ImportBatchOptions;
}

/**
 * Rollback import request
 */
export interface RollbackImportRequest {
  batchId: string;
  userId: string;
  reason?: string;
}
