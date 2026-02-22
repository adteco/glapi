/**
 * AI Metadata Types for tRPC Procedures
 *
 * These types define the AI-specific metadata that can be attached to tRPC procedures
 * using the .meta() method. The OpenAPI generator reads this metadata to emit
 * x-ai-* extensions.
 *
 * @example
 * ```typescript
 * const aiEnabledProcedure = authenticatedProcedure
 *   .meta({
 *     ai: {
 *       tool: {
 *         name: 'list_customers',
 *         description: 'Search and retrieve customer records',
 *         scopes: ['global', 'sales'],
 *       },
 *       risk: { level: 'LOW' },
 *       permissions: {
 *         required: ['read:customers'],
 *         minimumRole: 'viewer',
 *       },
 *     },
 *   })
 *   .input(...)
 *   .query(...);
 * ```
 *
 * @see packages/api-service/src/ai/openapi-extensions.ts for full schema definitions
 * @module @glapi/trpc/ai-meta
 */

// =============================================================================
// Core Types (mirroring the Zod schemas in api-service/ai)
// =============================================================================

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type Stability = 'stable' | 'beta' | 'experimental';
export type UserRole = 'viewer' | 'staff' | 'manager' | 'accountant' | 'admin';
export type RateLimitScope = 'user' | 'organization' | 'global';

// =============================================================================
// AI Extension Types
// =============================================================================

/**
 * x-ai-tool metadata
 */
export interface AIToolMeta {
  /** Unique tool identifier (snake_case) */
  name: string;
  /** Contract version for breaking changes */
  version?: number;
  /** Stability level */
  stability?: Stability;
  /** Whether this tool version is deprecated */
  deprecated?: boolean;
  /** Replacement tool name when deprecated */
  replacement?: string;
  /** LLM-facing description (be specific and actionable) */
  description: string;
  /** Contextual scopes for dynamic tool loading */
  scopes?: string[];
  /** Feature flag to enable/disable the tool */
  enabled?: boolean;
  /** Example utterances that should trigger this tool */
  exampleUtterances?: string[];
}

/**
 * x-ai-risk metadata
 */
export interface AIRiskMeta {
  /** Risk level determines confirmation and audit behavior */
  level: RiskLevel;
  /** Whether user must explicitly confirm before execution */
  requiresConfirmation?: boolean;
  /** Whether the tool supports dry-run/preview mode */
  supportsDryRun?: boolean;
  /** Custom message template for confirmation dialog */
  confirmationMessage?: string;
}

/**
 * x-ai-permissions metadata
 */
export interface AIPermissionsMeta {
  /** Required permission scopes (e.g., "read:customers") */
  required: string[];
  /** Minimum role level required */
  minimumRole: UserRole;
}

/**
 * x-ai-policy metadata
 */
export interface AIPolicyMeta {
  /** Subscription tiers that can access this tool */
  allowTiers?: string[];
  /** Risk levels that require MFA verification */
  requireMfaForRisk?: RiskLevel[];
  /** CEL expression for row-level security filtering */
  rowScope?: string;
  /** Maximum records affected per call */
  maxAffectedRecords?: number;
}

/**
 * x-ai-rate-limit metadata
 */
export interface AIRateLimitMeta {
  /** Maximum requests per minute */
  requestsPerMinute: number;
  /** Maximum concurrent/burst requests */
  burstLimit?: number;
  /** Scope for rate limit tracking */
  scope?: RateLimitScope;
}

/**
 * x-ai-output metadata
 */
export interface AIOutputMeta {
  /** Allowlist of fields to include in response */
  includeFields?: string[];
  /** Fields to redact/mask in response */
  redactFields?: string[];
  /** Maximum array items to return */
  maxItems?: number;
  /** Approximate token budget for response */
  maxTokens?: number;
}

/**
 * x-ai-idempotency metadata
 */
export interface AIIdempotencyMeta {
  /** Source of idempotency key */
  keySource?: 'header' | 'parameter' | 'auto';
  /** How long to remember idempotency keys */
  ttlSeconds?: number;
}

/**
 * x-ai-timeouts metadata
 */
export interface AITimeoutsMeta {
  /** Soft timeout - trigger warning */
  softMs?: number;
  /** Hard timeout - abort execution */
  hardMs?: number;
  /** Whether timeout errors should trigger retry */
  retryable?: boolean;
}

/**
 * x-ai-cache metadata
 */
export interface AICacheMeta {
  /** Whether caching is enabled */
  enabled?: boolean;
  /** Cache TTL in seconds */
  ttlSeconds?: number;
  /** Parameters that affect cache key */
  varyBy?: string[];
  /** Domain events that invalidate cache */
  invalidateOn?: string[];
}

/**
 * x-ai-errors metadata
 */
export interface AIErrorEntry {
  /** Error code identifier */
  code: string;
  /** Whether LLM should retry with corrected params */
  retryable?: boolean;
  /** Message safe to display to end users */
  userSafeMessage: string;
}

/**
 * x-ai-async metadata
 */
export interface AIAsyncMeta {
  /** Whether operation runs asynchronously */
  enabled?: boolean;
  /** Endpoint template for status polling */
  statusEndpoint?: string;
  /** States that indicate completion */
  terminalStates?: string[];
  /** Polling configuration */
  polling?: {
    minMs?: number;
    maxMs?: number;
  };
}

/**
 * x-ai-financial-limits metadata
 */
export interface AIFinancialLimitsMeta {
  staff?: number;
  manager?: number;
  accountant?: number;
  admin?: number;
}

// =============================================================================
// Combined AI Metadata
// =============================================================================

/**
 * Complete AI metadata for a tRPC procedure
 *
 * Only `tool`, `risk`, and `permissions` are required for AI-enabled procedures.
 * Other properties are optional enhancements.
 */
export interface AIProcedureMeta {
  /** Tool identification and description (required) */
  tool: AIToolMeta;
  /** Risk assessment (required) */
  risk: AIRiskMeta;
  /** Permission requirements (required) */
  permissions: AIPermissionsMeta;
  /** Policy engine rules */
  policy?: AIPolicyMeta;
  /** Rate limiting */
  rateLimit?: AIRateLimitMeta;
  /** Output shaping */
  output?: AIOutputMeta;
  /** Idempotency configuration */
  idempotency?: AIIdempotencyMeta;
  /** Timeout configuration */
  timeouts?: AITimeoutsMeta;
  /** Cache configuration */
  cache?: AICacheMeta;
  /** Error catalog */
  errors?: AIErrorEntry[];
  /** Async operation configuration */
  async?: AIAsyncMeta;
  /** Financial limits by role */
  financialLimits?: AIFinancialLimitsMeta;
}

/**
 * tRPC procedure metadata that includes optional AI configuration
 */
export interface ProcedureMeta {
  /** AI-specific metadata - if present, this procedure is AI-enabled */
  ai?: AIProcedureMeta;
  /** OpenAPI operation ID override */
  openapi?: {
    operationId?: string;
    summary?: string;
    description?: string;
    tags?: string[];
    deprecated?: boolean;
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Creates AI metadata for a read-only query operation
 */
export function createReadOnlyAIMeta(
  name: string,
  description: string,
  options?: {
    scopes?: string[];
    minimumRole?: UserRole;
    permissions?: string[];
    cache?: AICacheMeta;
    rateLimit?: AIRateLimitMeta;
  }
): AIProcedureMeta {
  const resourceName = name.replace(/^(list_|get_|search_)/, '');

  return {
    tool: {
      name,
      description,
      scopes: options?.scopes ?? ['global'],
      version: 1,
      stability: 'stable',
      enabled: true,
    },
    risk: {
      level: 'LOW',
      requiresConfirmation: false,
      supportsDryRun: false,
    },
    permissions: {
      required: options?.permissions ?? [`read:${resourceName}`],
      minimumRole: options?.minimumRole ?? 'viewer',
    },
    cache: options?.cache,
    rateLimit: options?.rateLimit,
  };
}

/**
 * Creates AI metadata for a create/update mutation
 */
export function createWriteAIMeta(
  name: string,
  description: string,
  options?: {
    scopes?: string[];
    minimumRole?: UserRole;
    permissions?: string[];
    riskLevel?: RiskLevel;
    requiresConfirmation?: boolean;
    supportsDryRun?: boolean;
    financialLimits?: AIFinancialLimitsMeta;
    rateLimit?: AIRateLimitMeta;
    idempotency?: AIIdempotencyMeta;
  }
): AIProcedureMeta {
  const resourceName = name.replace(/^(create_|update_|upsert_)/, '');
  const isCreate = name.startsWith('create_');

  return {
    tool: {
      name,
      description,
      scopes: options?.scopes ?? ['global'],
      version: 1,
      stability: 'stable',
      enabled: true,
    },
    risk: {
      level: options?.riskLevel ?? 'MEDIUM',
      requiresConfirmation: options?.requiresConfirmation ?? true,
      supportsDryRun: options?.supportsDryRun ?? true,
    },
    permissions: {
      required: options?.permissions ?? [`write:${resourceName}`],
      minimumRole: options?.minimumRole ?? 'staff',
    },
    financialLimits: options?.financialLimits,
    rateLimit: options?.rateLimit ?? { requestsPerMinute: 30 },
    idempotency: options?.idempotency ?? { keySource: 'auto', ttlSeconds: 86400 },
  };
}

/**
 * Creates AI metadata for a delete mutation
 */
export function createDeleteAIMeta(
  name: string,
  description: string,
  options?: {
    scopes?: string[];
    minimumRole?: UserRole;
    permissions?: string[];
    riskLevel?: RiskLevel;
    supportsDryRun?: boolean;
    rateLimit?: AIRateLimitMeta;
  }
): AIProcedureMeta {
  const resourceName = name.replace(/^delete_/, '');

  return {
    tool: {
      name,
      description,
      scopes: options?.scopes ?? ['global'],
      version: 1,
      stability: 'stable',
      enabled: true,
    },
    risk: {
      level: options?.riskLevel ?? 'HIGH',
      requiresConfirmation: true,
      supportsDryRun: options?.supportsDryRun ?? true,
      confirmationMessage: `Are you sure you want to delete this ${resourceName}? This action cannot be undone.`,
    },
    permissions: {
      required: options?.permissions ?? [`delete:${resourceName}`],
      minimumRole: options?.minimumRole ?? 'manager',
    },
    rateLimit: options?.rateLimit ?? { requestsPerMinute: 10 },
  };
}

/**
 * Type guard to check if procedure meta has AI configuration
 */
export function isAIEnabled(meta: ProcedureMeta | undefined): meta is ProcedureMeta & { ai: AIProcedureMeta } {
  return meta?.ai !== undefined;
}
