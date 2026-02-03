/**
 * GLAPI Conversational Ledger - Intent Validation Middleware
 *
 * This module provides middleware for validating intents and enforcing
 * guardrails before tool execution.
 */

import {
  evaluateGuardrails,
  type UserContext,
  type GuardrailResult,
} from './guardrails';
import { type UnifiedToolInfo } from './tool-adapter';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for configuring the intent middleware
 */
export interface IntentMiddlewareOptions {
  /** Enable/disable logging */
  enableLogging?: boolean;
  /** Custom logger function */
  logger?: (message: string, data?: unknown) => void;
  /** Callback when an intent is blocked */
  onBlocked?: (result: GuardrailResult, context: MiddlewareContext) => void;
  /** Callback when confirmation is required */
  onConfirmationRequired?: (
    result: GuardrailResult,
    context: MiddlewareContext
  ) => Promise<boolean>;
  /** Skip confirmation prompts (for testing) */
  skipConfirmation?: boolean;
  /** Custom user context provider */
  getUserContext?: () => Promise<UserContext>;
}

/**
 * Context passed through middleware
 */
export interface MiddlewareContext {
  /** Tool/MCP function being called */
  toolName: string;
  /** Parameters for the tool */
  parameters: Record<string, unknown>;
  /** User context */
  userContext: UserContext;
  /** Original user message (if available) */
  userMessage?: string;
  /** Request timestamp */
  timestamp: Date;
  /** Request ID for tracing */
  requestId: string;
}

/**
 * Result of middleware processing
 */
export interface MiddlewareResult {
  /** Whether to proceed with the tool call */
  proceed: boolean;
  /** Guardrail evaluation result */
  guardrailResult: GuardrailResult;
  /** Modified parameters (if any transformations applied) */
  parameters: Record<string, unknown>;
  /** Audit log entry */
  auditEntry: AuditLogEntry;
}

/**
 * Audit log entry for compliance tracking
 */
export interface AuditLogEntry {
  /** Unique entry ID */
  id: string;
  /** Timestamp */
  timestamp: Date;
  /** User ID */
  userId: string;
  /** Organization ID */
  organizationId: string;
  /** Intent/tool attempted */
  intentId: string;
  /** Tool name */
  toolName: string;
  /** Whether the action was allowed */
  allowed: boolean;
  /** Denial reason (if applicable) */
  denialReason?: string;
  /** Whether confirmation was required */
  confirmationRequired: boolean;
  /** Whether confirmation was provided */
  confirmationProvided?: boolean;
  /** Risk level of the intent */
  riskLevel: string;
  /** Parameters (sanitized) */
  parameters: Record<string, unknown>;
  /** IP address (if available) */
  ipAddress?: string;
}

// ============================================================================
// Middleware Factory
// ============================================================================

/**
 * Create an intent validation middleware
 */
export function createIntentMiddleware(options: IntentMiddlewareOptions = {}) {
  const {
    enableLogging = true,
    logger = defaultLogger,
    onBlocked,
    onConfirmationRequired,
    skipConfirmation = false,
  } = options;

  /**
   * Process a tool call through the guardrails
   */
  async function processToolCall(
    toolName: string,
    parameters: Record<string, unknown>,
    userContext: UserContext,
    userMessage?: string
  ): Promise<MiddlewareResult> {
    const requestId = generateRequestId();
    const timestamp = new Date();

    const context: MiddlewareContext = {
      toolName,
      parameters,
      userContext,
      userMessage,
      timestamp,
      requestId,
    };

    // Log the request
    if (enableLogging) {
      logger(`[${requestId}] Processing tool call: ${toolName}`, {
        userId: userContext.userId,
        role: userContext.role,
      });
    }

    // Evaluate guardrails
    const guardrailResult = evaluateGuardrails(
      toolName,
      parameters,
      userContext,
      userMessage
    );

    // Create audit entry
    const auditEntry = createAuditEntry(context, guardrailResult);

    // Handle blocked requests
    if (!guardrailResult.allowed) {
      if (enableLogging) {
        logger(`[${requestId}] Tool call blocked: ${guardrailResult.reason}`, {
          errorCode: guardrailResult.errorCode,
        });
      }

      if (onBlocked) {
        onBlocked(guardrailResult, context);
      }

      return {
        proceed: false,
        guardrailResult,
        parameters,
        auditEntry,
      };
    }

    // Handle confirmation requirements
    if (guardrailResult.requiresConfirmation && !skipConfirmation) {
      if (enableLogging) {
        logger(`[${requestId}] Confirmation required for: ${toolName}`);
      }

      let confirmed = false;
      if (onConfirmationRequired) {
        confirmed = await onConfirmationRequired(guardrailResult, context);
      }

      auditEntry.confirmationRequired = true;
      auditEntry.confirmationProvided = confirmed;

      if (!confirmed) {
        if (enableLogging) {
          logger(`[${requestId}] User declined confirmation`);
        }

        return {
          proceed: false,
          guardrailResult: {
            ...guardrailResult,
            allowed: false,
            reason: 'User declined confirmation',
            errorCode: 'CONFIRMATION_REQUIRED',
          },
          parameters,
          auditEntry,
        };
      }
    }

    // Log warnings
    if (guardrailResult.warnings.length > 0 && enableLogging) {
      for (const warning of guardrailResult.warnings) {
        logger(`[${requestId}] Warning: ${warning}`);
      }
    }

    // Sanitize parameters if needed
    const sanitizedParameters = sanitizeParameters(parameters, guardrailResult.toolInfo);

    if (enableLogging) {
      logger(`[${requestId}] Tool call approved: ${toolName}`);
    }

    return {
      proceed: true,
      guardrailResult,
      parameters: sanitizedParameters,
      auditEntry,
    };
  }

  /**
   * Wrap a tool executor with middleware
   */
  function wrapToolExecutor<T>(
    executor: (toolName: string, parameters: Record<string, unknown>) => Promise<T>
  ) {
    return async (
      toolName: string,
      parameters: Record<string, unknown>,
      userContext: UserContext,
      userMessage?: string
    ): Promise<{ result?: T; error?: string; auditEntry: AuditLogEntry }> => {
      const middlewareResult = await processToolCall(
        toolName,
        parameters,
        userContext,
        userMessage
      );

      if (!middlewareResult.proceed) {
        return {
          error: middlewareResult.guardrailResult.reason,
          auditEntry: middlewareResult.auditEntry,
        };
      }

      try {
        const result = await executor(toolName, middlewareResult.parameters);
        return { result, auditEntry: middlewareResult.auditEntry };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (enableLogging) {
          logger(`Tool execution error: ${errorMessage}`);
        }
        return {
          error: errorMessage,
          auditEntry: middlewareResult.auditEntry,
        };
      }
    };
  }

  return {
    processToolCall,
    wrapToolExecutor,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Default logger
 */
function defaultLogger(message: string, data?: unknown): void {
  if (data) {
    console.log(`[AI Middleware] ${message}`, data);
  } else {
    console.log(`[AI Middleware] ${message}`);
  }
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create an audit log entry
 */
function createAuditEntry(
  context: MiddlewareContext,
  guardrailResult: GuardrailResult
): AuditLogEntry {
  return {
    id: `audit_${context.requestId}`,
    timestamp: context.timestamp,
    userId: context.userContext.userId,
    organizationId: context.userContext.organizationId,
    intentId: guardrailResult.toolInfo?.id || 'UNKNOWN',
    toolName: context.toolName,
    allowed: guardrailResult.allowed,
    denialReason: guardrailResult.reason,
    confirmationRequired: guardrailResult.requiresConfirmation,
    riskLevel: guardrailResult.toolInfo?.riskLevel || 'UNKNOWN',
    parameters: sanitizeParametersForAudit(context.parameters),
    ipAddress: context.userContext.ipAddress,
  };
}

/**
 * Sanitize parameters before execution (remove potentially dangerous content)
 */
function sanitizeParameters(
  parameters: Record<string, unknown>,
  _toolInfo?: UnifiedToolInfo
): Record<string, unknown> {
  const sanitized = { ...parameters };

  // Trim string values
  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === 'string') {
      sanitized[key] = value.trim();
    }
  }

  return sanitized;
}

/**
 * Sanitize parameters for audit logging (mask sensitive data)
 */
function sanitizeParametersForAudit(
  parameters: Record<string, unknown>
): Record<string, unknown> {
  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'apiKey',
    'api_key',
    'ssn',
    'socialSecurityNumber',
    'creditCard',
    'credit_card',
    'accountNumber',
    'account_number',
    'routingNumber',
    'routing_number',
  ];

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(parameters)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveFields.some(
      (field) => lowerKey.includes(field.toLowerCase())
    );

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = Array.isArray(value)
        ? '[Array]'
        : sanitizeParametersForAudit(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// ============================================================================
// Pre-built Middleware Instances
// ============================================================================

/**
 * Create a production-ready middleware with full logging and callbacks
 */
export function createProductionMiddleware(
  onBlocked: (result: GuardrailResult, context: MiddlewareContext) => void,
  onConfirmationRequired: (
    result: GuardrailResult,
    context: MiddlewareContext
  ) => Promise<boolean>
): ReturnType<typeof createIntentMiddleware> {
  return createIntentMiddleware({
    enableLogging: true,
    onBlocked,
    onConfirmationRequired,
    skipConfirmation: false,
  });
}

/**
 * Create a test middleware that skips confirmations
 */
export function createTestMiddleware(): ReturnType<typeof createIntentMiddleware> {
  return createIntentMiddleware({
    enableLogging: false,
    skipConfirmation: true,
  });
}
