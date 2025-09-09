import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ModificationApprovalWorkflow } from '../modification-approval-workflow';
import { Database } from '@glapi/database';
import { ModificationStatus } from '@glapi/database/schema';
import type { ApprovalRequest, ApprovalStatus } from '../modification-approval-workflow';

// Mock the database
vi.mock('@glapi/database', () => ({
  Database: vi.fn(),
  contractModifications: {},
  modificationApprovalHistory: {}
}));

describe('ModificationApprovalWorkflow', () => {
  let workflow: ModificationApprovalWorkflow;
  let mockDb: any;

  beforeEach(() => {
    // Setup mock database
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      transaction: vi.fn((callback) => callback(mockDb))
    };

    workflow = new ModificationApprovalWorkflow(mockDb as Database);
    
    // Clear all timers after each test
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('submitForApproval', () => {
    it('should submit modification for approval', async () => {
      const modificationId = 'mod-001';
      const submitterId = 'user-123';

      // Mock modification lookup
      mockDb.limit.mockResolvedValue([{
        id: modificationId,
        status: ModificationStatus.DRAFT,
        modificationType: 'add_items',
        adjustmentAmount: '5000'
      }]);

      // Mock update
      mockDb.where.mockImplementation(() => {
        mockDb.returning.mockResolvedValue([{
          id: modificationId,
          status: ModificationStatus.PENDING_APPROVAL
        }]);
        return mockDb;
      });

      // Mock approval history insert
      mockDb.returning.mockResolvedValue([{
        id: 'approval-001'
      }]);

      const result = await workflow.submitForApproval(modificationId, submitterId);

      expect(result.status).toBe('pending');
      expect(result.pendingApprovals).toContain('manager');
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should reject already submitted modification', async () => {
      const modificationId = 'mod-002';
      const submitterId = 'user-123';

      mockDb.limit.mockResolvedValue([{
        id: modificationId,
        status: ModificationStatus.PENDING_APPROVAL
      }]);

      await expect(workflow.submitForApproval(modificationId, submitterId))
        .rejects.toThrow('already submitted');
    });

    it('should determine high value approval requirements', async () => {
      const modificationId = 'mod-003';
      const submitterId = 'user-123';

      // High value modification
      mockDb.limit.mockResolvedValue([{
        id: modificationId,
        status: ModificationStatus.DRAFT,
        modificationType: 'price_change',
        adjustmentAmount: '100000' // High value
      }]);

      mockDb.where.mockImplementation(() => {
        mockDb.returning.mockResolvedValue([{
          id: modificationId,
          status: ModificationStatus.PENDING_APPROVAL
        }]);
        return mockDb;
      });

      mockDb.returning.mockResolvedValue([{ id: 'approval-002' }]);

      const result = await workflow.submitForApproval(modificationId, submitterId);

      expect(result.pendingApprovals).toContain('manager');
      expect(result.pendingApprovals).toContain('finance');
      expect(result.pendingApprovals).toContain('executive');
    });

    it('should require legal approval for terminations', async () => {
      const modificationId = 'mod-004';
      const submitterId = 'user-123';

      mockDb.limit.mockResolvedValue([{
        id: modificationId,
        status: ModificationStatus.DRAFT,
        modificationType: 'early_termination',
        adjustmentAmount: '10000'
      }]);

      mockDb.where.mockImplementation(() => {
        mockDb.returning.mockResolvedValue([{
          id: modificationId,
          status: ModificationStatus.PENDING_APPROVAL
        }]);
        return mockDb;
      });

      mockDb.returning.mockResolvedValue([{ id: 'approval-003' }]);

      const result = await workflow.submitForApproval(modificationId, submitterId);

      expect(result.pendingApprovals).toContain('legal');
    });
  });

  describe('processApproval', () => {
    it('should process manager approval', async () => {
      const request: ApprovalRequest = {
        modificationId: 'mod-001',
        action: 'approve',
        approverId: 'manager-001',
        approverRole: 'manager',
        comments: 'Approved'
      };

      // Mock modification
      mockDb.limit.mockResolvedValue([{
        id: 'mod-001',
        status: ModificationStatus.PENDING_APPROVAL,
        modificationType: 'add_items',
        adjustmentAmount: '5000'
      }]);

      // Mock approval history
      mockDb.orderBy.mockResolvedValue([
        {
          approvalLevel: 'submitted',
          approvalAction: 'submitted'
        }
      ]);

      // Mock insert approval record
      mockDb.returning.mockResolvedValue([{
        id: 'approval-004'
      }]);

      const result = await workflow.processApproval(request);

      expect(result.status).toBe('approved');
      expect(result.completedApprovals).toContain('manager');
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should handle multi-level approval', async () => {
      const request: ApprovalRequest = {
        modificationId: 'mod-002',
        action: 'approve',
        approverId: 'manager-001',
        approverRole: 'manager',
        comments: 'Manager approved'
      };

      // High value modification requiring multiple approvals
      mockDb.limit.mockResolvedValue([{
        id: 'mod-002',
        status: ModificationStatus.PENDING_APPROVAL,
        modificationType: 'price_change',
        adjustmentAmount: '100000'
      }]);

      // Mock existing approvals
      mockDb.orderBy.mockResolvedValue([
        {
          approvalLevel: 'submitted',
          approvalAction: 'submitted'
        }
      ]);

      mockDb.returning.mockResolvedValue([{
        id: 'approval-005'
      }]);

      const result = await workflow.processApproval(request);

      expect(result.status).toBe('pending');
      expect(result.completedApprovals).toContain('manager');
      expect(result.pendingApprovals).toContain('finance');
      expect(result.pendingApprovals).toContain('executive');
    });

    it('should handle rejection', async () => {
      const request: ApprovalRequest = {
        modificationId: 'mod-003',
        action: 'reject',
        approverId: 'manager-001',
        approverRole: 'manager',
        comments: 'Budget constraints'
      };

      mockDb.limit.mockResolvedValue([{
        id: 'mod-003',
        status: ModificationStatus.PENDING_APPROVAL,
        modificationType: 'add_items',
        adjustmentAmount: '5000'
      }]);

      mockDb.orderBy.mockResolvedValue([]);

      mockDb.returning.mockResolvedValue([{
        id: 'approval-006'
      }]);

      // Mock update to rejected status
      mockDb.where.mockImplementation(() => {
        mockDb.returning.mockResolvedValue([{
          status: ModificationStatus.REJECTED
        }]);
        return mockDb;
      });

      const result = await workflow.processApproval(request);

      expect(result.status).toBe('rejected');
      expect(result.rejectionReason).toBe('Budget constraints');
    });

    it('should handle request for more information', async () => {
      const request: ApprovalRequest = {
        modificationId: 'mod-004',
        action: 'request_info',
        approverId: 'finance-001',
        approverRole: 'finance',
        comments: 'Need cost breakdown'
      };

      mockDb.limit.mockResolvedValue([{
        id: 'mod-004',
        status: ModificationStatus.PENDING_APPROVAL,
        modificationType: 'add_items',
        adjustmentAmount: '50000'
      }]);

      mockDb.orderBy.mockResolvedValue([
        {
          approvalLevel: 'manager',
          approvalAction: 'approved'
        }
      ]);

      mockDb.returning.mockResolvedValue([{
        id: 'approval-007'
      }]);

      const result = await workflow.processApproval(request);

      expect(result.status).toBe('pending_info');
      expect(result.infoRequests).toHaveLength(1);
      expect(result.infoRequests[0].requestedBy).toBe('finance');
    });

    it('should complete approval when all levels approved', async () => {
      const request: ApprovalRequest = {
        modificationId: 'mod-005',
        action: 'approve',
        approverId: 'exec-001',
        approverRole: 'executive'
      };

      mockDb.limit.mockResolvedValue([{
        id: 'mod-005',
        status: ModificationStatus.PENDING_APPROVAL,
        modificationType: 'price_change',
        adjustmentAmount: '100000'
      }]);

      // Mock existing approvals
      mockDb.orderBy.mockResolvedValue([
        {
          approvalLevel: 'manager',
          approvalAction: 'approved'
        },
        {
          approvalLevel: 'finance',
          approvalAction: 'approved'
        }
      ]);

      mockDb.returning.mockResolvedValue([{
        id: 'approval-008'
      }]);

      // Mock update to approved status
      mockDb.where.mockImplementation(() => {
        mockDb.returning.mockResolvedValue([{
          status: ModificationStatus.APPROVED
        }]);
        return mockDb;
      });

      const result = await workflow.processApproval(request);

      expect(result.status).toBe('approved');
      expect(result.completedApprovals).toContain('manager');
      expect(result.completedApprovals).toContain('finance');
      expect(result.completedApprovals).toContain('executive');
      expect(result.pendingApprovals).toHaveLength(0);
    });
  });

  describe('getApprovalStatus', () => {
    it('should get current approval status', async () => {
      const modificationId = 'mod-001';

      mockDb.limit.mockResolvedValue([{
        id: modificationId,
        status: ModificationStatus.PENDING_APPROVAL,
        modificationType: 'add_items',
        adjustmentAmount: '5000'
      }]);

      mockDb.orderBy.mockResolvedValue([
        {
          approvalLevel: 'submitted',
          approvalAction: 'submitted',
          approvalDate: new Date('2024-01-01')
        },
        {
          approvalLevel: 'manager',
          approvalAction: 'approved',
          approvalDate: new Date('2024-01-02'),
          approvedBy: 'manager-001',
          comments: 'Looks good'
        }
      ]);

      const status = await workflow.getApprovalStatus(modificationId);

      expect(status.status).toBe('pending');
      expect(status.completedApprovals).toContain('manager');
      expect(status.approvalHistory).toHaveLength(2);
    });
  });

  describe('recallModification', () => {
    it('should recall modification from approval', async () => {
      const modificationId = 'mod-001';
      const recalledBy = 'user-123';
      const reason = 'Need to update pricing';

      mockDb.limit.mockResolvedValue([{
        id: modificationId,
        status: ModificationStatus.PENDING_APPROVAL
      }]);

      mockDb.where.mockImplementation(() => {
        mockDb.returning.mockResolvedValue([{
          status: ModificationStatus.DRAFT
        }]);
        return mockDb;
      });

      mockDb.returning.mockResolvedValue([{
        id: 'approval-009'
      }]);

      await workflow.recallModification(modificationId, recalledBy, reason);

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should reject recall of non-pending modification', async () => {
      const modificationId = 'mod-002';

      mockDb.limit.mockResolvedValue([{
        id: modificationId,
        status: ModificationStatus.APPROVED
      }]);

      await expect(workflow.recallModification(modificationId, 'user-123', 'reason'))
        .rejects.toThrow('can only be recalled from pending approval status');
    });
  });

  describe('delegateApproval', () => {
    it('should delegate approval to another user', async () => {
      const modificationId = 'mod-001';
      const fromApproverId = 'manager-001';
      const toApproverId = 'manager-002';
      const reason = 'Out of office';

      mockDb.limit.mockResolvedValue([{
        id: modificationId,
        status: ModificationStatus.PENDING_APPROVAL
      }]);

      mockDb.returning.mockResolvedValue([{
        id: 'approval-010'
      }]);

      await workflow.delegateApproval(modificationId, fromApproverId, toApproverId, reason);

      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('checkForEscalations', () => {
    it('should escalate overdue approvals', async () => {
      vi.useFakeTimers();
      const now = new Date('2024-01-15');
      vi.setSystemTime(now);

      // Mock pending modifications
      mockDb.where.mockImplementation(() => {
        mockDb.limit.mockResolvedValue([
          {
            id: 'mod-001',
            status: ModificationStatus.PENDING_APPROVAL,
            modificationType: 'add_items',
            adjustmentAmount: '50000',
            requestDate: new Date('2024-01-01') // 14 days old
          }
        ]);
        return mockDb;
      });

      // Mock approval history
      mockDb.orderBy.mockResolvedValue([
        {
          approvalLevel: 'submitted',
          approvalAction: 'submitted',
          approvalDate: new Date('2024-01-01')
        }
      ]);

      mockDb.returning.mockResolvedValue([{
        id: 'escalation-001'
      }]);

      await workflow.checkForEscalations();

      expect(mockDb.insert).toHaveBeenCalled();
      
      vi.useRealTimers();
    });

    it('should not escalate recent approvals', async () => {
      vi.useFakeTimers();
      const now = new Date('2024-01-02');
      vi.setSystemTime(now);

      mockDb.where.mockImplementation(() => {
        mockDb.limit.mockResolvedValue([
          {
            id: 'mod-002',
            status: ModificationStatus.PENDING_APPROVAL,
            requestDate: new Date('2024-01-01') // 1 day old
          }
        ]);
        return mockDb;
      });

      mockDb.orderBy.mockResolvedValue([]);

      const insertSpy = vi.spyOn(mockDb, 'insert');
      
      await workflow.checkForEscalations();

      expect(insertSpy).not.toHaveBeenCalled();
      
      vi.useRealTimers();
    });
  });

  describe('Edge Cases', () => {
    it('should handle modification not found', async () => {
      const request: ApprovalRequest = {
        modificationId: 'non-existent',
        action: 'approve',
        approverId: 'manager-001',
        approverRole: 'manager'
      };

      mockDb.limit.mockResolvedValue([]);

      await expect(workflow.processApproval(request))
        .rejects.toThrow('Modification not found');
    });

    it('should prevent duplicate approvals', async () => {
      const request: ApprovalRequest = {
        modificationId: 'mod-001',
        action: 'approve',
        approverId: 'manager-001',
        approverRole: 'manager'
      };

      mockDb.limit.mockResolvedValue([{
        id: 'mod-001',
        status: ModificationStatus.PENDING_APPROVAL,
        modificationType: 'add_items',
        adjustmentAmount: '5000'
      }]);

      // Mock existing manager approval
      mockDb.orderBy.mockResolvedValue([
        {
          approvalLevel: 'manager',
          approvalAction: 'approved',
          approvedBy: 'manager-001'
        }
      ]);

      await expect(workflow.processApproval(request))
        .rejects.toThrow('already been processed');
    });

    it('should validate approver role', async () => {
      const request: ApprovalRequest = {
        modificationId: 'mod-001',
        action: 'approve',
        approverId: 'user-001',
        approverRole: 'invalid_role' as any
      };

      mockDb.limit.mockResolvedValue([{
        id: 'mod-001',
        status: ModificationStatus.PENDING_APPROVAL
      }]);

      await expect(workflow.processApproval(request))
        .rejects.toThrow('not authorized');
    });

    it('should handle conditional approvals', async () => {
      const request: ApprovalRequest = {
        modificationId: 'mod-001',
        action: 'approve',
        approverId: 'finance-001',
        approverRole: 'finance',
        conditions: {
          maxDiscount: 15,
          requireQuarterlyReview: true
        }
      };

      mockDb.limit.mockResolvedValue([{
        id: 'mod-001',
        status: ModificationStatus.PENDING_APPROVAL,
        modificationType: 'price_change',
        adjustmentAmount: '10000'
      }]);

      mockDb.orderBy.mockResolvedValue([
        {
          approvalLevel: 'manager',
          approvalAction: 'approved'
        }
      ]);

      mockDb.returning.mockResolvedValue([{
        id: 'approval-011'
      }]);

      const result = await workflow.processApproval(request);

      expect(result.status).toBe('approved');
      expect(result.conditions).toBeDefined();
      expect(result.conditions.maxDiscount).toBe(15);
    });
  });
});