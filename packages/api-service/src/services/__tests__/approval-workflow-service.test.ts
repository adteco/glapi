import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceError } from '../../types';

// Use vi.hoisted() to properly hoist mock functions for use in vi.mock factory
const {
  mockFindPoliciesByDocumentType,
  mockFindDefaultPolicy,
  mockFindPolicyWithSteps,
  mockFindInstanceByDocument,
  mockCreateInstance,
  mockFindInstanceWithActions,
  mockUpdateInstance,
  mockCreateAction,
  mockFindPendingInstancesForApprover,
  mockFindInstancesByStatus,
  mockFindSodRulesForDocument,
  mockCreateViolation,
  mockEmit,
} = vi.hoisted(() => ({
  mockFindPoliciesByDocumentType: vi.fn(),
  mockFindDefaultPolicy: vi.fn(),
  mockFindPolicyWithSteps: vi.fn(),
  mockFindInstanceByDocument: vi.fn(),
  mockCreateInstance: vi.fn(),
  mockFindInstanceWithActions: vi.fn(),
  mockUpdateInstance: vi.fn(),
  mockCreateAction: vi.fn(),
  mockFindPendingInstancesForApprover: vi.fn(),
  mockFindInstancesByStatus: vi.fn(),
  mockFindSodRulesForDocument: vi.fn(),
  mockCreateViolation: vi.fn(),
  mockEmit: vi.fn(),
}));

// Mock the database module
vi.mock('@glapi/database', () => ({
  approvalWorkflowRepository: {
    findPoliciesByDocumentType: mockFindPoliciesByDocumentType,
    findDefaultPolicy: mockFindDefaultPolicy,
    findPolicyWithSteps: mockFindPolicyWithSteps,
    findInstanceByDocument: mockFindInstanceByDocument,
    createInstance: mockCreateInstance,
    findInstanceWithActions: mockFindInstanceWithActions,
    updateInstance: mockUpdateInstance,
    createAction: mockCreateAction,
    findPendingInstancesForApprover: mockFindPendingInstancesForApprover,
    findInstancesByStatus: mockFindInstancesByStatus,
    findSodRulesForDocument: mockFindSodRulesForDocument,
    createViolation: mockCreateViolation,
  },
  ApprovalInstanceStatuses: {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    RECALLED: 'recalled',
    ESCALATED: 'escalated',
  },
  WorkflowApprovalActions: {
    APPROVE: 'approve',
    REJECT: 'reject',
    DELEGATE: 'delegate',
    ESCALATE: 'escalate',
    RECALL: 'recall',
    REQUEST_INFO: 'request_info',
  },
  ApprovalLevels: {
    SAME_LEVEL: 'same_level',
    NEXT_LEVEL: 'next_level',
    SKIP_LEVEL: 'skip_level',
    FINAL: 'final',
  },
  EventCategory: {
    WORKFLOW: 'workflow',
  },
  SodConflictTypes: {
    SAME_USER: 'same_user',
    SAME_ROLE: 'same_role',
    ROLE_PAIR: 'role_pair',
    SUBSIDIARY_BASED: 'subsidiary_based',
  },
  SodSeverityLevels: {
    CRITICAL: 'critical',
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low',
  },
}));

// Mock EventService
vi.mock('../event-service', () => ({
  EventService: vi.fn().mockImplementation(() => ({
    emit: mockEmit,
  })),
}));

// Import after mocking
import {
  ApprovalWorkflowService,
  SubmitForApprovalInput,
  ProcessApprovalInput,
} from '../approval-workflow-service';

describe('ApprovalWorkflowService', () => {
  let service: ApprovalWorkflowService;

  const testOrgId = 'org-123';
  const testUserId = 'user-123';
  const testApproverId = 'approver-456';

  // Sample policy for testing
  const samplePolicy = {
    id: 'policy-1',
    organizationId: testOrgId,
    policyName: 'Standard JE Approval',
    policyCode: 'JE_STD',
    documentType: 'journal_entry',
    isActive: true,
    isDefault: true,
    conditionRules: [],
    priority: 1,
    createdAt: new Date(),
  };

  // Sample steps
  const sampleSteps = [
    {
      id: 'step-1',
      policyId: 'policy-1',
      stepNumber: 1,
      stepName: 'Manager Approval',
      approvalLevel: 'same_level',
      requiredRoleIds: ['role-manager'],
      requiredApprovals: 1,
      escalationHours: 24,
      escalationNotifyRoleIds: ['role-director'],
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: 'step-2',
      policyId: 'policy-1',
      stepNumber: 2,
      stepName: 'Director Approval',
      approvalLevel: 'next_level',
      requiredRoleIds: ['role-director'],
      requiredApprovals: 1,
      escalationHours: 48,
      escalationNotifyRoleIds: ['role-cfo'],
      isActive: true,
      createdAt: new Date(),
    },
  ];

  const samplePolicyWithSteps = {
    ...samplePolicy,
    steps: sampleSteps,
  };

  // Sample instance
  const sampleInstance = {
    id: 'instance-1',
    organizationId: testOrgId,
    documentType: 'journal_entry',
    documentId: 'je-123',
    documentNumber: 'JE-2024-001',
    policyId: 'policy-1',
    policySnapshot: JSON.stringify(samplePolicyWithSteps),
    status: 'pending',
    currentStepNumber: 1,
    totalSteps: 2,
    submittedBy: testUserId,
    submittedAt: new Date(),
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ApprovalWorkflowService({
      organizationId: testOrgId,
      userId: testUserId,
    });

    // Default mock for SoD rules (no violations)
    mockFindSodRulesForDocument.mockResolvedValue([]);
  });

  describe('submitForApproval', () => {
    it('should submit a document for approval successfully', async () => {
      mockFindPoliciesByDocumentType.mockResolvedValue([samplePolicy]);
      mockFindPolicyWithSteps.mockResolvedValue(samplePolicyWithSteps);
      mockFindInstanceByDocument.mockResolvedValue(null);
      mockCreateInstance.mockResolvedValue(sampleInstance);
      mockEmit.mockResolvedValue(undefined);

      const input: SubmitForApprovalInput = {
        documentType: 'journal_entry' as any,
        documentId: 'je-123',
        documentNumber: 'JE-2024-001',
        documentAmount: 10000,
      };

      const result = await service.submitForApproval(input);

      expect(result.instance).toEqual(sampleInstance);
      expect(result.policyUsed).toEqual(samplePolicy);
      expect(result.totalSteps).toBe(2);
      expect(result.firstApprovers).toHaveLength(1);
      expect(result.firstApprovers[0].stepName).toBe('Manager Approval');
      expect(mockCreateInstance).toHaveBeenCalled();
      expect(mockEmit).toHaveBeenCalled();
    });

    it('should throw error when no policy is found', async () => {
      mockFindPoliciesByDocumentType.mockResolvedValue([]);
      mockFindDefaultPolicy.mockResolvedValue(null);

      const input: SubmitForApprovalInput = {
        documentType: 'journal_entry' as any,
        documentId: 'je-123',
      };

      await expect(service.submitForApproval(input)).rejects.toThrow(ServiceError);
      await expect(service.submitForApproval(input)).rejects.toMatchObject({
        code: 'NO_APPROVAL_POLICY',
      });
    });

    it('should throw error when document is already submitted', async () => {
      mockFindPoliciesByDocumentType.mockResolvedValue([samplePolicy]);
      mockFindPolicyWithSteps.mockResolvedValue(samplePolicyWithSteps);
      mockFindInstanceByDocument.mockResolvedValue(sampleInstance);

      const input: SubmitForApprovalInput = {
        documentType: 'journal_entry' as any,
        documentId: 'je-123',
      };

      await expect(service.submitForApproval(input)).rejects.toThrow(ServiceError);
      await expect(service.submitForApproval(input)).rejects.toMatchObject({
        code: 'ALREADY_SUBMITTED',
      });
    });

    it('should use default policy when no condition-matching policy found', async () => {
      const nonMatchingPolicy = {
        ...samplePolicy,
        isDefault: false,
        conditionRules: [{ field: 'amount', operator: 'gt', value: 50000 }],
      };
      mockFindPoliciesByDocumentType.mockResolvedValue([nonMatchingPolicy]);
      mockFindDefaultPolicy.mockResolvedValue(samplePolicy);
      mockFindPolicyWithSteps.mockResolvedValue(samplePolicyWithSteps);
      mockFindInstanceByDocument.mockResolvedValue(null);
      mockCreateInstance.mockResolvedValue(sampleInstance);
      mockEmit.mockResolvedValue(undefined);

      const input: SubmitForApprovalInput = {
        documentType: 'journal_entry' as any,
        documentId: 'je-123',
        documentAmount: 1000, // Below threshold
      };

      const result = await service.submitForApproval(input);

      expect(result.policyUsed).toEqual(samplePolicy);
    });

    it('should match policy based on amount condition', async () => {
      const highValuePolicy = {
        ...samplePolicy,
        id: 'policy-high-value',
        policyName: 'High Value JE Approval',
        conditionRules: [{ field: 'amount', operator: 'gte', value: 10000 }],
      };
      const highValuePolicyWithSteps = {
        ...highValuePolicy,
        steps: sampleSteps,
      };

      mockFindPoliciesByDocumentType.mockResolvedValue([highValuePolicy]);
      mockFindPolicyWithSteps.mockResolvedValue(highValuePolicyWithSteps);
      mockFindInstanceByDocument.mockResolvedValue(null);
      mockCreateInstance.mockResolvedValue(sampleInstance);
      mockEmit.mockResolvedValue(undefined);

      const input: SubmitForApprovalInput = {
        documentType: 'journal_entry' as any,
        documentId: 'je-123',
        documentAmount: 25000,
      };

      const result = await service.submitForApproval(input);

      expect(result.policyUsed.id).toBe('policy-high-value');
    });
  });

  describe('processApproval', () => {
    beforeEach(() => {
      // Set up service with approver context for approval tests
      service = new ApprovalWorkflowService({
        organizationId: testOrgId,
        userId: testApproverId,
      });
    });

    it('should process approval and move to next step', async () => {
      const instanceWithActions = {
        ...sampleInstance,
        actions: [],
      };
      const updatedInstance = {
        ...sampleInstance,
        status: 'in_progress',
        currentStepNumber: 2,
      };
      const updatedInstanceWithActions = {
        ...updatedInstance,
        actions: [{ stepNumber: 1, action: 'approve', actionBy: testApproverId }],
      };

      // First call for processApproval, second call for getWorkflowStatus
      mockFindInstanceWithActions
        .mockResolvedValueOnce(instanceWithActions)
        .mockResolvedValueOnce(updatedInstanceWithActions);
      mockCreateAction.mockResolvedValue({ id: 'action-1' });
      mockUpdateInstance.mockResolvedValue(updatedInstance);
      mockEmit.mockResolvedValue(undefined);

      const input: ProcessApprovalInput = {
        instanceId: 'instance-1',
        action: 'approve' as any,
        comments: 'Looks good',
      };

      const result = await service.processApproval(input);

      expect(result.instance.currentStepNumber).toBe(2);
      expect(result.instance.status).toBe('in_progress');
      expect(mockCreateAction).toHaveBeenCalled();
      expect(mockUpdateInstance).toHaveBeenCalled();
    });

    it('should complete workflow on final approval', async () => {
      const finalStepInstance = {
        ...sampleInstance,
        currentStepNumber: 2,
        actions: [{ stepNumber: 1, action: 'approve', actionBy: 'approver-1' }],
      };
      const completedInstance = {
        ...finalStepInstance,
        status: 'approved',
        completedAt: new Date(),
        finalApprovedBy: testApproverId,
      };
      const completedInstanceWithActions = {
        ...completedInstance,
        actions: [
          { stepNumber: 1, action: 'approve', actionBy: 'approver-1' },
          { stepNumber: 2, action: 'approve', actionBy: testApproverId },
        ],
      };

      // First call for processApproval, second call for getWorkflowStatus
      mockFindInstanceWithActions
        .mockResolvedValueOnce(finalStepInstance)
        .mockResolvedValueOnce(completedInstanceWithActions);
      mockCreateAction.mockResolvedValue({ id: 'action-2' });
      mockUpdateInstance.mockResolvedValue(completedInstance);
      mockEmit.mockResolvedValue(undefined);

      const input: ProcessApprovalInput = {
        instanceId: 'instance-1',
        action: 'approve' as any,
      };

      const result = await service.processApproval(input);

      expect(result.isFinalApproved).toBe(true);
      expect(result.isComplete).toBe(true);
    });

    it('should reject workflow and notify submitter', async () => {
      const instanceWithActions = {
        ...sampleInstance,
        actions: [],
      };
      const rejectedInstance = {
        ...sampleInstance,
        status: 'rejected',
        completedAt: new Date(),
        finalRejectedBy: testApproverId,
        finalComments: 'Missing documentation',
      };
      const rejectedInstanceWithActions = {
        ...rejectedInstance,
        actions: [{ stepNumber: 1, action: 'reject', actionBy: testApproverId }],
      };

      // First call for processApproval, second call for getWorkflowStatus
      mockFindInstanceWithActions
        .mockResolvedValueOnce(instanceWithActions)
        .mockResolvedValueOnce(rejectedInstanceWithActions);
      mockCreateAction.mockResolvedValue({ id: 'action-1' });
      mockUpdateInstance.mockResolvedValue(rejectedInstance);
      mockEmit.mockResolvedValue(undefined);

      const input: ProcessApprovalInput = {
        instanceId: 'instance-1',
        action: 'reject' as any,
        comments: 'Missing documentation',
      };

      const result = await service.processApproval(input);

      expect(result.isRejected).toBe(true);
      expect(result.isComplete).toBe(true);
      expect(mockEmit).toHaveBeenCalled();
    });

    it('should throw error when instance not found', async () => {
      mockFindInstanceWithActions.mockResolvedValue(null);

      const input: ProcessApprovalInput = {
        instanceId: 'non-existent',
        action: 'approve' as any,
      };

      await expect(service.processApproval(input)).rejects.toThrow(ServiceError);
      await expect(service.processApproval(input)).rejects.toMatchObject({
        code: 'INSTANCE_NOT_FOUND',
      });
    });

    it('should throw error when already approved', async () => {
      const approvedInstance = {
        ...sampleInstance,
        status: 'approved',
        actions: [],
      };

      mockFindInstanceWithActions.mockResolvedValue(approvedInstance);

      const input: ProcessApprovalInput = {
        instanceId: 'instance-1',
        action: 'approve' as any,
      };

      await expect(service.processApproval(input)).rejects.toThrow(ServiceError);
      await expect(service.processApproval(input)).rejects.toMatchObject({
        code: 'ALREADY_APPROVED',
      });
    });

    it('should throw error when already rejected', async () => {
      const rejectedInstance = {
        ...sampleInstance,
        status: 'rejected',
        actions: [],
      };

      mockFindInstanceWithActions.mockResolvedValue(rejectedInstance);

      const input: ProcessApprovalInput = {
        instanceId: 'instance-1',
        action: 'approve' as any,
      };

      await expect(service.processApproval(input)).rejects.toThrow(ServiceError);
      await expect(service.processApproval(input)).rejects.toMatchObject({
        code: 'ALREADY_REJECTED',
      });
    });

    it('should handle delegation to another user', async () => {
      const instanceWithActions = {
        ...sampleInstance,
        actions: [],
      };

      mockFindInstanceWithActions.mockResolvedValue(instanceWithActions);
      mockCreateAction.mockResolvedValue({ id: 'action-1', delegatedTo: 'delegate-user' });
      mockEmit.mockResolvedValue(undefined);

      const input: ProcessApprovalInput = {
        instanceId: 'instance-1',
        action: 'delegate' as any,
        delegateTo: 'delegate-user',
      };

      const result = await service.processApproval(input);

      expect(mockCreateAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'delegate',
          delegatedTo: 'delegate-user',
        })
      );
      expect(mockEmit).toHaveBeenCalled();
    });

    it('should require delegate target for delegation', async () => {
      const instanceWithActions = {
        ...sampleInstance,
        actions: [],
      };

      mockFindInstanceWithActions.mockResolvedValue(instanceWithActions);
      mockCreateAction.mockResolvedValue({ id: 'action-1' });

      const input: ProcessApprovalInput = {
        instanceId: 'instance-1',
        action: 'delegate' as any,
        // Missing delegateTo
      };

      await expect(service.processApproval(input)).rejects.toThrow(ServiceError);
      await expect(service.processApproval(input)).rejects.toMatchObject({
        code: 'DELEGATE_TARGET_REQUIRED',
      });
    });

    it('should handle escalation', async () => {
      const instanceWithActions = {
        ...sampleInstance,
        actions: [],
      };
      const escalatedInstance = {
        ...sampleInstance,
        status: 'escalated',
      };
      const escalatedInstanceWithActions = {
        ...escalatedInstance,
        actions: [{ stepNumber: 1, action: 'escalate', actionBy: testApproverId }],
      };

      // First call for processApproval, second call for getWorkflowStatus
      mockFindInstanceWithActions
        .mockResolvedValueOnce(instanceWithActions)
        .mockResolvedValueOnce(escalatedInstanceWithActions);
      mockCreateAction.mockResolvedValue({ id: 'action-1' });
      mockUpdateInstance.mockResolvedValue(escalatedInstance);
      mockEmit.mockResolvedValue(undefined);

      const input: ProcessApprovalInput = {
        instanceId: 'instance-1',
        action: 'escalate' as any,
      };

      const result = await service.processApproval(input);

      expect(result.instance.status).toBe('escalated');
      expect(mockEmit).toHaveBeenCalled();
    });

    it('should allow submitter to recall their request', async () => {
      // Set up service with submitter context
      service = new ApprovalWorkflowService({
        organizationId: testOrgId,
        userId: testUserId, // Same as submittedBy
      });

      const instanceWithActions = {
        ...sampleInstance,
        actions: [],
      };
      const recalledInstance = {
        ...sampleInstance,
        status: 'recalled',
        completedAt: new Date(),
      };
      const recalledInstanceWithActions = {
        ...recalledInstance,
        actions: [{ stepNumber: 1, action: 'recall', actionBy: testUserId }],
      };

      // First call for processApproval, second call for getWorkflowStatus
      mockFindInstanceWithActions
        .mockResolvedValueOnce(instanceWithActions)
        .mockResolvedValueOnce(recalledInstanceWithActions);
      mockCreateAction.mockResolvedValue({ id: 'action-1' });
      mockUpdateInstance.mockResolvedValue(recalledInstance);
      mockEmit.mockResolvedValue(undefined);

      const input: ProcessApprovalInput = {
        instanceId: 'instance-1',
        action: 'recall' as any,
      };

      const result = await service.processApproval(input);

      expect(result.instance.status).toBe('recalled');
      expect(result.isComplete).toBe(true);
    });

    it('should prevent non-submitter from recalling', async () => {
      // Service is set up with testApproverId, not testUserId
      const instanceWithActions = {
        ...sampleInstance, // submittedBy: testUserId
        actions: [],
      };

      mockFindInstanceWithActions.mockResolvedValue(instanceWithActions);
      mockCreateAction.mockResolvedValue({ id: 'action-1' });

      const input: ProcessApprovalInput = {
        instanceId: 'instance-1',
        action: 'recall' as any,
      };

      await expect(service.processApproval(input)).rejects.toThrow(ServiceError);
      await expect(service.processApproval(input)).rejects.toMatchObject({
        code: 'RECALL_NOT_ALLOWED',
      });
    });
  });

  describe('getWorkflowStatus', () => {
    it('should return complete workflow status', async () => {
      const instanceWithActions = {
        ...sampleInstance,
        actions: [],
      };

      mockFindInstanceWithActions.mockResolvedValue(instanceWithActions);

      const result = await service.getWorkflowStatus('instance-1');

      expect(result.instance.id).toBe(sampleInstance.id);
      expect(result.instance.status).toBe(sampleInstance.status);
      expect(result.instance.documentType).toBe(sampleInstance.documentType);
      expect(result.totalSteps).toBe(2);
      expect(result.completedSteps).toBe(0);
      expect(result.isComplete).toBe(false);
      expect(result.pendingApprovers).toHaveLength(1);
    });

    it('should correctly identify completed status', async () => {
      const approvedInstance = {
        ...sampleInstance,
        status: 'approved',
        completedAt: new Date(),
        actions: [
          { stepNumber: 1, action: 'approve', actionBy: 'approver-1' },
          { stepNumber: 2, action: 'approve', actionBy: 'approver-2' },
        ],
      };

      mockFindInstanceWithActions.mockResolvedValue(approvedInstance);

      const result = await service.getWorkflowStatus('instance-1');

      expect(result.isComplete).toBe(true);
      expect(result.isFinalApproved).toBe(true);
      expect(result.isRejected).toBe(false);
      expect(result.completedSteps).toBe(2);
    });

    it('should throw error when instance not found', async () => {
      mockFindInstanceWithActions.mockResolvedValue(null);

      await expect(service.getWorkflowStatus('non-existent')).rejects.toThrow(ServiceError);
      await expect(service.getWorkflowStatus('non-existent')).rejects.toMatchObject({
        code: 'INSTANCE_NOT_FOUND',
      });
    });
  });

  describe('isDocumentApproved', () => {
    it('should return true for approved documents', async () => {
      const approvedInstance = {
        ...sampleInstance,
        status: 'approved',
      };

      mockFindInstanceByDocument.mockResolvedValue(approvedInstance);

      const result = await service.isDocumentApproved('journal_entry' as any, 'je-123');

      expect(result).toBe(true);
    });

    it('should return false for pending documents', async () => {
      mockFindInstanceByDocument.mockResolvedValue(sampleInstance);

      const result = await service.isDocumentApproved('journal_entry' as any, 'je-123');

      expect(result).toBe(false);
    });

    it('should return false for documents with no approval instance', async () => {
      mockFindInstanceByDocument.mockResolvedValue(null);

      const result = await service.isDocumentApproved('journal_entry' as any, 'je-123');

      expect(result).toBe(false);
    });
  });

  describe('requireApproval', () => {
    it('should not throw for approved documents', async () => {
      const approvedInstance = {
        ...sampleInstance,
        status: 'approved',
      };

      mockFindInstanceByDocument.mockResolvedValue(approvedInstance);

      await expect(
        service.requireApproval('journal_entry' as any, 'je-123')
      ).resolves.not.toThrow();
    });

    it('should throw APPROVAL_REQUIRED when no instance exists', async () => {
      mockFindInstanceByDocument.mockResolvedValue(null);

      await expect(
        service.requireApproval('journal_entry' as any, 'je-123')
      ).rejects.toThrow(ServiceError);
      await expect(
        service.requireApproval('journal_entry' as any, 'je-123')
      ).rejects.toMatchObject({
        code: 'APPROVAL_REQUIRED',
      });
    });

    it('should throw APPROVAL_PENDING when instance is pending', async () => {
      mockFindInstanceByDocument.mockResolvedValue(sampleInstance);

      await expect(
        service.requireApproval('journal_entry' as any, 'je-123')
      ).rejects.toThrow(ServiceError);
      await expect(
        service.requireApproval('journal_entry' as any, 'je-123')
      ).rejects.toMatchObject({
        code: 'APPROVAL_PENDING',
      });
    });
  });

  describe('getPendingApprovalsForUser', () => {
    it('should return pending approvals for user with matching roles', async () => {
      const pendingInstances = [sampleInstance];
      mockFindPendingInstancesForApprover.mockResolvedValue(pendingInstances);

      const result = await service.getPendingApprovalsForUser(['role-manager']);

      expect(result).toEqual(pendingInstances);
      expect(mockFindPendingInstancesForApprover).toHaveBeenCalledWith(
        testOrgId,
        testUserId,
        ['role-manager']
      );
    });
  });

  describe('checkAndEscalateOverdue', () => {
    it('should escalate overdue instances', async () => {
      const overdueInstance = {
        ...sampleInstance,
        submittedAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48 hours ago
        policySnapshot: JSON.stringify({
          ...samplePolicyWithSteps,
          steps: [{
            ...sampleSteps[0],
            escalationHours: 24, // Should be escalated after 24 hours
          }],
        }),
      };

      mockFindInstancesByStatus.mockImplementation((orgId, status) => {
        if (status === 'pending') return Promise.resolve([overdueInstance]);
        return Promise.resolve([]);
      });
      mockUpdateInstance.mockResolvedValue({ ...overdueInstance, status: 'escalated' });
      mockEmit.mockResolvedValue(undefined);

      const count = await service.checkAndEscalateOverdue();

      expect(count).toBe(1);
      expect(mockUpdateInstance).toHaveBeenCalledWith(
        overdueInstance.id,
        expect.objectContaining({ status: 'escalated' })
      );
      expect(mockEmit).toHaveBeenCalled();
    });

    it('should not escalate instances within time limit', async () => {
      const recentInstance = {
        ...sampleInstance,
        submittedAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
        policySnapshot: JSON.stringify({
          ...samplePolicyWithSteps,
          steps: [{
            ...sampleSteps[0],
            escalationHours: 24,
          }],
        }),
      };

      mockFindInstancesByStatus.mockImplementation((orgId, status) => {
        if (status === 'pending') return Promise.resolve([recentInstance]);
        return Promise.resolve([]);
      });

      const count = await service.checkAndEscalateOverdue();

      expect(count).toBe(0);
      expect(mockUpdateInstance).not.toHaveBeenCalled();
    });
  });

  describe('SoD enforcement in approvals', () => {
    beforeEach(() => {
      service = new ApprovalWorkflowService({
        organizationId: testOrgId,
        userId: testUserId, // Same as submitter
      });
    });

    it('should block approval when SoD violation detected', async () => {
      const sameUserRule = {
        id: 'rule-1',
        policyId: 'policy-1',
        ruleName: 'Creator Cannot Approve',
        ruleCode: 'CREATOR_APPROVER',
        conflictType: 'same_user',
        action1: 'submit',
        action2: 'approve',
        documentType: 'journal_entry',
        conflictingRoleIds: [],
        exemptRoleIds: [],
        exemptUserIds: [],
        isActive: true,
        severity: 'high',
      };

      const instanceWithActions = {
        ...sampleInstance,
        actions: [],
      };

      mockFindInstanceWithActions.mockResolvedValue(instanceWithActions);
      mockFindSodRulesForDocument.mockResolvedValue([sameUserRule]);
      mockCreateAction.mockResolvedValue({ id: 'action-1' });
      mockCreateViolation.mockResolvedValue({});

      const input: ProcessApprovalInput = {
        instanceId: 'instance-1',
        action: 'approve' as any,
      };

      await expect(service.processApproval(input)).rejects.toThrow(ServiceError);
      await expect(service.processApproval(input)).rejects.toMatchObject({
        code: 'SOD_VIOLATION',
      });
    });

    it('should allow approval when no SoD violation', async () => {
      // Set up service with different approver
      service = new ApprovalWorkflowService({
        organizationId: testOrgId,
        userId: testApproverId, // Different from submitter
      });

      const instanceWithActions = {
        ...sampleInstance,
        actions: [],
      };
      const updatedInstance = {
        ...sampleInstance,
        status: 'in_progress',
        currentStepNumber: 2,
      };
      const updatedInstanceWithActions = {
        ...updatedInstance,
        actions: [{ stepNumber: 1, action: 'approve', actionBy: testApproverId }],
      };

      // First call for processApproval, second call for getWorkflowStatus
      mockFindInstanceWithActions
        .mockResolvedValueOnce(instanceWithActions)
        .mockResolvedValueOnce(updatedInstanceWithActions);
      mockFindSodRulesForDocument.mockResolvedValue([]); // No rules = no violations
      mockCreateAction.mockResolvedValue({ id: 'action-1' });
      mockUpdateInstance.mockResolvedValue(updatedInstance);
      mockEmit.mockResolvedValue(undefined);

      const input: ProcessApprovalInput = {
        instanceId: 'instance-1',
        action: 'approve' as any,
      };

      const result = await service.processApproval(input);

      expect(result.instance.currentStepNumber).toBe(2);
    });
  });
});
