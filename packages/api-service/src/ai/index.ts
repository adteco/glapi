/**
 * AI OpenAPI Extensions Module
 *
 * This module provides Zod schemas, TypeScript types, and validation utilities
 * for the x-ai-* OpenAPI extensions that power the AI tooling system.
 *
 * @example
 * ```typescript
 * import {
 *   XAiToolSchema,
 *   validateOperationExtensions,
 *   lintOpenAPIDocument,
 * } from '@glapi/api-service/ai';
 *
 * // Validate a single extension
 * const result = XAiToolSchema.safeParse(toolData);
 *
 * // Validate complete operation extensions
 * const opResult = validateOperationExtensions(operationData);
 *
 * // Lint an OpenAPI document
 * const lintResults = lintOpenAPIDocument(openApiDoc);
 * ```
 *
 * @see docs/architecture/ai-openapi.md for full specification
 * @module @glapi/api-service/ai
 */

// Schemas and Types
export {
  // Enums
  RiskLevelEnum,
  StabilityEnum,
  UserRoleEnum,
  RateLimitScopeEnum,
  ToolScopeEnum,
  // Individual Extension Schemas
  XAiToolSchema,
  XAiRiskSchema,
  XAiPermissionsSchema,
  XAiPolicySchema,
  XAiRateLimitSchema,
  XAiOutputSchema,
  XAiIdempotencySchema,
  XAiTimeoutsSchema,
  XAiCacheSchema,
  XAiErrorEntrySchema,
  XAiErrorsSchema,
  XAiAsyncSchema,
  XAiFinancialLimitsSchema,
  // Combined Schemas
  AIOperationExtensionsSchema,
  PartialAIOperationExtensionsSchema,
  // Types
  type RiskLevel,
  type Stability,
  type UserRole,
  type RateLimitScope,
  type ToolScope,
  type XAiTool,
  type XAiRisk,
  type XAiPermissions,
  type XAiPolicy,
  type XAiRateLimit,
  type XAiOutput,
  type XAiIdempotency,
  type XAiTimeouts,
  type XAiCache,
  type XAiErrorEntry,
  type XAiErrors,
  type XAiAsync,
  type XAiFinancialLimits,
  type AIOperationExtensions,
  type PartialAIOperationExtensions,
} from './openapi-extensions';

// Validation
export {
  // Types
  type ValidationSuccess,
  type ValidationError,
  type ValidationIssue,
  type ValidationResult,
  type SemanticValidationResult,
  type LintResult,
  // Core Validation
  validateExtension,
  validateOperationExtensions,
  validatePartialOperationExtensions,
  validateSemantics,
  // OpenAPI Document Validation
  extractAndValidateExtensions,
  validateOpenAPIPaths,
  // Helpers
  hasAIExtensions,
  isAIEnabled,
  getOperationRiskLevel,
  requiresConfirmation,
  supportsDryRun,
  // Linting
  lintOpenAPIDocument,
  formatLintReport,
} from './extension-validator';
