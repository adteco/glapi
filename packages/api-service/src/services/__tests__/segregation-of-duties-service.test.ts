import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceContext, ServiceError } from '../../types';

// Use vi.hoisted() to properly hoist mock functions for use in vi.mock factory
const {
  mockFindSodRulesForDocument,
  mockCreateViolation,
  mockFindViolationsByDocument,
  mockFindViolationsByUser,
  mockFindRecentViolations,
  mockCountViolationsBySeverity,
} = vi.hoisted(() => ({
  mockFindSodRulesForDocument: vi.fn(),
  mockCreateViolation: vi.fn(),
  mockFindViolationsByDocument: vi.fn(),
  mockFindViolationsByUser: vi.fn(),
  mockFindRecentViolations: vi.fn(),
  mockCountViolationsBySeverity: vi.fn(),
}));

// Mock the database module
vi.mock('@glapi/database', () => ({
  approvalWorkflowRepository: {
    findSodRulesForDocument: mockFindSodRulesForDocument,
    createViolation: mockCreateViolation,
    findViolationsByDocument: mockFindViolationsByDocument,
    findViolationsByUser: mockFindViolationsByUser,
    findRecentViolations: mockFindRecentViolations,
    countViolationsBySeverity: mockCountViolationsBySeverity,
  },
  SodConflictTypes: {
    SAME_USER: 'same_user',
    SAME_ROLE: 'same_role',
    ROLE_PAIR: 'role_pair',
    SUBSIDIARY_BASED: 'subsidiary_based',
  },
  SodEnforcementModes: {
    BLOCK: 'block',
    WARN: 'warn',
    LOG_ONLY: 'log_only',
  },
  SodSeverityLevels: {
    CRITICAL: 'critical',
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low',
  },
}));

// Import after mocking
import { SegregationOfDutiesService, SodCheckContext } from '../segregation-of-duties-service';

describe('SegregationOfDutiesService', () => {
  let service: SegregationOfDutiesService;

  const testOrgId = 'org-123';
  const testUserId = 'user-123';
  const testRoleId = 'role-123';

  // Sample SoD rules for testing
  const sameUserRule = {
    id: 'rule-1',
    policyId: 'policy-1',
    ruleName: 'Creator Cannot Approve',
    ruleCode: 'CREATOR_APPROVER',
    description: 'User who creates cannot approve',
    conflictType: 'same_user',
    action1: 'create',
    action2: 'approve',
    documentType: 'journal_entry',
    conflictingRoleIds: [],
    requireDifferentSubsidiary: false,
    requireDifferentDepartment: false,
    exemptRoleIds: [],
    exemptUserIds: [],
    isActive: true,
    severity: 'high',
    createdAt: new Date(),
  };

  const sameRoleRule = {
    id: 'rule-2',
    policyId: 'policy-1',
    ruleName: 'Same Role Separation',
    ruleCode: 'SAME_ROLE_SEP',
    description: 'Users with same role cannot both act',
    conflictType: 'same_role',
    action1: 'submit',
    action2: 'approve',
    documentType: 'purchase_order',
    conflictingRoleIds: [],
    requireDifferentSubsidiary: false,
    requireDifferentDepartment: false,
    exemptRoleIds: [],
    exemptUserIds: [],
    isActive: true,
    severity: 'high', // High severity to ensure blocking
    createdAt: new Date(),
  };

  const rolePairRule = {
    id: 'rule-3',
    policyId: 'policy-1',
    ruleName: 'Role Pair Conflict',
    ruleCode: 'ROLE_PAIR_CONFLICT',
    description: 'Certain role pairs cannot both act',
    conflictType: 'role_pair',
    action1: 'create',
    action2: 'post',
    documentType: 'vendor_bill',
    conflictingRoleIds: ['role-ap-clerk', 'role-ap-manager'],
    requireDifferentSubsidiary: false,
    requireDifferentDepartment: false,
    exemptRoleIds: [],
    exemptUserIds: [],
    isActive: true,
    severity: 'high',
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SegregationOfDutiesService({
      organizationId: testOrgId,
      userId: testUserId,
    });
  });

  describe('checkAction', () => {
    it('should allow action when no SoD rules are configured', async () => {
      mockFindSodRulesForDocument.mockResolvedValue([]);

      const context: SodCheckContext = {
        documentType: 'journal_entry',
        documentId: 'doc-123',
        action: 'approve',
        userId: testUserId,
        userRoleIds: [testRoleId],
      };

      const result = await service.checkAction(context);

      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect same_user violation', async () => {
      mockFindSodRulesForDocument.mockResolvedValue([sameUserRule]);

      const context: SodCheckContext = {
        documentType: 'journal_entry',
        documentId: 'doc-123',
        action: 'approve',
        userId: testUserId,
        userRoleIds: [testRoleId],
        priorActions: [
          {
            action: 'create',
            userId: testUserId, // Same user created it
            userRoleIds: [testRoleId],
            performedAt: new Date(),
          },
        ],
      };

      const result = await service.checkAction(context);

      expect(result.allowed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].conflictType).toBe('same_user');
      expect(result.violations[0].ruleName).toBe('Creator Cannot Approve');
    });

    it('should allow when different user performs actions', async () => {
      mockFindSodRulesForDocument.mockResolvedValue([sameUserRule]);

      const context: SodCheckContext = {
        documentType: 'journal_entry',
        documentId: 'doc-123',
        action: 'approve',
        userId: testUserId,
        userRoleIds: [testRoleId],
        priorActions: [
          {
            action: 'create',
            userId: 'other-user-456', // Different user created it
            userRoleIds: ['other-role'],
            performedAt: new Date(),
          },
        ],
      };

      const result = await service.checkAction(context);

      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect same_role violation', async () => {
      mockFindSodRulesForDocument.mockResolvedValue([sameRoleRule]);

      const context: SodCheckContext = {
        documentType: 'purchase_order',
        documentId: 'po-123',
        action: 'approve',
        userId: testUserId,
        userRoleIds: ['shared-role-123'],
        priorActions: [
          {
            action: 'submit',
            userId: 'other-user-456', // Different user
            userRoleIds: ['shared-role-123'], // But same role
            performedAt: new Date(),
          },
        ],
      };

      const result = await service.checkAction(context);

      expect(result.allowed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].conflictType).toBe('same_role');
    });

    it('should allow when users have different roles', async () => {
      mockFindSodRulesForDocument.mockResolvedValue([sameRoleRule]);

      const context: SodCheckContext = {
        documentType: 'purchase_order',
        documentId: 'po-123',
        action: 'approve',
        userId: testUserId,
        userRoleIds: ['role-approver'],
        priorActions: [
          {
            action: 'submit',
            userId: 'other-user-456',
            userRoleIds: ['role-submitter'], // Different role
            performedAt: new Date(),
          },
        ],
      };

      const result = await service.checkAction(context);

      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect role_pair violation', async () => {
      mockFindSodRulesForDocument.mockResolvedValue([rolePairRule]);

      const context: SodCheckContext = {
        documentType: 'vendor_bill',
        documentId: 'bill-123',
        action: 'post',
        userId: testUserId,
        userRoleIds: ['role-ap-manager'], // Has one of the conflicting roles
        priorActions: [
          {
            action: 'create',
            userId: 'other-user-456',
            userRoleIds: ['role-ap-clerk'], // Has the other conflicting role
            performedAt: new Date(),
          },
        ],
      };

      const result = await service.checkAction(context);

      expect(result.allowed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].conflictType).toBe('role_pair');
    });

    it('should respect user exemptions', async () => {
      const ruleWithExemption = {
        ...sameUserRule,
        exemptUserIds: [testUserId], // User is exempt
      };
      mockFindSodRulesForDocument.mockResolvedValue([ruleWithExemption]);

      const context: SodCheckContext = {
        documentType: 'journal_entry',
        documentId: 'doc-123',
        action: 'approve',
        userId: testUserId,
        userRoleIds: [testRoleId],
        priorActions: [
          {
            action: 'create',
            userId: testUserId,
            userRoleIds: [testRoleId],
            performedAt: new Date(),
          },
        ],
      };

      const result = await service.checkAction(context);

      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should respect role exemptions', async () => {
      const ruleWithExemption = {
        ...sameUserRule,
        exemptRoleIds: [testRoleId], // Role is exempt
      };
      mockFindSodRulesForDocument.mockResolvedValue([ruleWithExemption]);

      const context: SodCheckContext = {
        documentType: 'journal_entry',
        documentId: 'doc-123',
        action: 'approve',
        userId: testUserId,
        userRoleIds: [testRoleId],
        priorActions: [
          {
            action: 'create',
            userId: testUserId,
            userRoleIds: [testRoleId],
            performedAt: new Date(),
          },
        ],
      };

      const result = await service.checkAction(context);

      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should return multiple violations when multiple rules are violated', async () => {
      const multipleRules = [
        sameUserRule,
        { ...sameRoleRule, action1: 'create', action2: 'approve', documentType: 'journal_entry' },
      ];
      mockFindSodRulesForDocument.mockResolvedValue(multipleRules);

      const context: SodCheckContext = {
        documentType: 'journal_entry',
        documentId: 'doc-123',
        action: 'approve',
        userId: testUserId,
        userRoleIds: ['shared-role'],
        priorActions: [
          {
            action: 'create',
            userId: testUserId, // Same user and same role
            userRoleIds: ['shared-role'],
            performedAt: new Date(),
          },
        ],
      };

      const result = await service.checkAction(context);

      expect(result.allowed).toBe(false);
      expect(result.violations).toHaveLength(2);
    });
  });

  describe('enforceAction', () => {
    it('should throw ServiceError when action is blocked', async () => {
      mockFindSodRulesForDocument.mockResolvedValue([sameUserRule]);
      mockCreateViolation.mockResolvedValue({});

      const context: SodCheckContext = {
        documentType: 'journal_entry',
        documentId: 'doc-123',
        action: 'approve',
        userId: testUserId,
        userRoleIds: [testRoleId],
        priorActions: [
          {
            action: 'create',
            userId: testUserId,
            userRoleIds: [testRoleId],
            performedAt: new Date(),
          },
        ],
      };

      await expect(service.enforceAction(context)).rejects.toThrow(ServiceError);
      await expect(service.enforceAction(context)).rejects.toMatchObject({
        code: 'SOD_VIOLATION',
        statusCode: 403,
      });

      // Should log the violation
      expect(mockCreateViolation).toHaveBeenCalled();
    });

    it('should return warnings when enforcement mode allows action', async () => {
      const lowSeverityRule = { ...sameUserRule, severity: 'low' };
      mockFindSodRulesForDocument.mockResolvedValue([lowSeverityRule]);
      mockCreateViolation.mockResolvedValue({});

      const context: SodCheckContext = {
        documentType: 'journal_entry',
        documentId: 'doc-123',
        action: 'approve',
        userId: testUserId,
        userRoleIds: [testRoleId],
        priorActions: [
          {
            action: 'create',
            userId: testUserId,
            userRoleIds: [testRoleId],
            performedAt: new Date(),
          },
        ],
      };

      const warnings = await service.enforceAction(context);

      expect(warnings).toHaveLength(1);
      expect(mockCreateViolation).toHaveBeenCalled();
    });

    it('should not log violations when action is allowed without issues', async () => {
      mockFindSodRulesForDocument.mockResolvedValue([]);

      const context: SodCheckContext = {
        documentType: 'journal_entry',
        documentId: 'doc-123',
        action: 'approve',
        userId: testUserId,
        userRoleIds: [testRoleId],
      };

      const warnings = await service.enforceAction(context);

      expect(warnings).toHaveLength(0);
      expect(mockCreateViolation).not.toHaveBeenCalled();
    });
  });

  describe('getDocumentViolations', () => {
    it('should return violations for a document', async () => {
      const mockViolations = [
        {
          id: 'violation-1',
          documentType: 'journal_entry',
          documentId: 'doc-123',
          attemptedBy: testUserId,
          attemptedAction: 'approve',
          wasBlocked: true,
        },
      ];
      mockFindViolationsByDocument.mockResolvedValue(mockViolations);

      const violations = await service.getDocumentViolations('journal_entry', 'doc-123');

      expect(violations).toEqual(mockViolations);
      expect(mockFindViolationsByDocument).toHaveBeenCalledWith('journal_entry', 'doc-123');
    });
  });

  describe('getUserViolations', () => {
    it('should return violations for the current user', async () => {
      const mockViolations = [
        {
          id: 'violation-1',
          attemptedBy: testUserId,
          wasBlocked: true,
        },
      ];
      mockFindViolationsByUser.mockResolvedValue(mockViolations);

      const violations = await service.getUserViolations();

      expect(violations).toEqual(mockViolations);
      expect(mockFindViolationsByUser).toHaveBeenCalledWith(testOrgId, testUserId, 50);
    });
  });

  describe('getRecentViolations', () => {
    it('should return recent violations for the organization', async () => {
      const mockViolations = [
        { id: 'violation-1', wasBlocked: true },
        { id: 'violation-2', wasBlocked: false },
      ];
      mockFindRecentViolations.mockResolvedValue(mockViolations);

      const violations = await service.getRecentViolations(100);

      expect(violations).toEqual(mockViolations);
      expect(mockFindRecentViolations).toHaveBeenCalledWith(testOrgId, 100);
    });
  });

  describe('getViolationStats', () => {
    it('should return violation statistics by severity', async () => {
      const mockStats = [
        { severity: 'high', count: 5 },
        { severity: 'medium', count: 10 },
        { severity: 'low', count: 3 },
      ];
      mockCountViolationsBySeverity.mockResolvedValue(mockStats);

      const stats = await service.getViolationStats();

      expect(stats).toEqual(mockStats);
      expect(mockCountViolationsBySeverity).toHaveBeenCalledWith(testOrgId);
    });
  });
});
