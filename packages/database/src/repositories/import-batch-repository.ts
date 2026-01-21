/**
 * Import Batch Repository
 *
 * Repository for managing import/migration batch operations.
 * Handles batch lifecycle, record staging, and statistics.
 */

import { eq, and, sql, desc, inArray, ilike, gte, lte, count } from 'drizzle-orm';
import { db } from '../db';
import {
  importBatches,
  importRecords,
  importFieldMappings,
  importTemplates,
  importAuditLogs,
  ImportBatchOptions,
  ImportTemplateOptions,
  ValidationError,
  ValidationWarning,
  ImportErrorSummary,
} from '../db/schema';

// ============================================================================
// Types
// ============================================================================

type ImportBatch = typeof importBatches.$inferSelect;
type NewImportBatch = typeof importBatches.$inferInsert;
type ImportRecord = typeof importRecords.$inferSelect;
type NewImportRecord = typeof importRecords.$inferInsert;
type ImportFieldMapping = typeof importFieldMappings.$inferSelect;
type NewImportFieldMapping = typeof importFieldMappings.$inferInsert;
type ImportTemplate = typeof importTemplates.$inferSelect;
type ImportAuditLog = typeof importAuditLogs.$inferSelect;
type NewImportAuditLog = typeof importAuditLogs.$inferInsert;

type ImportBatchStatus = 'pending' | 'validating' | 'validated' | 'processing' | 'completed' | 'failed' | 'rolled_back' | 'cancelled';
type ImportRecordStatus = 'pending' | 'valid' | 'invalid' | 'imported' | 'skipped' | 'failed';
type ImportDataType = 'account' | 'customer' | 'vendor' | 'employee' | 'item' | 'department' | 'class' | 'location' | 'project' | 'cost_code' | 'subsidiary' | 'journal_entry' | 'invoice' | 'bill' | 'payment' | 'bill_payment' | 'opening_balance' | 'budget' | 'time_entry' | 'expense_entry';
type ImportSourceSystem = 'quickbooks_online' | 'quickbooks_desktop' | 'xero' | 'sage' | 'netsuite' | 'dynamics' | 'freshbooks' | 'wave' | 'csv' | 'excel' | 'json' | 'other';

export interface BatchStatistics {
  total: number;
  valid: number;
  invalid: number;
  imported: number;
  skipped: number;
  failed: number;
  pending: number;
}

export interface BatchListOptions {
  organizationId: string;
  status?: ImportBatchStatus | ImportBatchStatus[];
  sourceSystem?: ImportSourceSystem;
  dataTypes?: ImportDataType[];
  startDate?: Date;
  endDate?: Date;
  search?: string;
  page?: number;
  limit?: number;
}

export interface RecordListOptions {
  batchId: string;
  status?: ImportRecordStatus | ImportRecordStatus[];
  dataType?: ImportDataType;
  hasErrors?: boolean;
  page?: number;
  limit?: number;
}

// ============================================================================
// Import Batch Repository
// ============================================================================

export class ImportBatchRepository {
  // ==========================================================================
  // Batch CRUD
  // ==========================================================================

  async createBatch(data: NewImportBatch): Promise<ImportBatch> {
    const [result] = await db.insert(importBatches).values(data).returning();
    return result;
  }

  async findBatchById(id: string): Promise<ImportBatch | null> {
    const [result] = await db.select().from(importBatches).where(eq(importBatches.id, id));
    return result ?? null;
  }

  async findBatchByNumber(organizationId: string, batchNumber: string): Promise<ImportBatch | null> {
    const [result] = await db
      .select()
      .from(importBatches)
      .where(
        and(
          eq(importBatches.organizationId, organizationId),
          eq(importBatches.batchNumber, batchNumber)
        )
      );
    return result ?? null;
  }

  async updateBatch(
    id: string,
    data: Partial<Omit<NewImportBatch, 'id' | 'organizationId' | 'createdAt' | 'createdBy'>>
  ): Promise<ImportBatch | null> {
    const [result] = await db
      .update(importBatches)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(importBatches.id, id))
      .returning();
    return result ?? null;
  }

  async deleteBatch(id: string): Promise<boolean> {
    // This will cascade delete all records due to foreign key
    const result = await db.delete(importBatches).where(eq(importBatches.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async listBatches(options: BatchListOptions): Promise<{ items: ImportBatch[]; total: number }> {
    const { page = 1, limit = 50 } = options;
    const offset = (page - 1) * limit;
    const conditions: ReturnType<typeof eq>[] = [];

    conditions.push(eq(importBatches.organizationId, options.organizationId));

    if (options.status) {
      if (Array.isArray(options.status)) {
        conditions.push(inArray(importBatches.status, options.status));
      } else {
        conditions.push(eq(importBatches.status, options.status));
      }
    }

    if (options.sourceSystem) {
      conditions.push(eq(importBatches.sourceSystem, options.sourceSystem));
    }

    if (options.startDate) {
      conditions.push(gte(importBatches.createdAt, options.startDate));
    }

    if (options.endDate) {
      conditions.push(lte(importBatches.createdAt, options.endDate));
    }

    if (options.search) {
      conditions.push(ilike(importBatches.name, `%${options.search}%`));
    }

    const whereClause = and(...conditions);

    const [items, countResult] = await Promise.all([
      db
        .select()
        .from(importBatches)
        .where(whereClause)
        .orderBy(desc(importBatches.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(importBatches)
        .where(whereClause),
    ]);

    return {
      items,
      total: countResult[0]?.count ?? 0,
    };
  }

  // ==========================================================================
  // Batch Status Operations
  // ==========================================================================

  async startValidation(id: string): Promise<ImportBatch | null> {
    return this.updateBatch(id, {
      status: 'validating',
      validationStartedAt: new Date(),
    });
  }

  async completeValidation(id: string, errorSummary?: ImportErrorSummary): Promise<ImportBatch | null> {
    // Calculate statistics from records
    const stats = await this.getBatchStatistics(id);

    return this.updateBatch(id, {
      status: 'validated',
      validationCompletedAt: new Date(),
      validRecords: stats.valid,
      invalidRecords: stats.invalid,
      errorSummary,
    });
  }

  async startImport(id: string): Promise<ImportBatch | null> {
    return this.updateBatch(id, {
      status: 'processing',
      importStartedAt: new Date(),
    });
  }

  async completeImport(id: string): Promise<ImportBatch | null> {
    const stats = await this.getBatchStatistics(id);

    return this.updateBatch(id, {
      status: 'completed',
      importCompletedAt: new Date(),
      importedRecords: stats.imported,
      skippedRecords: stats.skipped,
      failedRecords: stats.failed,
    });
  }

  async failBatch(id: string, errorSummary: ImportErrorSummary): Promise<ImportBatch | null> {
    return this.updateBatch(id, {
      status: 'failed',
      errorSummary,
    });
  }

  async cancelBatch(id: string): Promise<ImportBatch | null> {
    return this.updateBatch(id, {
      status: 'cancelled',
    });
  }

  async rollbackBatch(id: string, userId: string): Promise<ImportBatch | null> {
    return this.updateBatch(id, {
      status: 'rolled_back',
      rolledBackAt: new Date(),
      rolledBackBy: userId,
      canRollback: false,
    });
  }

  // ==========================================================================
  // Record CRUD
  // ==========================================================================

  async createRecord(data: NewImportRecord): Promise<ImportRecord> {
    const [result] = await db.insert(importRecords).values(data).returning();
    return result;
  }

  async createRecords(data: NewImportRecord[]): Promise<ImportRecord[]> {
    if (data.length === 0) return [];
    return db.insert(importRecords).values(data).returning();
  }

  async findRecordById(id: string): Promise<ImportRecord | null> {
    const [result] = await db.select().from(importRecords).where(eq(importRecords.id, id));
    return result ?? null;
  }

  async updateRecord(
    id: string,
    data: Partial<Omit<NewImportRecord, 'id' | 'batchId' | 'createdAt'>>
  ): Promise<ImportRecord | null> {
    const [result] = await db
      .update(importRecords)
      .set(data)
      .where(eq(importRecords.id, id))
      .returning();
    return result ?? null;
  }

  async updateRecordsByBatch(
    batchId: string,
    status: ImportRecordStatus,
    data: Partial<Omit<NewImportRecord, 'id' | 'batchId' | 'createdAt'>>
  ): Promise<number> {
    const result = await db
      .update(importRecords)
      .set(data)
      .where(
        and(
          eq(importRecords.batchId, batchId),
          eq(importRecords.status, status)
        )
      );
    return result.rowCount ?? 0;
  }

  async listRecords(options: RecordListOptions): Promise<{ items: ImportRecord[]; total: number }> {
    const { page = 1, limit = 100 } = options;
    const offset = (page - 1) * limit;
    const conditions: ReturnType<typeof eq>[] = [];

    conditions.push(eq(importRecords.batchId, options.batchId));

    if (options.status) {
      if (Array.isArray(options.status)) {
        conditions.push(inArray(importRecords.status, options.status));
      } else {
        conditions.push(eq(importRecords.status, options.status));
      }
    }

    if (options.dataType) {
      conditions.push(eq(importRecords.dataType, options.dataType));
    }

    const whereClause = and(...conditions);

    const [items, countResult] = await Promise.all([
      db
        .select()
        .from(importRecords)
        .where(whereClause)
        .orderBy(importRecords.rowNumber)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(importRecords)
        .where(whereClause),
    ]);

    return {
      items,
      total: countResult[0]?.count ?? 0,
    };
  }

  async getRecordsByStatus(batchId: string, status: ImportRecordStatus): Promise<ImportRecord[]> {
    return db
      .select()
      .from(importRecords)
      .where(
        and(
          eq(importRecords.batchId, batchId),
          eq(importRecords.status, status)
        )
      )
      .orderBy(importRecords.rowNumber);
  }

  async getInvalidRecords(batchId: string): Promise<ImportRecord[]> {
    return this.getRecordsByStatus(batchId, 'invalid');
  }

  async getValidRecords(batchId: string): Promise<ImportRecord[]> {
    return this.getRecordsByStatus(batchId, 'valid');
  }

  async getPendingRecords(batchId: string, limit = 1000): Promise<ImportRecord[]> {
    return db
      .select()
      .from(importRecords)
      .where(
        and(
          eq(importRecords.batchId, batchId),
          eq(importRecords.status, 'pending')
        )
      )
      .orderBy(importRecords.rowNumber)
      .limit(limit);
  }

  // ==========================================================================
  // Record Validation
  // ==========================================================================

  async markRecordValid(id: string, mappedData: unknown): Promise<ImportRecord | null> {
    return this.updateRecord(id, {
      status: 'valid',
      mappedData,
      validatedAt: new Date(),
    });
  }

  async markRecordInvalid(
    id: string,
    errors: ValidationError[],
    warnings?: ValidationWarning[]
  ): Promise<ImportRecord | null> {
    return this.updateRecord(id, {
      status: 'invalid',
      validationErrors: errors,
      validationWarnings: warnings ?? null,
      validatedAt: new Date(),
    });
  }

  async markRecordImported(
    id: string,
    entityId: string,
    entityType: string
  ): Promise<ImportRecord | null> {
    return this.updateRecord(id, {
      status: 'imported',
      importedEntityId: entityId,
      importedEntityType: entityType,
      importedAt: new Date(),
    });
  }

  async markRecordSkipped(id: string, reason: string): Promise<ImportRecord | null> {
    return this.updateRecord(id, {
      status: 'skipped',
      importError: reason,
    });
  }

  async markRecordFailed(id: string, error: string): Promise<ImportRecord | null> {
    return this.updateRecord(id, {
      status: 'failed',
      importError: error,
    });
  }

  async markRecordDuplicate(id: string, duplicateOfId: string): Promise<ImportRecord | null> {
    return this.updateRecord(id, {
      status: 'skipped',
      isDuplicate: true,
      duplicateOfId,
      importError: `Duplicate of existing record ${duplicateOfId}`,
    });
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  async getBatchStatistics(batchId: string): Promise<BatchStatistics> {
    const stats = await db
      .select({
        status: importRecords.status,
        count: sql<number>`count(*)::int`,
      })
      .from(importRecords)
      .where(eq(importRecords.batchId, batchId))
      .groupBy(importRecords.status);

    const result: BatchStatistics = {
      total: 0,
      valid: 0,
      invalid: 0,
      imported: 0,
      skipped: 0,
      failed: 0,
      pending: 0,
    };

    for (const stat of stats) {
      const cnt = stat.count ?? 0;
      result.total += cnt;
      if (stat.status === 'valid') result.valid = cnt;
      if (stat.status === 'invalid') result.invalid = cnt;
      if (stat.status === 'imported') result.imported = cnt;
      if (stat.status === 'skipped') result.skipped = cnt;
      if (stat.status === 'failed') result.failed = cnt;
      if (stat.status === 'pending') result.pending = cnt;
    }

    return result;
  }

  async getErrorSummary(batchId: string): Promise<ImportErrorSummary> {
    const invalidRecords = await this.getInvalidRecords(batchId);

    const errorsByCode: Record<string, number> = {};
    const errorsByField: Record<string, number> = {};
    const sampleErrors: ValidationError[] = [];

    for (const record of invalidRecords) {
      const errors = (record.validationErrors ?? []) as ValidationError[];
      for (const error of errors) {
        errorsByCode[error.code] = (errorsByCode[error.code] ?? 0) + 1;
        errorsByField[error.field] = (errorsByField[error.field] ?? 0) + 1;

        // Collect sample errors (up to 10)
        if (sampleErrors.length < 10) {
          sampleErrors.push(error);
        }
      }
    }

    return {
      totalErrors: Object.values(errorsByCode).reduce((a, b) => a + b, 0),
      errorsByCode,
      errorsByField,
      sampleErrors,
    };
  }

  // ==========================================================================
  // Field Mappings
  // ==========================================================================

  async createFieldMapping(data: NewImportFieldMapping): Promise<ImportFieldMapping> {
    const [result] = await db.insert(importFieldMappings).values(data).returning();
    return result;
  }

  async findFieldMappingById(id: string): Promise<ImportFieldMapping | null> {
    const [result] = await db.select().from(importFieldMappings).where(eq(importFieldMappings.id, id));
    return result ?? null;
  }

  async findDefaultFieldMapping(
    organizationId: string,
    sourceSystem: ImportSourceSystem,
    dataType: ImportDataType
  ): Promise<ImportFieldMapping | null> {
    const [result] = await db
      .select()
      .from(importFieldMappings)
      .where(
        and(
          eq(importFieldMappings.organizationId, organizationId),
          eq(importFieldMappings.sourceSystem, sourceSystem),
          eq(importFieldMappings.dataType, dataType),
          eq(importFieldMappings.isDefault, true),
          eq(importFieldMappings.isActive, true)
        )
      );
    return result ?? null;
  }

  async listFieldMappings(
    organizationId: string,
    sourceSystem?: ImportSourceSystem,
    dataType?: ImportDataType
  ): Promise<ImportFieldMapping[]> {
    const conditions: ReturnType<typeof eq>[] = [];
    conditions.push(eq(importFieldMappings.organizationId, organizationId));
    conditions.push(eq(importFieldMappings.isActive, true));

    if (sourceSystem) {
      conditions.push(eq(importFieldMappings.sourceSystem, sourceSystem));
    }
    if (dataType) {
      conditions.push(eq(importFieldMappings.dataType, dataType));
    }

    return db
      .select()
      .from(importFieldMappings)
      .where(and(...conditions))
      .orderBy(importFieldMappings.name);
  }

  // ==========================================================================
  // Templates
  // ==========================================================================

  async findTemplateById(id: string): Promise<ImportTemplate | null> {
    const [result] = await db.select().from(importTemplates).where(eq(importTemplates.id, id));
    return result ?? null;
  }

  async listTemplates(
    organizationId?: string,
    sourceSystem?: ImportSourceSystem
  ): Promise<ImportTemplate[]> {
    const conditions: ReturnType<typeof eq>[] = [];
    conditions.push(eq(importTemplates.isActive, true));

    // Include both system templates and org-specific templates
    if (organizationId) {
      // We can't use OR directly with eq, so we'll filter in two queries
    }

    if (sourceSystem) {
      conditions.push(eq(importTemplates.sourceSystem, sourceSystem));
    }

    // Get system templates and org templates
    const systemTemplates = await db
      .select()
      .from(importTemplates)
      .where(
        and(
          eq(importTemplates.isSystemTemplate, true),
          eq(importTemplates.isActive, true),
          sourceSystem ? eq(importTemplates.sourceSystem, sourceSystem) : undefined
        )
      )
      .orderBy(importTemplates.name);

    if (!organizationId) {
      return systemTemplates;
    }

    const orgTemplates = await db
      .select()
      .from(importTemplates)
      .where(
        and(
          eq(importTemplates.organizationId, organizationId),
          eq(importTemplates.isActive, true),
          sourceSystem ? eq(importTemplates.sourceSystem, sourceSystem) : undefined
        )
      )
      .orderBy(importTemplates.name);

    return [...systemTemplates, ...orgTemplates];
  }

  // ==========================================================================
  // Audit Logs
  // ==========================================================================

  async logAction(data: NewImportAuditLog): Promise<ImportAuditLog> {
    const [result] = await db.insert(importAuditLogs).values(data).returning();
    return result;
  }

  async getAuditLogs(
    batchId: string,
    limit = 100
  ): Promise<ImportAuditLog[]> {
    return db
      .select()
      .from(importAuditLogs)
      .where(eq(importAuditLogs.batchId, batchId))
      .orderBy(desc(importAuditLogs.performedAt))
      .limit(limit);
  }

  async getRecordAuditLogs(recordId: string): Promise<ImportAuditLog[]> {
    return db
      .select()
      .from(importAuditLogs)
      .where(eq(importAuditLogs.recordId, recordId))
      .orderBy(desc(importAuditLogs.performedAt));
  }

  // ==========================================================================
  // Batch Number Generation
  // ==========================================================================

  async generateBatchNumber(organizationId: string): Promise<string> {
    const today = new Date();
    const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, '');

    // Find the highest batch number for today
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(importBatches)
      .where(
        and(
          eq(importBatches.organizationId, organizationId),
          ilike(importBatches.batchNumber, `IMP-${datePrefix}-%`)
        )
      );

    const sequence = (result?.count ?? 0) + 1;
    return `IMP-${datePrefix}-${sequence.toString().padStart(4, '0')}`;
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  async cleanupOldBatches(organizationId: string, olderThanDays = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await db
      .delete(importBatches)
      .where(
        and(
          eq(importBatches.organizationId, organizationId),
          inArray(importBatches.status, ['completed', 'failed', 'cancelled', 'rolled_back']),
          lte(importBatches.createdAt, cutoffDate)
        )
      );

    return result.rowCount ?? 0;
  }
}

// Export singleton instance
export const importBatchRepository = new ImportBatchRepository();
