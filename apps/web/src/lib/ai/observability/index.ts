/**
 * AI Observability Module
 *
 * Provides event emission, tracing, and audit logging for AI tool calls.
 */

// Events
export {
  getToolEventEmitter,
  createStartEvent,
  createSuccessEvent,
  createErrorEvent,
  createConsoleListener,
  createMetricsListener,
  type ToolInvocationEvent,
  type ToolInvocationEventType,
  type ToolInvocationListener,
} from './events';

// Tracing
export {
  generateTraceId,
  generateSpanId,
  createTraceContext,
  createChildContext,
  getCurrentContext,
  setCurrentContext,
  withContext,
  startSpan,
  endSpanSuccess,
  endSpanError,
  addSpanEvent,
  addSpanAttributes,
  serializeTraceparent,
  parseTraceparent,
  serializeBaggage,
  parseBaggage,
  getTraceHeaders,
  extractTraceFromHeaders,
  createToolInvocationContext,
  type TraceContext,
  type Span,
  type SpanEvent,
  type TraceHeaders,
} from './tracing';

// Audit
export {
  AuditLogger,
  getAuditLogger,
  createAuditLoggerInterface,
  redactObject,
  redactPII,
  type AuditLogEntry,
  type AuditLoggerConfig,
  type AuditLoggerStats,
} from './audit';
