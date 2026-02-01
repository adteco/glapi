/**
 * Branded Types for GLAPI ID Management
 *
 * This module provides type-safe ID handling to prevent mixing different ID types
 * at compile time. The codebase uses multiple ID formats:
 *
 * - Clerk User ID: String format like "user_2pP7GmO19H0eTgKpX6ehokxVBnM"
 * - Clerk Org ID: String format like "org_2pP7GmO19H0eTgKpX6ehokxVBnM"
 * - Entity ID: UUID format for database entities table
 * - Organization ID: UUID format for database organizations table
 *
 * Using these branded types prevents runtime errors like:
 * "invalid input syntax for type uuid: user_2pP7GmO19H0eTgKpX6ehokxVBnM"
 */

// ============================================================================
// Brand Type Infrastructure
// ============================================================================

/**
 * Brand type that adds a phantom type tag to a base type.
 * This creates a unique type that TypeScript will not allow to be mixed with other brands.
 */
declare const __brand: unique symbol;
type Brand<K, T> = K & { readonly [__brand]: T };

// ============================================================================
// Branded ID Types
// ============================================================================

/**
 * Clerk User ID - External authentication identifier
 * Format: "user_" followed by alphanumeric characters
 * Example: "user_2pP7GmO19H0eTgKpX6ehokxVBnM"
 *
 * Use this type when:
 * - Receiving user ID from Clerk authentication
 * - Storing Clerk user ID for external reference
 * - Looking up entity by Clerk user ID
 */
export type ClerkUserId = Brand<string, 'ClerkUserId'>;

/**
 * Clerk Organization ID - External organization identifier
 * Format: "org_" followed by alphanumeric characters
 * Example: "org_2pP7GmO19H0eTgKpX6ehokxVBnM"
 *
 * Use this type when:
 * - Receiving organization ID from Clerk authentication
 * - Storing Clerk org ID for external reference
 */
export type ClerkOrgId = Brand<string, 'ClerkOrgId'>;

/**
 * Entity ID - Database identifier for entities table
 * Format: UUID (lowercase with hyphens)
 * Example: "7a2ae25a-72c5-4c9a-a9a5-eb7b50bdc8c5"
 *
 * Use this type when:
 * - Referencing a record in the entities table
 * - Setting created_by/modified_by audit fields
 * - Creating foreign key references to entities
 */
export type EntityId = Brand<string, 'EntityId'>;

/**
 * Organization ID - Database identifier for organizations table
 * Format: UUID (lowercase with hyphens)
 * Example: "1c873885-8272-4456-bc9e-edf2cd9bc1ee"
 *
 * Use this type when:
 * - Referencing a record in the organizations table
 * - Setting organization_id for multi-tenant isolation
 * - Configuring RLS context
 */
export type OrganizationId = Brand<string, 'OrganizationId'>;

/**
 * Subsidiary ID - Database identifier for subsidiaries table
 * Format: UUID (lowercase with hyphens)
 *
 * Use this type when:
 * - Referencing a record in the subsidiaries table
 * - Setting subsidiary_id on transactions
 */
export type SubsidiaryId = Brand<string, 'SubsidiaryId'>;

/**
 * Generic Database UUID - For UUIDs that don't have a specific brand
 * Format: UUID (lowercase with hyphens)
 *
 * Use this type when:
 * - Working with UUIDs from tables without specific brands
 * - Generic UUID operations
 */
export type DatabaseUuid = Brand<string, 'DatabaseUuid'>;

// ============================================================================
// Validation Constants
// ============================================================================

/**
 * UUID regex pattern for validation
 * Matches standard UUID format: 8-4-4-4-12 hexadecimal characters
 */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Clerk User ID prefix
 */
export const CLERK_USER_PREFIX = 'user_';

/**
 * Clerk Organization ID prefix
 */
export const CLERK_ORG_PREFIX = 'org_';

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a string is a valid UUID format
 */
export function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Check if a string is a Clerk User ID format
 */
export function isClerkUserId(value: string): value is ClerkUserId {
  return typeof value === 'string' && value.startsWith(CLERK_USER_PREFIX);
}

/**
 * Check if a string is a Clerk Organization ID format
 */
export function isClerkOrgId(value: string): value is ClerkOrgId {
  return typeof value === 'string' && value.startsWith(CLERK_ORG_PREFIX);
}

/**
 * Check if a string is a valid Entity ID (UUID format)
 */
export function isEntityId(value: string): value is EntityId {
  return isValidUuid(value);
}

/**
 * Check if a string is a valid Organization ID (UUID format)
 */
export function isOrganizationId(value: string): value is OrganizationId {
  return isValidUuid(value);
}

/**
 * Check if a string is a valid Subsidiary ID (UUID format)
 */
export function isSubsidiaryId(value: string): value is SubsidiaryId {
  return isValidUuid(value);
}

/**
 * Check if a string is a valid Database UUID
 */
export function isDatabaseUuid(value: string): value is DatabaseUuid {
  return isValidUuid(value);
}

// ============================================================================
// Type Assertions (throw on invalid)
// ============================================================================

/**
 * Assert that a value is a valid Clerk User ID, throwing if not
 */
export function assertClerkUserId(value: string, context?: string): asserts value is ClerkUserId {
  if (!isClerkUserId(value)) {
    const msg = context
      ? `Invalid Clerk User ID in ${context}: "${value}" (must start with "${CLERK_USER_PREFIX}")`
      : `Invalid Clerk User ID: "${value}" (must start with "${CLERK_USER_PREFIX}")`;
    throw new TypeError(msg);
  }
}

/**
 * Assert that a value is a valid Clerk Organization ID, throwing if not
 */
export function assertClerkOrgId(value: string, context?: string): asserts value is ClerkOrgId {
  if (!isClerkOrgId(value)) {
    const msg = context
      ? `Invalid Clerk Organization ID in ${context}: "${value}" (must start with "${CLERK_ORG_PREFIX}")`
      : `Invalid Clerk Organization ID: "${value}" (must start with "${CLERK_ORG_PREFIX}")`;
    throw new TypeError(msg);
  }
}

/**
 * Assert that a value is a valid Entity ID (UUID), throwing if not
 */
export function assertEntityId(value: string, context?: string): asserts value is EntityId {
  if (!isEntityId(value)) {
    const msg = context
      ? `Invalid Entity ID in ${context}: "${value}" (must be a valid UUID)`
      : `Invalid Entity ID: "${value}" (must be a valid UUID)`;
    throw new TypeError(msg);
  }
}

/**
 * Assert that a value is a valid Organization ID (UUID), throwing if not
 */
export function assertOrganizationId(value: string, context?: string): asserts value is OrganizationId {
  if (!isOrganizationId(value)) {
    const msg = context
      ? `Invalid Organization ID in ${context}: "${value}" (must be a valid UUID)`
      : `Invalid Organization ID: "${value}" (must be a valid UUID)`;
    throw new TypeError(msg);
  }
}

/**
 * Assert that a value is a valid Subsidiary ID (UUID), throwing if not
 */
export function assertSubsidiaryId(value: string, context?: string): asserts value is SubsidiaryId {
  if (!isSubsidiaryId(value)) {
    const msg = context
      ? `Invalid Subsidiary ID in ${context}: "${value}" (must be a valid UUID)`
      : `Invalid Subsidiary ID: "${value}" (must be a valid UUID)`;
    throw new TypeError(msg);
  }
}

/**
 * Assert that a value is a valid Database UUID, throwing if not
 */
export function assertDatabaseUuid(value: string, context?: string): asserts value is DatabaseUuid {
  if (!isDatabaseUuid(value)) {
    const msg = context
      ? `Invalid Database UUID in ${context}: "${value}" (must be a valid UUID)`
      : `Invalid Database UUID: "${value}" (must be a valid UUID)`;
    throw new TypeError(msg);
  }
}

// ============================================================================
// Safe Casting Functions (return typed value or null)
// ============================================================================

/**
 * Safely cast a string to ClerkUserId, returning null if invalid
 */
export function toClerkUserId(value: string | null | undefined): ClerkUserId | null {
  if (!value || !isClerkUserId(value)) return null;
  return value;
}

/**
 * Safely cast a string to ClerkOrgId, returning null if invalid
 */
export function toClerkOrgId(value: string | null | undefined): ClerkOrgId | null {
  if (!value || !isClerkOrgId(value)) return null;
  return value;
}

/**
 * Safely cast a string to EntityId, returning null if invalid
 */
export function toEntityId(value: string | null | undefined): EntityId | null {
  if (!value || !isEntityId(value)) return null;
  return value;
}

/**
 * Safely cast a string to OrganizationId, returning null if invalid
 */
export function toOrganizationId(value: string | null | undefined): OrganizationId | null {
  if (!value || !isOrganizationId(value)) return null;
  return value;
}

/**
 * Safely cast a string to SubsidiaryId, returning null if invalid
 */
export function toSubsidiaryId(value: string | null | undefined): SubsidiaryId | null {
  if (!value || !isSubsidiaryId(value)) return null;
  return value;
}

/**
 * Safely cast a string to DatabaseUuid, returning null if invalid
 */
export function toDatabaseUuid(value: string | null | undefined): DatabaseUuid | null {
  if (!value || !isDatabaseUuid(value)) return null;
  return value;
}

// ============================================================================
// Unsafe Casting Functions (use only when you're certain of the type)
// ============================================================================

/**
 * Force cast a string to ClerkUserId without validation.
 * WARNING: Only use when you're certain the value is valid.
 */
export function unsafeClerkUserId(value: string): ClerkUserId {
  return value as ClerkUserId;
}

/**
 * Force cast a string to ClerkOrgId without validation.
 * WARNING: Only use when you're certain the value is valid.
 */
export function unsafeClerkOrgId(value: string): ClerkOrgId {
  return value as ClerkOrgId;
}

/**
 * Force cast a string to EntityId without validation.
 * WARNING: Only use when you're certain the value is valid (e.g., from database).
 */
export function unsafeEntityId(value: string): EntityId {
  return value as EntityId;
}

/**
 * Force cast a string to OrganizationId without validation.
 * WARNING: Only use when you're certain the value is valid (e.g., from database).
 */
export function unsafeOrganizationId(value: string): OrganizationId {
  return value as OrganizationId;
}

/**
 * Force cast a string to SubsidiaryId without validation.
 * WARNING: Only use when you're certain the value is valid (e.g., from database).
 */
export function unsafeSubsidiaryId(value: string): SubsidiaryId {
  return value as SubsidiaryId;
}

/**
 * Force cast a string to DatabaseUuid without validation.
 * WARNING: Only use when you're certain the value is valid (e.g., from database).
 */
export function unsafeDatabaseUuid(value: string): DatabaseUuid {
  return value as DatabaseUuid;
}
