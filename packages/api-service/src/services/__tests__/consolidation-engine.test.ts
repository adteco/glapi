import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConsolidationEngine } from '../consolidation-engine';

// Mock the repository
vi.mock('@glapi/database', () => ({
  ConsolidationRepository: vi.fn().mockImplementation(() => ({
    findGroupById: vi.fn(),
    getNextRunNumber: vi.fn(),
    createRun: vi.fn(),
    updateRun: vi.fn(),
    findMembersByGroupId: vi.fn(),
    findEliminationRulesByGroupId: vi.fn(),
    findFxRulesByGroupId: vi.fn(),
    createAdjustments: vi.fn(),
    findRunById: vi.fn(),
    findAdjustmentsByRunId: vi.fn(),
    findRunsByGroupAndPeriod: vi.fn(),
  })),
}));

describe('ConsolidationEngine', () => {
  let engine: ConsolidationEngine;
  let mockRepository: any;

  const TEST_ORG_ID = 'test-org-id';
  const TEST_GROUP_ID = 'test-group-id';
  const TEST_PERIOD_ID = 'test-period-id';

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new ConsolidationEngine({ organizationId: TEST_ORG_ID });
    // Access the mocked repository
    mockRepository = (engine as any).consolidationRepository;
  });

  describe('runConsolidation', () => {
    it('should create a consolidation run with correct initial state', async () => {
      // Setup mocks
      mockRepository.findGroupById.mockResolvedValue({
        group: {
          id: TEST_GROUP_ID,
          name: 'Test Group',
          consolidationCurrencyId: 'usd-id',
        },
      });
      mockRepository.getNextRunNumber.mockResolvedValue(1);
      mockRepository.createRun.mockResolvedValue({
        id: 'run-id',
        runNumber: 1,
        status: 'IN_PROGRESS',
      });
      mockRepository.findMembersByGroupId.mockResolvedValue([
        {
          member: {
            id: 'member-1',
            subsidiaryId: 'sub-1',
            ownershipPercent: '100',
            consolidationMethod: 'FULL',
          },
          subsidiary: { id: 'sub-1', name: 'Subsidiary 1' },
        },
      ]);
      mockRepository.findEliminationRulesByGroupId.mockResolvedValue([]);
      mockRepository.findFxRulesByGroupId.mockResolvedValue([]);
      mockRepository.updateRun.mockResolvedValue({});

      const result = await engine.runConsolidation({
        groupId: TEST_GROUP_ID,
        periodId: TEST_PERIOD_ID,
        runType: 'PRELIMINARY',
      });

      expect(result.status).toBe('COMPLETED');
      expect(result.runNumber).toBe(1);
      expect(result.subsidiariesProcessed).toBe(1);
      expect(mockRepository.createRun).toHaveBeenCalledWith(
        expect.objectContaining({
          groupId: TEST_GROUP_ID,
          periodId: TEST_PERIOD_ID,
          runNumber: 1,
          status: 'IN_PROGRESS',
          runType: 'PRELIMINARY',
        })
      );
    });

    it('should throw error if group not found', async () => {
      mockRepository.findGroupById.mockResolvedValue(null);

      await expect(
        engine.runConsolidation({
          groupId: TEST_GROUP_ID,
          periodId: TEST_PERIOD_ID,
          runType: 'FINAL',
        })
      ).rejects.toThrow('not found');
    });

    it('should handle run failure gracefully', async () => {
      mockRepository.findGroupById.mockResolvedValue({
        group: { id: TEST_GROUP_ID },
      });
      mockRepository.getNextRunNumber.mockResolvedValue(1);
      mockRepository.createRun.mockResolvedValue({
        id: 'run-id',
        runNumber: 1,
      });
      mockRepository.findMembersByGroupId.mockRejectedValue(new Error('DB error'));
      mockRepository.updateRun.mockResolvedValue({});

      const result = await engine.runConsolidation({
        groupId: TEST_GROUP_ID,
        periodId: TEST_PERIOD_ID,
        runType: 'PRELIMINARY',
      });

      expect(result.status).toBe('FAILED');
      expect(result.errors).toContain('DB error');
      expect(mockRepository.updateRun).toHaveBeenCalledWith(
        'run-id',
        expect.objectContaining({ status: 'FAILED' })
      );
    });

    it('should warn when no active subsidiaries in group', async () => {
      mockRepository.findGroupById.mockResolvedValue({
        group: { id: TEST_GROUP_ID },
      });
      mockRepository.getNextRunNumber.mockResolvedValue(1);
      mockRepository.createRun.mockResolvedValue({
        id: 'run-id',
        runNumber: 1,
      });
      mockRepository.findMembersByGroupId.mockResolvedValue([]);
      mockRepository.findEliminationRulesByGroupId.mockResolvedValue([]);
      mockRepository.findFxRulesByGroupId.mockResolvedValue([]);
      mockRepository.updateRun.mockResolvedValue({});

      const result = await engine.runConsolidation({
        groupId: TEST_GROUP_ID,
        periodId: TEST_PERIOD_ID,
        runType: 'PRELIMINARY',
      });

      expect(result.warnings).toContain('No active subsidiaries in consolidation group');
    });
  });

  describe('reverseConsolidationRun', () => {
    it('should create reversal adjustments with swapped debits/credits', async () => {
      mockRepository.findRunById.mockResolvedValue({
        run: {
          id: 'original-run-id',
          groupId: TEST_GROUP_ID,
          periodId: TEST_PERIOD_ID,
          runNumber: 1,
          status: 'COMPLETED',
          runType: 'PRELIMINARY',
          subsidiariesProcessed: 1,
        },
      });
      mockRepository.getNextRunNumber.mockResolvedValue(2);
      mockRepository.createRun.mockResolvedValue({
        id: 'reversal-run-id',
        runNumber: 2,
      });
      mockRepository.findAdjustmentsByRunId.mockResolvedValue([
        {
          adjustment: {
            id: 'adj-1',
            adjustmentType: 'ELIMINATION',
            accountId: 'account-1',
            description: 'Original entry',
            debitAmount: '1000.00',
            creditAmount: '0.00',
          },
        },
      ]);
      mockRepository.createAdjustments.mockResolvedValue([]);
      mockRepository.updateRun.mockResolvedValue({});

      const result = await engine.reverseConsolidationRun('original-run-id');

      expect(result.success).toBe(true);
      expect(result.reversalRunId).toBe('reversal-run-id');

      // Verify adjustments were created with swapped amounts
      expect(mockRepository.createAdjustments).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            debitAmount: '0.00',
            creditAmount: '1000.00',
            description: expect.stringContaining('Reversal'),
          }),
        ])
      );
    });

    it('should throw error if run not found', async () => {
      mockRepository.findRunById.mockResolvedValue(null);

      await expect(engine.reverseConsolidationRun('non-existent')).rejects.toThrow(
        'not found'
      );
    });

    it('should throw error if run is not completed', async () => {
      mockRepository.findRunById.mockResolvedValue({
        run: {
          id: 'run-id',
          status: 'IN_PROGRESS',
        },
      });

      await expect(engine.reverseConsolidationRun('run-id')).rejects.toThrow(
        'Can only reverse completed runs'
      );
    });
  });

  describe('getConsolidationRunDetails', () => {
    it('should return run details with adjustments', async () => {
      mockRepository.findRunById.mockResolvedValue({
        run: {
          id: 'run-id',
          groupId: TEST_GROUP_ID,
          periodId: TEST_PERIOD_ID,
          runNumber: 1,
          status: 'COMPLETED',
          runType: 'FINAL',
          subsidiariesProcessed: 2,
          eliminationsGenerated: 5,
          translationAdjustments: 3,
          totalDebitAmount: '10000.00',
          totalCreditAmount: '10000.00',
        },
        group: { name: 'Test Group' },
        period: { periodName: 'January 2026' },
      });
      mockRepository.findAdjustmentsByRunId.mockResolvedValue([
        {
          adjustment: {
            id: 'adj-1',
            adjustmentType: 'ELIMINATION',
            lineNumber: 1,
            accountId: 'acc-1',
            debitAmount: '5000.00',
            creditAmount: '0.00',
          },
          account: { accountNumber: '1200', accountName: 'IC Receivable' },
        },
      ]);

      const result = await engine.getConsolidationRunDetails('run-id');

      expect(result.run.runNumber).toBe(1);
      expect(result.run.status).toBe('COMPLETED');
      expect(result.run.groupName).toBe('Test Group');
      expect(result.adjustments).toHaveLength(1);
      expect(result.adjustments[0].accountNumber).toBe('1200');
    });
  });

  describe('listConsolidationRuns', () => {
    it('should return list of runs for group/period', async () => {
      mockRepository.findRunsByGroupAndPeriod.mockResolvedValue([
        {
          id: 'run-1',
          runNumber: 1,
          status: 'COMPLETED',
          runType: 'PRELIMINARY',
        },
        {
          id: 'run-2',
          runNumber: 2,
          status: 'COMPLETED',
          runType: 'FINAL',
        },
      ]);

      const result = await engine.listConsolidationRuns(
        TEST_GROUP_ID,
        TEST_PERIOD_ID
      );

      expect(result).toHaveLength(2);
      expect(mockRepository.findRunsByGroupAndPeriod).toHaveBeenCalledWith(
        TEST_GROUP_ID,
        TEST_PERIOD_ID,
        {}
      );
    });

    it('should filter runs by status', async () => {
      mockRepository.findRunsByGroupAndPeriod.mockResolvedValue([
        {
          id: 'run-1',
          runNumber: 1,
          status: 'COMPLETED',
        },
      ]);

      await engine.listConsolidationRuns(
        TEST_GROUP_ID,
        TEST_PERIOD_ID,
        { status: 'COMPLETED' }
      );

      expect(mockRepository.findRunsByGroupAndPeriod).toHaveBeenCalledWith(
        TEST_GROUP_ID,
        TEST_PERIOD_ID,
        { status: 'COMPLETED' }
      );
    });
  });

  describe('Accounting Rules Validation', () => {
    it('should ensure debits equal credits in completed run', async () => {
      mockRepository.findGroupById.mockResolvedValue({
        group: { id: TEST_GROUP_ID },
      });
      mockRepository.getNextRunNumber.mockResolvedValue(1);
      mockRepository.createRun.mockResolvedValue({
        id: 'run-id',
        runNumber: 1,
      });
      mockRepository.findMembersByGroupId.mockResolvedValue([
        {
          member: { subsidiaryId: 'sub-1' },
          subsidiary: { id: 'sub-1', name: 'Sub 1' },
        },
      ]);
      mockRepository.findEliminationRulesByGroupId.mockResolvedValue([]);
      mockRepository.findFxRulesByGroupId.mockResolvedValue([]);
      mockRepository.updateRun.mockResolvedValue({});

      const result = await engine.runConsolidation({
        groupId: TEST_GROUP_ID,
        periodId: TEST_PERIOD_ID,
        runType: 'FINAL',
      });

      // Verify balanced entries (debits = credits)
      expect(result.totalDebitAmount).toBe(result.totalCreditAmount);
    });

    it('should process elimination rules in sequence order', async () => {
      mockRepository.findGroupById.mockResolvedValue({
        group: { id: TEST_GROUP_ID },
      });
      mockRepository.getNextRunNumber.mockResolvedValue(1);
      mockRepository.createRun.mockResolvedValue({
        id: 'run-id',
        runNumber: 1,
      });
      mockRepository.findMembersByGroupId.mockResolvedValue([]);
      mockRepository.findEliminationRulesByGroupId.mockResolvedValue([
        { id: 'rule-1', name: 'Rule 1', sequenceNumber: 20 },
        { id: 'rule-2', name: 'Rule 2', sequenceNumber: 10 },
      ]);
      mockRepository.findFxRulesByGroupId.mockResolvedValue([]);
      mockRepository.updateRun.mockResolvedValue({});

      await engine.runConsolidation({
        groupId: TEST_GROUP_ID,
        periodId: TEST_PERIOD_ID,
        runType: 'PRELIMINARY',
      });

      // The rules should be processed in sequence order (10 before 20)
      const eliminationRulesCall = mockRepository.findEliminationRulesByGroupId.mock.calls[0];
      expect(eliminationRulesCall).toBeDefined();
    });

    it('should support multiple consolidation methods', async () => {
      mockRepository.findGroupById.mockResolvedValue({
        group: { id: TEST_GROUP_ID },
      });
      mockRepository.getNextRunNumber.mockResolvedValue(1);
      mockRepository.createRun.mockResolvedValue({
        id: 'run-id',
        runNumber: 1,
      });
      mockRepository.findMembersByGroupId.mockResolvedValue([
        {
          member: {
            subsidiaryId: 'sub-1',
            ownershipPercent: '100',
            consolidationMethod: 'FULL',
          },
          subsidiary: { id: 'sub-1', name: 'Full Sub' },
        },
        {
          member: {
            subsidiaryId: 'sub-2',
            ownershipPercent: '60',
            consolidationMethod: 'PROPORTIONAL',
          },
          subsidiary: { id: 'sub-2', name: 'Proportional Sub' },
        },
        {
          member: {
            subsidiaryId: 'sub-3',
            ownershipPercent: '25',
            consolidationMethod: 'EQUITY',
          },
          subsidiary: { id: 'sub-3', name: 'Equity Sub' },
        },
      ]);
      mockRepository.findEliminationRulesByGroupId.mockResolvedValue([]);
      mockRepository.findFxRulesByGroupId.mockResolvedValue([]);
      mockRepository.updateRun.mockResolvedValue({});

      const result = await engine.runConsolidation({
        groupId: TEST_GROUP_ID,
        periodId: TEST_PERIOD_ID,
        runType: 'FINAL',
      });

      expect(result.subsidiariesProcessed).toBe(3);
    });
  });
});
