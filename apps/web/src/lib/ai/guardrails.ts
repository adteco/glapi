/**
 * GLAPI Conversational Ledger - Guardrails & Safety System
 *
 * This module implements safety guardrails, permission checks, and policy
 * enforcement for the conversational ledger assistant.
 *
 * Supports both legacy intents and generated AI tool metadata via the tool adapter.
 */

import {
  type Intent,
  type IntentRiskLevel,
  type PermissionScope,
  getIntentByMcpTool,
  isIntentEnabled,
} from './intents';

import {
  type UnifiedToolInfo,
  type ExtendedUserRole,
  getToolInfo,
  isToolEnabled,
  roleAtLeast,
} from './tool-adapter';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * User context for guardrail evaluation
 */
export interface UserContext {
  /** User ID from auth system */
  userId: string;
  /** Organization ID */
  organizationId: string;
  /** User's assigned permissions */
  permissions: PermissionScope[];
  /** User's role (admin, accountant, viewer, etc.) */
  role: UserRole;
  /** Session start time */
  sessionStart: Date;
  /** Number of requests in current session */
  requestCount: number;
  /** IP address (for rate limiting) */
  ipAddress?: string;
}

/**
 * User roles with different access levels
 */
export type UserRole = 'admin' | 'accountant' | 'manager' | 'staff' | 'viewer' | 'api_client';

/**
 * Guardrail evaluation result
 */
export interface GuardrailResult {
  /** Whether the action is allowed */
  allowed: boolean;
  /** Reason for denial (if applicable) */
  reason?: string;
  /** Error code for programmatic handling */
  errorCode?: GuardrailErrorCode;
  /** Whether confirmation is required before execution */
  requiresConfirmation: boolean;
  /** Confirmation message to show user */
  confirmationMessage?: string;
  /** Warnings (non-blocking) */
  warnings: string[];
  /** The evaluated intent (legacy) */
  intent?: Intent;
  /** The unified tool info (supports both generated and legacy) */
  toolInfo?: UnifiedToolInfo;
  /** Whether dry-run preview is supported */
  supportsDryRun?: boolean;
}

/**
 * Error codes for guardrail failures
 */
export type GuardrailErrorCode =
  | 'INTENT_DISABLED'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMITED'
  | 'BLOCKED_CONTENT'
  | 'INVALID_PARAMETERS'
  | 'SESSION_EXPIRED'
  | 'ORGANIZATION_MISMATCH'
  | 'HIGH_RISK_DENIED'
  | 'CONFIRMATION_REQUIRED'
  | 'PII_DETECTED'
  | 'FINANCIAL_LIMIT_EXCEEDED';

// ============================================================================
// Role Permission Mappings
// ============================================================================

/**
 * Default permissions for each role
 */
export const ROLE_PERMISSIONS: Record<UserRole, PermissionScope[]> = {
  admin: [
    'read:customers', 'write:customers', 'delete:customers',
    'read:vendors', 'write:vendors', 'delete:vendors',
    'read:employees', 'write:employees', 'delete:employees',
    'read:leads', 'write:leads', 'delete:leads',
    'read:invoices', 'write:invoices', 'delete:invoices',
    'read:payments', 'write:payments',
    'read:journal_entries', 'write:journal_entries', 'post:journal_entries',
    'read:reports',
    'read:accounts', 'write:accounts',
    'read:inventory', 'write:inventory',
    'read:revenue', 'write:revenue',
    'admin:settings',
  ],
  accountant: [
    'read:customers', 'write:customers',
    'read:vendors', 'write:vendors',
    'read:employees',
    'read:leads',
    'read:invoices', 'write:invoices',
    'read:payments', 'write:payments',
    'read:journal_entries', 'write:journal_entries', 'post:journal_entries',
    'read:reports',
    'read:accounts', 'write:accounts',
    'read:inventory',
    'read:revenue', 'write:revenue',
  ],
  manager: [
    'read:customers', 'write:customers',
    'read:vendors', 'write:vendors',
    'read:employees', 'write:employees',
    'read:leads', 'write:leads',
    'read:invoices', 'write:invoices',
    'read:payments',
    'read:journal_entries',
    'read:reports',
    'read:accounts',
    'read:inventory', 'write:inventory',
    'read:revenue',
  ],
  staff: [
    'read:customers', 'write:customers',
    'read:vendors',
    'read:employees',
    'read:leads', 'write:leads',
    'read:invoices',
    'read:payments',
    'read:inventory',
  ],
  viewer: [
    'read:customers',
    'read:vendors',
    'read:employees',
    'read:leads',
    'read:invoices',
    'read:payments',
    'read:journal_entries',
    'read:reports',
    'read:accounts',
    'read:inventory',
    'read:revenue',
  ],
  api_client: [
    'read:customers', 'write:customers',
    'read:vendors', 'write:vendors',
    'read:invoices', 'write:invoices',
    'read:payments',
    'read:reports',
  ],
};

// ============================================================================
// Content Safety Policies
// ============================================================================

/**
 * Blocked patterns that should never be processed
 */
const BLOCKED_PATTERNS: RegExp[] = [
  // SQL injection attempts
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b.*\b(FROM|INTO|TABLE)\b)/i,
  // Script injection
  /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
  // Prompt injection attempts
  /ignore (previous|all|above) instructions/i,
  /disregard (previous|all|above) instructions/i,
  /forget everything/i,
  /you are now/i,
  /pretend to be/i,
  /act as if/i,
  // System manipulation
  /system prompt/i,
  /reveal your instructions/i,
  /show me your prompt/i,
];

/**
 * PII patterns to detect and flag
 */
const PII_PATTERNS: RegExp[] = [
  // Social Security Number
  /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/,
  // Credit Card Numbers
  /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/,
  // Bank Account Numbers (generic patterns)
  /\b(account|acct)[\s#:]*\d{8,17}\b/i,
  // Routing Numbers
  /\b(routing|aba)[\s#:]*\d{9}\b/i,
];

/**
 * Financial amount limits by role (in cents)
 */
const FINANCIAL_LIMITS: Record<UserRole, number> = {
  admin: Infinity,
  accountant: 100000000, // $1,000,000
  manager: 10000000,     // $100,000
  staff: 1000000,        // $10,000
  viewer: 0,             // No financial operations
  api_client: 50000000,  // $500,000
};

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Rate limit tracker (in production, use Redis or similar)
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Check rate limit for a user/intent combination
 */
function checkRateLimit(
  userId: string,
  intentId: string,
  limitPerMinute: number
): { allowed: boolean; remainingRequests: number } {
  const key = `${userId}:${intentId}`;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute

  let record = rateLimitStore.get(key);

  if (!record || now >= record.resetAt) {
    record = { count: 0, resetAt: now + windowMs };
    rateLimitStore.set(key, record);
  }

  if (record.count >= limitPerMinute) {
    return { allowed: false, remainingRequests: 0 };
  }

  record.count++;
  return { allowed: true, remainingRequests: limitPerMinute - record.count };
}

// ============================================================================
// Main Guardrail Functions
// ============================================================================

/**
 * Evaluate guardrails for a tool/intent invocation
 *
 * This function now supports both generated AI tools and legacy intents
 * via the unified tool adapter. Generated tools take precedence.
 */
export function evaluateGuardrails(
  toolName: string,
  parameters: Record<string, unknown>,
  userContext: UserContext,
  userMessage?: string
): GuardrailResult {
  const warnings: string[] = [];

  // 1. Get tool info (prefers generated tools, falls back to legacy intents)
  const toolInfo = getToolInfo(toolName);
  const intent = getIntentByMcpTool(toolName); // Keep for backward compatibility

  if (!toolInfo) {
    return {
      allowed: false,
      reason: `Unknown tool: ${toolName}`,
      errorCode: 'INTENT_DISABLED',
      requiresConfirmation: false,
      warnings: [],
    };
  }

  // 2. Check if tool is enabled
  if (!toolInfo.enabled) {
    return {
      allowed: false,
      reason: `The ${toolInfo.name} capability is currently disabled`,
      errorCode: 'INTENT_DISABLED',
      requiresConfirmation: false,
      warnings: [],
      intent,
      toolInfo,
    };
  }

  // 3. Check content safety (if user message provided)
  if (userMessage) {
    const contentCheck = checkContentSafety(userMessage);
    if (!contentCheck.safe) {
      return {
        allowed: false,
        reason: contentCheck.reason,
        errorCode: 'BLOCKED_CONTENT',
        requiresConfirmation: false,
        warnings: [],
        intent,
        toolInfo,
      };
    }
    if (contentCheck.warnings.length > 0) {
      warnings.push(...contentCheck.warnings);
    }
  }

  // 4. Check minimum role requirement (from generated tool metadata)
  if (toolInfo.source === 'generated' && toolInfo.minimumRole) {
    if (!roleAtLeast(userContext.role, toolInfo.minimumRole)) {
      return {
        allowed: false,
        reason: `Your role (${userContext.role}) does not have access to ${toolInfo.name}. Minimum role required: ${toolInfo.minimumRole}`,
        errorCode: 'PERMISSION_DENIED',
        requiresConfirmation: false,
        warnings: [],
        intent,
        toolInfo,
      };
    }
  }

  // 5. Check permissions
  const permissionCheck = checkPermissionsUnified(toolInfo, userContext);
  if (!permissionCheck.hasPermission) {
    return {
      allowed: false,
      reason: permissionCheck.reason,
      errorCode: 'PERMISSION_DENIED',
      requiresConfirmation: false,
      warnings: [],
      intent,
      toolInfo,
    };
  }

  // 6. Check rate limits
  if (toolInfo.rateLimitPerMinute) {
    const rateCheck = checkRateLimit(
      userContext.userId,
      toolInfo.id,
      toolInfo.rateLimitPerMinute
    );
    if (!rateCheck.allowed) {
      return {
        allowed: false,
        reason: `Rate limit exceeded for ${toolInfo.name}. Please wait a moment before trying again.`,
        errorCode: 'RATE_LIMITED',
        requiresConfirmation: false,
        warnings: [],
        intent,
        toolInfo,
      };
    }
  }

  // 7. Check financial limits for relevant operations
  const financialCheck = checkFinancialLimitsUnified(toolInfo, parameters, userContext);
  if (!financialCheck.allowed) {
    return {
      allowed: false,
      reason: financialCheck.reason,
      errorCode: 'FINANCIAL_LIMIT_EXCEEDED',
      requiresConfirmation: false,
      warnings: [],
      intent,
      toolInfo,
    };
  }

  // 8. Check for high-risk operations
  const riskCheck = evaluateRiskLevelUnified(toolInfo, userContext);
  if (!riskCheck.allowed) {
    return {
      allowed: false,
      reason: riskCheck.reason,
      errorCode: 'HIGH_RISK_DENIED',
      requiresConfirmation: false,
      warnings: [],
      intent,
      toolInfo,
    };
  }

  // 9. Determine if confirmation is needed
  const needsConfirmation = toolInfo.requiresConfirmation ||
    toolInfo.riskLevel === 'HIGH' ||
    toolInfo.riskLevel === 'CRITICAL';

  // 10. Get confirmation message (prefer generated tool's custom message)
  let confirmationMessage: string | undefined;
  if (needsConfirmation) {
    confirmationMessage = toolInfo.confirmationMessage ||
      generateConfirmationMessageUnified(toolInfo, parameters);
  }

  return {
    allowed: true,
    requiresConfirmation: needsConfirmation,
    confirmationMessage,
    warnings,
    intent,
    toolInfo,
    supportsDryRun: toolInfo.supportsDryRun,
  };
}

/**
 * Check content for safety issues
 */
function checkContentSafety(content: string): {
  safe: boolean;
  reason?: string;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Check for blocked patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(content)) {
      return {
        safe: false,
        reason: 'Your message contains content that cannot be processed for security reasons.',
        warnings: [],
      };
    }
  }

  // Check for PII (warn but don't block)
  for (const pattern of PII_PATTERNS) {
    if (pattern.test(content)) {
      warnings.push(
        'Your message may contain sensitive personal information. Please ensure you have proper authorization to share this data.'
      );
      break; // One warning is enough
    }
  }

  return { safe: true, warnings };
}

/**
 * Check if user has required permissions
 */
function checkPermissions(
  intent: Intent,
  userContext: UserContext
): { hasPermission: boolean; reason?: string } {
  // Get user's effective permissions (from context or role defaults)
  const effectivePermissions =
    userContext.permissions.length > 0
      ? userContext.permissions
      : ROLE_PERMISSIONS[userContext.role] || [];

  // Check each required permission
  for (const required of intent.requiredPermissions) {
    if (!effectivePermissions.includes(required)) {
      return {
        hasPermission: false,
        reason: `You don't have permission to ${intent.name.toLowerCase()}. Required permission: ${required}`,
      };
    }
  }

  return { hasPermission: true };
}

/**
 * Check if user has required permissions (unified version)
 */
function checkPermissionsUnified(
  toolInfo: UnifiedToolInfo,
  userContext: UserContext
): { hasPermission: boolean; reason?: string } {
  // Get user's effective permissions (from context or role defaults)
  const effectivePermissions =
    userContext.permissions.length > 0
      ? userContext.permissions
      : ROLE_PERMISSIONS[userContext.role] || [];

  // Check each required permission
  for (const required of toolInfo.requiredPermissions) {
    if (!effectivePermissions.includes(required)) {
      return {
        hasPermission: false,
        reason: `You don't have permission to ${toolInfo.name.toLowerCase()}. Required permission: ${required}`,
      };
    }
  }

  return { hasPermission: true };
}

/**
 * Check financial amount limits
 */
function checkFinancialLimits(
  intent: Intent,
  parameters: Record<string, unknown>,
  userContext: UserContext
): { allowed: boolean; reason?: string } {
  // Only check for intents that involve financial amounts
  const financialIntents = ['CREATE_INVOICE', 'CREATE_JOURNAL_ENTRY', 'CREATE_PAYMENT'];
  if (!financialIntents.includes(intent.id)) {
    return { allowed: true };
  }

  // Extract amount from parameters (in cents)
  const amount = extractAmountFromParameters(parameters);
  if (amount === null) {
    return { allowed: true }; // No amount specified
  }

  const limit = FINANCIAL_LIMITS[userContext.role];
  if (amount > limit) {
    const limitFormatted = (limit / 100).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
    const amountFormatted = (amount / 100).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
    return {
      allowed: false,
      reason: `Transaction amount (${amountFormatted}) exceeds your limit of ${limitFormatted}. Please contact an administrator for approval.`,
    };
  }

  return { allowed: true };
}

/**
 * Check financial amount limits (unified version)
 */
function checkFinancialLimitsUnified(
  toolInfo: UnifiedToolInfo,
  parameters: Record<string, unknown>,
  userContext: UserContext
): { allowed: boolean; reason?: string } {
  // Only check for tools that involve financial amounts
  const financialPatterns = ['invoice', 'journal', 'payment', 'bill', 'credit', 'debit'];
  const toolNameLower = toolInfo.name.toLowerCase();
  const isFinancialTool = financialPatterns.some(p => toolNameLower.includes(p)) &&
    (toolNameLower.includes('create') || toolNameLower.includes('update') || toolNameLower.includes('post'));

  if (!isFinancialTool) {
    return { allowed: true };
  }

  // Extract amount from parameters (in cents)
  const amount = extractAmountFromParameters(parameters);
  if (amount === null) {
    return { allowed: true }; // No amount specified
  }

  const limit = FINANCIAL_LIMITS[userContext.role];
  if (amount > limit) {
    const limitFormatted = (limit / 100).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
    const amountFormatted = (amount / 100).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
    return {
      allowed: false,
      reason: `Transaction amount (${amountFormatted}) exceeds your limit of ${limitFormatted}. Please contact an administrator for approval.`,
    };
  }

  return { allowed: true };
}

/**
 * Extract financial amount from parameters
 */
function extractAmountFromParameters(parameters: Record<string, unknown>): number | null {
  // Check common amount field names
  const amountFields = ['amount', 'total', 'totalAmount', 'value', 'price'];
  for (const field of amountFields) {
    if (typeof parameters[field] === 'number') {
      return parameters[field] as number;
    }
  }

  // Check for line items
  if (Array.isArray(parameters.lineItems)) {
    let total = 0;
    for (const item of parameters.lineItems) {
      if (typeof item === 'object' && item !== null && 'amount' in item) {
        total += (item as { amount: number }).amount;
      }
    }
    return total > 0 ? total : null;
  }

  return null;
}

/**
 * Evaluate risk level restrictions
 */
function evaluateRiskLevel(
  intent: Intent,
  userContext: UserContext
): { allowed: boolean; reason?: string } {
  // Viewers cannot perform any write operations
  if (userContext.role === 'viewer' && intent.riskLevel !== 'LOW') {
    return {
      allowed: false,
      reason: 'Your role does not allow modifying data. Please contact an administrator if you need write access.',
    };
  }

  // CRITICAL operations require admin or accountant role
  if (intent.riskLevel === 'CRITICAL') {
    if (!['admin', 'accountant'].includes(userContext.role)) {
      return {
        allowed: false,
        reason: `${intent.name} is a critical operation that requires elevated privileges. Please contact an administrator.`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Evaluate risk level restrictions (unified version)
 */
function evaluateRiskLevelUnified(
  toolInfo: UnifiedToolInfo,
  userContext: UserContext
): { allowed: boolean; reason?: string } {
  // Viewers cannot perform any write operations
  if (userContext.role === 'viewer' && toolInfo.riskLevel !== 'LOW') {
    return {
      allowed: false,
      reason: 'Your role does not allow modifying data. Please contact an administrator if you need write access.',
    };
  }

  // CRITICAL operations require admin or accountant role
  if (toolInfo.riskLevel === 'CRITICAL') {
    if (!['admin', 'accountant'].includes(userContext.role)) {
      return {
        allowed: false,
        reason: `${toolInfo.name} is a critical operation that requires elevated privileges. Please contact an administrator.`,
      };
    }
  }

  // HIGH operations should not be available to staff without explicit permissions
  if (toolInfo.riskLevel === 'HIGH') {
    if (userContext.role === 'staff' && !userContext.permissions.length) {
      return {
        allowed: false,
        reason: `${toolInfo.name} is a high-impact operation that requires additional permissions. Please contact your manager.`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Generate a human-readable confirmation message
 */
function generateConfirmationMessage(
  intent: Intent,
  parameters: Record<string, unknown>
): string {
  const actionDescriptions: Record<string, string> = {
    CREATE_CUSTOMER: `create a new customer${parameters.name ? ` named "${parameters.name}"` : ''}`,
    UPDATE_CUSTOMER: `update customer${parameters.id ? ` (${parameters.id})` : ''}`,
    CREATE_VENDOR: `create a new vendor${parameters.name ? ` named "${parameters.name}"` : ''}`,
    UPDATE_VENDOR: `update vendor${parameters.id ? ` (${parameters.id})` : ''}`,
    CREATE_INVOICE: `create an invoice${parameters.customerId ? ` for customer ${parameters.customerId}` : ''}`,
    CREATE_JOURNAL_ENTRY: 'create a journal entry that will affect the general ledger',
    POST_JOURNAL_ENTRY: 'post the journal entry to the ledger (this action cannot be undone)',
  };

  const description = actionDescriptions[intent.id] || intent.description.toLowerCase();

  if (intent.riskLevel === 'CRITICAL') {
    return `⚠️ CRITICAL ACTION: You are about to ${description}. This action may be irreversible. Are you sure you want to proceed?`;
  }

  if (intent.riskLevel === 'HIGH') {
    return `⚡ HIGH IMPACT: You are about to ${description}. Please confirm this action.`;
  }

  return `You are about to ${description}. Do you want to proceed?`;
}

/**
 * Generate a human-readable confirmation message (unified version)
 */
function generateConfirmationMessageUnified(
  toolInfo: UnifiedToolInfo,
  parameters: Record<string, unknown>
): string {
  // Build a description from the tool name and parameters
  const action = toolInfo.name.toLowerCase();
  let details = '';

  // Extract common parameter details
  if (parameters.name) {
    details = ` named "${parameters.name}"`;
  } else if (parameters.id) {
    details = ` (ID: ${parameters.id})`;
  } else if (parameters.customerId) {
    details = ` for customer ${parameters.customerId}`;
  } else if (parameters.vendorId) {
    details = ` for vendor ${parameters.vendorId}`;
  }

  const description = `${action}${details}`;

  if (toolInfo.riskLevel === 'CRITICAL') {
    return `⚠️ CRITICAL ACTION: You are about to ${description}. This action may be irreversible. Are you sure you want to proceed?`;
  }

  if (toolInfo.riskLevel === 'HIGH') {
    return `⚡ HIGH IMPACT: You are about to ${description}. Please confirm this action.`;
  }

  if (toolInfo.supportsDryRun) {
    return `You are about to ${description}. Would you like to preview the changes first (dry run), or proceed directly?`;
  }

  return `You are about to ${description}. Do you want to proceed?`;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get effective permissions for a user role
 */
export function getPermissionsForRole(role: UserRole): PermissionScope[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Check if a user has a specific permission
 */
export function hasPermission(
  userContext: UserContext,
  permission: PermissionScope
): boolean {
  const effectivePermissions =
    userContext.permissions.length > 0
      ? userContext.permissions
      : ROLE_PERMISSIONS[userContext.role] || [];
  return effectivePermissions.includes(permission);
}

/**
 * Create a default user context for testing
 */
export function createDefaultUserContext(
  userId: string,
  organizationId: string,
  role: UserRole = 'staff'
): UserContext {
  return {
    userId,
    organizationId,
    permissions: ROLE_PERMISSIONS[role],
    role,
    sessionStart: new Date(),
    requestCount: 0,
  };
}
