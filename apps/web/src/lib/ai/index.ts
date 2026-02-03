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

// Conversational service (OpenAI)
export {
  createConversationalService,
  type ConversationalService,
  type ConversationalServiceConfig,
  type ConversationalResponse,
  type Message,
  type PendingConfirmation,
} from './conversational-service';

// Gemini Conversational service
export {
  createGeminiConversationalService,
  type GeminiConversationalService,
  type GeminiServiceConfig,
  GLAPI_SYSTEM_PROMPT,
} from './gemini-conversational-service';

// TRPC-based MCP Client
export {
  createTRPCMCPClient,
  type TRPCMCPClientConfig,
} from './trpc-mcp-client';

// Tool Adapter (bridges generated tools with guardrails)
export {
  getToolInfo,
  getToolInfoById,
  isToolEnabled,
  getAllEnabledTools,
  getToolsByScope as getToolsByScopeAdapter,
  getToolsByCategory,
  getHighRiskTools,
  roleAtLeast,
  canAccessTool,
  generatedToolToUnified,
  intentToUnified,
  type UnifiedToolInfo,
  type ExtendedUserRole,
} from './tool-adapter';

// Tool Scoping (dynamic tool selection)
export {
  getScopedTools,
  getToolsForRole,
  getToolsForTask,
  getReadOnlyTools,
  getConfirmationRequiredTools,
  filterByPermissions,
  filterByMinimumRole,
  filterByRiskLevel,
  inferScopesFromContext,
  SCOPE_BUNDLES,
  type ScopingContext,
  type ScopingResult,
} from './tool-scoping';

// Generated AI Tools (from OpenAPI spec)
export {
  AI_TOOLS,
  AI_TOOLS_BY_NAME,
  AI_TOOLS_BY_SCOPE,
  getToolsByScope,
  getToolByName,
  getOpenAITools,
  TOOL_COUNT,
  createToolExecutor,
  type GeneratedAITool,
  type AIToolMetadata,
  type RiskLevel,
  type ExecutionContext,
  type ExecutionResult,
  type ToolExecutorConfig,
} from './generated';

// Error Handling & Retry Guidance
export {
  parseError,
  parseGuardrailError,
  formatErrorForUser,
  getRetryGuidance,
  type AIError,
  type AIErrorCategory,
} from './error-handling';

// Policy Evaluator (x-ai-policy enforcement)
export {
  evaluatePolicy,
  validateRowScope,
  policyViolationsToError,
  isPolicyErrorRetryable,
  getPolicyViolationGuidance,
  tierAtLeast,
  getMinimumRequiredTier,
  POLICY_ERRORS,
  STANDARD_TIERS,
  type AIPolicy,
  type PolicyContext,
  type PolicyResult,
  type PolicyViolation,
  type PolicyViolationType,
  type PolicyErrorCode,
  type StandardTier,
} from './policy-evaluator';

// Tool Caching
export {
  ToolCache,
  buildCacheKey,
  getToolCache,
  createCacheInterface,
  type CacheStats,
  type ToolCacheConfig,
} from './caching';

// Rate Limiting
export {
  RateLimiter,
  getRateLimiter,
  createRateLimiterInterface,
  type RateLimitResult,
  type RateLimiterStats,
  type RateLimiterConfig,
} from './rate-limit';
