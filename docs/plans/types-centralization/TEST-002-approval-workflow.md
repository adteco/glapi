# TEST-002: Time Entry Approval Workflow Integration Tests

## Task Overview

**Description**: Create comprehensive integration tests for the time entry approval workflow, testing the complete lifecycle from submission through approval/rejection to GL posting.

**Layer**: Integration Testing

**Estimated Time**: 4 hours

**Dependencies**: TEST-001

**Blocks**: TEST-004

---

## Acceptance Criteria

- [ ] Test covers submit workflow (DRAFT -> SUBMITTED)
- [ ] Test covers approval workflow (SUBMITTED -> APPROVED)
- [ ] Test covers rejection workflow (SUBMITTED -> REJECTED)
- [ ] Test covers return to draft (APPROVED -> DRAFT)
- [ ] Test covers GL posting (APPROVED -> POSTED)
- [ ] Test validates status transition rules
- [ ] Test validates rejection reason is required
- [ ] Test validates approver permissions
- [ ] Test covers batch operations (multiple entries)
- [ ] All tests pass in CI environment

---

## Workflow State Machine

```
                    +-----------+
                    |   DRAFT   |
                    +-----+-----+
                          |
                    submit()
                          |
                          v
                    +-----------+
            +-------|  SUBMITTED |-------+
            |       +-----+-----+        |
       reject()           |          approve()
            |             |              |
            v             v              v
      +-----------+  returnToDraft()  +-----------+
      |  REJECTED |<------------------|  APPROVED |
      +-----------+                   +-----+-----+
            |                               |
       returnToDraft()               postToGL()
            |                               |
            v                               v
      +-----------+                   +-----------+
      |   DRAFT   |                   |   POSTED  |
      +-----------+                   +-----------+
                                      (Terminal)

      +-----------+
      | CANCELLED |  (From DRAFT or REJECTED only)
      +-----------+
      (Terminal)
```

---

## Test Scenarios

### Scenario 1: Submit Single Time Entry
- Create a draft entry
- Submit the entry
- Verify status changes to SUBMITTED
- Verify submittedAt and submittedBy are set

### Scenario 2: Submit Multiple Time Entries (Batch)
- Create multiple draft entries
- Submit all in one call
- Verify all entries are submitted

### Scenario 3: Approve Single Time Entry
- Create and submit an entry
- Approve the entry
- Verify status changes to APPROVED
- Verify approvedAt and approvedBy are set

### Scenario 4: Approve Multiple Time Entries (Batch)
- Create and submit multiple entries
- Approve all in one call
- Verify all entries are approved

### Scenario 5: Reject Time Entry
- Create and submit an entry
- Reject with reason
- Verify status changes to REJECTED
- Verify rejectedAt, rejectedBy, and rejectionReason are set

### Scenario 6: Reject Without Reason (Should Fail)
- Create and submit an entry
- Attempt to reject without reason
- Verify rejection fails

### Scenario 7: Return Approved Entry to Draft
- Create, submit, and approve an entry
- Return to draft
- Verify status changes to DRAFT
- Verify approval fields are cleared

### Scenario 8: Post to GL
- Create, submit, and approve an entry
- Post to GL
- Verify status changes to POSTED
- Verify postedAt and glTransactionId are set

### Scenario 9: Invalid Status Transitions
- Attempt to submit a SUBMITTED entry
- Attempt to approve a DRAFT entry
- Attempt to post a SUBMITTED entry
- Verify all fail with appropriate errors

### Scenario 10: Cannot Modify Posted Entry
- Create full workflow to POSTED
- Attempt to update, delete, or change status
- Verify all operations fail

### Scenario 11: Pending Approvals List
- Create entries for multiple employees
- Submit some entries
- Query pending approvals for an approver
- Verify correct entries are returned

---

## TDD Implementation

### Test File Location
`packages/integration-tests/__tests__/time-entry-approval-workflow.test.ts`

### Test Implementation

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { TestDatabase } from '../helpers/test-database';
import { TestDataGenerator } from '../helpers/test-data-generator';
import { createCallerFactory } from '@glapi/trpc';
import { appRouter } from '@glapi/trpc';
import {
  submitTimeEntriesSchema,
  approveTimeEntriesSchema,
  rejectTimeEntriesSchema,
  VALID_TIME_ENTRY_STATUS_TRANSITIONS,
  type TimeEntryStatus,
} from '@glapi/types';

describe('Time Entry Approval Workflow Integration Tests', () => {
  let testDb: TestDatabase;
  let dataGenerator: TestDataGenerator;
  let organizationId: string;
  let employeeId: string;
  let approverId: string;
  let projectId: string;
  let employeeCaller: ReturnType<typeof createCallerFactory>;
  let approverCaller: ReturnType<typeof createCallerFactory>;

  beforeAll(async () => {
    testDb = new TestDatabase();
    await testDb.setup();

    dataGenerator = new TestDataGenerator(testDb.db);

    // Create test organization
    const organization = await dataGenerator.createOrganization();
    organizationId = organization.id;

    // Create employee and approver
    const employee = await dataGenerator.createEmployee(organizationId);
    const approver = await dataGenerator.createEmployee(organizationId, {
      canApproveTime: true,
    });
    employeeId = employee.id;
    approverId = approver.id;

    // Create project
    const project = await dataGenerator.createProject(organizationId);
    projectId = project.id;

    // Create callers for different users
    const createCaller = createCallerFactory(appRouter);

    employeeCaller = createCaller({
      organizationId,
      userId: employeeId,
      userName: 'Test Employee',
      serviceContext: {
        organizationId,
        userId: employeeId,
        userName: 'Test Employee',
      },
    });

    approverCaller = createCaller({
      organizationId,
      userId: approverId,
      userName: 'Test Approver',
      serviceContext: {
        organizationId,
        userId: approverId,
        userName: 'Test Approver',
      },
    });
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

      expect(result.success).toBe(true);

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

      expect(result.success).toBe(true);

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

      expect(result.success).toBe(true);

      const updated = await approverCaller.timeEntries.getById({ id: entry.id });
      expect(updated.status).toBe('APPROVED');
      expect(updated.approvedAt).toBeDefined();
      expect(updated.approvedBy).toBe(approverId);
    });

    it('should approve multiple entries in batch', async () => {
      const entries = await Promise.all([
        employeeCaller.timeEntries.create({ entryDate: '2024-01-15', hours: '8.00' }),
        employeeCaller.timeEntries.create({ entryDate: '2024-01-16', hours: '8.00' }),
      ]);

      await employeeCaller.timeEntries.submit({
        timeEntryIds: entries.map(e => e.id),
      });

      await approverCaller.timeEntries.approve({
        timeEntryIds: entries.map(e => e.id),
      });

      const list = await approverCaller.timeEntries.list({
        filters: { status: 'APPROVED' },
      });
      expect(list.data.length).toBe(2);
    });

    it('should not approve a draft entry', async () => {
      const entry = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });

      await expect(
        approverCaller.timeEntries.approve({
          timeEntryIds: [entry.id],
        })
      ).rejects.toThrow();
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

      expect(result.success).toBe(true);

      const updated = await approverCaller.timeEntries.getById({ id: entry.id });
      expect(updated.status).toBe('REJECTED');
      expect(updated.rejectedAt).toBeDefined();
      expect(updated.rejectedBy).toBe(approverId);
      expect(updated.rejectionReason).toBe('Hours seem incorrect, please verify');
    });

    it('should require rejection reason', async () => {
      // Schema validation
      const emptyReasonResult = rejectTimeEntriesSchema.safeParse({
        timeEntryIds: ['550e8400-e29b-41d4-a716-446655440000'],
        reason: '',
      });
      expect(emptyReasonResult.success).toBe(false);

      const noReasonResult = rejectTimeEntriesSchema.safeParse({
        timeEntryIds: ['550e8400-e29b-41d4-a716-446655440000'],
      });
      expect(noReasonResult.success).toBe(false);
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

      // Employee fixes and resubmits
      await employeeCaller.timeEntries.returnToDraft({
        timeEntryIds: [entry.id],
      });

      await employeeCaller.timeEntries.update({
        id: entry.id,
        data: { projectId },
      });

      await employeeCaller.timeEntries.submit({
        timeEntryIds: [entry.id],
      });

      const updated = await employeeCaller.timeEntries.getById({ id: entry.id });
      expect(updated.status).toBe('SUBMITTED');
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

      expect(result.success).toBe(true);

      const updated = await employeeCaller.timeEntries.getById({ id: entry.id });
      expect(updated.status).toBe('DRAFT');
      // Approval fields should be cleared
      expect(updated.approvedAt).toBeNull();
      expect(updated.approvedBy).toBeNull();
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

      expect(result.success).toBe(true);
      expect(result.postedCount).toBe(1);
      expect(result.failedCount).toBe(0);
      expect(result.glTransactionId).toBeDefined();

      const updated = await approverCaller.timeEntries.getById({ id: entry.id });
      expect(updated.status).toBe('POSTED');
      expect(updated.postedAt).toBeDefined();
      expect(updated.glTransactionId).toBeDefined();
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

    it('should not modify posted entries', async () => {
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

      // Cannot delete
      await expect(
        employeeCaller.timeEntries.delete({ id: entry.id })
      ).rejects.toThrow();

      // Cannot return to draft
      await expect(
        approverCaller.timeEntries.returnToDraft({
          timeEntryIds: [entry.id],
        })
      ).rejects.toThrow();
    });
  });

  describe('Status Transition Validation', () => {
    it('should validate status transitions match rules', () => {
      // DRAFT can transition to SUBMITTED or CANCELLED
      expect(VALID_TIME_ENTRY_STATUS_TRANSITIONS.DRAFT).toContain('SUBMITTED');
      expect(VALID_TIME_ENTRY_STATUS_TRANSITIONS.DRAFT).toContain('CANCELLED');
      expect(VALID_TIME_ENTRY_STATUS_TRANSITIONS.DRAFT).not.toContain('APPROVED');

      // SUBMITTED can transition to DRAFT, APPROVED, or REJECTED
      expect(VALID_TIME_ENTRY_STATUS_TRANSITIONS.SUBMITTED).toContain('DRAFT');
      expect(VALID_TIME_ENTRY_STATUS_TRANSITIONS.SUBMITTED).toContain('APPROVED');
      expect(VALID_TIME_ENTRY_STATUS_TRANSITIONS.SUBMITTED).toContain('REJECTED');
      expect(VALID_TIME_ENTRY_STATUS_TRANSITIONS.SUBMITTED).not.toContain('POSTED');

      // POSTED is terminal
      expect(VALID_TIME_ENTRY_STATUS_TRANSITIONS.POSTED).toHaveLength(0);
    });

    it.each([
      ['DRAFT', 'APPROVED'],
      ['DRAFT', 'POSTED'],
      ['SUBMITTED', 'POSTED'],
      ['APPROVED', 'REJECTED'],
      ['POSTED', 'DRAFT'],
      ['CANCELLED', 'DRAFT'],
    ])('should reject invalid transition from %s to %s', async (from, to) => {
      const entry = await employeeCaller.timeEntries.create({
        entryDate: '2024-01-15',
        hours: '8.00',
      });

      // Get entry to target status
      if (from === 'SUBMITTED') {
        await employeeCaller.timeEntries.submit({
          timeEntryIds: [entry.id],
        });
      } else if (from === 'APPROVED') {
        await employeeCaller.timeEntries.submit({
          timeEntryIds: [entry.id],
        });
        await approverCaller.timeEntries.approve({
          timeEntryIds: [entry.id],
        });
      }

      // Attempt invalid transition
      if (to === 'POSTED') {
        await expect(
          approverCaller.timeEntries.postToGL({
            timeEntryIds: [entry.id],
          })
        ).rejects.toThrow();
      }
    });
  });

  describe('Pending Approvals', () => {
    it('should list entries pending approval', async () => {
      // Create entries for different employees
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

      const pendingApprovals = await approverCaller.timeEntries.getPendingApprovals();

      expect(pendingApprovals.data.length).toBe(2);
      pendingApprovals.data.forEach(entry => {
        expect(entry.status).toBe('SUBMITTED');
      });
    });
  });
});
```

---

## Git Commit

```
test(integration): add time entry approval workflow tests

- Add submit workflow tests (single and batch)
- Add approval workflow tests
- Add rejection workflow tests with reason validation
- Add return to draft tests
- Add GL posting tests
- Add status transition validation tests
- Add pending approvals list tests
- Verify immutability of posted entries

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```
