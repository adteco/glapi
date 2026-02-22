/**
 * AI Observability Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  // Events
  getToolEventEmitter,
  createStartEvent,
  createSuccessEvent,
  createErrorEvent,
  createMetricsListener,
  type ToolInvocationEvent,
  // Tracing
  generateTraceId,
  generateSpanId,
  createTraceContext,
  createChildContext,
  serializeTraceparent,
  parseTraceparent,
  startSpan,
  endSpanSuccess,
  endSpanError,
  // Audit
  AuditLogger,
  redactObject,
  redactPII,
} from '../observability';
import type { ExecutionContext, ExecutionResult } from '../generated/generated-executor';

describe('Tool Invocation Events', () => {
  const mockContext: ExecutionContext = {
    userId: 'user-123',
    organizationId: 'org-456',
    userRole: 'staff',
    authToken: 'token',
  };

  const mockTraceContext = {
    traceId: 'a'.repeat(32),
    spanId: 'b'.repeat(16),
  };

  beforeEach(() => {
    getToolEventEmitter().removeAllListeners();
  });

  describe('Event Emitter', () => {
    it('should emit events to listeners', async () => {
      const emitter = getToolEventEmitter();
      const receivedEvents: ToolInvocationEvent[] = [];

      emitter.on('ai.tool_invocation.start', (event) => {
        receivedEvents.push(event);
      });

      const event = createStartEvent('list_customers', mockContext, mockTraceContext, {
        riskLevel: 'LOW',
        method: 'GET',
      });

      await emitter.emit(event);

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0].toolName).toBe('list_customers');
    });

    it('should support wildcard listeners', async () => {
      const emitter = getToolEventEmitter();
      const receivedEvents: ToolInvocationEvent[] = [];

      emitter.on('*', (event) => {
        receivedEvents.push(event);
      });

      const startEvent = createStartEvent('list_customers', mockContext, mockTraceContext, {
        riskLevel: 'LOW',
        method: 'GET',
      });

      const successEvent = createSuccessEvent(
        startEvent,
        { success: true, data: { test: true } },
        Date.now() - 100
      );

      await emitter.emit(startEvent);
      await emitter.emit(successEvent);

      expect(receivedEvents).toHaveLength(2);
    });

    it('should return unsubscribe function', async () => {
      const emitter = getToolEventEmitter();
      const receivedEvents: ToolInvocationEvent[] = [];

      const unsubscribe = emitter.on('ai.tool_invocation.start', (event) => {
        receivedEvents.push(event);
      });

      const event = createStartEvent('list_customers', mockContext, mockTraceContext, {
        riskLevel: 'LOW',
        method: 'GET',
      });

      await emitter.emit(event);
      expect(receivedEvents).toHaveLength(1);

      // Unsubscribe and emit again
      unsubscribe();
      await emitter.emit(event);
      expect(receivedEvents).toHaveLength(1); // Should not increase
    });

    it('should track statistics', async () => {
      const emitter = getToolEventEmitter();
      const statsBefore = emitter.getStats();
      emitter.on('*', () => {});

      const event = createStartEvent('list_customers', mockContext, mockTraceContext, {
        riskLevel: 'LOW',
        method: 'GET',
      });

      await emitter.emit(event);
      await emitter.emit(event);

      const statsAfter = emitter.getStats();
      expect(statsAfter.eventsEmitted - statsBefore.eventsEmitted).toBe(2);
    });
  });

  describe('Event Creation', () => {
    it('should create start event with correct fields', () => {
      const event = createStartEvent('create_customer', mockContext, mockTraceContext, {
        riskLevel: 'MEDIUM',
        method: 'POST',
      });

      expect(event.type).toBe('ai.tool_invocation.start');
      expect(event.toolName).toBe('create_customer');
      expect(event.riskLevel).toBe('MEDIUM');
      expect(event.method).toBe('POST');
      expect(event.userId).toBe('user-123');
      expect(event.organizationId).toBe('org-456');
    });

    it('should create success event with duration', () => {
      const startEvent = createStartEvent('list_customers', mockContext, mockTraceContext, {
        riskLevel: 'LOW',
        method: 'GET',
      });

      const result: ExecutionResult = {
        success: true,
        data: [],
        outputShaping: {
          applied: true,
          fieldsRedacted: 2,
          itemsLimited: 0,
          tokensTruncated: false,
        },
      };

      const successEvent = createSuccessEvent(startEvent, result, Date.now() - 100);

      expect(successEvent.type).toBe('ai.tool_invocation.success');
      expect(successEvent.durationMs).toBeGreaterThanOrEqual(100);
      expect(successEvent.outputShaped).toBe(true);
      expect(successEvent.fieldsRedacted).toBe(2);
    });

    it('should create cache hit event', () => {
      const startEvent = createStartEvent('list_customers', mockContext, mockTraceContext, {
        riskLevel: 'LOW',
        method: 'GET',
      });

      const result: ExecutionResult = {
        success: true,
        data: [],
        fromCache: true,
      };

      const cacheEvent = createSuccessEvent(startEvent, result, Date.now() - 5);

      expect(cacheEvent.type).toBe('ai.tool_invocation.cache_hit');
      expect(cacheEvent.fromCache).toBe(true);
    });

    it('should create error event with correct type', () => {
      const startEvent = createStartEvent('create_customer', mockContext, mockTraceContext, {
        riskLevel: 'MEDIUM',
        method: 'POST',
      });

      const rateLimitedResult: ExecutionResult = {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests',
          retryable: true,
        },
      };

      const errorEvent = createErrorEvent(startEvent, rateLimitedResult, Date.now() - 10);

      expect(errorEvent.type).toBe('ai.tool_invocation.rate_limited');
      expect(errorEvent.errorCode).toBe('RATE_LIMITED');
      expect(errorEvent.retryable).toBe(true);
    });
  });

  describe('Metrics Listener', () => {
    it('should aggregate metrics', async () => {
      const emitter = getToolEventEmitter();
      const { listener, getMetrics, reset } = createMetricsListener();

      emitter.on('*', listener);

      // Emit success events
      const startEvent = createStartEvent('list_customers', mockContext, mockTraceContext, {
        riskLevel: 'LOW',
        method: 'GET',
      });

      await emitter.emit(startEvent);
      await emitter.emit(createSuccessEvent(startEvent, { success: true, data: [] }, Date.now() - 50));
      await emitter.emit(createSuccessEvent(startEvent, { success: true, data: [], fromCache: true }, Date.now() - 5));

      const metrics = getMetrics();
      expect(metrics.totalCalls).toBe(2); // Start events don't count
      expect(metrics.successCalls).toBe(2);
      expect(metrics.cacheHits).toBe(1);

      // Reset should clear
      reset();
      expect(getMetrics().totalCalls).toBe(0);
    });
  });
});

describe('Tracing', () => {
  describe('ID Generation', () => {
    it('should generate valid trace IDs', () => {
      const traceId = generateTraceId();
      expect(traceId).toHaveLength(32);
      expect(/^[0-9a-f]+$/.test(traceId)).toBe(true);
    });

    it('should generate valid span IDs', () => {
      const spanId = generateSpanId();
      expect(spanId).toHaveLength(16);
      expect(/^[0-9a-f]+$/.test(spanId)).toBe(true);
    });

    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateTraceId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('Context Management', () => {
    it('should create root context', () => {
      const context = createTraceContext();
      expect(context.traceId).toHaveLength(32);
      expect(context.spanId).toHaveLength(16);
      expect(context.parentSpanId).toBeUndefined();
      expect(context.sampled).toBe(true);
    });

    it('should create child context', () => {
      const parent = createTraceContext();
      const child = createChildContext(parent);

      expect(child.traceId).toBe(parent.traceId); // Same trace
      expect(child.spanId).not.toBe(parent.spanId); // Different span
      expect(child.parentSpanId).toBe(parent.spanId); // Links to parent
    });
  });

  describe('Span Operations', () => {
    it('should start and end span successfully', () => {
      const span = startSpan('test-operation');
      expect(span.status).toBe('unset');

      const endedSpan = endSpanSuccess(span);
      expect(endedSpan.status).toBe('ok');
      expect(endedSpan.endTime).toBeDefined();
      expect(endedSpan.endTime).toBeGreaterThanOrEqual(span.startTime);
    });

    it('should end span with error', () => {
      const span = startSpan('test-operation');
      const errorSpan = endSpanError(span, { code: 'TEST_ERROR', message: 'Test failed' });

      expect(errorSpan.status).toBe('error');
      expect(errorSpan.attributes['error.code']).toBe('TEST_ERROR');
      expect(errorSpan.attributes['error.message']).toBe('Test failed');
    });
  });

  describe('W3C Trace Context Serialization', () => {
    it('should serialize traceparent header', () => {
      const context = createTraceContext({ traceId: 'a'.repeat(32), sampled: true });
      context.spanId = 'b'.repeat(16);

      const header = serializeTraceparent(context);
      expect(header).toBe(`00-${'a'.repeat(32)}-${'b'.repeat(16)}-01`);
    });

    it('should parse traceparent header', () => {
      const header = `00-${'a'.repeat(32)}-${'b'.repeat(16)}-01`;
      const context = parseTraceparent(header);

      expect(context).not.toBeNull();
      expect(context!.traceId).toBe('a'.repeat(32));
      expect(context!.spanId).toBe('b'.repeat(16));
      expect(context!.sampled).toBe(true);
    });

    it('should return null for invalid traceparent', () => {
      expect(parseTraceparent('invalid')).toBeNull();
      expect(parseTraceparent('00-short-id-01')).toBeNull();
    });
  });
});

describe('Audit Logger', () => {
  const mockContext: ExecutionContext = {
    userId: 'user-123',
    organizationId: 'org-456',
    userRole: 'staff',
    authToken: 'token',
  };

  let logger: AuditLogger;

  beforeEach(() => {
    logger = new AuditLogger({ enabled: true, maxEntriesInMemory: 100 });
  });

  afterEach(async () => {
    await logger.stop();
  });

  describe('Logging', () => {
    it('should log tool invocations', () => {
      const id = logger.log(
        'list_customers',
        mockContext,
        { success: true, data: [] },
        {
          traceContext: createTraceContext(),
          riskLevel: 'LOW',
          method: 'GET',
          parameters: {},
          startTime: Date.now() - 100,
        }
      );

      expect(id).toBeTruthy();
      expect(logger.getEntryCount()).toBe(1);
    });

    it('should track statistics', () => {
      logger.log(
        'list_customers',
        mockContext,
        { success: true, data: [] },
        {
          traceContext: createTraceContext(),
          riskLevel: 'LOW',
          method: 'GET',
          parameters: {},
          startTime: Date.now(),
        }
      );

      const stats = logger.getStats();
      expect(stats.entriesLogged).toBe(1);
    });
  });

  describe('Querying', () => {
    beforeEach(() => {
      // Add some test entries
      logger.log('list_customers', mockContext, { success: true, data: [] }, {
        traceContext: createTraceContext(),
        riskLevel: 'LOW',
        method: 'GET',
        parameters: {},
        startTime: Date.now(),
      });
      logger.log('create_customer', mockContext, { success: false, error: { code: 'ERROR', message: 'Failed', retryable: false } }, {
        traceContext: createTraceContext(),
        riskLevel: 'MEDIUM',
        method: 'POST',
        parameters: { name: 'Test' },
        startTime: Date.now(),
      });
    });

    it('should query by tool name', () => {
      const results = logger.query({ toolName: 'list_customers' });
      expect(results).toHaveLength(1);
    });

    it('should query by success status', () => {
      const failures = logger.query({ success: false });
      expect(failures).toHaveLength(1);
      expect(failures[0].toolName).toBe('create_customer');
    });

    it('should query by risk level', () => {
      const mediumRisk = logger.query({ riskLevel: 'MEDIUM' });
      expect(mediumRisk).toHaveLength(1);
    });

    it('should limit results', () => {
      const results = logger.query({ limit: 1 });
      expect(results).toHaveLength(1);
    });
  });
});

describe('Redaction', () => {
  describe('redactObject', () => {
    it('should redact sensitive fields', () => {
      const obj = {
        name: 'Test',
        password: 'secret123',
        apiKey: 'key-123',
        data: {
          token: 'jwt-token',
          value: 'normal',
        },
      };

      const redacted = redactObject(obj, ['password', 'apiKey', 'token']);

      expect(redacted).toEqual({
        name: 'Test',
        password: '[REDACTED]',
        apiKey: '[REDACTED]',
        data: {
          token: '[REDACTED]',
          value: 'normal',
        },
      });
    });

    it('should handle arrays', () => {
      const obj = {
        users: [
          { name: 'User1', password: 'pass1' },
          { name: 'User2', password: 'pass2' },
        ],
      };

      const redacted = redactObject(obj, ['password']) as any;

      expect(redacted.users[0].password).toBe('[REDACTED]');
      expect(redacted.users[1].password).toBe('[REDACTED]');
    });

    it('should handle null and undefined', () => {
      expect(redactObject(null, ['password'])).toBeNull();
      expect(redactObject(undefined, ['password'])).toBeUndefined();
    });
  });

  describe('redactPII', () => {
    it('should redact SSN patterns', () => {
      const text = 'SSN: 123-45-6789';
      expect(redactPII(text)).toBe('SSN: [SSN-REDACTED]');
    });

    it('should redact credit card patterns', () => {
      const text = 'Card: 1234-5678-9012-3456';
      expect(redactPII(text)).toBe('Card: [CARD-REDACTED]');
    });

    it('should redact phone numbers', () => {
      const text = 'Phone: 555-123-4567';
      expect(redactPII(text)).toBe('Phone: [PHONE-REDACTED]');
    });

    it('should partially redact emails', () => {
      const text = 'Email: john.doe@example.com';
      const redacted = redactPII(text);
      expect(redacted).toContain('j***@[DOMAIN-REDACTED]');
    });
  });
});
