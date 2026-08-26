import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import type { ContextualDatabase } from '../context';
import { accounts } from '../db/schema/accounts';
import { accountingPeriods } from '../db/schema/accounting-periods';
import { glAccountMappings } from '../db/schema/gl-account-mappings';
import { glTransactionLines, glTransactions } from '../db/schema/gl-transactions';
import { invoiceSourceAllocations } from '../db/schema/invoice-source-allocations';
import { invoices } from '../db/schema/invoices';
import { performanceObligations } from '../db/schema/performance-obligations';
import { projectContracts } from '../db/schema/project-contracts';
import { revenueJournalEntries } from '../db/schema/revenue-journal-entries';
import {
  revenueRecognitionRunItems,
  revenueRecognitionRuns,
} from '../db/schema/revenue-recognition-runs';
import { revenueSchedules } from '../db/schema/revenue-schedules';
import { BaseRepository } from './base-repository';

export interface ProjectRevenueGlSourceRow {
  recognitionRunId: string;
  accountingPeriodId: string;
  recognitionDate: string;
  subsidiaryId: string;
  scheduleId: string;
  performanceObligationId: string;
  projectContractId: string;
  projectContractVersionId: string | null;
  projectId: string;
  customerId: string;
  itemId: string | null;
  currencyCode: string;
  functionalCurrencyCode: string;
  exchangeRate: string;
  recognizedAmount: string;
}

export interface ProjectGlAccountCandidate {
  accountRole: string;
  accountId: string;
  subsidiaryId: string | null;
  itemId: string | null;
  priority: number;
  isDefault: boolean;
}

export interface ProjectBillingGlSourceRow {
  invoiceId: string;
  invoiceDate: string;
  subsidiaryId: string;
  allocationId: string;
  projectContractId: string;
  projectContractVersionId: string | null;
  projectId: string;
  customerId: string;
  performanceObligationId: string | null;
  currencyCode: string;
  functionalCurrencyCode: string;
  exchangeRate: string;
  billedAmountMinor: number;
}

export interface PersistProjectRevenueGlPostingInput {
  organizationId: string;
  sourceEventType: 'project_revenue_recognition' | 'project_billing';
  sourceEventId: string;
  description: string;
  recognitionRunId?: string;
  accountingPeriodId: string;
  subsidiaryId: string;
  postingDate: string;
  currencyCode: string;
  functionalCurrencyCode: string;
  exchangeRate: string;
  totalBaseAmount: string;
  idempotencyKey: string;
  postedBy?: string;
  lines: Array<{
    accountId: string;
    debitAmount: string;
    creditAmount: string;
    baseDebitAmount: string;
    baseCreditAmount: string;
    description: string;
    projectId: string;
    customerId: string;
    projectContractId: string;
    projectContractVersionId: string;
    performanceObligationId: string | null;
    revenueScheduleId: string;
  }>;
}

export class ProjectRevenueGlPostingRepository extends BaseRepository {
  constructor(db?: ContextualDatabase) {
    super(db);
  }

  async findRunSource(runId: string, organizationId: string): Promise<ProjectRevenueGlSourceRow[]> {
    return this.db
      .select({
        recognitionRunId: revenueRecognitionRuns.id,
        accountingPeriodId: revenueRecognitionRuns.accountingPeriodId,
        recognitionDate: revenueRecognitionRuns.recognitionDate,
        subsidiaryId: revenueRecognitionRuns.subsidiaryId,
        scheduleId: revenueSchedules.id,
        performanceObligationId: performanceObligations.id,
        projectContractId: projectContracts.id,
        projectContractVersionId: revenueSchedules.projectContractVersionId,
        projectId: projectContracts.projectId,
        customerId: projectContracts.customerId,
        itemId: performanceObligations.itemId,
        currencyCode: projectContracts.transactionCurrencyCode,
        functionalCurrencyCode: projectContracts.functionalCurrencyCode,
        exchangeRate: projectContracts.exchangeRate,
        recognizedAmount: revenueRecognitionRunItems.recognizedAmount,
      })
      .from(revenueRecognitionRuns)
      .innerJoin(
        revenueRecognitionRunItems,
        eq(revenueRecognitionRunItems.recognitionRunId, revenueRecognitionRuns.id),
      )
      .innerJoin(revenueSchedules, eq(revenueSchedules.id, revenueRecognitionRunItems.revenueScheduleId))
      .innerJoin(
        performanceObligations,
        eq(performanceObligations.id, revenueSchedules.performanceObligationId),
      )
      .innerJoin(
        glTransactions,
        and(
          eq(glTransactions.organizationId, organizationId),
          eq(glTransactions.sourceEventType, 'project_revenue_recognition'),
          eq(glTransactions.sourceEventId, revenueRecognitionRunItems.recognitionRunId),
          eq(glTransactions.status, 'POSTED'),
        ),
      )
      .innerJoin(projectContracts, eq(projectContracts.id, performanceObligations.projectContractId))
      .where(
        and(
          eq(revenueRecognitionRuns.id, runId),
          eq(revenueRecognitionRuns.organizationId, organizationId),
          eq(revenueRecognitionRunItems.organizationId, organizationId),
          eq(projectContracts.organizationId, organizationId),
        ),
      )
      .orderBy(asc(projectContracts.id), asc(revenueSchedules.scheduleDate), asc(revenueSchedules.id));
  }

  async findPriorContractState(
    runId: string,
    projectContractId: string,
    organizationId: string,
  ) {
    const [recognized] = await this.db
      .select({
        amount: sql<string>`COALESCE(SUM(${revenueRecognitionRunItems.recognizedAmount}), 0)::text`,
      })
      .from(revenueRecognitionRunItems)
      .innerJoin(revenueSchedules, eq(revenueSchedules.id, revenueRecognitionRunItems.revenueScheduleId))
      .innerJoin(
        performanceObligations,
        eq(performanceObligations.id, revenueSchedules.performanceObligationId),
      )
      .where(
        and(
          eq(revenueRecognitionRunItems.organizationId, organizationId),
          eq(performanceObligations.projectContractId, projectContractId),
          ne(revenueRecognitionRunItems.recognitionRunId, runId),
        ),
      );
    const [billed] = await this.db
      .select({
        amountMinor: sql<number>`COALESCE(SUM(${invoiceSourceAllocations.sourceAmountMinor}), 0)::bigint`.mapWith(
          Number,
        ),
      })
      .from(invoiceSourceAllocations)
      .innerJoin(invoices, eq(invoices.id, invoiceSourceAllocations.invoiceId))
      .where(
        and(
          eq(invoiceSourceAllocations.organizationId, organizationId),
          eq(invoiceSourceAllocations.projectContractId, projectContractId),
          eq(invoiceSourceAllocations.allocationStatus, 'active'),
          inArray(invoices.status, ['sent', 'paid', 'partial', 'overdue']),
        ),
      );
    return {
      cumulativeRecognized: recognized?.amount ?? '0.00',
      cumulativeBilledMinor: billed?.amountMinor ?? 0,
    };
  }

  async findBillingSource(invoiceId: string, organizationId: string): Promise<ProjectBillingGlSourceRow[]> {
    return this.db
      .select({
        invoiceId: invoices.id,
        invoiceDate: invoices.invoiceDate,
        subsidiaryId: projectContracts.subsidiaryId,
        allocationId: invoiceSourceAllocations.id,
        projectContractId: projectContracts.id,
        projectContractVersionId: invoiceSourceAllocations.projectContractVersionId,
        projectId: projectContracts.projectId,
        customerId: projectContracts.customerId,
        performanceObligationId: performanceObligations.id,
        currencyCode: invoiceSourceAllocations.currencyCode,
        functionalCurrencyCode: projectContracts.functionalCurrencyCode,
        exchangeRate: projectContracts.exchangeRate,
        billedAmountMinor: invoiceSourceAllocations.sourceAmountMinor,
      })
      .from(invoiceSourceAllocations)
      .innerJoin(invoices, eq(invoices.id, invoiceSourceAllocations.invoiceId))
      .innerJoin(projectContracts, eq(projectContracts.id, invoiceSourceAllocations.projectContractId))
      .leftJoin(
        performanceObligations,
        and(
          eq(performanceObligations.organizationId, organizationId),
          eq(
            performanceObligations.projectContractLineId,
            invoiceSourceAllocations.projectContractLineId,
          ),
        ),
      )
      .where(
        and(
          eq(invoices.id, invoiceId),
          eq(invoices.organizationId, organizationId),
          inArray(invoices.status, ['sent', 'paid', 'partial', 'overdue']),
          eq(invoiceSourceAllocations.organizationId, organizationId),
          eq(invoiceSourceAllocations.allocationStatus, 'active'),
        ),
      )
      .orderBy(asc(projectContracts.id), asc(invoiceSourceAllocations.id));
  }

  async findOpenPeriod(
    postingDate: string,
    subsidiaryId: string,
    organizationId: string,
  ) {
    const [period] = await this.db
      .select({ id: accountingPeriods.id })
      .from(accountingPeriods)
      .where(
        and(
          eq(accountingPeriods.organizationId, organizationId),
          eq(accountingPeriods.subsidiaryId, subsidiaryId),
          eq(accountingPeriods.status, 'OPEN'),
          sql`${accountingPeriods.startDate} <= ${postingDate}`,
          sql`${accountingPeriods.endDate} >= ${postingDate}`,
        ),
      )
      .limit(1);
    return period ?? null;
  }

  async findPriorBillingContractState(
    invoiceId: string,
    projectContractId: string,
    organizationId: string,
  ) {
    const [recognized] = await this.db
      .select({
        amount: sql<string>`COALESCE(SUM(${revenueRecognitionRunItems.recognizedAmount}), 0)::text`,
      })
      .from(revenueRecognitionRunItems)
      .innerJoin(revenueSchedules, eq(revenueSchedules.id, revenueRecognitionRunItems.revenueScheduleId))
      .innerJoin(
        performanceObligations,
        eq(performanceObligations.id, revenueSchedules.performanceObligationId),
      )
      .innerJoin(
        glTransactions,
        and(
          eq(glTransactions.organizationId, organizationId),
          eq(glTransactions.sourceEventType, 'project_revenue_recognition'),
          eq(glTransactions.sourceEventId, revenueRecognitionRunItems.recognitionRunId),
          eq(glTransactions.status, 'POSTED'),
        ),
      )
      .where(
        and(
          eq(revenueRecognitionRunItems.organizationId, organizationId),
          eq(performanceObligations.projectContractId, projectContractId),
        ),
      );
    const [billed] = await this.db
      .select({
        amountMinor: sql<number>`COALESCE(SUM(${invoiceSourceAllocations.sourceAmountMinor}), 0)::bigint`.mapWith(
          Number,
        ),
      })
      .from(invoiceSourceAllocations)
      .innerJoin(invoices, eq(invoices.id, invoiceSourceAllocations.invoiceId))
      .where(
        and(
          eq(invoiceSourceAllocations.organizationId, organizationId),
          eq(invoiceSourceAllocations.projectContractId, projectContractId),
          eq(invoiceSourceAllocations.allocationStatus, 'active'),
          inArray(invoices.status, ['sent', 'paid', 'partial', 'overdue']),
          ne(invoices.id, invoiceId),
        ),
      );
    return {
      cumulativeRecognized: recognized?.amount ?? '0.00',
      cumulativeBilledMinor: billed?.amountMinor ?? 0,
    };
  }

  async findAccountCandidates(
    organizationId: string,
    transactionType: 'recognition' | 'billing' = 'recognition',
  ): Promise<ProjectGlAccountCandidate[]> {
    const roles =
      transactionType === 'recognition'
        ? ['revenue', 'contract_asset', 'contract_liability']
        : ['ar', 'contract_asset', 'contract_liability'];
    return this.db
      .select({
        accountRole: glAccountMappings.accountType,
        accountId: accounts.id,
        subsidiaryId: glAccountMappings.subsidiaryId,
        itemId: glAccountMappings.itemId,
        priority: glAccountMappings.priority,
        isDefault: glAccountMappings.isDefault,
      })
      .from(glAccountMappings)
      .innerJoin(
        accounts,
        and(
          eq(accounts.organizationId, organizationId),
          eq(accounts.accountNumber, glAccountMappings.glAccountCode),
          eq(accounts.isActive, true),
        ),
      )
      .where(
        and(
          eq(glAccountMappings.organizationId, organizationId),
          eq(glAccountMappings.transactionType, transactionType),
          eq(glAccountMappings.isActive, true),
          inArray(glAccountMappings.accountType, roles),
        ),
      )
      .orderBy(desc(glAccountMappings.priority), asc(glAccountMappings.id));
  }

  async persist(input: PersistProjectRevenueGlPostingInput) {
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${input.organizationId}:${input.sourceEventType}:${input.sourceEventId}:gl-posting`}, 0))`,
      );
      const [existing] = await tx
        .select()
        .from(glTransactions)
        .where(
          and(
            eq(glTransactions.organizationId, input.organizationId),
            eq(glTransactions.sourceEventType, input.sourceEventType),
            eq(glTransactions.sourceEventId, input.sourceEventId),
          ),
        )
        .limit(1);
      if (existing) return { transaction: existing, replayed: true };

      const [transaction] = await tx
        .insert(glTransactions)
        .values({
          organizationId: input.organizationId,
          transactionNumber: `${input.sourceEventType === 'project_billing' ? 'PBI' : 'PRR'}-${input.sourceEventId}`,
          subsidiaryId: input.subsidiaryId,
          transactionDate: input.postingDate,
          postingDate: input.postingDate,
          periodId: input.accountingPeriodId,
          transactionType: 'POSTING',
          sourceSystem: 'AUTO',
          sourceEventType: input.sourceEventType,
          sourceEventId: input.sourceEventId,
          idempotencyKey: input.idempotencyKey,
          description: input.description,
          referenceNumber: input.sourceEventId,
          baseCurrencyCode: input.functionalCurrencyCode,
          totalDebitAmount: input.totalBaseAmount,
          totalCreditAmount: input.totalBaseAmount,
          status: 'POSTED',
          autoGenerated: true,
          postedBy: input.postedBy,
          postedDate: new Date(),
        })
        .returning();
      await tx.insert(glTransactionLines).values(
        input.lines.map((line, index) => ({
          organizationId: input.organizationId,
          transactionId: transaction.id,
          lineNumber: index + 1,
          accountId: line.accountId,
          subsidiaryId: input.subsidiaryId,
          debitAmount: line.debitAmount,
          creditAmount: line.creditAmount,
          currencyCode: input.currencyCode,
          exchangeRate: input.exchangeRate,
          baseDebitAmount: line.baseDebitAmount,
          baseCreditAmount: line.baseCreditAmount,
          description: line.description,
          reference1: input.sourceEventId,
          reference2: line.revenueScheduleId,
          projectId: line.projectId,
          customerId: line.customerId,
          projectContractId: line.projectContractId,
          projectContractVersionId: line.projectContractVersionId,
          performanceObligationId: line.performanceObligationId,
          sourceEventType: input.sourceEventType,
          sourceEventId: input.sourceEventId,
        })),
      );
      if (input.recognitionRunId) {
        await tx
          .update(revenueJournalEntries)
          .set({ status: 'posted', journalEntryReference: transaction.id })
          .where(
            and(
              eq(revenueJournalEntries.organizationId, input.organizationId),
              eq(revenueJournalEntries.recognitionRunId, input.recognitionRunId),
            ),
          );
      }
      return { transaction, replayed: false };
    });
  }
}
