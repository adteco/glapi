import { BaseService } from './base-service';
import { ServiceError } from '../types';
import { approvalWorkflowRepository } from '@glapi/database';
import type {
  ApprovalPolicy,
  ApprovalStep,
  ApprovalInstance,
  NewApprovalInstance,
  WorkflowApprovalAction,
  NewWorkflowApprovalAction,
  ApprovalDocumentType,
  ApprovalInstanceStatus,
  WorkflowApprovalActionType,
  ApprovalConditionRule,
} from '@glapi/database';
import {
  ApprovalInstanceStatuses,
  WorkflowApprovalActions,
  ApprovalLevels,
} from '@glapi/database';
import { SegregationOfDutiesService, SodCheckContext } from './segregation-of-duties-service';
import { EventService, EmitEventInput } from './event-service';
import { EventCategory } from '@glapi/database';
import { createId } from '@paralleldrive/cuid2';

// ============================================================================
// Types
// ============================================================================

/**
 * Input for submitting a document for approval
 */
export interface SubmitForApprovalInput {
  documentType: ApprovalDocumentType;
  documentId: string;
  documentNumber?: string;
  documentAmount?: number;
  subsidiaryId?: string;
  departmentId?: string;
  metadata?: Record<string, unknown>;
  requiredByDate?: Date;
}

/**
 * Input for processing an approval action
 */
export interface ProcessApprovalInput {
  instanceId: string;
  action: WorkflowApprovalActionType;
  comments?: string;
  conditions?: Record<string, unknown>;
  delegateTo?: string;
}

/**
 * Result of submitting for approval
 */
export interface SubmitApprovalResult {
  instance: ApprovalInstance;
  policyUsed: ApprovalPolicy;
  totalSteps: number;
  firstApprovers: ApproverInfo[];
}

/**
 * Information about potential approvers
 */
export interface ApproverInfo {
  stepNumber: number;
  stepName: string;
  approvalLevel: string;
  requiredRoleIds: string[];
  requiredApprovals: number;
}

/**
 * Status of an approval workflow
 */
export interface ApprovalWorkflowStatus {
  instance: ApprovalInstance;
  policy: ApprovalPolicy | null;
  currentStep: ApprovalStep | null;
  completedSteps: number;
  totalSteps: number;
  actions: WorkflowApprovalAction[];
  pendingApprovers: ApproverInfo[];
  canUserApprove: boolean;
  isComplete: boolean;
  isFinalApproved: boolean;
  isRejected: boolean;
}

/**
 * Notification event data
 */
export interface ApprovalNotificationData {
  instanceId: string;
  documentType: ApprovalDocumentType;
  documentId: string;
  documentNumber?: string;
  action: string;
  stepNumber: number;
  stepName: string;
  actorId: string;
  actorName?: string;
  recipientRoleIds?: string[];
  recipientUserIds?: string[];
  comments?: string;
}

// ============================================================================
// Service
// ============================================================================

/**
 * Service for managing approval workflows
 * Coordinates between approval policies, SoD enforcement, and notifications
 */
export class ApprovalWorkflowService extends BaseService {
  private eventService: EventService;
  private sodService: SegregationOfDutiesService;

  constructor(context: { organizationId?: string; userId?: string } = {}) {
    super(context);
    this.eventService = new EventService(context);
    this.sodService = new SegregationOfDutiesService(context);
  }

  // ============================================================================
  // Submission
  // ============================================================================

  /**
   * Submit a document for approval
   * Finds the appropriate policy, creates an instance, and notifies approvers
   */
  async submitForApproval(input: SubmitForApprovalInput): Promise<SubmitApprovalResult> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    // Find the applicable policy
    const policy = await this.findApplicablePolicy(
      organizationId,
      input.documentType,
      input
    );

    if (!policy) {
      throw new ServiceError(
        `No approval policy found for document type: ${input.documentType}`,
        'NO_APPROVAL_POLICY',
        400
      );
    }

    // Get policy steps
    const policyWithSteps = await approvalWorkflowRepository.findPolicyWithSteps(policy.id);
    if (!policyWithSteps || policyWithSteps.steps.length === 0) {
      throw new ServiceError(
        'Approval policy has no configured steps',
        'INVALID_POLICY_CONFIGURATION',
        500
      );
    }

    // Check if already submitted
    const existing = await approvalWorkflowRepository.findInstanceByDocument(
      input.documentType,
      input.documentId
    );

    if (existing) {
      throw new ServiceError(
        'Document is already submitted for approval',
        'ALREADY_SUBMITTED',
        409,
        { existingInstanceId: existing.id }
      );
    }

    // Create the approval instance
    const instanceData: NewApprovalInstance = {
      id: createId(),
      organizationId,
      documentType: input.documentType,
      documentId: input.documentId,
      documentNumber: input.documentNumber,
      policyId: policy.id,
      policySnapshot: JSON.stringify(policyWithSteps),
      status: ApprovalInstanceStatuses.PENDING,
      currentStepNumber: 1,
      totalSteps: policyWithSteps.steps.length,
      submittedBy: userId,
      documentAmount: input.documentAmount?.toString(),
      subsidiaryId: input.subsidiaryId,
      departmentId: input.departmentId,
      metadata: input.metadata,
      requiredByDate: input.requiredByDate,
    };

    const instance = await approvalWorkflowRepository.createInstance(instanceData);

    // Get first step approvers
    const firstStep = policyWithSteps.steps[0];
    const firstApprovers: ApproverInfo[] = [{
      stepNumber: firstStep.stepNumber,
      stepName: firstStep.stepName,
      approvalLevel: firstStep.approvalLevel,
      requiredRoleIds: (firstStep.requiredRoleIds as string[]) || [],
      requiredApprovals: firstStep.requiredApprovals,
    }];

    // Emit submission event for notifications
    await this.emitApprovalEvent('ApprovalSubmitted', {
      instanceId: instance.id,
      documentType: input.documentType,
      documentId: input.documentId,
      documentNumber: input.documentNumber,
      action: 'submitted',
      stepNumber: 1,
      stepName: firstStep.stepName,
      actorId: userId,
      recipientRoleIds: (firstStep.requiredRoleIds as string[]) || [],
    });

    return {
      instance,
      policyUsed: policy,
      totalSteps: policyWithSteps.steps.length,
      firstApprovers,
    };
  }

  /**
   * Find the applicable policy for a document
   */
  private async findApplicablePolicy(
    organizationId: string,
    documentType: ApprovalDocumentType,
    context: SubmitForApprovalInput
  ): Promise<ApprovalPolicy | null> {
    // Get all active policies for this document type, ordered by priority
    const policies = await approvalWorkflowRepository.findPoliciesByDocumentType(
      organizationId,
      documentType
    );

    // Find the first policy whose conditions match
    for (const policy of policies) {
      if (this.evaluateConditions(policy.conditionRules as ApprovalConditionRule[], context)) {
        return policy;
      }
    }

    // Fall back to default policy
    const defaultPolicy = await approvalWorkflowRepository.findDefaultPolicy(
      organizationId,
      documentType
    );

    return defaultPolicy;
  }

  /**
   * Evaluate policy condition rules against document context
   */
  private evaluateConditions(
    rules: ApprovalConditionRule[] | null,
    context: SubmitForApprovalInput
  ): boolean {
    if (!rules || rules.length === 0) {
      return true; // No conditions = always matches
    }

    for (const rule of rules) {
      const contextValue = this.getContextValue(rule.field, context);
      if (!this.evaluateCondition(rule, contextValue)) {
        return false;
      }
    }

    return true;
  }

  private getContextValue(field: string, context: SubmitForApprovalInput): unknown {
    switch (field) {
      case 'amount':
      case 'documentAmount':
        return context.documentAmount;
      case 'subsidiaryId':
        return context.subsidiaryId;
      case 'departmentId':
        return context.departmentId;
      default:
        return (context.metadata as Record<string, unknown>)?.[field];
    }
  }

  private evaluateCondition(rule: ApprovalConditionRule, value: unknown): boolean {
    const ruleValue = rule.value;

    switch (rule.operator) {
      case 'eq':
        return value === ruleValue;
      case 'ne':
        return value !== ruleValue;
      case 'gt':
        return typeof value === 'number' && value > (ruleValue as number);
      case 'gte':
        return typeof value === 'number' && value >= (ruleValue as number);
      case 'lt':
        return typeof value === 'number' && value < (ruleValue as number);
      case 'lte':
        return typeof value === 'number' && value <= (ruleValue as number);
      case 'in':
        return Array.isArray(ruleValue) && ruleValue.includes(value);
      case 'not_in':
        return Array.isArray(ruleValue) && !ruleValue.includes(value);
      default:
        return true;
    }
  }

  // ============================================================================
  // Approval Processing
  // ============================================================================

  /**
   * Process an approval action (approve, reject, delegate, etc.)
   */
  async processApproval(input: ProcessApprovalInput): Promise<ApprovalWorkflowStatus> {
    const userId = this.requireUserContext();

    // Get the instance
    const instanceWithActions = await approvalWorkflowRepository.findInstanceWithActions(
      input.instanceId
    );

    if (!instanceWithActions) {
      throw new ServiceError(
        'Approval instance not found',
        'INSTANCE_NOT_FOUND',
        404
      );
    }

    const instance = instanceWithActions;

    // Validate instance state
    if (instance.status === ApprovalInstanceStatuses.APPROVED) {
      throw new ServiceError(
        'This approval workflow is already complete',
        'ALREADY_APPROVED',
        400
      );
    }

    if (instance.status === ApprovalInstanceStatuses.REJECTED) {
      throw new ServiceError(
        'This approval workflow has been rejected',
        'ALREADY_REJECTED',
        400
      );
    }

    if (instance.status === ApprovalInstanceStatuses.RECALLED) {
      throw new ServiceError(
        'This approval workflow has been recalled',
        'ALREADY_RECALLED',
        400
      );
    }

    // Get the current step from policy snapshot
    const policySnapshot = JSON.parse(instance.policySnapshot as string);
    const currentStep = policySnapshot.steps.find(
      (s: ApprovalStep) => s.stepNumber === instance.currentStepNumber
    );

    if (!currentStep) {
      throw new ServiceError(
        'Current approval step not found',
        'STEP_NOT_FOUND',
        500
      );
    }

    // Enforce SoD rules before allowing approval
    if (input.action === WorkflowApprovalActions.APPROVE) {
      await this.enforceSodForApproval(instance, instanceWithActions.actions, userId);
    }

    // Create the action record
    const actionData: NewWorkflowApprovalAction = {
      id: createId(),
      approvalInstanceId: instance.id,
      stepNumber: instance.currentStepNumber,
      action: input.action,
      actionBy: userId,
      comments: input.comments,
      conditions: input.conditions,
      delegatedTo: input.delegateTo,
    };

    const action = await approvalWorkflowRepository.createAction(actionData);

    // Process the action based on type
    let updatedInstance: ApprovalInstance;

    switch (input.action) {
      case WorkflowApprovalActions.APPROVE:
        updatedInstance = await this.handleApprove(instance, currentStep, policySnapshot, userId);
        break;

      case WorkflowApprovalActions.REJECT:
        updatedInstance = await this.handleReject(instance, userId, input.comments);
        break;

      case WorkflowApprovalActions.DELEGATE:
        if (!input.delegateTo) {
          throw new ServiceError(
            'Delegate target user is required',
            'DELEGATE_TARGET_REQUIRED',
            400
          );
        }
        updatedInstance = await this.handleDelegate(instance, userId, input.delegateTo);
        break;

      case WorkflowApprovalActions.ESCALATE:
        updatedInstance = await this.handleEscalate(instance, currentStep, userId);
        break;

      case WorkflowApprovalActions.RECALL:
        updatedInstance = await this.handleRecall(instance, userId);
        break;

      case WorkflowApprovalActions.REQUEST_INFO:
        updatedInstance = instance; // Status doesn't change, just logged
        break;

      default:
        throw new ServiceError(
          `Unknown approval action: ${input.action}`,
          'INVALID_ACTION',
          400
        );
    }

    return this.getWorkflowStatus(updatedInstance.id);
  }

  /**
   * Enforce SoD rules before approval
   */
  private async enforceSodForApproval(
    instance: ApprovalInstance,
    priorActions: WorkflowApprovalAction[],
    approverId: string
  ): Promise<void> {
    // Build prior actions for SoD check
    const priorActionsList = priorActions.map((a) => ({
      action: a.action,
      userId: a.actionBy,
      userRoleIds: a.actionByRoleId ? [a.actionByRoleId] : [],
      performedAt: a.actionAt,
    }));

    // Add the submitter as a prior action (creator)
    priorActionsList.push({
      action: 'submit',
      userId: instance.submittedBy,
      userRoleIds: [],
      performedAt: instance.submittedAt,
    });

    const sodContext: SodCheckContext = {
      documentType: instance.documentType,
      documentId: instance.documentId,
      documentNumber: instance.documentNumber || undefined,
      action: 'approve',
      userId: approverId,
      userRoleIds: [], // Would need to fetch from RBAC service
      subsidiaryId: instance.subsidiaryId || undefined,
      departmentId: instance.departmentId || undefined,
      priorActions: priorActionsList,
    };

    // This will throw if blocked
    await this.sodService.enforceAction(sodContext);
  }

  /**
   * Handle approval action
   */
  private async handleApprove(
    instance: ApprovalInstance,
    currentStep: ApprovalStep,
    policySnapshot: { steps: ApprovalStep[] },
    approverId: string
  ): Promise<ApprovalInstance> {
    const isLastStep = instance.currentStepNumber >= instance.totalSteps;

    if (isLastStep) {
      // Final approval - mark as approved
      const updated = await approvalWorkflowRepository.updateInstance(instance.id, {
        status: ApprovalInstanceStatuses.APPROVED,
        completedAt: new Date(),
        finalApprovedBy: approverId,
      });

      // Emit completion event
      await this.emitApprovalEvent('ApprovalCompleted', {
        instanceId: instance.id,
        documentType: instance.documentType,
        documentId: instance.documentId,
        documentNumber: instance.documentNumber || undefined,
        action: 'approved',
        stepNumber: instance.currentStepNumber,
        stepName: currentStep.stepName,
        actorId: approverId,
        recipientUserIds: [instance.submittedBy],
      });

      return updated!;
    } else {
      // Move to next step
      const nextStepNumber = instance.currentStepNumber + 1;
      const nextStep = policySnapshot.steps.find(
        (s: ApprovalStep) => s.stepNumber === nextStepNumber
      );

      const updated = await approvalWorkflowRepository.updateInstance(instance.id, {
        status: ApprovalInstanceStatuses.IN_PROGRESS,
        currentStepNumber: nextStepNumber,
      });

      // Emit next step event
      if (nextStep) {
        await this.emitApprovalEvent('ApprovalStepCompleted', {
          instanceId: instance.id,
          documentType: instance.documentType,
          documentId: instance.documentId,
          documentNumber: instance.documentNumber || undefined,
          action: 'step_approved',
          stepNumber: nextStepNumber,
          stepName: nextStep.stepName,
          actorId: approverId,
          recipientRoleIds: (nextStep.requiredRoleIds as string[]) || [],
        });
      }

      return updated!;
    }
  }

  /**
   * Handle rejection action
   */
  private async handleReject(
    instance: ApprovalInstance,
    rejectorId: string,
    reason?: string
  ): Promise<ApprovalInstance> {
    const updated = await approvalWorkflowRepository.updateInstance(instance.id, {
      status: ApprovalInstanceStatuses.REJECTED,
      completedAt: new Date(),
      finalRejectedBy: rejectorId,
      finalComments: reason,
    });

    // Emit rejection event
    await this.emitApprovalEvent('ApprovalRejected', {
      instanceId: instance.id,
      documentType: instance.documentType,
      documentId: instance.documentId,
      documentNumber: instance.documentNumber || undefined,
      action: 'rejected',
      stepNumber: instance.currentStepNumber,
      stepName: 'Rejected',
      actorId: rejectorId,
      recipientUserIds: [instance.submittedBy],
      comments: reason,
    });

    return updated!;
  }

  /**
   * Handle delegation
   */
  private async handleDelegate(
    instance: ApprovalInstance,
    delegatorId: string,
    delegateToId: string
  ): Promise<ApprovalInstance> {
    // Emit delegation event
    await this.emitApprovalEvent('ApprovalDelegated', {
      instanceId: instance.id,
      documentType: instance.documentType,
      documentId: instance.documentId,
      documentNumber: instance.documentNumber || undefined,
      action: 'delegated',
      stepNumber: instance.currentStepNumber,
      stepName: 'Delegated',
      actorId: delegatorId,
      recipientUserIds: [delegateToId],
    });

    return instance; // Instance status doesn't change for delegation
  }

  /**
   * Handle escalation
   */
  private async handleEscalate(
    instance: ApprovalInstance,
    currentStep: ApprovalStep,
    escalatorId: string
  ): Promise<ApprovalInstance> {
    const updated = await approvalWorkflowRepository.updateInstance(instance.id, {
      status: ApprovalInstanceStatuses.ESCALATED,
    });

    // Emit escalation event
    await this.emitApprovalEvent('ApprovalEscalated', {
      instanceId: instance.id,
      documentType: instance.documentType,
      documentId: instance.documentId,
      documentNumber: instance.documentNumber || undefined,
      action: 'escalated',
      stepNumber: instance.currentStepNumber,
      stepName: currentStep.stepName,
      actorId: escalatorId,
      recipientRoleIds: (currentStep.escalationNotifyRoleIds as string[]) || [],
    });

    return updated!;
  }

  /**
   * Handle recall
   */
  private async handleRecall(
    instance: ApprovalInstance,
    recallerId: string
  ): Promise<ApprovalInstance> {
    // Only submitter can recall
    if (instance.submittedBy !== recallerId) {
      throw new ServiceError(
        'Only the submitter can recall an approval request',
        'RECALL_NOT_ALLOWED',
        403
      );
    }

    const updated = await approvalWorkflowRepository.updateInstance(instance.id, {
      status: ApprovalInstanceStatuses.RECALLED,
      completedAt: new Date(),
    });

    // Emit recall event
    await this.emitApprovalEvent('ApprovalRecalled', {
      instanceId: instance.id,
      documentType: instance.documentType,
      documentId: instance.documentId,
      documentNumber: instance.documentNumber || undefined,
      action: 'recalled',
      stepNumber: instance.currentStepNumber,
      stepName: 'Recalled',
      actorId: recallerId,
    });

    return updated!;
  }

  // ============================================================================
  // Status & Queries
  // ============================================================================

  /**
   * Get full workflow status for an instance
   */
  async getWorkflowStatus(instanceId: string): Promise<ApprovalWorkflowStatus> {
    const userId = this.requireUserContext();

    const instanceWithActions = await approvalWorkflowRepository.findInstanceWithActions(
      instanceId
    );

    if (!instanceWithActions) {
      throw new ServiceError(
        'Approval instance not found',
        'INSTANCE_NOT_FOUND',
        404
      );
    }

    const instance = instanceWithActions;
    const actions = instanceWithActions.actions;

    // Parse policy snapshot
    let policy: ApprovalPolicy | null = null;
    let currentStep: ApprovalStep | null = null;
    let pendingApprovers: ApproverInfo[] = [];

    if (instance.policySnapshot) {
      const snapshot = JSON.parse(instance.policySnapshot as string);
      policy = snapshot;

      if (snapshot.steps) {
        currentStep = snapshot.steps.find(
          (s: ApprovalStep) => s.stepNumber === instance.currentStepNumber
        );

        if (currentStep) {
          pendingApprovers = [{
            stepNumber: currentStep.stepNumber,
            stepName: currentStep.stepName,
            approvalLevel: currentStep.approvalLevel,
            requiredRoleIds: (currentStep.requiredRoleIds as string[]) || [],
            requiredApprovals: currentStep.requiredApprovals,
          }];
        }
      }
    }

    // Calculate completed steps (count distinct step approvals)
    const approvedSteps = new Set(
      actions
        .filter((a) => a.action === WorkflowApprovalActions.APPROVE)
        .map((a) => a.stepNumber)
    );

    const isComplete = instance.status === ApprovalInstanceStatuses.APPROVED ||
      instance.status === ApprovalInstanceStatuses.REJECTED ||
      instance.status === ApprovalInstanceStatuses.RECALLED;

    return {
      instance,
      policy,
      currentStep,
      completedSteps: approvedSteps.size,
      totalSteps: instance.totalSteps,
      actions,
      pendingApprovers,
      canUserApprove: !isComplete && instance.submittedBy !== userId,
      isComplete,
      isFinalApproved: instance.status === ApprovalInstanceStatuses.APPROVED,
      isRejected: instance.status === ApprovalInstanceStatuses.REJECTED,
    };
  }

  /**
   * Check if a document has been approved
   */
  async isDocumentApproved(
    documentType: ApprovalDocumentType,
    documentId: string
  ): Promise<boolean> {
    const instance = await approvalWorkflowRepository.findInstanceByDocument(
      documentType,
      documentId
    );

    return instance?.status === ApprovalInstanceStatuses.APPROVED;
  }

  /**
   * Require document approval before proceeding
   * Throws if not approved
   */
  async requireApproval(
    documentType: ApprovalDocumentType,
    documentId: string
  ): Promise<void> {
    const isApproved = await this.isDocumentApproved(documentType, documentId);

    if (!isApproved) {
      const instance = await approvalWorkflowRepository.findInstanceByDocument(
        documentType,
        documentId
      );

      if (!instance) {
        throw new ServiceError(
          'Document must be submitted for approval before this action',
          'APPROVAL_REQUIRED',
          403
        );
      }

      throw new ServiceError(
        `Document approval is pending (status: ${instance.status})`,
        'APPROVAL_PENDING',
        403,
        {
          instanceId: instance.id,
          status: instance.status,
          currentStep: instance.currentStepNumber,
          totalSteps: instance.totalSteps,
        }
      );
    }
  }

  /**
   * Get pending approvals for a user
   */
  async getPendingApprovalsForUser(roleIds: string[]): Promise<ApprovalInstance[]> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    return approvalWorkflowRepository.findPendingInstancesForApprover(
      organizationId,
      userId,
      roleIds
    );
  }

  // ============================================================================
  // Events / Notifications
  // ============================================================================

  /**
   * Emit an approval workflow event
   */
  private async emitApprovalEvent(
    eventType: string,
    data: ApprovalNotificationData
  ): Promise<void> {
    try {
      const eventInput: EmitEventInput = {
        eventType,
        eventCategory: EventCategory.WORKFLOW,
        aggregateId: data.instanceId,
        aggregateType: 'ApprovalInstance',
        data,
        metadata: {
          documentType: data.documentType,
          documentId: data.documentId,
        },
        publishConfig: {
          topic: 'approval-notifications',
          partitionKey: data.instanceId,
        },
      };

      await this.eventService.emit(eventInput);
    } catch (error) {
      // Log but don't fail the approval action
      console.error('Failed to emit approval event:', error);
    }
  }

  /**
   * Check for overdue approvals and escalate
   */
  async checkAndEscalateOverdue(): Promise<number> {
    const organizationId = this.requireOrganizationContext();

    // Get all pending/in_progress instances
    const pendingInstances = await approvalWorkflowRepository.findInstancesByStatus(
      organizationId,
      ApprovalInstanceStatuses.PENDING
    );

    const inProgressInstances = await approvalWorkflowRepository.findInstancesByStatus(
      organizationId,
      ApprovalInstanceStatuses.IN_PROGRESS
    );

    const allPending = [...pendingInstances, ...inProgressInstances];
    let escalatedCount = 0;

    for (const instance of allPending) {
      if (!instance.policySnapshot) continue;

      const snapshot = JSON.parse(instance.policySnapshot as string);
      const currentStep = snapshot.steps?.find(
        (s: ApprovalStep) => s.stepNumber === instance.currentStepNumber
      );

      if (!currentStep?.escalationHours) continue;

      // Check if overdue
      const hoursElapsed =
        (Date.now() - new Date(instance.submittedAt).getTime()) / (1000 * 60 * 60);

      if (hoursElapsed > currentStep.escalationHours) {
        // Auto-escalate
        await approvalWorkflowRepository.updateInstance(instance.id, {
          status: ApprovalInstanceStatuses.ESCALATED,
        });

        await this.emitApprovalEvent('ApprovalAutoEscalated', {
          instanceId: instance.id,
          documentType: instance.documentType,
          documentId: instance.documentId,
          documentNumber: instance.documentNumber || undefined,
          action: 'auto_escalated',
          stepNumber: instance.currentStepNumber,
          stepName: currentStep.stepName,
          actorId: 'system',
          recipientRoleIds: (currentStep.escalationNotifyRoleIds as string[]) || [],
        });

        escalatedCount++;
      }
    }

    return escalatedCount;
  }
}

// Export factory function
export function createApprovalWorkflowService(
  organizationId?: string,
  userId?: string
): ApprovalWorkflowService {
  return new ApprovalWorkflowService({
    organizationId,
    userId,
  });
}
