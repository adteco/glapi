/**
 * External Connector Framework Types - re-exported from @glapi/types for backward compatibility
 *
 * This file re-exports connector types from the centralized @glapi/types package.
 * New code should import directly from '@glapi/types' when possible.
 */

export {
  // Authentication Types
  type AuthMethod,
  type OAuth2GrantType,
  type BaseCredentials,
  type OAuth2Credentials,
  type ApiKeyCredentials,
  type BasicAuthCredentials,
  type BearerTokenCredentials,
  type CustomAuthCredentials,
  type ConnectorCredentials,

  // Rate Limiting Types
  type RateLimitWindow,
  type RateLimitConfig,
  type RateLimitState,

  // Retry Types
  type BackoffStrategy,
  type RetryPolicy,
  type RetryAttempt,

  // Request/Response Types
  type HttpMethod,
  type ConnectorRequest,
  type ConnectorResponse,
  type ConnectorError,

  // Monitoring Types
  type HealthStatus,
  type HealthCheckResult,
  type ConnectorMetrics,
  type MonitoringEventType,
  type MonitoringEvent,
  type MonitoringHooks,

  // Configuration Types
  type CircuitBreakerConfig,
  type ConnectorConfig,

  // Instance Types
  type CircuitBreakerState,
  type ConnectorState,
  type ConnectionTestResult,

  // Data Mapping Types
  type ConnectorFieldMapping,
  type DataTransformConfig,

  // Sync Types
  type SyncDirection,
  type SyncMode,
  type SyncConfig,
  type SyncResult,

  // Store Types
  type StoredConnector,
  type ConnectorTypeDefinition,
} from '@glapi/types';
