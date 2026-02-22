/**
 * AI OpenAPI Extension Validator
 *
 * Provides validation utilities for x-ai-* extensions.
 * Validates both individual extensions and complete operation metadata.
 *
 * @see docs/architecture/ai-openapi.md for full specification
 * @module @glapi/api-service/ai/extension-validator
 */

import { z, ZodError, ZodIssue } from 'zod';
import {
  AIOperationExtensionsSchema,
  PartialAIOperationExtensionsSchema,
  XAiToolSchema,
  XAiRiskSchema,
  XAiPermissionsSchema,
  XAiPolicySchema,
  XAiRateLimitSchema,
  XAiOutputSchema,
  XAiIdempotencySchema,
  XAiTimeoutsSchema,
  XAiCacheSchema,
  XAiErrorsSchema,
  XAiAsyncSchema,
  XAiFinancialLimitsSchema,
  type AIOperationExtensions,
  type PartialAIOperationExtensions,
  type RiskLevel,
} from './openapi-extensions';

// =============================================================================
// Validation Result Types
// =============================================================================

export interface ValidationSuccess<T> {
  success: true;
  data: T;
}

export interface ValidationError {
  success: false;
  errors: ValidationIssue[];
}

export interface ValidationIssue {
  path: string;
  message: string;
  code: string;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationError;

// =============================================================================
// Schema Map for Dynamic Validation
// =============================================================================

const EXTENSION_SCHEMAS = {
  'x-ai-tool': XAiToolSchema,
  'x-ai-risk': XAiRiskSchema,
  'x-ai-permissions': XAiPermissionsSchema,
  'x-ai-policy': XAiPolicySchema,
  'x-ai-rate-limit': XAiRateLimitSchema,
  'x-ai-output': XAiOutputSchema,
  'x-ai-idempotency': XAiIdempotencySchema,
  'x-ai-timeouts': XAiTimeoutsSchema,
  'x-ai-cache': XAiCacheSchema,
  'x-ai-errors': XAiErrorsSchema,
  'x-ai-async': XAiAsyncSchema,
  'x-ai-financial-limits': XAiFinancialLimitsSchema,
} as const;

type ExtensionKey = keyof typeof EXTENSION_SCHEMAS;

// =============================================================================
// Core Validation Functions
// =============================================================================

/**
 * Converts Zod issues to our ValidationIssue format
 */
function formatZodIssues(issues: ZodIssue[]): ValidationIssue[] {
  return issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
}

/**
 * Validates a single extension by name
 */
export function validateExtension<K extends ExtensionKey>(
  extensionName: K,
  data: unknown
): ValidationResult<z.infer<(typeof EXTENSION_SCHEMAS)[K]>> {
  const schema = EXTENSION_SCHEMAS[extensionName];
  if (!schema) {
    return {
      success: false,
      errors: [
        {
          path: extensionName,
          message: `Unknown extension: ${extensionName}`,
          code: 'unknown_extension',
        },
      ],
    };
  }

  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: formatZodIssues(result.error.issues).map((issue) => ({
      ...issue,
      path: `${extensionName}.${issue.path}`.replace(/\.$/, ''),
    })),
  };
}

/**
 * Validates complete AI operation extensions
 * Requires x-ai-tool, x-ai-risk, and x-ai-permissions as mandatory
 */
export function validateOperationExtensions(
  data: unknown
): ValidationResult<AIOperationExtensions> {
  const result = AIOperationExtensionsSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: formatZodIssues(result.error.issues),
  };
}

/**
 * Validates partial AI operation extensions
 * Useful for incremental validation or when not all extensions are present
 */
export function validatePartialOperationExtensions(
  data: unknown
): ValidationResult<PartialAIOperationExtensions> {
  const result = PartialAIOperationExtensionsSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: formatZodIssues(result.error.issues),
  };
}

// =============================================================================
// Semantic Validation
// =============================================================================

/**
 * Semantic validation issues that go beyond schema validation
 */
export interface SemanticValidationResult {
  valid: boolean;
  warnings: ValidationIssue[];
  errors: ValidationIssue[];
}

/**
 * Performs semantic validation on AI operation extensions
 * Checks for logical consistency beyond schema validation
 */
export function validateSemantics(
  extensions: AIOperationExtensions
): SemanticValidationResult {
  const warnings: ValidationIssue[] = [];
  const errors: ValidationIssue[] = [];

  const tool = extensions['x-ai-tool'];
  const risk = extensions['x-ai-risk'];
  const permissions = extensions['x-ai-permissions'];
  const policy = extensions['x-ai-policy'];
  const timeouts = extensions['x-ai-timeouts'];
  const cache = extensions['x-ai-cache'];
  const financialLimits = extensions['x-ai-financial-limits'];

  // Rule: HIGH/CRITICAL risk should require confirmation
  if ((risk.level === 'HIGH' || risk.level === 'CRITICAL') && !risk.requiresConfirmation) {
    warnings.push({
      path: 'x-ai-risk.requiresConfirmation',
      message: `Risk level ${risk.level} typically requires confirmation`,
      code: 'semantic_warning',
    });
  }

  // Rule: Deprecated tools should have replacement
  if (tool.deprecated && !tool.replacement) {
    warnings.push({
      path: 'x-ai-tool.replacement',
      message: 'Deprecated tools should specify a replacement',
      code: 'semantic_warning',
    });
  }

  // Rule: Write permissions should have at least MEDIUM risk
  const hasWritePermission = permissions.required.some(
    (p) => p.startsWith('write:') || p.startsWith('delete:')
  );
  if (hasWritePermission && risk.level === 'LOW') {
    warnings.push({
      path: 'x-ai-risk.level',
      message: 'Write/delete operations should typically have at least MEDIUM risk',
      code: 'semantic_warning',
    });
  }

  // Rule: Cache should not be enabled for write operations
  if (hasWritePermission && cache?.enabled) {
    errors.push({
      path: 'x-ai-cache.enabled',
      message: 'Cache should not be enabled for write operations',
      code: 'semantic_error',
    });
  }

  // Rule: Timeout hardMs should be greater than softMs
  if (timeouts && timeouts.hardMs <= timeouts.softMs) {
    errors.push({
      path: 'x-ai-timeouts',
      message: 'hardMs must be greater than softMs',
      code: 'semantic_error',
    });
  }

  // Rule: Financial limits role hierarchy
  if (financialLimits) {
    const staff = financialLimits.staff ?? 0;
    const manager = financialLimits.manager ?? staff;
    const accountant = financialLimits.accountant ?? manager;

    if (staff > manager) {
      errors.push({
        path: 'x-ai-financial-limits',
        message: 'Staff limit cannot exceed manager limit',
        code: 'semantic_error',
      });
    }
    if (manager > accountant) {
      errors.push({
        path: 'x-ai-financial-limits',
        message: 'Manager limit cannot exceed accountant limit',
        code: 'semantic_error',
      });
    }
  }

  // Rule: Policy tier restrictions with MFA
  if (policy?.requireMfaForRisk?.includes('LOW')) {
    warnings.push({
      path: 'x-ai-policy.requireMfaForRisk',
      message: 'Requiring MFA for LOW risk actions may impact user experience',
      code: 'semantic_warning',
    });
  }

  // Rule: Experimental tools should not be in global scope
  if (tool.stability === 'experimental' && tool.scopes.includes('global')) {
    warnings.push({
      path: 'x-ai-tool.scopes',
      message: 'Experimental tools should not be in global scope',
      code: 'semantic_warning',
    });
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

// =============================================================================
// OpenAPI Document Validation
// =============================================================================

/**
 * Extracts and validates AI extensions from an OpenAPI operation object
 */
export function extractAndValidateExtensions(
  operation: Record<string, unknown>
): ValidationResult<PartialAIOperationExtensions> {
  const extensions: Record<string, unknown> = {};

  for (const key of Object.keys(EXTENSION_SCHEMAS)) {
    if (key in operation) {
      extensions[key] = operation[key];
    }
  }

  if (Object.keys(extensions).length === 0) {
    return { success: true, data: {} };
  }

  return validatePartialOperationExtensions(extensions);
}

/**
 * Validates all operations in an OpenAPI paths object
 */
export function validateOpenAPIPaths(
  paths: Record<string, Record<string, Record<string, unknown>>>
): Map<string, ValidationResult<PartialAIOperationExtensions>> {
  const results = new Map<string, ValidationResult<PartialAIOperationExtensions>>();
  const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

  for (const [path, pathItem] of Object.entries(paths)) {
    for (const method of httpMethods) {
      const operation = pathItem[method];
      if (operation && typeof operation === 'object') {
        const key = `${method.toUpperCase()} ${path}`;
        results.set(key, extractAndValidateExtensions(operation));
      }
    }
  }

  return results;
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Checks if an operation has AI extensions
 */
export function hasAIExtensions(operation: Record<string, unknown>): boolean {
  return Object.keys(EXTENSION_SCHEMAS).some((key) => key in operation);
}

/**
 * Checks if an operation is AI-enabled (has required extensions)
 */
export function isAIEnabled(operation: Record<string, unknown>): boolean {
  return (
    'x-ai-tool' in operation &&
    'x-ai-risk' in operation &&
    'x-ai-permissions' in operation
  );
}

/**
 * Gets the risk level from an operation's extensions
 */
export function getOperationRiskLevel(
  operation: Record<string, unknown>
): RiskLevel | null {
  const risk = operation['x-ai-risk'];
  if (!risk || typeof risk !== 'object') return null;

  const result = XAiRiskSchema.safeParse(risk);
  return result.success ? result.data.level : null;
}

/**
 * Checks if an operation requires confirmation
 */
export function requiresConfirmation(operation: Record<string, unknown>): boolean {
  const risk = operation['x-ai-risk'];
  if (!risk || typeof risk !== 'object') return false;

  const result = XAiRiskSchema.safeParse(risk);
  if (!result.success) return false;

  return (
    result.data.requiresConfirmation ||
    result.data.level === 'HIGH' ||
    result.data.level === 'CRITICAL'
  );
}

/**
 * Checks if an operation supports dry-run mode
 */
export function supportsDryRun(operation: Record<string, unknown>): boolean {
  const risk = operation['x-ai-risk'];
  if (!risk || typeof risk !== 'object') return false;

  const result = XAiRiskSchema.safeParse(risk);
  return result.success ? result.data.supportsDryRun : false;
}

// =============================================================================
// Linting Functions
// =============================================================================

export interface LintResult {
  path: string;
  operation: string;
  issues: ValidationIssue[];
  warnings: ValidationIssue[];
}

/**
 * Lints an entire OpenAPI document for AI extension issues
 */
export function lintOpenAPIDocument(
  document: { paths?: Record<string, Record<string, Record<string, unknown>>> }
): LintResult[] {
  const results: LintResult[] = [];

  if (!document.paths) return results;

  const httpMethods = ['get', 'post', 'put', 'patch', 'delete'];

  for (const [path, pathItem] of Object.entries(document.paths)) {
    for (const method of httpMethods) {
      const operation = pathItem[method];
      if (!operation || typeof operation !== 'object') continue;

      const issues: ValidationIssue[] = [];
      const warnings: ValidationIssue[] = [];

      // Check if AI-enabled operation has all required extensions
      if (hasAIExtensions(operation) && !isAIEnabled(operation)) {
        if (!('x-ai-tool' in operation)) {
          issues.push({
            path: 'x-ai-tool',
            message: 'Missing required x-ai-tool extension',
            code: 'missing_required',
          });
        }
        if (!('x-ai-risk' in operation)) {
          issues.push({
            path: 'x-ai-risk',
            message: 'Missing required x-ai-risk extension',
            code: 'missing_required',
          });
        }
        if (!('x-ai-permissions' in operation)) {
          issues.push({
            path: 'x-ai-permissions',
            message: 'Missing required x-ai-permissions extension',
            code: 'missing_required',
          });
        }
      }

      // Validate extensions if present
      if (isAIEnabled(operation)) {
        const validationResult = validatePartialOperationExtensions(operation);
        if (validationResult.success === false) {
          issues.push(...validationResult.errors);
        } else {
          // Run semantic validation
          const fullResult = validateOperationExtensions(operation);
          if (fullResult.success === true) {
            const semantics = validateSemantics(fullResult.data);
            issues.push(...semantics.errors);
            warnings.push(...semantics.warnings);
          } else {
            issues.push(...fullResult.errors);
          }
        }
      }

      if (issues.length > 0 || warnings.length > 0) {
        results.push({
          path,
          operation: method.toUpperCase(),
          issues,
          warnings,
        });
      }
    }
  }

  return results;
}

/**
 * Formats lint results as a human-readable report
 */
export function formatLintReport(results: LintResult[]): string {
  if (results.length === 0) {
    return 'No issues found.';
  }

  const lines: string[] = [];

  for (const result of results) {
    lines.push(`\n${result.operation} ${result.path}:`);

    for (const issue of result.issues) {
      lines.push(`  ERROR: [${issue.path}] ${issue.message}`);
    }

    for (const warning of result.warnings) {
      lines.push(`  WARN:  [${warning.path}] ${warning.message}`);
    }
  }

  const errorCount = results.reduce((sum, r) => sum + r.issues.length, 0);
  const warnCount = results.reduce((sum, r) => sum + r.warnings.length, 0);

  lines.push(`\nTotal: ${errorCount} error(s), ${warnCount} warning(s)`);

  return lines.join('\n');
}
