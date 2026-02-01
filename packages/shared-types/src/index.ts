/**
 * @glapi/shared-types
 *
 * Shared type definitions for GLAPI including:
 * - Branded ID types for type-safe ID handling
 * - Type guards and assertions
 * - Safe casting utilities
 *
 * @example
 * ```typescript
 * import {
 *   type EntityId,
 *   type ClerkUserId,
 *   isEntityId,
 *   assertEntityId,
 *   toEntityId
 * } from '@glapi/shared-types';
 *
 * // Type guard
 * if (isEntityId(someId)) {
 *   // someId is now typed as EntityId
 * }
 *
 * // Assertion (throws if invalid)
 * assertEntityId(someId, 'user.entityId');
 *
 * // Safe cast (returns null if invalid)
 * const entityId = toEntityId(maybeId);
 * if (entityId) {
 *   // entityId is EntityId
 * }
 * ```
 */

// Re-export all ID types and utilities
export {
  // Branded Types
  type ClerkUserId,
  type ClerkOrgId,
  type EntityId,
  type OrganizationId,
  type SubsidiaryId,
  type DatabaseUuid,

  // Constants
  UUID_REGEX,
  CLERK_USER_PREFIX,
  CLERK_ORG_PREFIX,

  // Validation
  isValidUuid,

  // Type Guards
  isClerkUserId,
  isClerkOrgId,
  isEntityId,
  isOrganizationId,
  isSubsidiaryId,
  isDatabaseUuid,

  // Assertions (throw on invalid)
  assertClerkUserId,
  assertClerkOrgId,
  assertEntityId,
  assertOrganizationId,
  assertSubsidiaryId,
  assertDatabaseUuid,

  // Safe Casting (return null on invalid)
  toClerkUserId,
  toClerkOrgId,
  toEntityId,
  toOrganizationId,
  toSubsidiaryId,
  toDatabaseUuid,

  // Unsafe Casting (no validation - use with caution)
  unsafeClerkUserId,
  unsafeClerkOrgId,
  unsafeEntityId,
  unsafeOrganizationId,
  unsafeSubsidiaryId,
  unsafeDatabaseUuid,
} from './ids';
