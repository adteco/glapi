# TYPES-002: Migrate Common Types

## Task Overview

**Description**: Migrate shared/common types from `@glapi/api-service` to `@glapi/types`. This includes pagination, address schemas, service context, and error types.

**Layer**: Foundation / Cross-cutting

**Estimated Time**: 3 hours

**Dependencies**: TYPES-001

**Blocks**: TYPES-003 through TYPES-014

---

## Acceptance Criteria

- [ ] `addressSchema` and `Address` type exported from `@glapi/types/common`
- [ ] `PaginationParams` and `PaginatedResult<T>` exported
- [ ] `ServiceContext` interface exported
- [ ] `ApiError` and `ServiceError` exported
- [ ] All schemas have JSDoc documentation
- [ ] Unit tests pass for all schemas
- [ ] Type inference works correctly with `z.infer`

---

## TDD Approach

### 1. Write Tests First

Create `packages/types/tests/common.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  addressSchema,
  type Address,
  type PaginationParams,
  type PaginatedResult,
  type ServiceContext,
  ServiceError,
} from '../src/common';

describe('Common Types', () => {
  describe('addressSchema', () => {
    it('should validate a complete address', () => {
      const address = {
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        postalCode: '12345',
        country: 'USA',
      };

      const result = addressSchema.safeParse(address);
      expect(result.success).toBe(true);
    });

    it('should allow partial address', () => {
      const partialAddress = {
        city: 'Anytown',
      };

      const result = addressSchema.safeParse(partialAddress);
      expect(result.success).toBe(true);
    });

    it('should allow empty object', () => {
      const result = addressSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('PaginationParams', () => {
    it('should accept valid pagination params', () => {
      const params: PaginationParams = {
        page: 1,
        limit: 20,
      };
      expect(params.page).toBe(1);
    });

    it('should allow undefined values', () => {
      const params: PaginationParams = {};
      expect(params.page).toBeUndefined();
    });
  });

  describe('PaginatedResult', () => {
    it('should type correctly with generic', () => {
      const result: PaginatedResult<{ id: string }> = {
        data: [{ id: '1' }],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      };
      expect(result.data[0].id).toBe('1');
    });
  });

  describe('ServiceContext', () => {
    it('should accept all optional fields', () => {
      const ctx: ServiceContext = {};
      expect(ctx.organizationId).toBeUndefined();
    });

    it('should accept full context', () => {
      const ctx: ServiceContext = {
        organizationId: 'org-123',
        userId: 'user-456',
        userName: 'John Doe',
      };
      expect(ctx.organizationId).toBe('org-123');
    });
  });

  describe('ServiceError', () => {
    it('should create error with all properties', () => {
      const error = new ServiceError('Not found', 'NOT_FOUND', 404, { id: '123' });

      expect(error.message).toBe('Not found');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.details?.id).toBe('123');
      expect(error.name).toBe('ServiceError');
    });

    it('should default to 400 status code', () => {
      const error = new ServiceError('Bad request', 'BAD_REQUEST');
      expect(error.statusCode).toBe(400);
    });
  });
});
```

### 2. Implement to Pass Tests

Create the source files as specified below.

### 3. Verify

```bash
pnpm --filter @glapi/types test
pnpm --filter @glapi/types type-check
```

---

## Implementation Details

### File: `packages/types/src/common/index.ts`

```typescript
/**
 * Common types used across all GLAPI domains
 * @module @glapi/types/common
 */

export * from './address';
export * from './pagination';
export * from './service-context';
export * from './errors';
```

### File: `packages/types/src/common/address.ts`

```typescript
import { z } from 'zod';

/**
 * Address schema for billing and shipping addresses
 *
 * @example
 * const address = addressSchema.parse({
 *   street: '123 Main St',
 *   city: 'Anytown',
 *   state: 'CA',
 *   postalCode: '12345',
 *   country: 'USA'
 * });
 */
export const addressSchema = z.object({
  /** Street address line */
  street: z.string().optional(),
  /** City name */
  city: z.string().optional(),
  /** State or province */
  state: z.string().optional(),
  /** Postal or ZIP code */
  postalCode: z.string().optional(),
  /** Country name or ISO code */
  country: z.string().optional(),
});

/**
 * Address type derived from addressSchema
 */
export type Address = z.infer<typeof addressSchema>;
```

### File: `packages/types/src/common/pagination.ts`

```typescript
/**
 * Pagination parameters for list endpoints
 *
 * @example
 * function listItems(params: PaginationParams) {
 *   const page = params.page ?? 1;
 *   const limit = params.limit ?? 20;
 *   // ...
 * }
 */
export interface PaginationParams {
  /** Page number (1-indexed) */
  page?: number;
  /** Number of items per page */
  limit?: number;
}

/**
 * Generic paginated result wrapper
 *
 * @typeParam T - The type of items in the result
 *
 * @example
 * type CustomerList = PaginatedResult<Customer>;
 */
export interface PaginatedResult<T> {
  /** Array of items for the current page */
  data: T[];
  /** Total number of items across all pages */
  total: number;
  /** Current page number */
  page: number;
  /** Items per page */
  limit: number;
  /** Total number of pages */
  totalPages: number;
}
```

### File: `packages/types/src/common/service-context.ts`

```typescript
/**
 * Context passed to service layer operations
 *
 * Contains the authenticated user and organization context.
 *
 * @example
 * class CustomerService {
 *   constructor(private ctx: ServiceContext) {}
 *
 *   async list() {
 *     const { organizationId } = this.ctx;
 *     // Filter by organization
 *   }
 * }
 */
export interface ServiceContext {
  /** The organization ID for multi-tenant isolation */
  organizationId?: string;
  /** The authenticated user's ID */
  userId?: string;
  /** The authenticated user's display name */
  userName?: string;
}
```

### File: `packages/types/src/common/errors.ts`

```typescript
/**
 * Standard API error response structure
 *
 * @example
 * const error: ApiError = {
 *   code: 'NOT_FOUND',
 *   message: 'Customer not found',
 *   details: { id: 'cust-123' }
 * };
 */
export interface ApiError {
  /** Error code for programmatic handling */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Additional error details */
  details?: Record<string, unknown>;
}

/**
 * Service layer error with HTTP status code
 *
 * @example
 * throw new ServiceError('Customer not found', 'NOT_FOUND', 404, { id: 'cust-123' });
 */
export class ServiceError extends Error {
  /** Error code for programmatic handling */
  code: string;
  /** HTTP status code */
  statusCode: number;
  /** Additional error details */
  details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode: number = 400,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}
```

---

## Update Main Index

### File: `packages/types/src/index.ts`

```typescript
/**
 * @glapi/types - Centralized type definitions for GLAPI
 */

// Re-export Zod for convenience
export { z } from 'zod';

// Export common types
export * from './common';

// Placeholder exports - will be added as types are migrated
// export * from './entities';
// export * from './accounting';
// ...
```

---

## Migration Verification

After implementation, verify that existing code can use the new types:

```typescript
// In @glapi/api-service, this import should work:
import { addressSchema, type Address, type PaginationParams } from '@glapi/types';

// Should be equivalent to the old import:
// import { addressSchema, type Address } from './types/common.types';
```

---

## Rollback Plan

If issues arise:
1. Keep old types in `@glapi/api-service`
2. Remove new files from `@glapi/types/src/common/`
3. Revert index.ts export

---

## Git Commit

```
feat(types): add common types (pagination, address, errors)

- Add addressSchema with JSDoc documentation
- Add PaginationParams and PaginatedResult interfaces
- Add ServiceContext interface for service layer
- Add ApiError interface and ServiceError class
- Add comprehensive unit tests

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```
