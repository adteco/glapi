/**
 * AI Tool Audit Logger
 *
 * Stores redacted audit logs for AI tool invocations.
 * Supports compliance requirements with configurable retention.
 */

import type { ExecutionContext, ExecutionResult } from '../generated/generated-executor';
import type { RiskLevel } from '../generated/generated-tools';
import type { TraceContext } from './tracing';

// =============================================================================
// Types
// =============================================================================

export interface AuditLogEntry {
  id: string;
  timestamp: Date;

  // Trace info
  traceId: string;
  spanId: string;

  // User/org context
  userId: string;
  organizationId: string;
  userRole: string;

  // Tool info
  toolName: string;
  riskLevel: RiskLevel;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

  // Execution result
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  durationMs: number;
  fromCache: boolean;

  // Redacted data
  parameters: Record<string, unknown>; // PII redacted
  outputSummary?: string; // Brief description, no actual data

  // Shaping info
  outputShaped: boolean;
  fieldsRedacted: number;
  itemsLimited: number;
}

export interface AuditLoggerConfig {
  enabled?: boolean;
  maxEntriesInMemory?: number;
  retentionDays?: number;
  redactFields?: string[]; // Additional fields to redact
  onFlush?: (entries: AuditLogEntry[]) => Promise<void>;
  flushIntervalMs?: number;
  flushBatchSize?: number;
}

export interface AuditLoggerStats {
  entriesLogged: number;
  entriesFlushed: number;
  flushErrors: number;
  oldestEntry?: Date;
  newestEntry?: Date;
}

// Default fields to redact from parameters
const DEFAULT_REDACT_FIELDS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'api_key',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'ssn',
  'socialSecurityNumber',
  'creditCard',
  'credit_card',
  'cardNumber',
  'card_number',
  'cvv',
  'cvc',
  'pin',
];

// =============================================================================
// Redaction Utilities
// =============================================================================

/**
 * Redact sensitive fields from an object.
 */
export function redactObject(
  obj: unknown,
  fieldsToRedact: string[]
): unknown {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactObject(item, fieldsToRedact));
  }

  const result: Record<string, unknown> = {};
  const record = obj as Record<string, unknown>;

  for (const [key, value] of Object.entries(record)) {
    // Check if this key should be redacted
    const shouldRedact = fieldsToRedact.some((field) =>
      key.toLowerCase().includes(field.toLowerCase())
    );

    if (shouldRedact) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactObject(value, fieldsToRedact);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Redact potential PII patterns from strings.
 */
export function redactPII(text: string): string {
  // SSN pattern: XXX-XX-XXXX
  let result = text.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN-REDACTED]');

  // Credit card patterns (basic)
  result = result.replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, '[CARD-REDACTED]');

  // Email addresses (partial)
  result = result.replace(
    /\b([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g,
    (match, local) => `${local.charAt(0)}***@[DOMAIN-REDACTED]`
  );

  // Phone numbers (basic US format)
  result = result.replace(
    /\b(\+?1?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    '[PHONE-REDACTED]'
  );

  return result;
}

// =============================================================================
// Audit Logger
// =============================================================================

export class AuditLogger {
  private entries: AuditLogEntry[] = [];
  private config: Required<AuditLoggerConfig>;
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  // Statistics
  private stats: AuditLoggerStats = {
    entriesLogged: 0,
    entriesFlushed: 0,
    flushErrors: 0,
  };

  constructor(config: AuditLoggerConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      maxEntriesInMemory: config.maxEntriesInMemory ?? 1000,
      retentionDays: config.retentionDays ?? 90,
      redactFields: [...DEFAULT_REDACT_FIELDS, ...(config.redactFields ?? [])],
      onFlush: config.onFlush ?? (async () => {}),
      flushIntervalMs: config.flushIntervalMs ?? 60000, // 1 minute
      flushBatchSize: config.flushBatchSize ?? 100,
    };

    // Start periodic flush
    if (typeof setInterval !== 'undefined' && this.config.onFlush) {
      this.flushTimer = setInterval(() => this.flush(), this.config.flushIntervalMs);
    }
  }

  /**
   * Log a tool invocation.
   */
  log(
    toolName: string,
    context: ExecutionContext,
    result: ExecutionResult,
    metadata: {
      traceContext: TraceContext;
      riskLevel: RiskLevel;
      method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      parameters: unknown;
      startTime: number;
    }
  ): string {
    if (!this.config.enabled) return '';

    const id = this.generateId();
    const now = new Date();

    // Redact parameters
    const redactedParams = redactObject(
      metadata.parameters,
      this.config.redactFields
    ) as Record<string, unknown>;

    const entry: AuditLogEntry = {
      id,
      timestamp: now,
      traceId: metadata.traceContext.traceId,
      spanId: metadata.traceContext.spanId,
      userId: context.userId,
      organizationId: context.organizationId,
      userRole: context.userRole,
      toolName,
      riskLevel: metadata.riskLevel,
      method: metadata.method,
      success: result.success,
      errorCode: result.error?.code,
      errorMessage: result.error?.message ? redactPII(result.error.message) : undefined,
      durationMs: Date.now() - metadata.startTime,
      fromCache: result.fromCache ?? false,
      parameters: redactedParams,
      outputSummary: result.success
        ? `Returned ${typeof result.data === 'object' && result.data !== null ? (Array.isArray(result.data) ? `${result.data.length} items` : 'object') : 'value'}`
        : undefined,
      outputShaped: result.outputShaping?.applied ?? false,
      fieldsRedacted: result.outputShaping?.fieldsRedacted ?? 0,
      itemsLimited: result.outputShaping?.itemsLimited ?? 0,
    };

    this.entries.push(entry);
    this.stats.entriesLogged++;

    // Update timestamp tracking
    if (!this.stats.oldestEntry || now < this.stats.oldestEntry) {
      this.stats.oldestEntry = now;
    }
    this.stats.newestEntry = now;

    // Flush if at capacity
    if (this.entries.length >= this.config.maxEntriesInMemory) {
      this.flush().catch(console.error);
    }

    return id;
  }

  /**
   * Query audit logs (in-memory only, for recent entries).
   */
  query(filter: {
    userId?: string;
    organizationId?: string;
    toolName?: string;
    success?: boolean;
    riskLevel?: RiskLevel;
    since?: Date;
    until?: Date;
    limit?: number;
  }): AuditLogEntry[] {
    let results = this.entries;

    if (filter.userId) {
      results = results.filter((e) => e.userId === filter.userId);
    }
    if (filter.organizationId) {
      results = results.filter((e) => e.organizationId === filter.organizationId);
    }
    if (filter.toolName) {
      results = results.filter((e) => e.toolName === filter.toolName);
    }
    if (filter.success !== undefined) {
      results = results.filter((e) => e.success === filter.success);
    }
    if (filter.riskLevel) {
      results = results.filter((e) => e.riskLevel === filter.riskLevel);
    }
    if (filter.since) {
      results = results.filter((e) => e.timestamp >= filter.since!);
    }
    if (filter.until) {
      results = results.filter((e) => e.timestamp <= filter.until!);
    }

    // Sort by timestamp descending (newest first)
    results = results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply limit
    if (filter.limit) {
      results = results.slice(0, filter.limit);
    }

    return results;
  }

  /**
   * Flush entries to the configured handler.
   */
  async flush(): Promise<void> {
    if (this.entries.length === 0) return;

    const entriesToFlush = this.entries.splice(0, this.config.flushBatchSize);

    try {
      await this.config.onFlush(entriesToFlush);
      this.stats.entriesFlushed += entriesToFlush.length;
    } catch (error) {
      // Put entries back at the front
      this.entries.unshift(...entriesToFlush);
      this.stats.flushErrors++;
      console.error('[AI Audit Logger] Flush error:', error);
    }
  }

  /**
   * Get logger statistics.
   */
  getStats(): AuditLoggerStats {
    return { ...this.stats };
  }

  /**
   * Get current in-memory entry count.
   */
  getEntryCount(): number {
    return this.entries.length;
  }

  /**
   * Stop the logger and flush remaining entries.
   */
  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush all remaining entries
    while (this.entries.length > 0) {
      await this.flush();
    }
  }

  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `audit_${timestamp}_${random}`;
  }
}

// Singleton instance
let globalLogger: AuditLogger | null = null;

/**
 * Get the global audit logger instance.
 */
export function getAuditLogger(config?: AuditLoggerConfig): AuditLogger {
  if (!globalLogger) {
    globalLogger = new AuditLogger(config);
  }
  return globalLogger;
}

/**
 * Create the audit logger interface for the executor.
 */
export function createAuditLoggerInterface(logger: AuditLogger = getAuditLogger()) {
  return {
    log: (
      toolName: string,
      context: ExecutionContext,
      result: ExecutionResult,
      metadata: {
        traceContext: TraceContext;
        riskLevel: RiskLevel;
        method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
        parameters: unknown;
        startTime: number;
      }
    ) => logger.log(toolName, context, result, metadata),
  };
}
