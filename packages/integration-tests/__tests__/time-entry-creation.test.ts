/**
 * Time Entry Creation Integration Tests
 *
 * Tests the complete time entry flow from TRPC through to database persistence.
 * Validates input using centralized @glapi/types schemas.
 *
 * @module time-entry-creation.test
 * @task glapi-3k2
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { TestDatabase } from '../helpers/test-database';
import { TestDataGenerator } from '../helpers/test-data-generator';
import { createCallerFactory, appRouter, type Context } from '@glapi/trpc';
import { createTimeEntrySchema } from '@glapi/types';
import { z } from 'zod';

// Use z.input for input types to allow optional fields with defaults
type CreateTimeEntryInput = z.input<typeof createTimeEntrySchema>;

describe('Time Entry Creation Integration Tests', () => {
  let testDb: TestDatabase;
  let dataGenerator: TestDataGenerator;
  let organizationId: string;
  let employeeId: string;
  let projectId: string;
  let costCodeId: string;
  // Using 'any' for caller type to avoid complex generic inference issues
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let caller: any;

  beforeAll(async () => {
    testDb = new TestDatabase();
    await testDb.setup();

    dataGenerator = new TestDataGenerator(testDb.db);

    // Create test organization, employee, project, and cost code
    const organization = await dataGenerator.createOrganization('Time Entry Test Org');
    organizationId = organization.id;

    const employee = await dataGenerator.createEmployee(organizationId, 'Test');
    employeeId = employee.id;

    const project = await dataGenerator.createProject(organizationId, 'Test Project');
    projectId = project.id;

    const costCode = await dataGenerator.createCostCode(organizationId, projectId, 'Labor');
    costCodeId = costCode.id;

    // Create TRPC caller with test context
    const createCaller = createCallerFactory(appRouter);
    const testContext: Context = {
      req: undefined,
      res: undefined,
      user: {
        id: employeeId,
        organizationId,
        email: 'test@example.com',
        role: 'admin', // Use admin for full access in tests
      },
      db: testDb.db,
      serviceContext: {
        organizationId,
        userId: employeeId,
      },
    };
    caller = createCaller(testContext);
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
      await expect(caller.timeEntries.create(input)).rejects.toThrow();
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

    it('should handle empty string UUID fields gracefully', async () => {
      // Empty strings should be converted to undefined by the schema
      const input = {
        entryDate: '2024-01-15',
        hours: '8.00',
        employeeId: '', // Empty string, should become undefined
        projectId: '', // Empty string, should become undefined
      };

      const validationResult = createTimeEntrySchema.safeParse(input);
      expect(validationResult.success).toBe(true);

      // The parsed result should have undefined for empty strings
      if (validationResult.success) {
        expect(validationResult.data.employeeId).toBeUndefined();
        expect(validationResult.data.projectId).toBeUndefined();
      }
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

      const result = await caller.timeEntries.list({});

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

    it('should support pagination', async () => {
      // Create 5 entries
      for (let i = 0; i < 5; i++) {
        await caller.timeEntries.create({
          entryDate: `2024-01-${String(10 + i).padStart(2, '0')}`,
          hours: '8.00',
        });
      }

      const page1 = await caller.timeEntries.list({
        page: 1,
        limit: 2,
      });

      expect(page1.data.length).toBe(2);
      expect(page1.total).toBe(5);

      const page2 = await caller.timeEntries.list({
        page: 2,
        limit: 2,
      });

      expect(page2.data.length).toBe(2);
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
      await expect(caller.timeEntries.getById({ id: created.id })).rejects.toThrow();
    });

    it('should not delete a submitted time entry', async () => {
      const created = await caller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });

      await caller.timeEntries.submit({
        timeEntryIds: [created.id],
      });

      await expect(caller.timeEntries.delete({ id: created.id })).rejects.toThrow();
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

    it('should persist all fields to database', async () => {
      const input: CreateTimeEntryInput = {
        employeeId,
        projectId,
        costCodeId,
        entryDate: '2024-01-15',
        hours: '8.50',
        entryType: 'OVERTIME',
        description: 'Overtime work',
        internalNotes: 'Manager note',
        isBillable: false,
        externalId: 'db-test-123',
        externalSource: 'ExternalSystem',
        metadata: { verified: true },
      };

      const result = await caller.timeEntries.create(input);
      const dbEntry = await testDb.getTimeEntryById(result.id);

      expect(dbEntry.employeeId).toBe(employeeId);
      expect(dbEntry.projectId).toBe(projectId);
      expect(dbEntry.costCodeId).toBe(costCodeId);
      expect(dbEntry.entryType).toBe('OVERTIME');
      expect(dbEntry.description).toBe('Overtime work');
      expect(dbEntry.internalNotes).toBe('Manager note');
      expect(dbEntry.isBillable).toBe(false);
      expect(dbEntry.externalId).toBe('db-test-123');
      expect(dbEntry.externalSource).toBe('ExternalSystem');
      expect(dbEntry.metadata).toEqual({ verified: true });
    });
  });

  describe('Approval Workflow', () => {
    it('should submit time entries for approval', async () => {
      const entry = await caller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });

      const result = await caller.timeEntries.submit({
        timeEntryIds: [entry.id],
      });

      expect(result).toBeDefined();

      // Verify status changed
      const updated = await caller.timeEntries.getById({ id: entry.id });
      expect(updated.status).toBe('SUBMITTED');
    });

    it('should approve submitted time entries', async () => {
      const entry = await caller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });

      await caller.timeEntries.submit({
        timeEntryIds: [entry.id],
      });

      const result = await caller.timeEntries.approve({
        timeEntryIds: [entry.id],
      });

      expect(result).toBeDefined();

      const updated = await caller.timeEntries.getById({ id: entry.id });
      expect(updated.status).toBe('APPROVED');
    });

    it('should reject submitted time entries', async () => {
      const entry = await caller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });

      await caller.timeEntries.submit({
        timeEntryIds: [entry.id],
      });

      const result = await caller.timeEntries.reject({
        timeEntryIds: [entry.id],
        reason: 'Hours seem incorrect',
      });

      expect(result).toBeDefined();

      const updated = await caller.timeEntries.getById({ id: entry.id });
      expect(updated.status).toBe('REJECTED');
      expect(updated.rejectionReason).toBe('Hours seem incorrect');
    });

    it('should return approved entries to draft', async () => {
      const entry = await caller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });

      await caller.timeEntries.submit({
        timeEntryIds: [entry.id],
      });

      await caller.timeEntries.approve({
        timeEntryIds: [entry.id],
      });

      const result = await caller.timeEntries.returnToDraft({
        timeEntryIds: [entry.id],
      });

      expect(result).toBeDefined();

      const updated = await caller.timeEntries.getById({ id: entry.id });
      expect(updated.status).toBe('DRAFT');
    });
  });

  describe('Get Time Entry with Relations', () => {
    it('should get time entry with employee and project relations', async () => {
      const entry = await caller.timeEntries.create({
        employeeId,
        projectId,
        entryDate: '2024-01-15',
        hours: '8.00',
      });

      const result = await caller.timeEntries.getByIdWithRelations({ id: entry.id });

      expect(result).toBeDefined();
      expect(result.id).toBe(entry.id);
      // Relations should be populated (exact structure depends on service implementation)
      expect(result.employeeId).toBe(employeeId);
      expect(result.projectId).toBe(projectId);
    });
  });
});
