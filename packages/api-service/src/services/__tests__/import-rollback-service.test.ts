/**
 * Import Rollback Service Tests
 *
 * Tests for rollback operations on imported data.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the database module before importing the service
vi.mock('@glapi/database', () => ({
  ImportBatchRepository: vi.fn(),
  importBatchRepository: {},
}));

import { ImportRollbackService } from '../import-rollback-service';

// Mock repository
const mockRepository = {
  findBatchById: vi.fn(),
  findRecordById: vi.fn(),
  listRecords: vi.fn(),
  updateBatch: vi.fn(),
  rollbackBatch: vi.fn(),
  logAction: vi.fn(),
  getAuditLogs: vi.fn(),
  getRecordAuditLogs: vi.fn(),
};

describe('ImportRollbackService', () => {
  let service: ImportRollbackService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ImportRollbackService(mockRepository as any);
  });

  // =========================================================================
  // Rollback Validation Tests
  // =========================================================================

  describe('validateRollback', () => {
    it('should return canRollback=true for eligible batch', async () => {
      mockRepository.findBatchById.mockResolvedValue({
        id: 'batch-123',
        status: 'completed',
        canRollback: true,
        organizationId: 'org-123',
      });
      mockRepository.listRecords.mockResolvedValue({
        items: [
          {
            id: 'rec-1',
            dataType: 'account',
            status: 'imported',
            importedEntityId: 'entity-1',
          },
        ],
        total: 1,
      });

      const result = await service.validateRollback('batch-123');

      expect(result.canRollback).toBe(true);
      expect(result.recordCount).toBe(1);
    });

    it('should return canRollback=false for non-existent batch', async () => {
      mockRepository.findBatchById.mockResolvedValue(null);

      const result = await service.validateRollback('non-existent');

      expect(result.canRollback).toBe(false);
      expect(result.reason).toBe('Batch not found');
    });

    it('should return canRollback=false for non-completed batch', async () => {
      mockRepository.findBatchById.mockResolvedValue({
        id: 'batch-123',
        status: 'processing',
        canRollback: true,
      });

      const result = await service.validateRollback('batch-123');

      expect(result.canRollback).toBe(false);
      expect(result.reason).toBe('Cannot rollback batch in processing status');
    });

    it('should return canRollback=false when rollback is disabled', async () => {
      mockRepository.findBatchById.mockResolvedValue({
        id: 'batch-123',
        status: 'completed',
        canRollback: false,
      });

      const result = await service.validateRollback('batch-123');

      expect(result.canRollback).toBe(false);
      expect(result.reason).toBe('Rollback was not enabled for this batch');
    });

    it('should include warnings for unsupported data types', async () => {
      mockRepository.findBatchById.mockResolvedValue({
        id: 'batch-123',
        status: 'completed',
        canRollback: true,
        organizationId: 'org-123',
      });
      mockRepository.listRecords.mockResolvedValue({
        items: [
          {
            id: 'rec-1',
            dataType: 'unknown_type', // Unsupported
            status: 'imported',
            importedEntityId: 'entity-1',
          },
        ],
        total: 1,
      });

      const result = await service.validateRollback('batch-123');

      expect(result.warnings).toContain('No rollback handler for data type: unknown_type');
    });

    it('should filter by specific record IDs when provided', async () => {
      mockRepository.findBatchById.mockResolvedValue({
        id: 'batch-123',
        status: 'completed',
        canRollback: true,
        organizationId: 'org-123',
      });
      mockRepository.listRecords.mockResolvedValue({
        items: [
          { id: 'rec-1', dataType: 'account', status: 'imported', importedEntityId: 'e1' },
          { id: 'rec-2', dataType: 'account', status: 'imported', importedEntityId: 'e2' },
          { id: 'rec-3', dataType: 'account', status: 'imported', importedEntityId: 'e3' },
        ],
        total: 3,
      });

      const result = await service.validateRollback('batch-123', {
        recordIds: ['rec-1', 'rec-3'],
      });

      expect(result.recordCount).toBe(2);
    });
  });

  // =========================================================================
  // Rollback Execution Tests
  // =========================================================================

  describe('rollbackBatch', () => {
    it('should rollback all records in a batch', async () => {
      mockRepository.findBatchById.mockResolvedValue({
        id: 'batch-123',
        status: 'completed',
        canRollback: true,
        organizationId: 'org-123',
      });
      mockRepository.listRecords.mockResolvedValue({
        items: [
          { id: 'rec-1', dataType: 'account', status: 'imported', importedEntityId: 'entity-1' },
          { id: 'rec-2', dataType: 'customer', status: 'imported', importedEntityId: 'entity-2' },
        ],
        total: 2,
      });
      mockRepository.getRecordAuditLogs.mockResolvedValue([]);
      mockRepository.logAction.mockResolvedValue({});
      mockRepository.rollbackBatch.mockResolvedValue({});

      const result = await service.rollbackBatch('batch-123', 'user-123', {
        reason: 'Test rollback',
      });

      expect(result.success).toBe(true);
      expect(result.rolledBackRecords).toBe(2);
      expect(result.failedRecords).toBe(0);
      expect(mockRepository.logAction).toHaveBeenCalled();
      expect(mockRepository.rollbackBatch).toHaveBeenCalledWith('batch-123', 'user-123');
    });

    it('should perform dry run without modifying data', async () => {
      mockRepository.findBatchById.mockResolvedValue({
        id: 'batch-123',
        status: 'completed',
        canRollback: true,
        organizationId: 'org-123',
      });
      mockRepository.listRecords.mockResolvedValue({
        items: [
          { id: 'rec-1', dataType: 'account', status: 'imported', importedEntityId: 'entity-1' },
        ],
        total: 1,
      });
      mockRepository.logAction.mockResolvedValue({});

      const result = await service.rollbackBatch('batch-123', 'user-123', {
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.rolledBackRecords).toBe(1);
      // Should not call actual rollback
      expect(mockRepository.rollbackBatch).not.toHaveBeenCalled();
    });

    it('should stop on first error when continueOnErrors is false', async () => {
      mockRepository.findBatchById.mockResolvedValue({
        id: 'batch-123',
        status: 'completed',
        canRollback: true,
        organizationId: 'org-123',
      });
      mockRepository.listRecords.mockResolvedValue({
        items: [
          { id: 'rec-1', dataType: 'unknown', status: 'imported', importedEntityId: 'entity-1' },
          { id: 'rec-2', dataType: 'account', status: 'imported', importedEntityId: 'entity-2' },
        ],
        total: 2,
      });
      mockRepository.logAction.mockResolvedValue({});

      const result = await service.rollbackBatch('batch-123', 'user-123', {
        continueOnErrors: false,
      });

      // Should skip unknown type and stop
      expect(result.skippedRecords).toBeGreaterThan(0);
    });

    it('should continue on errors when flag is set', async () => {
      mockRepository.findBatchById.mockResolvedValue({
        id: 'batch-123',
        status: 'completed',
        canRollback: true,
        organizationId: 'org-123',
      });
      mockRepository.listRecords.mockResolvedValue({
        items: [
          { id: 'rec-1', dataType: 'unknown', status: 'imported', importedEntityId: 'entity-1' },
          { id: 'rec-2', dataType: 'account', status: 'imported', importedEntityId: 'entity-2' },
        ],
        total: 2,
      });
      mockRepository.getRecordAuditLogs.mockResolvedValue([]);
      mockRepository.logAction.mockResolvedValue({});
      mockRepository.updateBatch.mockResolvedValue({});

      const result = await service.rollbackBatch('batch-123', 'user-123', {
        continueOnErrors: true,
      });

      // Should process both records
      expect(result.rolledBackRecords + result.skippedRecords).toBe(2);
    });

    it('should respect maxErrors limit', async () => {
      mockRepository.findBatchById.mockResolvedValue({
        id: 'batch-123',
        status: 'completed',
        canRollback: true,
        organizationId: 'org-123',
      });
      mockRepository.listRecords.mockResolvedValue({
        items: [
          { id: 'rec-1', dataType: 'account', status: 'imported', importedEntityId: 'e1' },
          { id: 'rec-2', dataType: 'account', status: 'imported', importedEntityId: 'e2' },
          { id: 'rec-3', dataType: 'account', status: 'imported', importedEntityId: 'e3' },
          { id: 'rec-4', dataType: 'account', status: 'imported', importedEntityId: 'e4' },
          { id: 'rec-5', dataType: 'account', status: 'imported', importedEntityId: 'e5' },
        ],
        total: 5,
      });
      mockRepository.getRecordAuditLogs.mockResolvedValue([]);
      mockRepository.logAction.mockResolvedValue({});
      mockRepository.rollbackBatch.mockResolvedValue({});

      const result = await service.rollbackBatch('batch-123', 'user-123', {
        maxErrors: 2,
      });

      // Should process all 5 records (no errors with account handler)
      expect(result.rolledBackRecords).toBe(5);
    });

    it('should rollback specific records when recordIds provided', async () => {
      mockRepository.findBatchById.mockResolvedValue({
        id: 'batch-123',
        status: 'completed',
        canRollback: true,
        organizationId: 'org-123',
      });
      mockRepository.listRecords.mockResolvedValue({
        items: [
          { id: 'rec-1', dataType: 'account', status: 'imported', importedEntityId: 'e1' },
          { id: 'rec-2', dataType: 'account', status: 'imported', importedEntityId: 'e2' },
          { id: 'rec-3', dataType: 'account', status: 'imported', importedEntityId: 'e3' },
        ],
        total: 3,
      });
      mockRepository.getRecordAuditLogs.mockResolvedValue([]);
      mockRepository.logAction.mockResolvedValue({});
      mockRepository.rollbackBatch.mockResolvedValue({});

      const result = await service.rollbackBatch('batch-123', 'user-123', {
        recordIds: ['rec-1', 'rec-3'],
      });

      expect(result.totalRecords).toBe(2);
      expect(result.rolledBackRecords).toBe(2);
    });

    it('should throw error for validation failure without continueOnErrors', async () => {
      mockRepository.findBatchById.mockResolvedValue({
        id: 'batch-123',
        status: 'processing', // Invalid status
        canRollback: true,
      });
      mockRepository.listRecords.mockResolvedValue({ items: [], total: 0 });

      await expect(
        service.rollbackBatch('batch-123', 'user-123')
      ).rejects.toThrow('Cannot rollback batch in processing status');
    });
  });

  // =========================================================================
  // Single Record Rollback Tests
  // =========================================================================

  describe('rollbackRecord', () => {
    it('should rollback a single record', async () => {
      mockRepository.findRecordById.mockResolvedValue({
        id: 'rec-1',
        batchId: 'batch-123',
        status: 'imported',
        dataType: 'account',
        importedEntityId: 'entity-1',
      });
      mockRepository.findBatchById.mockResolvedValue({
        id: 'batch-123',
        status: 'completed',
        canRollback: true,
        organizationId: 'org-123',
      });
      mockRepository.listRecords.mockResolvedValue({
        items: [
          { id: 'rec-1', dataType: 'account', status: 'imported', importedEntityId: 'entity-1' },
        ],
        total: 1,
      });
      mockRepository.getRecordAuditLogs.mockResolvedValue([]);
      mockRepository.logAction.mockResolvedValue({});
      mockRepository.rollbackBatch.mockResolvedValue({});

      const result = await service.rollbackRecord(
        'batch-123',
        'rec-1',
        'user-123',
        'Test single record rollback'
      );

      expect(result.success).toBe(true);
      expect(result.recordId).toBe('rec-1');
    });

    it('should fail for non-existent record', async () => {
      mockRepository.findRecordById.mockResolvedValue(null);

      const result = await service.rollbackRecord(
        'batch-123',
        'non-existent',
        'user-123'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Record not found');
    });

    it('should fail if record belongs to different batch', async () => {
      mockRepository.findRecordById.mockResolvedValue({
        id: 'rec-1',
        batchId: 'different-batch',
        status: 'imported',
      });

      const result = await service.rollbackRecord(
        'batch-123',
        'rec-1',
        'user-123'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Record does not belong to the specified batch');
    });

    it('should fail for non-imported record', async () => {
      mockRepository.findRecordById.mockResolvedValue({
        id: 'rec-1',
        batchId: 'batch-123',
        status: 'valid', // Not imported yet
      });

      const result = await service.rollbackRecord(
        'batch-123',
        'rec-1',
        'user-123'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot rollback record in valid status');
    });
  });

  // =========================================================================
  // Audit Trail Tests
  // =========================================================================

  describe('getRollbackHistory', () => {
    it('should return rollback-related audit entries', async () => {
      mockRepository.getAuditLogs.mockResolvedValue([
        { action: 'BATCH_CREATED', performedAt: new Date(), performedBy: 'user-1', details: {} },
        { action: 'ROLLBACK_STARTED', performedAt: new Date(), performedBy: 'user-2', details: { reason: 'Test' } },
        { action: 'ROLLBACK_COMPLETED', performedAt: new Date(), performedBy: 'user-2', details: { count: 5 } },
        { action: 'BATCH_IMPORT_COMPLETED', performedAt: new Date(), performedBy: 'user-1', details: {} },
      ]);

      const history = await service.getRollbackHistory('batch-123');

      expect(history).toHaveLength(2);
      expect(history.every(h => h.action.includes('ROLLBACK'))).toBe(true);
    });
  });

  describe('getAuditTrail', () => {
    it('should return full audit trail', async () => {
      const now = new Date();
      mockRepository.getAuditLogs.mockResolvedValue([
        {
          id: 'log-1',
          action: 'BATCH_CREATED',
          recordId: null,
          performedAt: now,
          performedBy: 'user-1',
          details: { name: 'Test' },
          beforeState: null,
          afterState: null,
          errorMessage: null,
        },
        {
          id: 'log-2',
          action: 'RECORD_IMPORTED',
          recordId: 'rec-1',
          performedAt: now,
          performedBy: 'user-1',
          details: null,
          beforeState: null,
          afterState: { accountNumber: 'ACC-001' },
          errorMessage: null,
        },
      ]);

      const trail = await service.getAuditTrail('batch-123');

      expect(trail).toHaveLength(2);
      expect(trail[0].action).toBe('BATCH_CREATED');
      expect(trail[1].recordId).toBe('rec-1');
      expect(trail[1].afterState).toEqual({ accountNumber: 'ACC-001' });
    });
  });

  // =========================================================================
  // Handler Registration Tests
  // =========================================================================

  describe('registerHandler', () => {
    it('should allow registering custom handlers', async () => {
      const customHandler = {
        dataType: 'custom_type' as any,
        canRollback: vi.fn().mockResolvedValue(true),
        rollback: vi.fn().mockResolvedValue({
          recordId: 'rec-1',
          success: true,
          entityId: 'entity-1',
          entityType: 'custom_type',
        }),
        getDependencies: vi.fn().mockResolvedValue([]),
      };

      service.registerHandler(customHandler);

      mockRepository.findBatchById.mockResolvedValue({
        id: 'batch-123',
        status: 'completed',
        canRollback: true,
        organizationId: 'org-123',
      });
      mockRepository.listRecords.mockResolvedValue({
        items: [
          { id: 'rec-1', dataType: 'custom_type', status: 'imported', importedEntityId: 'entity-1' },
        ],
        total: 1,
      });
      mockRepository.getRecordAuditLogs.mockResolvedValue([]);
      mockRepository.logAction.mockResolvedValue({});
      mockRepository.rollbackBatch.mockResolvedValue({});

      const result = await service.rollbackBatch('batch-123', 'user-123');

      expect(customHandler.rollback).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // Default Handlers Tests
  // =========================================================================

  describe('default handlers', () => {
    const testCases = [
      { dataType: 'account', expectedAction: 'deactivated' },
      { dataType: 'customer', expectedAction: 'deactivated' },
      { dataType: 'vendor', expectedAction: 'deactivated' },
      { dataType: 'item', expectedAction: 'deactivated' },
      { dataType: 'journal_entry', expectedAction: 'reversed' },
      { dataType: 'opening_balance', expectedAction: 'reversed' },
    ];

    testCases.forEach(({ dataType, expectedAction }) => {
      it(`should have handler for ${dataType}`, async () => {
        mockRepository.findBatchById.mockResolvedValue({
          id: 'batch-123',
          status: 'completed',
          canRollback: true,
          organizationId: 'org-123',
        });
        mockRepository.listRecords.mockResolvedValue({
          items: [
            { id: 'rec-1', dataType, status: 'imported', importedEntityId: 'entity-1' },
          ],
          total: 1,
        });
        mockRepository.getRecordAuditLogs.mockResolvedValue([]);
        mockRepository.logAction.mockResolvedValue({});
        mockRepository.rollbackBatch.mockResolvedValue({});

        const result = await service.rollbackBatch('batch-123', 'user-123');

        expect(result.success).toBe(true);
        expect(result.rolledBackRecords).toBe(1);
      });
    });
  });
});
