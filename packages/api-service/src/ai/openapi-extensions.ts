/**
 * AI OpenAPI Extensions - Zod Schemas and TypeScript Types
 *
 * These schemas define the x-ai-* OpenAPI extensions that make the OpenAPI spec
 * the single source of truth for AI tool capabilities.
 *
 * @see docs/architecture/ai-openapi.md for full specification
 * @module @glapi/api-service/ai/openapi-extensions
 */

import { z } from 'zod';

// =============================================================================
// Enums and Constants
// =============================================================================

/**
 * Risk levels for AI tool operations
 */
export const RiskLevelEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type RiskLevel = z.infer<typeof RiskLevelEnum>;

/**
 * Stability levels for tool versioning
 */
export const StabilityEnum = z.enum(['stable', 'beta', 'experimental']);
export type Stability = z.infer<typeof StabilityEnum>;

/**
 * User roles for permission checks
 */
export const UserRoleEnum = z.enum(['viewer', 'staff', 'manager', 'accountant', 'admin']);
export type UserRole = z.infer<typeof UserRoleEnum>;

/**
 * Rate limit scope options
 */
export const RateLimitScopeEnum = z.enum(['user', 'organization', 'global']);
export type RateLimitScope = z.infer<typeof RateLimitScopeEnum>;

/**
 * Common tool scopes for dynamic loading
 */
export const ToolScopeEnum = z.enum([
  'global',
  'sales',
  'invoicing',
  'accounting',
  'inventory',
  'purchasing',
  'reporting',
  'admin',
  'crm',
  'projects',
]);
export type ToolScope = z.infer<typeof ToolScopeEnum>;

// =============================================================================
// x-ai-tool Schema
// =============================================================================

/**
 * Core tool metadata - defines AI-accessible endpoints
 *
 * @example
 * ```yaml
 * x-ai-tool:
 *   name: list_customers
 *   version: 1
 *   stability: stable
 *   description: "Search and retrieve customer records"
 *   scopes: ["global", "sales"]
 *   enabled: true
 * ```
 */
export const XAiToolSchema = z.object({
  /** Unique tool identifier (snake_case) */
  name: z.string().regex(/^[a-z][a-z0-9_]*$/, 'Tool name must be snake_case'),

  /** Contract version for breaking changes */
  version: z.number().int().positive().default(1),

  /** Stability level affects how the tool is exposed */
  stability: StabilityEnum.default('stable'),

  /** Whether this tool version is deprecated */
  deprecated: z.boolean().default(false),

  /** Replacement tool name when deprecated */
  replacement: z.string().optional(),

  /** LLM-facing description (be specific and actionable) */
  description: z.string().min(10).max(500),

  /** Contextual scopes for dynamic tool loading */
  scopes: z.array(z.string()).min(1).default(['global']),

  /** Feature flag to enable/disable the tool */
  enabled: z.boolean().default(true),

  /** Example utterances that should trigger this tool */
  exampleUtterances: z.array(z.string()).optional(),
});

export type XAiTool = z.infer<typeof XAiToolSchema>;

// =============================================================================
// x-ai-risk Schema
// =============================================================================

/**
 * Risk assessment for tool operations
 *
 * @example
 * ```yaml
 * x-ai-risk:
 *   level: HIGH
 *   requiresConfirmation: true
 *   supportsDryRun: true
 *   confirmationMessage: "Create invoice for {customer}?"
 * ```
 */
export const XAiRiskSchema = z.object({
  /** Risk level determines confirmation and audit behavior */
  level: RiskLevelEnum,

  /** Whether user must explicitly confirm before execution */
  requiresConfirmation: z.boolean().default(false),

  /** Whether the tool supports dry-run/preview mode */
  supportsDryRun: z.boolean().default(false),

  /** Custom message template for confirmation dialog */
  confirmationMessage: z.string().optional(),
});

export type XAiRisk = z.infer<typeof XAiRiskSchema>;

// =============================================================================
// x-ai-permissions Schema
// =============================================================================

/**
 * Permission requirements for tool execution
 *
 * @example
 * ```yaml
 * x-ai-permissions:
 *   required: ["read:customers", "write:invoices"]
 *   minimumRole: accountant
 * ```
 */
export const XAiPermissionsSchema = z.object({
  /** Required permission scopes (e.g., "read:customers") */
  required: z.array(z.string().regex(/^(read|write|delete|admin):[a-z_]+$/)).min(1),

  /** Minimum role level required */
  minimumRole: UserRoleEnum,
});

export type XAiPermissions = z.infer<typeof XAiPermissionsSchema>;

// =============================================================================
// x-ai-policy Schema
// =============================================================================

/**
 * Policy engine rules for multi-tenant safety
 *
 * @example
 * ```yaml
 * x-ai-policy:
 *   allowTiers: ["pro", "enterprise"]
 *   requireMfaForRisk: ["HIGH", "CRITICAL"]
 *   rowScope: "record.orgId == caller.orgId"
 * ```
 */
export const XAiPolicySchema = z.object({
  /** Subscription tiers that can access this tool */
  allowTiers: z.array(z.string()).optional(),

  /** Risk levels that require MFA verification */
  requireMfaForRisk: z.array(RiskLevelEnum).optional(),

  /** CEL expression for row-level security filtering */
  rowScope: z.string().optional(),

  /** Maximum records affected per call */
  maxAffectedRecords: z.number().int().positive().optional(),
});

export type XAiPolicy = z.infer<typeof XAiPolicySchema>;

// =============================================================================
// x-ai-rate-limit Schema
// =============================================================================

/**
 * Rate limiting configuration for the tool
 *
 * @example
 * ```yaml
 * x-ai-rate-limit:
 *   requestsPerMinute: 60
 *   burstLimit: 10
 *   scope: user
 * ```
 */
export const XAiRateLimitSchema = z.object({
  /** Maximum requests per minute */
  requestsPerMinute: z.number().int().positive().max(1000),

  /** Maximum concurrent/burst requests */
  burstLimit: z.number().int().positive().max(100).optional(),

  /** Scope for rate limit tracking */
  scope: RateLimitScopeEnum.default('user'),
});

export type XAiRateLimit = z.infer<typeof XAiRateLimitSchema>;

// =============================================================================
// x-ai-output Schema
// =============================================================================

/**
 * Response shaping and redaction rules
 *
 * @example
 * ```yaml
 * x-ai-output:
 *   includeFields: ["id", "name", "status"]
 *   redactFields: ["taxId", "ssn"]
 *   maxItems: 50
 *   maxTokens: 500
 * ```
 */
export const XAiOutputSchema = z.object({
  /** Allowlist of fields to include in response */
  includeFields: z.array(z.string()).optional(),

  /** Fields to redact/mask in response */
  redactFields: z.array(z.string()).optional(),

  /** Maximum array items to return */
  maxItems: z.number().int().positive().max(1000).optional(),

  /** Approximate token budget for response */
  maxTokens: z.number().int().positive().max(10000).optional(),
});

export type XAiOutput = z.infer<typeof XAiOutputSchema>;

// =============================================================================
// x-ai-idempotency Schema
// =============================================================================

/**
 * Idempotency configuration for write operations
 *
 * @example
 * ```yaml
 * x-ai-idempotency:
 *   keySource: header
 *   ttlSeconds: 86400
 * ```
 */
export const XAiIdempotencySchema = z.object({
  /** Source of idempotency key */
  keySource: z.enum(['header', 'parameter', 'auto']).default('auto'),

  /** How long to remember idempotency keys */
  ttlSeconds: z.number().int().positive().max(604800).default(86400), // max 7 days
});

export type XAiIdempotency = z.infer<typeof XAiIdempotencySchema>;

// =============================================================================
// x-ai-timeouts Schema
// =============================================================================

/**
 * Timeout configuration for tool execution
 *
 * @example
 * ```yaml
 * x-ai-timeouts:
 *   softMs: 3000
 *   hardMs: 10000
 *   retryable: true
 * ```
 */
export const XAiTimeoutsSchema = z.object({
  /** Soft timeout - trigger warning */
  softMs: z.number().int().positive().max(30000).default(3000),

  /** Hard timeout - abort execution */
  hardMs: z.number().int().positive().max(60000).default(10000),

  /** Whether timeout errors should trigger retry */
  retryable: z.boolean().default(true),
});

export type XAiTimeouts = z.infer<typeof XAiTimeoutsSchema>;

// =============================================================================
// x-ai-cache Schema
// =============================================================================

/**
 * Result caching configuration
 *
 * @example
 * ```yaml
 * x-ai-cache:
 *   enabled: true
 *   ttlSeconds: 300
 *   varyBy: ["search", "limit"]
 *   invalidateOn: ["customer.created"]
 * ```
 */
export const XAiCacheSchema = z.object({
  /** Whether caching is enabled */
  enabled: z.boolean().default(false),

  /** Cache TTL in seconds */
  ttlSeconds: z.number().int().positive().max(86400).default(300),

  /** Parameters that affect cache key */
  varyBy: z.array(z.string()).optional(),

  /** Domain events that invalidate cache */
  invalidateOn: z.array(z.string()).optional(),
});

export type XAiCache = z.infer<typeof XAiCacheSchema>;

// =============================================================================
// x-ai-errors Schema
// =============================================================================

/**
 * Error catalog entry for known error conditions
 *
 * @example
 * ```yaml
 * x-ai-errors:
 *   - code: ArgumentValidationFailed
 *     retryable: false
 *     userSafeMessage: "Invalid inputs"
 * ```
 */
export const XAiErrorEntrySchema = z.object({
  /** Error code identifier */
  code: z.string(),

  /** Whether LLM should retry with corrected params */
  retryable: z.boolean().default(false),

  /** Message safe to display to end users */
  userSafeMessage: z.string(),
});

export const XAiErrorsSchema = z.array(XAiErrorEntrySchema);

export type XAiErrorEntry = z.infer<typeof XAiErrorEntrySchema>;
export type XAiErrors = z.infer<typeof XAiErrorsSchema>;

// =============================================================================
// x-ai-async Schema
// =============================================================================

/**
 * Async/long-running operation configuration
 *
 * @example
 * ```yaml
 * x-ai-async:
 *   enabled: true
 *   statusEndpoint: /api/jobs/{jobId}
 *   terminalStates: [succeeded, failed, canceled]
 *   polling:
 *     minMs: 500
 *     maxMs: 5000
 * ```
 */
export const XAiAsyncSchema = z.object({
  /** Whether operation runs asynchronously */
  enabled: z.boolean().default(false),

  /** Endpoint template for status polling */
  statusEndpoint: z.string().optional(),

  /** States that indicate completion */
  terminalStates: z.array(z.string()).default(['succeeded', 'failed', 'canceled']),

  /** Polling configuration */
  polling: z
    .object({
      /** Minimum polling interval */
      minMs: z.number().int().positive().default(500),
      /** Maximum polling interval (with backoff) */
      maxMs: z.number().int().positive().default(5000),
    })
    .optional(),
});

export type XAiAsync = z.infer<typeof XAiAsyncSchema>;

// =============================================================================
// x-ai-financial-limits Schema
// =============================================================================

/**
 * Financial amount limits by role
 *
 * @example
 * ```yaml
 * x-ai-financial-limits:
 *   staff: 10000
 *   manager: 100000
 *   accountant: 1000000
 * ```
 */
export const XAiFinancialLimitsSchema = z.object({
  /** Max amount for staff role */
  staff: z.number().positive().optional(),
  /** Max amount for manager role */
  manager: z.number().positive().optional(),
  /** Max amount for accountant role */
  accountant: z.number().positive().optional(),
  /** Admin has no limit by default */
  admin: z.number().positive().optional(),
});

export type XAiFinancialLimits = z.infer<typeof XAiFinancialLimitsSchema>;

// =============================================================================
// Combined Extension Schema
// =============================================================================

/**
 * Complete AI extension metadata for an OpenAPI operation
 *
 * This is the combined schema representing all x-ai-* extensions
 * that can be applied to an OpenAPI operation.
 */
export const AIOperationExtensionsSchema = z.object({
  'x-ai-tool': XAiToolSchema,
  'x-ai-risk': XAiRiskSchema,
  'x-ai-permissions': XAiPermissionsSchema,
  'x-ai-policy': XAiPolicySchema.optional(),
  'x-ai-rate-limit': XAiRateLimitSchema.optional(),
  'x-ai-output': XAiOutputSchema.optional(),
  'x-ai-idempotency': XAiIdempotencySchema.optional(),
  'x-ai-timeouts': XAiTimeoutsSchema.optional(),
  'x-ai-cache': XAiCacheSchema.optional(),
  'x-ai-errors': XAiErrorsSchema.optional(),
  'x-ai-async': XAiAsyncSchema.optional(),
  'x-ai-financial-limits': XAiFinancialLimitsSchema.optional(),
});

export type AIOperationExtensions = z.infer<typeof AIOperationExtensionsSchema>;

/**
 * Partial schema for operations that only have some extensions
 */
export const PartialAIOperationExtensionsSchema = AIOperationExtensionsSchema.partial();

export type PartialAIOperationExtensions = z.infer<typeof PartialAIOperationExtensionsSchema>;
