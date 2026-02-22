/**
 * AI Tool Invocation Events
 *
 * Provides structured event emission for AI tool calls.
 * Supports event listeners for monitoring, metrics, and audit trails.
 */

import type { ExecutionContext, ExecutionResult } from '../generated/generated-executor';
import type { RiskLevel } from '../generated/generated-tools';

// =============================================================================
// Event Types
// =============================================================================

export type ToolInvocationEventType =
  | 'ai.tool_invocation.start'
  | 'ai.tool_invocation.success'
  | 'ai.tool_invocation.error'
  | 'ai.tool_invocation.rate_limited'
  | 'ai.tool_invocation.permission_denied'
  | 'ai.tool_invocation.cache_hit';

export interface ToolInvocationEvent {
  type: ToolInvocationEventType;
  timestamp: Date;
  traceId: string;
  spanId: string;
  parentSpanId?: string;

  // Tool information
  toolName: string;
  riskLevel: RiskLevel;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

  // Context (redacted)
  userId: string;
  organizationId: string;
  userRole: string;

  // Execution details (varies by event type)
  durationMs?: number;
  fromCache?: boolean;
  errorCode?: string;
  errorMessage?: string;
  retryable?: boolean;

  // Metadata
  parameters?: Record<string, unknown>; // Redacted
  outputShaped?: boolean;
  fieldsRedacted?: number;
}

// Listener function type
export type ToolInvocationListener = (event: ToolInvocationEvent) => void | Promise<void>;

// =============================================================================
// Event Emitter
// =============================================================================

class ToolInvocationEventEmitter {
  private listeners: Map<ToolInvocationEventType | '*', Set<ToolInvocationListener>> = new Map();
  private enabled = true;

  // Statistics
  private stats = {
    eventsEmitted: 0,
    listenerErrors: 0,
    eventCounts: new Map<ToolInvocationEventType, number>(),
  };

  /**
   * Enable or disable event emission.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Add a listener for specific event type or all events (*).
   */
  on(eventType: ToolInvocationEventType | '*', listener: ToolInvocationListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(listener);
    };
  }

  /**
   * Remove a listener.
   */
  off(eventType: ToolInvocationEventType | '*', listener: ToolInvocationListener): void {
    this.listeners.get(eventType)?.delete(listener);
  }

  /**
   * Emit an event to all registered listeners.
   */
  async emit(event: ToolInvocationEvent): Promise<void> {
    if (!this.enabled) return;

    this.stats.eventsEmitted++;
    this.stats.eventCounts.set(
      event.type,
      (this.stats.eventCounts.get(event.type) ?? 0) + 1
    );

    // Get listeners for specific event type and wildcard listeners
    const specificListeners = this.listeners.get(event.type) ?? new Set();
    const wildcardListeners = this.listeners.get('*') ?? new Set();

    const allListeners = [...specificListeners, ...wildcardListeners];

    // Call listeners (catch errors to prevent one listener from breaking others)
    await Promise.all(
      allListeners.map(async (listener) => {
        try {
          await listener(event);
        } catch (error) {
          this.stats.listenerErrors++;
          console.error('[AI Event Emitter] Listener error:', error);
        }
      })
    );
  }

  /**
   * Get event statistics.
   */
  getStats(): {
    eventsEmitted: number;
    listenerErrors: number;
    eventCounts: Record<string, number>;
    listenerCounts: Record<string, number>;
  } {
    const eventCounts: Record<string, number> = {};
    for (const [type, count] of this.stats.eventCounts) {
      eventCounts[type] = count;
    }

    const listenerCounts: Record<string, number> = {};
    for (const [type, listeners] of this.listeners) {
      listenerCounts[type] = listeners.size;
    }

    return {
      eventsEmitted: this.stats.eventsEmitted,
      listenerErrors: this.stats.listenerErrors,
      eventCounts,
      listenerCounts,
    };
  }

  /**
   * Remove all listeners.
   */
  removeAllListeners(): void {
    this.listeners.clear();
  }
}

// Singleton instance
let globalEmitter: ToolInvocationEventEmitter | null = null;

/**
 * Get the global event emitter instance.
 */
export function getToolEventEmitter(): ToolInvocationEventEmitter {
  if (!globalEmitter) {
    globalEmitter = new ToolInvocationEventEmitter();
  }
  return globalEmitter;
}

// =============================================================================
// Event Factory Functions
// =============================================================================

/**
 * Create a tool invocation start event.
 */
export function createStartEvent(
  toolName: string,
  context: ExecutionContext,
  traceContext: { traceId: string; spanId: string; parentSpanId?: string },
  metadata: { riskLevel: RiskLevel; method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' }
): ToolInvocationEvent {
  return {
    type: 'ai.tool_invocation.start',
    timestamp: new Date(),
    traceId: traceContext.traceId,
    spanId: traceContext.spanId,
    parentSpanId: traceContext.parentSpanId,
    toolName,
    riskLevel: metadata.riskLevel,
    method: metadata.method,
    userId: context.userId,
    organizationId: context.organizationId,
    userRole: context.userRole,
  };
}

/**
 * Create a tool invocation success event.
 */
export function createSuccessEvent(
  startEvent: ToolInvocationEvent,
  result: ExecutionResult,
  startTime: number
): ToolInvocationEvent {
  return {
    ...startEvent,
    type: result.fromCache ? 'ai.tool_invocation.cache_hit' : 'ai.tool_invocation.success',
    timestamp: new Date(),
    durationMs: Date.now() - startTime,
    fromCache: result.fromCache,
    outputShaped: result.outputShaping?.applied,
    fieldsRedacted: result.outputShaping?.fieldsRedacted,
  };
}

/**
 * Create a tool invocation error event.
 */
export function createErrorEvent(
  startEvent: ToolInvocationEvent,
  result: ExecutionResult,
  startTime: number
): ToolInvocationEvent {
  const errorCode = result.error?.code ?? 'UNKNOWN_ERROR';

  // Determine specific event type based on error
  let eventType: ToolInvocationEventType = 'ai.tool_invocation.error';
  if (errorCode === 'RATE_LIMITED') {
    eventType = 'ai.tool_invocation.rate_limited';
  } else if (errorCode === 'PERMISSION_DENIED') {
    eventType = 'ai.tool_invocation.permission_denied';
  }

  return {
    ...startEvent,
    type: eventType,
    timestamp: new Date(),
    durationMs: Date.now() - startTime,
    errorCode,
    errorMessage: result.error?.message,
    retryable: result.error?.retryable,
  };
}

// =============================================================================
// Convenience Logging Listeners
// =============================================================================

/**
 * Create a console logging listener.
 */
export function createConsoleListener(options: {
  logLevel?: 'debug' | 'info' | 'warn';
  includeTimestamp?: boolean;
} = {}): ToolInvocationListener {
  const { logLevel = 'info', includeTimestamp = true } = options;

  return (event) => {
    const prefix = includeTimestamp
      ? `[${event.timestamp.toISOString()}]`
      : '';
    const msg = `${prefix} [AI] ${event.type} - ${event.toolName} (${event.durationMs ?? 0}ms)`;

    switch (logLevel) {
      case 'debug':
        console.debug(msg, { traceId: event.traceId, userId: event.userId });
        break;
      case 'warn':
        if (event.type.includes('error') || event.type.includes('denied')) {
          console.warn(msg, { errorCode: event.errorCode });
        }
        break;
      default:
        console.log(msg);
    }
  };
}

/**
 * Create a metrics aggregation listener.
 */
export function createMetricsListener(): {
  listener: ToolInvocationListener;
  getMetrics: () => {
    totalCalls: number;
    successCalls: number;
    errorCalls: number;
    cacheHits: number;
    rateLimited: number;
    permissionDenied: number;
    avgDurationMs: number;
    byTool: Record<string, { calls: number; errors: number; avgDurationMs: number }>;
  };
  reset: () => void;
} {
  let totalCalls = 0;
  let successCalls = 0;
  let errorCalls = 0;
  let cacheHits = 0;
  let rateLimited = 0;
  let permissionDenied = 0;
  let totalDurationMs = 0;
  const byTool = new Map<string, { calls: number; errors: number; totalDurationMs: number }>();

  const listener: ToolInvocationListener = (event) => {
    // Only count completion events
    if (event.type === 'ai.tool_invocation.start') return;

    totalCalls++;
    totalDurationMs += event.durationMs ?? 0;

    // Update tool-specific metrics
    const toolStats = byTool.get(event.toolName) ?? { calls: 0, errors: 0, totalDurationMs: 0 };
    toolStats.calls++;
    toolStats.totalDurationMs += event.durationMs ?? 0;

    switch (event.type) {
      case 'ai.tool_invocation.success':
        successCalls++;
        break;
      case 'ai.tool_invocation.cache_hit':
        successCalls++;
        cacheHits++;
        break;
      case 'ai.tool_invocation.rate_limited':
        errorCalls++;
        toolStats.errors++;
        rateLimited++;
        break;
      case 'ai.tool_invocation.permission_denied':
        errorCalls++;
        toolStats.errors++;
        permissionDenied++;
        break;
      case 'ai.tool_invocation.error':
        errorCalls++;
        toolStats.errors++;
        break;
    }

    byTool.set(event.toolName, toolStats);
  };

  const getMetrics = () => {
    const byToolResult: Record<string, { calls: number; errors: number; avgDurationMs: number }> = {};
    for (const [tool, stats] of byTool) {
      byToolResult[tool] = {
        calls: stats.calls,
        errors: stats.errors,
        avgDurationMs: stats.calls > 0 ? Math.round(stats.totalDurationMs / stats.calls) : 0,
      };
    }

    return {
      totalCalls,
      successCalls,
      errorCalls,
      cacheHits,
      rateLimited,
      permissionDenied,
      avgDurationMs: totalCalls > 0 ? Math.round(totalDurationMs / totalCalls) : 0,
      byTool: byToolResult,
    };
  };

  const reset = () => {
    totalCalls = 0;
    successCalls = 0;
    errorCalls = 0;
    cacheHits = 0;
    rateLimited = 0;
    permissionDenied = 0;
    totalDurationMs = 0;
    byTool.clear();
  };

  return { listener, getMetrics, reset };
}
