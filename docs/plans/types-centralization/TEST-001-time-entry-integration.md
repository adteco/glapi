# TEST-001: Time Entry Integration Tests

## Task Overview

**Description**: Create comprehensive integration tests for the time entry creation flow, testing the full path from frontend validation through TRPC, service layer, to database persistence.

**Layer**: Integration Testing

**Estimated Time**: 4 hours

**Dependencies**: TYPES-010

**Blocks**: TEST-004

---

## Acceptance Criteria

- [ ] Test creates time entries via TRPC caller
- [ ] Test validates input using centralized schemas
- [ ] Test verifies data persists correctly to database
- [ ] Test covers happy path and error cases
- [ ] Test covers all time entry types (REGULAR, OVERTIME, etc.)
- [ ] Test covers billable and non-billable entries
- [ ] Test covers project assignment validation
- [ ] Test uses test database isolation
- [ ] All tests pass in CI environment

---

## Test Scenarios

### Scenario 1: Create Basic Time Entry (Happy Path)
- Create a time entry with minimal required fields
- Verify entry is saved with correct status (DRAFT)
- Verify timestamps are set

### Scenario 2: Create Time Entry with Full Data
- Create entry with all optional fields populated
- Verify all fields persist correctly
- Verify computed fields (totalCost, laborCost) are calculated

### Scenario 3: Create Time Entry with Project Assignment
- Create entry linked to a project
- Verify project reference is valid
- Verify cost code reference (if provided) is valid

### Scenario 4: Validation Error - Invalid Date Format
- Attempt to create entry with wrong date format
- Verify Zod validation error is returned
- Verify no database entry is created

### Scenario 5: Validation Error - Invalid Hours
- Attempt to create entry with non-numeric hours
- Verify validation fails

### Scenario 6: Create Multiple Time Entry Types
- Create entries for each type: REGULAR, OVERTIME, DOUBLE_TIME, PTO, SICK, HOLIDAY, OTHER
- Verify each type is correctly persisted

### Scenario 7: List Time Entries with Filters
- Create multiple entries
- List with date range filter
- List with status filter
- List with employee filter
- Verify filtering works correctly

### Scenario 8: Update Time Entry (DRAFT status only)
- Create a draft entry
- Update hours and description
- Verify changes persist

### Scenario 9: Delete Time Entry (DRAFT status only)
- Create a draft entry
- Delete the entry
- Verify entry is removed

### Scenario 10: Attempt to Modify Non-Draft Entry
- Create entry and submit it
- Attempt to update
- Verify update is rejected

---

## TDD Implementation

### Test File Location
`packages/integration-tests/__tests__/time-entry-creation.test.ts`

### Test Setup

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { TestDatabase } from '../helpers/test-database';
import { TestDataGenerator } from '../helpers/test-data-generator';
import { createCallerFactory } from '@glapi/trpc';
import { appRouter } from '@glapi/trpc';
import {
  createTimeEntrySchema,
  TimeEntryStatusEnum,
  TimeEntryTypeEnum,
  type CreateTimeEntryInput,
} from '@glapi/types';

describe('Time Entry Creation Integration Tests', () => {
  let testDb: TestDatabase;
  let dataGenerator: TestDataGenerator;
  let organizationId: string;
  let employeeId: string;
  let projectId: string;
  let costCodeId: string;
  let caller: ReturnType<typeof createCallerFactory>;

  beforeAll(async () => {
    testDb = new TestDatabase();
    await testDb.setup();

    dataGenerator = new TestDataGenerator(testDb.db);

    // Create test organization and employee
    const organization = await dataGenerator.createOrganization();
    const employee = await dataGenerator.createEmployee(organization.id);
    const project = await dataGenerator.createProject(organization.id);
    const costCode = await dataGenerator.createCostCode(organization.id, project.id);

    organizationId = organization.id;
    employeeId = employee.id;
    projectId = project.id;
    costCodeId = costCode.id;

    // Create TRPC caller with test context
    const createCaller = createCallerFactory(appRouter);
    caller = createCaller({
      organizationId,
      userId: employeeId,
      userName: 'Test User',
      serviceContext: {
        organizationId,
        userId: employeeId,
        userName: 'Test User',
      },
    });
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  beforeEach(async () => {
    // Clear time entries between tests
    await testDb.clearTimeEntries();
  });

  describe('Basic Time Entry Creation', () => {
    it('should create a time entry with minimal fields', async () => {
      const input: CreateTimeEntryInput = {
        entryDate: '2024-01-15',
        hours: '8.00',
      };

      // Validate input matches schema
      const validationResult = createTimeEntrySchema.safeParse(input);
      expect(validationResult.success).toBe(true);

      // Create via TRPC
      const result = await caller.timeEntries.create(input);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.entryDate).toBe('2024-01-15');
      expect(result.hours).toBe('8.00');
      expect(result.status).toBe('DRAFT');
      expect(result.entryType).toBe('REGULAR'); // Default
      expect(result.isBillable).toBe(true); // Default
      expect(result.organizationId).toBe(organizationId);
    });

    it('should create a time entry with all fields', async () => {
      const input: CreateTimeEntryInput = {
        employeeId,
        projectId,
        costCodeId,
        entryDate: '2024-01-15',
        hours: '8.50',
        entryType: 'REGULAR',
        description: 'Development work on feature X',
        internalNotes: 'Internal note for managers',
        isBillable: true,
        externalId: 'ext-123',
        externalSource: 'TimeTracker',
        metadata: { taskId: 'TASK-001' },
      };

      const result = await caller.timeEntries.create(input);

      expect(result.employeeId).toBe(employeeId);
      expect(result.projectId).toBe(projectId);
      expect(result.costCodeId).toBe(costCodeId);
      expect(result.hours).toBe('8.50');
      expect(result.entryType).toBe('REGULAR');
      expect(result.description).toBe('Development work on feature X');
      expect(result.internalNotes).toBe('Internal note for managers');
      expect(result.isBillable).toBe(true);
      expect(result.externalId).toBe('ext-123');
      expect(result.externalSource).toBe('TimeTracker');
      expect(result.metadata).toEqual({ taskId: 'TASK-001' });
    });
  });

  describe('Time Entry Types', () => {
    const entryTypes = ['REGULAR', 'OVERTIME', 'DOUBLE_TIME', 'PTO', 'SICK', 'HOLIDAY', 'OTHER'] as const;

    entryTypes.forEach((entryType) => {
      it(`should create ${entryType} time entry`, async () => {
        const input: CreateTimeEntryInput = {
          entryDate: '2024-01-15',
          hours: '8.00',
          entryType,
        };

        const result = await caller.timeEntries.create(input);

        expect(result.entryType).toBe(entryType);
      });
    });
  });

  describe('Billable vs Non-Billable', () => {
    it('should create a non-billable time entry', async () => {
      const input: CreateTimeEntryInput = {
        entryDate: '2024-01-15',
        hours: '4.00',
        isBillable: false,
        description: 'Internal meeting',
      };

      const result = await caller.timeEntries.create(input);

      expect(result.isBillable).toBe(false);
    });

    it('should default to billable when not specified', async () => {
      const input: CreateTimeEntryInput = {
        entryDate: '2024-01-15',
        hours: '8.00',
      };

      const result = await caller.timeEntries.create(input);

      expect(result.isBillable).toBe(true);
    });
  });

  describe('Validation Errors', () => {
    it('should reject invalid date format', async () => {
      const input = {
        entryDate: '01/15/2024', // Wrong format
        hours: '8.00',
      };

      // Schema validation should fail
      const validationResult = createTimeEntrySchema.safeParse(input);
      expect(validationResult.success).toBe(false);

      // TRPC should also reject
      await expect(caller.timeEntries.create(input as any)).rejects.toThrow();
    });

    it('should reject invalid hours format', async () => {
      const input = {
        entryDate: '2024-01-15',
        hours: 'eight',
      };

      const validationResult = createTimeEntrySchema.safeParse(input);
      expect(validationResult.success).toBe(false);
    });

    it('should reject negative hours', async () => {
      const input = {
        entryDate: '2024-01-15',
        hours: '-8.00',
      };

      const validationResult = createTimeEntrySchema.safeParse(input);
      expect(validationResult.success).toBe(false);
    });

    it('should reject invalid entry type', async () => {
      const input = {
        entryDate: '2024-01-15',
        hours: '8.00',
        entryType: 'INVALID_TYPE',
      };

      const validationResult = createTimeEntrySchema.safeParse(input);
      expect(validationResult.success).toBe(false);
    });

    it('should reject description over 500 characters', async () => {
      const input = {
        entryDate: '2024-01-15',
        hours: '8.00',
        description: 'a'.repeat(501),
      };

      const validationResult = createTimeEntrySchema.safeParse(input);
      expect(validationResult.success).toBe(false);
    });
  });

  describe('List Time Entries', () => {
    it('should list time entries for the organization', async () => {
      // Create multiple entries
      await caller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });
      await caller.timeEntries.create({
        entryDate: '2024-01-16',
        hours: '7.00',
      });

      const result = await caller.timeEntries.list();

      expect(result.data.length).toBe(2);
      expect(result.total).toBe(2);
    });

    it('should filter by date range', async () => {
      await caller.timeEntries.create({
        entryDate: '2024-01-10',
        hours: '8.00',
      });
      await caller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });
      await caller.timeEntries.create({
        entryDate: '2024-01-20',
        hours: '8.00',
      });

      const result = await caller.timeEntries.list({
        filters: {
          startDate: '2024-01-14',
          endDate: '2024-01-16',
        },
      });

      expect(result.data.length).toBe(1);
      expect(result.data[0].entryDate).toBe('2024-01-15');
    });

    it('should filter by status', async () => {
      const entry1 = await caller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });
      await caller.timeEntries.create({
        entryDate: '2024-01-16',
        hours: '8.00',
      });

      // Submit first entry
      await caller.timeEntries.submit({
        timeEntryIds: [entry1.id],
      });

      const draftResult = await caller.timeEntries.list({
        filters: {
          status: 'DRAFT',
        },
      });

      expect(draftResult.data.length).toBe(1);

      const submittedResult = await caller.timeEntries.list({
        filters: {
          status: 'SUBMITTED',
        },
      });

      expect(submittedResult.data.length).toBe(1);
    });
  });

  describe('Update Time Entry', () => {
    it('should update a draft time entry', async () => {
      const created = await caller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
        description: 'Original description',
      });

      const updated = await caller.timeEntries.update({
        id: created.id,
        data: {
          hours: '10.00',
          description: 'Updated description',
        },
      });

      expect(updated.hours).toBe('10.00');
      expect(updated.description).toBe('Updated description');
    });

    it('should not update a submitted time entry', async () => {
      const created = await caller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });

      await caller.timeEntries.submit({
        timeEntryIds: [created.id],
      });

      await expect(
        caller.timeEntries.update({
          id: created.id,
          data: { hours: '10.00' },
        })
      ).rejects.toThrow();
    });
  });

  describe('Delete Time Entry', () => {
    it('should delete a draft time entry', async () => {
      const created = await caller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });

      const deleteResult = await caller.timeEntries.delete({ id: created.id });
      expect(deleteResult.success).toBe(true);

      // Verify it's gone
      await expect(
        caller.timeEntries.getById({ id: created.id })
      ).rejects.toThrow('NOT_FOUND');
    });

    it('should not delete a submitted time entry', async () => {
      const created = await caller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });

      await caller.timeEntries.submit({
        timeEntryIds: [created.id],
      });

      await expect(
        caller.timeEntries.delete({ id: created.id })
      ).rejects.toThrow();
    });
  });

  describe('Database Persistence', () => {
    it('should persist time entry to database', async () => {
      const input: CreateTimeEntryInput = {
        entryDate: '2024-01-15',
        hours: '8.00',
      };

      const result = await caller.timeEntries.create(input);

      // Verify directly in database
      const dbEntry = await testDb.getTimeEntryById(result.id);

      expect(dbEntry).toBeDefined();
      expect(dbEntry.entryDate).toBe('2024-01-15');
      expect(dbEntry.hours).toBe('8.00');
      expect(dbEntry.organizationId).toBe(organizationId);
    });
  });
});
```

---

## Test Helpers Required

### TestDatabase Helper

```typescript
// packages/integration-tests/helpers/test-database.ts

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@glapi/database';

export class TestDatabase {
  private client: ReturnType<typeof postgres>;
  db: ReturnType<typeof drizzle>;

  async setup() {
    const connectionString = process.env.TEST_DATABASE_URL
      ?? 'postgresql://localhost:5432/glapi_test';

    this.client = postgres(connectionString);
    this.db = drizzle(this.client, { schema });
  }

  async cleanup() {
    await this.client.end();
  }

  async clearTimeEntries() {
    await this.db.delete(schema.timeEntries);
  }

  async getTimeEntryById(id: string) {
    const [entry] = await this.db
      .select()
      .from(schema.timeEntries)
      .where(eq(schema.timeEntries.id, id));
    return entry;
  }
}
```

---

## CI Configuration

Ensure the test database is available in CI:

```yaml
# .github/workflows/test.yml
jobs:
  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: glapi_test
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm --filter @glapi/integration-tests test
        env:
          TEST_DATABASE_URL: postgresql://test:test@localhost:5432/glapi_test
```

---

## Git Commit

```
test(integration): add time entry creation flow tests

- Add comprehensive tests for time entry CRUD operations
- Test validation using @glapi/types schemas
- Test all time entry types (REGULAR, OVERTIME, etc.)
- Test billable vs non-billable entries
- Test filtering and listing
- Add database persistence verification
- Add test helpers for database setup/cleanup

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```
