/**
 * Time Entry Approval Workflow Integration Tests
 *
 * Tests the complete approval lifecycle: DRAFT -> SUBMITTED -> APPROVED/REJECTED -> POSTED
 * Validates status transitions, permissions, and workflow constraints.
 *
 * @module time-entry-approval-workflow.test
 * @task glapi-4mg
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { TestDatabase } from '../helpers/test-database';
import { TestDataGenerator } from '../helpers/test-data-generator';
import { createCallerFactory, appRouter, type Context } from '@glapi/trpc';
import {
  submitTimeEntriesSchema,
  approveTimeEntriesSchema,
  rejectTimeEntriesSchema,
  VALID_TIME_ENTRY_STATUS_TRANSITIONS,
} from '@glapi/types';

describe('Time Entry Approval Workflow Integration Tests', () => {
  let testDb: TestDatabase;
  let dataGenerator: TestDataGenerator;
  let organizationId: string;
  let employeeId: string;
  let approverId: string;
  let projectId: string;
  let costCodeId: string;
  // Using 'any' for caller type to avoid complex generic inference issues
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let employeeCaller: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let approverCaller: any;

  beforeAll(async () => {
    testDb = new TestDatabase();
    await testDb.setup();

    dataGenerator = new TestDataGenerator(testDb.db);

    // Create test organization
    const organization = await dataGenerator.createOrganization('Approval Workflow Test Org');
    organizationId = organization.id;

    // Create employee (regular user)
    const employee = await dataGenerator.createEmployee(organizationId, 'Employee');
    employeeId = employee.id;

    // Create approver (admin user)
    const approver = await dataGenerator.createEmployee(organizationId, 'Approver');
    approverId = approver.id;

    // Create project and cost code
    const project = await dataGenerator.createProject(organizationId, 'Workflow Test Project');
    projectId = project.id;

    const costCode = await dataGenerator.createCostCode(organizationId, projectId, 'Labor');
    costCodeId = costCode.id;

    // Create TRPC callers for different users
    const createCaller = createCallerFactory(appRouter);

    // Employee caller (regular user)
    const employeeContext: Context = {
      req: undefined,
      res: undefined,
      user: {
        id: employeeId,
        organizationId,
        email: 'employee@example.com',
        role: 'user',
      },
      db: testDb.db,
      serviceContext: {
        organizationId,
        userId: employeeId,
      },
    };
    employeeCaller = createCaller(employeeContext);

    // Approver caller (admin user)
    const approverContext: Context = {
      req: undefined,
      res: undefined,
      user: {
        id: approverId,
        organizationId,
        email: 'approver@example.com',
        role: 'admin',
      },
      db: testDb.db,
      serviceContext: {
        organizationId,
        userId: approverId,
      },
    };
    approverCaller = createCaller(approverContext);
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  beforeEach(async () => {
    await testDb.clearTimeEntries();
  });

  describe('Submit Workflow', () => {
    it('should submit a single time entry', async () => {
      const entry = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });

      expect(entry.status).toBe('DRAFT');

      const result = await employeeCaller.timeEntries.submit({
        timeEntryIds: [entry.id],
      });

      expect(result).toBeDefined();

      // Fetch and verify
      const updated = await employeeCaller.timeEntries.getById({ id: entry.id });
      expect(updated.status).toBe('SUBMITTED');
      expect(updated.submittedAt).toBeDefined();
      expect(updated.submittedBy).toBe(employeeId);
    });

    it('should submit multiple time entries in batch', async () => {
      const entry1 = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });
      const entry2 = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-16',
        hours: '7.00',
      });
      const entry3 = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-17',
        hours: '8.50',
      });

      const result = await employeeCaller.timeEntries.submit({
        timeEntryIds: [entry1.id, entry2.id, entry3.id],
        comments: 'Weekly submission',
      });

      expect(result).toBeDefined();

      // Verify all are submitted
      const list = await employeeCaller.timeEntries.list({
        filters: { status: 'SUBMITTED' },
      });
      expect(list.data.length).toBe(3);
    });

    it('should not submit an already submitted entry', async () => {
      const entry = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });

      await employeeCaller.timeEntries.submit({
        timeEntryIds: [entry.id],
      });

      // Second submit should fail
      await expect(
        employeeCaller.timeEntries.submit({
          timeEntryIds: [entry.id],
        })
      ).rejects.toThrow();
    });

    it('should validate submit input schema', () => {
      // Require at least one ID
      const emptyResult = submitTimeEntriesSchema.safeParse({
        timeEntryIds: [],
      });
      expect(emptyResult.success).toBe(false);

      // Valid input
      const validResult = submitTimeEntriesSchema.safeParse({
        timeEntryIds: ['550e8400-e29b-41d4-a716-446655440000'],
        comments: 'Test submission',
      });
      expect(validResult.success).toBe(true);
    });

    it('should record submission timestamp', async () => {
      const entry = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });

      const beforeSubmit = new Date();
      await employeeCaller.timeEntries.submit({
        timeEntryIds: [entry.id],
      });
      const afterSubmit = new Date();

      const updated = await employeeCaller.timeEntries.getById({ id: entry.id });
      const submittedAt = new Date(updated.submittedAt);

      expect(submittedAt.getTime()).toBeGreaterThanOrEqual(beforeSubmit.getTime() - 1000);
      expect(submittedAt.getTime()).toBeLessThanOrEqual(afterSubmit.getTime() + 1000);
    });
  });

  describe('Approval Workflow', () => {
    it('should approve a submitted time entry', async () => {
      const entry = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });

      await employeeCaller.timeEntries.submit({
        timeEntryIds: [entry.id],
      });

      // Approver approves
      const result = await approverCaller.timeEntries.approve({
        timeEntryIds: [entry.id],
        comments: 'Approved',
      });

      expect(result).toBeDefined();

      const updated = await approverCaller.timeEntries.getById({ id: entry.id });
      expect(updated.status).toBe('APPROVED');
      expect(updated.approvedAt).toBeDefined();
      expect(updated.approvedBy).toBe(approverId);
    });

    it('should approve multiple entries in batch', async () => {
      const entries = await Promise.all([
        employeeCaller.timeEntries.create({ entryDate: '2024-01-15', hours: '8.00' }),
        employeeCaller.timeEntries.create({ entryDate: '2024-01-16', hours: '8.00' }),
        employeeCaller.timeEntries.create({ entryDate: '2024-01-17', hours: '8.00' }),
      ]);

      await employeeCaller.timeEntries.submit({
        timeEntryIds: entries.map((e) => e.id),
      });

      await approverCaller.timeEntries.approve({
        timeEntryIds: entries.map((e) => e.id),
      });

      const list = await approverCaller.timeEntries.list({
        filters: { status: 'APPROVED' },
      });
      expect(list.data.length).toBe(3);
    });

    it('should not approve a draft entry', async () => {
      const entry = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });

      // Attempt to approve without submitting first
      await expect(
        approverCaller.timeEntries.approve({
          timeEntryIds: [entry.id],
        })
      ).rejects.toThrow();
    });

    it('should validate approve input schema', () => {
      // Require at least one ID
      const emptyResult = approveTimeEntriesSchema.safeParse({
        timeEntryIds: [],
      });
      expect(emptyResult.success).toBe(false);

      // Valid input
      const validResult = approveTimeEntriesSchema.safeParse({
        timeEntryIds: ['550e8400-e29b-41d4-a716-446655440000'],
        comments: 'Looks good',
      });
      expect(validResult.success).toBe(true);
    });

    it('should record approval timestamp', async () => {
      const entry = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });

      await employeeCaller.timeEntries.submit({
        timeEntryIds: [entry.id],
      });

      const beforeApprove = new Date();
      await approverCaller.timeEntries.approve({
        timeEntryIds: [entry.id],
      });
      const afterApprove = new Date();

      const updated = await approverCaller.timeEntries.getById({ id: entry.id });
      const approvedAt = new Date(updated.approvedAt);

      expect(approvedAt.getTime()).toBeGreaterThanOrEqual(beforeApprove.getTime() - 1000);
      expect(approvedAt.getTime()).toBeLessThanOrEqual(afterApprove.getTime() + 1000);
    });
  });

  describe('Rejection Workflow', () => {
    it('should reject a submitted time entry with reason', async () => {
      const entry = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });

      await employeeCaller.timeEntries.submit({
        timeEntryIds: [entry.id],
      });

      const result = await approverCaller.timeEntries.reject({
        timeEntryIds: [entry.id],
        reason: 'Hours seem incorrect, please verify',
      });

      expect(result).toBeDefined();

      const updated = await approverCaller.timeEntries.getById({ id: entry.id });
      expect(updated.status).toBe('REJECTED');
      expect(updated.rejectedAt).toBeDefined();
      expect(updated.rejectedBy).toBe(approverId);
      expect(updated.rejectionReason).toBe('Hours seem incorrect, please verify');
    });

    it('should require rejection reason', () => {
      // Schema validation - empty reason
      const emptyReasonResult = rejectTimeEntriesSchema.safeParse({
        timeEntryIds: ['550e8400-e29b-41d4-a716-446655440000'],
        reason: '',
      });
      expect(emptyReasonResult.success).toBe(false);

      // Schema validation - missing reason
      const noReasonResult = rejectTimeEntriesSchema.safeParse({
        timeEntryIds: ['550e8400-e29b-41d4-a716-446655440000'],
      });
      expect(noReasonResult.success).toBe(false);
    });

    it('should reject multiple entries in batch', async () => {
      const entries = await Promise.all([
        employeeCaller.timeEntries.create({ entryDate: '2024-01-15', hours: '8.00' }),
        employeeCaller.timeEntries.create({ entryDate: '2024-01-16', hours: '8.00' }),
      ]);

      await employeeCaller.timeEntries.submit({
        timeEntryIds: entries.map((e) => e.id),
      });

      await approverCaller.timeEntries.reject({
        timeEntryIds: entries.map((e) => e.id),
        reason: 'Need more details for all entries',
      });

      const list = await approverCaller.timeEntries.list({
        filters: { status: 'REJECTED' },
      });
      expect(list.data.length).toBe(2);

      // All should have the same rejection reason
      for (const entry of list.data) {
        expect(entry.rejectionReason).toBe('Need more details for all entries');
      }
    });

    it('should allow resubmission after rejection', async () => {
      const entry = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });

      await employeeCaller.timeEntries.submit({
        timeEntryIds: [entry.id],
      });

      await approverCaller.timeEntries.reject({
        timeEntryIds: [entry.id],
        reason: 'Wrong project',
      });

      // Employee fixes and returns to draft first
      await employeeCaller.timeEntries.returnToDraft({
        timeEntryIds: [entry.id],
      });

      // Then can update
      await employeeCaller.timeEntries.update({
        id: entry.id,
        data: { projectId },
      });

      // And resubmit
      await employeeCaller.timeEntries.submit({
        timeEntryIds: [entry.id],
      });

      const updated = await employeeCaller.timeEntries.getById({ id: entry.id });
      expect(updated.status).toBe('SUBMITTED');
      expect(updated.projectId).toBe(projectId);
    });
  });

  describe('Return to Draft', () => {
    it('should return approved entry to draft', async () => {
      const entry = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });

      await employeeCaller.timeEntries.submit({
        timeEntryIds: [entry.id],
      });

      await approverCaller.timeEntries.approve({
        timeEntryIds: [entry.id],
      });

      const result = await approverCaller.timeEntries.returnToDraft({
        timeEntryIds: [entry.id],
      });

      expect(result).toBeDefined();

      const updated = await employeeCaller.timeEntries.getById({ id: entry.id });
      expect(updated.status).toBe('DRAFT');
      // Approval fields should be cleared
      expect(updated.approvedAt).toBeNull();
      expect(updated.approvedBy).toBeNull();
    });

    it('should return submitted entry to draft', async () => {
      const entry = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });

      await employeeCaller.timeEntries.submit({
        timeEntryIds: [entry.id],
      });

      // Can return to draft from submitted state
      await employeeCaller.timeEntries.returnToDraft({
        timeEntryIds: [entry.id],
      });

      const updated = await employeeCaller.timeEntries.getById({ id: entry.id });
      expect(updated.status).toBe('DRAFT');
    });

    it('should return rejected entry to draft', async () => {
      const entry = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });

      await employeeCaller.timeEntries.submit({
        timeEntryIds: [entry.id],
      });

      await approverCaller.timeEntries.reject({
        timeEntryIds: [entry.id],
        reason: 'Need corrections',
      });

      await employeeCaller.timeEntries.returnToDraft({
        timeEntryIds: [entry.id],
      });

      const updated = await employeeCaller.timeEntries.getById({ id: entry.id });
      expect(updated.status).toBe('DRAFT');
    });

    it('should allow editing after return to draft', async () => {
      const entry = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });

      await employeeCaller.timeEntries.submit({
        timeEntryIds: [entry.id],
      });

      await approverCaller.timeEntries.approve({
        timeEntryIds: [entry.id],
      });

      await approverCaller.timeEntries.returnToDraft({
        timeEntryIds: [entry.id],
      });

      // Now employee can edit
      const updated = await employeeCaller.timeEntries.update({
        id: entry.id,
        data: { hours: '9.00' },
      });

      expect(updated.hours).toBe('9.00');
    });
  });

  describe('GL Posting', () => {
    it('should post approved entries to GL', async () => {
      const entry = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
        projectId,
      });

      await employeeCaller.timeEntries.submit({
        timeEntryIds: [entry.id],
      });

      await approverCaller.timeEntries.approve({
        timeEntryIds: [entry.id],
      });

      // Admin posts to GL
      const result = await approverCaller.timeEntries.postToGL({
        timeEntryIds: [entry.id],
      });

      expect(result).toBeDefined();
      expect(result.postedCount).toBe(1);
      expect(result.failedCount).toBe(0);

      const updated = await approverCaller.timeEntries.getById({ id: entry.id });
      expect(updated.status).toBe('POSTED');
      expect(updated.postedAt).toBeDefined();
    });

    it('should post multiple entries in batch', async () => {
      const entries = await Promise.all([
        employeeCaller.timeEntries.create({ entryDate: '2024-01-15', hours: '8.00', projectId }),
        employeeCaller.timeEntries.create({ entryDate: '2024-01-16', hours: '8.00', projectId }),
      ]);

      await employeeCaller.timeEntries.submit({
        timeEntryIds: entries.map((e) => e.id),
      });

      await approverCaller.timeEntries.approve({
        timeEntryIds: entries.map((e) => e.id),
      });

      const result = await approverCaller.timeEntries.postToGL({
        timeEntryIds: entries.map((e) => e.id),
      });

      expect(result.postedCount).toBe(2);

      const list = await approverCaller.timeEntries.list({
        filters: { status: 'POSTED' },
      });
      expect(list.data.length).toBe(2);
    });

    it('should not post non-approved entries', async () => {
      const entry = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });

      await employeeCaller.timeEntries.submit({
        timeEntryIds: [entry.id],
      });

      // Attempt to post without approval
      await expect(
        approverCaller.timeEntries.postToGL({
          timeEntryIds: [entry.id],
        })
      ).rejects.toThrow();
    });

    it('should not post draft entries', async () => {
      const entry = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });

      await expect(
        approverCaller.timeEntries.postToGL({
          timeEntryIds: [entry.id],
        })
      ).rejects.toThrow();
    });
  });

  describe('Posted Entry Immutability', () => {
    it('should not allow update of posted entry', async () => {
      const entry = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
        projectId,
      });

      await employeeCaller.timeEntries.submit({
        timeEntryIds: [entry.id],
      });

      await approverCaller.timeEntries.approve({
        timeEntryIds: [entry.id],
      });

      await approverCaller.timeEntries.postToGL({
        timeEntryIds: [entry.id],
      });

      // Cannot update
      await expect(
        employeeCaller.timeEntries.update({
          id: entry.id,
          data: { hours: '10.00' },
        })
      ).rejects.toThrow();
    });

    it('should not allow delete of posted entry', async () => {
      const entry = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
        projectId,
      });

      await employeeCaller.timeEntries.submit({
        timeEntryIds: [entry.id],
      });

      await approverCaller.timeEntries.approve({
        timeEntryIds: [entry.id],
      });

      await approverCaller.timeEntries.postToGL({
        timeEntryIds: [entry.id],
      });

      // Cannot delete
      await expect(employeeCaller.timeEntries.delete({ id: entry.id })).rejects.toThrow();
    });

    it('should not allow return to draft of posted entry', async () => {
      const entry = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
        projectId,
      });

      await employeeCaller.timeEntries.submit({
        timeEntryIds: [entry.id],
      });

      await approverCaller.timeEntries.approve({
        timeEntryIds: [entry.id],
      });

      await approverCaller.timeEntries.postToGL({
        timeEntryIds: [entry.id],
      });

      // Cannot return to draft
      await expect(
        approverCaller.timeEntries.returnToDraft({
          timeEntryIds: [entry.id],
        })
      ).rejects.toThrow();
    });

    it('should not allow resubmission of posted entry', async () => {
      const entry = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
        projectId,
      });

      await employeeCaller.timeEntries.submit({
        timeEntryIds: [entry.id],
      });

      await approverCaller.timeEntries.approve({
        timeEntryIds: [entry.id],
      });

      await approverCaller.timeEntries.postToGL({
        timeEntryIds: [entry.id],
      });

      // Cannot submit again
      await expect(
        employeeCaller.timeEntries.submit({
          timeEntryIds: [entry.id],
        })
      ).rejects.toThrow();
    });
  });

  describe('Status Transition Validation', () => {
    it('should validate status transitions match defined rules', () => {
      // DRAFT can transition to SUBMITTED or CANCELLED
      expect(VALID_TIME_ENTRY_STATUS_TRANSITIONS.DRAFT).toContain('SUBMITTED');
      expect(VALID_TIME_ENTRY_STATUS_TRANSITIONS.DRAFT).toContain('CANCELLED');
      expect(VALID_TIME_ENTRY_STATUS_TRANSITIONS.DRAFT).not.toContain('APPROVED');
      expect(VALID_TIME_ENTRY_STATUS_TRANSITIONS.DRAFT).not.toContain('POSTED');

      // SUBMITTED can transition to DRAFT, APPROVED, or REJECTED
      expect(VALID_TIME_ENTRY_STATUS_TRANSITIONS.SUBMITTED).toContain('DRAFT');
      expect(VALID_TIME_ENTRY_STATUS_TRANSITIONS.SUBMITTED).toContain('APPROVED');
      expect(VALID_TIME_ENTRY_STATUS_TRANSITIONS.SUBMITTED).toContain('REJECTED');
      expect(VALID_TIME_ENTRY_STATUS_TRANSITIONS.SUBMITTED).not.toContain('POSTED');

      // APPROVED can transition to POSTED or DRAFT
      expect(VALID_TIME_ENTRY_STATUS_TRANSITIONS.APPROVED).toContain('POSTED');
      expect(VALID_TIME_ENTRY_STATUS_TRANSITIONS.APPROVED).toContain('DRAFT');
      expect(VALID_TIME_ENTRY_STATUS_TRANSITIONS.APPROVED).not.toContain('REJECTED');

      // REJECTED can transition to DRAFT or CANCELLED
      expect(VALID_TIME_ENTRY_STATUS_TRANSITIONS.REJECTED).toContain('DRAFT');
      expect(VALID_TIME_ENTRY_STATUS_TRANSITIONS.REJECTED).toContain('CANCELLED');
      expect(VALID_TIME_ENTRY_STATUS_TRANSITIONS.REJECTED).not.toContain('APPROVED');

      // POSTED is terminal
      expect(VALID_TIME_ENTRY_STATUS_TRANSITIONS.POSTED).toHaveLength(0);

      // CANCELLED is terminal
      expect(VALID_TIME_ENTRY_STATUS_TRANSITIONS.CANCELLED).toHaveLength(0);
    });

    it('should reject approval of already approved entry', async () => {
      const entry = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });

      await employeeCaller.timeEntries.submit({
        timeEntryIds: [entry.id],
      });

      await approverCaller.timeEntries.approve({
        timeEntryIds: [entry.id],
      });

      // Second approval should fail
      await expect(
        approverCaller.timeEntries.approve({
          timeEntryIds: [entry.id],
        })
      ).rejects.toThrow();
    });

    it('should reject rejection of approved entry', async () => {
      const entry = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });

      await employeeCaller.timeEntries.submit({
        timeEntryIds: [entry.id],
      });

      await approverCaller.timeEntries.approve({
        timeEntryIds: [entry.id],
      });

      // Cannot reject after approval
      await expect(
        approverCaller.timeEntries.reject({
          timeEntryIds: [entry.id],
          reason: 'Too late',
        })
      ).rejects.toThrow();
    });
  });

  describe('Pending Approvals', () => {
    it('should list entries pending approval', async () => {
      // Create and submit entries
      const entry1 = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });
      const entry2 = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-16',
        hours: '8.00',
      });
      const entry3 = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-17',
        hours: '8.00',
      });

      // Submit first two
      await employeeCaller.timeEntries.submit({
        timeEntryIds: [entry1.id, entry2.id],
      });

      // Get pending approvals
      const pendingApprovals = await approverCaller.timeEntries.getPendingApprovals();

      expect(pendingApprovals.data.length).toBe(2);
      pendingApprovals.data.forEach((entry: { status: string }) => {
        expect(entry.status).toBe('SUBMITTED');
      });
    });

    it('should not include approved entries in pending approvals', async () => {
      const entry1 = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });
      const entry2 = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-16',
        hours: '8.00',
      });

      await employeeCaller.timeEntries.submit({
        timeEntryIds: [entry1.id, entry2.id],
      });

      // Approve one
      await approverCaller.timeEntries.approve({
        timeEntryIds: [entry1.id],
      });

      // Pending should only show the unapproved one
      const pendingApprovals = await approverCaller.timeEntries.getPendingApprovals();

      expect(pendingApprovals.data.length).toBe(1);
      expect(pendingApprovals.data[0].id).toBe(entry2.id);
    });

    it('should support pagination for pending approvals', async () => {
      // Create and submit 5 entries
      const entries = [];
      for (let i = 0; i < 5; i++) {
        const entry = await employeeCaller.timeEntries.create({
          entryDate: `2024-01-${String(15 + i).padStart(2, '0')}`,
          hours: '8.00',
        });
        entries.push(entry);
      }

      await employeeCaller.timeEntries.submit({
        timeEntryIds: entries.map((e) => e.id),
      });

      const page1 = await approverCaller.timeEntries.getPendingApprovals({
        page: 1,
        limit: 2,
      });

      expect(page1.data.length).toBe(2);
      expect(page1.total).toBe(5);

      const page2 = await approverCaller.timeEntries.getPendingApprovals({
        page: 2,
        limit: 2,
      });

      expect(page2.data.length).toBe(2);
    });
  });

  describe('Database Persistence of Workflow Fields', () => {
    it('should persist submission fields to database', async () => {
      const entry = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });

      await employeeCaller.timeEntries.submit({
        timeEntryIds: [entry.id],
      });

      const dbEntry = await testDb.getTimeEntryById(entry.id);

      expect(dbEntry.status).toBe('SUBMITTED');
      expect(dbEntry.submittedAt).toBeDefined();
      expect(dbEntry.submittedBy).toBe(employeeId);
    });

    it('should persist approval fields to database', async () => {
      const entry = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });

      await employeeCaller.timeEntries.submit({
        timeEntryIds: [entry.id],
      });

      await approverCaller.timeEntries.approve({
        timeEntryIds: [entry.id],
      });

      const dbEntry = await testDb.getTimeEntryById(entry.id);

      expect(dbEntry.status).toBe('APPROVED');
      expect(dbEntry.approvedAt).toBeDefined();
      expect(dbEntry.approvedBy).toBe(approverId);
    });

    it('should persist rejection fields to database', async () => {
      const entry = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });

      await employeeCaller.timeEntries.submit({
        timeEntryIds: [entry.id],
      });

      await approverCaller.timeEntries.reject({
        timeEntryIds: [entry.id],
        reason: 'Test rejection reason',
      });

      const dbEntry = await testDb.getTimeEntryById(entry.id);

      expect(dbEntry.status).toBe('REJECTED');
      expect(dbEntry.rejectedAt).toBeDefined();
      expect(dbEntry.rejectedBy).toBe(approverId);
      expect(dbEntry.rejectionReason).toBe('Test rejection reason');
    });

    it('should persist posted fields to database', async () => {
      const entry = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
        projectId,
      });

      await employeeCaller.timeEntries.submit({
        timeEntryIds: [entry.id],
      });

      await approverCaller.timeEntries.approve({
        timeEntryIds: [entry.id],
      });

      await approverCaller.timeEntries.postToGL({
        timeEntryIds: [entry.id],
      });

      const dbEntry = await testDb.getTimeEntryById(entry.id);

      expect(dbEntry.status).toBe('POSTED');
      expect(dbEntry.postedAt).toBeDefined();
    });

    it('should clear approval fields on return to draft', async () => {
      const entry = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });

      await employeeCaller.timeEntries.submit({
        timeEntryIds: [entry.id],
      });

      await approverCaller.timeEntries.approve({
        timeEntryIds: [entry.id],
      });

      await approverCaller.timeEntries.returnToDraft({
        timeEntryIds: [entry.id],
      });

      const dbEntry = await testDb.getTimeEntryById(entry.id);

      expect(dbEntry.status).toBe('DRAFT');
      expect(dbEntry.approvedAt).toBeNull();
      expect(dbEntry.approvedBy).toBeNull();
    });
  });

  describe('Full Workflow Cycle', () => {
    it('should complete full workflow from draft to posted', async () => {
      // 1. Create draft entry
      const entry = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
        projectId,
        costCodeId,
        description: 'Full workflow test',
      });

      expect(entry.status).toBe('DRAFT');

      // 2. Submit for approval
      await employeeCaller.timeEntries.submit({
        timeEntryIds: [entry.id],
      });

      let updated = await employeeCaller.timeEntries.getById({ id: entry.id });
      expect(updated.status).toBe('SUBMITTED');

      // 3. Approve
      await approverCaller.timeEntries.approve({
        timeEntryIds: [entry.id],
        comments: 'Approved for posting',
      });

      updated = await approverCaller.timeEntries.getById({ id: entry.id });
      expect(updated.status).toBe('APPROVED');

      // 4. Post to GL
      const postResult = await approverCaller.timeEntries.postToGL({
        timeEntryIds: [entry.id],
      });

      expect(postResult.postedCount).toBe(1);

      updated = await approverCaller.timeEntries.getById({ id: entry.id });
      expect(updated.status).toBe('POSTED');
      expect(updated.postedAt).toBeDefined();
    });

    it('should handle rejection and resubmission cycle', async () => {
      // 1. Create and submit
      const entry = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });

      await employeeCaller.timeEntries.submit({
        timeEntryIds: [entry.id],
      });

      // 2. Reject
      await approverCaller.timeEntries.reject({
        timeEntryIds: [entry.id],
        reason: 'Please add project',
      });

      let updated = await employeeCaller.timeEntries.getById({ id: entry.id });
      expect(updated.status).toBe('REJECTED');

      // 3. Return to draft
      await employeeCaller.timeEntries.returnToDraft({
        timeEntryIds: [entry.id],
      });

      updated = await employeeCaller.timeEntries.getById({ id: entry.id });
      expect(updated.status).toBe('DRAFT');

      // 4. Fix and resubmit
      await employeeCaller.timeEntries.update({
        id: entry.id,
        data: { projectId },
      });

      await employeeCaller.timeEntries.submit({
        timeEntryIds: [entry.id],
      });

      updated = await employeeCaller.timeEntries.getById({ id: entry.id });
      expect(updated.status).toBe('SUBMITTED');
      expect(updated.projectId).toBe(projectId);

      // 5. Approve this time
      await approverCaller.timeEntries.approve({
        timeEntryIds: [entry.id],
      });

      updated = await approverCaller.timeEntries.getById({ id: entry.id });
      expect(updated.status).toBe('APPROVED');
    });
  });
});
