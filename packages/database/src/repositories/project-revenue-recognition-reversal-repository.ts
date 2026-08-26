import { and, asc, eq, sql } from "drizzle-orm";
import type { ContextualDatabase } from "../context";
import { accountingPeriods } from "../db/schema/accounting-periods";
import {
  glTransactionLines,
  glTransactions,
} from "../db/schema/gl-transactions";
import {
  projectRevenueRecognitionReversalItems,
  projectRevenueRecognitionReversals,
  type ProjectRevenueRecognitionReversal,
  type ProjectRevenueRecognitionReversalItem,
} from "../db/schema/project-revenue-adjustments";
import {
  revenueRecognitionRunItems,
  revenueRecognitionRuns,
} from "../db/schema/revenue-recognition-runs";
import { BaseRepository } from "./base-repository";

export class ProjectRevenueRecognitionReversalError extends Error {
  constructor(
    public readonly code:
      | "PROJECT_REVENUE_REVERSAL_IDEMPOTENCY_CONFLICT"
      | "PROJECT_REVENUE_REVERSAL_PERIOD_NOT_FOUND"
      | "PROJECT_REVENUE_REVERSAL_PERIOD_CLOSED"
      | "PROJECT_REVENUE_REVERSAL_DATE_OUTSIDE_PERIOD"
      | "PROJECT_REVENUE_REVERSAL_RUN_NOT_POSTED"
      | "PROJECT_REVENUE_REVERSAL_ALREADY_EXISTS",
    message: string,
  ) {
    super(message);
    this.name = "ProjectRevenueRecognitionReversalError";
  }
}

export interface ProjectRevenueRecognitionReversalInput {
  organizationId: string;
  subsidiaryId: string;
  originalRunId: string;
  accountingPeriodId: string;
  reversalDate: string;
  reason: string;
  idempotencyKey: string;
  requestHash: string;
  approvedBy: string;
  workerActor: string;
}

export interface ProjectRevenueRecognitionReversalReceipt {
  reversal: ProjectRevenueRecognitionReversal;
  items: ProjectRevenueRecognitionReversalItem[];
  glTransaction: typeof glTransactions.$inferSelect;
  replayed: boolean;
}

export function reverseProjectRevenueGlLines<
  T extends {
    debitAmount: string;
    creditAmount: string;
    baseDebitAmount: string;
    baseCreditAmount: string;
  },
>(
  lines: T[],
): Array<
  T & {
    debitAmount: string;
    creditAmount: string;
    baseDebitAmount: string;
    baseCreditAmount: string;
  }
> {
  return lines.map((line) => ({
    ...line,
    debitAmount: line.creditAmount,
    creditAmount: line.debitAmount,
    baseDebitAmount: line.baseCreditAmount,
    baseCreditAmount: line.baseDebitAmount,
  }));
}

export class ProjectRevenueRecognitionReversalRepository extends BaseRepository {
  constructor(db?: ContextualDatabase) {
    super(db);
  }

  async execute(
    input: ProjectRevenueRecognitionReversalInput,
  ): Promise<ProjectRevenueRecognitionReversalReceipt> {
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${input.organizationId}:${input.originalRunId}:project-revenue-reversal`}, 0))`,
      );
      const [existing] = await tx
        .select()
        .from(projectRevenueRecognitionReversals)
        .where(
          and(
            eq(
              projectRevenueRecognitionReversals.organizationId,
              input.organizationId,
            ),
            eq(
              projectRevenueRecognitionReversals.idempotencyKey,
              input.idempotencyKey,
            ),
          ),
        )
        .limit(1);
      if (existing) {
        if (existing.requestHash !== input.requestHash) {
          throw new ProjectRevenueRecognitionReversalError(
            "PROJECT_REVENUE_REVERSAL_IDEMPOTENCY_CONFLICT",
            "Idempotency key was already used for a different reversal request",
          );
        }
        const items = await tx
          .select()
          .from(projectRevenueRecognitionReversalItems)
          .where(
            eq(projectRevenueRecognitionReversalItems.reversalId, existing.id),
          )
          .orderBy(
            asc(projectRevenueRecognitionReversalItems.createdAt),
            asc(projectRevenueRecognitionReversalItems.id),
          );
        const [glTransaction] = await tx
          .select()
          .from(glTransactions)
          .where(
            and(
              eq(glTransactions.organizationId, input.organizationId),
              eq(glTransactions.sourceEventType, "project_revenue_reversal"),
              eq(glTransactions.sourceEventId, existing.id),
            ),
          )
          .limit(1);
        return { reversal: existing, items, glTransaction, replayed: true };
      }

      const [duplicate] = await tx
        .select({ id: projectRevenueRecognitionReversals.id })
        .from(projectRevenueRecognitionReversals)
        .where(
          eq(
            projectRevenueRecognitionReversals.originalRunId,
            input.originalRunId,
          ),
        )
        .limit(1);
      if (duplicate) {
        throw new ProjectRevenueRecognitionReversalError(
          "PROJECT_REVENUE_REVERSAL_ALREADY_EXISTS",
          "The recognition run has already been reversed",
        );
      }
      const [period] = await tx
        .select({
          id: accountingPeriods.id,
          startDate: accountingPeriods.startDate,
          endDate: accountingPeriods.endDate,
          status: accountingPeriods.status,
        })
        .from(accountingPeriods)
        .where(
          and(
            eq(accountingPeriods.id, input.accountingPeriodId),
            eq(accountingPeriods.organizationId, input.organizationId),
            eq(accountingPeriods.subsidiaryId, input.subsidiaryId),
          ),
        )
        .limit(1)
        .for("update");
      if (!period) {
        throw new ProjectRevenueRecognitionReversalError(
          "PROJECT_REVENUE_REVERSAL_PERIOD_NOT_FOUND",
          "Reversal accounting period not found",
        );
      }
      if (period.status !== "OPEN") {
        throw new ProjectRevenueRecognitionReversalError(
          "PROJECT_REVENUE_REVERSAL_PERIOD_CLOSED",
          "Recognition reversals require an OPEN accounting period",
        );
      }
      if (
        input.reversalDate < period.startDate ||
        input.reversalDate > period.endDate
      ) {
        throw new ProjectRevenueRecognitionReversalError(
          "PROJECT_REVENUE_REVERSAL_DATE_OUTSIDE_PERIOD",
          "Reversal date must fall within the selected accounting period",
        );
      }

      const [source] = await tx
        .select({
          runId: revenueRecognitionRuns.id,
          totalRecognizedAmount: revenueRecognitionRuns.totalRecognizedAmount,
          glTransactionId: glTransactions.id,
          baseCurrencyCode: glTransactions.baseCurrencyCode,
          totalDebitAmount: glTransactions.totalDebitAmount,
          totalCreditAmount: glTransactions.totalCreditAmount,
        })
        .from(revenueRecognitionRuns)
        .innerJoin(
          glTransactions,
          and(
            eq(glTransactions.organizationId, input.organizationId),
            eq(glTransactions.sourceEventType, "project_revenue_recognition"),
            eq(glTransactions.sourceEventId, revenueRecognitionRuns.id),
            eq(glTransactions.status, "POSTED"),
          ),
        )
        .where(
          and(
            eq(revenueRecognitionRuns.id, input.originalRunId),
            eq(revenueRecognitionRuns.organizationId, input.organizationId),
            eq(revenueRecognitionRuns.subsidiaryId, input.subsidiaryId),
          ),
        )
        .limit(1)
        .for("update");
      if (!source) {
        throw new ProjectRevenueRecognitionReversalError(
          "PROJECT_REVENUE_REVERSAL_RUN_NOT_POSTED",
          "Only a posted project revenue recognition run can be reversed",
        );
      }
      const originalItems = await tx
        .select()
        .from(revenueRecognitionRunItems)
        .where(
          and(
            eq(revenueRecognitionRunItems.organizationId, input.organizationId),
            eq(
              revenueRecognitionRunItems.recognitionRunId,
              input.originalRunId,
            ),
          ),
        )
        .orderBy(
          asc(revenueRecognitionRunItems.createdAt),
          asc(revenueRecognitionRunItems.id),
        );
      const originalLines = await tx
        .select()
        .from(glTransactionLines)
        .where(
          and(
            eq(glTransactionLines.organizationId, input.organizationId),
            eq(glTransactionLines.transactionId, source.glTransactionId),
          ),
        )
        .orderBy(asc(glTransactionLines.lineNumber));

      const [reversal] = await tx
        .insert(projectRevenueRecognitionReversals)
        .values({
          organizationId: input.organizationId,
          subsidiaryId: input.subsidiaryId,
          originalRunId: input.originalRunId,
          originalGlTransactionId: source.glTransactionId,
          accountingPeriodId: input.accountingPeriodId,
          reversalDate: input.reversalDate,
          totalReversedAmount: source.totalRecognizedAmount,
          reason: input.reason,
          idempotencyKey: input.idempotencyKey,
          requestHash: input.requestHash,
          approvedBy: input.approvedBy,
          workerActor: input.workerActor,
        })
        .returning();
      const items = originalItems.length
        ? await tx
            .insert(projectRevenueRecognitionReversalItems)
            .values(
              originalItems.map((item) => ({
                organizationId: input.organizationId,
                reversalId: reversal.id,
                originalRunItemId: item.id,
                revenueScheduleId: item.revenueScheduleId,
                reversedAmount: item.recognizedAmount,
              })),
            )
            .returning()
        : [];
      const [glTransaction] = await tx
        .insert(glTransactions)
        .values({
          organizationId: input.organizationId,
          transactionNumber: `PRV-${reversal.id}`,
          subsidiaryId: input.subsidiaryId,
          transactionDate: input.reversalDate,
          postingDate: input.reversalDate,
          periodId: input.accountingPeriodId,
          transactionType: "REVERSAL",
          sourceSystem: "AUTO",
          sourceEventType: "project_revenue_reversal",
          sourceEventId: reversal.id,
          idempotencyKey: input.idempotencyKey,
          description: `Reversal of project revenue recognition run ${input.originalRunId}: ${input.reason}`,
          referenceNumber: input.originalRunId,
          baseCurrencyCode: source.baseCurrencyCode,
          totalDebitAmount: source.totalCreditAmount,
          totalCreditAmount: source.totalDebitAmount,
          status: "POSTED",
          autoGenerated: true,
          postedBy: input.approvedBy,
          postedDate: new Date(),
        })
        .returning();
      if (originalLines.length) {
        const reversedLines = reverseProjectRevenueGlLines(originalLines);
        await tx.insert(glTransactionLines).values(
          reversedLines.map((line, index) => ({
            organizationId: input.organizationId,
            transactionId: glTransaction.id,
            lineNumber: index + 1,
            accountId: line.accountId,
            classId: line.classId,
            departmentId: line.departmentId,
            locationId: line.locationId,
            subsidiaryId: line.subsidiaryId,
            debitAmount: line.debitAmount,
            creditAmount: line.creditAmount,
            currencyCode: line.currencyCode,
            exchangeRate: line.exchangeRate,
            baseDebitAmount: line.baseDebitAmount,
            baseCreditAmount: line.baseCreditAmount,
            description: `Reversal: ${line.description ?? ""}`,
            reference1: input.originalRunId,
            reference2: line.reference2,
            projectId: line.projectId,
            customerId: line.customerId,
            projectContractId: line.projectContractId,
            projectContractVersionId: line.projectContractVersionId,
            performanceObligationId: line.performanceObligationId,
            sourceEventType: "project_revenue_reversal",
            sourceEventId: reversal.id,
          })),
        );
      }
      return { reversal, items, glTransaction, replayed: false };
    });
  }
}
