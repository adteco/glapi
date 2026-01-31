import { describe, it, expect } from 'vitest';
import {
  // Type guards
  isValidUuid,
  isClerkUserId,
  isClerkOrgId,
  isEntityId,
  isOrganizationId,
  isSubsidiaryId,
  isDatabaseUuid,

  // Assertions
  assertClerkUserId,
  assertClerkOrgId,
  assertEntityId,
  assertOrganizationId,
  assertSubsidiaryId,
  assertDatabaseUuid,

  // Safe casting
  toClerkUserId,
  toClerkOrgId,
  toEntityId,
  toOrganizationId,
  toSubsidiaryId,
  toDatabaseUuid,

  // Constants
  CLERK_USER_PREFIX,
  CLERK_ORG_PREFIX,
} from './ids';

// Test data
const VALID_UUID = '7a2ae25a-72c5-4c9a-a9a5-eb7b50bdc8c5';
const VALID_UUID_UPPERCASE = '7A2AE25A-72C5-4C9A-A9A5-EB7B50BDC8C5';
const VALID_CLERK_USER_ID = 'user_2pP7GmO19H0eTgKpX6ehokxVBnM';
const VALID_CLERK_ORG_ID = 'org_2pP7GmO19H0eTgKpX6ehokxVBnM';
const INVALID_UUID = 'not-a-uuid';
const INVALID_SHORT = '7a2ae25a-72c5-4c9a';

describe('isValidUuid', () => {
  it('should return true for valid lowercase UUID', () => {
    expect(isValidUuid(VALID_UUID)).toBe(true);
  });

  it('should return true for valid uppercase UUID', () => {
    expect(isValidUuid(VALID_UUID_UPPERCASE)).toBe(true);
  });

  it('should return false for Clerk user ID', () => {
    expect(isValidUuid(VALID_CLERK_USER_ID)).toBe(false);
  });

  it('should return false for invalid string', () => {
    expect(isValidUuid(INVALID_UUID)).toBe(false);
  });

  it('should return false for incomplete UUID', () => {
    expect(isValidUuid(INVALID_SHORT)).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isValidUuid('')).toBe(false);
  });
});

describe('isClerkUserId', () => {
  it('should return true for valid Clerk user ID', () => {
    expect(isClerkUserId(VALID_CLERK_USER_ID)).toBe(true);
  });

  it('should return true for user_ prefix only', () => {
    expect(isClerkUserId('user_')).toBe(true);
  });

  it('should return false for UUID', () => {
    expect(isClerkUserId(VALID_UUID)).toBe(false);
  });

  it('should return false for Clerk org ID', () => {
    expect(isClerkUserId(VALID_CLERK_ORG_ID)).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isClerkUserId('')).toBe(false);
  });

  it('should return false for wrong prefix', () => {
    expect(isClerkUserId('usr_abc123')).toBe(false);
  });
});

describe('isClerkOrgId', () => {
  it('should return true for valid Clerk org ID', () => {
    expect(isClerkOrgId(VALID_CLERK_ORG_ID)).toBe(true);
  });

  it('should return true for org_ prefix only', () => {
    expect(isClerkOrgId('org_')).toBe(true);
  });

  it('should return false for UUID', () => {
    expect(isClerkOrgId(VALID_UUID)).toBe(false);
  });

  it('should return false for Clerk user ID', () => {
    expect(isClerkOrgId(VALID_CLERK_USER_ID)).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isClerkOrgId('')).toBe(false);
  });
});

describe('isEntityId / isOrganizationId / isSubsidiaryId / isDatabaseUuid', () => {
  // These all validate UUID format, so test them together
  const uuidGuards = [
    { name: 'isEntityId', fn: isEntityId },
    { name: 'isOrganizationId', fn: isOrganizationId },
    { name: 'isSubsidiaryId', fn: isSubsidiaryId },
    { name: 'isDatabaseUuid', fn: isDatabaseUuid },
  ];

  uuidGuards.forEach(({ name, fn }) => {
    describe(name, () => {
      it('should return true for valid UUID', () => {
        expect(fn(VALID_UUID)).toBe(true);
      });

      it('should return false for Clerk user ID', () => {
        expect(fn(VALID_CLERK_USER_ID)).toBe(false);
      });

      it('should return false for invalid string', () => {
        expect(fn(INVALID_UUID)).toBe(false);
      });
    });
  });
});

describe('assertClerkUserId', () => {
  it('should not throw for valid Clerk user ID', () => {
    expect(() => assertClerkUserId(VALID_CLERK_USER_ID)).not.toThrow();
  });

  it('should throw TypeError for UUID', () => {
    expect(() => assertClerkUserId(VALID_UUID)).toThrow(TypeError);
  });

  it('should throw TypeError for empty string', () => {
    expect(() => assertClerkUserId('')).toThrow(TypeError);
  });

  it('should include context in error message', () => {
    expect(() => assertClerkUserId(VALID_UUID, 'auth.userId')).toThrow(
      /Invalid Clerk User ID in auth\.userId/
    );
  });

  it('should include expected prefix in error message', () => {
    expect(() => assertClerkUserId(VALID_UUID)).toThrow(
      new RegExp(`must start with "${CLERK_USER_PREFIX}"`)
    );
  });
});

describe('assertClerkOrgId', () => {
  it('should not throw for valid Clerk org ID', () => {
    expect(() => assertClerkOrgId(VALID_CLERK_ORG_ID)).not.toThrow();
  });

  it('should throw TypeError for UUID', () => {
    expect(() => assertClerkOrgId(VALID_UUID)).toThrow(TypeError);
  });

  it('should include context in error message', () => {
    expect(() => assertClerkOrgId(VALID_UUID, 'ctx.orgId')).toThrow(
      /Invalid Clerk Organization ID in ctx\.orgId/
    );
  });

  it('should include expected prefix in error message', () => {
    expect(() => assertClerkOrgId(VALID_UUID)).toThrow(
      new RegExp(`must start with "${CLERK_ORG_PREFIX}"`)
    );
  });
});

describe('assertEntityId / assertOrganizationId / assertSubsidiaryId / assertDatabaseUuid', () => {
  const uuidAssertions = [
    { name: 'assertEntityId', fn: assertEntityId, typeName: 'Entity ID' },
    { name: 'assertOrganizationId', fn: assertOrganizationId, typeName: 'Organization ID' },
    { name: 'assertSubsidiaryId', fn: assertSubsidiaryId, typeName: 'Subsidiary ID' },
    { name: 'assertDatabaseUuid', fn: assertDatabaseUuid, typeName: 'Database UUID' },
  ];

  uuidAssertions.forEach(({ name, fn, typeName }) => {
    describe(name, () => {
      it('should not throw for valid UUID', () => {
        expect(() => fn(VALID_UUID)).not.toThrow();
      });

      it('should throw TypeError for Clerk user ID', () => {
        expect(() => fn(VALID_CLERK_USER_ID)).toThrow(TypeError);
      });

      it('should throw TypeError for invalid string', () => {
        expect(() => fn(INVALID_UUID)).toThrow(TypeError);
      });

      it('should include context in error message', () => {
        expect(() => fn(INVALID_UUID, 'test.context')).toThrow(
          new RegExp(`Invalid ${typeName} in test\\.context`)
        );
      });

      it('should mention UUID in error message', () => {
        expect(() => fn(INVALID_UUID)).toThrow(/must be a valid UUID/);
      });
    });
  });
});

describe('toClerkUserId', () => {
  it('should return ClerkUserId for valid input', () => {
    const result = toClerkUserId(VALID_CLERK_USER_ID);
    expect(result).toBe(VALID_CLERK_USER_ID);
  });

  it('should return null for UUID', () => {
    expect(toClerkUserId(VALID_UUID)).toBeNull();
  });

  it('should return null for null input', () => {
    expect(toClerkUserId(null)).toBeNull();
  });

  it('should return null for undefined input', () => {
    expect(toClerkUserId(undefined)).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(toClerkUserId('')).toBeNull();
  });
});

describe('toClerkOrgId', () => {
  it('should return ClerkOrgId for valid input', () => {
    const result = toClerkOrgId(VALID_CLERK_ORG_ID);
    expect(result).toBe(VALID_CLERK_ORG_ID);
  });

  it('should return null for UUID', () => {
    expect(toClerkOrgId(VALID_UUID)).toBeNull();
  });

  it('should return null for null input', () => {
    expect(toClerkOrgId(null)).toBeNull();
  });

  it('should return null for undefined input', () => {
    expect(toClerkOrgId(undefined)).toBeNull();
  });
});

describe('toEntityId / toOrganizationId / toSubsidiaryId / toDatabaseUuid', () => {
  const uuidCasters = [
    { name: 'toEntityId', fn: toEntityId },
    { name: 'toOrganizationId', fn: toOrganizationId },
    { name: 'toSubsidiaryId', fn: toSubsidiaryId },
    { name: 'toDatabaseUuid', fn: toDatabaseUuid },
  ];

  uuidCasters.forEach(({ name, fn }) => {
    describe(name, () => {
      it('should return typed ID for valid UUID', () => {
        const result = fn(VALID_UUID);
        expect(result).toBe(VALID_UUID);
      });

      it('should return null for Clerk user ID', () => {
        expect(fn(VALID_CLERK_USER_ID)).toBeNull();
      });

      it('should return null for invalid string', () => {
        expect(fn(INVALID_UUID)).toBeNull();
      });

      it('should return null for null input', () => {
        expect(fn(null)).toBeNull();
      });

      it('should return null for undefined input', () => {
        expect(fn(undefined)).toBeNull();
      });

      it('should return null for empty string', () => {
        expect(fn('')).toBeNull();
      });
    });
  });
});

describe('Type safety (compile-time)', () => {
  // These tests verify the type system works correctly
  // They primarily ensure the code compiles without type errors

  it('should allow EntityId where EntityId is expected', () => {
    const entityId = toEntityId(VALID_UUID);
    if (entityId) {
      // This should compile without error
      const acceptsEntityId = (id: ReturnType<typeof toEntityId>) => id;
      expect(acceptsEntityId(entityId)).toBe(entityId);
    }
  });

  it('should allow OrganizationId where OrganizationId is expected', () => {
    const orgId = toOrganizationId(VALID_UUID);
    if (orgId) {
      const acceptsOrgId = (id: ReturnType<typeof toOrganizationId>) => id;
      expect(acceptsOrgId(orgId)).toBe(orgId);
    }
  });

  // Note: TypeScript would prevent these at compile time:
  // - Passing ClerkUserId where EntityId is expected
  // - Passing EntityId where ClerkUserId is expected
  // - Mixing any branded types
  // These can't be tested at runtime since they're compile-time checks
});
