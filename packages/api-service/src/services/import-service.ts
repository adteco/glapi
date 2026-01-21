/**
 * Import Service
 *
 * Handles data import/migration operations including:
 * - Batch creation and management
 * - Record validation
 * - Field mapping and transformation
 * - Import execution with rollback support
 */

import {
  ImportBatchRepository,
  importBatchRepository,
} from '@glapi/database';
import {
  ImportBatchStatus,
  ImportRecordStatus,
  ImportDataType,
  ImportSourceSystem,
  ImportBatchOptions,
  ValidationRule,
  ValidationError,
  ValidationWarning,
  ValidationResult,
  ImportErrorSummary,
  ImportBatchResult,
  ImportProgress,
  ImportFieldMapping,
  CreateImportBatchRequest,
  AddRecordsToBatchRequest,
  ValidateBatchRequest,
  ExecuteImportRequest,
  RollbackImportRequest,
  getValidationRulesForDataType,
} from '../types';

// ============================================================================
// Types
// ============================================================================

export interface ImportServiceConfig {
  batchSize?: number;
  maxConcurrentImports?: number;
  defaultDateFormat?: string;
}

// ============================================================================
// Import Service
// ============================================================================

export class ImportService {
  private repository: ImportBatchRepository;
  private config: ImportServiceConfig;

  constructor(
    repository: ImportBatchRepository = importBatchRepository,
    config: ImportServiceConfig = {}
  ) {
    this.repository = repository;
    this.config = {
      batchSize: config.batchSize ?? 100,
      maxConcurrentImports: config.maxConcurrentImports ?? 5,
      defaultDateFormat: config.defaultDateFormat ?? 'YYYY-MM-DD',
    };
  }

  // ==========================================================================
  // Batch Management
  // ==========================================================================

  /**
   * Create a new import batch
   */
  async createBatch(request: CreateImportBatchRequest): Promise<ImportBatchResult> {
    const batchNumber = await this.repository.generateBatchNumber(request.organizationId);

    const batch = await this.repository.createBatch({
      organizationId: request.organizationId,
      batchNumber,
      name: request.name,
      description: request.description,
      sourceSystem: request.sourceSystem,
      sourceFile: request.sourceFile,
      dataTypes: request.dataTypes,
      options: request.options,
      createdBy: request.userId,
    });

    // Log the batch creation
    await this.repository.logAction({
      batchId: batch.id,
      action: 'BATCH_CREATED',
      details: {
        name: request.name,
        sourceSystem: request.sourceSystem,
        dataTypes: request.dataTypes,
      },
      performedBy: request.userId,
    });

    return this.toBatchResult(batch);
  }

  /**
   * Get batch by ID
   */
  async getBatch(batchId: string): Promise<ImportBatchResult | null> {
    const batch = await this.repository.findBatchById(batchId);
    if (!batch) return null;
    return this.toBatchResult(batch);
  }

  /**
   * List batches for an organization
   */
  async listBatches(
    organizationId: string,
    options: {
      status?: ImportBatchStatus | ImportBatchStatus[];
      sourceSystem?: ImportSourceSystem;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ items: ImportBatchResult[]; total: number }> {
    const result = await this.repository.listBatches({
      organizationId,
      ...options,
    });

    return {
      items: result.items.map(batch => this.toBatchResult(batch)),
      total: result.total,
    };
  }

  /**
   * Cancel a batch
   */
  async cancelBatch(batchId: string, userId: string): Promise<ImportBatchResult | null> {
    const batch = await this.repository.findBatchById(batchId);
    if (!batch) return null;

    // Can only cancel pending, validating, or validated batches
    if (!['pending', 'validating', 'validated'].includes(batch.status)) {
      throw new Error(`Cannot cancel batch in ${batch.status} status`);
    }

    const updated = await this.repository.cancelBatch(batchId);
    if (!updated) return null;

    await this.repository.logAction({
      batchId,
      action: 'BATCH_CANCELLED',
      performedBy: userId,
    });

    return this.toBatchResult(updated);
  }

  // ==========================================================================
  // Record Management
  // ==========================================================================

  /**
   * Add records to a batch
   */
  async addRecords(request: AddRecordsToBatchRequest): Promise<number> {
    const batch = await this.repository.findBatchById(request.batchId);
    if (!batch) {
      throw new Error('Batch not found');
    }

    if (batch.status !== 'pending') {
      throw new Error(`Cannot add records to batch in ${batch.status} status`);
    }

    const records = await this.repository.createRecords(
      request.records.map(r => ({
        batchId: request.batchId,
        rowNumber: r.rowNumber,
        externalId: r.externalId,
        dataType: r.dataType,
        rawData: r.rawData,
      }))
    );

    // Update batch total records count
    await this.repository.updateBatch(request.batchId, {
      totalRecords: batch.totalRecords + records.length,
    });

    return records.length;
  }

  /**
   * Get records for a batch
   */
  async getRecords(
    batchId: string,
    options: {
      status?: ImportRecordStatus | ImportRecordStatus[];
      dataType?: ImportDataType;
      page?: number;
      limit?: number;
    } = {}
  ) {
    return this.repository.listRecords({
      batchId,
      ...options,
    });
  }

  /**
   * Get invalid records with errors
   */
  async getInvalidRecords(batchId: string) {
    return this.repository.getInvalidRecords(batchId);
  }

  // ==========================================================================
  // Validation
  // ==========================================================================

  /**
   * Validate a batch
   */
  async validateBatch(request: ValidateBatchRequest): Promise<ImportBatchResult> {
    const batch = await this.repository.findBatchById(request.batchId);
    if (!batch) {
      throw new Error('Batch not found');
    }

    if (!['pending', 'validated'].includes(batch.status)) {
      throw new Error(`Cannot validate batch in ${batch.status} status`);
    }

    // Start validation
    await this.repository.startValidation(request.batchId);

    // Get field mapping if specified
    let fieldMappings: ImportFieldMapping[] | undefined;
    if (request.fieldMappingId) {
      const mapping = await this.repository.findFieldMappingById(request.fieldMappingId);
      if (mapping) {
        fieldMappings = mapping.mappings as ImportFieldMapping[];
      }
    }

    // Process records in batches
    let hasMore = true;
    let totalValid = 0;
    let totalInvalid = 0;

    while (hasMore) {
      const pendingRecords = await this.repository.getPendingRecords(
        request.batchId,
        this.config.batchSize
      );

      if (pendingRecords.length === 0) {
        hasMore = false;
        break;
      }

      for (const record of pendingRecords) {
        const validationResult = await this.validateRecord(
          record.rawData as Record<string, unknown>,
          record.dataType as ImportDataType,
          fieldMappings,
          request.options?.validationRules
        );

        if (validationResult.isValid) {
          await this.repository.markRecordValid(record.id, validationResult.mappedData);
          totalValid++;
        } else {
          await this.repository.markRecordInvalid(
            record.id,
            validationResult.errors,
            validationResult.warnings
          );
          totalInvalid++;
        }
      }
    }

    // Complete validation
    const errorSummary = await this.repository.getErrorSummary(request.batchId);
    const updated = await this.repository.completeValidation(request.batchId, errorSummary);

    return this.toBatchResult(updated!);
  }

  /**
   * Validate a single record
   */
  async validateRecord(
    data: Record<string, unknown>,
    dataType: ImportDataType,
    fieldMappings?: ImportFieldMapping[],
    customRules?: ValidationRule[]
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Apply field mappings first
    let mappedData: Record<string, unknown> = data;
    if (fieldMappings && fieldMappings.length > 0) {
      mappedData = this.applyFieldMappings(data, fieldMappings);
    }

    // Get validation rules for the data type
    const rules = [
      ...getValidationRulesForDataType(dataType),
      ...(customRules ?? []),
    ];

    // Apply each validation rule
    for (const rule of rules) {
      const result = this.applyValidationRule(mappedData, rule);
      if (result.error) {
        if (rule.severity === 'warning') {
          warnings.push({
            field: rule.field,
            code: result.error.code,
            message: result.error.message,
          });
        } else {
          errors.push(result.error);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      mappedData,
    };
  }

  /**
   * Apply field mappings to transform source data
   */
  private applyFieldMappings(
    data: Record<string, unknown>,
    mappings: ImportFieldMapping[]
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const mapping of mappings) {
      let value = this.getNestedValue(data, mapping.sourceField);

      // Apply default if value is empty
      if (value === null || value === undefined || value === '') {
        value = mapping.defaultValue;
      }

      // Apply transformation if specified
      if (mapping.transformation && value !== null && value !== undefined) {
        value = this.applyTransformation(value, mapping.transformation);
      }

      if (value !== null && value !== undefined) {
        result[mapping.targetField] = value;
      }
    }

    return result;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Apply a transformation to a value
   */
  private applyTransformation(value: unknown, transformation: string): unknown {
    switch (transformation) {
      case 'uppercase':
        return typeof value === 'string' ? value.toUpperCase() : value;
      case 'lowercase':
        return typeof value === 'string' ? value.toLowerCase() : value;
      case 'trim':
        return typeof value === 'string' ? value.trim() : value;
      case 'boolean':
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
          return ['true', 'yes', '1', 'y'].includes(value.toLowerCase());
        }
        return Boolean(value);
      case 'number':
        return Number(value);
      default:
        return value;
    }
  }

  /**
   * Apply a single validation rule
   */
  private applyValidationRule(
    data: Record<string, unknown>,
    rule: ValidationRule
  ): { error?: ValidationError } {
    const value = data[rule.field];

    // Check condition if specified
    if (rule.condition) {
      const conditionMet = this.checkCondition(data, rule.condition);
      if (!conditionMet) {
        return {}; // Skip this rule
      }
    }

    switch (rule.type) {
      case 'required':
        if (value === null || value === undefined || value === '') {
          return {
            error: {
              field: rule.field,
              code: 'REQUIRED',
              message: rule.message ?? `${rule.field} is required`,
            },
          };
        }
        break;

      case 'format':
        if (value !== null && value !== undefined && value !== '') {
          const params = rule.params ?? {};

          // Check pattern
          if (params.pattern) {
            const regex = new RegExp(params.pattern as string);
            if (!regex.test(String(value))) {
              return {
                error: {
                  field: rule.field,
                  code: 'FORMAT',
                  message: rule.message ?? `${rule.field} has invalid format`,
                  expected: params.pattern as string,
                  actual: value,
                },
              };
            }
          }

          // Check max length
          if (params.maxLength && String(value).length > (params.maxLength as number)) {
            return {
              error: {
                field: rule.field,
                code: 'MAX_LENGTH',
                message: rule.message ?? `${rule.field} exceeds maximum length of ${params.maxLength}`,
                expected: `max ${params.maxLength} characters`,
                actual: value,
              },
            };
          }
        }
        break;

      case 'range':
        if (value !== null && value !== undefined) {
          const numValue = Number(value);
          const params = rule.params ?? {};

          if (params.min !== undefined && numValue < (params.min as number)) {
            return {
              error: {
                field: rule.field,
                code: 'MIN_VALUE',
                message: rule.message ?? `${rule.field} must be at least ${params.min}`,
                expected: `>= ${params.min}`,
                actual: value,
              },
            };
          }

          if (params.max !== undefined && numValue > (params.max as number)) {
            return {
              error: {
                field: rule.field,
                code: 'MAX_VALUE',
                message: rule.message ?? `${rule.field} must be at most ${params.max}`,
                expected: `<= ${params.max}`,
                actual: value,
              },
            };
          }
        }
        break;

      case 'lookup':
        if (value !== null && value !== undefined && value !== '') {
          const params = rule.params ?? {};

          // Check against static values list
          if (params.values) {
            const values = params.values as unknown[];
            if (!values.includes(value)) {
              return {
                error: {
                  field: rule.field,
                  code: 'INVALID_VALUE',
                  message: rule.message ?? `${rule.field} must be one of: ${values.join(', ')}`,
                  expected: values.join(', '),
                  actual: value,
                },
              };
            }
          }

          // Table lookup would be done asynchronously in a real implementation
          // For now, we skip table lookups in synchronous validation
        }
        break;

      case 'unique':
        // Unique validation requires async database check
        // This would be handled separately in batch validation
        break;
    }

    return {};
  }

  /**
   * Check a validation condition
   */
  private checkCondition(
    data: Record<string, unknown>,
    condition: { field: string; operator: string; value?: unknown }
  ): boolean {
    const fieldValue = data[condition.field];

    switch (condition.operator) {
      case 'exists':
        return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
      case 'notExists':
        return fieldValue === null || fieldValue === undefined || fieldValue === '';
      case 'eq':
        return fieldValue === condition.value;
      case 'ne':
        return fieldValue !== condition.value;
      case 'gt':
        return Number(fieldValue) > Number(condition.value);
      case 'gte':
        return Number(fieldValue) >= Number(condition.value);
      case 'lt':
        return Number(fieldValue) < Number(condition.value);
      case 'lte':
        return Number(fieldValue) <= Number(condition.value);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);
      case 'notIn':
        return Array.isArray(condition.value) && !condition.value.includes(fieldValue);
      default:
        return true;
    }
  }

  // ==========================================================================
  // Import Execution
  // ==========================================================================

  /**
   * Execute import for a validated batch
   */
  async executeImport(request: ExecuteImportRequest): Promise<ImportBatchResult> {
    const batch = await this.repository.findBatchById(request.batchId);
    if (!batch) {
      throw new Error('Batch not found');
    }

    if (batch.status !== 'validated') {
      throw new Error(`Cannot import batch in ${batch.status} status`);
    }

    // Check if there are any invalid records
    const stats = await this.repository.getBatchStatistics(request.batchId);
    if (stats.invalid > 0 && !request.options?.continueOnErrors) {
      throw new Error(`Batch has ${stats.invalid} invalid records. Set continueOnErrors to proceed.`);
    }

    // Start import
    await this.repository.startImport(request.batchId);

    // Process valid records
    const validRecords = await this.repository.getValidRecords(request.batchId);

    for (const record of validRecords) {
      try {
        // Import the record based on data type
        const result = await this.importRecord(
          record.mappedData as Record<string, unknown>,
          record.dataType as ImportDataType,
          batch.organizationId
        );

        await this.repository.markRecordImported(
          record.id,
          result.entityId,
          result.entityType
        );

        // Log successful import for rollback
        if (batch.canRollback) {
          await this.repository.logAction({
            batchId: request.batchId,
            recordId: record.id,
            action: 'RECORD_IMPORTED',
            afterState: result,
            performedBy: batch.createdBy,
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (request.options?.continueOnErrors) {
          await this.repository.markRecordFailed(record.id, errorMessage);
        } else {
          // Fail the batch
          await this.repository.failBatch(request.batchId, {
            totalErrors: 1,
            errorsByCode: { IMPORT_ERROR: 1 },
            errorsByField: {},
            sampleErrors: [{
              field: 'import',
              code: 'IMPORT_ERROR',
              message: errorMessage,
            }],
          });

          throw error;
        }
      }
    }

    // Complete import
    const updated = await this.repository.completeImport(request.batchId);

    return this.toBatchResult(updated!);
  }

  /**
   * Import a single record (placeholder for actual import logic)
   * This would be extended to call specific import handlers based on data type
   */
  private async importRecord(
    data: Record<string, unknown>,
    dataType: ImportDataType,
    organizationId: string
  ): Promise<{ entityId: string; entityType: string }> {
    // This is a placeholder - actual implementation would:
    // 1. Call the appropriate service based on dataType
    // 2. Create/update the entity
    // 3. Return the created entity ID

    // For now, generate a mock ID
    const entityId = `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return {
      entityId,
      entityType: dataType,
    };
  }

  // ==========================================================================
  // Rollback
  // ==========================================================================

  /**
   * Rollback an imported batch
   */
  async rollbackBatch(request: RollbackImportRequest): Promise<ImportBatchResult> {
    const batch = await this.repository.findBatchById(request.batchId);
    if (!batch) {
      throw new Error('Batch not found');
    }

    if (batch.status !== 'completed') {
      throw new Error(`Cannot rollback batch in ${batch.status} status`);
    }

    if (!batch.canRollback) {
      throw new Error('Batch rollback is not available');
    }

    // Get audit logs with imported records
    const auditLogs = await this.repository.getAuditLogs(request.batchId);
    const importLogs = auditLogs.filter(log => log.action === 'RECORD_IMPORTED');

    // Rollback each imported record (reverse order)
    for (const log of importLogs.reverse()) {
      // Actual rollback would delete/revert the imported entities
      // This is a placeholder for the actual rollback logic
    }

    // Mark batch as rolled back
    const updated = await this.repository.rollbackBatch(request.batchId, request.userId);

    await this.repository.logAction({
      batchId: request.batchId,
      action: 'BATCH_ROLLED_BACK',
      details: { reason: request.reason },
      performedBy: request.userId,
    });

    return this.toBatchResult(updated!);
  }

  // ==========================================================================
  // Progress Tracking
  // ==========================================================================

  /**
   * Get import progress
   */
  async getProgress(batchId: string): Promise<ImportProgress | null> {
    const batch = await this.repository.findBatchById(batchId);
    if (!batch) return null;

    const stats = await this.repository.getBatchStatistics(batchId);

    let phase: 'validation' | 'import' | 'complete';
    let processedRecords: number;

    switch (batch.status) {
      case 'pending':
        phase = 'validation';
        processedRecords = 0;
        break;
      case 'validating':
        phase = 'validation';
        processedRecords = stats.valid + stats.invalid;
        break;
      case 'validated':
        phase = 'import';
        processedRecords = 0;
        break;
      case 'processing':
        phase = 'import';
        processedRecords = stats.imported + stats.skipped + stats.failed;
        break;
      default:
        phase = 'complete';
        processedRecords = batch.totalRecords;
    }

    const percentComplete = batch.totalRecords > 0
      ? Math.round((processedRecords / batch.totalRecords) * 100)
      : 0;

    return {
      batchId,
      status: batch.status as ImportBatchStatus,
      phase,
      totalRecords: batch.totalRecords,
      processedRecords,
      percentComplete,
      errors: stats.invalid + stats.failed,
      warnings: 0, // Would need to aggregate from records
    };
  }

  // ==========================================================================
  // Templates
  // ==========================================================================

  /**
   * Get available import templates
   */
  async getTemplates(
    organizationId?: string,
    sourceSystem?: ImportSourceSystem
  ) {
    return this.repository.listTemplates(organizationId, sourceSystem);
  }

  /**
   * Get field mappings for an organization
   */
  async getFieldMappings(
    organizationId: string,
    sourceSystem?: ImportSourceSystem,
    dataType?: ImportDataType
  ) {
    return this.repository.listFieldMappings(organizationId, sourceSystem, dataType);
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * Convert database batch to result type
   */
  private toBatchResult(batch: any): ImportBatchResult {
    return {
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      status: batch.status,
      totalRecords: batch.totalRecords,
      validRecords: batch.validRecords,
      invalidRecords: batch.invalidRecords,
      importedRecords: batch.importedRecords,
      skippedRecords: batch.skippedRecords,
      failedRecords: batch.failedRecords,
      errorSummary: batch.errorSummary,
      startedAt: batch.createdAt,
      completedAt: batch.importCompletedAt,
      durationMs: batch.importCompletedAt
        ? batch.importCompletedAt.getTime() - batch.createdAt.getTime()
        : undefined,
    };
  }
}

// Export singleton instance
export const importService = new ImportService();
