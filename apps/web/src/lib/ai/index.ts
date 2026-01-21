/**
 * GLAPI Conversational Ledger AI Module
 *
 * This module provides the core AI functionality for the conversational ledger,
 * including intent management, guardrails, and safety policies.
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

// Middleware (to be implemented)
export { createIntentMiddleware, type IntentMiddlewareOptions } from './middleware';
