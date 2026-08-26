import { alias } from "drizzle-orm/pg-core";
import { and, asc, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import type { ContextualDatabase } from "../context";
import { accounts } from "../db/schema/accounts";
import { accountingPeriods } from "../db/schema/accounting-periods";
import { contractSspAllocations } from "../db/schema/contract-ssp-allocations";
import { glAccountMappings } from "../db/schema/gl-account-mappings";
import {
  glTransactionLines,
  glTransactions,
} from "../db/schema/gl-transactions";
import { invoiceSourceAllocations } from "../db/schema/invoice-source-allocations";
import { invoices } from "../db/schema/invoices";
import { items } from "../db/schema/items";
import { performanceObligations } from "../db/schema/performance-obligations";
import {
  projectContractModificationSchedules,
  projectContractModifications,
  type ProjectContractModification,
} from "../db/schema/project-revenue-adjustments";
import {
  projectContractLines,
  projectContracts,
  projectContractVersions,
} from "../db/schema/project-contracts";
import { revenueSchedules } from "../db/schema/revenue-schedules";
import type {
  PersistProjectRevenuePlanInput,
  ProjectRevenuePlanSource,
} from "./project-revenue-plan-repository";
import { BaseRepository } from "./base-repository";

export class ProjectContractModificationRepositoryError extends Error {
  constructor(
    public readonly code:
      | "PROJECT_MODIFICATION_IDEMPOTENCY_CONFLICT"
      | "PROJECT_MODIFICATION_NOT_ELIGIBLE"
      | "PROJECT_MODIFICATION_SEPARATE_CONTRACT_REQUIRED"
      | "PROJECT_MODIFICATION_CONCURRENT_CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "ProjectContractModificationRepositoryError";
  }
}

export interface ProjectContractModificationSource {
  projectContractId: string;
  priorVersionId: string;
  revisedVersionId: string;
  priorAllocatedAmount: string;
  priorRecognizedAmount: string;
  priorBilledAmount: string;
  exchangeRate: string;
  revisedPlanSource: ProjectRevenuePlanSource;
}

export interface ApplyProjectContractModificationInput {
  organizationId: string;
  projectContractId: string;
  priorVersionId: string;
  revisedVersionId: string;
  method: "prospective" | "cumulative_catch_up" | "separate_contract";
  effectiveDate: string;
  priorAllocatedAmount: string;
  revisedAllocatedAmount: string;
  priorRecognizedAmount: string;
  progressPercentage?: string;
  revisedCumulativeRevenue: string;
  catchUpAdjustment: string;
  remainingAllocation: string;
  reason: string;
  idempotencyKey: string;
  requestHash: string;
  appliedBy: string;
  revisedPlan: PersistProjectRevenuePlanInput;
  catchUpPosting?: {
    lines: Array<{
      accountRole: "contract_asset" | "contract_liability" | "revenue";
      debitAmount: string;
      creditAmount: string;
      baseDebitAmount: string;
      baseCreditAmount: string;
    }>;
    totalBaseAmount: string;
  };
}

export interface ProjectContractModificationReceipt {
  modification: ProjectContractModification;
  supersededScheduleIds: string[];
  replayed: boolean;
}

export class ProjectContractModificationRepository extends BaseRepository {
  constructor(db?: ContextualDatabase) {
    super(db);
  }

  async findReceipt(
    organizationId: string,
    idempotencyKey: string,
  ): Promise<ProjectContractModificationReceipt | null> {
    const [modification] = await this.db
      .select()
      .from(projectContractModifications)
      .where(
        and(
          eq(projectContractModifications.organizationId, organizationId),
          eq(projectContractModifications.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);
    if (!modification) return null;
    const schedules = await this.db
      .select({ id: projectContractModificationSchedules.supersededScheduleId })
      .from(projectContractModificationSchedules)
      .where(
        eq(
          projectContractModificationSchedules.modificationId,
          modification.id,
        ),
      );
    return {
      modification,
      supersededScheduleIds: schedules.map((row) => row.id),
      replayed: true,
    };
  }

  async findSource(
    organizationId: string,
    priorVersionId: string,
    revisedVersionId: string,
  ): Promise<ProjectContractModificationSource | null> {
    const prior = alias(
      projectContractVersions,
      "prior_project_contract_version",
    );
    const revised = alias(
      projectContractVersions,
      "revised_project_contract_version",
    );
    const [header] = await this.db
      .select({
        projectContractId: projectContracts.id,
        priorVersionId: prior.id,
        revisedVersionId: revised.id,
        transactionPrice: revised.transactionPrice,
        variableConsideration: revised.variableConsideration,
        currencyCode: projectContracts.transactionCurrencyCode,
        exchangeRate: projectContracts.exchangeRate,
        contractStartDate: projectContracts.startDate,
        contractEndDate: projectContracts.endDate,
      })
      .from(projectContracts)
      .innerJoin(prior, eq(prior.id, priorVersionId))
      .innerJoin(revised, eq(revised.id, revisedVersionId))
      .where(
        and(
          eq(projectContracts.organizationId, organizationId),
          eq(projectContracts.currentVersionId, priorVersionId),
          eq(projectContracts.status, "active"),
          eq(prior.organizationId, organizationId),
          eq(prior.projectContractId, projectContracts.id),
          eq(prior.status, "approved"),
          eq(revised.organizationId, organizationId),
          eq(revised.projectContractId, projectContracts.id),
          eq(revised.status, "draft"),
          eq(revised.supersedesVersionId, priorVersionId),
        ),
      )
      .limit(1);
    if (!header) return null;

    const [allocationTotal] = await this.db
      .select({
        allocated: sql<string>`COALESCE(SUM(${performanceObligations.allocatedAmount}), 0)`,
      })
      .from(performanceObligations)
      .where(
        and(
          eq(performanceObligations.organizationId, organizationId),
          eq(performanceObligations.projectContractVersionId, priorVersionId),
        ),
      );
    const [recognizedTotal] = await this.db
      .select({
        recognized: sql<string>`COALESCE(SUM(${revenueSchedules.recognizedAmount}), 0)`,
      })
      .from(revenueSchedules)
      .where(
        and(
          eq(revenueSchedules.organizationId, organizationId),
          eq(revenueSchedules.projectContractVersionId, priorVersionId),
        ),
      );
    const [billedTotal] = await this.db
      .select({
        billed: sql<string>`COALESCE(SUM(${invoiceSourceAllocations.sourceAmountMinor}), 0)::numeric / 100`,
      })
      .from(invoiceSourceAllocations)
      .innerJoin(invoices, eq(invoices.id, invoiceSourceAllocations.invoiceId))
      .where(
        and(
          eq(invoiceSourceAllocations.organizationId, organizationId),
          eq(
            invoiceSourceAllocations.projectContractId,
            header.projectContractId,
          ),
          eq(invoiceSourceAllocations.allocationStatus, "active"),
          inArray(invoices.status, ["sent", "paid", "partial", "overdue"]),
        ),
      );
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
          eq(projectContractLines.projectContractVersionId, revisedVersionId),
        ),
      )
      .orderBy(asc(projectContractLines.lineNumber));

    return {
      projectContractId: header.projectContractId,
      priorVersionId,
      revisedVersionId,
      priorAllocatedAmount: allocationTotal?.allocated ?? "0",
      priorRecognizedAmount: recognizedTotal?.recognized ?? "0",
      priorBilledAmount: billedTotal?.billed ?? "0",
      exchangeRate: header.exchangeRate,
      revisedPlanSource: {
        ...header,
        projectContractVersionId: revisedVersionId,
        lines,
      },
    };
  }

  async apply(
    input: ApplyProjectContractModificationInput,
  ): Promise<ProjectContractModificationReceipt> {
    if (input.method === "separate_contract") {
      throw new ProjectContractModificationRepositoryError(
        "PROJECT_MODIFICATION_SEPARATE_CONTRACT_REQUIRED",
        "A separate-contract modification must be created as a new project contract",
      );
    }
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${input.organizationId}:${input.idempotencyKey}:project-contract-modification`}, 0))`,
      );
      const [existing] = await tx
        .select()
        .from(projectContractModifications)
        .where(
          and(
            eq(
              projectContractModifications.organizationId,
              input.organizationId,
            ),
            eq(
              projectContractModifications.idempotencyKey,
              input.idempotencyKey,
            ),
          ),
        )
        .limit(1);
      if (existing) {
        if (existing.requestHash !== input.requestHash) {
          throw new ProjectContractModificationRepositoryError(
            "PROJECT_MODIFICATION_IDEMPOTENCY_CONFLICT",
            "Idempotency key was already used for a different project-contract modification",
          );
        }
        const schedules = await tx
          .select({
            id: projectContractModificationSchedules.supersededScheduleId,
          })
          .from(projectContractModificationSchedules)
          .where(
            eq(
              projectContractModificationSchedules.modificationId,
              existing.id,
            ),
          );
        return {
          modification: existing,
          supersededScheduleIds: schedules.map((row) => row.id),
          replayed: true,
        };
      }

      const [contract] = await tx
        .select({
          id: projectContracts.id,
          currentVersionId: projectContracts.currentVersionId,
          subsidiaryId: projectContracts.subsidiaryId,
          projectId: projectContracts.projectId,
          customerId: projectContracts.customerId,
          currencyCode: projectContracts.transactionCurrencyCode,
          functionalCurrencyCode: projectContracts.functionalCurrencyCode,
          exchangeRate: projectContracts.exchangeRate,
        })
        .from(projectContracts)
        .where(
          and(
            eq(projectContracts.id, input.projectContractId),
            eq(projectContracts.organizationId, input.organizationId),
            eq(projectContracts.currentVersionId, input.priorVersionId),
            eq(projectContracts.status, "active"),
          ),
        )
        .limit(1)
        .for("update");
      const versions = await tx
        .select({
          id: projectContractVersions.id,
          status: projectContractVersions.status,
          supersedesVersionId: projectContractVersions.supersedesVersionId,
        })
        .from(projectContractVersions)
        .where(
          and(
            eq(projectContractVersions.organizationId, input.organizationId),
            eq(
              projectContractVersions.projectContractId,
              input.projectContractId,
            ),
            inArray(projectContractVersions.id, [
              input.priorVersionId,
              input.revisedVersionId,
            ]),
          ),
        )
        .for("update");
      const prior = versions.find(
        (version) => version.id === input.priorVersionId,
      );
      const revised = versions.find(
        (version) => version.id === input.revisedVersionId,
      );
      if (
        !contract ||
        prior?.status !== "approved" ||
        revised?.status !== "draft" ||
        revised.supersedesVersionId !== prior.id
      ) {
        throw new ProjectContractModificationRepositoryError(
          "PROJECT_MODIFICATION_NOT_ELIGIBLE",
          "The current approved version and its draft replacement are required",
        );
      }

      const futureSchedules = await tx
        .select({ id: revenueSchedules.id })
        .from(revenueSchedules)
        .where(
          and(
            eq(revenueSchedules.organizationId, input.organizationId),
            eq(revenueSchedules.projectContractVersionId, input.priorVersionId),
            gte(revenueSchedules.scheduleDate, input.effectiveDate),
            or(
              eq(revenueSchedules.status, "scheduled"),
              eq(revenueSchedules.status, "deferred"),
            ),
          ),
        )
        .for("update");

      const [modification] = await tx
        .insert(projectContractModifications)
        .values({
          organizationId: input.organizationId,
          projectContractId: input.projectContractId,
          priorVersionId: input.priorVersionId,
          revisedVersionId: input.revisedVersionId,
          method: input.method,
          effectiveDate: input.effectiveDate,
          priorAllocatedAmount: input.priorAllocatedAmount,
          revisedAllocatedAmount: input.revisedAllocatedAmount,
          priorRecognizedAmount: input.priorRecognizedAmount,
          progressPercentage: input.progressPercentage,
          revisedCumulativeRevenue: input.revisedCumulativeRevenue,
          catchUpAdjustment: input.catchUpAdjustment,
          remainingAllocation: input.remainingAllocation,
          reason: input.reason,
          idempotencyKey: input.idempotencyKey,
          requestHash: input.requestHash,
          appliedBy: input.appliedBy,
        })
        .returning();

      if (futureSchedules.length) {
        await tx.insert(projectContractModificationSchedules).values(
          futureSchedules.map((schedule) => ({
            organizationId: input.organizationId,
            modificationId: modification.id,
            supersededScheduleId: schedule.id,
          })),
        );
        const updated = await tx
          .update(revenueSchedules)
          .set({
            status: "superseded",
            supersededAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(revenueSchedules.organizationId, input.organizationId),
              inArray(
                revenueSchedules.id,
                futureSchedules.map((schedule) => schedule.id),
              ),
              or(
                eq(revenueSchedules.status, "scheduled"),
                eq(revenueSchedules.status, "deferred"),
              ),
            ),
          )
          .returning({ id: revenueSchedules.id });
        if (updated.length !== futureSchedules.length) {
          throw new ProjectContractModificationRepositoryError(
            "PROJECT_MODIFICATION_CONCURRENT_CONFLICT",
            "A future schedule changed while the modification was being applied",
          );
        }
      }

      await tx
        .update(projectContractVersions)
        .set({ status: "superseded", updatedAt: new Date() })
        .where(eq(projectContractVersions.id, input.priorVersionId));
      await tx
        .update(projectContractVersions)
        .set({
          status: "approved",
          approvedBy: input.appliedBy,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(projectContractVersions.id, input.revisedVersionId));
      await tx
        .update(projectContracts)
        .set({
          currentVersionId: input.revisedVersionId,
          updatedAt: new Date(),
        })
        .where(eq(projectContracts.id, input.projectContractId));

      let catchUpGlTransactionId: string | null = null;
      if (input.catchUpPosting) {
        const [period] = await tx
          .select({ id: accountingPeriods.id })
          .from(accountingPeriods)
          .where(
            and(
              eq(accountingPeriods.organizationId, input.organizationId),
              eq(accountingPeriods.subsidiaryId, contract.subsidiaryId),
              eq(accountingPeriods.status, "OPEN"),
              sql`${accountingPeriods.startDate} <= ${input.effectiveDate}`,
              sql`${accountingPeriods.endDate} >= ${input.effectiveDate}`,
            ),
          )
          .limit(1)
          .for("update");
        if (!period) {
          throw new ProjectContractModificationRepositoryError(
            "PROJECT_MODIFICATION_NOT_ELIGIBLE",
            "A non-zero catch-up adjustment requires an OPEN effective-date accounting period",
          );
        }
        const candidates = await tx
          .select({
            accountRole: glAccountMappings.accountType,
            accountId: accounts.id,
            subsidiaryId: glAccountMappings.subsidiaryId,
            itemId: glAccountMappings.itemId,
          })
          .from(glAccountMappings)
          .innerJoin(
            accounts,
            and(
              eq(accounts.organizationId, input.organizationId),
              eq(accounts.accountNumber, glAccountMappings.glAccountCode),
              eq(accounts.isActive, true),
            ),
          )
          .where(
            and(
              eq(glAccountMappings.organizationId, input.organizationId),
              eq(glAccountMappings.transactionType, "recognition"),
              eq(glAccountMappings.isActive, true),
              inArray(glAccountMappings.accountType, [
                "revenue",
                "contract_asset",
                "contract_liability",
              ]),
            ),
          )
          .orderBy(desc(glAccountMappings.priority), asc(glAccountMappings.id));
        const itemId = input.revisedPlan.obligations[0]?.itemId ?? null;
        const resolved = input.catchUpPosting.lines.map((line) => {
          const candidate = candidates.find(
            (row) =>
              row.accountRole === line.accountRole &&
              (!row.subsidiaryId ||
                row.subsidiaryId === contract.subsidiaryId) &&
              (!row.itemId || row.itemId === itemId),
          );
          if (!candidate) {
            throw new ProjectContractModificationRepositoryError(
              "PROJECT_MODIFICATION_NOT_ELIGIBLE",
              `An active ${line.accountRole} account mapping is required for catch-up posting`,
            );
          }
          return { ...line, accountId: candidate.accountId };
        });
        const [glTransaction] = await tx
          .insert(glTransactions)
          .values({
            organizationId: input.organizationId,
            transactionNumber: `PCM-${modification.id}`,
            subsidiaryId: contract.subsidiaryId,
            transactionDate: input.effectiveDate,
            postingDate: input.effectiveDate,
            periodId: period.id,
            transactionType: "POSTING",
            sourceSystem: "AUTO",
            sourceEventType: "project_contract_modification",
            sourceEventId: modification.id,
            idempotencyKey: input.idempotencyKey,
            description: `Project contract cumulative catch-up: ${input.reason}`,
            referenceNumber: input.projectContractId,
            baseCurrencyCode: contract.functionalCurrencyCode,
            totalDebitAmount: input.catchUpPosting.totalBaseAmount,
            totalCreditAmount: input.catchUpPosting.totalBaseAmount,
            status: "POSTED",
            autoGenerated: true,
            postedBy: input.appliedBy,
            postedDate: new Date(),
          })
          .returning();
        await tx.insert(glTransactionLines).values(
          resolved.map((line, index) => ({
            organizationId: input.organizationId,
            transactionId: glTransaction.id,
            lineNumber: index + 1,
            accountId: line.accountId,
            subsidiaryId: contract.subsidiaryId,
            debitAmount: line.debitAmount,
            creditAmount: line.creditAmount,
            currencyCode: contract.currencyCode,
            exchangeRate: contract.exchangeRate,
            baseDebitAmount: line.baseDebitAmount,
            baseCreditAmount: line.baseCreditAmount,
            description: `Project modification catch-up: ${line.accountRole}`,
            reference1: modification.id,
            projectId: contract.projectId,
            customerId: contract.customerId,
            projectContractId: input.projectContractId,
            projectContractVersionId: input.revisedVersionId,
            performanceObligationId: null,
            sourceEventType: "project_contract_modification",
            sourceEventId: modification.id,
          })),
        );
        catchUpGlTransactionId = glTransaction.id;
        await tx
          .update(projectContractModifications)
          .set({ catchUpGlTransactionId })
          .where(eq(projectContractModifications.id, modification.id));
      }

      for (const obligation of input.revisedPlan.obligations) {
        const [created] = await tx
          .insert(performanceObligations)
          .values({
            organizationId: input.organizationId,
            subscriptionId: null,
            itemId: obligation.itemId,
            projectContractId: input.projectContractId,
            projectContractVersionId: input.revisedVersionId,
            projectContractLineId: obligation.lineId,
            contractLineItemId: null,
            name: obligation.name,
            ssp: obligation.sspAmount,
            allocatedTransactionPrice: obligation.allocatedAmount,
            allocatedAmount: obligation.allocatedAmount,
            obligationType: "project_contract_line",
            satisfactionMethod: obligation.revenueTiming,
            startDate: obligation.startDate,
            endDate: obligation.endDate,
            status: "Pending",
            revenueRecognized: "0",
          })
          .returning({ id: performanceObligations.id });
        await tx.insert(contractSspAllocations).values({
          organizationId: input.organizationId,
          subscriptionId: null,
          performanceObligationId: created.id,
          projectContractId: input.projectContractId,
          projectContractVersionId: input.revisedVersionId,
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
              projectContractVersionId: input.revisedVersionId,
              scheduleDate: schedule.scheduleDate,
              periodStartDate: schedule.periodStartDate,
              periodEndDate: schedule.periodEndDate,
              scheduledAmount: schedule.scheduledAmount,
              recognizedAmount: "0",
              recognitionPattern: schedule.recognitionPattern,
              recognitionSource: "automatic" as const,
              status: schedule.status,
              scheduleVersion: 1,
            })),
          );
        }
      }
      return {
        modification: { ...modification, catchUpGlTransactionId },
        supersededScheduleIds: futureSchedules.map((row) => row.id),
        replayed: false,
      };
    });
  }
}
