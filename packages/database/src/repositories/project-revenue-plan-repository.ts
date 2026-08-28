import { and, asc, eq, sql } from 'drizzle-orm';
import type { ContextualDatabase } from '../context';
import { contractSspAllocations } from '../db/schema/contract-ssp-allocations';
import { items } from '../db/schema/items';
import { performanceObligations } from '../db/schema/performance-obligations';
import {
  projectContractLines,
  projectContractVersions,
  projectContracts,
} from '../db/schema/project-contracts';
import { revenueSchedules } from '../db/schema/revenue-schedules';
import { BaseRepository } from './base-repository';

export interface ProjectRevenuePlanSource {
  projectContractId: string;
  projectContractVersionId: string;
  transactionPrice: string;
  variableConsideration: string;
  currencyCode: string;
  contractStartDate: string;
  contractEndDate: string | null;
  lines: Array<{
    id: string;
    itemId: string | null;
    description: string;
    transactionPrice: string;
    sspAmount: string | null;
    fallbackSspAmount: string | null;
    revenueTiming: 'point_in_time' | 'over_time';
    recognitionMethod:
      | 'right_to_invoice'
      | 'cost_to_cost'
      | 'labor_hours'
      | 'units_delivered'
      | 'elapsed_time'
      | 'manual_output';
    serviceStartDate: string | null;
    serviceEndDate: string | null;
  }>;
}

export interface PersistProjectRevenuePlanInput {
  organizationId: string;
  projectContractId: string;
  projectContractVersionId: string;
  currencyCode: string;
  transactionPrice: string;
  totalSsp: string;
  totalAllocated: string;
  obligations: Array<{
    lineId: string;
    itemId: string | null;
    name: string;
    revenueTiming: 'point_in_time' | 'over_time';
    recognitionMethod: string;
    startDate: string;
    endDate: string;
    sspAmount: string;
    allocatedAmount: string;
    allocationPercentage: string;
    allocationMethod: 'proportional';
    schedules: Array<{
      scheduleDate: string;
      periodStartDate: string;
      periodEndDate: string;
      scheduledAmount: string;
      recognitionPattern: string;
      status: 'scheduled' | 'deferred';
    }>;
  }>;
}

export class ProjectRevenuePlanRepository extends BaseRepository {
  constructor(db?: ContextualDatabase) {
    super(db);
  }

  async findPlanSource(
    projectContractVersionId: string,
    organizationId: string,
  ): Promise<ProjectRevenuePlanSource | null> {
    const [header] = await this.db
      .select({
        projectContractId: projectContracts.id,
        projectContractVersionId: projectContractVersions.id,
        transactionPrice: projectContractVersions.transactionPrice,
        variableConsideration: projectContractVersions.variableConsideration,
        currencyCode: projectContracts.transactionCurrencyCode,
        contractStartDate: projectContracts.startDate,
        contractEndDate: projectContracts.endDate,
      })
      .from(projectContractVersions)
      .innerJoin(
        projectContracts,
        and(
          eq(projectContracts.id, projectContractVersions.projectContractId),
          eq(projectContracts.organizationId, organizationId),
          eq(projectContracts.currentVersionId, projectContractVersions.id),
          eq(projectContracts.status, 'active'),
        ),
      )
      .where(
        and(
          eq(projectContractVersions.id, projectContractVersionId),
          eq(projectContractVersions.organizationId, organizationId),
          eq(projectContractVersions.status, 'approved'),
        ),
      )
      .limit(1);
    if (!header) return null;

    const lines = await this.db
      .select({
        id: projectContractLines.id,
        itemId: projectContractLines.itemId,
        description: projectContractLines.description,
        transactionPrice: projectContractLines.transactionPrice,
        sspAmount: projectContractLines.sspAmount,
        fallbackSspAmount: items.defaultSspAmount,
        revenueTiming: projectContractLines.revenueTiming,
        recognitionMethod: projectContractLines.recognitionMethod,
        serviceStartDate: projectContractLines.serviceStartDate,
        serviceEndDate: projectContractLines.serviceEndDate,
      })
      .from(projectContractLines)
      .leftJoin(
        items,
        and(
          eq(items.id, projectContractLines.itemId),
          eq(items.organizationId, organizationId),
        ),
      )
      .where(
        and(
          eq(projectContractLines.organizationId, organizationId),
          eq(projectContractLines.projectContractVersionId, projectContractVersionId),
        ),
      )
      .orderBy(asc(projectContractLines.lineNumber));
    return { ...header, lines };
  }

  async findPersistedPlan(projectContractVersionId: string, organizationId: string) {
    const obligations = await this.db
      .select()
      .from(performanceObligations)
      .where(
        and(
          eq(performanceObligations.organizationId, organizationId),
          eq(performanceObligations.projectContractVersionId, projectContractVersionId),
        ),
      )
      .orderBy(asc(performanceObligations.createdAt), asc(performanceObligations.id));
    if (!obligations.length) return null;

    const allocations = await this.db
      .select()
      .from(contractSspAllocations)
      .where(
        and(
          eq(contractSspAllocations.organizationId, organizationId),
          eq(contractSspAllocations.projectContractVersionId, projectContractVersionId),
        ),
      )
      .orderBy(asc(contractSspAllocations.createdAt), asc(contractSspAllocations.id));
    const schedules = await this.db
      .select()
      .from(revenueSchedules)
      .where(
        and(
          eq(revenueSchedules.organizationId, organizationId),
          eq(revenueSchedules.projectContractVersionId, projectContractVersionId),
        ),
      )
      .orderBy(
        asc(revenueSchedules.periodStartDate),
        asc(revenueSchedules.scheduleDate),
        asc(revenueSchedules.id),
      );
    return { obligations, allocations, schedules };
  }

  async persistPlan(input: PersistProjectRevenuePlanInput) {
    return this.db.transaction(async (tx) => {
      await tx.execute(
        // Serialize generation for the same approved contract version.
        // The unique obligation lineage index remains the final duplicate defense.
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${input.organizationId}:${input.projectContractVersionId}:revenue-plan`}, 0))`,
      );
      const existing = await tx
        .select({ id: performanceObligations.id })
        .from(performanceObligations)
        .where(
          and(
            eq(performanceObligations.organizationId, input.organizationId),
            eq(performanceObligations.projectContractVersionId, input.projectContractVersionId),
          ),
        )
        .limit(1);
      if (existing.length) return { created: false };

      for (const obligation of input.obligations) {
        const [created] = await tx
          .insert(performanceObligations)
          .values({
            organizationId: input.organizationId,
            subscriptionId: null,
            itemId: obligation.itemId,
            projectContractId: input.projectContractId,
            projectContractVersionId: input.projectContractVersionId,
            projectContractLineId: obligation.lineId,
            contractLineItemId: null,
            name: obligation.name,
            ssp: obligation.sspAmount,
            allocatedTransactionPrice: obligation.allocatedAmount,
            allocatedAmount: obligation.allocatedAmount,
            obligationType: 'project_contract_line',
            satisfactionMethod: obligation.revenueTiming,
            startDate: obligation.startDate,
            endDate: obligation.endDate,
            status: 'Pending',
            revenueRecognized: '0',
          })
          .returning({ id: performanceObligations.id });

        await tx.insert(contractSspAllocations).values({
          organizationId: input.organizationId,
          subscriptionId: null,
          performanceObligationId: created.id,
          projectContractId: input.projectContractId,
          projectContractVersionId: input.projectContractVersionId,
          projectContractLineId: obligation.lineId,
          contractId: null,
          lineItemId: null,
          sspAmount: obligation.sspAmount,
          allocatedAmount: obligation.allocatedAmount,
          allocationPercentage: obligation.allocationPercentage,
          allocationMethod: obligation.allocationMethod,
          allocationDate: new Date(),
        });

        if (obligation.schedules.length) {
          await tx.insert(revenueSchedules).values(
            obligation.schedules.map((schedule) => ({
              organizationId: input.organizationId,
              performanceObligationId: created.id,
              projectContractVersionId: input.projectContractVersionId,
              scheduleDate: schedule.scheduleDate,
              periodStartDate: schedule.periodStartDate,
              periodEndDate: schedule.periodEndDate,
              scheduledAmount: schedule.scheduledAmount,
              recognizedAmount: '0',
              recognitionPattern: schedule.recognitionPattern,
              recognitionSource: 'automatic' as const,
              status: schedule.status,
              scheduleVersion: 1,
            })),
          );
        }
      }
      return { created: true };
    });
  }
}
