import { randomUUID } from 'crypto';
import { BaseService } from './base-service';
import { AccountingPeriodService } from './accounting-period-service';
import { GlPostingEngine, PostingContext } from './gl-posting-engine';
import {
  BusinessTransaction,
  BusinessTransactionLine,
  GlPostingRule,
  GlPostingResult,
} from '../types';
import {
  ProjectCostCodeRepository,
  ProjectReportingRepository,
  ProjectProgressSnapshotRepository,
} from '@glapi/database';
import { ServiceError } from '../types/common.types';

interface LaborPostingEntry {
  id: string;
  projectId: string;
  costCodeId: string;
  amount: number;
  entryDate: string;
  subsidiaryId: string;
  description?: string | null;
  currencyCode?: string | null;
}

interface ExpensePostingEntry {
  id: string;
  projectId: string;
  costCodeId: string;
  amount: number;
  expenseDate: string;
  subsidiaryId: string;
  description?: string | null;
  currencyCode?: string | null;
}

interface JobCostPostingResult {
  glResult: GlPostingResult;
}

export class JobCostPostingService extends BaseService {
  private postingEngine: GlPostingEngine;
  private periodService: AccountingPeriodService;
  private costCodeRepository: ProjectCostCodeRepository;
  private reportingRepository: ProjectReportingRepository;
  private progressSnapshotRepository: ProjectProgressSnapshotRepository;

  constructor(context = {}) {
    super(context);
    this.postingEngine = new GlPostingEngine(context);
    this.periodService = new AccountingPeriodService(context);
    this.costCodeRepository = new ProjectCostCodeRepository();
    this.reportingRepository = new ProjectReportingRepository();
    this.progressSnapshotRepository = new ProjectProgressSnapshotRepository();
  }

  async postLaborEntries(entries: LaborPostingEntry[]): Promise<JobCostPostingResult> {
    if (!entries.length) {
      throw new ServiceError('No labor entries provided for posting', 'JOB_COST_NO_ENTRIES', 400);
    }
    const result = await this.generateJobCostPosting(entries, 'JOB_COST_LABOR');
    const glTransactionId = result.glResult.glTransaction.id || null;
    await this.recordProgressSnapshots(
      this.collectProjectIds(entries),
      glTransactionId
    );
    return result;
  }

  async postExpenseEntries(entries: ExpensePostingEntry[]): Promise<JobCostPostingResult> {
    if (!entries.length) {
      throw new ServiceError('No expense entries provided for posting', 'JOB_COST_NO_ENTRIES', 400);
    }
    const result = await this.generateJobCostPosting(entries, 'JOB_COST_EXPENSE');
    const glTransactionId = result.glResult.glTransaction.id || null;
    await this.recordProgressSnapshots(
      this.collectProjectIds(entries),
      glTransactionId
    );
    return result;
  }

  private collectProjectIds(entries: Array<LaborPostingEntry | ExpensePostingEntry>): string[] {
    const ids = Array.from(new Set(entries.map((entry) => entry.projectId).filter(Boolean)));
    return ids;
  }

  private async recordProgressSnapshots(
    projectIds: string[],
    sourceGlTransactionId: string | null
  ): Promise<void> {
    if (!projectIds.length) return;
    const organizationId = this.requireOrganizationContext();
    const summaries = await this.reportingRepository.getJobCostSummary(organizationId, {
      projectIds,
    });
    if (!summaries.length) return;

    const today = new Date().toISOString().split('T')[0];

    await this.progressSnapshotRepository.createSnapshots(
      summaries.map((summary) => ({
        organizationId,
        projectId: summary.projectId,
        subsidiaryId: summary.subsidiaryId,
        snapshotDate: today,
        totalBudgetAmount: summary.totalBudgetAmount ?? '0',
        totalCommittedAmount: summary.totalCommittedAmount ?? '0',
        totalActualCost: summary.totalActualCost ?? '0',
        totalWipClearing: summary.totalWipClearing ?? '0',
        percentComplete: summary.percentComplete ?? '0',
        sourceGlTransactionId,
      }))
    );
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
      const entryDate = this.getPostingDate(entry);
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
        lineType: 'ITEM', // Use ITEM for job cost entries
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
          postingDate: entryDate,
          costType: transactionPrefix, // Track original type
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
    // Handle union type by checking for each property
    const rawDate = 'entryDate' in entry ? entry.entryDate : entry.expenseDate;
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
