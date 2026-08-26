import { and, asc, desc, eq, gte, isNull, lte, or } from 'drizzle-orm';
import type { ContextualDatabase } from '../context';
import {
  projectBillingRates,
  projectBillingRules,
  projectContractBillingMilestones,
  projectContractLines,
  projectContractVersions,
  projectContracts,
  projectProgressCertifications,
  type NewProjectBillingRate,
  type NewProjectBillingRule,
  type NewProjectContract,
  type NewProjectContractBillingMilestone,
  type NewProjectContractLine,
  type NewProjectContractVersion,
  type NewProjectProgressCertification,
} from '../db/schema/project-contracts';
import { BaseRepository } from './base-repository';
import {
  selectEffectiveBillingRate,
  type BillingRateResolutionContext,
} from './project-billing-rate-resolution';

export { selectEffectiveBillingRate } from './project-billing-rate-resolution';
export type { BillingRateResolutionContext } from './project-billing-rate-resolution';

export class ProjectContractRepository extends BaseRepository {
  constructor(db?: ContextualDatabase) {
    super(db);
  }

  async createContract(data: NewProjectContract) {
    const [created] = await this.db.insert(projectContracts).values(data).returning();
    return created;
  }

  async findContractById(id: string, organizationId: string) {
    const [contract] = await this.db
      .select()
      .from(projectContracts)
      .where(and(eq(projectContracts.id, id), eq(projectContracts.organizationId, organizationId)))
      .limit(1);
    return contract ?? null;
  }

  async createVersion(data: NewProjectContractVersion) {
    const [created] = await this.db.insert(projectContractVersions).values(data).returning();
    return created;
  }

  async findVersionById(id: string, organizationId: string) {
    const [version] = await this.db
      .select()
      .from(projectContractVersions)
      .where(
        and(
          eq(projectContractVersions.id, id),
          eq(projectContractVersions.organizationId, organizationId),
        ),
      )
      .limit(1);
    return version ?? null;
  }

  async createContractLine(data: NewProjectContractLine) {
    const [created] = await this.db.insert(projectContractLines).values(data).returning();
    return created;
  }

  async createBillingRule(data: NewProjectBillingRule) {
    const [created] = await this.db.insert(projectBillingRules).values(data).returning();
    return created;
  }

  async findBillingRuleById(id: string, organizationId: string) {
    const [rule] = await this.db
      .select()
      .from(projectBillingRules)
      .where(
        and(eq(projectBillingRules.id, id), eq(projectBillingRules.organizationId, organizationId)),
      )
      .limit(1);
    return rule ?? null;
  }

  async listBillingRules(projectContractVersionId: string, organizationId: string) {
    return this.db
      .select()
      .from(projectBillingRules)
      .where(
        and(
          eq(projectBillingRules.projectContractVersionId, projectContractVersionId),
          eq(projectBillingRules.organizationId, organizationId),
        ),
      )
      .orderBy(asc(projectBillingRules.priority), asc(projectBillingRules.createdAt));
  }

  async createBillingRate(data: NewProjectBillingRate) {
    const [created] = await this.db.insert(projectBillingRates).values(data).returning();
    return created;
  }

  async listEffectiveRateCandidates(
    billingRuleId: string,
    organizationId: string,
    serviceDate: string,
  ) {
    return this.db
      .select()
      .from(projectBillingRates)
      .where(
        and(
          eq(projectBillingRates.billingRuleId, billingRuleId),
          eq(projectBillingRates.organizationId, organizationId),
          lte(projectBillingRates.effectiveStartDate, serviceDate),
          or(
            isNull(projectBillingRates.effectiveEndDate),
            gte(projectBillingRates.effectiveEndDate, serviceDate),
          ),
        ),
      )
      .orderBy(desc(projectBillingRates.effectiveStartDate), desc(projectBillingRates.priority));
  }

  async resolveEffectiveRate(
    billingRuleId: string,
    organizationId: string,
    context: BillingRateResolutionContext,
  ) {
    const candidates = await this.listEffectiveRateCandidates(
      billingRuleId,
      organizationId,
      context.serviceDate,
    );
    return selectEffectiveBillingRate(candidates, context);
  }

  async createBillingMilestone(data: NewProjectContractBillingMilestone) {
    const [created] = await this.db
      .insert(projectContractBillingMilestones)
      .values(data)
      .returning();
    return created;
  }

  async findBillingMilestoneById(id: string, organizationId: string) {
    const [milestone] = await this.db
      .select()
      .from(projectContractBillingMilestones)
      .where(
        and(
          eq(projectContractBillingMilestones.id, id),
          eq(projectContractBillingMilestones.organizationId, organizationId),
        ),
      )
      .limit(1);
    return milestone ?? null;
  }

  async listBillingMilestones(billingRuleId: string, organizationId: string) {
    return this.db
      .select()
      .from(projectContractBillingMilestones)
      .where(
        and(
          eq(projectContractBillingMilestones.billingRuleId, billingRuleId),
          eq(projectContractBillingMilestones.organizationId, organizationId),
        ),
      )
      .orderBy(asc(projectContractBillingMilestones.sequenceNumber));
  }

  async approveBillingMilestone(id: string, organizationId: string, approvedBy: string) {
    const [updated] = await this.db
      .update(projectContractBillingMilestones)
      .set({
        status: 'approved',
        approvedBy,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(projectContractBillingMilestones.id, id),
          eq(projectContractBillingMilestones.organizationId, organizationId),
          eq(projectContractBillingMilestones.status, 'achieved'),
        ),
      )
      .returning();
    return updated ?? null;
  }

  async markBillingMilestoneAchieved(id: string, organizationId: string, achievedBy: string) {
    const [updated] = await this.db
      .update(projectContractBillingMilestones)
      .set({
        status: 'achieved',
        achievedBy,
        achievedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(projectContractBillingMilestones.id, id),
          eq(projectContractBillingMilestones.organizationId, organizationId),
          eq(projectContractBillingMilestones.status, 'pending'),
        ),
      )
      .returning();
    return updated ?? null;
  }

  async createProgressCertification(data: NewProjectProgressCertification) {
    const [created] = await this.db
      .insert(projectProgressCertifications)
      .values(data)
      .returning();
    return created;
  }

  async findLatestProgressCertification(billingRuleId: string, organizationId: string) {
    const [certification] = await this.db
      .select()
      .from(projectProgressCertifications)
      .where(
        and(
          eq(projectProgressCertifications.billingRuleId, billingRuleId),
          eq(projectProgressCertifications.organizationId, organizationId),
        ),
      )
      .orderBy(
        desc(projectProgressCertifications.certificationDate),
        desc(projectProgressCertifications.versionNumber),
      )
      .limit(1);
    return certification ?? null;
  }

  async approveProgressCertification(id: string, organizationId: string, approvedBy: string) {
    const [updated] = await this.db
      .update(projectProgressCertifications)
      .set({
        status: 'approved',
        approvedBy,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(projectProgressCertifications.id, id),
          eq(projectProgressCertifications.organizationId, organizationId),
          eq(projectProgressCertifications.status, 'submitted'),
        ),
      )
      .returning();
    return updated ?? null;
  }
}
