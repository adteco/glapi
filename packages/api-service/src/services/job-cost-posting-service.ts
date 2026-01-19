import { BaseService } from './base-service';
import { AccountingPeriodService } from './accounting-period-service';
import { GlPostingEngine, PostingContext } from './gl-posting-engine';
import {
  BusinessTransaction,
  BusinessTransactionLine,
  GlPostingRule,
  GlPostingResult,
} from '../types';
import { ProjectCostCodeRepository } from '@glapi/database';
import { ServiceError } from '../types/common.types';
import { randomUUID } from 'crypto';

type PostingDateField = 'entryDate' | 'expenseDate';

interface BasePostingEntry {
  id: string;
  projectId: string;
  costCodeId: string;
  amount: number;
  subsidiaryId: string;
  description?: string | null;
  currencyCode?: string | null;
  entryDate?: string;
  expenseDate?: string;
}

export interface LaborPostingEntry extends BasePostingEntry {
  entryDate: string;
}

export interface ExpensePostingEntry extends BasePostingEntry {
  expenseDate: string;
}

export interface JobCostPostingResult {
  glResult: GlPostingResult;
}

export class JobCostPostingService extends BaseService {
  private postingEngine: GlPostingEngine;
  private periodService: AccountingPeriodService;
  private costCodeRepository: ProjectCostCodeRepository;

  constructor(context = {}) {
    super(context);
    this.postingEngine = new GlPostingEngine(context);
    this.periodService = new AccountingPeriodService(context);
    this.costCodeRepository = new ProjectCostCodeRepository();
  }

  async postLaborEntries(entries: LaborPostingEntry[]): Promise<JobCostPostingResult> {
    if (!entries.length) {
      throw new ServiceError('No labor entries provided for posting', 'JOB_COST_NO_ENTRIES', 400);
    }
    return this.generateJobCostPosting(entries, 'JOB_COST_LABOR');
  }

  async postExpenseEntries(entries: ExpensePostingEntry[]): Promise<JobCostPostingResult> {
    if (!entries.length) {
      throw new ServiceError('No expense entries provided for posting', 'JOB_COST_NO_ENTRIES', 400);
    }
    return this.generateJobCostPosting(entries, 'JOB_COST_EXPENSE');
  }

  private async generateJobCostPosting(
    entries: Array<LaborPostingEntry | ExpensePostingEntry>,
    transactionPrefix: string
  ): Promise<JobCostPostingResult> {
    const organizationId = this.requireOrganizationContext();
    const projectIds = await this.costCodeRepository.getAccessibleProjectIds(organizationId);
    const firstEntry = entries[0];
    const postingDate = this.getPostingDate(firstEntry);

    const subsidiarySet = new Set(entries.map((entry) => entry.subsidiaryId));
    if (subsidiarySet.size !== 1 || !firstEntry.subsidiaryId) {
      throw new ServiceError(
        'All entries must belong to the same subsidiary',
        'JOB_COST_MIXED_SUBSIDIARY',
        400
      );
    }

    const currencySet = new Set(entries.map((entry) => entry.currencyCode || 'USD'));
    if (currencySet.size !== 1) {
      throw new ServiceError('All entries must share a currency', 'JOB_COST_MIXED_CURRENCY', 400);
    }

    const period = await this.periodService.getPeriodForDate(firstEntry.subsidiaryId, postingDate);
    if (!period) {
      throw new ServiceError('No open accounting period for posting date', 'JOB_COST_NO_PERIOD', 400);
    }

    const normalizedPeriodStart = this.normalizeDate(period.startDate);
    const normalizedPeriodEnd = this.normalizeDate(period.endDate);
    for (const entry of entries) {
      const entryDate = this.getPostingDate(entry);
      if (entryDate < normalizedPeriodStart || entryDate > normalizedPeriodEnd) {
        throw new ServiceError(
          'All entries must fall within the accounting period for posting',
          'JOB_COST_PERIOD_MISMATCH',
          400
        );
      }
    }

    const transactionNumber = `${transactionPrefix}-${Date.now()}`;
    const currencyCode = firstEntry.currencyCode || 'USD';

    const businessTransaction: BusinessTransaction = {
      id: randomUUID(),
      transactionNumber,
      transactionTypeId: randomUUID(),
      subsidiaryId: firstEntry.subsidiaryId,
      transactionDate: postingDate,
      currencyCode,
      exchangeRate: '1',
      subtotalAmount: '0',
      taxAmount: '0',
      discountAmount: '0',
      totalAmount: '0',
      baseTotalAmount: '0',
      status: 'APPROVED',
    } as BusinessTransaction;

    const businessLines: BusinessTransactionLine[] = [];
    let lineNumber = 1;

    const costCodeCache = new Map<
      string,
      { costAccountId: string; wipAccountId: string; projectId: string }
    >();
    const getCostCodeAccounts = async (costCodeId: string) => {
      if (!costCodeCache.has(costCodeId)) {
        const costCode = await this.costCodeRepository.findById(costCodeId, projectIds);
        if (!costCode) {
          throw new ServiceError('Cost code not found', 'PROJECT_COST_CODE_NOT_FOUND', 404);
        }
        if (!costCode.costAccountId || !costCode.wipAccountId) {
          throw new ServiceError(
            `Cost code ${costCode.costCode} missing cost or WIP accounts`,
            'PROJECT_COST_CODE_MISSING_ACCOUNTS',
            400
          );
        }
        costCodeCache.set(costCodeId, {
          costAccountId: costCode.costAccountId,
          wipAccountId: costCode.wipAccountId,
          projectId: costCode.projectId,
        });
      }
      return costCodeCache.get(costCodeId)!;
    };

    for (const entry of entries) {
      const postingEntryDate = this.getPostingDate(entry);
      const { costAccountId, wipAccountId, projectId } = await getCostCodeAccounts(entry.costCodeId);
      const resolvedProjectId = entry.projectId || projectId;
      if (!resolvedProjectId) {
        throw new ServiceError(
          'Project is required for job cost posting',
          'JOB_COST_NO_PROJECT',
          400
        );
      }

      businessLines.push({
        id: randomUUID(),
        businessTransactionId: businessTransaction.id!,
        lineNumber: lineNumber++,
        lineType: 'JOB_COST',
        description: entry.description || 'Job cost entry',
        quantity: '1',
        unitPrice: entry.amount.toString(),
        lineAmount: entry.amount.toString(),
        totalLineAmount: entry.amount.toString(),
        accountId: costAccountId,
        projectId: resolvedProjectId,
        activityCodeId: null,
        billableFlag: true,
        costAmount: entry.amount.toString(),
        customFields: {
          debitAccountId: costAccountId,
          creditAccountId: wipAccountId,
          postingDate: postingEntryDate,
        },
      } as BusinessTransactionLine);
    }

    const postingRules: GlPostingRule[] = [
      {
        id: randomUUID(),
        transactionTypeId: businessTransaction.transactionTypeId,
        ruleName: 'Job Cost Posting Rule',
        lineType: 'JOB_COST',
        sequenceNumber: 10,
        amountFormula: 'line_amount',
        descriptionTemplate: '{line.description}',
        isActive: true,
        effectiveDate: new Date().toISOString(),
      },
    ];

    const postingContext: PostingContext = {
      businessTransaction,
      businessTransactionLines: businessLines,
      postingRules,
      baseCurrencyCode: currencyCode,
      periodId: period.id,
    };

    const glResult = await this.postingEngine.generateGlEntries(postingContext);

    return { glResult };
  }

  private getPostingDate(entry: LaborPostingEntry | ExpensePostingEntry): string {
    const rawDate = entry.entryDate || entry.expenseDate;
    if (!rawDate) {
      throw new ServiceError('Posting date is required', 'JOB_COST_NO_POSTING_DATE', 400);
    }
    return this.normalizeDate(rawDate);
  }

  private normalizeDate(dateValue: string | Date | null | undefined): string {
    if (!dateValue) {
      throw new ServiceError('Posting period date missing', 'JOB_COST_NO_PERIOD_DATE', 400);
    }
    if (dateValue instanceof Date) {
      return dateValue.toISOString().split('T')[0];
    }
    return dateValue;
  }
}
