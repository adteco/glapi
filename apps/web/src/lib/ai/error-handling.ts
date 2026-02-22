/**
 * AI Error Handling & Retry Guidance
 *
 * This module provides user-friendly error messages and retry guidance
 * for AI tool execution failures.
 */

import type { GuardrailErrorCode } from './guardrails';
import type { ExecutionResult } from './generated';

// =============================================================================
// Types
// =============================================================================

/**
 * Error categories for AI tool execution
 */
export type AIErrorCategory =
  | 'permission'    // User lacks permissions
  | 'validation'    // Invalid parameters
  | 'rate_limit'    // Rate limited
  | 'not_found'     // Resource not found
  | 'conflict'      // Conflict with existing data
  | 'timeout'       // Operation timed out
  | 'server'        // Server error
  | 'network'       // Network issues
  | 'guardrail'     // Blocked by guardrails
  | 'configuration' // Configuration issue
  | 'unknown';      // Unknown error

/**
 * Structured error with user guidance
 */
export interface AIError {
  /** Error category */
  category: AIErrorCategory;
  /** User-friendly error message */
  message: string;
  /** Technical error code */
  code: string;
  /** Suggested actions the user can take */
  suggestions: string[];
  /** Whether the operation can be retried */
  retryable: boolean;
  /** Recommended wait time before retry (in seconds) */
  retryAfterSeconds?: number;
  /** Related help topics */
  helpTopics?: string[];
  /** Original error for debugging */
  originalError?: unknown;
}

/**
 * Error patterns for detection
 */
interface ErrorPattern {
  pattern: RegExp;
  category: AIErrorCategory;
  message: string;
  suggestions: string[];
  retryable: boolean;
  retryAfterSeconds?: number;
}

// =============================================================================
// Error Patterns
// =============================================================================

const ERROR_PATTERNS: ErrorPattern[] = [
  // Permission errors
  {
    pattern: /permission denied|not authorized|forbidden|access denied/i,
    category: 'permission',
    message: "You don't have permission to perform this action.",
    suggestions: [
      'Check if you have the required role for this operation',
      'Contact your administrator to request access',
      'Try a different action that matches your permissions',
    ],
    retryable: false,
  },
  {
    pattern: /minimum role required|role.*not.*access/i,
    category: 'permission',
    message: 'Your role does not have access to this feature.',
    suggestions: [
      'Ask your administrator to upgrade your role',
      'Use read-only operations instead',
    ],
    retryable: false,
  },

  // Validation errors
  {
    pattern: /invalid.*parameter|validation failed|required field|missing required/i,
    category: 'validation',
    message: 'The information provided is incomplete or invalid.',
    suggestions: [
      'Check that all required fields are filled in',
      'Verify the format of dates, emails, and amounts',
      'Try providing more specific information',
    ],
    retryable: true,
  },
  {
    pattern: /invalid.*uuid|invalid.*id|not.*valid.*identifier/i,
    category: 'validation',
    message: 'The ID provided is not valid.',
    suggestions: [
      'Double-check the ID you provided',
      'Search for the item by name instead',
      'List items first to find the correct ID',
    ],
    retryable: true,
  },

  // Rate limiting
  {
    pattern: /rate limit|too many requests|throttled/i,
    category: 'rate_limit',
    message: "You've made too many requests. Please wait a moment.",
    suggestions: [
      'Wait a minute before trying again',
      'Combine multiple operations into fewer requests',
      'Use batch operations when available',
    ],
    retryable: true,
    retryAfterSeconds: 60,
  },

  // Not found errors
  {
    pattern: /not found|does not exist|no.*found|cannot find/i,
    category: 'not_found',
    message: 'The requested item could not be found.',
    suggestions: [
      'Verify the ID or name is correct',
      'Check if the item was deleted',
      'Search for similar items',
      'Create a new item if needed',
    ],
    retryable: true,
  },

  // Conflict errors
  {
    pattern: /already exists|duplicate|conflict|unique constraint/i,
    category: 'conflict',
    message: 'This conflicts with existing data.',
    suggestions: [
      'Check if this item already exists',
      'Use a different name or identifier',
      'Update the existing item instead',
    ],
    retryable: true,
  },

  // Timeout errors
  {
    pattern: /timeout|timed out|took too long/i,
    category: 'timeout',
    message: 'The operation took too long to complete.',
    suggestions: [
      'Try again in a few moments',
      'Break down large operations into smaller ones',
      'Try during off-peak hours',
    ],
    retryable: true,
    retryAfterSeconds: 5,
  },

  // Server errors
  {
    pattern: /internal.*error|server error|500/i,
    category: 'server',
    message: 'Something went wrong on our end.',
    suggestions: [
      'Wait a moment and try again',
      'If the problem persists, contact support',
      'Check the system status page',
    ],
    retryable: true,
    retryAfterSeconds: 10,
  },

  // Network errors
  {
    pattern: /network|connection|ECONNREFUSED|ETIMEDOUT/i,
    category: 'network',
    message: 'There was a problem connecting to the server.',
    suggestions: [
      'Check your internet connection',
      'Try refreshing the page',
      'Wait a moment and try again',
    ],
    retryable: true,
    retryAfterSeconds: 5,
  },
];

// =============================================================================
// Guardrail Error Mapping
// =============================================================================

const GUARDRAIL_ERROR_MAP: Record<GuardrailErrorCode, Partial<AIError>> = {
  INTENT_DISABLED: {
    category: 'configuration',
    message: 'This feature is currently disabled.',
    suggestions: [
      'Try a different operation',
      'Contact your administrator to enable this feature',
    ],
    retryable: false,
  },
  PERMISSION_DENIED: {
    category: 'permission',
    message: "You don't have permission for this action.",
    suggestions: [
      'Check your assigned permissions',
      'Contact your administrator for access',
    ],
    retryable: false,
  },
  RATE_LIMITED: {
    category: 'rate_limit',
    message: 'Please wait before making more requests.',
    suggestions: [
      'Wait a minute and try again',
      'Reduce the frequency of your requests',
    ],
    retryable: true,
    retryAfterSeconds: 60,
  },
  BLOCKED_CONTENT: {
    category: 'guardrail',
    message: 'Your request contains content that cannot be processed.',
    suggestions: [
      'Rephrase your request',
      'Remove any special characters or code',
      'Be more specific about what you need',
    ],
    retryable: true,
  },
  INVALID_PARAMETERS: {
    category: 'validation',
    message: 'The parameters provided are not valid.',
    suggestions: [
      'Check that all values are in the correct format',
      'Provide all required information',
    ],
    retryable: true,
  },
  SESSION_EXPIRED: {
    category: 'permission',
    message: 'Your session has expired.',
    suggestions: [
      'Please log in again',
      'Refresh the page to restore your session',
    ],
    retryable: true,
  },
  ORGANIZATION_MISMATCH: {
    category: 'permission',
    message: 'You cannot access data from a different organization.',
    suggestions: [
      'Make sure you are working with your own organization\'s data',
      'Contact support if you believe this is an error',
    ],
    retryable: false,
  },
  HIGH_RISK_DENIED: {
    category: 'permission',
    message: 'This action requires higher privileges.',
    suggestions: [
      'Request elevated access from your administrator',
      'Ask a manager or admin to perform this action',
    ],
    retryable: false,
  },
  CONFIRMATION_REQUIRED: {
    category: 'guardrail',
    message: 'This action requires your confirmation.',
    suggestions: [
      'Review the details and confirm if correct',
      'Type "yes" or "confirm" to proceed',
      'Type "no" or "cancel" to abort',
    ],
    retryable: true,
  },
  PII_DETECTED: {
    category: 'guardrail',
    message: 'Personal information was detected in your request.',
    suggestions: [
      'Remove sensitive data like SSN or credit card numbers',
      'Use placeholder values for testing',
      'Ensure you have authorization to share this data',
    ],
    retryable: true,
  },
  FINANCIAL_LIMIT_EXCEEDED: {
    category: 'permission',
    message: 'This transaction exceeds your authorized limit.',
    suggestions: [
      'Request approval from a manager',
      'Split into smaller transactions',
      'Contact accounting for assistance',
    ],
    retryable: false,
  },
  // Policy enforcement errors (from x-ai-policy)
  POLICY_TIER_NOT_ALLOWED: {
    category: 'permission',
    message: 'Your subscription tier does not have access to this feature.',
    suggestions: [
      'Upgrade your subscription to access this feature',
      'Contact your administrator about tier upgrades',
      'Try a different operation that matches your current tier',
    ],
    retryable: false,
  },
  POLICY_MFA_REQUIRED: {
    category: 'permission',
    message: 'Multi-factor authentication is required for this action.',
    suggestions: [
      'Complete multi-factor authentication to continue',
      'Check your authenticator app for a verification code',
      'If you cannot access MFA, contact support',
    ],
    retryable: true,
  },
  POLICY_ROW_SCOPE_VIOLATION: {
    category: 'permission',
    message: 'You do not have access to the requested resource.',
    suggestions: [
      'Verify you have access to the requested resource',
      'Check that you are working with your own organization\'s data',
      'Contact your administrator if you need broader access',
    ],
    retryable: false,
  },
  POLICY_MAX_RECORDS_EXCEEDED: {
    category: 'validation',
    message: 'This operation would affect too many records.',
    suggestions: [
      'Reduce the number of records in your request',
      'Use filters to narrow down the affected records',
      'Process records in smaller batches',
    ],
    retryable: true,
  },
};

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Parse an error and return structured error information
 */
export function parseError(error: unknown): AIError {
  // Handle execution result errors
  if (isExecutionResultError(error)) {
    return parseExecutionResultError(error);
  }

  // Handle standard errors
  const errorMessage = getErrorMessage(error);
  const errorCode = getErrorCode(error);

  // Match against known patterns
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.pattern.test(errorMessage)) {
      return {
        category: pattern.category,
        message: pattern.message,
        code: errorCode || pattern.category.toUpperCase(),
        suggestions: pattern.suggestions,
        retryable: pattern.retryable,
        retryAfterSeconds: pattern.retryAfterSeconds,
        originalError: error,
      };
    }
  }

  // Unknown error
  return {
    category: 'unknown',
    message: 'An unexpected error occurred.',
    code: errorCode || 'UNKNOWN_ERROR',
    suggestions: [
      'Try your request again',
      'If the problem persists, contact support',
      'Provide more details about what you were trying to do',
    ],
    retryable: true,
    originalError: error,
  };
}

/**
 * Parse guardrail error code to AIError
 */
export function parseGuardrailError(
  errorCode: GuardrailErrorCode,
  reason?: string
): AIError {
  const baseError = GUARDRAIL_ERROR_MAP[errorCode];

  return {
    category: baseError?.category || 'guardrail',
    message: reason || baseError?.message || 'Action blocked by safety guardrails.',
    code: errorCode,
    suggestions: baseError?.suggestions || [
      'Try a different approach',
      'Contact support for assistance',
    ],
    retryable: baseError?.retryable ?? false,
    retryAfterSeconds: baseError?.retryAfterSeconds,
  };
}

/**
 * Format error for user display
 */
export function formatErrorForUser(error: AIError): string {
  let output = `**Error:** ${error.message}\n\n`;

  if (error.suggestions.length > 0) {
    output += '**What you can do:**\n';
    for (const suggestion of error.suggestions) {
      output += `• ${suggestion}\n`;
    }
  }

  if (error.retryable && error.retryAfterSeconds) {
    output += `\n*You can try again in ${error.retryAfterSeconds} seconds.*`;
  }

  return output;
}

/**
 * Get retry guidance for an error
 */
export function getRetryGuidance(error: AIError): {
  canRetry: boolean;
  waitSeconds: number;
  suggestion: string;
} {
  if (!error.retryable) {
    return {
      canRetry: false,
      waitSeconds: 0,
      suggestion: 'This error cannot be resolved by retrying. Please try a different approach.',
    };
  }

  const waitSeconds = error.retryAfterSeconds || 0;

  let suggestion = 'You can try this operation again.';
  if (waitSeconds > 0) {
    suggestion = `Please wait ${waitSeconds} seconds before trying again.`;
  }

  return {
    canRetry: true,
    waitSeconds,
    suggestion,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

function isExecutionResultError(error: unknown): error is { error: ExecutionResult['error'] } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    typeof (error as { error: unknown }).error === 'object'
  );
}

function parseExecutionResultError(error: { error: ExecutionResult['error'] }): AIError {
  const execError = error.error;
  if (!execError) {
    return parseError(new Error('Unknown execution error'));
  }

  return {
    category: mapErrorCodeToCategory(execError.code),
    message: execError.message,
    code: execError.code,
    suggestions: getSuggestionsForCode(execError.code),
    retryable: execError.retryable,
    originalError: error,
  };
}

function mapErrorCodeToCategory(code: string): AIErrorCategory {
  if (code.includes('PERMISSION') || code.includes('AUTH')) return 'permission';
  if (code.includes('VALIDATION') || code.includes('INVALID')) return 'validation';
  if (code.includes('RATE') || code.includes('THROTTLE')) return 'rate_limit';
  if (code.includes('NOT_FOUND')) return 'not_found';
  if (code.includes('CONFLICT') || code.includes('DUPLICATE')) return 'conflict';
  if (code.includes('TIMEOUT')) return 'timeout';
  if (code.includes('SERVER') || code.includes('INTERNAL')) return 'server';
  if (code.includes('NETWORK') || code.includes('CONNECTION')) return 'network';
  return 'unknown';
}

function getSuggestionsForCode(code: string): string[] {
  const category = mapErrorCodeToCategory(code);
  const pattern = ERROR_PATTERNS.find(p => p.category === category);
  return pattern?.suggestions || [
    'Try your request again',
    'Contact support if the problem persists',
  ];
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Unknown error';
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as { code: unknown }).code);
  }
  return undefined;
}
