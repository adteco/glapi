/**
 * tRPC Router for Import Operations
 *
 * Provides API endpoints for the migration wizard:
 * - Batch management (create, list, get)
 * - Record management (add, get, validate)
 * - Import execution and progress tracking
 * - Field mapping templates
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { importService, importRollbackService } from '@glapi/api-service';
import { createReadOnlyAIMeta, createWriteAIMeta, createDeleteAIMeta } from '../ai-meta';

// =============================================================================
// Input Schemas
// =============================================================================

const sourceSystemEnum = z.enum([
  'quickbooks_online',
  'quickbooks_desktop',
  'xero',
  'sage',
  'netsuite',
  'dynamics',
  'freshbooks',
  'wave',
  'csv',
  'excel',
  'other',
]);

const dataTypeEnum = z.enum([
  'account',
  'customer',
  'vendor',
  'item',
  'journal_entry',
  'opening_balance',
]);

const batchStatusEnum = z.enum([
  'pending',
  'validating',
  'validated',
  'processing',
  'completed',
  'failed',
  'cancelled',
  'rolled_back',
]);

const createBatchInput = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  sourceSystem: sourceSystemEnum,
  sourceFile: z.string().optional(),
  dataTypes: z.array(dataTypeEnum).min(1),
  options: z.object({
    skipDuplicates: z.boolean().optional(),
    updateExisting: z.boolean().optional(),
    enableRollback: z.boolean().optional(),
    continueOnErrors: z.boolean().optional(),
  }).optional(),
});

const addRecordsInput = z.object({
  batchId: z.string().uuid(),
  records: z.array(z.object({
    rowNumber: z.number().int().positive(),
    externalId: z.string().optional(),
    dataType: dataTypeEnum,
    rawData: z.record(z.unknown()),
  })).min(1).max(1000),
});

const validateBatchInput = z.object({
  batchId: z.string().uuid(),
  fieldMappingId: z.string().uuid().optional(),
  options: z.object({
    skipDuplicates: z.boolean().optional(),
    updateExisting: z.boolean().optional(),
    continueOnErrors: z.boolean().optional(),
    maxErrors: z.number().optional(),
    dryRun: z.boolean().optional(),
  }).optional(),
});

const executeImportInput = z.object({
  batchId: z.string().uuid(),
  options: z.object({
    continueOnErrors: z.boolean().optional(),
  }).optional(),
});

const listBatchesInput = z.object({
  status: z.union([batchStatusEnum, z.array(batchStatusEnum)]).optional(),
  sourceSystem: sourceSystemEnum.optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const listRecordsInput = z.object({
  batchId: z.string().uuid(),
  status: z.enum(['pending', 'valid', 'invalid', 'imported', 'skipped', 'failed']).optional(),
  dataType: dataTypeEnum.optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const rollbackBatchInput = z.object({
  batchId: z.string().uuid(),
  reason: z.string().optional(),
  dryRun: z.boolean().optional(),
});

const rollbackRecordInput = z.object({
  batchId: z.string().uuid(),
  recordId: z.string().uuid(),
  reason: z.string().optional(),
});

// =============================================================================
// Router
// =============================================================================

export const importsRouter = router({
  // ---------------------------------------------------------------------------
  // Batch Management
  // ---------------------------------------------------------------------------

  createBatch: protectedProcedure
    .meta({ ai: createWriteAIMeta('create_import_batch', 'Create a new import batch for data migration', {
      scopes: ['imports', 'migration', 'data'],
      permissions: ['write:imports'],
      riskLevel: 'MEDIUM',
    }) })
    .input(createBatchInput)
    .mutation(async ({ input, ctx }) => {
      return importService.createBatch({
        organizationId: ctx.organizationId,
        userId: ctx.user.entityId ?? ctx.user.id,
        name: input.name,
        description: input.description,
        sourceSystem: input.sourceSystem,
        sourceFile: input.sourceFile,
        dataTypes: input.dataTypes,
        options: input.options,
      });
    }),

  getBatch: protectedProcedure
    .meta({ ai: createReadOnlyAIMeta('get_import_batch', 'Get import batch details by ID', {
      scopes: ['imports', 'migration', 'data'],
      permissions: ['read:imports'],
    }) })
    .input(z.string().uuid())
    .query(async ({ input }) => {
      return importService.getBatch(input);
    }),

  listBatches: protectedProcedure
    .meta({ ai: createReadOnlyAIMeta('list_import_batches', 'List import batches with filters', {
      scopes: ['imports', 'migration', 'data'],
      permissions: ['read:imports'],
    }) })
    .input(listBatchesInput)
    .query(async ({ input, ctx }) => {
      return importService.listBatches(ctx.organizationId, input);
    }),

  cancelBatch: protectedProcedure
    .meta({ ai: createWriteAIMeta('cancel_import_batch', 'Cancel an import batch', {
      scopes: ['imports', 'migration', 'data'],
      permissions: ['write:imports'],
      riskLevel: 'MEDIUM',
    }) })
    .input(z.string().uuid())
    .mutation(async ({ input, ctx }) => {
      return importService.cancelBatch(input, ctx.user.id);
    }),

  // ---------------------------------------------------------------------------
  // Record Management
  // ---------------------------------------------------------------------------

  addRecords: protectedProcedure
    .meta({ ai: createWriteAIMeta('add_import_records', 'Add records to an import batch', {
      scopes: ['imports', 'migration', 'data'],
      permissions: ['write:imports'],
      riskLevel: 'MEDIUM',
    }) })
    .input(addRecordsInput)
    .mutation(async ({ input }) => {
      return importService.addRecords({
        batchId: input.batchId,
        records: input.records.map(r => ({
          rowNumber: r.rowNumber,
          externalId: r.externalId,
          dataType: r.dataType,
          rawData: r.rawData,
        })),
      });
    }),

  getRecords: protectedProcedure
    .meta({ ai: createReadOnlyAIMeta('get_import_records', 'Get records from an import batch', {
      scopes: ['imports', 'migration', 'data'],
      permissions: ['read:imports'],
    }) })
    .input(listRecordsInput)
    .query(async ({ input }) => {
      return importService.getRecords(input.batchId, {
        status: input.status ? [input.status] : undefined,
        dataType: input.dataType,
        page: input.page,
        limit: input.limit,
      });
    }),

  getInvalidRecords: protectedProcedure
    .input(z.string().uuid())
    .query(async ({ input }) => {
      return importService.getInvalidRecords(input);
    }),

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  validateBatch: protectedProcedure
    .input(validateBatchInput)
    .mutation(async ({ input }) => {
      return importService.validateBatch({
        batchId: input.batchId,
        fieldMappingId: input.fieldMappingId,
        options: input.options,
      });
    }),

  validateRecord: protectedProcedure
    .input(z.object({
      data: z.record(z.unknown()),
      dataType: dataTypeEnum,
      fieldMappings: z.array(z.object({
        sourceField: z.string(),
        targetField: z.string(),
        defaultValue: z.unknown().optional(),
        transformation: z.string().optional(),
      })).optional(),
    }))
    .mutation(async ({ input }) => {
      const mappings = input.fieldMappings?.map(m => ({
        sourceField: m.sourceField,
        targetField: m.targetField,
        defaultValue: m.defaultValue,
        transformation: m.transformation,
      }));
      return importService.validateRecord(
        input.data,
        input.dataType,
        mappings
      );
    }),

  // ---------------------------------------------------------------------------
  // Import Execution
  // ---------------------------------------------------------------------------

  executeImport: protectedProcedure
    .meta({ ai: createWriteAIMeta('execute_import', 'Execute data import from a validated batch', {
      scopes: ['imports', 'migration', 'data'],
      permissions: ['write:imports'],
      riskLevel: 'HIGH',
    }) })
    .input(executeImportInput)
    .mutation(async ({ input }) => {
      return importService.executeImport({
        batchId: input.batchId,
        options: input.options,
      });
    }),

  getProgress: protectedProcedure
    .input(z.string().uuid())
    .query(async ({ input }) => {
      return importService.getProgress(input);
    }),

  // ---------------------------------------------------------------------------
  // Rollback
  // ---------------------------------------------------------------------------

  validateRollback: protectedProcedure
    .input(z.string().uuid())
    .query(async ({ input }) => {
      return importRollbackService.validateRollback(input);
    }),

  rollbackBatch: protectedProcedure
    .meta({ ai: createDeleteAIMeta('rollback_import_batch', 'Rollback an entire import batch', {
      scopes: ['imports', 'migration', 'data'],
      permissions: ['delete:imports'],
      riskLevel: 'HIGH',
    }) })
    .input(rollbackBatchInput)
    .mutation(async ({ input, ctx }) => {
      return importRollbackService.rollbackBatch(
        input.batchId,
        ctx.user.id,
        {
          reason: input.reason,
          dryRun: input.dryRun,
        }
      );
    }),

  rollbackRecord: protectedProcedure
    .input(rollbackRecordInput)
    .mutation(async ({ input, ctx }) => {
      return importRollbackService.rollbackRecord(
        input.batchId,
        input.recordId,
        ctx.user.id,
        input.reason
      );
    }),

  getAuditTrail: protectedProcedure
    .input(z.string().uuid())
    .query(async ({ input }) => {
      return importRollbackService.getAuditTrail(input);
    }),

  // ---------------------------------------------------------------------------
  // Templates & Field Mappings
  // ---------------------------------------------------------------------------

  getTemplates: protectedProcedure
    .input(z.object({
      sourceSystem: sourceSystemEnum.optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      return importService.getTemplates(
        ctx.organizationId,
        input?.sourceSystem
      );
    }),

  getFieldMappings: protectedProcedure
    .input(z.object({
      sourceSystem: sourceSystemEnum.optional(),
      dataType: dataTypeEnum.optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      return importService.getFieldMappings(
        ctx.organizationId,
        input?.sourceSystem,
        input?.dataType
      );
    }),

  // ---------------------------------------------------------------------------
  // Supported Systems & Data Types
  // ---------------------------------------------------------------------------

  getSupportedSystems: protectedProcedure
    .query(() => {
      return [
        { id: 'quickbooks_online', name: 'QuickBooks Online', icon: 'qbo' },
        { id: 'quickbooks_desktop', name: 'QuickBooks Desktop', icon: 'qbd' },
        { id: 'xero', name: 'Xero', icon: 'xero' },
        { id: 'sage', name: 'Sage', icon: 'sage' },
        { id: 'netsuite', name: 'NetSuite', icon: 'netsuite' },
        { id: 'dynamics', name: 'Microsoft Dynamics', icon: 'dynamics' },
        { id: 'freshbooks', name: 'FreshBooks', icon: 'freshbooks' },
        { id: 'wave', name: 'Wave', icon: 'wave' },
        { id: 'csv', name: 'CSV File', icon: 'csv' },
        { id: 'excel', name: 'Excel File', icon: 'excel' },
      ];
    }),

  getSupportedDataTypes: protectedProcedure
    .query(() => {
      return [
        { id: 'account', name: 'Chart of Accounts', category: 'master' },
        { id: 'customer', name: 'Customers', category: 'master' },
        { id: 'vendor', name: 'Vendors', category: 'master' },
        { id: 'item', name: 'Items/Products', category: 'master' },
        { id: 'journal_entry', name: 'Journal Entries', category: 'transaction' },
        { id: 'opening_balance', name: 'Opening Balances', category: 'transaction' },
      ];
    }),
});
