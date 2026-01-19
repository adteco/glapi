import { and, eq, desc, asc, isNull, sql, inArray } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import {
  approvalPolicies,
  approvalSteps,
  approvalInstances,
  approvalActions,
  sodPolicies,
  sodRules,
  sodViolations,
  ApprovalPolicy,
  NewApprovalPolicy,
  UpdateApprovalPolicy,
  ApprovalStep,
  NewApprovalStep,
  ApprovalInstance,
  NewApprovalInstance,
  UpdateApprovalInstance,
  WorkflowApprovalAction,
  NewWorkflowApprovalAction,
  SodPolicy,
  NewSodPolicy,
  UpdateSodPolicy,
  SodRule,
  NewSodRule,
  SodViolation,
  NewSodViolation,
  ApprovalDocumentType,
  ApprovalInstanceStatus,
} from '../db/schema';

export interface ApprovalPolicyWithSteps extends ApprovalPolicy {
  steps: ApprovalStep[];
}

export interface ApprovalInstanceWithActions extends ApprovalInstance {
  actions: WorkflowApprovalAction[];
}

export interface SodPolicyWithRules extends SodPolicy {
  rules: SodRule[];
}

export class ApprovalWorkflowRepository extends BaseRepository {
  // ============================================================================
  // APPROVAL POLICIES
  // ============================================================================

  /**
   * Create a new approval policy
   */
  async createPolicy(data: NewApprovalPolicy): Promise<ApprovalPolicy> {
    const [result] = await this.db
      .insert(approvalPolicies)
      .values(data)
      .returning();

    return result;
  }

  /**
   * Find a policy by ID
   */
  async findPolicyById(policyId: string): Promise<ApprovalPolicy | null> {
    const [result] = await this.db
      .select()
      .from(approvalPolicies)
      .where(eq(approvalPolicies.id, policyId))
      .limit(1);

    return result || null;
  }

  /**
   * Find a policy by ID with its steps
   */
  async findPolicyWithSteps(policyId: string): Promise<ApprovalPolicyWithSteps | null> {
    const policy = await this.findPolicyById(policyId);
    if (!policy) return null;

    const steps = await this.db
      .select()
      .from(approvalSteps)
      .where(eq(approvalSteps.policyId, policyId))
      .orderBy(asc(approvalSteps.stepNumber));

    return { ...policy, steps };
  }

  /**
   * Find policies by organization and document type
   */
  async findPoliciesByDocumentType(
    organizationId: string,
    documentType: ApprovalDocumentType
  ): Promise<ApprovalPolicy[]> {
    return await this.db
      .select()
      .from(approvalPolicies)
      .where(
        and(
          eq(approvalPolicies.organizationId, organizationId),
          eq(approvalPolicies.documentType, documentType),
          eq(approvalPolicies.isActive, true)
        )
      )
      .orderBy(asc(approvalPolicies.priority));
  }

  /**
   * Find the default policy for a document type
   */
  async findDefaultPolicy(
    organizationId: string,
    documentType: ApprovalDocumentType
  ): Promise<ApprovalPolicyWithSteps | null> {
    const [policy] = await this.db
      .select()
      .from(approvalPolicies)
      .where(
        and(
          eq(approvalPolicies.organizationId, organizationId),
          eq(approvalPolicies.documentType, documentType),
          eq(approvalPolicies.isActive, true),
          eq(approvalPolicies.isDefault, true)
        )
      )
      .limit(1);

    if (!policy) return null;

    const steps = await this.db
      .select()
      .from(approvalSteps)
      .where(eq(approvalSteps.policyId, policy.id))
      .orderBy(asc(approvalSteps.stepNumber));

    return { ...policy, steps };
  }

  /**
   * Find all policies for an organization
   */
  async findAllPolicies(organizationId: string): Promise<ApprovalPolicy[]> {
    return await this.db
      .select()
      .from(approvalPolicies)
      .where(eq(approvalPolicies.organizationId, organizationId))
      .orderBy(asc(approvalPolicies.documentType), asc(approvalPolicies.priority));
  }

  /**
   * Update a policy
   */
  async updatePolicy(
    policyId: string,
    data: UpdateApprovalPolicy
  ): Promise<ApprovalPolicy | null> {
    const [result] = await this.db
      .update(approvalPolicies)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(approvalPolicies.id, policyId))
      .returning();

    return result || null;
  }

  /**
   * Delete a policy (cascade deletes steps)
   */
  async deletePolicy(policyId: string): Promise<boolean> {
    const result = await this.db
      .delete(approvalPolicies)
      .where(eq(approvalPolicies.id, policyId));

    return result.rowCount !== null && result.rowCount > 0;
  }

  // ============================================================================
  // APPROVAL STEPS
  // ============================================================================

  /**
   * Create approval steps for a policy
   */
  async createSteps(steps: NewApprovalStep[]): Promise<ApprovalStep[]> {
    if (steps.length === 0) return [];

    return await this.db
      .insert(approvalSteps)
      .values(steps)
      .returning();
  }

  /**
   * Find steps for a policy
   */
  async findStepsByPolicyId(policyId: string): Promise<ApprovalStep[]> {
    return await this.db
      .select()
      .from(approvalSteps)
      .where(eq(approvalSteps.policyId, policyId))
      .orderBy(asc(approvalSteps.stepNumber));
  }

  /**
   * Delete all steps for a policy
   */
  async deleteStepsByPolicyId(policyId: string): Promise<void> {
    await this.db
      .delete(approvalSteps)
      .where(eq(approvalSteps.policyId, policyId));
  }

  // ============================================================================
  // APPROVAL INSTANCES
  // ============================================================================

  /**
   * Create a new approval instance
   */
  async createInstance(data: NewApprovalInstance): Promise<ApprovalInstance> {
    const [result] = await this.db
      .insert(approvalInstances)
      .values(data)
      .returning();

    return result;
  }

  /**
   * Find an instance by ID
   */
  async findInstanceById(instanceId: string): Promise<ApprovalInstance | null> {
    const [result] = await this.db
      .select()
      .from(approvalInstances)
      .where(eq(approvalInstances.id, instanceId))
      .limit(1);

    return result || null;
  }

  /**
   * Find an instance by document
   */
  async findInstanceByDocument(
    documentType: ApprovalDocumentType,
    documentId: string
  ): Promise<ApprovalInstance | null> {
    const [result] = await this.db
      .select()
      .from(approvalInstances)
      .where(
        and(
          eq(approvalInstances.documentType, documentType),
          eq(approvalInstances.documentId, documentId)
        )
      )
      .limit(1);

    return result || null;
  }

  /**
   * Find an instance with its actions
   */
  async findInstanceWithActions(instanceId: string): Promise<ApprovalInstanceWithActions | null> {
    const instance = await this.findInstanceById(instanceId);
    if (!instance) return null;

    const actions = await this.db
      .select()
      .from(approvalActions)
      .where(eq(approvalActions.approvalInstanceId, instanceId))
      .orderBy(asc(approvalActions.actionAt));

    return { ...instance, actions };
  }

  /**
   * Find pending instances for a user (as potential approver)
   */
  async findPendingInstancesForApprover(
    organizationId: string,
    approverUserId: string,
    approverRoleIds: string[]
  ): Promise<ApprovalInstance[]> {
    // This is a simplified query - in production, you'd want to match
    // against the policy steps to find which instances the user can approve
    return await this.db
      .select()
      .from(approvalInstances)
      .where(
        and(
          eq(approvalInstances.organizationId, organizationId),
          inArray(approvalInstances.status, ['pending', 'in_progress'])
        )
      )
      .orderBy(asc(approvalInstances.submittedAt));
  }

  /**
   * Find instances by status
   */
  async findInstancesByStatus(
    organizationId: string,
    status: ApprovalInstanceStatus
  ): Promise<ApprovalInstance[]> {
    return await this.db
      .select()
      .from(approvalInstances)
      .where(
        and(
          eq(approvalInstances.organizationId, organizationId),
          eq(approvalInstances.status, status)
        )
      )
      .orderBy(desc(approvalInstances.submittedAt));
  }

  /**
   * Update an instance
   */
  async updateInstance(
    instanceId: string,
    data: UpdateApprovalInstance
  ): Promise<ApprovalInstance | null> {
    const [result] = await this.db
      .update(approvalInstances)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(approvalInstances.id, instanceId))
      .returning();

    return result || null;
  }

  // ============================================================================
  // APPROVAL ACTIONS
  // ============================================================================

  /**
   * Create an approval action
   */
  async createAction(data: NewWorkflowApprovalAction): Promise<WorkflowApprovalAction> {
    const [result] = await this.db
      .insert(approvalActions)
      .values(data)
      .returning();

    return result;
  }

  /**
   * Find actions for an instance
   */
  async findActionsByInstanceId(instanceId: string): Promise<WorkflowApprovalAction[]> {
    return await this.db
      .select()
      .from(approvalActions)
      .where(eq(approvalActions.approvalInstanceId, instanceId))
      .orderBy(asc(approvalActions.actionAt));
  }

  /**
   * Find actions by user
   */
  async findActionsByUser(
    organizationId: string,
    userId: string,
    limit = 50
  ): Promise<WorkflowApprovalAction[]> {
    // Join with instances to filter by org
    const results = await this.db
      .select({
        action: approvalActions,
      })
      .from(approvalActions)
      .innerJoin(
        approvalInstances,
        eq(approvalActions.approvalInstanceId, approvalInstances.id)
      )
      .where(
        and(
          eq(approvalInstances.organizationId, organizationId),
          eq(approvalActions.actionBy, userId)
        )
      )
      .orderBy(desc(approvalActions.actionAt))
      .limit(limit);

    return results.map((r) => r.action);
  }

  // ============================================================================
  // SEGREGATION OF DUTIES POLICIES
  // ============================================================================

  /**
   * Create a SoD policy
   */
  async createSodPolicy(data: NewSodPolicy): Promise<SodPolicy> {
    const [result] = await this.db
      .insert(sodPolicies)
      .values(data)
      .returning();

    return result;
  }

  /**
   * Find a SoD policy by ID
   */
  async findSodPolicyById(policyId: string): Promise<SodPolicy | null> {
    const [result] = await this.db
      .select()
      .from(sodPolicies)
      .where(eq(sodPolicies.id, policyId))
      .limit(1);

    return result || null;
  }

  /**
   * Find a SoD policy with its rules
   */
  async findSodPolicyWithRules(policyId: string): Promise<SodPolicyWithRules | null> {
    const policy = await this.findSodPolicyById(policyId);
    if (!policy) return null;

    const rules = await this.db
      .select()
      .from(sodRules)
      .where(eq(sodRules.policyId, policyId))
      .orderBy(asc(sodRules.ruleName));

    return { ...policy, rules };
  }

  /**
   * Find all active SoD policies for an organization
   */
  async findActiveSodPolicies(organizationId: string): Promise<SodPolicyWithRules[]> {
    const policies = await this.db
      .select()
      .from(sodPolicies)
      .where(
        and(
          eq(sodPolicies.organizationId, organizationId),
          eq(sodPolicies.isActive, true)
        )
      )
      .orderBy(asc(sodPolicies.policyName));

    // Get rules for all policies
    const policyIds = policies.map((p) => p.id);
    if (policyIds.length === 0) return [];

    const allRules = await this.db
      .select()
      .from(sodRules)
      .where(
        and(
          inArray(sodRules.policyId, policyIds),
          eq(sodRules.isActive, true)
        )
      );

    // Group rules by policy
    const rulesByPolicy = new Map<string, SodRule[]>();
    for (const rule of allRules) {
      const existing = rulesByPolicy.get(rule.policyId) || [];
      existing.push(rule);
      rulesByPolicy.set(rule.policyId, existing);
    }

    return policies.map((policy) => ({
      ...policy,
      rules: rulesByPolicy.get(policy.id) || [],
    }));
  }

  /**
   * Update a SoD policy
   */
  async updateSodPolicy(
    policyId: string,
    data: UpdateSodPolicy
  ): Promise<SodPolicy | null> {
    const [result] = await this.db
      .update(sodPolicies)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(sodPolicies.id, policyId))
      .returning();

    return result || null;
  }

  /**
   * Delete a SoD policy
   */
  async deleteSodPolicy(policyId: string): Promise<boolean> {
    const result = await this.db
      .delete(sodPolicies)
      .where(eq(sodPolicies.id, policyId));

    return result.rowCount !== null && result.rowCount > 0;
  }

  // ============================================================================
  // SEGREGATION OF DUTIES RULES
  // ============================================================================

  /**
   * Create a SoD rule
   */
  async createSodRule(data: NewSodRule): Promise<SodRule> {
    const [result] = await this.db
      .insert(sodRules)
      .values(data)
      .returning();

    return result;
  }

  /**
   * Create multiple SoD rules
   */
  async createSodRules(rules: NewSodRule[]): Promise<SodRule[]> {
    if (rules.length === 0) return [];

    return await this.db
      .insert(sodRules)
      .values(rules)
      .returning();
  }

  /**
   * Find SoD rules for a document type
   */
  async findSodRulesForDocument(
    organizationId: string,
    documentType: ApprovalDocumentType
  ): Promise<SodRule[]> {
    // Get active policies
    const policies = await this.db
      .select({ id: sodPolicies.id })
      .from(sodPolicies)
      .where(
        and(
          eq(sodPolicies.organizationId, organizationId),
          eq(sodPolicies.isActive, true)
        )
      );

    if (policies.length === 0) return [];

    const policyIds = policies.map((p) => p.id);

    return await this.db
      .select()
      .from(sodRules)
      .where(
        and(
          inArray(sodRules.policyId, policyIds),
          eq(sodRules.isActive, true),
          eq(sodRules.documentType, documentType)
        )
      );
  }

  /**
   * Delete SoD rules by policy ID
   */
  async deleteSodRulesByPolicyId(policyId: string): Promise<void> {
    await this.db
      .delete(sodRules)
      .where(eq(sodRules.policyId, policyId));
  }

  // ============================================================================
  // SOD VIOLATIONS
  // ============================================================================

  /**
   * Create a SoD violation record
   */
  async createViolation(data: NewSodViolation): Promise<SodViolation> {
    const [result] = await this.db
      .insert(sodViolations)
      .values(data)
      .returning();

    return result;
  }

  /**
   * Find violations for a document
   */
  async findViolationsByDocument(
    documentType: ApprovalDocumentType,
    documentId: string
  ): Promise<SodViolation[]> {
    return await this.db
      .select()
      .from(sodViolations)
      .where(
        and(
          eq(sodViolations.documentType, documentType),
          eq(sodViolations.documentId, documentId)
        )
      )
      .orderBy(desc(sodViolations.attemptedAt));
  }

  /**
   * Find violations by user
   */
  async findViolationsByUser(
    organizationId: string,
    userId: string,
    limit = 50
  ): Promise<SodViolation[]> {
    return await this.db
      .select()
      .from(sodViolations)
      .where(
        and(
          eq(sodViolations.organizationId, organizationId),
          eq(sodViolations.attemptedBy, userId)
        )
      )
      .orderBy(desc(sodViolations.attemptedAt))
      .limit(limit);
  }

  /**
   * Find recent violations for an organization
   */
  async findRecentViolations(
    organizationId: string,
    limit = 100
  ): Promise<SodViolation[]> {
    return await this.db
      .select()
      .from(sodViolations)
      .where(eq(sodViolations.organizationId, organizationId))
      .orderBy(desc(sodViolations.attemptedAt))
      .limit(limit);
  }

  /**
   * Count violations by severity for an organization
   */
  async countViolationsBySeverity(
    organizationId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{ severity: string; count: number }[]> {
    let query = this.db
      .select({
        severity: sodViolations.severity,
        count: sql<number>`count(*)::int`,
      })
      .from(sodViolations)
      .where(eq(sodViolations.organizationId, organizationId));

    // Note: Date filtering would need to be added with and() conditions
    // This is a simplified version

    const results = await query.groupBy(sodViolations.severity);

    return results;
  }
}

// Export singleton-like factory function
export function createApprovalWorkflowRepository(db: ReturnType<typeof BaseRepository.prototype['getDb']>) {
  return new ApprovalWorkflowRepository(db);
}
