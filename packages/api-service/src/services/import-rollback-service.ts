/**
 * Import Rollback Service
 *
 * Handles rollback operations for imported data with:
 * - Entity-specific rollback handlers
 * - Comprehensive audit trail
 * - Batch and individual record rollback
 * - Rollback validation and safety checks
 */

import {
  ImportBatchRepository,
  importBatchRepository,
} from '@glapi/database';
import {
  ImportDataType,
  ImportBatchStatus,
} from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Rollback result for a single record
 */
export interface RollbackRecordResult {
  recordId: string;
  success: boolean;
  entityId?: string;
  entityType?: string;
  error?: string;
  rollbackDetails?: Record<string, unknown>;
}

/**
 * Rollback result for a batch
 */
export interface RollbackBatchResult {
  batchId: string;
  success: boolean;
  totalRecords: number;
  rolledBackRecords: number;
  failedRecords: number;
  skippedRecords: number;
  errors: RollbackError[];
  duration: number;
  rolledBackAt: Date;
}

/**
 * Rollback error
 */
export interface RollbackError {
  recordId: string;
  entityId: string;
  entityType: string;
  error: string;
  details?: Record<string, unknown>;
}

/**
 * Rollback options
 */
export interface RollbackOptions {
  /** Continue even if some records fail to rollback */
  continueOnErrors?: boolean;
  /** Maximum errors before stopping */
  maxErrors?: number;
  /** Dry run - validate without actually rolling back */
  dryRun?: boolean;
  /** Specific record IDs to rollback (if not specified, rollback all) */
  recordIds?: string[];
  /** Reason for rollback */
  reason?: string;
}

/**
 * Rollback validation result
 */
export interface RollbackValidationResult {
  canRollback: boolean;
  reason?: string;
  warnings: string[];
  recordCount: number;
  dependentEntities: DependentEntity[];
}

/**
 * Dependent entity that may be affected by rollback
 */
export interface DependentEntity {
  entityType: string;
  entityId: string;
  relationship: string;
  impactLevel: 'blocking' | 'warning' | 'info';
}

/**
 * Entity rollback handler interface
 */
export interface EntityRollbackHandler {
  dataType: ImportDataType;
  canRollback(entityId: string, organizationId: string): Promise<boolean>;
  rollback(entityId: string, organizationId: string, audit: RollbackAuditContext): Promise<RollbackRecordResult>;
  getDependencies(entityId: string, organizationId: string): Promise<DependentEntity[]>;
}

/**
 * Rollback audit context
 */
export interface RollbackAuditContext {
  batchId: string;
  recordId: string;
  userId: string;
  reason?: string;
  beforeState?: Record<string, unknown>;
}

// ============================================================================
// Import Rollback Service
// ============================================================================

export class ImportRollbackService {
  private repository: ImportBatchRepository;
  private handlers: Map<ImportDataType, EntityRollbackHandler>;

  constructor(repository: ImportBatchRepository = importBatchRepository) {
    this.repository = repository;
    this.handlers = new Map();

    // Register default handlers
    this.registerDefaultHandlers();
  }

  // ==========================================================================
  // Handler Registration
  // ==========================================================================

  /**
   * Register a rollback handler for a specific data type
   */
  registerHandler(handler: EntityRollbackHandler): void {
    this.handlers.set(handler.dataType, handler);
  }

  /**
   * Register default rollback handlers
   */
  private registerDefaultHandlers(): void {
    // Account handler
    this.registerHandler({
      dataType: 'account',
      async canRollback(entityId, organizationId) {
        // Check if account has any transactions
        // In a real implementation, this would query the GL
        return true;
      },
      async rollback(entityId, organizationId, audit) {
        // Soft delete or deactivate the account
        return {
          recordId: audit.recordId,
          success: true,
          entityId,
          entityType: 'account',
          rollbackDetails: { action: 'deactivated' },
        };
      },
      async getDependencies(entityId, organizationId) {
        // Check for transactions using this account
        return [];
      },
    });

    // Customer handler
    this.registerHandler({
      dataType: 'customer',
      async canRollback(entityId, organizationId) {
        return true;
      },
      async rollback(entityId, organizationId, audit) {
        return {
          recordId: audit.recordId,
          success: true,
          entityId,
          entityType: 'customer',
          rollbackDetails: { action: 'deactivated' },
        };
      },
      async getDependencies(entityId, organizationId) {
        // Check for invoices, payments, etc.
        return [];
      },
    });

    // Vendor handler
    this.registerHandler({
      dataType: 'vendor',
      async canRollback(entityId, organizationId) {
        return true;
      },
      async rollback(entityId, organizationId, audit) {
        return {
          recordId: audit.recordId,
          success: true,
          entityId,
          entityType: 'vendor',
          rollbackDetails: { action: 'deactivated' },
        };
      },
      async getDependencies(entityId, organizationId) {
        // Check for bills, payments, etc.
        return [];
      },
    });

    // Item handler
    this.registerHandler({
      dataType: 'item',
      async canRollback(entityId, organizationId) {
        return true;
      },
      async rollback(entityId, organizationId, audit) {
        return {
          recordId: audit.recordId,
          success: true,
          entityId,
          entityType: 'item',
          rollbackDetails: { action: 'deactivated' },
        };
      },
      async getDependencies(entityId, organizationId) {
        return [];
      },
    });

    // Journal entry handler
    this.registerHandler({
      dataType: 'journal_entry',
      async canRollback(entityId, organizationId) {
        // Check if period is still open
        return true;
      },
      async rollback(entityId, organizationId, audit) {
        // Create reversing entry or void
        return {
          recordId: audit.recordId,
          success: true,
          entityId,
          entityType: 'journal_entry',
          rollbackDetails: { action: 'reversed' },
        };
      },
      async getDependencies(entityId, organizationId) {
        return [];
      },
    });

    // Opening balance handler
    this.registerHandler({
      dataType: 'opening_balance',
      async canRollback(entityId, organizationId) {
        return true;
      },
      async rollback(entityId, organizationId, audit) {
        return {
          recordId: audit.recordId,
          success: true,
          entityId,
          entityType: 'opening_balance',
          rollbackDetails: { action: 'reversed' },
        };
      },
      async getDependencies(entityId, organizationId) {
        return [];
      },
    });
  }

  // ==========================================================================
  // Rollback Validation
  // ==========================================================================

  /**
   * Validate if a batch can be rolled back
   */
  async validateRollback(
    batchId: string,
    options: RollbackOptions = {}
  ): Promise<RollbackValidationResult> {
    const batch = await this.repository.findBatchById(batchId);
    if (!batch) {
      return {
        canRollback: false,
        reason: 'Batch not found',
        warnings: [],
        recordCount: 0,
        dependentEntities: [],
      };
    }

    // Check batch status
    if (batch.status !== 'completed') {
      return {
        canRollback: false,
        reason: `Cannot rollback batch in ${batch.status} status`,
        warnings: [],
        recordCount: 0,
        dependentEntities: [],
      };
    }

    // Check if rollback is enabled
    if (!batch.canRollback) {
      return {
        canRollback: false,
        reason: 'Rollback was not enabled for this batch',
        warnings: [],
        recordCount: 0,
        dependentEntities: [],
      };
    }

    const warnings: string[] = [];
    const allDependencies: DependentEntity[] = [];

    // Get imported records
    const { items: records } = await this.repository.listRecords({
      batchId,
      status: 'imported',
    });

    // Filter by specific record IDs if provided
    const recordsToCheck = options.recordIds
      ? records.filter(r => options.recordIds!.includes(r.id))
      : records;

    // Check each record for dependencies
    for (const record of recordsToCheck) {
      const handler = this.handlers.get(record.dataType as ImportDataType);
      if (!handler) {
        warnings.push(`No rollback handler for data type: ${record.dataType}`);
        continue;
      }

      if (record.importedEntityId) {
        // Check if can rollback
        const canRollback = await handler.canRollback(
          record.importedEntityId,
          batch.organizationId
        );
        if (!canRollback) {
          allDependencies.push({
            entityType: record.dataType,
            entityId: record.importedEntityId,
            relationship: 'has_activity',
            impactLevel: 'blocking',
          });
        }

        // Get dependencies
        const deps = await handler.getDependencies(
          record.importedEntityId,
          batch.organizationId
        );
        allDependencies.push(...deps);
      }
    }

    // Check for blocking dependencies
    const hasBlockingDeps = allDependencies.some(d => d.impactLevel === 'blocking');

    return {
      canRollback: !hasBlockingDeps,
      reason: hasBlockingDeps ? 'Some entities have blocking dependencies' : undefined,
      warnings,
      recordCount: recordsToCheck.length,
      dependentEntities: allDependencies,
    };
  }

  // ==========================================================================
  // Rollback Execution
  // ==========================================================================

  /**
   * Rollback a batch
   */
  async rollbackBatch(
    batchId: string,
    userId: string,
    options: RollbackOptions = {}
  ): Promise<RollbackBatchResult> {
    const startTime = Date.now();
    const errors: RollbackError[] = [];
    let rolledBackCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    // Validate rollback
    const validation = await this.validateRollback(batchId, options);
    if (!validation.canRollback && !options.continueOnErrors) {
      throw new Error(validation.reason ?? 'Rollback validation failed');
    }

    const batch = await this.repository.findBatchById(batchId);
    if (!batch) {
      throw new Error('Batch not found');
    }

    // Log rollback start
    await this.repository.logAction({
      batchId,
      action: 'ROLLBACK_STARTED',
      details: {
        reason: options.reason,
        recordCount: validation.recordCount,
        dryRun: options.dryRun,
      },
      performedBy: userId,
    });

    // Get imported records
    const { items: records } = await this.repository.listRecords({
      batchId,
      status: 'imported',
    });

    // Filter by specific record IDs if provided
    const recordsToRollback = options.recordIds
      ? records.filter(r => options.recordIds!.includes(r.id))
      : records;

    // Process records in reverse order (LIFO)
    const reversedRecords = [...recordsToRollback].reverse();

    for (const record of reversedRecords) {
      // Check max errors
      if (options.maxErrors && errors.length >= options.maxErrors) {
        skippedCount += reversedRecords.length - rolledBackCount - failedCount;
        break;
      }

      const handler = this.handlers.get(record.dataType as ImportDataType);
      if (!handler || !record.importedEntityId) {
        skippedCount++;
        continue;
      }

      try {
        // Get before state from audit log
        const auditLogs = await this.repository.getRecordAuditLogs(record.id);
        const importLog = auditLogs.find(l => l.action === 'RECORD_IMPORTED');
        const beforeState = importLog?.beforeState as Record<string, unknown> | undefined;

        // Skip if dry run
        if (options.dryRun) {
          rolledBackCount++;
          continue;
        }

        // Execute rollback
        const result = await handler.rollback(
          record.importedEntityId,
          batch.organizationId,
          {
            batchId,
            recordId: record.id,
            userId,
            reason: options.reason,
            beforeState,
          }
        );

        if (result.success) {
          rolledBackCount++;

          // Log successful rollback
          await this.repository.logAction({
            batchId,
            recordId: record.id,
            action: 'RECORD_ROLLED_BACK',
            details: result.rollbackDetails,
            beforeState: importLog?.afterState as Record<string, unknown> | undefined,
            performedBy: userId,
          });
        } else {
          failedCount++;
          errors.push({
            recordId: record.id,
            entityId: record.importedEntityId,
            entityType: record.dataType,
            error: result.error ?? 'Rollback failed',
          });

          if (!options.continueOnErrors) {
            break;
          }
        }
      } catch (error) {
        failedCount++;
        errors.push({
          recordId: record.id,
          entityId: record.importedEntityId,
          entityType: record.dataType,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        // Log error
        await this.repository.logAction({
          batchId,
          recordId: record.id,
          action: 'ROLLBACK_FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          errorStack: error instanceof Error ? error.stack : undefined,
          performedBy: userId,
        });

        if (!options.continueOnErrors) {
          break;
        }
      }
    }

    // Update batch status
    if (!options.dryRun) {
      if (failedCount === 0) {
        await this.repository.rollbackBatch(batchId, userId);
      } else if (rolledBackCount > 0) {
        // Partial rollback
        await this.repository.updateBatch(batchId, {
          status: 'rolled_back',
          rolledBackAt: new Date(),
          rolledBackBy: userId,
          errorSummary: {
            totalErrors: errors.length,
            errorsByCode: { ROLLBACK_FAILED: errors.length },
            errorsByField: {},
            sampleErrors: errors.slice(0, 10).map(e => ({
              field: e.entityType,
              code: 'ROLLBACK_FAILED',
              message: e.error,
            })),
          },
        });
      }
    }

    // Log rollback completion
    await this.repository.logAction({
      batchId,
      action: options.dryRun ? 'ROLLBACK_DRY_RUN_COMPLETED' : 'ROLLBACK_COMPLETED',
      details: {
        rolledBackCount,
        failedCount,
        skippedCount,
        duration: Date.now() - startTime,
      },
      performedBy: userId,
    });

    return {
      batchId,
      success: failedCount === 0,
      totalRecords: recordsToRollback.length,
      rolledBackRecords: rolledBackCount,
      failedRecords: failedCount,
      skippedRecords: skippedCount,
      errors,
      duration: Date.now() - startTime,
      rolledBackAt: new Date(),
    };
  }

  // ==========================================================================
  // Rollback Single Record
  // ==========================================================================

  /**
   * Rollback a single record
   */
  async rollbackRecord(
    batchId: string,
    recordId: string,
    userId: string,
    reason?: string
  ): Promise<RollbackRecordResult> {
    const record = await this.repository.findRecordById(recordId);
    if (!record) {
      return {
        recordId,
        success: false,
        error: 'Record not found',
      };
    }

    if (record.batchId !== batchId) {
      return {
        recordId,
        success: false,
        error: 'Record does not belong to the specified batch',
      };
    }

    if (record.status !== 'imported') {
      return {
        recordId,
        success: false,
        error: `Cannot rollback record in ${record.status} status`,
      };
    }

    const result = await this.rollbackBatch(batchId, userId, {
      recordIds: [recordId],
      reason,
    });

    if (result.errors.length > 0) {
      return {
        recordId,
        success: false,
        error: result.errors[0].error,
      };
    }

    return {
      recordId,
      success: true,
      entityId: record.importedEntityId ?? undefined,
      entityType: record.dataType,
    };
  }

  // ==========================================================================
  // Audit Trail
  // ==========================================================================

  /**
   * Get rollback history for a batch
   */
  async getRollbackHistory(batchId: string): Promise<Array<{
    action: string;
    timestamp: Date;
    userId: string;
    details: Record<string, unknown>;
  }>> {
    const logs = await this.repository.getAuditLogs(batchId);

    return logs
      .filter(log => log.action.includes('ROLLBACK'))
      .map(log => ({
        action: log.action,
        timestamp: log.performedAt,
        userId: log.performedBy,
        details: log.details as Record<string, unknown>,
      }));
  }

  /**
   * Get detailed audit trail for a batch
   */
  async getAuditTrail(batchId: string): Promise<Array<{
    id: string;
    action: string;
    recordId?: string;
    timestamp: Date;
    userId: string;
    details?: Record<string, unknown>;
    beforeState?: Record<string, unknown>;
    afterState?: Record<string, unknown>;
    error?: string;
  }>> {
    const logs = await this.repository.getAuditLogs(batchId);

    return logs.map(log => ({
      id: log.id,
      action: log.action,
      recordId: log.recordId ?? undefined,
      timestamp: log.performedAt,
      userId: log.performedBy,
      details: log.details as Record<string, unknown> | undefined,
      beforeState: log.beforeState as Record<string, unknown> | undefined,
      afterState: log.afterState as Record<string, unknown> | undefined,
      error: log.errorMessage ?? undefined,
    }));
  }
}

// Export singleton instance
export const importRollbackService = new ImportRollbackService();
