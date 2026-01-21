/**
 * GLAPI Conversational Ledger - Middleware Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createIntentMiddleware,
  createProductionMiddleware,
  createTestMiddleware,
  type IntentMiddlewareOptions,
  type AuditLogEntry,
} from '../middleware';
import { createDefaultUserContext, type UserContext } from '../guardrails';

describe('Intent Middleware', () => {
  let adminContext: UserContext;
  let viewerContext: UserContext;
  let staffContext: UserContext;

  beforeEach(() => {
    adminContext = createDefaultUserContext('admin-user', 'org-123', 'admin');
    viewerContext = createDefaultUserContext('viewer-user', 'org-123', 'viewer');
    staffContext = createDefaultUserContext('staff-user', 'org-123', 'staff');
  });

  describe('createIntentMiddleware', () => {
    it('should create middleware with default options', () => {
      const middleware = createIntentMiddleware();
      expect(middleware.processToolCall).toBeDefined();
      expect(middleware.wrapToolExecutor).toBeDefined();
    });

    it('should allow custom options', () => {
      const customLogger = vi.fn();
      const middleware = createIntentMiddleware({
        enableLogging: true,
        logger: customLogger,
        skipConfirmation: true,
      });

      expect(middleware).toBeDefined();
    });
  });

  describe('processToolCall - Basic Flow', () => {
    it('should allow valid read operations', async () => {
      const middleware = createIntentMiddleware({ enableLogging: false });

      const result = await middleware.processToolCall(
        'list_customers',
        {},
        adminContext,
        'Show me all customers'
      );

      expect(result.proceed).toBe(true);
      expect(result.guardrailResult.allowed).toBe(true);
      expect(result.auditEntry).toBeDefined();
    });

    it('should deny operations for users without permission', async () => {
      const middleware = createIntentMiddleware({ enableLogging: false });

      const result = await middleware.processToolCall(
        'create_customer',
        { name: 'Test' },
        viewerContext,
        'Create a customer'
      );

      expect(result.proceed).toBe(false);
      expect(result.guardrailResult.allowed).toBe(false);
      expect(result.guardrailResult.errorCode).toBe('PERMISSION_DENIED');
    });

    it('should reject unknown tools', async () => {
      const middleware = createIntentMiddleware({ enableLogging: false });

      const result = await middleware.processToolCall(
        'unknown_tool',
        {},
        adminContext,
        'Do something'
      );

      expect(result.proceed).toBe(false);
      expect(result.guardrailResult.errorCode).toBe('INTENT_DISABLED');
    });
  });

  describe('processToolCall - Confirmation Flow', () => {
    it('should request confirmation for high-risk operations', async () => {
      const onConfirmationRequired = vi.fn().mockResolvedValue(false);

      const middleware = createIntentMiddleware({
        enableLogging: false,
        onConfirmationRequired,
      });

      const result = await middleware.processToolCall(
        'create_customer',
        { name: 'Test Customer' },
        staffContext,
        'Create a customer'
      );

      expect(result.proceed).toBe(false);
      expect(onConfirmationRequired).toHaveBeenCalled();
      expect(result.guardrailResult.reason).toBe('User declined confirmation');
    });

    it('should proceed when confirmation is granted', async () => {
      const onConfirmationRequired = vi.fn().mockResolvedValue(true);

      const middleware = createIntentMiddleware({
        enableLogging: false,
        onConfirmationRequired,
      });

      const result = await middleware.processToolCall(
        'create_customer',
        { name: 'Test Customer' },
        staffContext,
        'Create a customer'
      );

      expect(result.proceed).toBe(true);
      expect(onConfirmationRequired).toHaveBeenCalled();
    });

    it('should skip confirmation when configured', async () => {
      const middleware = createIntentMiddleware({
        enableLogging: false,
        skipConfirmation: true,
      });

      const result = await middleware.processToolCall(
        'create_customer',
        { name: 'Test Customer' },
        staffContext,
        'Create a customer'
      );

      expect(result.proceed).toBe(true);
    });
  });

  describe('processToolCall - Callback Hooks', () => {
    it('should call onBlocked when action is denied', async () => {
      const onBlocked = vi.fn();

      const middleware = createIntentMiddleware({
        enableLogging: false,
        onBlocked,
      });

      await middleware.processToolCall(
        'create_customer',
        { name: 'Test' },
        viewerContext,
        'Create a customer'
      );

      expect(onBlocked).toHaveBeenCalledWith(
        expect.objectContaining({ allowed: false }),
        expect.objectContaining({ toolName: 'create_customer' })
      );
    });

    it('should not call onBlocked for allowed operations', async () => {
      const onBlocked = vi.fn();

      const middleware = createIntentMiddleware({
        enableLogging: false,
        onBlocked,
      });

      await middleware.processToolCall(
        'list_customers',
        {},
        adminContext,
        'List customers'
      );

      expect(onBlocked).not.toHaveBeenCalled();
    });
  });

  describe('Audit Log Entries', () => {
    it('should create audit entry for allowed actions', async () => {
      const middleware = createIntentMiddleware({ enableLogging: false });

      const result = await middleware.processToolCall(
        'list_customers',
        {},
        adminContext,
        'Show me all customers'
      );

      const audit = result.auditEntry;
      expect(audit.id).toMatch(/^audit_req_/);
      expect(audit.userId).toBe('admin-user');
      expect(audit.organizationId).toBe('org-123');
      expect(audit.intentId).toBe('LIST_CUSTOMERS');
      expect(audit.toolName).toBe('list_customers');
      expect(audit.allowed).toBe(true);
      expect(audit.riskLevel).toBe('LOW');
      expect(audit.timestamp).toBeInstanceOf(Date);
    });

    it('should create audit entry for denied actions', async () => {
      const middleware = createIntentMiddleware({ enableLogging: false });

      const result = await middleware.processToolCall(
        'create_customer',
        { name: 'Test' },
        viewerContext,
        'Create a customer'
      );

      const audit = result.auditEntry;
      expect(audit.allowed).toBe(false);
      expect(audit.denialReason).toBeDefined();
      expect(audit.riskLevel).toBe('MEDIUM');
    });

    it('should record confirmation status in audit', async () => {
      const onConfirmationRequired = vi.fn().mockResolvedValue(true);

      const middleware = createIntentMiddleware({
        enableLogging: false,
        onConfirmationRequired,
      });

      const result = await middleware.processToolCall(
        'create_customer',
        { name: 'Test' },
        staffContext,
        'Create a customer'
      );

      expect(result.auditEntry.confirmationRequired).toBe(true);
      expect(result.auditEntry.confirmationProvided).toBe(true);
    });

    it('should sanitize sensitive parameters in audit', async () => {
      const middleware = createIntentMiddleware({ enableLogging: false });

      const result = await middleware.processToolCall(
        'list_customers',
        {
          searchTerm: 'Acme',
          password: 'secret123',
          apiKey: 'key-abc-123',
          ssn: '123-45-6789',
        },
        adminContext,
        'Find customers'
      );

      const params = result.auditEntry.parameters;
      expect(params.searchTerm).toBe('Acme');
      expect(params.password).toBe('[REDACTED]');
      expect(params.apiKey).toBe('[REDACTED]');
      expect(params.ssn).toBe('[REDACTED]');
    });
  });

  describe('wrapToolExecutor', () => {
    it('should wrap executor and enforce guardrails', async () => {
      const middleware = createIntentMiddleware({
        enableLogging: false,
        skipConfirmation: true,
      });

      const mockExecutor = vi.fn().mockResolvedValue({ customers: [] });

      const wrappedExecutor = middleware.wrapToolExecutor(mockExecutor);

      const result = await wrappedExecutor(
        'list_customers',
        {},
        adminContext,
        'List customers'
      );

      expect(result.result).toEqual({ customers: [] });
      expect(result.auditEntry).toBeDefined();
      expect(mockExecutor).toHaveBeenCalledWith('list_customers', {});
    });

    it('should not execute when blocked', async () => {
      const middleware = createIntentMiddleware({
        enableLogging: false,
      });

      const mockExecutor = vi.fn();
      const wrappedExecutor = middleware.wrapToolExecutor(mockExecutor);

      const result = await wrappedExecutor(
        'create_customer',
        { name: 'Test' },
        viewerContext,
        'Create a customer'
      );

      expect(result.error).toBeDefined();
      expect(result.result).toBeUndefined();
      expect(mockExecutor).not.toHaveBeenCalled();
    });

    it('should handle executor errors', async () => {
      const middleware = createIntentMiddleware({
        enableLogging: false,
        skipConfirmation: true,
      });

      const mockExecutor = vi.fn().mockRejectedValue(new Error('Database error'));
      const wrappedExecutor = middleware.wrapToolExecutor(mockExecutor);

      const result = await wrappedExecutor(
        'list_customers',
        {},
        adminContext,
        'List customers'
      );

      expect(result.error).toBe('Database error');
      expect(result.result).toBeUndefined();
    });
  });

  describe('createProductionMiddleware', () => {
    it('should create middleware with production settings', async () => {
      const onBlocked = vi.fn();
      const onConfirmationRequired = vi.fn().mockResolvedValue(true);

      const middleware = createProductionMiddleware(onBlocked, onConfirmationRequired);

      // Should require confirmation for write operations
      const result = await middleware.processToolCall(
        'create_customer',
        { name: 'Test' },
        staffContext,
        'Create a customer'
      );

      expect(result.proceed).toBe(true);
      expect(onConfirmationRequired).toHaveBeenCalled();
    });
  });

  describe('createTestMiddleware', () => {
    it('should create middleware that skips confirmations', async () => {
      const middleware = createTestMiddleware();

      const result = await middleware.processToolCall(
        'create_customer',
        { name: 'Test' },
        staffContext,
        'Create a customer'
      );

      // Should proceed without confirmation
      expect(result.proceed).toBe(true);
    });

    it('should still enforce permissions', async () => {
      const middleware = createTestMiddleware();

      const result = await middleware.processToolCall(
        'create_customer',
        { name: 'Test' },
        viewerContext,
        'Create a customer'
      );

      // Should still deny due to permissions
      expect(result.proceed).toBe(false);
    });
  });

  describe('Logging', () => {
    it('should call logger when enabled', async () => {
      const customLogger = vi.fn();

      const middleware = createIntentMiddleware({
        enableLogging: true,
        logger: customLogger,
      });

      await middleware.processToolCall(
        'list_customers',
        {},
        adminContext,
        'List customers'
      );

      expect(customLogger).toHaveBeenCalled();
    });

    it('should not call logger when disabled', async () => {
      const customLogger = vi.fn();

      const middleware = createIntentMiddleware({
        enableLogging: false,
        logger: customLogger,
      });

      await middleware.processToolCall(
        'list_customers',
        {},
        adminContext,
        'List customers'
      );

      expect(customLogger).not.toHaveBeenCalled();
    });

    it('should log warnings when present', async () => {
      const customLogger = vi.fn();

      const middleware = createIntentMiddleware({
        enableLogging: true,
        logger: customLogger,
        skipConfirmation: true,
      });

      // PII in message should generate warning
      await middleware.processToolCall(
        'create_customer',
        { name: 'Test' },
        staffContext,
        'Create customer with SSN 123-45-6789'
      );

      // Should have logged the warning
      const warningCalls = customLogger.mock.calls.filter((call) =>
        call[0].includes('Warning')
      );
      expect(warningCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Parameter Sanitization', () => {
    it('should trim string parameters', async () => {
      const middleware = createIntentMiddleware({
        enableLogging: false,
        skipConfirmation: true,
      });

      const result = await middleware.processToolCall(
        'create_customer',
        { name: '  Test Customer  ', email: '  test@example.com  ' },
        staffContext,
        'Create a customer'
      );

      expect(result.parameters.name).toBe('Test Customer');
      expect(result.parameters.email).toBe('test@example.com');
    });

    it('should preserve non-string parameters', async () => {
      const middleware = createIntentMiddleware({
        enableLogging: false,
        skipConfirmation: true,
      });

      const result = await middleware.processToolCall(
        'list_customers',
        { limit: 10, active: true, tags: ['vip', 'premium'] },
        adminContext,
        'List customers'
      );

      expect(result.parameters.limit).toBe(10);
      expect(result.parameters.active).toBe(true);
      expect(result.parameters.tags).toEqual(['vip', 'premium']);
    });
  });
});
