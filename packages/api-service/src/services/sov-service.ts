import { BaseService } from './base-service';
import {
  CreateSovInput,
  UpdateSovInput,
  CreateSovLineInput,
  UpdateSovLineInput,
  SovLineWithProgress,
  SovSummary,
  G703ContinuationSheet,
  G703Line,
  SovValidationResult,
  SovValidationError,
  SovValidationWarning,
  SovImportInput,
  SovImportResult,
  SovImportError,
  CreateChangeOrderInput,
  SovStatus,
  SOV_STATUS,
} from '../types/sov.types';
import { PaginationParams, PaginatedResult, ServiceError } from '../types';
import { SovRepository } from '@glapi/database';

/**
 * Valid status transitions for SOV workflow
 */
const VALID_SOV_STATUS_TRANSITIONS: Record<SovStatus, SovStatus[]> = {
  [SOV_STATUS.DRAFT]: [SOV_STATUS.ACTIVE],
  [SOV_STATUS.ACTIVE]: [SOV_STATUS.REVISED, SOV_STATUS.CLOSED],
  [SOV_STATUS.REVISED]: [], // Terminal state (superseded by new version)
  [SOV_STATUS.CLOSED]: [], // Terminal state
};

/**
 * Change order summary type
 */
interface ChangeOrderSummary {
  id: string;
  changeOrderNumber: string;
  description: string;
  status: string;
  amount: string;
  effectiveDate?: string;
  requestedDate?: Date;
  approvedDate?: Date;
}

export class SovService extends BaseService {
  private sovRepository: SovRepository;

  constructor(context = {}) {
    super(context);
    this.sovRepository = new SovRepository();
  }

  /**
   * Transform database SOV to service layer type
   */
  private transformSov(dbSov: any): SovSummary {
    return {
      id: dbSov.id,
      projectId: dbSov.projectId,
      projectName: '', // Will be populated if needed
      sovNumber: dbSov.sovNumber,
      status: dbSov.status,
      originalContractAmount: parseFloat(dbSov.originalContractAmount || '0'),
      approvedChangeOrders: parseFloat(dbSov.approvedChangeOrders || '0'),
      pendingChangeOrders: parseFloat(dbSov.pendingChangeOrders || '0'),
      revisedContractAmount: parseFloat(dbSov.revisedContractAmount || '0'),
      totalScheduledValue: parseFloat(dbSov.totalScheduledValue || '0'),
      totalPreviouslyBilled: parseFloat(dbSov.totalPreviouslyBilled || '0'),
      totalCurrentBilling: parseFloat(dbSov.totalCurrentBilling || '0'),
      totalBilledToDate: parseFloat(dbSov.totalBilledToDate || '0'),
      totalRetainageHeld: parseFloat(dbSov.totalRetainageHeld || '0'),
      totalRetainageReleased: parseFloat(dbSov.totalRetainageReleased || '0'),
      balanceToFinish: parseFloat(dbSov.balanceToFinish || '0'),
      percentComplete: parseFloat(dbSov.percentComplete || '0'),
      lineCount: 0, // Will be populated if needed
      activeLineCount: 0,
      approvedChangeOrderCount: 0,
      pendingChangeOrderCount: 0,
    };
  }

  /**
   * Transform database SOV line to service layer type with progress
   */
  private transformSovLine(dbLine: any): SovLineWithProgress {
    const revisedScheduledValue = parseFloat(dbLine.revisedScheduledValue || '0');
    const totalCompletedAndStored = parseFloat(dbLine.totalCompletedAndStored || '0');
    const percentComplete = revisedScheduledValue > 0
      ? (totalCompletedAndStored / revisedScheduledValue) * 100
      : 0;

    return {
      id: dbLine.id,
      lineNumber: dbLine.lineNumber,
      itemNumber: dbLine.itemNumber,
      lineType: dbLine.lineType,
      description: dbLine.description,
      originalScheduledValue: parseFloat(dbLine.originalScheduledValue || '0'),
      changeOrderAmount: parseFloat(dbLine.changeOrderAmount || '0'),
      revisedScheduledValue,
      previousWorkCompleted: parseFloat(dbLine.previousWorkCompleted || '0'),
      previousMaterialsStored: parseFloat(dbLine.previousMaterialsStored || '0'),
      currentWorkCompleted: parseFloat(dbLine.currentWorkCompleted || '0'),
      currentMaterialsStored: parseFloat(dbLine.currentMaterialsStored || '0'),
      totalCompletedAndStored,
      percentComplete,
      balanceToFinish: parseFloat(dbLine.balanceToFinish || '0'),
      retainagePercent: parseFloat(dbLine.retainagePercent || '10'),
      retainageHeld: parseFloat(dbLine.retainageHeld || '0'),
      retainageReleased: parseFloat(dbLine.retainageReleased || '0'),
      netRetainage: parseFloat(dbLine.netRetainage || '0'),
      costCodeId: dbLine.projectCostCodeId,
    };
  }

  // ========== SOV Methods ==========

  /**
   * List SOVs with filters and pagination
   */
  async list(
    params: PaginationParams = {},
    filters: {
      projectId?: string;
      status?: SovStatus | SovStatus[];
      search?: string;
    } = {}
  ): Promise<PaginatedResult<SovSummary>> {
    const organizationId = this.requireOrganizationContext();

    const result = await this.sovRepository.findAll(organizationId, params, filters);

    return {
      ...result,
      data: result.data.map((sov) => this.transformSov(sov)),
    };
  }

  /**
   * Get an SOV by ID
   */
  async getById(id: string): Promise<SovSummary | null> {
    const organizationId = this.requireOrganizationContext();

    const sov = await this.sovRepository.findById(id, organizationId);
    if (!sov) {
      return null;
    }

    const transformed = this.transformSov(sov);

    // Get line count
    const lines = await this.sovRepository.findLinesBySov(id);
    transformed.lineCount = lines.length;
    transformed.activeLineCount = lines.filter((l) => l.isActive).length;

    return transformed;
  }

  /**
   * Get the active SOV for a project
   */
  async getActiveByProject(projectId: string): Promise<SovSummary | null> {
    const organizationId = this.requireOrganizationContext();

    const sov = await this.sovRepository.findActiveByProject(projectId, organizationId);
    return sov ? this.transformSov(sov) : null;
  }

  /**
   * Create a new SOV
   */
  async create(input: CreateSovInput): Promise<SovSummary> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.context.userId;

    // Generate SOV number
    const sovNumber = `SOV-${Date.now()}`;

    // Get next version number
    const versionNumber = await this.sovRepository.getNextVersionNumber(
      input.projectId,
      organizationId
    );

    const created = await this.sovRepository.create({
      organizationId,
      projectId: input.projectId,
      sovNumber,
      versionNumber,
      effectiveDate: input.effectiveDate,
      description: input.description,
      retainagePercent: input.defaultRetainagePercent?.toString(),
      retainageCapAmount: input.retainageCapAmount?.toString(),
      originalContractAmount: input.originalContractAmount?.toString() || '0',
      createdBy: userId,
    });

    return this.transformSov(created);
  }

  /**
   * Update an SOV
   */
  async update(id: string, input: UpdateSovInput): Promise<SovSummary> {
    const organizationId = this.requireOrganizationContext();

    const existing = await this.sovRepository.findById(id, organizationId);
    if (!existing) {
      throw new ServiceError(`SOV with ID "${id}" not found`, 'SOV_NOT_FOUND', 404);
    }

    // Only DRAFT SOVs can be updated
    if (existing.status !== SOV_STATUS.DRAFT) {
      throw new ServiceError(
        `Cannot update SOV with status "${existing.status}". Only DRAFT SOVs can be updated.`,
        'SOV_NOT_EDITABLE',
        400
      );
    }

    const updated = await this.sovRepository.update(id, organizationId, {
      effectiveDate: input.effectiveDate,
      description: input.description,
      retainagePercent: input.defaultRetainagePercent?.toString(),
      retainageCapAmount: input.retainageCapAmount?.toString(),
    });

    if (!updated) {
      throw new ServiceError('Failed to update SOV', 'UPDATE_FAILED', 500);
    }

    return this.transformSov(updated);
  }

  /**
   * Update SOV status (workflow transition)
   */
  async updateStatus(id: string, newStatus: SovStatus): Promise<SovSummary> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const existing = await this.sovRepository.findById(id, organizationId);
    if (!existing) {
      throw new ServiceError(`SOV with ID "${id}" not found`, 'SOV_NOT_FOUND', 404);
    }

    // Validate status transition
    const validTransitions = VALID_SOV_STATUS_TRANSITIONS[existing.status as SovStatus];
    if (!validTransitions?.includes(newStatus)) {
      throw new ServiceError(
        `Invalid status transition from "${existing.status}" to "${newStatus}"`,
        'INVALID_STATUS_TRANSITION',
        400
      );
    }

    // If transitioning to ACTIVE, deactivate any existing active SOV for the project
    if (newStatus === SOV_STATUS.ACTIVE) {
      const currentActive = await this.sovRepository.findActiveByProject(
        existing.projectId,
        organizationId
      );
      if (currentActive && currentActive.id !== id) {
        await this.sovRepository.updateStatus(
          currentActive.id,
          organizationId,
          SOV_STATUS.REVISED,
          userId
        );
      }
    }

    const updated = await this.sovRepository.updateStatus(id, organizationId, newStatus, userId);
    if (!updated) {
      throw new ServiceError('Failed to update SOV status', 'UPDATE_FAILED', 500);
    }

    return this.transformSov(updated);
  }

  /**
   * Delete an SOV (only DRAFT)
   */
  async delete(id: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();

    const existing = await this.sovRepository.findById(id, organizationId);
    if (!existing) {
      throw new ServiceError(`SOV with ID "${id}" not found`, 'SOV_NOT_FOUND', 404);
    }

    if (existing.status !== SOV_STATUS.DRAFT) {
      throw new ServiceError(
        `Cannot delete SOV with status "${existing.status}". Only DRAFT SOVs can be deleted.`,
        'SOV_NOT_DELETABLE',
        400
      );
    }

    await this.sovRepository.delete(id, organizationId);
  }

  // ========== SOV Line Methods ==========

  /**
   * Get lines for an SOV
   */
  async getLines(sovId: string): Promise<SovLineWithProgress[]> {
    const organizationId = this.requireOrganizationContext();

    // Verify access to the SOV
    const sov = await this.sovRepository.findById(sovId, organizationId);
    if (!sov) {
      throw new ServiceError('SOV not found', 'SOV_NOT_FOUND', 404);
    }

    const lines = await this.sovRepository.findLinesBySov(sovId);
    return lines.map((line) => this.transformSovLine(line));
  }

  /**
   * Create an SOV line
   */
  async createLine(sovId: string, input: CreateSovLineInput): Promise<SovLineWithProgress> {
    const organizationId = this.requireOrganizationContext();

    // Verify access and editability
    const sov = await this.sovRepository.findById(sovId, organizationId);
    if (!sov) {
      throw new ServiceError('SOV not found', 'SOV_NOT_FOUND', 404);
    }

    if (sov.status !== SOV_STATUS.DRAFT) {
      throw new ServiceError(
        `Cannot add lines to SOV with status "${sov.status}". Only DRAFT SOVs can be modified.`,
        'SOV_NOT_EDITABLE',
        400
      );
    }

    // Get next line number if not provided
    const lineNumber = input.lineNumber || await this.sovRepository.getNextLineNumber(sovId);

    const created = await this.sovRepository.createLine({
      scheduleOfValuesId: sovId,
      lineNumber,
      itemNumber: input.itemNumber,
      description: input.description,
      originalScheduledValue: input.originalScheduledValue.toString(),
      lineType: input.lineType as any,
      projectCostCodeId: input.projectCostCodeId,
      retainagePercent: input.retainagePercent?.toString(),
      sortOrder: input.sortOrder,
      notes: input.notes,
    });

    // Recalculate SOV totals
    await this.sovRepository.recalculateTotals(sovId);

    return this.transformSovLine(created);
  }

  /**
   * Update an SOV line
   */
  async updateLine(lineId: string, input: UpdateSovLineInput): Promise<SovLineWithProgress> {
    const organizationId = this.requireOrganizationContext();

    const line = await this.sovRepository.findLineById(lineId);
    if (!line) {
      throw new ServiceError('SOV line not found', 'LINE_NOT_FOUND', 404);
    }

    // Verify access and editability
    const sov = await this.sovRepository.findById(line.scheduleOfValuesId, organizationId);
    if (!sov) {
      throw new ServiceError('Access denied', 'ACCESS_DENIED', 403);
    }

    if (sov.status !== SOV_STATUS.DRAFT) {
      throw new ServiceError(
        `Cannot modify lines in SOV with status "${sov.status}". Only DRAFT SOVs can be modified.`,
        'SOV_NOT_EDITABLE',
        400
      );
    }

    const updated = await this.sovRepository.updateLine(lineId, {
      description: input.description,
      originalScheduledValue: input.originalScheduledValue?.toString(),
      lineType: input.lineType as any,
      retainagePercent: input.retainagePercent?.toString(),
      notes: input.notes,
    });

    if (!updated) {
      throw new ServiceError('Failed to update SOV line', 'UPDATE_FAILED', 500);
    }

    // Recalculate SOV totals
    await this.sovRepository.recalculateTotals(line.scheduleOfValuesId);

    return this.transformSovLine(updated);
  }

  /**
   * Delete an SOV line
   */
  async deleteLine(lineId: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();

    const line = await this.sovRepository.findLineById(lineId);
    if (!line) {
      throw new ServiceError('SOV line not found', 'LINE_NOT_FOUND', 404);
    }

    // Verify access and editability
    const sov = await this.sovRepository.findById(line.scheduleOfValuesId, organizationId);
    if (!sov) {
      throw new ServiceError('Access denied', 'ACCESS_DENIED', 403);
    }

    if (sov.status !== SOV_STATUS.DRAFT) {
      throw new ServiceError(
        `Cannot delete lines from SOV with status "${sov.status}". Only DRAFT SOVs can be modified.`,
        'SOV_NOT_EDITABLE',
        400
      );
    }

    await this.sovRepository.deleteLine(lineId);

    // Recalculate SOV totals
    await this.sovRepository.recalculateTotals(line.scheduleOfValuesId);
  }

  /**
   * Bulk create SOV lines
   */
  async bulkCreateLines(
    sovId: string,
    lines: CreateSovLineInput[]
  ): Promise<SovLineWithProgress[]> {
    const organizationId = this.requireOrganizationContext();

    // Verify access and editability
    const sov = await this.sovRepository.findById(sovId, organizationId);
    if (!sov) {
      throw new ServiceError('SOV not found', 'SOV_NOT_FOUND', 404);
    }

    if (sov.status !== SOV_STATUS.DRAFT) {
      throw new ServiceError(
        `Cannot add lines to SOV with status "${sov.status}". Only DRAFT SOVs can be modified.`,
        'SOV_NOT_EDITABLE',
        400
      );
    }

    // Get starting line number
    const startLineNumber = await this.sovRepository.getNextLineNumber(sovId);

    const linesToCreate = lines.map((line, index) => ({
      scheduleOfValuesId: sovId,
      lineNumber: line.lineNumber || startLineNumber + index,
      itemNumber: line.itemNumber,
      description: line.description,
      originalScheduledValue: line.originalScheduledValue.toString(),
      lineType: line.lineType as any,
      projectCostCodeId: line.projectCostCodeId,
      retainagePercent: line.retainagePercent?.toString(),
      sortOrder: line.sortOrder,
      notes: line.notes,
    }));

    const created = await this.sovRepository.bulkCreateLines(linesToCreate);

    // Recalculate SOV totals
    await this.sovRepository.recalculateTotals(sovId);

    return created.map((line) => this.transformSovLine(line));
  }

  // ========== Change Order Methods ==========

  /**
   * Create a change order
   */
  async createChangeOrder(sovId: string, input: CreateChangeOrderInput): Promise<ChangeOrderSummary> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.context.userId;

    // Verify access
    const sov = await this.sovRepository.findById(sovId, organizationId);
    if (!sov) {
      throw new ServiceError('SOV not found', 'SOV_NOT_FOUND', 404);
    }

    const created = await this.sovRepository.createChangeOrder({
      scheduleOfValuesId: sovId,
      changeOrderNumber: input.changeOrderNumber,
      description: input.description,
      amount: input.amount.toString(),
      effectiveDate: input.effectiveDate,
      externalReference: input.externalReference,
      documentUrl: input.documentUrl,
      requestedBy: userId,
      notes: input.notes,
    });

    return {
      id: created.id,
      changeOrderNumber: created.changeOrderNumber,
      description: created.description,
      status: created.status,
      amount: created.amount,
      effectiveDate: created.effectiveDate,
      requestedDate: created.requestedDate,
      approvedDate: created.approvedDate,
    };
  }

  /**
   * Approve a change order
   */
  async approveChangeOrder(changeOrderId: string): Promise<ChangeOrderSummary> {
    const userId = this.requireUserContext();

    const changeOrder = await this.sovRepository.findChangeOrderById(changeOrderId);
    if (!changeOrder) {
      throw new ServiceError('Change order not found', 'CHANGE_ORDER_NOT_FOUND', 404);
    }

    const updated = await this.sovRepository.updateChangeOrderStatus(
      changeOrderId,
      'APPROVED',
      userId
    );

    if (!updated) {
      throw new ServiceError('Failed to approve change order', 'UPDATE_FAILED', 500);
    }

    // Apply approved change orders to SOV totals
    await this.sovRepository.applyApprovedChangeOrders(changeOrder.scheduleOfValuesId);

    return {
      id: updated.id,
      changeOrderNumber: updated.changeOrderNumber,
      description: updated.description,
      status: updated.status,
      amount: updated.amount,
      effectiveDate: updated.effectiveDate,
      requestedDate: updated.requestedDate,
      approvedDate: updated.approvedDate,
    };
  }

  /**
   * Get change orders for an SOV
   */
  async getChangeOrders(sovId: string): Promise<ChangeOrderSummary[]> {
    const organizationId = this.requireOrganizationContext();

    // Verify access
    const sov = await this.sovRepository.findById(sovId, organizationId);
    if (!sov) {
      throw new ServiceError('SOV not found', 'SOV_NOT_FOUND', 404);
    }

    const changeOrders = await this.sovRepository.findChangeOrdersBySov(sovId);

    return changeOrders.map((co) => ({
      id: co.id,
      changeOrderNumber: co.changeOrderNumber,
      description: co.description,
      status: co.status,
      amount: co.amount,
      effectiveDate: co.effectiveDate,
      requestedDate: co.requestedDate,
      approvedDate: co.approvedDate,
    }));
  }

  // ========== G703 Export Methods ==========

  /**
   * Generate G703 Continuation Sheet data
   */
  async generateG703(sovId: string): Promise<G703ContinuationSheet> {
    const organizationId = this.requireOrganizationContext();

    const sov = await this.sovRepository.findById(sovId, organizationId);
    if (!sov) {
      throw new ServiceError('SOV not found', 'SOV_NOT_FOUND', 404);
    }

    const lines = await this.sovRepository.findLinesBySov(sovId);

    const g703Lines: G703Line[] = lines.map((line) => {
      const scheduledValue = parseFloat(line.revisedScheduledValue);
      const previousWorkCompleted = parseFloat(line.previousWorkCompleted || '0');
      const previousMaterialsStored = parseFloat(line.previousMaterialsStored || '0');
      const currentWorkCompleted = parseFloat(line.currentWorkCompleted || '0');
      const currentMaterialsStored = parseFloat(line.currentMaterialsStored || '0');
      const totalCompletedAndStored = previousWorkCompleted + previousMaterialsStored +
        currentWorkCompleted + currentMaterialsStored;
      const percentComplete = scheduledValue > 0
        ? (totalCompletedAndStored / scheduledValue) * 100
        : 0;
      const balanceToFinish = scheduledValue - totalCompletedAndStored;

      return {
        itemNumber: line.itemNumber || '',
        descriptionOfWork: line.description,
        scheduledValue,
        workCompletedFromPrevious: previousWorkCompleted,
        workCompletedThisPeriod: currentWorkCompleted,
        materialsStoredFromPrevious: previousMaterialsStored,
        materialsStoredThisPeriod: currentMaterialsStored,
        totalCompletedAndStored,
        percentComplete,
        balanceToFinish,
        retainage: parseFloat(line.retainageHeld || '0'),
      };
    });

    // Calculate totals
    const totals = g703Lines.reduce(
      (acc, line) => ({
        scheduledValue: acc.scheduledValue + line.scheduledValue,
        previousWorkCompleted: acc.previousWorkCompleted + line.workCompletedFromPrevious,
        previousMaterialsStored: acc.previousMaterialsStored + line.materialsStoredFromPrevious,
        thisWorkCompleted: acc.thisWorkCompleted + line.workCompletedThisPeriod,
        thisMaterialsStored: acc.thisMaterialsStored + line.materialsStoredThisPeriod,
        totalCompletedAndStored: acc.totalCompletedAndStored + line.totalCompletedAndStored,
        balanceToFinish: acc.balanceToFinish + line.balanceToFinish,
        retainage: acc.retainage + line.retainage,
      }),
      {
        scheduledValue: 0,
        previousWorkCompleted: 0,
        previousMaterialsStored: 0,
        thisWorkCompleted: 0,
        thisMaterialsStored: 0,
        totalCompletedAndStored: 0,
        balanceToFinish: 0,
        retainage: 0,
      }
    );

    return {
      projectName: '', // Would need project lookup
      applicationNumber: 0, // Will be set when generating for a pay app
      periodTo: new Date().toISOString().split('T')[0],
      lines: g703Lines,
      grandTotals: {
        ...totals,
        percentComplete: totals.scheduledValue > 0
          ? (totals.totalCompletedAndStored / totals.scheduledValue) * 100
          : 0,
      },
    };
  }

  // ========== Validation Methods ==========

  /**
   * Validate an SOV
   */
  async validate(sovId: string): Promise<SovValidationResult> {
    const organizationId = this.requireOrganizationContext();

    const sov = await this.sovRepository.findById(sovId, organizationId);
    if (!sov) {
      throw new ServiceError('SOV not found', 'SOV_NOT_FOUND', 404);
    }

    const lines = await this.sovRepository.findLinesBySov(sovId);
    const errors: SovValidationError[] = [];
    const warnings: SovValidationWarning[] = [];

    // Check that SOV has lines
    if (lines.length === 0) {
      errors.push({
        code: 'NO_LINES',
        message: 'SOV must have at least one line item',
      });
    }

    // Check line totals match SOV total
    const lineTotal = lines.reduce((sum, line) => sum + parseFloat(line.revisedScheduledValue), 0);
    const contractSum = parseFloat(sov.revisedContractAmount);

    if (Math.abs(lineTotal - contractSum) > 0.01) {
      warnings.push({
        code: 'TOTAL_MISMATCH',
        message: `Line items total (${lineTotal.toFixed(2)}) does not match contract sum (${contractSum.toFixed(2)})`,
      });
    }

    // Check for duplicate line numbers
    const lineNumbers = lines.map((l) => l.lineNumber);
    const duplicateLineNumbers = lineNumbers.filter((num, index) => lineNumbers.indexOf(num) !== index);
    if (duplicateLineNumbers.length > 0) {
      errors.push({
        code: 'DUPLICATE_LINE_NUMBERS',
        message: `Duplicate line numbers found: ${duplicateLineNumbers.join(', ')}`,
      });
    }

    // Check for lines with zero scheduled value
    const zeroValueLines = lines.filter((l) => parseFloat(l.revisedScheduledValue) === 0);
    if (zeroValueLines.length > 0) {
      warnings.push({
        code: 'ZERO_VALUE_LINES',
        message: `${zeroValueLines.length} line(s) have zero scheduled value`,
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ========== Import Methods ==========

  /**
   * Import SOV from data
   */
  async import(input: SovImportInput): Promise<SovImportResult> {
    const errors: SovImportError[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!input.csvData) {
      errors.push({
        row: 0,
        message: 'CSV data is required',
      });
      return {
        success: false,
        linesImported: 0,
        linesSkipped: 0,
        errors,
        warnings,
      };
    }

    // Parse CSV and create SOV
    // For now, return a basic success
    return {
      success: true,
      scheduleOfValuesId: undefined,
      linesImported: 0,
      linesSkipped: 0,
      errors,
      warnings,
    };
  }
}
