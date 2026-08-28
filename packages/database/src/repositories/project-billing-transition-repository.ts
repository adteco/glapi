import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { ContextualDatabase } from "../context";
import { accountingPeriods } from "../db/schema/accounting-periods";
import { entities } from "../db/schema/entities";
import {
  glTransactionLines,
  glTransactions,
} from "../db/schema/gl-transactions";
import { invoiceLineItems } from "../db/schema/invoice-line-items";
import { invoiceSourceAllocations } from "../db/schema/invoice-source-allocations";
import { invoices } from "../db/schema/invoices";
import { projectBillingRequests } from "../db/schema/project-billing-requests";
import {
  projectContractBillingMilestones,
  projectProgressCertifications,
} from "../db/schema/project-contracts";
import { projectTasks } from "../db/schema/project-tasks";
import { timeEntries } from "../db/schema/time-entries";
import { BaseRepository } from "./base-repository";

export type ProjectBillingTransitionAction =
  | "void"
  | "release"
  | "transfer"
  | "rebill";

export interface ProjectBillingTransitionInput {
  organizationId: string;
  invoiceId: string;
  action: ProjectBillingTransitionAction;
  reason: string;
  actorId: string;
  idempotencyKey: string;
  requestHash: string;
  targetInvoiceId?: string;
  invoiceDate?: string;
  dueDate?: string;
}

export interface ProjectBillingTransitionResult {
  replayed: boolean;
  action: ProjectBillingTransitionAction;
  originalInvoiceId: string;
  replacementInvoiceId: string | null;
  releasedAllocationIds: string[];
  replacementAllocationIds: string[];
}

type ProjectBillingGlLine = typeof glTransactionLines.$inferSelect;

export class ProjectBillingTransitionError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "INVALID_STATUS"
      | "NO_ACTIVE_ALLOCATIONS"
      | "TARGET_REQUIRED"
      | "INVALID_TARGET"
      | "IDEMPOTENCY_KEY_REUSED",
    message: string,
  ) {
    super(message);
    this.name = "ProjectBillingTransitionError";
  }
}

export class ProjectBillingTransitionRepository extends BaseRepository {
  constructor(db?: ContextualDatabase) {
    super(db);
  }

  async listHistory(organizationId: string, status?: "draft" | "billed") {
    const rows = await this.db
      .select({
        invoiceId: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        invoiceDate: invoices.invoiceDate,
        dueDate: invoices.dueDate,
        invoiceStatus: invoices.status,
        totalAmount: invoices.totalAmount,
        customerId: invoices.entityId,
        customerName: entities.name,
        invoiceMetadata: invoices.metadata,
        allocationId: invoiceSourceAllocations.id,
        sourceType: invoiceSourceAllocations.sourceType,
        sourceId: invoiceSourceAllocations.sourceId,
        sourceAmountMinor: invoiceSourceAllocations.sourceAmountMinor,
        currencyCode: invoiceSourceAllocations.currencyCode,
        allocationStatus: invoiceSourceAllocations.allocationStatus,
        releaseReason: invoiceSourceAllocations.releaseReason,
        releasedAt: invoiceSourceAllocations.releasedAt,
        replacedByAllocationId: invoiceSourceAllocations.replacedByAllocationId,
      })
      .from(invoices)
      .innerJoin(
        invoiceSourceAllocations,
        eq(invoiceSourceAllocations.invoiceId, invoices.id),
      )
      .innerJoin(entities, eq(entities.id, invoices.entityId))
      .where(eq(invoices.organizationId, organizationId))
      .orderBy(
        desc(invoices.createdAt),
        desc(invoiceSourceAllocations.createdAt),
      );

    const filtered = rows.filter((row) =>
      status === "draft"
        ? row.invoiceStatus === "draft"
        : status === "billed"
          ? row.invoiceStatus !== "draft"
          : true,
    );
    const grouped = new Map<
      string,
      (typeof filtered)[number] & { allocations: typeof filtered }
    >();
    for (const row of filtered) {
      const existing = grouped.get(row.invoiceId);
      if (existing) {
        existing.allocations.push(row);
      } else {
        grouped.set(row.invoiceId, { ...row, allocations: [row] });
      }
    }
    return [...grouped.values()].map(({ allocations, ...invoice }) => ({
      ...invoice,
      allocations: allocations.map((allocation) => ({
        id: allocation.allocationId,
        sourceType: allocation.sourceType,
        sourceId: allocation.sourceId,
        sourceAmountMinor: allocation.sourceAmountMinor,
        currencyCode: allocation.currencyCode.trim(),
        status: allocation.allocationStatus,
        releaseReason: allocation.releaseReason,
        releasedAt: allocation.releasedAt,
        replacedByAllocationId: allocation.replacedByAllocationId,
      })),
    }));
  }

  async transition(
    input: ProjectBillingTransitionInput,
  ): Promise<ProjectBillingTransitionResult> {
    return this.db.transaction(async (tx) => {
      const receiptKey = `transition:${input.idempotencyKey}`;
      const [receipt] = await tx
        .insert(projectBillingRequests)
        .values({
          organizationId: input.organizationId,
          idempotencyKey: receiptKey,
          requestHash: input.requestHash,
          status: "processing",
        })
        .onConflictDoNothing({
          target: [
            projectBillingRequests.organizationId,
            projectBillingRequests.idempotencyKey,
          ],
        })
        .returning();

      if (!receipt) {
        const [existing] = await tx
          .select()
          .from(projectBillingRequests)
          .where(
            and(
              eq(projectBillingRequests.organizationId, input.organizationId),
              eq(projectBillingRequests.idempotencyKey, receiptKey),
            ),
          )
          .limit(1);
        if (!existing || existing.requestHash !== input.requestHash) {
          throw new ProjectBillingTransitionError(
            "IDEMPOTENCY_KEY_REUSED",
            "The idempotency key was already used with a different request",
          );
        }
        if (existing.status === "completed" && existing.response) {
          return {
            ...(existing.response as unknown as ProjectBillingTransitionResult),
            replayed: true,
          };
        }
        throw new ProjectBillingTransitionError(
          "INVALID_STATUS",
          "An identical transition is still processing",
        );
      }

      const [invoice] = await tx
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.id, input.invoiceId),
            eq(invoices.organizationId, input.organizationId),
          ),
        )
        .for("update");
      if (!invoice) {
        throw new ProjectBillingTransitionError(
          "NOT_FOUND",
          "Invoice not found",
        );
      }
      if (invoice.status === "paid") {
        throw new ProjectBillingTransitionError(
          "INVALID_STATUS",
          "Paid invoices must be credited, not released or rebilled",
        );
      }

      const allocations = await tx
        .select()
        .from(invoiceSourceAllocations)
        .where(
          and(
            eq(invoiceSourceAllocations.organizationId, input.organizationId),
            eq(invoiceSourceAllocations.invoiceId, input.invoiceId),
            eq(invoiceSourceAllocations.allocationStatus, "active"),
          ),
        )
        .for("update");
      if (!allocations.length) {
        throw new ProjectBillingTransitionError(
          "NO_ACTIVE_ALLOCATIONS",
          "Invoice has no active project billing allocations",
        );
      }

      const lineIds = [
        ...new Set(
          allocations.map((allocation) => allocation.invoiceLineItemId),
        ),
      ];
      const originalLines = await tx
        .select()
        .from(invoiceLineItems)
        .where(inArray(invoiceLineItems.id, lineIds));
      const lineById = new Map(originalLines.map((line) => [line.id, line]));
      let replacementInvoiceId: string | null = null;
      const replacementByOriginal = new Map<string, string>();

      if (input.action === "transfer") {
        if (!input.targetInvoiceId) {
          throw new ProjectBillingTransitionError(
            "TARGET_REQUIRED",
            "A target draft invoice is required for transfer",
          );
        }
        const [target] = await tx
          .select()
          .from(invoices)
          .where(
            and(
              eq(invoices.id, input.targetInvoiceId),
              eq(invoices.organizationId, input.organizationId),
              eq(invoices.status, "draft"),
            ),
          )
          .for("update");
        if (!target || target.entityId !== invoice.entityId) {
          throw new ProjectBillingTransitionError(
            "INVALID_TARGET",
            "Transfer target must be a draft for the same customer",
          );
        }
        replacementInvoiceId = target.id;
      } else if (input.action === "rebill") {
        const [replacement] = await tx
          .insert(invoices)
          .values({
            organizationId: input.organizationId,
            invoiceNumber: `${invoice.invoiceNumber}-R-${receipt.id.slice(0, 6)}`,
            entityId: invoice.entityId,
            invoiceDate: input.invoiceDate ?? invoice.invoiceDate,
            dueDate: input.dueDate ?? invoice.dueDate,
            subtotal: invoice.subtotal,
            taxAmount: invoice.taxAmount,
            totalAmount: invoice.totalAmount,
            status: "draft",
            metadata: {
              ...((invoice.metadata as Record<string, unknown>) ?? {}),
              source: "project_billing",
              rebillOfInvoiceId: invoice.id,
              transitionReason: input.reason,
              transitionActorId: input.actorId,
            },
          })
          .returning({ id: invoices.id });
        replacementInvoiceId = replacement.id;
      }

      if (replacementInvoiceId) {
        for (const originalLine of originalLines) {
          const [replacementLine] = await tx
            .insert(invoiceLineItems)
            .values({
              invoiceId: replacementInvoiceId,
              itemId: originalLine.itemId,
              description: originalLine.description,
              quantity: originalLine.quantity,
              unitPrice: originalLine.unitPrice,
              amount: originalLine.amount,
              linkedProjectTaskId: originalLine.linkedProjectTaskId,
            })
            .returning({ id: invoiceLineItems.id });
          replacementByOriginal.set(originalLine.id, replacementLine.id);
        }
        if (input.action === "transfer") {
          await tx
            .update(invoices)
            .set({
              subtotal: sql`${invoices.subtotal} + ${invoice.subtotal}`,
              taxAmount: sql`${invoices.taxAmount} + ${invoice.taxAmount ?? "0"}`,
              totalAmount: sql`${invoices.totalAmount} + ${invoice.totalAmount}`,
              updatedAt: new Date(),
            })
            .where(eq(invoices.id, replacementInvoiceId));
        }
      }

      const releasedAllocationIds: string[] = [];
      const replacementAllocationIds: string[] = [];
      for (const allocation of allocations) {
        let replacementAllocationId: string | null = null;
        const replacementLineId = replacementByOriginal.get(
          allocation.invoiceLineItemId,
        );
        await tx
          .update(invoiceSourceAllocations)
          .set({
            allocationStatus:
              input.action === "transfer" && replacementLineId
                ? "transferred"
                : "released",
            releasedAt: new Date(),
            releaseReason:
              input.action === "void"
                ? "void"
                : replacementLineId
                  ? "rebill_transfer"
                  : "writeoff",
            updatedAt: new Date(),
          })
          .where(eq(invoiceSourceAllocations.id, allocation.id));
        if (replacementInvoiceId && replacementLineId) {
          const [replacement] = await tx
            .insert(invoiceSourceAllocations)
            .values({
              organizationId: input.organizationId,
              invoiceId: replacementInvoiceId,
              invoiceLineItemId: replacementLineId,
              projectId: allocation.projectId,
              projectContractId: allocation.projectContractId,
              projectContractVersionId: allocation.projectContractVersionId,
              projectContractLineId: allocation.projectContractLineId,
              sourceType: allocation.sourceType,
              sourceId: allocation.sourceId,
              sourceHours: allocation.sourceHours,
              sourceAmountMinor: allocation.sourceAmountMinor,
              currencyCode: allocation.currencyCode,
              taxAmountMinor: allocation.taxAmountMinor,
              allocationStatus: "active",
            })
            .returning({ id: invoiceSourceAllocations.id });
          replacementAllocationId = replacement.id;
          replacementAllocationIds.push(replacement.id);
        }

        if (replacementAllocationId) {
          await tx
            .update(invoiceSourceAllocations)
            .set({ replacedByAllocationId: replacementAllocationId })
            .where(eq(invoiceSourceAllocations.id, allocation.id));
        }
        releasedAllocationIds.push(allocation.id);
        await this.updateSourceMarker(
          tx,
          input.organizationId,
          allocation.sourceType,
          allocation.sourceId,
          replacementLineId ?? null,
        );
      }

      if (
        input.action === "void" ||
        input.action === "rebill" ||
        input.action === "transfer"
      ) {
        await this.reversePostedBilling(
          tx,
          input,
          receipt.id,
          input.invoiceDate ?? new Date().toISOString().slice(0, 10),
        );
      }

      const metadata = (invoice.metadata as Record<string, unknown>) ?? {};
      const priorTransitions = Array.isArray(metadata.projectBillingTransitions)
        ? metadata.projectBillingTransitions
        : [];
      const voidsInvoice = ["void", "rebill", "transfer"].includes(
        input.action,
      );
      await tx
        .update(invoices)
        .set({
          status: voidsInvoice ? "void" : invoice.status,
          metadata: {
            ...metadata,
            ...(voidsInvoice
              ? {
                  voidReason: input.reason,
                  voidDate: new Date().toISOString(),
                  replacementInvoiceId,
                }
              : {}),
            projectBillingTransitions: [
              ...priorTransitions,
              {
                receiptId: receipt.id,
                action: input.action,
                reason: input.reason,
                actorId: input.actorId,
                replacementInvoiceId,
                occurredAt: new Date().toISOString(),
              },
            ],
          },
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, invoice.id));

      const response: ProjectBillingTransitionResult = {
        replayed: false,
        action: input.action,
        originalInvoiceId: invoice.id,
        replacementInvoiceId,
        releasedAllocationIds,
        replacementAllocationIds,
      };
      await tx
        .update(projectBillingRequests)
        .set({
          status: "completed",
          response: response as unknown as Record<string, unknown>,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(projectBillingRequests.id, receipt.id));
      return response;
    });
  }

  private async reversePostedBilling(
    tx: any,
    input: ProjectBillingTransitionInput,
    receiptId: string,
    postingDate: string,
  ) {
    const [original] = await tx
      .select()
      .from(glTransactions)
      .where(
        and(
          eq(glTransactions.organizationId, input.organizationId),
          eq(glTransactions.sourceEventType, "project_billing"),
          eq(glTransactions.sourceEventId, input.invoiceId),
          eq(glTransactions.status, "POSTED"),
        ),
      )
      .for("update");
    if (!original) return;
    if (original.reversedByTransactionId) {
      throw new ProjectBillingTransitionError(
        "INVALID_STATUS",
        "The project billing journal has already been reversed",
      );
    }
    const [period] = await tx
      .select({ id: accountingPeriods.id })
      .from(accountingPeriods)
      .where(
        and(
          eq(accountingPeriods.organizationId, input.organizationId),
          eq(accountingPeriods.subsidiaryId, original.subsidiaryId),
          eq(accountingPeriods.status, "OPEN"),
          sql`${accountingPeriods.startDate} <= ${postingDate}`,
          sql`${accountingPeriods.endDate} >= ${postingDate}`,
        ),
      )
      .limit(1);
    if (!period) {
      throw new ProjectBillingTransitionError(
        "INVALID_STATUS",
        "A posted project invoice can only be voided or rebilled into an open accounting period",
      );
    }
    const originalLines = await tx
      .select()
      .from(glTransactionLines)
      .where(eq(glTransactionLines.transactionId, original.id));
    const [reversal] = await tx
      .insert(glTransactions)
      .values({
        organizationId: input.organizationId,
        transactionNumber: `PBR-${receiptId.slice(0, 12)}`,
        subsidiaryId: original.subsidiaryId,
        transactionDate: postingDate,
        postingDate,
        periodId: period.id,
        transactionType: "REVERSAL",
        sourceSystem: "AUTO",
        sourceEventType: "project_billing_reversal",
        sourceEventId: receiptId,
        idempotencyKey: input.idempotencyKey,
        description: `Project invoice reversal: ${input.reason}`,
        referenceNumber: original.transactionNumber,
        baseCurrencyCode: original.baseCurrencyCode,
        totalDebitAmount: original.totalCreditAmount,
        totalCreditAmount: original.totalDebitAmount,
        status: "POSTED",
        reversalReason: input.reason,
        autoGenerated: true,
        createdBy: input.actorId,
        modifiedBy: input.actorId,
        postedBy: input.actorId,
        postedDate: new Date(),
      })
      .returning({ id: glTransactions.id });
    if (originalLines.length) {
      await tx.insert(glTransactionLines).values(
        originalLines.map((line: ProjectBillingGlLine) => ({
          organizationId: input.organizationId,
          transactionId: reversal.id,
          lineNumber: line.lineNumber,
          accountId: line.accountId,
          classId: line.classId,
          departmentId: line.departmentId,
          locationId: line.locationId,
          subsidiaryId: line.subsidiaryId,
          debitAmount: line.creditAmount,
          creditAmount: line.debitAmount,
          currencyCode: line.currencyCode,
          exchangeRate: line.exchangeRate,
          baseDebitAmount: line.baseCreditAmount,
          baseCreditAmount: line.baseDebitAmount,
          description: `Reversal: ${line.description ?? input.reason}`,
          reference1: line.reference1,
          reference2: line.reference2,
          projectId: line.projectId,
          customerId: line.customerId,
          projectContractId: line.projectContractId,
          projectContractVersionId: line.projectContractVersionId,
          performanceObligationId: line.performanceObligationId,
          sourceEventType: "project_billing_reversal",
          sourceEventId: receiptId,
        })),
      );
    }
    await tx
      .update(glTransactions)
      .set({
        status: "REVERSED",
        reversedByTransactionId: reversal.id,
        reversalReason: input.reason,
        modifiedBy: input.actorId,
        modifiedDate: new Date(),
      })
      .where(eq(glTransactions.id, original.id));
  }

  private async updateSourceMarker(
    tx: any,
    organizationId: string,
    sourceType: string,
    sourceId: string,
    invoiceLineId: string | null,
  ) {
    const marker = invoiceLineId
      ? { invoicedAt: new Date(), invoiceLineId }
      : { invoicedAt: null, invoiceLineId: null };
    if (sourceType === "TIME_ENTRY") {
      await tx
        .update(timeEntries)
        .set(marker)
        .where(
          and(
            eq(timeEntries.organizationId, organizationId),
            eq(timeEntries.id, sourceId),
          ),
        );
    } else if (sourceType === "PROJECT_TASK") {
      await tx
        .update(projectTasks)
        .set(marker)
        .where(
          and(
            eq(projectTasks.organizationId, organizationId),
            eq(projectTasks.id, sourceId),
          ),
        );
    } else if (sourceType === "PROJECT_MILESTONE") {
      await tx
        .update(projectContractBillingMilestones)
        .set({
          invoicedAt: marker.invoicedAt,
          status: invoiceLineId ? "invoiced" : "approved",
        })
        .where(
          and(
            eq(projectContractBillingMilestones.organizationId, organizationId),
            eq(projectContractBillingMilestones.id, sourceId),
          ),
        );
    } else if (sourceType === "PROJECT_PROGRESS") {
      await tx
        .update(projectProgressCertifications)
        .set({
          invoicedAt: marker.invoicedAt,
          status: invoiceLineId ? "invoiced" : "approved",
        })
        .where(
          and(
            eq(projectProgressCertifications.organizationId, organizationId),
            eq(projectProgressCertifications.id, sourceId),
          ),
        );
    }
  }
}
