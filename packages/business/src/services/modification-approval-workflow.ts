import { Database } from '@glapi/database';
import { 
  contractModifications,
  modificationApprovalHistory,
  ModificationStatus,
  NewModificationApprovalHistory
} from '@glapi/database/schema';
import { eq, and, or, gte, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

export interface ApprovalRule {
  level: 'manager' | 'finance' | 'legal' | 'executive';
  threshold?: number;
  required: boolean;
  conditions?: Record<string, any>;
}

export interface ApprovalRequest {
  modificationId: string;
  approverId: string;
  approverRole: string;
  action: 'approve' | 'reject' | 'request_info';
  comments?: string;
  conditions?: Record<string, any>;
}

export interface ApprovalStatus {
  modificationId: string;
  currentStatus: string;
  requiredApprovals: ApprovalRule[];
  completedApprovals: Array<{
    level: string;
    approvedBy: string;
    approvedAt: Date;
    action: string;
  }>;
  pendingApprovals: string[];
  canApprove: boolean;
  nextApprover?: string;
}

export interface EscalationRule {
  level: string;
  escalateAfterHours: number;
  escalateTo: string;
  notificationMethod: 'email' | 'slack' | 'both';
}

export class ModificationApprovalWorkflow {
  private approvalRules: Map<string, ApprovalRule[]>;
  private escalationRules: Map<string, EscalationRule>;

  constructor(private db: Database) {
    this.approvalRules = this.initializeApprovalRules();
    this.escalationRules = this.initializeEscalationRules();
  }

  /**
   * Initialize approval rules based on modification type and value
   */
  private initializeApprovalRules(): Map<string, ApprovalRule[]> {
    const rules = new Map<string, ApprovalRule[]>();

    // Standard modifications
    rules.set('standard', [
      { level: 'manager', required: true },
      { level: 'finance', threshold: 10000, required: true }
    ]);

    // High-value modifications
    rules.set('high_value', [
      { level: 'manager', required: true },
      { level: 'finance', required: true },
      { level: 'executive', threshold: 50000, required: true }
    ]);

    // Terminations
    rules.set('termination', [
      { level: 'manager', required: true },
      { level: 'finance', required: true },
      { level: 'legal', required: true }
    ]);

    // Blend and extend
    rules.set('blend_extend', [
      { level: 'finance', required: true },
      { level: 'executive', required: true }
    ]);

    return rules;
  }

  /**
   * Initialize escalation rules
   */
  private initializeEscalationRules(): Map<string, EscalationRule> {
    const rules = new Map<string, EscalationRule>();

    rules.set('manager', {
      level: 'manager',
      escalateAfterHours: 24,
      escalateTo: 'senior_manager',
      notificationMethod: 'email'
    });

    rules.set('finance', {
      level: 'finance',
      escalateAfterHours: 48,
      escalateTo: 'cfo',
      notificationMethod: 'both'
    });

    rules.set('executive', {
      level: 'executive',
      escalateAfterHours: 72,
      escalateTo: 'ceo',
      notificationMethod: 'both'
    });

    return rules;
  }

  /**
   * Submit modification for approval
   */
  async submitForApproval(
    modificationId: string,
    submitterId: string
  ): Promise<ApprovalStatus> {
    // Get modification details
    const modification = await this.getModification(modificationId);
    
    if (!modification) {
      throw new Error('Modification not found');
    }

    if (modification.status !== ModificationStatus.DRAFT) {
      throw new Error('Only draft modifications can be submitted for approval');
    }

    // Determine required approvals
    const requiredApprovals = await this.determineRequiredApprovals(modification);

    // Update modification status
    await this.db.update(contractModifications)
      .set({
        status: ModificationStatus.PENDING_APPROVAL,
        requestedBy: submitterId,
        updatedAt: new Date()
      })
      .where(eq(contractModifications.id, modificationId));

    // Create initial approval history entry
    await this.createApprovalHistoryEntry({
      modificationId,
      approvalLevel: 'submission',
      approvalAction: 'submitted',
      approvedBy: submitterId,
      approvalDate: new Date(),
      comments: 'Modification submitted for approval'
    });

    // Send notifications to first approver
    await this.notifyApprovers(modificationId, requiredApprovals[0].level);

    return this.getApprovalStatus(modificationId);
  }

  /**
   * Process an approval action
   */
  async processApproval(request: ApprovalRequest): Promise<ApprovalStatus> {
    const modification = await this.getModification(request.modificationId);
    
    if (!modification) {
      throw new Error('Modification not found');
    }

    if (modification.status !== ModificationStatus.PENDING_APPROVAL) {
      throw new Error('Modification is not pending approval');
    }

    // Validate approver authorization
    const canApprove = await this.validateApprover(
      request.modificationId,
      request.approverId,
      request.approverRole
    );

    if (!canApprove) {
      throw new Error('User is not authorized to approve this modification');
    }

    // Record approval action
    await this.createApprovalHistoryEntry({
      modificationId: request.modificationId,
      approvalLevel: request.approverRole,
      approvalAction: request.action,
      approvedBy: request.approverId,
      approvalDate: new Date(),
      comments: request.comments,
      conditions: request.conditions
    });

    // Process based on action
    switch (request.action) {
      case 'approve':
        await this.handleApproval(modification, request);
        break;
      case 'reject':
        await this.handleRejection(modification, request);
        break;
      case 'request_info':
        await this.handleInfoRequest(modification, request);
        break;
    }

    return this.getApprovalStatus(request.modificationId);
  }

  /**
   * Handle approval action
   */
  private async handleApproval(
    modification: any,
    request: ApprovalRequest
  ): Promise<void> {
    // Check if all required approvals are complete
    const approvalStatus = await this.getApprovalStatus(modification.id);
    const allApproved = await this.checkAllApprovalsComplete(approvalStatus);

    if (allApproved) {
      // Mark modification as approved
      await this.db.update(contractModifications)
        .set({
          status: ModificationStatus.APPROVED,
          approvedBy: request.approverId,
          approvalDate: new Date(),
          updatedAt: new Date()
        })
        .where(eq(contractModifications.id, modification.id));

      // Notify relevant parties
      await this.notifyApprovalComplete(modification.id);
    } else {
      // Notify next approver
      const nextLevel = this.getNextApprovalLevel(approvalStatus);
      if (nextLevel) {
        await this.notifyApprovers(modification.id, nextLevel);
      }
    }

    // Update specific approval fields based on level
    if (request.approverRole === 'finance') {
      await this.db.update(contractModifications)
        .set({
          financeApprovedBy: request.approverId,
          financeApprovedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(contractModifications.id, modification.id));
    } else if (request.approverRole === 'legal') {
      await this.db.update(contractModifications)
        .set({
          legalApprovedBy: request.approverId,
          legalApprovedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(contractModifications.id, modification.id));
    }
  }

  /**
   * Handle rejection action
   */
  private async handleRejection(
    modification: any,
    request: ApprovalRequest
  ): Promise<void> {
    await this.db.update(contractModifications)
      .set({
        status: ModificationStatus.REJECTED,
        rejectedBy: request.approverId,
        rejectionReason: request.comments,
        updatedAt: new Date()
      })
      .where(eq(contractModifications.id, modification.id));

    // Notify submitter of rejection
    await this.notifyRejection(modification.id, request.comments || '');
  }

  /**
   * Handle information request
   */
  private async handleInfoRequest(
    modification: any,
    request: ApprovalRequest
  ): Promise<void> {
    // Keep status as pending but add note
    await this.createApprovalHistoryEntry({
      modificationId: modification.id,
      approvalLevel: request.approverRole,
      approvalAction: 'requested_info',
      approvedBy: request.approverId,
      approvalDate: new Date(),
      comments: request.comments
    });

    // Notify submitter of info request
    await this.notifyInfoRequest(modification.id, request.comments || '');
  }

  /**
   * Get approval status for a modification
   */
  async getApprovalStatus(modificationId: string): Promise<ApprovalStatus> {
    const modification = await this.getModification(modificationId);
    
    if (!modification) {
      throw new Error('Modification not found');
    }

    // Get required approvals
    const requiredApprovals = await this.determineRequiredApprovals(modification);

    // Get approval history
    const approvalHistory = await this.db.select()
      .from(modificationApprovalHistory)
      .where(eq(modificationApprovalHistory.modificationId, modificationId))
      .orderBy(sql`${modificationApprovalHistory.approvalDate} ASC`);

    // Determine completed and pending approvals
    const completedApprovals = approvalHistory
      .filter(h => h.approvalAction === 'approved')
      .map(h => ({
        level: h.approvalLevel,
        approvedBy: h.approvedBy,
        approvedAt: h.approvalDate,
        action: h.approvalAction
      }));

    const completedLevels = new Set(completedApprovals.map(a => a.level));
    const pendingApprovals = requiredApprovals
      .filter(r => !completedLevels.has(r.level))
      .map(r => r.level);

    // Determine if current user can approve
    const canApprove = pendingApprovals.length > 0 && 
                      modification.status === ModificationStatus.PENDING_APPROVAL;

    return {
      modificationId,
      currentStatus: modification.status,
      requiredApprovals,
      completedApprovals,
      pendingApprovals,
      canApprove,
      nextApprover: pendingApprovals[0]
    };
  }

  /**
   * Check for pending approvals requiring escalation
   */
  async checkForEscalations(): Promise<void> {
    // Get all pending approvals
    const pendingModifications = await this.db.select()
      .from(contractModifications)
      .where(eq(contractModifications.status, ModificationStatus.PENDING_APPROVAL));

    for (const modification of pendingModifications) {
      const approvalStatus = await this.getApprovalStatus(modification.id);
      
      if (approvalStatus.pendingApprovals.length > 0) {
        const nextLevel = approvalStatus.pendingApprovals[0];
        const escalationRule = this.escalationRules.get(nextLevel);
        
        if (escalationRule) {
          // Check if escalation is needed
          const hoursSinceRequest = this.getHoursSince(modification.requestDate);
          
          if (hoursSinceRequest >= escalationRule.escalateAfterHours) {
            await this.escalateApproval(modification.id, escalationRule);
          }
        }
      }
    }
  }

  /**
   * Escalate an approval
   */
  private async escalateApproval(
    modificationId: string,
    rule: EscalationRule
  ): Promise<void> {
    // Create escalation history entry
    await this.createApprovalHistoryEntry({
      modificationId,
      approvalLevel: 'escalation',
      approvalAction: 'escalated',
      approvedBy: 'system',
      approvalDate: new Date(),
      comments: `Escalated to ${rule.escalateTo} after ${rule.escalateAfterHours} hours`,
      delegatedFrom: rule.level,
      delegationReason: 'timeout'
    });

    // Send escalation notification
    await this.sendEscalationNotification(modificationId, rule);
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
    const modification = await this.getModification(modificationId);
    
    if (!modification) {
      throw new Error('Modification not found');
    }

    // Verify fromApprover is authorized
    const approvalStatus = await this.getApprovalStatus(modificationId);
    const canDelegate = approvalStatus.pendingApprovals.length > 0;

    if (!canDelegate) {
      throw new Error('No pending approvals to delegate');
    }

    // Record delegation
    await this.createApprovalHistoryEntry({
      modificationId,
      approvalLevel: 'delegation',
      approvalAction: 'delegated',
      approvedBy: toApproverId,
      approvalDate: new Date(),
      comments: `Delegated from ${fromApproverId}: ${reason}`,
      delegatedFrom: fromApproverId,
      delegationReason: reason
    });

    // Notify new approver
    await this.notifyDelegation(modificationId, toApproverId, fromApproverId);
  }

  /**
   * Recall a modification from approval
   */
  async recallModification(
    modificationId: string,
    recalledBy: string,
    reason: string
  ): Promise<void> {
    const modification = await this.getModification(modificationId);
    
    if (!modification) {
      throw new Error('Modification not found');
    }

    if (modification.status !== ModificationStatus.PENDING_APPROVAL) {
      throw new Error('Can only recall modifications pending approval');
    }

    // Update status
    await this.db.update(contractModifications)
      .set({
        status: ModificationStatus.DRAFT,
        updatedAt: new Date()
      })
      .where(eq(contractModifications.id, modificationId));

    // Record recall
    await this.createApprovalHistoryEntry({
      modificationId,
      approvalLevel: 'recall',
      approvalAction: 'recalled',
      approvedBy: recalledBy,
      approvalDate: new Date(),
      comments: reason
    });
  }

  /**
   * Helper methods
   */

  private async getModification(modificationId: string): Promise<any> {
    const [modification] = await this.db.select()
      .from(contractModifications)
      .where(eq(contractModifications.id, modificationId))
      .limit(1);
    
    return modification;
  }

  private async determineRequiredApprovals(modification: any): Promise<ApprovalRule[]> {
    let rules: ApprovalRule[] = [];

    // Determine rule set based on modification type and value
    const adjustmentAmount = Math.abs(parseFloat(modification.adjustmentAmount));

    if (modification.modificationType === 'early_termination' || 
        modification.modificationType === 'partial_termination' ||
        modification.modificationType === 'cancellation') {
      rules = this.approvalRules.get('termination') || [];
    } else if (modification.modificationType === 'blend_extend') {
      rules = this.approvalRules.get('blend_extend') || [];
    } else if (adjustmentAmount >= 50000) {
      rules = this.approvalRules.get('high_value') || [];
    } else {
      rules = this.approvalRules.get('standard') || [];
    }

    // Filter rules based on thresholds
    return rules.filter(rule => {
      if (rule.threshold) {
        return adjustmentAmount >= rule.threshold;
      }
      return true;
    });
  }

  private async validateApprover(
    modificationId: string,
    approverId: string,
    approverRole: string
  ): Promise<boolean> {
    const approvalStatus = await this.getApprovalStatus(modificationId);
    
    // Check if this level is pending approval
    return approvalStatus.pendingApprovals.includes(approverRole);
  }

  private async checkAllApprovalsComplete(status: ApprovalStatus): Promise<boolean> {
    const requiredLevels = new Set(status.requiredApprovals.map(r => r.level));
    const completedLevels = new Set(status.completedApprovals.map(c => c.level));
    
    // Check if all required levels are completed
    for (const level of requiredLevels) {
      if (!completedLevels.has(level)) {
        return false;
      }
    }
    
    return true;
  }

  private getNextApprovalLevel(status: ApprovalStatus): string | undefined {
    return status.pendingApprovals[0];
  }

  private async createApprovalHistoryEntry(entry: NewModificationApprovalHistory): Promise<void> {
    await this.db.insert(modificationApprovalHistory).values({
      id: createId(),
      ...entry,
      createdAt: new Date()
    });
  }

  private getHoursSince(date: Date): number {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    return diff / (1000 * 60 * 60);
  }

  /**
   * Notification methods (placeholders for actual implementation)
   */

  private async notifyApprovers(modificationId: string, level: string): Promise<void> {
    console.log(`Notifying ${level} approvers for modification ${modificationId}`);
    // Actual implementation would send emails/notifications
  }

  private async notifyApprovalComplete(modificationId: string): Promise<void> {
    console.log(`Modification ${modificationId} has been fully approved`);
    // Actual implementation would send completion notifications
  }

  private async notifyRejection(modificationId: string, reason: string): Promise<void> {
    console.log(`Modification ${modificationId} has been rejected: ${reason}`);
    // Actual implementation would send rejection notifications
  }

  private async notifyInfoRequest(modificationId: string, request: string): Promise<void> {
    console.log(`Additional information requested for ${modificationId}: ${request}`);
    // Actual implementation would send info request notifications
  }

  private async sendEscalationNotification(modificationId: string, rule: EscalationRule): Promise<void> {
    console.log(`Escalating modification ${modificationId} to ${rule.escalateTo}`);
    // Actual implementation would send escalation notifications
  }

  private async notifyDelegation(
    modificationId: string,
    toApproverId: string,
    fromApproverId: string
  ): Promise<void> {
    console.log(`Approval delegated from ${fromApproverId} to ${toApproverId} for ${modificationId}`);
    // Actual implementation would send delegation notifications
  }
}