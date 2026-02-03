/**
 * AI Tool Trace Context
 *
 * Provides distributed tracing support for AI tool calls.
 * Generates and propagates trace IDs and span IDs across the execution chain.
 */

import { randomBytes } from 'crypto';

// =============================================================================
// Types
// =============================================================================

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  sampled: boolean;
  baggage?: Record<string, string>;
}

export interface Span {
  context: TraceContext;
  name: string;
  startTime: number;
  endTime?: number;
  status: 'unset' | 'ok' | 'error';
  attributes: Record<string, string | number | boolean>;
  events: SpanEvent[];
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, string | number | boolean>;
}

// =============================================================================
// ID Generation
// =============================================================================

/**
 * Generate a random trace ID (32 hex characters).
 */
export function generateTraceId(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Generate a random span ID (16 hex characters).
 */
export function generateSpanId(): string {
  return randomBytes(8).toString('hex');
}

// =============================================================================
// Trace Context Management
// =============================================================================

// AsyncLocalStorage for trace context propagation
let currentContext: TraceContext | null = null;

/**
 * Create a new root trace context.
 */
export function createTraceContext(options?: {
  traceId?: string;
  sampled?: boolean;
  baggage?: Record<string, string>;
}): TraceContext {
  return {
    traceId: options?.traceId ?? generateTraceId(),
    spanId: generateSpanId(),
    sampled: options?.sampled ?? true,
    baggage: options?.baggage,
  };
}

/**
 * Create a child span context from a parent.
 */
export function createChildContext(parent: TraceContext): TraceContext {
  return {
    traceId: parent.traceId,
    spanId: generateSpanId(),
    parentSpanId: parent.spanId,
    sampled: parent.sampled,
    baggage: parent.baggage ? { ...parent.baggage } : undefined,
  };
}

/**
 * Get the current active trace context.
 */
export function getCurrentContext(): TraceContext | null {
  return currentContext;
}

/**
 * Set the current active trace context.
 */
export function setCurrentContext(context: TraceContext | null): void {
  currentContext = context;
}

/**
 * Run a function with a specific trace context.
 */
export async function withContext<T>(
  context: TraceContext,
  fn: () => T | Promise<T>
): Promise<T> {
  const previousContext = currentContext;
  currentContext = context;
  try {
    return await fn();
  } finally {
    currentContext = previousContext;
  }
}

// =============================================================================
// Span Management
// =============================================================================

/**
 * Create and start a new span.
 */
export function startSpan(
  name: string,
  parentContext?: TraceContext,
  attributes?: Record<string, string | number | boolean>
): Span {
  const context = parentContext
    ? createChildContext(parentContext)
    : createTraceContext();

  return {
    context,
    name,
    startTime: Date.now(),
    status: 'unset',
    attributes: attributes ?? {},
    events: [],
  };
}

/**
 * End a span with success status.
 */
export function endSpanSuccess(span: Span): Span {
  return {
    ...span,
    endTime: Date.now(),
    status: 'ok',
  };
}

/**
 * End a span with error status.
 */
export function endSpanError(
  span: Span,
  error?: { message?: string; code?: string }
): Span {
  const updatedSpan = {
    ...span,
    endTime: Date.now(),
    status: 'error' as const,
  };

  if (error) {
    updatedSpan.attributes = {
      ...updatedSpan.attributes,
      'error.message': error.message ?? 'Unknown error',
      'error.code': error.code ?? 'UNKNOWN',
    };
  }

  return updatedSpan;
}

/**
 * Add an event to a span.
 */
export function addSpanEvent(
  span: Span,
  name: string,
  attributes?: Record<string, string | number | boolean>
): Span {
  return {
    ...span,
    events: [
      ...span.events,
      {
        name,
        timestamp: Date.now(),
        attributes,
      },
    ],
  };
}

/**
 * Add attributes to a span.
 */
export function addSpanAttributes(
  span: Span,
  attributes: Record<string, string | number | boolean>
): Span {
  return {
    ...span,
    attributes: {
      ...span.attributes,
      ...attributes,
    },
  };
}

// =============================================================================
// W3C Trace Context Serialization
// =============================================================================

const TRACEPARENT_VERSION = '00';

/**
 * Serialize a trace context to W3C traceparent header format.
 * Format: version-traceId-spanId-flags
 */
export function serializeTraceparent(context: TraceContext): string {
  const flags = context.sampled ? '01' : '00';
  return `${TRACEPARENT_VERSION}-${context.traceId}-${context.spanId}-${flags}`;
}

/**
 * Parse a W3C traceparent header into a trace context.
 */
export function parseTraceparent(header: string): TraceContext | null {
  const parts = header.split('-');
  if (parts.length !== 4) return null;

  const [version, traceId, spanId, flags] = parts;

  // Validate format
  if (version !== TRACEPARENT_VERSION) return null;
  if (traceId.length !== 32 || !/^[0-9a-f]+$/i.test(traceId)) return null;
  if (spanId.length !== 16 || !/^[0-9a-f]+$/i.test(spanId)) return null;

  return {
    traceId: traceId.toLowerCase(),
    spanId: spanId.toLowerCase(),
    sampled: flags === '01',
  };
}

/**
 * Serialize baggage to W3C baggage header format.
 */
export function serializeBaggage(baggage: Record<string, string>): string {
  return Object.entries(baggage)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join(',');
}

/**
 * Parse a W3C baggage header.
 */
export function parseBaggage(header: string): Record<string, string> {
  const baggage: Record<string, string> = {};

  for (const item of header.split(',')) {
    const [key, value] = item.split('=');
    if (key && value) {
      baggage[decodeURIComponent(key.trim())] = decodeURIComponent(value.trim());
    }
  }

  return baggage;
}

// =============================================================================
// HTTP Header Helpers
// =============================================================================

export interface TraceHeaders {
  traceparent: string;
  tracestate?: string;
  baggage?: string;
}

/**
 * Extract trace headers for outgoing HTTP requests.
 */
export function getTraceHeaders(context?: TraceContext): TraceHeaders {
  const ctx = context ?? getCurrentContext();
  if (!ctx) {
    // Create new context for outgoing request
    const newCtx = createTraceContext();
    return {
      traceparent: serializeTraceparent(newCtx),
      baggage: newCtx.baggage ? serializeBaggage(newCtx.baggage) : undefined,
    };
  }

  return {
    traceparent: serializeTraceparent(ctx),
    baggage: ctx.baggage ? serializeBaggage(ctx.baggage) : undefined,
  };
}

/**
 * Extract trace context from incoming HTTP headers.
 */
export function extractTraceFromHeaders(headers: {
  traceparent?: string;
  baggage?: string;
}): TraceContext | null {
  if (!headers.traceparent) return null;

  const context = parseTraceparent(headers.traceparent);
  if (!context) return null;

  if (headers.baggage) {
    context.baggage = parseBaggage(headers.baggage);
  }

  return context;
}

// =============================================================================
// Tool Invocation Tracing Helper
// =============================================================================

/**
 * Create a trace context specifically for AI tool invocations.
 * Adds standard AI-related baggage items.
 */
export function createToolInvocationContext(
  toolName: string,
  parentContext?: TraceContext
): TraceContext {
  const context = parentContext
    ? createChildContext(parentContext)
    : createTraceContext();

  context.baggage = {
    ...context.baggage,
    'ai.tool': toolName,
    'ai.timestamp': Date.now().toString(),
  };

  return context;
}
