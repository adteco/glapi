import { eq, and, desc, sql, gte, lte, inArray } from 'drizzle-orm';
import { BaseService } from './base-service';
import { ServiceError, type PaginatedResult, type PaginationParams } from '../types';
import { EventService } from './event-service';
import { AccountingPeriodService } from './accounting-period-service';
import { db as globalDb, type ContextualDatabase } from '@glapi/database';
import {
  bankDeposits,
  customerPayments,
  bankReconciliationExceptions,
  entities,
  accounts,
  BankDepositStatus,
  ReconciliationStatus,
  CustomerPaymentStatus,
  type NewBankDeposit,
  type NewBankReconciliationException,
} from '@glapi/database/schema';

export interface BankDepositServiceOptions {
  db?: ContextualDatabase;
}
import type {
  CreateBankDepositInput,
  AddPaymentsToDepositInput,
  SubmitDepositInput,
  ReconcileDepositInput,
  CreateReconciliationExceptionInput,
  ResolveExceptionInput,
  BankDepositFilters,
  BankDepositWithDetails,
  CustomerPaymentWithDetails,
  ReconciliationExceptionWithDetails,
  DepositBatchSummary,
  CustomerPaymentStatusValue,
} from '../types';

// ==========================================================================
// GL Posting Types
// ==========================================================================

/**
 * Input for posting a deposit to GL
 */
export interface PostDepositToGLInput {
  depositId: string;
  bankAccountId: string;
  undepositedFundsAccountId: string;
  postingDate?: Date;
  memo?: string;
}

/**
 * GL configuration for deposit posting
 */
export interface DepositGLConfig {
  /** The bank account where funds are deposited */
  bankAccountId: string;
  /** The undeposited funds/cash on hand account to clear */
  undepositedFundsAccountId: string;
}

/**
 * Result of a GL posting operation
 */
export interface DepositPostingResult {
  success: boolean;
  glTransactionId?: string;
  journalEntries: DepositJournalEntry[];
  postedAt?: Date;
  error?: string;
}

/**
 * Journal entry line for deposit posting
 */
export interface DepositJournalEntry {
  accountId: string;
  accountNumber?: string;
  accountName?: string;
  debitAmount: string;
  creditAmount: string;
  description: string;
  reference?: string;
}

/**
 * Validation result for deposit posting
 */
export interface DepositPostingValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * BankDepositService - Handles bank deposit batching and reconciliation
 *
 * Key responsibilities:
 * - Create and manage bank deposit batches
 * - Add/remove payments from deposits
 * - Submit deposits for reconciliation
 * - Reconcile deposits against bank statements
 * - Track reconciliation exceptions
 */
export class BankDepositService extends BaseService {
  private db: ContextualDatabase;
  private eventService: EventService;
  private periodService: AccountingPeriodService;

  constructor(context: { organizationId?: string; userId?: string } = {}, options: BankDepositServiceOptions = {}) {
    super(context);
    this.db = options.db ?? globalDb;
    this.eventService = new EventService(context);
    this.periodService = new AccountingPeriodService(context, { db: options.db });
  }

  // ==========================================================================
  // Deposit Number Generation
  // ==========================================================================

  private async generateDepositNumber(subsidiaryId: string): Promise<string> {
    const organizationId = this.requireOrganizationContext();
    const year = new Date().getFullYear();
    const prefix = `DEP-${year}-`;

    const [result] = await this.db
      .select({
        maxNumber: sql<string>`MAX(${bankDeposits.depositNumber})`,
      })
      .from(bankDeposits)
      .where(
        and(
          eq(bankDeposits.organizationId, organizationId),
          sql`${bankDeposits.depositNumber} LIKE ${prefix + '%'}`
        )
      );

    let nextNumber = 1;
    if (result?.maxNumber) {
      const currentNum = parseInt(result.maxNumber.replace(prefix, ''), 10);
      if (!isNaN(currentNum)) {
        nextNumber = currentNum + 1;
      }
    }

    return `${prefix}${String(nextNumber).padStart(6, '0')}`;
  }

  // ==========================================================================
  // Create Bank Deposit
  // ==========================================================================

  /**
   * Create a new bank deposit batch
   */
  async createDeposit(input: CreateBankDepositInput): Promise<BankDepositWithDetails> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    // Generate deposit number
    const depositNumber = await this.generateDepositNumber(input.subsidiaryId);

    // Get bank account name if not provided
    let bankAccountName = input.bankAccountName;
    if (!bankAccountName && input.bankAccountId) {
      const [account] = await this.db
        .select({ name: accounts.accountName })
        .from(accounts)
        .where(eq(accounts.id, input.bankAccountId))
        .limit(1);
      bankAccountName = account?.name;
    }

    // Create deposit record
    const depositData: NewBankDeposit = {
      organizationId,
      subsidiaryId: input.subsidiaryId,
      depositNumber,
      depositDate: typeof input.depositDate === 'string'
        ? input.depositDate
        : input.depositDate.toISOString().split('T')[0],
      bankAccountId: input.bankAccountId,
      bankAccountName,
      currencyCode: input.currencyCode || 'USD',
      totalAmount: '0.00',
      paymentCount: 0,
      status: 'OPEN',
      reconciliationStatus: 'PENDING',
      memo: input.memo,
      internalNotes: input.internalNotes,
      metadata: input.metadata,
      createdBy: userId,
    };

    const [deposit] = await this.db.insert(bankDeposits).values(depositData).returning();

    // Emit event
    await this.eventService.emit({
      eventType: 'BankDepositCreated',
      eventCategory: 'PAYMENT',
      aggregateType: 'BankDeposit',
      aggregateId: deposit.id,
      data: {
        depositNumber: deposit.depositNumber,
        bankAccountId: deposit.bankAccountId,
        depositDate: deposit.depositDate,
      },
    });

    // Add payments if provided
    if (input.paymentIds && input.paymentIds.length > 0) {
      await this.addPaymentsToDeposit({
        depositId: deposit.id,
        paymentIds: input.paymentIds,
      });
    }

    return this.getDepositById(deposit.id) as Promise<BankDepositWithDetails>;
  }

  // ==========================================================================
  // Add/Remove Payments
  // ==========================================================================

  /**
   * Add payments to a deposit batch
   */
  async addPaymentsToDeposit(input: AddPaymentsToDepositInput): Promise<BankDepositWithDetails> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    // Get deposit
    const deposit = await this.getDepositById(input.depositId);
    if (!deposit) {
      throw new ServiceError('Deposit not found', 'NOT_FOUND', 404);
    }

    if (deposit.status !== BankDepositStatus.OPEN) {
      throw new ServiceError(
        `Cannot add payments to ${deposit.status} deposit`,
        'INVALID_STATUS',
        400
      );
    }

    // Validate payments
    const payments = await this.db
      .select()
      .from(customerPayments)
      .where(
        and(
          eq(customerPayments.organizationId, organizationId),
          inArray(customerPayments.id, input.paymentIds)
        )
      );

    for (const payment of payments) {
      if (payment.bankDepositId) {
        throw new ServiceError(
          `Payment ${payment.paymentNumber} is already assigned to a deposit`,
          'ALREADY_ASSIGNED',
          400
        );
      }

      if (payment.status === CustomerPaymentStatus.VOIDED) {
        throw new ServiceError(
          `Payment ${payment.paymentNumber} is voided`,
          'PAYMENT_VOIDED',
          400
        );
      }

      // Check subsidiary matches
      if (payment.subsidiaryId !== deposit.subsidiaryId) {
        throw new ServiceError(
          `Payment ${payment.paymentNumber} subsidiary does not match deposit`,
          'SUBSIDIARY_MISMATCH',
          400
        );
      }
    }

    // Assign payments to deposit
    await this.db
      .update(customerPayments)
      .set({
        bankDepositId: input.depositId,
        status: 'DEPOSITED' as any,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(inArray(customerPayments.id, input.paymentIds));

    // Update deposit totals
    await this.updateDepositTotals(input.depositId);

    // Emit event
    await this.eventService.emit({
      eventType: 'PaymentsAddedToDeposit',
      eventCategory: 'PAYMENT',
      aggregateType: 'BankDeposit',
      aggregateId: input.depositId,
      data: {
        paymentIds: input.paymentIds,
        count: input.paymentIds.length,
      },
    });

    return this.getDepositById(input.depositId) as Promise<BankDepositWithDetails>;
  }

  /**
   * Remove payments from a deposit batch
   */
  async removePaymentsFromDeposit(depositId: string, paymentIds: string[]): Promise<BankDepositWithDetails> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    // Get deposit
    const deposit = await this.getDepositById(depositId);
    if (!deposit) {
      throw new ServiceError('Deposit not found', 'NOT_FOUND', 404);
    }

    if (deposit.status !== BankDepositStatus.OPEN) {
      throw new ServiceError(
        `Cannot remove payments from ${deposit.status} deposit`,
        'INVALID_STATUS',
        400
      );
    }

    // Remove payments from deposit
    for (const paymentId of paymentIds) {
      const [payment] = await this.db
        .select()
        .from(customerPayments)
        .where(
          and(
            eq(customerPayments.id, paymentId),
            eq(customerPayments.bankDepositId, depositId)
          )
        )
        .limit(1);

      if (!payment) continue;

      // Determine appropriate status based on applied amount
      const appliedAmount = parseFloat(payment.appliedAmount);
      const unappliedAmount = parseFloat(payment.unappliedAmount);
      let newStatus: CustomerPaymentStatusValue;

      if (appliedAmount < 0.01) {
        newStatus = 'RECEIVED';
      } else if (unappliedAmount < 0.01) {
        newStatus = 'FULLY_APPLIED';
      } else {
        newStatus = 'PARTIALLY_APPLIED';
      }

      await this.db
        .update(customerPayments)
        .set({
          bankDepositId: null,
          status: newStatus,
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(customerPayments.id, paymentId));
    }

    // Update deposit totals
    await this.updateDepositTotals(depositId);

    return this.getDepositById(depositId) as Promise<BankDepositWithDetails>;
  }

  // ==========================================================================
  // Submit Deposit
  // ==========================================================================

  /**
   * Submit a deposit for bank reconciliation
   */
  async submitDeposit(input: SubmitDepositInput): Promise<BankDepositWithDetails> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const deposit = await this.getDepositById(input.depositId);
    if (!deposit) {
      throw new ServiceError('Deposit not found', 'NOT_FOUND', 404);
    }

    if (deposit.status !== BankDepositStatus.OPEN) {
      throw new ServiceError(
        `Cannot submit ${deposit.status} deposit`,
        'INVALID_STATUS',
        400
      );
    }

    if (deposit.paymentCount === 0) {
      throw new ServiceError('Cannot submit empty deposit', 'EMPTY_DEPOSIT', 400);
    }

    // Update status
    await this.db
      .update(bankDeposits)
      .set({
        status: 'SUBMITTED',
        submittedAt: new Date(),
        submittedBy: userId,
        memo: input.memo || deposit.memo,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(bankDeposits.id, input.depositId));

    // Emit event
    await this.eventService.emit({
      eventType: 'BankDepositSubmitted',
      eventCategory: 'PAYMENT',
      aggregateType: 'BankDeposit',
      aggregateId: input.depositId,
      data: {
        depositNumber: deposit.depositNumber,
        totalAmount: deposit.totalAmount,
        paymentCount: deposit.paymentCount,
      },
    });

    return this.getDepositById(input.depositId) as Promise<BankDepositWithDetails>;
  }

  // ==========================================================================
  // Cancel Deposit
  // ==========================================================================

  /**
   * Cancel a deposit batch
   */
  async cancelDeposit(depositId: string, reason: string): Promise<BankDepositWithDetails> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const deposit = await this.getDepositById(depositId);
    if (!deposit) {
      throw new ServiceError('Deposit not found', 'NOT_FOUND', 404);
    }

    if (deposit.status === BankDepositStatus.RECONCILED) {
      throw new ServiceError('Cannot cancel reconciled deposit', 'ALREADY_RECONCILED', 400);
    }

    if (deposit.status === BankDepositStatus.CANCELLED) {
      throw new ServiceError('Deposit already cancelled', 'ALREADY_CANCELLED', 400);
    }

    // Remove all payments from deposit first
    const payments = await this.db
      .select()
      .from(customerPayments)
      .where(eq(customerPayments.bankDepositId, depositId));

    if (payments.length > 0) {
      await this.removePaymentsFromDeposit(
        depositId,
        payments.map((p) => p.id)
      );
    }

    // Cancel the deposit
    await this.db
      .update(bankDeposits)
      .set({
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledBy: userId,
        cancellationReason: reason,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(bankDeposits.id, depositId));

    // Emit event
    await this.eventService.emit({
      eventType: 'BankDepositCancelled',
      eventCategory: 'PAYMENT',
      aggregateType: 'BankDeposit',
      aggregateId: depositId,
      data: {
        depositNumber: deposit.depositNumber,
        reason,
      },
    });

    return this.getDepositById(depositId) as Promise<BankDepositWithDetails>;
  }

  // ==========================================================================
  // Reconciliation
  // ==========================================================================

  /**
   * Reconcile a deposit against bank statement
   */
  async reconcileDeposit(input: ReconcileDepositInput): Promise<BankDepositWithDetails> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const deposit = await this.getDepositById(input.depositId);
    if (!deposit) {
      throw new ServiceError('Deposit not found', 'NOT_FOUND', 404);
    }

    if (deposit.status !== BankDepositStatus.SUBMITTED) {
      throw new ServiceError(
        `Cannot reconcile ${deposit.status} deposit`,
        'INVALID_STATUS',
        400
      );
    }

    // Check for amount variance
    if (input.bankStatementAmount) {
      const systemAmount = parseFloat(deposit.totalAmount);
      const bankAmount = parseFloat(String(input.bankStatementAmount));
      const variance = Math.abs(systemAmount - bankAmount);

      if (variance > 0.01) {
        // Create reconciliation exception
        await this.createReconciliationException({
          bankDepositId: input.depositId,
          exceptionType: 'AMOUNT_VARIANCE',
          exceptionDescription: `Bank statement amount ${bankAmount.toFixed(2)} differs from system amount ${systemAmount.toFixed(2)} by ${variance.toFixed(2)}`,
          bankStatementDate: input.bankStatementDate,
          bankStatementRef: input.bankStatementRef,
          bankStatementAmount: input.bankStatementAmount,
          systemAmount: deposit.totalAmount,
        });
      }
    }

    // Update deposit as reconciled
    await this.db
      .update(bankDeposits)
      .set({
        status: 'RECONCILED',
        reconciliationStatus: 'MATCHED',
        reconciledAt: new Date(),
        reconciledBy: userId,
        bankStatementDate: typeof input.bankStatementDate === 'string'
          ? input.bankStatementDate
          : input.bankStatementDate.toISOString().split('T')[0],
        bankStatementRef: input.bankStatementRef,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(bankDeposits.id, input.depositId));

    // Update all payments in deposit to reconciled status
    await this.db
      .update(customerPayments)
      .set({
        status: 'RECONCILED',
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(customerPayments.bankDepositId, input.depositId));

    // Emit event
    await this.eventService.emit({
      eventType: 'BankDepositReconciled',
      eventCategory: 'PAYMENT',
      aggregateType: 'BankDeposit',
      aggregateId: input.depositId,
      data: {
        depositNumber: deposit.depositNumber,
        bankStatementDate: input.bankStatementDate,
        bankStatementRef: input.bankStatementRef,
      },
    });

    return this.getDepositById(input.depositId) as Promise<BankDepositWithDetails>;
  }

  // ==========================================================================
  // Reconciliation Exceptions
  // ==========================================================================

  /**
   * Create a reconciliation exception
   */
  async createReconciliationException(
    input: CreateReconciliationExceptionInput
  ): Promise<ReconciliationExceptionWithDetails> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    // Calculate variance if both amounts provided
    let varianceAmount: string | undefined;
    if (input.bankStatementAmount && input.systemAmount) {
      const bankAmt = parseFloat(String(input.bankStatementAmount));
      const sysAmt = parseFloat(String(input.systemAmount));
      varianceAmount = (bankAmt - sysAmt).toFixed(2);
    }

    const exceptionData: NewBankReconciliationException = {
      organizationId,
      bankDepositId: input.bankDepositId,
      customerPaymentId: input.customerPaymentId,
      exceptionType: input.exceptionType,
      exceptionDescription: input.exceptionDescription,
      bankStatementDate: input.bankStatementDate
        ? typeof input.bankStatementDate === 'string'
          ? input.bankStatementDate
          : input.bankStatementDate.toISOString().split('T')[0]
        : undefined,
      bankStatementRef: input.bankStatementRef,
      bankStatementAmount: input.bankStatementAmount
        ? String(parseFloat(String(input.bankStatementAmount)).toFixed(2))
        : undefined,
      systemAmount: input.systemAmount
        ? String(parseFloat(String(input.systemAmount)).toFixed(2))
        : undefined,
      varianceAmount,
      status: 'EXCEPTION',
      createdBy: userId,
    };

    const [exception] = await this.db
      .insert(bankReconciliationExceptions)
      .values(exceptionData)
      .returning();

    // Update deposit reconciliation status if linked
    if (input.bankDepositId) {
      await this.db
        .update(bankDeposits)
        .set({
          reconciliationStatus: 'EXCEPTION',
          updatedAt: new Date(),
        })
        .where(eq(bankDeposits.id, input.bankDepositId));
    }

    // Emit event
    await this.eventService.emit({
      eventType: 'ReconciliationExceptionCreated',
      eventCategory: 'PAYMENT',
      aggregateType: 'ReconciliationException',
      aggregateId: exception.id,
      data: {
        exceptionType: exception.exceptionType,
        bankDepositId: exception.bankDepositId,
        varianceAmount,
      },
    });

    return this.getExceptionById(exception.id) as Promise<ReconciliationExceptionWithDetails>;
  }

  /**
   * Resolve a reconciliation exception
   */
  async resolveException(input: ResolveExceptionInput): Promise<ReconciliationExceptionWithDetails> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const exception = await this.getExceptionById(input.exceptionId);
    if (!exception) {
      throw new ServiceError('Exception not found', 'NOT_FOUND', 404);
    }

    if (exception.status === ReconciliationStatus.RESOLVED) {
      throw new ServiceError('Exception already resolved', 'ALREADY_RESOLVED', 400);
    }

    // Resolve the exception
    await this.db
      .update(bankReconciliationExceptions)
      .set({
        status: 'RESOLVED',
        resolutionNotes: input.resolutionNotes,
        resolvedAt: new Date(),
        resolvedBy: userId,
      })
      .where(eq(bankReconciliationExceptions.id, input.exceptionId));

    // Check if deposit has any more unresolved exceptions
    if (exception.bankDepositId) {
      const [unresolved] = await this.db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(bankReconciliationExceptions)
        .where(
          and(
            eq(bankReconciliationExceptions.bankDepositId, exception.bankDepositId),
            eq(bankReconciliationExceptions.status, 'EXCEPTION')
          )
        );

      if (unresolved.count === 0) {
        await this.db
          .update(bankDeposits)
          .set({
            reconciliationStatus: 'MATCHED',
            updatedAt: new Date(),
          })
          .where(eq(bankDeposits.id, exception.bankDepositId));
      }
    }

    // Emit event
    await this.eventService.emit({
      eventType: 'ReconciliationExceptionResolved',
      eventCategory: 'PAYMENT',
      aggregateType: 'ReconciliationException',
      aggregateId: input.exceptionId,
      data: {
        resolutionNotes: input.resolutionNotes,
      },
    });

    return this.getExceptionById(input.exceptionId) as Promise<ReconciliationExceptionWithDetails>;
  }

  // ==========================================================================
  // GL Posting
  // ==========================================================================

  /**
   * Validate a deposit for GL posting
   */
  async validateDepositForPosting(depositId: string): Promise<DepositPostingValidation> {
    const organizationId = this.requireOrganizationContext();

    const errors: string[] = [];
    const warnings: string[] = [];

    // Get deposit
    const [deposit] = await this.db
      .select()
      .from(bankDeposits)
      .where(
        and(
          eq(bankDeposits.id, depositId),
          eq(bankDeposits.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!deposit) {
      errors.push('Deposit not found');
      return { isValid: false, errors, warnings };
    }

    // Check status
    if (deposit.status === BankDepositStatus.CANCELLED) {
      errors.push('Cannot post cancelled deposit');
    }

    if (deposit.glTransactionId) {
      errors.push('Deposit already posted to GL');
    }

    // Check for empty deposit
    if (deposit.paymentCount === 0) {
      errors.push('Cannot post empty deposit');
    }

    // Check amount
    const totalAmount = parseFloat(deposit.totalAmount);
    if (totalAmount <= 0) {
      errors.push('Deposit amount must be positive');
    }

    // Check bank account
    if (!deposit.bankAccountId) {
      warnings.push('No bank account specified - will use default');
    }

    // Check accounting period
    const periodCheck = await this.periodService.checkPostingAllowed({
      subsidiaryId: deposit.subsidiaryId,
      postingDate: deposit.depositDate,
      isAdjustment: false,
    });
    if (!periodCheck.canPost) {
      errors.push(`Cannot post: ${periodCheck.reason}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Post a deposit to GL
   *
   * Creates journal entries:
   * - DR Bank Account (where funds are deposited)
   * - CR Undeposited Funds / Cash on Hand (clearing the holding account)
   */
  async postDepositToGL(input: PostDepositToGLInput): Promise<DepositPostingResult> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    // Validate
    const validation = await this.validateDepositForPosting(input.depositId);
    if (!validation.isValid) {
      return {
        success: false,
        journalEntries: [],
        error: validation.errors.join('; '),
      };
    }

    // Get deposit details
    const [deposit] = await this.db
      .select()
      .from(bankDeposits)
      .where(
        and(
          eq(bankDeposits.id, input.depositId),
          eq(bankDeposits.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!deposit) {
      return {
        success: false,
        journalEntries: [],
        error: 'Deposit not found',
      };
    }

    const totalAmount = parseFloat(deposit.totalAmount);
    const postingDate = input.postingDate || new Date();
    const journalEntries: DepositJournalEntry[] = [];

    // DR Bank Account (money deposited to bank)
    journalEntries.push({
      accountId: input.bankAccountId,
      debitAmount: totalAmount.toFixed(2),
      creditAmount: '0.00',
      description: `Bank deposit ${deposit.depositNumber}`,
      reference: deposit.depositNumber,
    });

    // CR Undeposited Funds / Cash on Hand (clearing the holding account)
    journalEntries.push({
      accountId: input.undepositedFundsAccountId,
      debitAmount: '0.00',
      creditAmount: totalAmount.toFixed(2),
      description: `Clear undeposited funds for ${deposit.depositNumber}`,
      reference: deposit.depositNumber,
    });

    // Enrich with account details
    await this.enrichJournalEntries(journalEntries);

    // Validate double-entry
    const totalDebits = journalEntries.reduce((sum, e) => sum + parseFloat(e.debitAmount), 0);
    const totalCredits = journalEntries.reduce((sum, e) => sum + parseFloat(e.creditAmount), 0);

    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      return {
        success: false,
        journalEntries,
        error: `Journal entries not balanced: Debits=${totalDebits.toFixed(2)}, Credits=${totalCredits.toFixed(2)}`,
      };
    }

    // Generate GL transaction ID
    const glTransactionId = `gl-dep-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Update deposit with GL reference
    await this.db
      .update(bankDeposits)
      .set({
        glTransactionId,
        postedAt: postingDate,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(bankDeposits.id, input.depositId));

    // Emit event
    await this.eventService.emit({
      eventType: 'BankDepositPosted',
      eventCategory: 'ACCOUNTING',
      aggregateType: 'BankDeposit',
      aggregateId: input.depositId,
      data: {
        depositNumber: deposit.depositNumber,
        glTransactionId,
        totalAmount: totalAmount.toFixed(2),
        paymentCount: deposit.paymentCount,
        journalEntries: journalEntries.map((e) => ({
          accountId: e.accountId,
          debit: e.debitAmount,
          credit: e.creditAmount,
        })),
      },
    });

    return {
      success: true,
      glTransactionId,
      journalEntries,
      postedAt: postingDate,
    };
  }

  /**
   * Submit deposit and post to GL in one operation
   */
  async submitDepositWithPosting(
    input: SubmitDepositInput,
    glConfig: DepositGLConfig
  ): Promise<{ deposit: BankDepositWithDetails; postingResult: DepositPostingResult }> {
    // First submit the deposit
    const deposit = await this.submitDeposit(input);

    // Then post to GL
    const postingResult = await this.postDepositToGL({
      depositId: input.depositId,
      bankAccountId: glConfig.bankAccountId,
      undepositedFundsAccountId: glConfig.undepositedFundsAccountId,
      memo: input.memo,
    });

    // Get updated deposit with GL info
    const updatedDeposit = await this.getDepositById(input.depositId);

    return {
      deposit: updatedDeposit!,
      postingResult,
    };
  }

  /**
   * Get GL posting summary for a deposit
   */
  async getDepositGLSummary(depositId: string): Promise<{
    isPosted: boolean;
    glTransactionId?: string;
    postedAt?: string;
    totalAmount: string;
    paymentCount: number;
  }> {
    const deposit = await this.getDepositById(depositId);
    if (!deposit) {
      throw new ServiceError('Deposit not found', 'NOT_FOUND', 404);
    }

    return {
      isPosted: !!deposit.glTransactionId,
      glTransactionId: deposit.glTransactionId,
      postedAt: deposit.postedAt,
      totalAmount: deposit.totalAmount,
      paymentCount: deposit.paymentCount,
    };
  }

  /**
   * Enrich journal entries with account details
   */
  private async enrichJournalEntries(entries: DepositJournalEntry[]): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    const accountIds = entries.map((e) => e.accountId);

    const accountsData = await this.db
      .select({
        id: accounts.id,
        accountNumber: accounts.accountNumber,
        accountName: accounts.accountName,
      })
      .from(accounts)
      .where(eq(accounts.organizationId, organizationId));

    type AccountLookup = { id: string; accountNumber: string; accountName: string };
    const accountMap = new Map<string, AccountLookup>(accountsData.map((a) => [a.id, a]));

    for (const entry of entries) {
      const account = accountMap.get(entry.accountId);
      if (account) {
        entry.accountNumber = account.accountNumber;
        entry.accountName = account.accountName;
      }
    }
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private async updateDepositTotals(depositId: string): Promise<void> {
    // Calculate totals from assigned payments
    const [totals] = await this.db
      .select({
        totalAmount: sql<string>`COALESCE(SUM(CAST(${customerPayments.paymentAmount} AS NUMERIC)), 0)::text`,
        paymentCount: sql<number>`COUNT(*)::int`,
      })
      .from(customerPayments)
      .where(eq(customerPayments.bankDepositId, depositId));

    await this.db
      .update(bankDeposits)
      .set({
        totalAmount: parseFloat(totals?.totalAmount || '0').toFixed(2),
        paymentCount: totals?.paymentCount || 0,
        updatedAt: new Date(),
      })
      .where(eq(bankDeposits.id, depositId));
  }

  // ==========================================================================
  // Query Methods
  // ==========================================================================

  /**
   * Get deposit by ID with details
   */
  async getDepositById(id: string): Promise<BankDepositWithDetails | null> {
    const organizationId = this.requireOrganizationContext();

    const [result] = await this.db
      .select({
        deposit: bankDeposits,
        bankAccount: {
          id: accounts.id,
          name: accounts.accountName,
        },
      })
      .from(bankDeposits)
      .leftJoin(accounts, eq(bankDeposits.bankAccountId, accounts.id))
      .where(
        and(
          eq(bankDeposits.id, id),
          eq(bankDeposits.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!result) return null;

    // Get payments in this deposit
    const payments = await this.db
      .select({
        payment: customerPayments,
        entity: {
          id: entities.id,
          name: entities.name,
          email: entities.email,
        },
      })
      .from(customerPayments)
      .leftJoin(entities, eq(customerPayments.entityId, entities.id))
      .where(eq(customerPayments.bankDepositId, id));

    return {
      ...this.mapDepositToDetails(result.deposit),
      bankAccountName: result.bankAccount?.name || result.deposit.bankAccountName || undefined,
      payments: payments.map((p) => this.mapPaymentToDetails(p.payment, p.entity)),
    };
  }

  /**
   * List bank deposits
   */
  async listDeposits(
    pagination: PaginationParams,
    filters: BankDepositFilters = {}
  ): Promise<PaginatedResult<BankDepositWithDetails>> {
    const organizationId = this.requireOrganizationContext();
    const { skip, take, page, limit } = this.getPaginationParams(pagination);

    const conditions = [eq(bankDeposits.organizationId, organizationId)];

    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      conditions.push(inArray(bankDeposits.status, statuses as any));
    }

    if (filters.subsidiaryId) {
      conditions.push(eq(bankDeposits.subsidiaryId, filters.subsidiaryId));
    }

    if (filters.bankAccountId) {
      conditions.push(eq(bankDeposits.bankAccountId, filters.bankAccountId));
    }

    if (filters.depositDateFrom) {
      const dateFrom = typeof filters.depositDateFrom === 'string'
        ? filters.depositDateFrom
        : filters.depositDateFrom.toISOString().split('T')[0];
      conditions.push(gte(bankDeposits.depositDate, dateFrom));
    }

    if (filters.depositDateTo) {
      const dateTo = typeof filters.depositDateTo === 'string'
        ? filters.depositDateTo
        : filters.depositDateTo.toISOString().split('T')[0];
      conditions.push(lte(bankDeposits.depositDate, dateTo));
    }

    if (filters.reconciliationStatus) {
      conditions.push(eq(bankDeposits.reconciliationStatus, filters.reconciliationStatus));
    }

    const whereClause = and(...conditions);

    // Get total count
    const [{ count }] = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(bankDeposits)
      .where(whereClause);

    // Get paginated results
    const results = await this.db
      .select()
      .from(bankDeposits)
      .where(whereClause)
      .orderBy(desc(bankDeposits.depositDate), desc(bankDeposits.createdAt))
      .limit(take)
      .offset(skip);

    const data = results.map((d) => this.mapDepositToDetails(d));

    return this.createPaginatedResult(data, Number(count), page, limit);
  }

  /**
   * Get deposits ready for reconciliation (submitted but not reconciled)
   */
  async getDepositsForReconciliation(subsidiaryId?: string): Promise<BankDepositWithDetails[]> {
    const organizationId = this.requireOrganizationContext();

    const conditions = [
      eq(bankDeposits.organizationId, organizationId),
      eq(bankDeposits.status, 'SUBMITTED'),
    ];

    if (subsidiaryId) {
      conditions.push(eq(bankDeposits.subsidiaryId, subsidiaryId));
    }

    const results = await this.db
      .select()
      .from(bankDeposits)
      .where(and(...conditions))
      .orderBy(bankDeposits.depositDate);

    return results.map((d) => this.mapDepositToDetails(d));
  }

  /**
   * Get deposit batch summary
   */
  async getDepositBatchSummary(subsidiaryId?: string): Promise<DepositBatchSummary> {
    const organizationId = this.requireOrganizationContext();

    const baseConditions = subsidiaryId
      ? and(eq(bankDeposits.organizationId, organizationId), eq(bankDeposits.subsidiaryId, subsidiaryId))
      : eq(bankDeposits.organizationId, organizationId);

    // Get counts and totals by status
    const [summary] = await this.db
      .select({
        openDeposits: sql<number>`COUNT(*) FILTER (WHERE ${bankDeposits.status} = 'OPEN')::int`,
        submittedDeposits: sql<number>`COUNT(*) FILTER (WHERE ${bankDeposits.status} = 'SUBMITTED')::int`,
        pendingReconciliation: sql<number>`COUNT(*) FILTER (WHERE ${bankDeposits.reconciliationStatus} = 'PENDING' AND ${bankDeposits.status} != 'CANCELLED')::int`,
        totalOpenAmount: sql<string>`COALESCE(SUM(CASE WHEN ${bankDeposits.status} = 'OPEN' THEN CAST(${bankDeposits.totalAmount} AS NUMERIC) ELSE 0 END), 0)::text`,
        totalSubmittedAmount: sql<string>`COALESCE(SUM(CASE WHEN ${bankDeposits.status} = 'SUBMITTED' THEN CAST(${bankDeposits.totalAmount} AS NUMERIC) ELSE 0 END), 0)::text`,
        totalPendingAmount: sql<string>`COALESCE(SUM(CASE WHEN ${bankDeposits.reconciliationStatus} = 'PENDING' AND ${bankDeposits.status} != 'CANCELLED' THEN CAST(${bankDeposits.totalAmount} AS NUMERIC) ELSE 0 END), 0)::text`,
      })
      .from(bankDeposits)
      .where(baseConditions);

    return {
      openDeposits: summary?.openDeposits || 0,
      submittedDeposits: summary?.submittedDeposits || 0,
      pendingReconciliation: summary?.pendingReconciliation || 0,
      totalOpenAmount: parseFloat(summary?.totalOpenAmount || '0').toFixed(2),
      totalSubmittedAmount: parseFloat(summary?.totalSubmittedAmount || '0').toFixed(2),
      totalPendingAmount: parseFloat(summary?.totalPendingAmount || '0').toFixed(2),
    };
  }

  /**
   * Get unassigned payments (available for deposit)
   */
  async getUnassignedPayments(subsidiaryId: string): Promise<CustomerPaymentWithDetails[]> {
    const organizationId = this.requireOrganizationContext();

    const payments = await this.db
      .select({
        payment: customerPayments,
        entity: {
          id: entities.id,
          name: entities.name,
          email: entities.email,
        },
      })
      .from(customerPayments)
      .leftJoin(entities, eq(customerPayments.entityId, entities.id))
      .where(
        and(
          eq(customerPayments.organizationId, organizationId),
          eq(customerPayments.subsidiaryId, subsidiaryId),
          sql`${customerPayments.bankDepositId} IS NULL`,
          sql`${customerPayments.status} != 'VOIDED'`
        )
      )
      .orderBy(customerPayments.paymentDate);

    return payments.map((p) => this.mapPaymentToDetails(p.payment, p.entity));
  }

  /**
   * Get exception by ID
   */
  async getExceptionById(id: string): Promise<ReconciliationExceptionWithDetails | null> {
    const organizationId = this.requireOrganizationContext();

    const [result] = await this.db
      .select()
      .from(bankReconciliationExceptions)
      .where(
        and(
          eq(bankReconciliationExceptions.id, id),
          eq(bankReconciliationExceptions.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!result) return null;

    return this.mapExceptionToDetails(result);
  }

  /**
   * List reconciliation exceptions
   */
  async listExceptions(
    pagination: PaginationParams,
    filters: { depositId?: string; status?: string } = {}
  ): Promise<PaginatedResult<ReconciliationExceptionWithDetails>> {
    const organizationId = this.requireOrganizationContext();
    const { skip, take, page, limit } = this.getPaginationParams(pagination);

    const conditions = [eq(bankReconciliationExceptions.organizationId, organizationId)];

    if (filters.depositId) {
      conditions.push(eq(bankReconciliationExceptions.bankDepositId, filters.depositId));
    }

    if (filters.status) {
      conditions.push(eq(bankReconciliationExceptions.status, filters.status as any));
    }

    const whereClause = and(...conditions);

    // Get total count
    const [{ count }] = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(bankReconciliationExceptions)
      .where(whereClause);

    // Get paginated results
    const results = await this.db
      .select()
      .from(bankReconciliationExceptions)
      .where(whereClause)
      .orderBy(desc(bankReconciliationExceptions.createdAt))
      .limit(take)
      .offset(skip);

    const data = results.map((e) => this.mapExceptionToDetails(e));

    return this.createPaginatedResult(data, Number(count), page, limit);
  }

  // ==========================================================================
  // Mapping Helpers
  // ==========================================================================

  private mapDepositToDetails(deposit: typeof bankDeposits.$inferSelect): BankDepositWithDetails {
    return {
      id: deposit.id,
      organizationId: deposit.organizationId,
      subsidiaryId: deposit.subsidiaryId,
      depositNumber: deposit.depositNumber,
      depositDate: deposit.depositDate,
      bankAccountId: deposit.bankAccountId,
      bankAccountName: deposit.bankAccountName ?? undefined,
      currencyCode: deposit.currencyCode,
      totalAmount: deposit.totalAmount,
      paymentCount: deposit.paymentCount,
      status: deposit.status as any,
      glTransactionId: deposit.glTransactionId ?? undefined,
      postedAt: deposit.postedAt?.toISOString(),
      reconciliationStatus: deposit.reconciliationStatus as any,
      reconciledAt: deposit.reconciledAt?.toISOString(),
      reconciledBy: deposit.reconciledBy ?? undefined,
      bankStatementDate: deposit.bankStatementDate ?? undefined,
      bankStatementRef: deposit.bankStatementRef ?? undefined,
      memo: deposit.memo ?? undefined,
      internalNotes: deposit.internalNotes ?? undefined,
      metadata: deposit.metadata as Record<string, unknown> | undefined,
      createdBy: deposit.createdBy,
      createdAt: deposit.createdAt.toISOString(),
      updatedBy: deposit.updatedBy ?? undefined,
      updatedAt: deposit.updatedAt.toISOString(),
      submittedAt: deposit.submittedAt?.toISOString(),
      submittedBy: deposit.submittedBy ?? undefined,
      cancelledAt: deposit.cancelledAt?.toISOString(),
      cancelledBy: deposit.cancelledBy ?? undefined,
      cancellationReason: deposit.cancellationReason ?? undefined,
    };
  }

  private mapPaymentToDetails(
    payment: typeof customerPayments.$inferSelect,
    entity?: { id: string; name: string; email: string | null } | null
  ): CustomerPaymentWithDetails {
    return {
      id: payment.id,
      organizationId: payment.organizationId,
      subsidiaryId: payment.subsidiaryId,
      paymentNumber: payment.paymentNumber,
      externalReference: payment.externalReference ?? undefined,
      entityId: payment.entityId,
      entity: entity ? { id: entity.id, name: entity.name, email: entity.email ?? undefined } : undefined,
      paymentDate: payment.paymentDate,
      paymentMethod: payment.paymentMethod,
      checkNumber: payment.checkNumber ?? undefined,
      currencyCode: payment.currencyCode,
      exchangeRate: payment.exchangeRate,
      paymentAmount: payment.paymentAmount,
      appliedAmount: payment.appliedAmount,
      unappliedAmount: payment.unappliedAmount,
      status: payment.status as any,
      cashAccountId: payment.cashAccountId ?? undefined,
      arAccountId: payment.arAccountId ?? undefined,
      glTransactionId: payment.glTransactionId ?? undefined,
      postedAt: payment.postedAt?.toISOString(),
      bankDepositId: payment.bankDepositId ?? undefined,
      memo: payment.memo ?? undefined,
      internalNotes: payment.internalNotes ?? undefined,
      metadata: payment.metadata as Record<string, unknown> | undefined,
      createdBy: payment.createdBy,
      createdAt: payment.createdAt.toISOString(),
      updatedBy: payment.updatedBy ?? undefined,
      updatedAt: payment.updatedAt.toISOString(),
      voidedAt: payment.voidedAt?.toISOString(),
      voidedBy: payment.voidedBy ?? undefined,
      voidReason: payment.voidReason ?? undefined,
    };
  }

  private mapExceptionToDetails(
    exception: typeof bankReconciliationExceptions.$inferSelect
  ): ReconciliationExceptionWithDetails {
    return {
      id: exception.id,
      organizationId: exception.organizationId,
      bankDepositId: exception.bankDepositId ?? undefined,
      customerPaymentId: exception.customerPaymentId ?? undefined,
      exceptionType: exception.exceptionType,
      exceptionDescription: exception.exceptionDescription,
      bankStatementDate: exception.bankStatementDate ?? undefined,
      bankStatementRef: exception.bankStatementRef ?? undefined,
      bankStatementAmount: exception.bankStatementAmount ?? undefined,
      systemAmount: exception.systemAmount ?? undefined,
      varianceAmount: exception.varianceAmount ?? undefined,
      status: exception.status as any,
      resolutionNotes: exception.resolutionNotes ?? undefined,
      resolvedAt: exception.resolvedAt?.toISOString(),
      resolvedBy: exception.resolvedBy ?? undefined,
      createdBy: exception.createdBy,
      createdAt: exception.createdAt.toISOString(),
    };
  }
}
