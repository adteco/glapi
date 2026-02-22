/**
 * AI Policy Evaluator
 *
 * Enforces x-ai-policy rules for tool executions including:
 * - Subscription tier restrictions
 * - MFA requirements based on risk level
 * - Row-level security scope validation
 * - Maximum affected records limits
 *
 * @module policy-evaluator
 */

import type { RiskLevel } from './generated';

// =============================================================================
// Types
// =============================================================================

/**
 * Policy definition from x-ai-policy extension
 */
export interface AIPolicy {
  /** Subscription tiers that can access this tool */
  allowTiers?: string[];
  /** Risk levels that require MFA verification */
  requireMfaForRisk?: RiskLevel[];
  /** Row-level security expression (e.g., "record.orgId == caller.orgId") */
  rowScope?: string;
  /** Maximum records affected per call */
  maxAffectedRecords?: number;
}

/**
 * User context for policy evaluation
 */
export interface PolicyContext {
  /** User's subscription tier */
  tier: string;
  /** Whether MFA has been verified for this session */
  mfaVerified: boolean;
  /** User's organization ID */
  organizationId: string;
  /** User's ID */
  userId: string;
  /** Additional claims from auth token */
  claims?: Record<string, unknown>;
}

/**
 * Result of policy evaluation
 */
export interface PolicyResult {
  /** Whether the policy allows the action */
  allowed: boolean;
  /** Specific policy violations */
  violations: PolicyViolation[];
  /** Whether MFA is required to proceed */
  requiresMfa: boolean;
  /** Row scope expression to apply (if any) */
  rowScopeFilter?: string;
  /** Maximum records limit (if any) */
  maxRecords?: number;
}

/**
 * Individual policy violation
 */
export interface PolicyViolation {
  /** Type of violation */
  type: PolicyViolationType;
  /** Human-readable message */
  message: string;
  /** Additional details */
  details?: Record<string, unknown>;
}

/**
 * Types of policy violations
 */
export type PolicyViolationType =
  | 'TIER_NOT_ALLOWED'
  | 'MFA_REQUIRED'
  | 'ROW_SCOPE_VIOLATION'
  | 'MAX_RECORDS_EXCEEDED'
  | 'INVALID_POLICY';

// =============================================================================
// Policy Error Codes (for glapi-v7fm.4.3)
// =============================================================================

/**
 * Structured policy errors for API responses
 */
export const POLICY_ERRORS = {
  TIER_NOT_ALLOWED: {
    code: 'POLICY_TIER_NOT_ALLOWED',
    httpStatus: 403,
    message: 'Your subscription tier does not have access to this feature.',
    retryable: false,
  },
  MFA_REQUIRED: {
    code: 'POLICY_MFA_REQUIRED',
    httpStatus: 403,
    message: 'Multi-factor authentication is required for this action.',
    retryable: true,
  },
  ROW_SCOPE_VIOLATION: {
    code: 'POLICY_ROW_SCOPE_VIOLATION',
    httpStatus: 403,
    message: 'You do not have access to the requested resource.',
    retryable: false,
  },
  MAX_RECORDS_EXCEEDED: {
    code: 'POLICY_MAX_RECORDS_EXCEEDED',
    httpStatus: 400,
    message: 'This operation would affect too many records.',
    retryable: true,
  },
  INVALID_POLICY: {
    code: 'POLICY_INVALID',
    httpStatus: 500,
    message: 'The policy configuration is invalid.',
    retryable: false,
  },
} as const;

export type PolicyErrorCode = keyof typeof POLICY_ERRORS;

// =============================================================================
// Policy Evaluator
// =============================================================================

/**
 * Evaluate a policy against user context
 */
export function evaluatePolicy(
  policy: AIPolicy | undefined,
  context: PolicyContext,
  riskLevel: RiskLevel,
  affectedRecordCount?: number
): PolicyResult {
  const violations: PolicyViolation[] = [];
  let requiresMfa = false;

  // If no policy defined, allow by default
  if (!policy) {
    return {
      allowed: true,
      violations: [],
      requiresMfa: false,
    };
  }

  // 1. Check tier restrictions
  if (policy.allowTiers && policy.allowTiers.length > 0) {
    if (!policy.allowTiers.includes(context.tier)) {
      violations.push({
        type: 'TIER_NOT_ALLOWED',
        message: `This feature requires one of the following subscription tiers: ${policy.allowTiers.join(', ')}. Your current tier is: ${context.tier}`,
        details: {
          allowedTiers: policy.allowTiers,
          currentTier: context.tier,
        },
      });
    }
  }

  // 2. Check MFA requirements
  if (policy.requireMfaForRisk && policy.requireMfaForRisk.length > 0) {
    if (policy.requireMfaForRisk.includes(riskLevel)) {
      if (!context.mfaVerified) {
        requiresMfa = true;
        violations.push({
          type: 'MFA_REQUIRED',
          message: `Multi-factor authentication is required for ${riskLevel} risk actions.`,
          details: {
            riskLevel,
            mfaVerified: context.mfaVerified,
          },
        });
      }
    }
  }

  // 3. Check max affected records
  if (policy.maxAffectedRecords && affectedRecordCount !== undefined) {
    if (affectedRecordCount > policy.maxAffectedRecords) {
      violations.push({
        type: 'MAX_RECORDS_EXCEEDED',
        message: `This operation would affect ${affectedRecordCount} records, but the maximum allowed is ${policy.maxAffectedRecords}.`,
        details: {
          requestedRecords: affectedRecordCount,
          maxAllowed: policy.maxAffectedRecords,
        },
      });
    }
  }

  // 4. Prepare row scope filter (applied during execution, not evaluated here)
  const rowScopeFilter = policy.rowScope
    ? compileRowScope(policy.rowScope, context)
    : undefined;

  return {
    allowed: violations.length === 0,
    violations,
    requiresMfa,
    rowScopeFilter,
    maxRecords: policy.maxAffectedRecords,
  };
}

/**
 * Compile row scope expression with context values
 *
 * Converts expressions like "record.orgId == caller.orgId" to actual values
 */
function compileRowScope(expression: string, context: PolicyContext): string {
  return expression
    .replace(/caller\.orgId/g, `'${context.organizationId}'`)
    .replace(/caller\.userId/g, `'${context.userId}'`)
    .replace(/caller\.tier/g, `'${context.tier}'`);
}

/**
 * Validate a row scope expression for a specific record
 *
 * @returns true if the record passes the scope check
 */
export function validateRowScope(
  rowScope: string | undefined,
  record: Record<string, unknown>,
  context: PolicyContext
): boolean {
  if (!rowScope) {
    return true; // No scope = allow all
  }

  // Simple expression evaluator for common patterns
  // In production, use a proper expression parser like expr-eval

  // Pattern: record.orgId == caller.orgId
  const orgIdMatch = rowScope.match(/record\.orgId\s*==\s*caller\.orgId/);
  if (orgIdMatch) {
    return record.orgId === context.organizationId ||
           record.organizationId === context.organizationId;
  }

  // Pattern: record.userId == caller.userId
  const userIdMatch = rowScope.match(/record\.userId\s*==\s*caller\.userId/);
  if (userIdMatch) {
    return record.userId === context.userId ||
           record.createdBy === context.userId;
  }

  // Pattern: record.ownerId == caller.userId
  const ownerMatch = rowScope.match(/record\.ownerId\s*==\s*caller\.userId/);
  if (ownerMatch) {
    return record.ownerId === context.userId;
  }

  // If we can't parse the expression, fail closed (deny)
  console.warn(`Unable to evaluate row scope expression: ${rowScope}`);
  return false;
}

// =============================================================================
// Policy Error Helpers
// =============================================================================

/**
 * Convert policy violations to a structured error response
 */
export function policyViolationsToError(violations: PolicyViolation[]): {
  code: string;
  httpStatus: number;
  message: string;
  details: PolicyViolation[];
} {
  if (violations.length === 0) {
    throw new Error('No violations to convert');
  }

  // Use the first violation as the primary error
  const primary = violations[0];
  const errorDef = POLICY_ERRORS[primary.type];

  return {
    code: errorDef.code,
    httpStatus: errorDef.httpStatus,
    message: primary.message,
    details: violations,
  };
}

/**
 * Check if a policy error is retryable
 */
export function isPolicyErrorRetryable(violationType: PolicyViolationType): boolean {
  const errorDef = POLICY_ERRORS[violationType];
  return errorDef?.retryable ?? false;
}

/**
 * Get user guidance for a policy violation
 */
export function getPolicyViolationGuidance(violation: PolicyViolation): string[] {
  switch (violation.type) {
    case 'TIER_NOT_ALLOWED':
      return [
        'Upgrade your subscription to access this feature',
        'Contact your administrator about tier upgrades',
        'Try a different operation that matches your current tier',
      ];
    case 'MFA_REQUIRED':
      return [
        'Complete multi-factor authentication to continue',
        'Check your authenticator app for a verification code',
        'If you cannot access MFA, contact support',
      ];
    case 'ROW_SCOPE_VIOLATION':
      return [
        'Verify you have access to the requested resource',
        'Check that you are working with your own organization\'s data',
        'Contact your administrator if you need broader access',
      ];
    case 'MAX_RECORDS_EXCEEDED':
      return [
        'Reduce the number of records in your request',
        'Use filters to narrow down the affected records',
        'Process records in smaller batches',
      ];
    case 'INVALID_POLICY':
      return [
        'This appears to be a configuration issue',
        'Contact support for assistance',
      ];
    default:
      return ['Contact support for assistance'];
  }
}

// =============================================================================
// Tier Utilities
// =============================================================================

/**
 * Standard subscription tiers (can be customized per deployment)
 */
export const STANDARD_TIERS = ['free', 'starter', 'pro', 'enterprise'] as const;
export type StandardTier = typeof STANDARD_TIERS[number];

/**
 * Tier hierarchy for comparison
 */
const TIER_HIERARCHY: Record<string, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
};

/**
 * Check if a tier meets the minimum requirement
 */
export function tierAtLeast(userTier: string, minimumTier: string): boolean {
  const userLevel = TIER_HIERARCHY[userTier.toLowerCase()] ?? -1;
  const minLevel = TIER_HIERARCHY[minimumTier.toLowerCase()] ?? Infinity;
  return userLevel >= minLevel;
}

/**
 * Get the highest tier from an allow list
 */
export function getMinimumRequiredTier(allowTiers: string[]): string | undefined {
  if (!allowTiers || allowTiers.length === 0) return undefined;

  let minTier: string | undefined;
  let minLevel = Infinity;

  for (const tier of allowTiers) {
    const level = TIER_HIERARCHY[tier.toLowerCase()];
    if (level !== undefined && level < minLevel) {
      minLevel = level;
      minTier = tier;
    }
  }

  return minTier;
}
