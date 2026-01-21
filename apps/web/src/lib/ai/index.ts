/**
 * GLAPI Conversational Ledger AI Module
 *
 * This module provides the core AI functionality for the conversational ledger,
 * including intent management, guardrails, action execution, and the main
 * conversational service.
 */

// Intent definitions and catalog
export {
  INTENT_CATALOG,
  type Intent,
  type IntentCategory,
  type IntentRiskLevel,
  type PermissionScope,
  getIntentsByCategory,
  getHighRiskIntents,
  getIntentById,
  getIntentByMcpTool,
  isIntentEnabled,
  getEnabledIntents,
} from './intents';

// Guardrails and safety system
export {
  evaluateGuardrails,
  getPermissionsForRole,
  hasPermission,
  createDefaultUserContext,
  ROLE_PERMISSIONS,
  type UserContext,
  type UserRole,
  type GuardrailResult,
  type GuardrailErrorCode,
} from './guardrails';

// Middleware
export {
  createIntentMiddleware,
  createProductionMiddleware,
  createTestMiddleware,
  type IntentMiddlewareOptions,
  type MiddlewareContext,
  type MiddlewareResult,
  type AuditLogEntry,
} from './middleware';

// Action executor
export {
  createActionExecutor,
  type ActionExecutor,
  type ActionExecutorConfig,
  type ActionRequest,
  type ActionResult,
  type PendingAction,
  type ConversationState,
  type ConversationMessage,
  type MCPClient,
} from './action-executor';

// Conversational service
export {
  createConversationalService,
  type ConversationalService,
  type ConversationalServiceConfig,
  type ConversationalResponse,
  type Message,
  type PendingConfirmation,
} from './conversational-service';
