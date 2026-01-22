import { BaseService } from './base-service';
import {
  ProjectBudgetVersion,
  ProjectBudgetLine,
  CreateBudgetVersionInput,
  UpdateBudgetVersionInput,
  UpdateBudgetVersionStatusInput,
  CreateBudgetLineInput,
  UpdateBudgetLineInput,
  BudgetVersionFilters,
  BudgetLineWithCostCode,
  BudgetVarianceSummary,
  ImportBudgetRow,
  BudgetImportOptions,
  BudgetImportResult,
  CopyBudgetVersionInput,
  VALID_BUDGET_STATUS_TRANSITIONS,
  BudgetVersionStatus,
} from '../types/project-budgets.types';
import { PaginationParams, PaginatedResult, ServiceError } from '../types';
import { ProjectBudgetRepository, ProjectCostCodeRepository } from '@glapi/database';

export class ProjectBudgetService extends BaseService {
  private budgetRepository: ProjectBudgetRepository;
  private costCodeRepository: ProjectCostCodeRepository;

  constructor(context = {}) {
    super(context);
    this.budgetRepository = new ProjectBudgetRepository();
    this.costCodeRepository = new ProjectCostCodeRepository();
  }

  /**
   * Get accessible project IDs for the current organization
   */
  private async getAccessibleProjectIds(): Promise<string[]> {
    const organizationId = this.requireOrganizationContext();
    return this.budgetRepository.getAccessibleProjectIds(organizationId);
  }

  /**
   * Transform database budget version to service layer type
   */
  private transformVersion(dbVersion: any): ProjectBudgetVersion {
    return {
      id: dbVersion.id,
      projectId: dbVersion.projectId,
      versionNumber: dbVersion.versionNumber,
      versionName: dbVersion.versionName,
      status: dbVersion.status,
      isCurrent: dbVersion.isCurrent,
      effectiveDate: dbVersion.effectiveDate,
      expirationDate: dbVersion.expirationDate,
      description: dbVersion.description,
      notes: dbVersion.notes,
      totalBudgetAmount: dbVersion.totalBudgetAmount,
      totalLaborAmount: dbVersion.totalLaborAmount,
      totalMaterialAmount: dbVersion.totalMaterialAmount,
      totalEquipmentAmount: dbVersion.totalEquipmentAmount,
      totalSubcontractAmount: dbVersion.totalSubcontractAmount,
      totalOtherAmount: dbVersion.totalOtherAmount,
      createdBy: dbVersion.createdBy,
      submittedBy: dbVersion.submittedBy,
      submittedDate: dbVersion.submittedDate,
      approvedBy: dbVersion.approvedBy,
      approvedDate: dbVersion.approvedDate,
      lockedBy: dbVersion.lockedBy,
      lockedDate: dbVersion.lockedDate,
      importSource: dbVersion.importSource,
      importFileName: dbVersion.importFileName,
      importDate: dbVersion.importDate,
      metadata: dbVersion.metadata,
      createdAt: dbVersion.createdAt,
      updatedAt: dbVersion.updatedAt,
    };
  }

  /**
   * Transform database budget line to service layer type
   */
  private transformLine(dbLine: any): ProjectBudgetLine {
    return {
      id: dbLine.id,
      budgetVersionId: dbLine.budgetVersionId,
      projectCostCodeId: dbLine.projectCostCodeId,
      lineNumber: dbLine.lineNumber,
      description: dbLine.description,
      originalBudgetAmount: dbLine.originalBudgetAmount,
      revisedBudgetAmount: dbLine.revisedBudgetAmount,
      approvedChanges: dbLine.approvedChanges,
      pendingChanges: dbLine.pendingChanges,
      committedAmount: dbLine.committedAmount,
      actualAmount: dbLine.actualAmount,
      encumberedAmount: dbLine.encumberedAmount,
      forecastAmount: dbLine.forecastAmount,
      estimateToComplete: dbLine.estimateToComplete,
      estimateAtCompletion: dbLine.estimateAtCompletion,
      varianceAmount: dbLine.varianceAmount,
      variancePercent: dbLine.variancePercent,
      budgetUnits: dbLine.budgetUnits,
      actualUnits: dbLine.actualUnits,
      unitOfMeasure: dbLine.unitOfMeasure,
      unitRate: dbLine.unitRate,
      notes: dbLine.notes,
      metadata: dbLine.metadata,
      createdAt: dbLine.createdAt,
      updatedAt: dbLine.updatedAt,
    };
  }

  // ========== Budget Version Methods ==========

  /**
   * List budget versions with filters and pagination
   */
  async listVersions(
    params: PaginationParams = {},
    filters: BudgetVersionFilters = {},
    orderBy: 'versionNumber' | 'versionName' | 'status' | 'createdAt' | 'effectiveDate' = 'versionNumber',
    orderDirection: 'asc' | 'desc' = 'desc'
  ): Promise<PaginatedResult<ProjectBudgetVersion>> {
    const projectIds = await this.getAccessibleProjectIds();

    if (projectIds.length === 0) {
      return this.createPaginatedResult([], 0, params.page || 1, params.limit || 20);
    }

    const result = await this.budgetRepository.findAllVersions(
      projectIds,
      { page: params.page, limit: params.limit, orderBy, orderDirection },
      filters
    );

    return {
      ...result,
      data: result.data.map((v) => this.transformVersion(v)),
    };
  }

  /**
   * Get a budget version by ID
   */
  async getVersionById(id: string): Promise<ProjectBudgetVersion | null> {
    const projectIds = await this.getAccessibleProjectIds();

    if (projectIds.length === 0) {
      return null;
    }

    const version = await this.budgetRepository.findVersionById(id, projectIds);
    return version ? this.transformVersion(version) : null;
  }

  /**
   * Get the current budget version for a project
   */
  async getCurrentVersion(projectId: string): Promise<ProjectBudgetVersion | null> {
    const projectIds = await this.getAccessibleProjectIds();

    if (!projectIds.includes(projectId)) {
      throw new ServiceError('Access denied to this project', 'PROJECT_ACCESS_DENIED', 403);
    }

    const version = await this.budgetRepository.getCurrentVersion(projectId, projectIds);
    return version ? this.transformVersion(version) : null;
  }

  /**
   * Create a new budget version
   */
  async createVersion(input: CreateBudgetVersionInput): Promise<ProjectBudgetVersion> {
    const projectIds = await this.getAccessibleProjectIds();

    if (!projectIds.includes(input.projectId)) {
      throw new ServiceError('Access denied to this project', 'PROJECT_ACCESS_DENIED', 403);
    }

    const userId = this.requireUserContext();
    const versionNumber = await this.budgetRepository.getNextVersionNumber(input.projectId);

    const created = await this.budgetRepository.createVersion({
      projectId: input.projectId,
      versionName: input.versionName,
      description: input.description,
      effectiveDate: input.effectiveDate,
      notes: input.notes,
      metadata: input.metadata,
      versionNumber,
      createdBy: userId,
    });

    return this.transformVersion(created);
  }

  /**
   * Update a budget version
   */
  async updateVersion(id: string, input: UpdateBudgetVersionInput): Promise<ProjectBudgetVersion> {
    const projectIds = await this.getAccessibleProjectIds();

    if (projectIds.length === 0) {
      throw new ServiceError('Access denied', 'PROJECT_ACCESS_DENIED', 403);
    }

    const existing = await this.budgetRepository.findVersionById(id, projectIds);
    if (!existing) {
      throw new ServiceError(`Budget version with ID "${id}" not found`, 'VERSION_NOT_FOUND', 404);
    }

    // Only DRAFT versions can be updated
    if (existing.status !== 'DRAFT') {
      throw new ServiceError(
        `Cannot update budget version with status "${existing.status}". Only DRAFT versions can be updated.`,
        'VERSION_NOT_EDITABLE',
        400
      );
    }

    // Convert null to undefined for repository compatibility
    const sanitizedInput = {
      ...input,
      description: input.description ?? undefined,
      notes: input.notes ?? undefined,
      effectiveDate: input.effectiveDate ?? undefined,
      expirationDate: input.expirationDate ?? undefined,
      metadata: input.metadata ?? undefined,
    };

    const updated = await this.budgetRepository.updateVersion(id, projectIds, sanitizedInput);
    if (!updated) {
      throw new ServiceError('Failed to update budget version', 'UPDATE_FAILED', 500);
    }

    return this.transformVersion(updated);
  }

  /**
   * Update budget version status
   */
  async updateVersionStatus(
    id: string,
    input: UpdateBudgetVersionStatusInput
  ): Promise<ProjectBudgetVersion> {
    const projectIds = await this.getAccessibleProjectIds();
    const userId = this.requireUserContext();

    if (projectIds.length === 0) {
      throw new ServiceError('Access denied', 'PROJECT_ACCESS_DENIED', 403);
    }

    const existing = await this.budgetRepository.findVersionById(id, projectIds);
    if (!existing) {
      throw new ServiceError(`Budget version with ID "${id}" not found`, 'VERSION_NOT_FOUND', 404);
    }

    // Validate status transition
    const validTransitions = VALID_BUDGET_STATUS_TRANSITIONS[existing.status as BudgetVersionStatus];
    if (!validTransitions.includes(input.status)) {
      throw new ServiceError(
        `Invalid status transition from "${existing.status}" to "${input.status}"`,
        'INVALID_STATUS_TRANSITION',
        400
      );
    }

    const updated = await this.budgetRepository.updateVersionStatus(id, projectIds, {
      status: input.status,
      userId,
    });

    if (!updated) {
      throw new ServiceError('Failed to update budget version status', 'UPDATE_FAILED', 500);
    }

    return this.transformVersion(updated);
  }

  /**
   * Set a budget version as current
   */
  async setCurrentVersion(id: string): Promise<ProjectBudgetVersion> {
    const projectIds = await this.getAccessibleProjectIds();

    if (projectIds.length === 0) {
      throw new ServiceError('Access denied', 'PROJECT_ACCESS_DENIED', 403);
    }

    const existing = await this.budgetRepository.findVersionById(id, projectIds);
    if (!existing) {
      throw new ServiceError(`Budget version with ID "${id}" not found`, 'VERSION_NOT_FOUND', 404);
    }

    // Only APPROVED or LOCKED versions can be set as current
    if (!['APPROVED', 'LOCKED'].includes(existing.status)) {
      throw new ServiceError(
        `Only APPROVED or LOCKED budget versions can be set as current. Current status: "${existing.status}"`,
        'VERSION_NOT_APPROVED',
        400
      );
    }

    const updated = await this.budgetRepository.setCurrentVersion(
      id,
      existing.projectId,
      projectIds
    );

    if (!updated) {
      throw new ServiceError('Failed to set budget version as current', 'UPDATE_FAILED', 500);
    }

    return this.transformVersion(updated);
  }

  /**
   * Copy a budget version to create a new draft
   */
  async copyVersion(input: CopyBudgetVersionInput): Promise<ProjectBudgetVersion> {
    const projectIds = await this.getAccessibleProjectIds();
    const userId = this.requireUserContext();

    if (projectIds.length === 0) {
      throw new ServiceError('Access denied', 'PROJECT_ACCESS_DENIED', 403);
    }

    const copied = await this.budgetRepository.copyVersion(
      input.sourceVersionId,
      projectIds,
      input.newVersionName,
      userId
    );

    if (!copied) {
      throw new ServiceError('Failed to copy budget version', 'COPY_FAILED', 500);
    }

    return this.transformVersion(copied);
  }

  /**
   * Delete a budget version (only DRAFT)
   */
  async deleteVersion(id: string): Promise<void> {
    const projectIds = await this.getAccessibleProjectIds();

    if (projectIds.length === 0) {
      throw new ServiceError('Access denied', 'PROJECT_ACCESS_DENIED', 403);
    }

    const existing = await this.budgetRepository.findVersionById(id, projectIds);
    if (!existing) {
      throw new ServiceError(`Budget version with ID "${id}" not found`, 'VERSION_NOT_FOUND', 404);
    }

    if (existing.status !== 'DRAFT') {
      throw new ServiceError(
        `Cannot delete budget version with status "${existing.status}". Only DRAFT versions can be deleted.`,
        'VERSION_NOT_DELETABLE',
        400
      );
    }

    if (existing.isCurrent) {
      throw new ServiceError(
        'Cannot delete the current budget version. Set another version as current first.',
        'VERSION_IS_CURRENT',
        400
      );
    }

    await this.budgetRepository.deleteVersion(id, projectIds);
  }

  // ========== Budget Line Methods ==========

  /**
   * Get budget lines for a version
   */
  async getVersionLines(budgetVersionId: string): Promise<ProjectBudgetLine[]> {
    const projectIds = await this.getAccessibleProjectIds();

    // Verify access to the version
    const version = await this.budgetRepository.findVersionById(budgetVersionId, projectIds);
    if (!version) {
      throw new ServiceError('Budget version not found', 'VERSION_NOT_FOUND', 404);
    }

    const lines = await this.budgetRepository.findLinesByVersion(budgetVersionId);
    return lines.map((l) => this.transformLine(l));
  }

  /**
   * Get budget lines with cost code details
   */
  async getVersionLinesWithCostCodes(budgetVersionId: string): Promise<BudgetLineWithCostCode[]> {
    const projectIds = await this.getAccessibleProjectIds();

    // Verify access to the version
    const version = await this.budgetRepository.findVersionById(budgetVersionId, projectIds);
    if (!version) {
      throw new ServiceError('Budget version not found', 'VERSION_NOT_FOUND', 404);
    }

    const linesWithCodes = await this.budgetRepository.findLinesWithCostCodes(budgetVersionId);
    return linesWithCodes.map((item) => ({
      ...this.transformLine(item.line),
      costCode: {
        id: item.costCode.id,
        costCode: item.costCode.costCode,
        name: item.costCode.name,
        costType: item.costCode.costType,
      },
    }));
  }

  /**
   * Create a budget line
   */
  async createLine(budgetVersionId: string, input: CreateBudgetLineInput): Promise<ProjectBudgetLine> {
    const projectIds = await this.getAccessibleProjectIds();

    // Verify access and editability
    const version = await this.budgetRepository.findVersionById(budgetVersionId, projectIds);
    if (!version) {
      throw new ServiceError('Budget version not found', 'VERSION_NOT_FOUND', 404);
    }

    if (version.status !== 'DRAFT') {
      throw new ServiceError(
        `Cannot add lines to budget version with status "${version.status}". Only DRAFT versions can be modified.`,
        'VERSION_NOT_EDITABLE',
        400
      );
    }

    // Verify cost code exists and belongs to the same project
    const costCode = await this.costCodeRepository.findById(input.projectCostCodeId, projectIds);
    if (!costCode) {
      throw new ServiceError('Cost code not found', 'COST_CODE_NOT_FOUND', 404);
    }

    if (costCode.projectId !== version.projectId) {
      throw new ServiceError(
        'Cost code must belong to the same project as the budget',
        'COST_CODE_PROJECT_MISMATCH',
        400
      );
    }

    // Get next line number
    const existingLines = await this.budgetRepository.findLinesByVersion(budgetVersionId);
    const nextLineNumber = existingLines.length > 0
      ? Math.max(...existingLines.map((l) => l.lineNumber)) + 1
      : 1;

    const created = await this.budgetRepository.createLine({
      projectCostCodeId: input.projectCostCodeId,
      description: input.description,
      originalBudgetAmount: input.originalBudgetAmount,
      budgetUnits: input.budgetUnits,
      unitOfMeasure: input.unitOfMeasure,
      unitRate: input.unitRate,
      notes: input.notes,
      metadata: input.metadata,
      budgetVersionId,
      lineNumber: nextLineNumber,
    });

    // Recalculate version totals
    await this.budgetRepository.recalculateVersionTotals(budgetVersionId);

    return this.transformLine(created);
  }

  /**
   * Update a budget line
   */
  async updateLine(lineId: string, input: UpdateBudgetLineInput): Promise<ProjectBudgetLine> {
    const projectIds = await this.getAccessibleProjectIds();

    const line = await this.budgetRepository.findLineById(lineId);
    if (!line) {
      throw new ServiceError('Budget line not found', 'LINE_NOT_FOUND', 404);
    }

    const version = await this.budgetRepository.findVersionById(line.budgetVersionId, projectIds);
    if (!version) {
      throw new ServiceError('Access denied', 'PROJECT_ACCESS_DENIED', 403);
    }

    if (version.status !== 'DRAFT') {
      throw new ServiceError(
        `Cannot modify lines in budget version with status "${version.status}". Only DRAFT versions can be modified.`,
        'VERSION_NOT_EDITABLE',
        400
      );
    }

    // Convert null to undefined for repository compatibility
    const sanitizedInput = {
      originalBudgetAmount: input.originalBudgetAmount,
      revisedBudgetAmount: input.revisedBudgetAmount,
      approvedChanges: input.approvedChanges,
      pendingChanges: input.pendingChanges,
      forecastAmount: input.forecastAmount,
      estimateToComplete: input.estimateToComplete,
      budgetUnits: input.budgetUnits ?? undefined,
      actualUnits: input.actualUnits ?? undefined,
      description: input.description ?? undefined,
      unitOfMeasure: input.unitOfMeasure ?? undefined,
      unitRate: input.unitRate ?? undefined,
      notes: input.notes ?? undefined,
      metadata: input.metadata ?? undefined,
    };

    const updated = await this.budgetRepository.updateLine(lineId, sanitizedInput);
    if (!updated) {
      throw new ServiceError('Failed to update budget line', 'UPDATE_FAILED', 500);
    }

    // Recalculate version totals
    await this.budgetRepository.recalculateVersionTotals(line.budgetVersionId);

    return this.transformLine(updated);
  }

  /**
   * Delete a budget line
   */
  async deleteLine(lineId: string): Promise<void> {
    const projectIds = await this.getAccessibleProjectIds();

    const line = await this.budgetRepository.findLineById(lineId);
    if (!line) {
      throw new ServiceError('Budget line not found', 'LINE_NOT_FOUND', 404);
    }

    const version = await this.budgetRepository.findVersionById(line.budgetVersionId, projectIds);
    if (!version) {
      throw new ServiceError('Access denied', 'PROJECT_ACCESS_DENIED', 403);
    }

    if (version.status !== 'DRAFT') {
      throw new ServiceError(
        `Cannot delete lines from budget version with status "${version.status}". Only DRAFT versions can be modified.`,
        'VERSION_NOT_EDITABLE',
        400
      );
    }

    await this.budgetRepository.deleteLine(lineId);

    // Recalculate version totals
    await this.budgetRepository.recalculateVersionTotals(line.budgetVersionId);
  }

  // ========== Import Methods ==========

  /**
   * Import budget from CSV data
   */
  async importBudget(options: BudgetImportOptions, rows: ImportBudgetRow[]): Promise<BudgetImportResult> {
    const projectIds = await this.getAccessibleProjectIds();

    if (!projectIds.includes(options.projectId)) {
      throw new ServiceError('Access denied to this project', 'PROJECT_ACCESS_DENIED', 403);
    }

    const userId = this.requireUserContext();
    const result: BudgetImportResult = {
      success: true,
      versionId: null,
      totalRows: rows.length,
      importedCount: 0,
      skippedCount: 0,
      errors: [],
      warnings: [],
    };

    // Get existing cost codes for the project
    const costCodesResult = await this.costCodeRepository.findAll(
      projectIds,
      { limit: 1000 },
      { projectId: options.projectId, isActive: true }
    );
    const costCodeMap = new Map<string, string>();
    for (const cc of costCodesResult.data) {
      costCodeMap.set(cc.costCode, cc.id);
    }

    // Validate all rows first
    const validRows: Array<{ row: ImportBudgetRow; costCodeId: string; rowIndex: number }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowIndex = i + 1;

      const costCodeId = costCodeMap.get(row.costCode);
      if (!costCodeId) {
        if (options.createMissingCostCodes) {
          result.warnings.push({
            row: rowIndex,
            costCode: row.costCode,
            warning: 'Cost code not found, will be created',
          });
        } else {
          result.errors.push({
            row: rowIndex,
            costCode: row.costCode,
            error: `Cost code "${row.costCode}" not found`,
          });
          result.skippedCount++;
          continue;
        }
      }

      // Validate amount
      const amount = parseFloat(row.budgetAmount);
      if (isNaN(amount)) {
        result.errors.push({
          row: rowIndex,
          costCode: row.costCode,
          error: `Invalid budget amount: "${row.budgetAmount}"`,
        });
        result.skippedCount++;
        continue;
      }

      validRows.push({ row, costCodeId: costCodeId || '', rowIndex });
    }

    if (!options.skipInvalidRows && result.errors.length > 0) {
      result.success = false;
      return result;
    }

    // Create budget version
    const versionNumber = await this.budgetRepository.getNextVersionNumber(options.projectId);
    const version = await this.budgetRepository.createVersion({
      projectId: options.projectId,
      versionNumber,
      versionName: options.versionName,
      description: options.description,
      effectiveDate: options.effectiveDate,
      createdBy: userId,
      importSource: 'CSV',
    });

    result.versionId = version.id;

    // Create missing cost codes if needed
    if (options.createMissingCostCodes) {
      for (const { row, rowIndex } of validRows) {
        if (!costCodeMap.has(row.costCode)) {
          try {
            const newCostCode = await this.costCodeRepository.create({
              projectId: options.projectId,
              costCode: row.costCode,
              costType: 'OTHER',
              name: row.costCode,
              description: row.description,
              createdBy: userId,
            });
            costCodeMap.set(row.costCode, newCostCode.id);
          } catch (error: any) {
            result.errors.push({
              row: rowIndex,
              costCode: row.costCode,
              error: `Failed to create cost code: ${error.message}`,
            });
            result.skippedCount++;
          }
        }
      }
    }

    // Create budget lines
    const linesToCreate = validRows
      .filter(({ row }) => costCodeMap.has(row.costCode))
      .map(({ row }, index) => ({
        budgetVersionId: version.id,
        projectCostCodeId: costCodeMap.get(row.costCode)!,
        lineNumber: index + 1,
        description: row.description,
        originalBudgetAmount: row.budgetAmount,
        budgetUnits: row.budgetUnits,
        unitOfMeasure: row.unitOfMeasure,
        unitRate: row.unitRate,
        notes: row.notes,
      }));

    if (linesToCreate.length > 0) {
      await this.budgetRepository.bulkCreateLines(linesToCreate);
      result.importedCount = linesToCreate.length;
    }

    // Recalculate totals
    await this.budgetRepository.recalculateVersionTotals(version.id);

    result.success = result.errors.length === 0;
    return result;
  }

  // ========== Reporting Methods ==========

  /**
   * Get variance summary for a budget version
   */
  async getVarianceSummary(budgetVersionId: string): Promise<BudgetVarianceSummary[]> {
    const projectIds = await this.getAccessibleProjectIds();

    const version = await this.budgetRepository.findVersionById(budgetVersionId, projectIds);
    if (!version) {
      throw new ServiceError('Budget version not found', 'VERSION_NOT_FOUND', 404);
    }

    const summary = await this.budgetRepository.getVarianceSummary(budgetVersionId);
    return summary.map((s) => {
      const totalBudget = parseFloat(String(s.totalBudget || '0'));
      const totalVariance = parseFloat(String(s.totalVariance || '0'));
      const variancePercent = totalBudget !== 0 ? (totalVariance / totalBudget) * 100 : 0;

      return {
        costType: s.costType,
        totalBudget: String(s.totalBudget || '0'),
        totalActual: String(s.totalActual || '0'),
        totalCommitted: String(s.totalCommitted || '0'),
        totalVariance: String(s.totalVariance || '0'),
        variancePercent,
      };
    });
  }

  /**
   * Update budget line amounts from transaction posting
   */
  async updateLineAmountsFromPosting(
    lineId: string,
    amounts: {
      committedAmount?: string;
      actualAmount?: string;
      encumberedAmount?: string;
    }
  ): Promise<ProjectBudgetLine | null> {
    const updated = await this.budgetRepository.updateLineAmounts(lineId, amounts);
    return updated ? this.transformLine(updated) : null;
  }
}
