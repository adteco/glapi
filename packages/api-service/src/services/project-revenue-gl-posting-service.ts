import {
  ProjectRevenueGlPostingRepository,
  type ContextualDatabase,
  type PersistProjectRevenueGlPostingInput,
  type ProjectBillingGlSourceRow,
  type ProjectGlAccountCandidate,
  type ProjectRevenueGlSourceRow,
} from '@glapi/database';
import {
  calculateProjectContractPositionPosting,
  type ProjectContractPositionState,
  type ProjectPostingAccountRole,
} from '@glapi/business';
import Decimal from 'decimal.js';
import { ServiceError } from '../types';
import { BaseService } from './base-service';

export interface ProjectRevenueGlPostingRepositoryLike {
  findRunSource(runId: string, organizationId: string): Promise<ProjectRevenueGlSourceRow[]>;
  findPriorContractState(
    runId: string,
    projectContractId: string,
    organizationId: string,
  ): Promise<{ cumulativeRecognized: string; cumulativeBilledMinor: number }>;
  findBillingSource(invoiceId: string, organizationId: string): Promise<ProjectBillingGlSourceRow[]>;
  findPriorBillingContractState(
    invoiceId: string,
    projectContractId: string,
    organizationId: string,
  ): Promise<{ cumulativeRecognized: string; cumulativeBilledMinor: number }>;
  findOpenPeriod(
    postingDate: string,
    subsidiaryId: string,
    organizationId: string,
  ): Promise<{ id: string } | null>;
  findAccountCandidates(
    organizationId: string,
    transactionType?: 'recognition' | 'billing',
  ): Promise<ProjectGlAccountCandidate[]>;
  persist(input: PersistProjectRevenueGlPostingInput): Promise<{
    transaction: { id: string };
    replayed: boolean;
  }>;
}

export interface ProjectRevenueGlPostingServiceOptions {
  db?: ContextualDatabase;
  repository?: ProjectRevenueGlPostingRepositoryLike;
}

function moneyFromMinor(value: number): string {
  return new Decimal(value).div(100).toFixed(2);
}

function resolveAccount(
  candidates: ProjectGlAccountCandidate[],
  role: ProjectPostingAccountRole,
  row: { subsidiaryId: string; itemId?: string | null },
): string {
  const mappedRole = role === 'accounts_receivable' ? 'ar' : role;
  const selected = candidates.find(
    (candidate) =>
      candidate.accountRole === mappedRole &&
      (!candidate.subsidiaryId || candidate.subsidiaryId === row.subsidiaryId) &&
      (!candidate.itemId || candidate.itemId === row.itemId),
  );
  if (!selected) {
    throw new ServiceError(
      `An active ${mappedRole} GL account mapping is required for project revenue posting`,
      'PROJECT_REVENUE_GL_MAPPING_MISSING',
      409,
      { accountRole: mappedRole },
    );
  }
  return selected.accountId;
}

export class ProjectRevenueGlPostingService extends BaseService {
  private readonly repository: ProjectRevenueGlPostingRepositoryLike;

  constructor(context = {}, options: ProjectRevenueGlPostingServiceOptions = {}) {
    super(context);
    this.repository = options.repository ?? new ProjectRevenueGlPostingRepository(options.db);
  }

  async postRecognitionRun(recognitionRunId: string, idempotencyKey: string) {
    const organizationId = this.requireOrganizationContext();
    if (!idempotencyKey.trim()) {
      throw new ServiceError(
        'An idempotency key is required for GL posting',
        'PROJECT_REVENUE_GL_IDEMPOTENCY_REQUIRED',
        400,
      );
    }
    const source = await this.repository.findRunSource(recognitionRunId, organizationId);
    if (!source.length) {
      throw new ServiceError(
        'Project revenue recognition run not found or has no recognized schedules',
        'PROJECT_REVENUE_RUN_NOT_FOUND',
        404,
      );
    }
    const first = source[0];
    if (source.some((row) => !row.projectContractVersionId)) {
      throw new ServiceError(
        'Recognition schedules require project contract version lineage before GL posting',
        'PROJECT_REVENUE_GL_LINEAGE_MISSING',
        409,
      );
    }
    if (
      source.some(
        (row) =>
          row.subsidiaryId !== first.subsidiaryId ||
          row.currencyCode !== first.currencyCode ||
          row.functionalCurrencyCode !== first.functionalCurrencyCode ||
          row.exchangeRate !== first.exchangeRate,
      )
    ) {
      throw new ServiceError(
        'A recognition run must contain one subsidiary and currency context for GL posting',
        'PROJECT_REVENUE_GL_MIXED_CURRENCY_RUN',
        409,
      );
    }
    const candidates = await this.repository.findAccountCandidates(organizationId);
    const contractIds = [...new Set(source.map((row) => row.projectContractId))];
    const states = new Map<string, ProjectContractPositionState>();
    for (const contractId of contractIds) {
      const prior = await this.repository.findPriorContractState(
        recognitionRunId,
        contractId,
        organizationId,
      );
      states.set(contractId, {
        cumulativeRecognized: new Decimal(prior.cumulativeRecognized).toFixed(2),
        cumulativeBilled: moneyFromMinor(prior.cumulativeBilledMinor),
      });
    }

    const lines: PersistProjectRevenueGlPostingInput['lines'] = [];
    const reconciliation = new Map<
      string,
      { cumulativeRecognized: string; cumulativeBilled: string; contractAsset: string; contractLiability: string }
    >();
    const exchangeRate = new Decimal(first.exchangeRate);
    for (const row of source) {
      const posting = calculateProjectContractPositionPosting(states.get(row.projectContractId)!, {
        kind: 'revenue_recognition',
        amount: new Decimal(row.recognizedAmount).toFixed(2),
      });
      states.set(row.projectContractId, {
        cumulativeRecognized: posting.next.cumulativeRecognized,
        cumulativeBilled: posting.next.cumulativeBilled,
      });
      reconciliation.set(row.projectContractId, posting.next);
      for (const postingLine of posting.lines) {
        lines.push({
          accountId: resolveAccount(candidates, postingLine.accountRole, row),
          debitAmount: postingLine.debitAmount,
          creditAmount: postingLine.creditAmount,
          baseDebitAmount: new Decimal(postingLine.debitAmount).times(exchangeRate).toFixed(4),
          baseCreditAmount: new Decimal(postingLine.creditAmount).times(exchangeRate).toFixed(4),
          description: `Project revenue recognition: ${postingLine.accountRole}`,
          projectId: row.projectId,
          customerId: row.customerId,
          projectContractId: row.projectContractId,
          projectContractVersionId: row.projectContractVersionId!,
          performanceObligationId: row.performanceObligationId,
          revenueScheduleId: row.scheduleId,
        });
      }
    }
    const totalBaseDebits = lines.reduce(
      (sum, line) => sum.plus(line.baseDebitAmount),
      new Decimal(0),
    );
    const totalBaseCredits = lines.reduce(
      (sum, line) => sum.plus(line.baseCreditAmount),
      new Decimal(0),
    );
    if (!totalBaseDebits.equals(totalBaseCredits)) {
      throw new ServiceError(
        'Functional-currency project revenue posting is not balanced',
        'PROJECT_REVENUE_GL_UNBALANCED',
        500,
      );
    }
    const result = await this.repository.persist({
      organizationId,
      sourceEventType: 'project_revenue_recognition',
      sourceEventId: recognitionRunId,
      description: 'Project ASC 606 revenue recognition',
      recognitionRunId,
      accountingPeriodId: first.accountingPeriodId,
      subsidiaryId: first.subsidiaryId,
      postingDate: first.recognitionDate,
      currencyCode: first.currencyCode,
      functionalCurrencyCode: first.functionalCurrencyCode,
      exchangeRate: first.exchangeRate,
      totalBaseAmount: totalBaseDebits.toFixed(4),
      idempotencyKey,
      postedBy: this.context.userId,
      lines,
    });
    return {
      replayed: result.replayed,
      glTransactionId: result.transaction.id,
      recognitionRunId,
      totalDebitAmount: totalBaseDebits.toFixed(4),
      totalCreditAmount: totalBaseCredits.toFixed(4),
      lineCount: lines.length,
      contractPositions: [...reconciliation.entries()].map(([projectContractId, position]) => ({
        projectContractId,
        ...position,
      })),
    };
  }

  async postProjectInvoice(invoiceId: string, idempotencyKey: string) {
    const organizationId = this.requireOrganizationContext();
    if (!idempotencyKey.trim()) {
      throw new ServiceError(
        'An idempotency key is required for project invoice GL posting',
        'PROJECT_BILLING_GL_IDEMPOTENCY_REQUIRED',
        400,
      );
    }
    const source = await this.repository.findBillingSource(invoiceId, organizationId);
    if (!source.length) {
      throw new ServiceError(
        'An issued project invoice with active contract allocations is required',
        'PROJECT_BILLING_INVOICE_NOT_POSTABLE',
        409,
      );
    }
    const first = source[0];
    if (source.some((row) => !row.projectContractVersionId)) {
      throw new ServiceError(
        'Project invoice allocations require contract version lineage before GL posting',
        'PROJECT_BILLING_GL_LINEAGE_MISSING',
        409,
      );
    }
    if (
      source.some(
        (row) =>
          row.subsidiaryId !== first.subsidiaryId ||
          row.currencyCode !== first.currencyCode ||
          row.functionalCurrencyCode !== first.functionalCurrencyCode ||
          row.exchangeRate !== first.exchangeRate,
      )
    ) {
      throw new ServiceError(
        'A project invoice must contain one subsidiary and currency context for GL posting',
        'PROJECT_BILLING_GL_MIXED_CURRENCY',
        409,
      );
    }
    const period = await this.repository.findOpenPeriod(
      first.invoiceDate,
      first.subsidiaryId,
      organizationId,
    );
    if (!period) {
      throw new ServiceError(
        'Project invoice posting requires an OPEN accounting period',
        'PROJECT_BILLING_GL_PERIOD_CLOSED',
        409,
      );
    }
    const candidates = await this.repository.findAccountCandidates(organizationId, 'billing');
    const contractIds = [...new Set(source.map((row) => row.projectContractId))];
    const states = new Map<string, ProjectContractPositionState>();
    for (const contractId of contractIds) {
      const prior = await this.repository.findPriorBillingContractState(
        invoiceId,
        contractId,
        organizationId,
      );
      states.set(contractId, {
        cumulativeRecognized: new Decimal(prior.cumulativeRecognized).toFixed(2),
        cumulativeBilled: moneyFromMinor(prior.cumulativeBilledMinor),
      });
    }
    const exchangeRate = new Decimal(first.exchangeRate);
    const lines: PersistProjectRevenueGlPostingInput['lines'] = [];
    const reconciliation = new Map<
      string,
      { cumulativeRecognized: string; cumulativeBilled: string; contractAsset: string; contractLiability: string }
    >();
    for (const row of source) {
      const posting = calculateProjectContractPositionPosting(states.get(row.projectContractId)!, {
        kind: 'billing',
        amount: moneyFromMinor(row.billedAmountMinor),
      });
      states.set(row.projectContractId, {
        cumulativeRecognized: posting.next.cumulativeRecognized,
        cumulativeBilled: posting.next.cumulativeBilled,
      });
      reconciliation.set(row.projectContractId, posting.next);
      for (const postingLine of posting.lines) {
        lines.push({
          accountId: resolveAccount(candidates, postingLine.accountRole, row),
          debitAmount: postingLine.debitAmount,
          creditAmount: postingLine.creditAmount,
          baseDebitAmount: new Decimal(postingLine.debitAmount).times(exchangeRate).toFixed(4),
          baseCreditAmount: new Decimal(postingLine.creditAmount).times(exchangeRate).toFixed(4),
          description: `Project invoice posting: ${postingLine.accountRole}`,
          projectId: row.projectId,
          customerId: row.customerId,
          projectContractId: row.projectContractId,
          projectContractVersionId: row.projectContractVersionId!,
          performanceObligationId: row.performanceObligationId,
          revenueScheduleId: row.allocationId,
        });
      }
    }
    const totalBaseDebits = lines.reduce(
      (sum, line) => sum.plus(line.baseDebitAmount),
      new Decimal(0),
    );
    const totalBaseCredits = lines.reduce(
      (sum, line) => sum.plus(line.baseCreditAmount),
      new Decimal(0),
    );
    if (!totalBaseDebits.equals(totalBaseCredits)) {
      throw new ServiceError(
        'Functional-currency project billing posting is not balanced',
        'PROJECT_BILLING_GL_UNBALANCED',
        500,
      );
    }
    const result = await this.repository.persist({
      organizationId,
      sourceEventType: 'project_billing',
      sourceEventId: invoiceId,
      description: 'Project invoice posting',
      accountingPeriodId: period.id,
      subsidiaryId: first.subsidiaryId,
      postingDate: first.invoiceDate,
      currencyCode: first.currencyCode,
      functionalCurrencyCode: first.functionalCurrencyCode,
      exchangeRate: first.exchangeRate,
      totalBaseAmount: totalBaseDebits.toFixed(4),
      idempotencyKey,
      postedBy: this.context.userId,
      lines,
    });
    return {
      replayed: result.replayed,
      glTransactionId: result.transaction.id,
      invoiceId,
      totalDebitAmount: totalBaseDebits.toFixed(4),
      totalCreditAmount: totalBaseCredits.toFixed(4),
      lineCount: lines.length,
      contractPositions: [...reconciliation.entries()].map(([projectContractId, position]) => ({
        projectContractId,
        ...position,
      })),
    };
  }
}
