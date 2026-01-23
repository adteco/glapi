# TYPES-010: Refactor @glapi/trpc to Use @glapi/types

## Task Overview

**Description**: Remove duplicated Zod schemas from TRPC router files and import them from `@glapi/types` instead. This is the primary refactoring task that eliminates type duplication.

**Layer**: API Layer

**Estimated Time**: 6 hours

**Dependencies**: TYPES-002 through TYPES-009

**Blocks**: TYPES-012, TEST-001 to TEST-004

---

## Acceptance Criteria

- [ ] All TRPC routers import schemas from `@glapi/types`
- [ ] No duplicate schema definitions in `packages/trpc/src/routers/`
- [ ] All existing TRPC tests pass
- [ ] Type-check passes for `@glapi/trpc` package
- [ ] `RouterOutputs` and `RouterInputs` still work correctly
- [ ] OpenAPI generation still works

---

## Files to Refactor

### High Priority (Critical for client-to-cash)
1. `packages/trpc/src/routers/time-entries.ts` - **Full duplicate removal**
2. `packages/trpc/src/routers/projects.ts` - **Full duplicate removal**
3. `packages/trpc/src/routers/invoices.ts` - **Schema extraction**
4. `packages/trpc/src/routers/customers.ts` - **Schema consolidation**
5. `packages/trpc/src/routers/payments.ts` - **Schema extraction**

### Medium Priority
6. `packages/trpc/src/routers/items.ts`
7. `packages/trpc/src/routers/accounts.ts`
8. `packages/trpc/src/routers/subscriptions.ts`
9. `packages/trpc/src/routers/sales-orders.ts`

### Lower Priority (Alphabetical)
10-30+. Remaining routers following the same pattern

---

## TDD Approach

### 1. Write Integration Tests First

Before refactoring, ensure existing behavior is tested:

```typescript
// packages/trpc/tests/time-entries-types.test.ts
import { describe, it, expect } from 'vitest';
import { createTimeEntrySchema, TimeEntryStatusEnum } from '@glapi/types';
import { appRouter } from '../src/router';

describe('Time Entries Router Type Integration', () => {
  it('should accept valid create input matching schema', () => {
    const input = {
      entryDate: '2024-01-15',
      hours: '8.00',
      entryType: 'REGULAR' as const,
      isBillable: true,
    };

    // Validate with the schema
    const result = createTimeEntrySchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should match router input types', () => {
    // Type-level test - if this compiles, types are compatible
    type RouterCreateInput = Parameters<typeof appRouter.timeEntries.create>[0];
    // This should be structurally compatible with CreateTimeEntryInput
  });
});
```

### 2. Refactor Each Router

Follow the pattern below for each router.

### 3. Verify

```bash
pnpm --filter @glapi/trpc type-check
pnpm --filter @glapi/trpc test
pnpm build
```

---

## Implementation Pattern

### Before (Current State - time-entries.ts)

```typescript
import { z } from 'zod';
import { authenticatedProcedure, adminProcedure, router } from '../trpc';
import { TimeEntryService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';

// DUPLICATED - This exists in api-service/types/time-entries.types.ts
const TimeEntryStatusEnum = z.enum([
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'POSTED',
  'CANCELLED',
]);

// DUPLICATED
const TimeEntryTypeEnum = z.enum([
  'REGULAR',
  'OVERTIME',
  'DOUBLE_TIME',
  'PTO',
  'SICK',
  'HOLIDAY',
  'OTHER',
]);

// DUPLICATED
const createTimeEntrySchema = z.object({
  employeeId: z.string().uuid().optional(),
  // ... rest of schema
});

export const timeEntriesRouter = router({
  create: authenticatedProcedure
    .input(createTimeEntrySchema)
    .mutation(async ({ ctx, input }) => {
      // ...
    }),
});
```

### After (Refactored)

```typescript
import { z } from 'zod';
import { authenticatedProcedure, adminProcedure, router } from '../trpc';
import { TimeEntryService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';

// Import schemas from centralized types package
import {
  TimeEntryStatusEnum,
  TimeEntryTypeEnum,
  createTimeEntrySchema,
  updateTimeEntrySchema,
  timeEntryFiltersSchema,
  submitTimeEntriesSchema,
  approveTimeEntriesSchema,
  rejectTimeEntriesSchema,
  createLaborCostRateSchema,
  createEmployeeProjectAssignmentSchema,
} from '@glapi/types';

export const timeEntriesRouter = router({
  create: authenticatedProcedure
    .input(createTimeEntrySchema)
    .mutation(async ({ ctx, input }) => {
      // ... unchanged business logic
    }),

  list: authenticatedProcedure
    .input(
      z.object({
        page: z.number().int().positive().optional(),
        limit: z.number().int().positive().max(100).optional(),
        orderBy: z.enum(['entryDate', 'createdAt', 'status', 'hours']).optional(),
        orderDirection: z.enum(['asc', 'desc']).optional(),
        filters: timeEntryFiltersSchema.optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      // ... unchanged
    }),

  submit: authenticatedProcedure
    .input(submitTimeEntriesSchema)  // Now imported from @glapi/types
    .mutation(async ({ ctx, input }) => {
      // ... unchanged
    }),

  // ... rest of router unchanged
});
```

---

## Detailed Refactoring Steps

### Step 1: Update package.json

Add dependency on `@glapi/types`:

```json
{
  "dependencies": {
    "@glapi/types": "workspace:*",
    // ... existing deps
  }
}
```

### Step 2: Refactor time-entries.ts

1. Remove all local schema definitions
2. Add import from `@glapi/types`
3. Verify type compatibility

```typescript
// packages/trpc/src/routers/time-entries.ts

import { z } from 'zod';
import { authenticatedProcedure, adminProcedure, router } from '../trpc';
import { TimeEntryService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';
import {
  TimeEntryStatusEnum,
  TimeEntryTypeEnum,
  createTimeEntrySchema,
  updateTimeEntrySchema,
  timeEntryFiltersSchema,
  submitTimeEntriesSchema,
  approveTimeEntriesSchema,
  rejectTimeEntriesSchema,
  createLaborCostRateSchema,
  createEmployeeProjectAssignmentSchema,
} from '@glapi/types';

// Compose list input schema using imported filter schema
const listTimeEntriesInputSchema = z.object({
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
  orderBy: z.enum(['entryDate', 'createdAt', 'status', 'hours']).optional(),
  orderDirection: z.enum(['asc', 'desc']).optional(),
  filters: timeEntryFiltersSchema.optional(),
}).optional();

export const timeEntriesRouter = router({
  list: authenticatedProcedure
    .input(listTimeEntriesInputSchema)
    .query(async ({ ctx, input }) => {
      const service = new TimeEntryService(ctx.serviceContext);
      return service.list(
        { page: input?.page, limit: input?.limit },
        input?.filters || {},
        input?.orderBy || 'entryDate',
        input?.orderDirection || 'desc'
      );
    }),

  getById: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new TimeEntryService(ctx.serviceContext);
      const entry = await service.getById(input.id);
      if (!entry) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Time entry not found',
        });
      }
      return entry;
    }),

  create: authenticatedProcedure
    .input(createTimeEntrySchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TimeEntryService(ctx.serviceContext);
      return service.create(input);
    }),

  update: authenticatedProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: updateTimeEntrySchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new TimeEntryService(ctx.serviceContext);
      return service.update(input.id, input.data);
    }),

  delete: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new TimeEntryService(ctx.serviceContext);
      await service.delete(input.id);
      return { success: true };
    }),

  submit: authenticatedProcedure
    .input(submitTimeEntriesSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TimeEntryService(ctx.serviceContext);
      return service.submit(input);
    }),

  approve: authenticatedProcedure
    .input(approveTimeEntriesSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TimeEntryService(ctx.serviceContext);
      return service.approve(input);
    }),

  reject: authenticatedProcedure
    .input(rejectTimeEntriesSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TimeEntryService(ctx.serviceContext);
      return service.reject(input);
    }),

  // ... remaining procedures unchanged
});
```

### Step 3: Refactor projects.ts

```typescript
// packages/trpc/src/routers/projects.ts

import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { ProjectService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';
import {
  projectStatusEnum,
  createProjectSchema,
  updateProjectSchema,
  projectFiltersSchema,
  createParticipantSchema,
  updateParticipantSchema,
} from '@glapi/types';

export const projectsRouter = router({
  list: authenticatedProcedure
    .input(z.object({
      page: z.number().int().positive().optional(),
      limit: z.number().int().positive().max(100).optional(),
      orderBy: z.enum(['name', 'projectCode', 'status', 'startDate', 'createdAt']).optional(),
      orderDirection: z.enum(['asc', 'desc']).optional(),
      filters: projectFiltersSchema,
    }).optional())
    .query(async ({ ctx, input }) => {
      const service = new ProjectService(ctx.serviceContext);
      return service.listProjects(
        {
          page: input?.page,
          limit: input?.limit,
          orderBy: input?.orderBy,
          orderDirection: input?.orderDirection,
        },
        input?.filters || {}
      );
    }),

  create: authenticatedProcedure
    .input(createProjectSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectService(ctx.serviceContext);
      // ... error handling unchanged
    }),

  update: authenticatedProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: updateProjectSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectService(ctx.serviceContext);
      // ... error handling unchanged
    }),

  addParticipant: authenticatedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      data: createParticipantSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      // ...
    }),

  updateParticipant: authenticatedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      participantId: z.string().uuid(),
      data: updateParticipantSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      // ...
    }),

  // ... rest unchanged
});
```

### Step 4: Repeat for Remaining Routers

Follow the same pattern for:
- `customers.ts`
- `invoices.ts`
- `payments.ts`
- `items.ts`
- And remaining routers

---

## Verification Checklist

For each router:
- [ ] Removed local schema definitions
- [ ] Added imports from `@glapi/types`
- [ ] Verified procedure inputs use imported schemas
- [ ] Type-check passes
- [ ] Existing tests pass

### Final Verification

```bash
# Full type check
pnpm --filter @glapi/trpc type-check

# Run all tests
pnpm --filter @glapi/trpc test

# Build all packages
pnpm build

# Generate OpenAPI (should still work)
pnpm --filter @glapi/trpc generate-openapi
```

---

## Potential Issues and Solutions

### Issue 1: Schema Shape Mismatch

**Problem**: Router expects `.optional()` but imported schema doesn't have it.

**Solution**: Use `.optional()` wrapper in the router:

```typescript
// Instead of: .input(timeEntryFiltersSchema)
// Use: .input(timeEntryFiltersSchema.optional())
```

### Issue 2: Default Values Differ

**Problem**: Router had different defaults than centralized schema.

**Solution**: Ensure centralized schema has correct defaults or apply in router:

```typescript
.input(createTimeEntrySchema.extend({
  // Override specific defaults if needed
  isBillable: z.boolean().default(false), // Different default for this context
}))
```

### Issue 3: Extra Fields in Router

**Problem**: Router schema had extra fields not in centralized schema.

**Solution**: Extend the centralized schema:

```typescript
const routerSpecificSchema = createTimeEntrySchema.extend({
  customRouterField: z.string().optional(),
});
```

---

## Rollback Plan

If critical issues arise:
1. Revert changes to router files
2. Keep `@glapi/types` package (doesn't break anything)
3. Fix issues and retry

---

## Git Commit

```
refactor(trpc): use @glapi/types for schema definitions

- Remove duplicated schemas from time-entries router
- Remove duplicated schemas from projects router
- Remove duplicated schemas from customers router
- Remove duplicated schemas from invoices router
- Import all validation schemas from @glapi/types
- Add @glapi/types as workspace dependency
- Maintain all existing functionality and tests

BREAKING CHANGE: None - API behavior unchanged

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```
