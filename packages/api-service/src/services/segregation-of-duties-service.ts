import { BaseService } from './base-service';
import { ServiceError } from '../types';
import { approvalWorkflowRepository } from '@glapi/database';
import type {
  SodRule,
  SodViolation,
  NewSodViolation,
  ApprovalDocumentType,
  SodConflictType,
} from '@glapi/database';
import { SodConflictTypes, SodEnforcementModes, SodSeverityLevels } from '@glapi/database';

/**
 * Result of an SoD check
 */
export interface SodCheckResult {
  allowed: boolean;
  violations: SodViolationDetail[];
  enforcementMode: 'block' | 'warn' | 'log_only';
}

/**
 * Detail of a detected SoD violation
 */
export interface SodViolationDetail {
  ruleId: string;
  ruleName: string;
  ruleCode: string;
  conflictType: SodConflictType;
  conflictingAction: string;
  conflictingUserId: string;
  conflictingActionAt?: Date;
  severity: string;
  message: string;
}

/**
 * Context for an SoD check
 */
export interface SodCheckContext {
  documentType: ApprovalDocumentType;
  documentId: string;
  documentNumber?: string;
  action: string; // The action being attempted (e.g., 'approve', 'create', 'post')
  userId: string;
  userRoleIds: string[];
  subsidiaryId?: string;
  departmentId?: string;
  priorActions?: DocumentAction[];
}

/**
 * Prior action on a document
 */
export interface DocumentAction {
  action: string;
  userId: string;
  userRoleIds: string[];
  performedAt: Date;
  subsidiaryId?: string;
  departmentId?: string;
}

/**
 * Service for enforcing Segregation of Duties policies
 * Validates that users don't perform conflicting actions on the same document
 */
export class SegregationOfDutiesService extends BaseService {
  /**
   * Check if an action is allowed under SoD rules
   * Returns the result with any violations found
   */
  async checkAction(context: SodCheckContext): Promise<SodCheckResult> {
    const organizationId = this.requireOrganizationContext();

    // Get all active SoD rules for this document type
    const rules = await approvalWorkflowRepository.findSodRulesForDocument(
      organizationId,
      context.documentType
    );

    if (rules.length === 0) {
      // No rules configured - allow by default
      return {
        allowed: true,
        violations: [],
        enforcementMode: 'log_only',
      };
    }

    const violations: SodViolationDetail[] = [];
    let mostRestrictiveMode: 'block' | 'warn' | 'log_only' = 'log_only';

    // Check each rule
    for (const rule of rules) {
      const violation = this.checkRuleViolation(rule, context);
      if (violation) {
        violations.push(violation);

        // Track the most restrictive enforcement mode
        // We'd need to look up the policy for the enforcement mode
        // For now, assume 'block' based on severity
        if (rule.severity === SodSeverityLevels.CRITICAL || rule.severity === SodSeverityLevels.HIGH) {
          mostRestrictiveMode = 'block';
        } else if (rule.severity === SodSeverityLevels.MEDIUM && mostRestrictiveMode !== 'block') {
          mostRestrictiveMode = 'warn';
        }
      }
    }

    const allowed = violations.length === 0 || mostRestrictiveMode !== 'block';

    return {
      allowed,
      violations,
      enforcementMode: mostRestrictiveMode,
    };
  }

  /**
   * Check a single rule for violation
   */
  private checkRuleViolation(
    rule: SodRule,
    context: SodCheckContext
  ): SodViolationDetail | null {
    // Check if user is exempt
    const exemptUserIds = (rule.exemptUserIds as string[]) || [];
    if (exemptUserIds.includes(context.userId)) {
      return null;
    }

    // Check if user's role is exempt
    const exemptRoleIds = (rule.exemptRoleIds as string[]) || [];
    const hasExemptRole = context.userRoleIds.some((roleId) =>
      exemptRoleIds.includes(roleId)
    );
    if (hasExemptRole) {
      return null;
    }

    // Check if this action is relevant to the rule
    if (rule.action2 !== context.action) {
      // The rule's action2 is the one being checked
      // action1 is the prior action that would create a conflict
      return null;
    }

    // Find conflicting prior actions
    const priorActions = context.priorActions || [];
    const conflictingAction = priorActions.find((prior) => {
      // Check if prior action matches rule.action1
      if (prior.action !== rule.action1) {
        return false;
      }

      // Apply conflict type logic
      return this.checkConflictType(rule, context, prior);
    });

    if (!conflictingAction) {
      return null;
    }

    // Violation detected
    return {
      ruleId: rule.id,
      ruleName: rule.ruleName,
      ruleCode: rule.ruleCode,
      conflictType: rule.conflictType as SodConflictType,
      conflictingAction: conflictingAction.action,
      conflictingUserId: conflictingAction.userId,
      conflictingActionAt: conflictingAction.performedAt,
      severity: rule.severity,
      message: this.buildViolationMessage(rule, context, conflictingAction),
    };
  }

  /**
   * Check if conflict type conditions are met
   */
  private checkConflictType(
    rule: SodRule,
    context: SodCheckContext,
    priorAction: DocumentAction
  ): boolean {
    switch (rule.conflictType) {
      case SodConflictTypes.SAME_USER:
        // Same user cannot perform both actions
        return context.userId === priorAction.userId;

      case SodConflictTypes.SAME_ROLE:
        // Users with overlapping roles cannot perform both actions
        const overlappingRoles = context.userRoleIds.filter((roleId) =>
          priorAction.userRoleIds.includes(roleId)
        );
        return overlappingRoles.length > 0;

      case SodConflictTypes.ROLE_PAIR:
        // Check if the user's roles conflict with prior user's roles
        const conflictingRoleIds = (rule.conflictingRoleIds as string[]) || [];
        const userHasConflictingRole = context.userRoleIds.some((roleId) =>
          conflictingRoleIds.includes(roleId)
        );
        const priorHasConflictingRole = priorAction.userRoleIds.some((roleId) =>
          conflictingRoleIds.includes(roleId)
        );
        return userHasConflictingRole && priorHasConflictingRole;

      case SodConflictTypes.SUBSIDIARY_BASED:
        // Must be from different subsidiaries (violation if same)
        if (rule.requireDifferentSubsidiary) {
          return context.subsidiaryId === priorAction.subsidiaryId;
        }
        // Must be from different departments
        if (rule.requireDifferentDepartment) {
          return context.departmentId === priorAction.departmentId;
        }
        return false;

      default:
        return false;
    }
  }

  /**
   * Build a human-readable violation message
   */
  private buildViolationMessage(
    rule: SodRule,
    context: SodCheckContext,
    priorAction: DocumentAction
  ): string {
    switch (rule.conflictType) {
      case SodConflictTypes.SAME_USER:
        return `Segregation of Duties violation: You cannot perform both '${priorAction.action}' and '${context.action}' on the same document.`;

      case SodConflictTypes.SAME_ROLE:
        return `Segregation of Duties violation: Users with overlapping roles cannot perform both '${priorAction.action}' and '${context.action}'.`;

      case SodConflictTypes.ROLE_PAIR:
        return `Segregation of Duties violation: These roles are not allowed to collectively perform '${priorAction.action}' and '${context.action}'.`;

      case SodConflictTypes.SUBSIDIARY_BASED:
        if (rule.requireDifferentSubsidiary) {
          return `Segregation of Duties violation: Actions must be performed by users from different subsidiaries.`;
        }
        return `Segregation of Duties violation: Actions must be performed by users from different departments.`;

      default:
        return `Segregation of Duties violation: ${rule.ruleName}`;
    }
  }

  /**
   * Enforce SoD rules - throws if blocked, returns warnings otherwise
   */
  async enforceAction(context: SodCheckContext): Promise<SodViolationDetail[]> {
    const result = await this.checkAction(context);

    // Log violations if any were found
    if (result.violations.length > 0) {
      await this.logViolations(context, result);
    }

    if (!result.allowed) {
      const messages = result.violations.map((v) => v.message).join('; ');
      throw new ServiceError(
        messages,
        'SOD_VIOLATION',
        403,
        {
          violations: result.violations,
          documentType: context.documentType,
          documentId: context.documentId,
        }
      );
    }

    // Return warnings (allowed but violations found)
    return result.violations;
  }

  /**
   * Log violations to the database
   */
  private async logViolations(
    context: SodCheckContext,
    result: SodCheckResult
  ): Promise<void> {
    const organizationId = this.requireOrganizationContext();

    for (const violation of result.violations) {
      const violationRecord: NewSodViolation = {
        organizationId,
        ruleId: violation.ruleId,
        ruleName: violation.ruleName,
        ruleCode: violation.ruleCode,
        documentType: context.documentType,
        documentId: context.documentId,
        documentNumber: context.documentNumber,
        attemptedBy: context.userId,
        attemptedAction: context.action,
        conflictsWith: violation.conflictingUserId,
        conflictingAction: violation.conflictingAction,
        conflictingActionAt: violation.conflictingActionAt,
        wasBlocked: !result.allowed,
        severity: violation.severity,
      };

      await approvalWorkflowRepository.createViolation(violationRecord);
    }
  }

  /**
   * Override a blocked action (requires special permission)
   */
  async overrideViolation(
    violationId: string,
    overrideReason: string,
    approvedBy?: string
  ): Promise<void> {
    // This would update the violation record to mark it as overridden
    // Implementation would depend on business requirements
    throw new ServiceError(
      'Override functionality not yet implemented',
      'NOT_IMPLEMENTED',
      501
    );
  }

  /**
   * Get violation history for a document
   */
  async getDocumentViolations(
    documentType: ApprovalDocumentType,
    documentId: string
  ): Promise<SodViolation[]> {
    return approvalWorkflowRepository.findViolationsByDocument(
      documentType,
      documentId
    );
  }

  /**
   * Get violation history for a user
   */
  async getUserViolations(limit = 50): Promise<SodViolation[]> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    return approvalWorkflowRepository.findViolationsByUser(
      organizationId,
      userId,
      limit
    );
  }

  /**
   * Get recent violations for the organization
   */
  async getRecentViolations(limit = 100): Promise<SodViolation[]> {
    const organizationId = this.requireOrganizationContext();

    return approvalWorkflowRepository.findRecentViolations(organizationId, limit);
  }

  /**
   * Get violation statistics by severity
   */
  async getViolationStats(): Promise<{ severity: string; count: number }[]> {
    const organizationId = this.requireOrganizationContext();

    return approvalWorkflowRepository.countViolationsBySeverity(organizationId);
  }
}

// Export singleton factory
export function createSegregationOfDutiesService(
  organizationId?: string,
  userId?: string
): SegregationOfDutiesService {
  return new SegregationOfDutiesService({
    organizationId,
    userId,
  });
}
