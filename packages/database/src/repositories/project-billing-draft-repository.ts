import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { ContextualDatabase } from '../context';
import { invoiceLineItems } from '../db/schema/invoice-line-items';
import { invoiceSourceAllocations } from '../db/schema/invoice-source-allocations';
import { invoices } from '../db/schema/invoices';
import { projectBillingRequests } from '../db/schema/project-billing-requests';
import {
  projectContractBillingMilestones,
  projectProgressCertifications,
} from '../db/schema/project-contracts';
import { projectTasks } from '../db/schema/project-tasks';
import { timeEntries } from '../db/schema/time-entries';
import { BaseRepository } from './base-repository';
import type { ProjectBillingCandidateSourceType } from './project-billing-queue-repository';

type ProjectBillingTransaction = Parameters<
  Parameters<ContextualDatabase['transaction']>[0]
>[0];

export interface ProjectBillingDraftLineInput {
  candidateId: string;
  sourceType: ProjectBillingCandidateSourceType;
  sourceId: string;
  description: string;
  quantity: string;
  unitRate: string;
  amountMinor: number;
  currencyCode: string;
  sourceHours?: string | null;
  itemId?: string | null;
  projectTaskId?: string | null;
  billingRuleId: string;
  projectContractLineId?: string | null;
}

export interface ProjectBillingDraftGroupInput {
  groupKey: string;
  customerId: string;
  projectId?: string | null;
  projectIds: string[];
  projectContractIds: string[];
  projectContractVersionIds: string[];
  currencyCode: string;
  lines: ProjectBillingDraftLineInput[];
}

export interface CreateProjectBillingDraftsInput {
  organizationId: string;
  idempotencyKey: string;
  requestHash: string;
  invoiceDate: string;
  dueDate?: string;
  groups: ProjectBillingDraftGroupInput[];
}

export interface CreatedProjectBillingDraft {
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  projectId: string | null;
  currencyCode: string;
  totalAmount: string;
  sourceCount: number;
}

export interface CreateProjectBillingDraftsResult {
  replayed: boolean;
  idempotencyKey: string;
  invoices: CreatedProjectBillingDraft[];
}

export class ProjectBillingDraftConflictError extends Error {
  constructor(
    public readonly code: 'IDEMPOTENCY_KEY_REUSED' | 'BILLING_SOURCE_CONFLICT',
    message: string,
  ) {
    super(message);
    this.name = 'ProjectBillingDraftConflictError';
  }
}

function sourceIds(
  lines: ProjectBillingDraftLineInput[],
  sourceType: ProjectBillingCandidateSourceType,
): string[] {
  return lines
    .filter((line) => line.sourceType === sourceType)
    .map((line) => line.sourceId);
}

function amountFromMinor(amountMinor: number): string {
  return (amountMinor / 100).toFixed(2);
}

export class ProjectBillingDraftRepository extends BaseRepository {
  constructor(db?: ContextualDatabase) {
    super(db);
  }

  async findRequest(organizationId: string, idempotencyKey: string) {
    const [request] = await this.db
      .select()
      .from(projectBillingRequests)
      .where(
        and(
          eq(projectBillingRequests.organizationId, organizationId),
          eq(projectBillingRequests.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);
    return request ?? null;
  }

  private async lockAndValidateSources(
    tx: ProjectBillingTransaction,
    organizationId: string,
    lines: ProjectBillingDraftLineInput[],
  ): Promise<void> {
    for (const line of [...lines].sort((left, right) =>
      left.candidateId.localeCompare(right.candidateId),
    )) {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${organizationId}:${line.candidateId}`}, 0))`,
      );
    }

    const timeIds = sourceIds(lines, 'TIME_ENTRY');
    if (timeIds.length) {
      const locked = await tx
        .select({ id: timeEntries.id })
        .from(timeEntries)
        .where(
          and(
            eq(timeEntries.organizationId, organizationId),
            inArray(timeEntries.id, timeIds),
            eq(timeEntries.status, 'APPROVED'),
            eq(timeEntries.isBillable, true),
            isNull(timeEntries.invoicedAt),
          ),
        )
        .for('update');
      if (locked.length !== new Set(timeIds).size) this.sourceConflict();
    }

    const taskIds = sourceIds(lines, 'PROJECT_TASK');
    if (taskIds.length) {
      const locked = await tx
        .select({ id: projectTasks.id })
        .from(projectTasks)
        .where(
          and(
            eq(projectTasks.organizationId, organizationId),
            inArray(projectTasks.id, taskIds),
            eq(projectTasks.status, 'COMPLETED'),
            eq(projectTasks.isBillable, true),
            isNull(projectTasks.invoicedAt),
          ),
        )
        .for('update');
      if (locked.length !== new Set(taskIds).size) this.sourceConflict();
    }

    const milestoneIds = sourceIds(lines, 'PROJECT_MILESTONE');
    if (milestoneIds.length) {
      const locked = await tx
        .select({ id: projectContractBillingMilestones.id })
        .from(projectContractBillingMilestones)
        .where(
          and(
            eq(projectContractBillingMilestones.organizationId, organizationId),
            inArray(projectContractBillingMilestones.id, milestoneIds),
            eq(projectContractBillingMilestones.status, 'approved'),
            isNull(projectContractBillingMilestones.invoicedAt),
          ),
        )
        .for('update');
      if (locked.length !== new Set(milestoneIds).size) this.sourceConflict();
    }

    const progressIds = sourceIds(lines, 'PROJECT_PROGRESS');
    if (progressIds.length) {
      const locked = await tx
        .select({ id: projectProgressCertifications.id })
        .from(projectProgressCertifications)
        .where(
          and(
            eq(projectProgressCertifications.organizationId, organizationId),
            inArray(projectProgressCertifications.id, progressIds),
            eq(projectProgressCertifications.status, 'approved'),
            isNull(projectProgressCertifications.invoicedAt),
          ),
        )
        .for('update');
      if (locked.length !== new Set(progressIds).size) this.sourceConflict();
    }
  }

  private sourceConflict(): never {
    throw new ProjectBillingDraftConflictError(
      'BILLING_SOURCE_CONFLICT',
      'One or more project billing sources are no longer eligible or are already billed',
    );
  }

  async createDrafts(
    input: CreateProjectBillingDraftsInput,
  ): Promise<CreateProjectBillingDraftsResult> {
    try {
      return await this.db.transaction(async (tx) => {
        const [receipt] = await tx
          .insert(projectBillingRequests)
          .values({
            organizationId: input.organizationId,
            idempotencyKey: input.idempotencyKey,
            requestHash: input.requestHash,
            status: 'processing',
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
                eq(projectBillingRequests.idempotencyKey, input.idempotencyKey),
              ),
            )
            .limit(1);
          if (!existing || existing.requestHash !== input.requestHash) {
            throw new ProjectBillingDraftConflictError(
              'IDEMPOTENCY_KEY_REUSED',
              'The idempotency key was already used with a different request',
            );
          }
          if (existing.status === 'completed' && existing.response) {
            return {
              ...(existing.response as unknown as CreateProjectBillingDraftsResult),
              replayed: true,
            };
          }
          throw new ProjectBillingDraftConflictError(
            'BILLING_SOURCE_CONFLICT',
            'An identical project billing request is still processing',
          );
        }

        const allLines = input.groups.flatMap((group) => group.lines);
        if (
          new Set(allLines.map((line) => line.candidateId)).size !==
          allLines.length
        ) {
          this.sourceConflict();
        }
        await this.lockAndValidateSources(tx, input.organizationId, allLines);

        const createdInvoices: CreatedProjectBillingDraft[] = [];
        for (const [groupIndex, group] of input.groups.entries()) {
          const totalMinor = group.lines.reduce(
            (total, line) => total + line.amountMinor,
            0,
          );
          const invoiceNumber = `PB-${input.invoiceDate.replace(/-/g, '')}-${receipt.id.slice(0, 8)}-${groupIndex + 1}`;
          const [invoice] = await tx
            .insert(invoices)
            .values({
              organizationId: input.organizationId,
              invoiceNumber,
              entityId: group.customerId,
              invoiceDate: input.invoiceDate,
              dueDate: input.dueDate,
              subtotal: amountFromMinor(totalMinor),
              taxAmount: '0.00',
              totalAmount: amountFromMinor(totalMinor),
              status: 'draft',
              metadata: {
                source: 'project_billing',
                projectIds: group.projectIds,
                projectContractIds: group.projectContractIds,
                projectContractVersionIds: group.projectContractVersionIds,
                currencyCode: group.currencyCode,
                idempotencyKey: input.idempotencyKey,
                requestHash: input.requestHash,
              },
            })
            .returning({
              id: invoices.id,
              invoiceNumber: invoices.invoiceNumber,
            });

          for (const line of group.lines) {
            const [createdLine] = await tx
              .insert(invoiceLineItems)
              .values({
                invoiceId: invoice.id,
                itemId: line.itemId ?? undefined,
                description: line.description,
                quantity: line.quantity,
                unitPrice: amountFromMinor(
                  Math.round(Number(line.unitRate) * 100),
                ),
                amount: amountFromMinor(line.amountMinor),
                linkedProjectTaskId:
                  line.sourceType === 'PROJECT_TASK'
                    ? line.sourceId
                    : undefined,
              })
              .returning({ id: invoiceLineItems.id });

            await tx.insert(invoiceSourceAllocations).values({
              organizationId: input.organizationId,
              invoiceId: invoice.id,
              invoiceLineItemId: createdLine.id,
              sourceType: line.sourceType,
              sourceId: line.sourceId,
              sourceHours: line.sourceHours ?? undefined,
              sourceAmountMinor: line.amountMinor,
              currencyCode: line.currencyCode,
              allocationStatus: 'active',
            });

            const marker = { invoicedAt: new Date() };
            if (line.sourceType === 'TIME_ENTRY') {
              await tx
                .update(timeEntries)
                .set({ ...marker, invoiceLineId: createdLine.id })
                .where(
                  and(
                    eq(timeEntries.organizationId, input.organizationId),
                    eq(timeEntries.id, line.sourceId),
                  ),
                );
            } else if (line.sourceType === 'PROJECT_TASK') {
              await tx
                .update(projectTasks)
                .set({ ...marker, invoiceLineId: createdLine.id })
                .where(
                  and(
                    eq(projectTasks.organizationId, input.organizationId),
                    eq(projectTasks.id, line.sourceId),
                  ),
                );
            } else if (line.sourceType === 'PROJECT_MILESTONE') {
              await tx
                .update(projectContractBillingMilestones)
                .set({ ...marker, status: 'invoiced' })
                .where(
                  and(
                    eq(
                      projectContractBillingMilestones.organizationId,
                      input.organizationId,
                    ),
                    eq(projectContractBillingMilestones.id, line.sourceId),
                  ),
                );
            } else {
              await tx
                .update(projectProgressCertifications)
                .set({ ...marker, status: 'invoiced' })
                .where(
                  and(
                    eq(
                      projectProgressCertifications.organizationId,
                      input.organizationId,
                    ),
                    eq(projectProgressCertifications.id, line.sourceId),
                  ),
                );
            }
          }

          createdInvoices.push({
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            customerId: group.customerId,
            projectId: group.projectId ?? null,
            currencyCode: group.currencyCode,
            totalAmount: amountFromMinor(totalMinor),
            sourceCount: group.lines.length,
          });
        }

        const response: CreateProjectBillingDraftsResult = {
          replayed: false,
          idempotencyKey: input.idempotencyKey,
          invoices: createdInvoices,
        };
        await tx
          .update(projectBillingRequests)
          .set({
            status: 'completed',
            response: response as unknown as Record<string, unknown>,
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(projectBillingRequests.id, receipt.id));
        return response;
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505' &&
        'constraint' in error &&
        error.constraint === 'ux_invoice_source_allocations_active_source'
      ) {
        this.sourceConflict();
      }
      throw error;
    }
  }
}
