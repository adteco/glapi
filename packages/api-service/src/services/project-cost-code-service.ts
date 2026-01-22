import { BaseService } from './base-service';
import {
  ProjectCostCode,
  CreateCostCodeInput,
  UpdateCostCodeInput,
  CostCodeFilters,
  CostCodeTreeNode,
  CostCodeTypeSummary,
  ImportCostCodeRow,
  CostCodeImportResult,
} from '../types/project-cost-codes.types';
import { PaginationParams, PaginatedResult, ServiceError } from '../types';
import { ProjectCostCodeRepository } from '@glapi/database';

export class ProjectCostCodeService extends BaseService {
  private costCodeRepository: ProjectCostCodeRepository;

  constructor(context = {}) {
    super(context);
    this.costCodeRepository = new ProjectCostCodeRepository();
  }

  /**
   * Get accessible project IDs for the current organization
   */
  private async getAccessibleProjectIds(): Promise<string[]> {
    const organizationId = this.requireOrganizationContext();
    return this.costCodeRepository.getAccessibleProjectIds(organizationId);
  }

  /**
   * Transform database cost code to service layer type
   */
  private transformCostCode(dbCostCode: any): ProjectCostCode {
    return {
      id: dbCostCode.id,
      projectId: dbCostCode.projectId,
      parentCostCodeId: dbCostCode.parentCostCodeId,
      activityCodeId: dbCostCode.activityCodeId,
      costCode: dbCostCode.costCode,
      costType: dbCostCode.costType,
      name: dbCostCode.name,
      description: dbCostCode.description,
      sortOrder: dbCostCode.sortOrder,
      isActive: dbCostCode.isActive,
      isBillable: dbCostCode.isBillable,
      budgetAmount: dbCostCode.budgetAmount,
      committedAmount: dbCostCode.committedAmount,
      actualAmount: dbCostCode.actualAmount,
      revenueAccountId: dbCostCode.revenueAccountId,
      costAccountId: dbCostCode.costAccountId,
      wipAccountId: dbCostCode.wipAccountId,
      metadata: dbCostCode.metadata,
      createdBy: dbCostCode.createdBy,
      createdAt: dbCostCode.createdAt,
      updatedAt: dbCostCode.updatedAt,
    };
  }

  /**
   * List cost codes with filters and pagination
   */
  async listCostCodes(
    params: PaginationParams = {},
    filters: CostCodeFilters = {},
    orderBy: 'costCode' | 'name' | 'sortOrder' | 'createdAt' = 'sortOrder',
    orderDirection: 'asc' | 'desc' = 'asc'
  ): Promise<PaginatedResult<ProjectCostCode>> {
    const projectIds = await this.getAccessibleProjectIds();

    if (projectIds.length === 0) {
      return this.createPaginatedResult([], 0, params.page || 1, params.limit || 50);
    }

    const result = await this.costCodeRepository.findAll(
      projectIds,
      { page: params.page, limit: params.limit, orderBy, orderDirection },
      filters
    );

    return {
      ...result,
      data: result.data.map((c) => this.transformCostCode(c)),
    };
  }

  /**
   * Get a cost code by ID
   */
  async getCostCodeById(id: string): Promise<ProjectCostCode | null> {
    const projectIds = await this.getAccessibleProjectIds();

    if (projectIds.length === 0) {
      return null;
    }

    const costCode = await this.costCodeRepository.findById(id, projectIds);
    return costCode ? this.transformCostCode(costCode) : null;
  }

  /**
   * Get cost codes for a project as a tree structure
   */
  async getCostCodeTree(projectId: string): Promise<CostCodeTreeNode[]> {
    const projectIds = await this.getAccessibleProjectIds();

    if (!projectIds.includes(projectId)) {
      throw new ServiceError('Access denied to this project', 'PROJECT_ACCESS_DENIED', 403);
    }

    const allCodes = await this.costCodeRepository.findTreeByProject(projectId, projectIds);
    const codesMap = new Map<string, CostCodeTreeNode>();

    // First pass: create all nodes
    for (const code of allCodes) {
      codesMap.set(code.id, {
        ...this.transformCostCode(code),
        children: [],
      });
    }

    // Second pass: build tree structure
    const roots: CostCodeTreeNode[] = [];
    for (const code of allCodes) {
      const node = codesMap.get(code.id)!;
      if (code.parentCostCodeId && codesMap.has(code.parentCostCodeId)) {
        codesMap.get(code.parentCostCodeId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  /**
   * Get children of a cost code
   */
  async getCostCodeChildren(parentId: string): Promise<ProjectCostCode[]> {
    const projectIds = await this.getAccessibleProjectIds();

    if (projectIds.length === 0) {
      return [];
    }

    const children = await this.costCodeRepository.findChildren(parentId, projectIds);
    return children.map((c) => this.transformCostCode(c));
  }

  /**
   * Create a new cost code
   */
  async createCostCode(input: CreateCostCodeInput): Promise<ProjectCostCode> {
    const projectIds = await this.getAccessibleProjectIds();

    if (!projectIds.includes(input.projectId)) {
      throw new ServiceError('Access denied to this project', 'PROJECT_ACCESS_DENIED', 403);
    }

    // Check for duplicate cost code within project
    const exists = await this.costCodeRepository.existsByCode(input.projectId, input.costCode);
    if (exists) {
      throw new ServiceError(
        `Cost code "${input.costCode}" already exists in this project`,
        'COST_CODE_DUPLICATE',
        400
      );
    }

    // Validate parent if provided
    if (input.parentCostCodeId) {
      const parent = await this.costCodeRepository.findById(input.parentCostCodeId, projectIds);
      if (!parent) {
        throw new ServiceError('Parent cost code not found', 'PARENT_NOT_FOUND', 404);
      }
      if (parent.projectId !== input.projectId) {
        throw new ServiceError(
          'Parent cost code must be in the same project',
          'PARENT_PROJECT_MISMATCH',
          400
        );
      }
    }

    const userId = this.requireUserContext();
    const created = await this.costCodeRepository.create({
      projectId: input.projectId,
      costCode: input.costCode,
      costType: input.costType,
      name: input.name,
      description: input.description,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
      isBillable: input.isBillable,
      parentCostCodeId: input.parentCostCodeId,
      activityCodeId: input.activityCodeId,
      revenueAccountId: input.revenueAccountId,
      costAccountId: input.costAccountId,
      wipAccountId: input.wipAccountId,
      metadata: input.metadata,
      createdBy: userId,
    });

    return this.transformCostCode(created);
  }

  /**
   * Update a cost code
   */
  async updateCostCode(id: string, input: UpdateCostCodeInput): Promise<ProjectCostCode> {
    const projectIds = await this.getAccessibleProjectIds();

    if (projectIds.length === 0) {
      throw new ServiceError('Access denied', 'PROJECT_ACCESS_DENIED', 403);
    }

    const existing = await this.costCodeRepository.findById(id, projectIds);
    if (!existing) {
      throw new ServiceError(`Cost code with ID "${id}" not found`, 'COST_CODE_NOT_FOUND', 404);
    }

    // Check for duplicate if costCode is being changed
    if (input.costCode && input.costCode !== existing.costCode) {
      const exists = await this.costCodeRepository.existsByCode(
        existing.projectId,
        input.costCode,
        id
      );
      if (exists) {
        throw new ServiceError(
          `Cost code "${input.costCode}" already exists in this project`,
          'COST_CODE_DUPLICATE',
          400
        );
      }
    }

    // Validate parent if provided
    if (input.parentCostCodeId) {
      if (input.parentCostCodeId === id) {
        throw new ServiceError(
          'Cost code cannot be its own parent',
          'INVALID_PARENT_SELF',
          400
        );
      }

      const parent = await this.costCodeRepository.findById(input.parentCostCodeId, projectIds);
      if (!parent) {
        throw new ServiceError('Parent cost code not found', 'PARENT_NOT_FOUND', 404);
      }
      if (parent.projectId !== existing.projectId) {
        throw new ServiceError(
          'Parent cost code must be in the same project',
          'PARENT_PROJECT_MISMATCH',
          400
        );
      }

      // Check for circular reference
      let current = parent;
      while (current.parentCostCodeId) {
        if (current.parentCostCodeId === id) {
          throw new ServiceError(
            'Cannot create circular parent-child relationship',
            'CIRCULAR_REFERENCE',
            400
          );
        }
        current = await this.costCodeRepository.findById(current.parentCostCodeId, projectIds);
        if (!current) break;
      }
    }

    // Convert null to undefined for repository compatibility
    const { description, activityCodeId, parentCostCodeId, metadata, ...restInput } = input;
    const sanitizedInput = {
      ...restInput,
      description: description ?? undefined,
      activityCodeId: activityCodeId ?? undefined,
      parentCostCodeId: parentCostCodeId ?? undefined,
      metadata: metadata ?? undefined,
    };

    const updated = await this.costCodeRepository.update(id, projectIds, sanitizedInput);
    if (!updated) {
      throw new ServiceError(`Failed to update cost code`, 'UPDATE_FAILED', 500);
    }

    return this.transformCostCode(updated);
  }

  /**
   * Soft delete a cost code (sets isActive = false)
   */
  async deleteCostCode(id: string): Promise<void> {
    const projectIds = await this.getAccessibleProjectIds();

    if (projectIds.length === 0) {
      throw new ServiceError('Access denied', 'PROJECT_ACCESS_DENIED', 403);
    }

    const existing = await this.costCodeRepository.findById(id, projectIds);
    if (!existing) {
      throw new ServiceError(`Cost code with ID "${id}" not found`, 'COST_CODE_NOT_FOUND', 404);
    }

    // Check for children
    const children = await this.costCodeRepository.findChildren(id, projectIds);
    if (children.length > 0) {
      throw new ServiceError(
        'Cannot delete cost code with child codes. Delete or reassign children first.',
        'HAS_CHILDREN',
        400
      );
    }

    await this.costCodeRepository.softDelete(id, projectIds);
  }

  /**
   * Get cost code type summary for a project
   */
  async getCostTypeSummary(projectId: string): Promise<CostCodeTypeSummary[]> {
    const projectIds = await this.getAccessibleProjectIds();

    if (!projectIds.includes(projectId)) {
      throw new ServiceError('Access denied to this project', 'PROJECT_ACCESS_DENIED', 403);
    }

    const summary = await this.costCodeRepository.getCostTypeSummary(projectId);
    return summary.map((s) => ({
      costType: s.costType as CostCodeTypeSummary['costType'],
      count: Number(s.count),
      totalBudget: String(s.totalBudget || '0'),
      totalCommitted: String(s.totalCommitted || '0'),
      totalActual: String(s.totalActual || '0'),
    }));
  }

  /**
   * Import cost codes from CSV data
   */
  async importCostCodes(
    projectId: string,
    rows: ImportCostCodeRow[]
  ): Promise<CostCodeImportResult> {
    const projectIds = await this.getAccessibleProjectIds();

    if (!projectIds.includes(projectId)) {
      throw new ServiceError('Access denied to this project', 'PROJECT_ACCESS_DENIED', 403);
    }

    const userId = this.requireUserContext();
    const result: CostCodeImportResult = {
      success: true,
      totalRows: rows.length,
      importedCount: 0,
      skippedCount: 0,
      errors: [],
    };

    // First pass: collect all parent references and validate
    const codeMap = new Map<string, ImportCostCodeRow>();
    for (const row of rows) {
      codeMap.set(row.costCode, row);
    }

    // Check existing codes
    const existingResult = await this.costCodeRepository.findAll(
      projectIds,
      { limit: 1000 },
      { projectId, isActive: true }
    );
    const existingCodes = new Set(existingResult.data.map((c) => c.costCode));

    // Process rows in order (parents first based on reference)
    const processed = new Set<string>();
    const toProcess = [...rows];
    const createdCodes = new Map<string, string>(); // costCode -> id

    let iterations = 0;
    const maxIterations = rows.length * 2;

    while (toProcess.length > 0 && iterations < maxIterations) {
      iterations++;
      const row = toProcess.shift()!;
      const rowIndex = rows.indexOf(row) + 1;

      // Skip if already processed
      if (processed.has(row.costCode)) {
        continue;
      }

      // Skip if duplicate
      if (existingCodes.has(row.costCode)) {
        result.errors.push({
          row: rowIndex,
          costCode: row.costCode,
          error: 'Cost code already exists',
        });
        result.skippedCount++;
        processed.add(row.costCode);
        continue;
      }

      // Check parent reference
      let parentId: string | undefined;
      if (row.parentCostCode) {
        // Check if parent is in the created codes
        if (createdCodes.has(row.parentCostCode)) {
          parentId = createdCodes.get(row.parentCostCode);
        } else if (existingCodes.has(row.parentCostCode)) {
          // Find existing parent
          const existingParent = existingResult.data.find(
            (c) => c.costCode === row.parentCostCode
          );
          parentId = existingParent?.id;
        } else if (codeMap.has(row.parentCostCode) && !processed.has(row.parentCostCode)) {
          // Parent is in import but not yet processed, defer
          toProcess.push(row);
          continue;
        } else {
          result.errors.push({
            row: rowIndex,
            costCode: row.costCode,
            error: `Parent cost code "${row.parentCostCode}" not found`,
          });
          result.skippedCount++;
          processed.add(row.costCode);
          continue;
        }
      }

      try {
        const created = await this.costCodeRepository.create({
          projectId,
          parentCostCodeId: parentId,
          costCode: row.costCode,
          costType: row.costType,
          name: row.name,
          description: row.description,
          isBillable: row.isBillable,
          createdBy: userId,
        });

        createdCodes.set(row.costCode, created.id);
        result.importedCount++;
      } catch (error: any) {
        result.errors.push({
          row: rowIndex,
          costCode: row.costCode,
          error: error.message || 'Unknown error',
        });
        result.skippedCount++;
      }

      processed.add(row.costCode);
    }

    result.success = result.errors.length === 0;
    return result;
  }

  /**
   * Update cost code amounts (called when transactions are posted)
   */
  async updateCostCodeAmounts(
    id: string,
    amounts: {
      budgetAmount?: string;
      committedAmount?: string;
      actualAmount?: string;
    }
  ): Promise<ProjectCostCode | null> {
    const updated = await this.costCodeRepository.updateAmounts(id, amounts);
    return updated ? this.transformCostCode(updated) : null;
  }
}
