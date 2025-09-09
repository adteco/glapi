import { Database } from '@glapi/database';
import { 
  contractModifications,
  modificationLineItems,
  catchUpAdjustments,
  modificationApprovalHistory,
  ContractModification,
  ModificationLineItem,
  CatchUpAdjustment,
  ModificationStatus
} from '@glapi/database/schema';
import { ContractModificationEngine, ModificationRequest, ModificationImpact } from '@glapi/business/services/contract-modification-engine';
import { ModificationApprovalWorkflow, ApprovalRequest, ApprovalStatus } from '@glapi/business/services/modification-approval-workflow';
import { eq, and, desc, gte, lte, inArray, sql } from 'drizzle-orm';

export interface ModificationSummary {
  id: string;
  modificationNumber: string;
  subscriptionId: string;
  modificationType: string;
  status: string;
  effectiveDate: Date;
  adjustmentAmount: number;
  requestDate: Date;
  approvalStatus?: ApprovalStatus;
}

export interface ModificationDetails extends ModificationSummary {
  modification: ContractModification;
  lineItems: ModificationLineItem[];
  catchUpAdjustments: CatchUpAdjustment[];
  approvalHistory: any[];
  impact: ModificationImpact | null;
}

export interface ModificationFilters {
  subscriptionId?: string;
  status?: string;
  modificationType?: string;
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
}

export class ContractModificationService {
  private modificationEngine: ContractModificationEngine;
  private approvalWorkflow: ModificationApprovalWorkflow;

  constructor(private db: Database) {
    this.modificationEngine = new ContractModificationEngine(db, null as any); // Revenue engine would be injected
    this.approvalWorkflow = new ModificationApprovalWorkflow(db);
  }

  /**
   * Create a new contract modification
   */
  async createModification(
    request: ModificationRequest,
    options?: {
      preview?: boolean;
      autoSubmit?: boolean;
    }
  ): Promise<{
    modificationId?: string;
    impact: ModificationImpact;
    warnings?: string[];
    approvalStatus?: ApprovalStatus;
  }> {
    // Process modification through engine
    const result = await this.modificationEngine.processModification(request, {
      preview: options?.preview
    });

    if (options?.preview) {
      return result;
    }

    // Auto-submit for approval if requested
    if (options?.autoSubmit && result.modificationId) {
      const approvalStatus = await this.approvalWorkflow.submitForApproval(
        result.modificationId,
        request.requestedBy || 'system'
      );
      return { ...result, approvalStatus };
    }

    return result;
  }

  /**
   * Get modification by ID
   */
  async getModification(modificationId: string): Promise<ModificationDetails | null> {
    // Get base modification
    const [modification] = await this.db.select()
      .from(contractModifications)
      .where(eq(contractModifications.id, modificationId))
      .limit(1);

    if (!modification) {
      return null;
    }

    // Get line items
    const lineItems = await this.db.select()
      .from(modificationLineItems)
      .where(eq(modificationLineItems.modificationId, modificationId));

    // Get catch-up adjustments
    const catchUpAdjustments = await this.db.select()
      .from(catchUpAdjustments)
      .where(eq(catchUpAdjustments.modificationId, modificationId));

    // Get approval history
    const approvalHistory = await this.db.select()
      .from(modificationApprovalHistory)
      .where(eq(modificationApprovalHistory.modificationId, modificationId))
      .orderBy(desc(modificationApprovalHistory.approvalDate));

    // Get approval status
    const approvalStatus = modification.status === ModificationStatus.PENDING_APPROVAL
      ? await this.approvalWorkflow.getApprovalStatus(modificationId)
      : undefined;

    return {
      id: modification.id,
      modificationNumber: modification.modificationNumber,
      subscriptionId: modification.subscriptionId,
      modificationType: modification.modificationType,
      status: modification.status,
      effectiveDate: modification.effectiveDate,
      adjustmentAmount: parseFloat(modification.adjustmentAmount),
      requestDate: modification.requestDate,
      modification,
      lineItems,
      catchUpAdjustments,
      approvalHistory,
      impact: modification.revenueImpact as ModificationImpact | null,
      approvalStatus
    };
  }

  /**
   * List modifications with filters
   */
  async listModifications(
    filters: ModificationFilters,
    pagination?: {
      limit: number;
      offset: number;
    }
  ): Promise<{
    modifications: ModificationSummary[];
    total: number;
  }> {
    // Build query conditions
    const conditions = [];

    if (filters.subscriptionId) {
      conditions.push(eq(contractModifications.subscriptionId, filters.subscriptionId));
    }
    if (filters.status) {
      conditions.push(eq(contractModifications.status, filters.status as any));
    }
    if (filters.modificationType) {
      conditions.push(eq(contractModifications.modificationType, filters.modificationType as any));
    }
    if (filters.startDate) {
      conditions.push(gte(contractModifications.effectiveDate, filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(lte(contractModifications.effectiveDate, filters.endDate));
    }
    if (filters.minAmount !== undefined) {
      conditions.push(gte(sql`ABS(${contractModifications.adjustmentAmount})`, filters.minAmount));
    }
    if (filters.maxAmount !== undefined) {
      conditions.push(lte(sql`ABS(${contractModifications.adjustmentAmount})`, filters.maxAmount));
    }

    // Get total count
    const [countResult] = await this.db.select({
      count: sql<number>`COUNT(*)`
    })
    .from(contractModifications)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

    // Get modifications
    let query = this.db.select()
      .from(contractModifications)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(contractModifications.requestDate));

    if (pagination) {
      query = query.limit(pagination.limit).offset(pagination.offset);
    }

    const modifications = await query;

    // Map to summaries
    const summaries: ModificationSummary[] = modifications.map(mod => ({
      id: mod.id,
      modificationNumber: mod.modificationNumber,
      subscriptionId: mod.subscriptionId,
      modificationType: mod.modificationType,
      status: mod.status,
      effectiveDate: mod.effectiveDate,
      adjustmentAmount: parseFloat(mod.adjustmentAmount),
      requestDate: mod.requestDate
    }));

    return {
      modifications: summaries,
      total: countResult?.count || 0
    };
  }

  /**
   * Submit modification for approval
   */
  async submitForApproval(
    modificationId: string,
    submitterId: string
  ): Promise<ApprovalStatus> {
    return await this.approvalWorkflow.submitForApproval(modificationId, submitterId);
  }

  /**
   * Process approval action
   */
  async processApproval(request: ApprovalRequest): Promise<ApprovalStatus> {
    return await this.approvalWorkflow.processApproval(request);
  }

  /**
   * Apply an approved modification
   */
  async applyModification(modificationId: string): Promise<void> {
    await this.modificationEngine.applyModification(modificationId);
  }

  /**
   * Process partial termination
   */
  async processPartialTermination(
    subscriptionId: string,
    itemsToTerminate: string[],
    terminationDate: Date,
    options?: {
      refundPolicy?: 'none' | 'prorated' | 'full';
      finalInvoice?: boolean;
      requestedBy?: string;
    }
  ): Promise<{
    modificationId: string;
    refundAmount: number;
    affectedObligations: string[];
    cancelledSchedules: number;
  }> {
    return await this.modificationEngine.processPartialTermination(
      subscriptionId,
      itemsToTerminate,
      terminationDate,
      options
    );
  }

  /**
   * Process upgrade/downgrade
   */
  async processUpgradeDowngrade(
    subscriptionId: string,
    changes: {
      fromItemId: string;
      toItemId: string;
      effectiveDate: Date;
      creditPolicy?: 'full' | 'prorated' | 'none';
      requestedBy?: string;
    }
  ): Promise<{
    modificationId: string;
    creditAmount: number;
    newObligations: any[];
    impact: ModificationImpact;
  }> {
    return await this.modificationEngine.processUpgradeDowngrade(
      subscriptionId,
      changes
    );
  }

  /**
   * Process blend and extend
   */
  async processBlendAndExtend(
    subscriptionId: string,
    newTermEndDate: Date,
    priceAdjustment?: number,
    requestedBy?: string
  ): Promise<{
    modificationId: string;
    blendedRate: number;
    extendedMonths: number;
    impact: ModificationImpact;
  }> {
    return await this.modificationEngine.processBlendAndExtend(
      subscriptionId,
      newTermEndDate,
      priceAdjustment
    );
  }

  /**
   * Preview modification impact without creating it
   */
  async previewModification(request: ModificationRequest): Promise<{
    impact: ModificationImpact;
    warnings?: string[];
  }> {
    return await this.modificationEngine.processModification(request, {
      preview: true
    });
  }

  /**
   * Get pending approvals for a user
   */
  async getPendingApprovals(
    approverId: string,
    approverRole: string
  ): Promise<ModificationSummary[]> {
    // Get all pending modifications
    const pendingMods = await this.db.select()
      .from(contractModifications)
      .where(eq(contractModifications.status, ModificationStatus.PENDING_APPROVAL));

    // Filter to ones this user can approve
    const approvals: ModificationSummary[] = [];

    for (const mod of pendingMods) {
      const approvalStatus = await this.approvalWorkflow.getApprovalStatus(mod.id);
      
      if (approvalStatus.pendingApprovals.includes(approverRole)) {
        approvals.push({
          id: mod.id,
          modificationNumber: mod.modificationNumber,
          subscriptionId: mod.subscriptionId,
          modificationType: mod.modificationType,
          status: mod.status,
          effectiveDate: mod.effectiveDate,
          adjustmentAmount: parseFloat(mod.adjustmentAmount),
          requestDate: mod.requestDate,
          approvalStatus
        });
      }
    }

    return approvals;
  }

  /**
   * Recall a modification from approval
   */
  async recallModification(
    modificationId: string,
    recalledBy: string,
    reason: string
  ): Promise<void> {
    await this.approvalWorkflow.recallModification(modificationId, recalledBy, reason);
  }

  /**
   * Delegate approval authority
   */
  async delegateApproval(
    modificationId: string,
    fromApproverId: string,
    toApproverId: string,
    reason: string
  ): Promise<void> {
    await this.approvalWorkflow.delegateApproval(
      modificationId,
      fromApproverId,
      toApproverId,
      reason
    );
  }

  /**
   * Get modification statistics
   */
  async getStatistics(
    organizationId: string,
    period?: {
      startDate: Date;
      endDate: Date;
    }
  ): Promise<{
    totalModifications: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    totalAdjustmentAmount: number;
    averageApprovalTime: number;
    approvalRate: number;
  }> {
    const conditions = [
      eq(contractModifications.organizationId, organizationId)
    ];

    if (period) {
      conditions.push(
        gte(contractModifications.requestDate, period.startDate),
        lte(contractModifications.requestDate, period.endDate)
      );
    }

    // Get totals by type
    const byType = await this.db.select({
      type: contractModifications.modificationType,
      count: sql<number>`COUNT(*)`
    })
    .from(contractModifications)
    .where(and(...conditions))
    .groupBy(contractModifications.modificationType);

    // Get totals by status
    const byStatus = await this.db.select({
      status: contractModifications.status,
      count: sql<number>`COUNT(*)`
    })
    .from(contractModifications)
    .where(and(...conditions))
    .groupBy(contractModifications.status);

    // Get total adjustment amount
    const [totalAdjustment] = await this.db.select({
      total: sql<number>`SUM(ABS(${contractModifications.adjustmentAmount}))`
    })
    .from(contractModifications)
    .where(and(...conditions));

    // Get average approval time for approved modifications
    const [avgApprovalTime] = await this.db.select({
      avgTime: sql<number>`
        AVG(EXTRACT(EPOCH FROM (${contractModifications.approvalDate} - ${contractModifications.requestDate})) / 3600)
      `
    })
    .from(contractModifications)
    .where(and(
      ...conditions,
      eq(contractModifications.status, ModificationStatus.APPROVED)
    ));

    // Calculate approval rate
    const totalCount = byStatus.reduce((sum, s) => sum + s.count, 0);
    const approvedCount = byStatus.find(s => s.status === ModificationStatus.APPROVED)?.count || 0;
    const approvalRate = totalCount > 0 ? approvedCount / totalCount : 0;

    return {
      totalModifications: totalCount,
      byType: byType.reduce((acc, t) => ({ ...acc, [t.type]: t.count }), {}),
      byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s.status]: s.count }), {}),
      totalAdjustmentAmount: totalAdjustment?.total || 0,
      averageApprovalTime: avgApprovalTime?.avgTime || 0,
      approvalRate
    };
  }

  /**
   * Check for and process escalations
   */
  async processEscalations(): Promise<void> {
    await this.approvalWorkflow.checkForEscalations();
  }

  /**
   * Cancel a draft modification
   */
  async cancelModification(
    modificationId: string,
    cancelledBy: string,
    reason: string
  ): Promise<void> {
    const [modification] = await this.db.select()
      .from(contractModifications)
      .where(eq(contractModifications.id, modificationId))
      .limit(1);

    if (!modification) {
      throw new Error('Modification not found');
    }

    if (modification.status !== ModificationStatus.DRAFT) {
      throw new Error('Only draft modifications can be cancelled');
    }

    await this.db.update(contractModifications)
      .set({
        status: ModificationStatus.CANCELLED,
        notes: reason,
        updatedAt: new Date()
      })
      .where(eq(contractModifications.id, modificationId));
  }
}