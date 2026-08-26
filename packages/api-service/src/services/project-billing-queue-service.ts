import { createHash } from 'node:crypto';
import Decimal from 'decimal.js';
import {
  ProjectBillingDraftConflictError,
  ProjectBillingDraftRepository,
  ProjectBillingQueueRepository,
  ProjectContractRepository,
  type ContextualDatabase,
  type ProjectBillingCandidateFilters,
  type ProjectBillingCandidateSourceType,
  type RawProjectBillingCandidate,
} from '@glapi/database';
import { ServiceError, type PaginationParams } from '../types';
import { BaseService } from './base-service';

export interface ProjectBillingQueueRepositoryLike {
  listEligibleCandidates(
    organizationId: string,
    filters: ProjectBillingCandidateFilters,
  ): Promise<RawProjectBillingCandidate[]>;
}

export interface ProjectBillingRateRepositoryLike {
  resolveEffectiveRate(
    billingRuleId: string,
    organizationId: string,
    context: {
      serviceDate: string;
      entityId?: string;
      projectTaskId?: string;
      itemId?: string;
      projectCostCodeId?: string;
    },
  ): Promise<{
    id: string;
    rateScope: 'default' | 'person' | 'role' | 'task' | 'item' | 'cost_code';
    unitRate: string;
  } | null>;
}

export interface ProjectBillingQueueServiceOptions {
  db?: ContextualDatabase;
  repository?: ProjectBillingQueueRepositoryLike;
  rateRepository?: ProjectBillingRateRepositoryLike;
  draftRepository?: ProjectBillingDraftRepositoryLike;
}

export interface ProjectBillingDraftRepositoryLike {
  findRequest(
    organizationId: string,
    idempotencyKey: string,
  ): Promise<{
    requestHash: string;
    status: string;
    response: Record<string, unknown> | null;
  } | null>;
  createDrafts(input: {
    organizationId: string;
    idempotencyKey: string;
    requestHash: string;
    invoiceDate: string;
    dueDate?: string;
    groups: Array<{
      groupKey: string;
      customerId: string;
      projectId: string | null;
      projectIds: string[];
      projectContractIds: string[];
      projectContractVersionIds: string[];
      currencyCode: string;
      lines: Array<{
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
      }>;
    }>;
  }): Promise<{
    replayed: boolean;
    idempotencyKey: string;
    invoices: Array<{
      invoiceId: string;
      invoiceNumber: string;
      customerId: string;
      projectId: string | null;
      currencyCode: string;
      totalAmount: string;
      sourceCount: number;
    }>;
  }>;
}

export interface ProjectBillingQueueFilters {
  customerId?: string;
  projectId?: string;
  sourceTypes?: ProjectBillingCandidateSourceType[];
  asOfDate?: string;
}

export type ProjectBillingRateDerivation =
  | { kind: 'source_override'; sourceField: 'billingRate' | 'flatFeeAmount' }
  | { kind: 'rate_card'; rateId: string; rateScope: string }
  | { kind: 'rule_default'; billingRuleId: string }
  | { kind: 'fixed_amount'; billingRuleId: string }
  | { kind: 'missing_rate'; billingRuleId: string };

export interface ProjectBillingCandidate {
  candidateId: string;
  sourceType: ProjectBillingCandidateSourceType;
  sourceId: string;
  customerId: string;
  customerName: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  projectContractId: string;
  projectContractVersionId: string;
  contractNumber: string;
  billingRuleId: string;
  projectContractLineId: string | null;
  itemId: string | null;
  billingRuleName: string;
  grouping: 'customer' | 'project' | 'customer_project';
  currencyCode: string;
  serviceDate: string;
  description: string;
  quantity: string;
  unitRate: string | null;
  amount: string | null;
  amountMinor: number | null;
  pricingStatus: 'ready' | 'missing_rate';
  derivation: ProjectBillingRateDerivation;
}

export interface PreviewProjectInvoiceInput extends ProjectBillingQueueFilters {
  candidateIds?: string[];
}

export interface CreateProjectInvoiceDraftsInput
  extends ProjectBillingQueueFilters {
  idempotencyKey: string;
  candidateIds: string[];
  invoiceDate: string;
  dueDate?: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function money(value: Decimal): string {
  return value.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4);
}

function minorUnits(value: Decimal): number {
  return value.times(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

export class ProjectBillingQueueService extends BaseService {
  private readonly repository: ProjectBillingQueueRepositoryLike;
  private readonly rateRepository: ProjectBillingRateRepositoryLike;
  private readonly draftRepository: ProjectBillingDraftRepositoryLike;

  constructor(context = {}, options: ProjectBillingQueueServiceOptions = {}) {
    super(context);
    this.repository =
      options.repository ?? new ProjectBillingQueueRepository(options.db);
    this.rateRepository =
      options.rateRepository ?? new ProjectContractRepository(options.db);
    this.draftRepository =
      options.draftRepository ?? new ProjectBillingDraftRepository(options.db);
  }

  private async priceCandidate(
    raw: RawProjectBillingCandidate,
  ): Promise<ProjectBillingCandidate> {
    const organizationId = this.requireOrganizationContext();
    const quantity = new Decimal(raw.quantity);
    let unitRate: Decimal | null = null;
    let amount: Decimal | null = null;
    let derivation: ProjectBillingRateDerivation;

    if (raw.fixedAmount !== null) {
      amount = new Decimal(raw.fixedAmount);
      unitRate = amount;
      derivation = { kind: 'fixed_amount', billingRuleId: raw.billingRuleId };
    } else if (raw.sourceOverrideRate !== null) {
      unitRate = new Decimal(raw.sourceOverrideRate);
      amount = quantity.times(unitRate);
      derivation = {
        kind: 'source_override',
        sourceField: raw.sourceOverrideField ?? 'billingRate',
      };
    } else {
      const rate = await this.rateRepository.resolveEffectiveRate(
        raw.billingRuleId,
        organizationId,
        {
          serviceDate: raw.serviceDate,
          entityId: raw.entityId ?? undefined,
          projectTaskId: raw.projectTaskId ?? undefined,
          itemId: raw.itemId ?? undefined,
          projectCostCodeId: raw.projectCostCodeId ?? undefined,
        },
      );
      if (rate) {
        unitRate = new Decimal(rate.unitRate);
        amount = quantity.times(unitRate);
        derivation = {
          kind: 'rate_card',
          rateId: rate.id,
          rateScope: rate.rateScope,
        };
      } else if (raw.ruleDefaultRate !== null) {
        unitRate = new Decimal(raw.ruleDefaultRate);
        amount = quantity.times(unitRate);
        derivation = { kind: 'rule_default', billingRuleId: raw.billingRuleId };
      } else {
        derivation = { kind: 'missing_rate', billingRuleId: raw.billingRuleId };
      }
    }

    return {
      candidateId: `${raw.sourceType}:${raw.sourceId}`,
      sourceType: raw.sourceType,
      sourceId: raw.sourceId,
      customerId: raw.customerId,
      customerName: raw.customerName,
      projectId: raw.projectId,
      projectCode: raw.projectCode,
      projectName: raw.projectName,
      projectContractId: raw.projectContractId,
      projectContractVersionId: raw.projectContractVersionId,
      contractNumber: raw.contractNumber,
      billingRuleId: raw.billingRuleId,
      projectContractLineId: raw.projectContractLineId,
      itemId: raw.itemId,
      billingRuleName: raw.billingRuleName,
      grouping: raw.grouping,
      currencyCode: raw.currencyCode,
      serviceDate: raw.serviceDate,
      description: raw.description,
      quantity: quantity.toFixed(4),
      unitRate: unitRate ? money(unitRate) : null,
      amount: amount ? money(amount) : null,
      amountMinor: amount ? minorUnits(amount) : null,
      pricingStatus: amount ? 'ready' : 'missing_rate',
      derivation,
    };
  }

  private async loadCandidates(filters: ProjectBillingQueueFilters) {
    const organizationId = this.requireOrganizationContext();
    const raw = await this.repository.listEligibleCandidates(organizationId, {
      ...filters,
      asOfDate: filters.asOfDate ?? today(),
    });
    return Promise.all(raw.map((candidate) => this.priceCandidate(candidate)));
  }

  async listCandidates(
    pagination: PaginationParams = {},
    filters: ProjectBillingQueueFilters = {},
  ) {
    const { page, limit, skip } = this.getPaginationParams(pagination);
    const candidates = await this.loadCandidates(filters);
    return this.createPaginatedResult(
      candidates.slice(skip, skip + limit),
      candidates.length,
      page,
      limit,
    );
  }

  async previewInvoiceDrafts(input: PreviewProjectInvoiceInput = {}) {
    const candidates = await this.loadCandidates(input);
    const selected = input.candidateIds?.length
      ? candidates.filter((candidate) =>
          input.candidateIds!.includes(candidate.candidateId),
        )
      : candidates;
    if (
      input.candidateIds?.length &&
      new Set(selected.map((candidate) => candidate.candidateId)).size !==
        new Set(input.candidateIds).size
    ) {
      throw new ServiceError(
        'One or more selected billing candidates are no longer eligible',
        'PROJECT_BILLING_CANDIDATE_NOT_FOUND',
        409,
      );
    }
    const missing = selected.filter(
      (candidate) => candidate.pricingStatus === 'missing_rate',
    );
    if (missing.length > 0) {
      throw new ServiceError(
        `Cannot preview ${missing.length} candidate(s) without a billing rate`,
        'PROJECT_BILLING_RATE_MISSING',
        409,
      );
    }

    const groups = new Map<string, ProjectBillingCandidate[]>();
    for (const candidate of selected) {
      const dimensions =
        candidate.grouping === 'customer'
          ? [candidate.customerId]
          : candidate.grouping === 'project'
            ? [candidate.projectId]
            : [candidate.customerId, candidate.projectId];
      const key = [...dimensions, candidate.currencyCode].join(':');
      groups.set(key, [...(groups.get(key) ?? []), candidate]);
    }

    const drafts = [...groups.entries()].map(([groupKey, lines]) => {
      const total = lines.reduce(
        (sum, line) => sum.plus(line.amount ?? '0'),
        new Decimal(0),
      );
      const first = lines[0]!;
      return {
        groupKey,
        grouping: first.grouping,
        customerId: first.customerId,
        customerName: first.customerName,
        projectId: first.grouping === 'customer' ? null : first.projectId,
        projectName: first.grouping === 'customer' ? null : first.projectName,
        currencyCode: first.currencyCode,
        lineCount: lines.length,
        subtotal: money(total),
        subtotalMinor: minorUnits(total),
        lines,
      };
    });

    const grandTotal = drafts.reduce(
      (sum, draft) => sum.plus(draft.subtotal),
      new Decimal(0),
    );
    const totalsByCurrency = drafts.reduce<Record<string, Decimal>>(
      (totals, draft) => {
        totals[draft.currencyCode] = (
          totals[draft.currencyCode] ?? new Decimal(0)
        ).plus(draft.subtotal);
        return totals;
      },
      {},
    );
    const currencyTotals = Object.fromEntries(
      Object.entries(totalsByCurrency).map(([currencyCode, total]) => [
        currencyCode,
        money(total),
      ]),
    );
    return {
      asOfDate: input.asOfDate ?? today(),
      draftCount: drafts.length,
      candidateCount: selected.length,
      grandTotal:
        Object.keys(currencyTotals).length <= 1 ? money(grandTotal) : null,
      totalsByCurrency: currencyTotals,
      drafts,
    };
  }

  async createInvoiceDrafts(input: CreateProjectInvoiceDraftsInput) {
    const organizationId = this.requireOrganizationContext();
    if (!input.idempotencyKey.trim()) {
      throw new ServiceError(
        'Idempotency key is required',
        'IDEMPOTENCY_KEY_REQUIRED',
        400,
      );
    }
    if (new Set(input.candidateIds).size !== input.candidateIds.length) {
      throw new ServiceError(
        'Candidate IDs must be unique',
        'DUPLICATE_PROJECT_BILLING_CANDIDATE',
        400,
      );
    }
    if (input.dueDate && input.dueDate < input.invoiceDate) {
      throw new ServiceError(
        'Due date cannot be before invoice date',
        'INVALID_PROJECT_INVOICE_DATE',
        400,
      );
    }

    const asOfDate = input.asOfDate ?? today();
    const canonicalRequest = JSON.stringify({
      candidateIds: [...input.candidateIds].sort(),
      invoiceDate: input.invoiceDate,
      dueDate: input.dueDate ?? null,
      asOfDate: input.asOfDate ?? null,
      customerId: input.customerId ?? null,
      projectId: input.projectId ?? null,
      sourceTypes: input.sourceTypes ? [...input.sourceTypes].sort() : null,
    });
    const requestHash = createHash('sha256')
      .update(canonicalRequest)
      .digest('hex');
    const existing = await this.draftRepository.findRequest(
      organizationId,
      input.idempotencyKey,
    );
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new ServiceError(
          'The idempotency key was already used with a different request',
          'IDEMPOTENCY_KEY_REUSED',
          409,
        );
      }
      if (existing.status === 'completed' && existing.response) {
        return { ...existing.response, replayed: true };
      }
      throw new ServiceError(
        'An identical project billing request is still processing',
        'BILLING_SOURCE_CONFLICT',
        409,
      );
    }

    const preview = await this.previewInvoiceDrafts({
      customerId: input.customerId,
      projectId: input.projectId,
      sourceTypes: input.sourceTypes,
      asOfDate,
      candidateIds: input.candidateIds,
    });

    try {
      return await this.draftRepository.createDrafts({
        organizationId,
        idempotencyKey: input.idempotencyKey,
        requestHash,
        invoiceDate: input.invoiceDate,
        dueDate: input.dueDate,
        groups: preview.drafts.map((draft) => ({
          groupKey: draft.groupKey,
          customerId: draft.customerId,
          projectId: draft.projectId,
          projectIds: [...new Set(draft.lines.map((line) => line.projectId))],
          projectContractIds: [
            ...new Set(draft.lines.map((line) => line.projectContractId)),
          ],
          projectContractVersionIds: [
            ...new Set(
              draft.lines.map((line) => line.projectContractVersionId),
            ),
          ],
          currencyCode: draft.currencyCode,
          lines: draft.lines.map((line) => ({
            candidateId: line.candidateId,
            sourceType: line.sourceType,
            sourceId: line.sourceId,
            description: line.description,
            quantity: line.quantity,
            unitRate: line.unitRate!,
            amountMinor: line.amountMinor!,
            currencyCode: line.currencyCode,
            sourceHours:
              line.sourceType === 'TIME_ENTRY' ||
              (line.sourceType === 'PROJECT_TASK' &&
                !(
                  line.derivation.kind === 'source_override' &&
                  line.derivation.sourceField === 'flatFeeAmount'
                ))
                ? line.quantity
                : null,
            itemId: line.itemId,
            projectTaskId:
              line.sourceType === 'PROJECT_TASK' ? line.sourceId : null,
            billingRuleId: line.billingRuleId,
            projectContractLineId: line.projectContractLineId,
          })),
        })),
      });
    } catch (error) {
      if (error instanceof ProjectBillingDraftConflictError) {
        throw new ServiceError(error.message, error.code, 409);
      }
      throw error;
    }
  }
}
