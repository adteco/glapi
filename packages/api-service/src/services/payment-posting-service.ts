import { eq, and } from 'drizzle-orm';
import { BaseService } from './base-service';
import { ServiceError } from '../types';
import { EventService } from './event-service';
import { AccountingPeriodService } from './accounting-period-service';
import { db } from '@glapi/database';
import {
  customerPayments,
  customerPaymentApplications,
  accounts,
} from '@glapi/database/schema';
import type {
  CustomerPaymentWithDetails,
  PaymentApplicationWithDetails,
  CashReceiptPostingResult,
  CashReceiptGLConfig,
} from '../types';

// Type alias for Account from schema inference
type Account = typeof accounts.$inferSelect;

// ============================================================================
// Types
// ============================================================================

/**
 * GL posting configuration for payment receipt
 */
export interface PaymentGLConfig {
  /** Cash account where payment is deposited */
  cashAccountId: string;
  /** Unapplied cash/suspense account for payments not yet applied */
  unappliedCashAccountId: string;
  /** Accounts receivable account */
  arAccountId: string;
  /** Default discount expense account */
  discountAccountId?: string;
  /** Default write-off account (bad debt) */
  writeOffAccountId?: string;
}

/**
 * Input for posting a payment receipt
 */
export interface PostPaymentReceiptInput {
  paymentId: string;
  cashAccountId: string;
  unappliedCashAccountId: string;
  postingDate?: Date;
  memo?: string;
}

/**
 * Input for posting a payment application
 */
export interface PostPaymentApplicationInput {
  applicationId: string;
  unappliedCashAccountId: string;
  arAccountId: string;
  discountAccountId?: string;
  writeOffAccountId?: string;
  postingDate?: Date;
  memo?: string;
}

/**
 * Result of a GL posting operation
 */
export interface PaymentPostingResult {
  success: boolean;
  glTransactionId?: string;
  journalEntries: JournalEntry[];
  postedAt?: Date;
  error?: string;
}

/**
 * Journal entry line for posting
 */
export interface JournalEntry {
  accountId: string;
  accountNumber?: string;
  accountName?: string;
  debitAmount: string;
  creditAmount: string;
  description: string;
  reference?: string;
}

/**
 * Validation result for payment posting
 */
export interface PaymentPostingValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// Payment Posting Service
// ============================================================================

/**
 * PaymentPostingService - Handles GL posting for customer payments
 *
 * Implements proper double-entry accounting for:
 * - Payment receipt: DR Cash, CR Unapplied Cash (Suspense)
 * - Payment application: DR Unapplied Cash, CR A/R
 * - Discounts: DR Discount Expense, CR A/R
 * - Write-offs: DR Bad Debt, CR A/R
 * - Voiding: Reverse entries
 */
export class PaymentPostingService extends BaseService {
  private eventService: EventService;
  private periodService: AccountingPeriodService;

  constructor(context: { organizationId?: string; userId?: string } = {}) {
    super(context);
    this.eventService = new EventService(context);
    this.periodService = new AccountingPeriodService(context);
  }

  // ==========================================================================
  // Validation
  // ==========================================================================

  /**
   * Validate payment can be posted
   */
  async validatePaymentForPosting(paymentId: string): Promise<PaymentPostingValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const organizationId = this.requireOrganizationContext();

    // Get payment
    const [payment] = await db
      .select()
      .from(customerPayments)
      .where(
        and(
          eq(customerPayments.id, paymentId),
          eq(customerPayments.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!payment) {
      errors.push('Payment not found');
      return { isValid: false, errors, warnings };
    }

    // Check payment status
    if (payment.status === 'VOIDED') {
      errors.push('Cannot post voided payment');
    }

    // Check if already posted
    if (payment.glTransactionId) {
      errors.push('Payment already posted to GL');
    }

    // Check payment amount is valid
    const amount = parseFloat(payment.paymentAmount);
    if (amount <= 0) {
      errors.push('Payment amount must be positive');
    }

    // Check cash account
    if (!payment.cashAccountId) {
      warnings.push('No cash account specified - will use default');
    } else {
      const account = await this.validateAccount(payment.cashAccountId, 'Asset');
      if (!account.isValid) {
        errors.push(`Invalid cash account: ${account.error}`);
      }
    }

    // Validate posting date
    const postingDate = new Date().toISOString().split('T')[0];
    const periodCheck = await this.periodService.checkPostingAllowed({
      subsidiaryId: payment.subsidiaryId,
      postingDate,
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
   * Validate account exists and is correct type
   */
  private async validateAccount(
    accountId: string,
    expectedType?: string
  ): Promise<{ isValid: boolean; account?: Account; error?: string }> {
    const organizationId = this.requireOrganizationContext();

    const [account] = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.id, accountId),
          eq(accounts.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!account) {
      return { isValid: false, error: 'Account not found' };
    }

    if (!account.isActive) {
      return { isValid: false, error: 'Account is inactive' };
    }

    if (expectedType && account.accountCategory !== expectedType) {
      return {
        isValid: false,
        error: `Expected ${expectedType} account, got ${account.accountCategory}`,
      };
    }

    return { isValid: true, account };
  }

  // ==========================================================================
  // Payment Receipt Posting
  // ==========================================================================

  /**
   * Post payment receipt to GL
   *
   * Creates journal entries:
   * - DR Cash (Asset)
   * - CR Unapplied Cash / Suspense (Liability or contra-asset)
   */
  async postPaymentReceipt(input: PostPaymentReceiptInput): Promise<PaymentPostingResult> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    // Validate
    const validation = await this.validatePaymentForPosting(input.paymentId);
    if (!validation.isValid) {
      return {
        success: false,
        journalEntries: [],
        error: validation.errors.join('; '),
      };
    }

    // Get payment details
    const [payment] = await db
      .select()
      .from(customerPayments)
      .where(
        and(
          eq(customerPayments.id, input.paymentId),
          eq(customerPayments.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!payment) {
      return {
        success: false,
        journalEntries: [],
        error: 'Payment not found',
      };
    }

    const paymentAmount = payment.paymentAmount;
    const postingDate = input.postingDate || new Date();

    // Build journal entries
    const journalEntries: JournalEntry[] = [
      {
        accountId: input.cashAccountId,
        debitAmount: paymentAmount,
        creditAmount: '0.00',
        description: `Payment received: ${payment.paymentNumber}`,
        reference: payment.paymentNumber,
      },
      {
        accountId: input.unappliedCashAccountId,
        debitAmount: '0.00',
        creditAmount: paymentAmount,
        description: `Unapplied cash: ${payment.paymentNumber}`,
        reference: payment.paymentNumber,
      },
    ];

    // Enrich with account details
    await this.enrichJournalEntries(journalEntries);

    // Validate double-entry (debits = credits)
    const totalDebits = journalEntries.reduce((sum, e) => sum + parseFloat(e.debitAmount), 0);
    const totalCredits = journalEntries.reduce((sum, e) => sum + parseFloat(e.creditAmount), 0);

    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      return {
        success: false,
        journalEntries,
        error: `Journal entries not balanced: Debits=${totalDebits}, Credits=${totalCredits}`,
      };
    }

    // Generate GL transaction ID (in production, this would create actual GL transaction)
    const glTransactionId = `gl-pmt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Update payment with GL reference
    await db
      .update(customerPayments)
      .set({
        glTransactionId,
        postedAt: postingDate,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(customerPayments.id, input.paymentId));

    // Emit event
    await this.eventService.emit({
      eventType: 'PaymentPosted',
      eventCategory: 'ACCOUNTING',
      aggregateType: 'CustomerPayment',
      aggregateId: input.paymentId,
      data: {
        paymentNumber: payment.paymentNumber,
        glTransactionId,
        paymentAmount,
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

  // ==========================================================================
  // Payment Application Posting
  // ==========================================================================

  /**
   * Post payment application to GL
   *
   * Creates journal entries:
   * - DR Unapplied Cash / Suspense (clears the suspense)
   * - CR Accounts Receivable (reduces A/R)
   * - DR Discount Expense (if discount applied)
   * - DR Bad Debt Expense (if write-off applied)
   */
  async postPaymentApplication(input: PostPaymentApplicationInput): Promise<PaymentPostingResult> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    // Get application details
    const [application] = await db
      .select()
      .from(customerPaymentApplications)
      .where(
        and(
          eq(customerPaymentApplications.id, input.applicationId),
          eq(customerPaymentApplications.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!application) {
      return {
        success: false,
        journalEntries: [],
        error: 'Application not found',
      };
    }

    if (application.reversedAt) {
      return {
        success: false,
        journalEntries: [],
        error: 'Application has been reversed',
      };
    }

    // Get parent payment
    const [payment] = await db
      .select()
      .from(customerPayments)
      .where(eq(customerPayments.id, application.customerPaymentId))
      .limit(1);

    if (!payment) {
      return {
        success: false,
        journalEntries: [],
        error: 'Parent payment not found',
      };
    }

    const appliedAmount = parseFloat(application.appliedAmount);
    const discountAmount = parseFloat(application.discountAmount || '0');
    const writeOffAmount = parseFloat(application.writeOffAmount || '0');
    const totalReduction = appliedAmount + discountAmount + writeOffAmount;

    const postingDate = input.postingDate || new Date();
    const journalEntries: JournalEntry[] = [];

    // DR Unapplied Cash (clear suspense for applied amount)
    journalEntries.push({
      accountId: input.unappliedCashAccountId,
      debitAmount: appliedAmount.toFixed(2),
      creditAmount: '0.00',
      description: `Apply payment ${payment.paymentNumber} to invoice`,
      reference: payment.paymentNumber,
    });

    // CR Accounts Receivable (reduce A/R for total reduction)
    journalEntries.push({
      accountId: input.arAccountId,
      debitAmount: '0.00',
      creditAmount: totalReduction.toFixed(2),
      description: `Payment applied from ${payment.paymentNumber}`,
      reference: payment.paymentNumber,
    });

    // DR Discount Expense (if discount applied)
    if (discountAmount > 0 && input.discountAccountId) {
      journalEntries.push({
        accountId: input.discountAccountId,
        debitAmount: discountAmount.toFixed(2),
        creditAmount: '0.00',
        description: `Payment discount for ${payment.paymentNumber}`,
        reference: payment.paymentNumber,
      });
    }

    // DR Bad Debt / Write-off (if write-off applied)
    if (writeOffAmount > 0 && input.writeOffAccountId) {
      journalEntries.push({
        accountId: input.writeOffAccountId,
        debitAmount: writeOffAmount.toFixed(2),
        creditAmount: '0.00',
        description: `Write-off for ${payment.paymentNumber}`,
        reference: payment.paymentNumber,
      });
    }

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
    const glTransactionId = `gl-app-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Emit event
    await this.eventService.emit({
      eventType: 'PaymentApplicationPosted',
      eventCategory: 'ACCOUNTING',
      aggregateType: 'CustomerPaymentApplication',
      aggregateId: input.applicationId,
      data: {
        paymentNumber: payment.paymentNumber,
        glTransactionId,
        appliedAmount: appliedAmount.toFixed(2),
        discountAmount: discountAmount.toFixed(2),
        writeOffAmount: writeOffAmount.toFixed(2),
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

  // ==========================================================================
  // Void Payment Posting
  // ==========================================================================

  /**
   * Post void/reversal entries for a payment
   *
   * Creates reversing journal entries for the original posting
   */
  async postPaymentVoid(
    paymentId: string,
    config: PaymentGLConfig,
    reason: string
  ): Promise<PaymentPostingResult> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    // Get payment
    const [payment] = await db
      .select()
      .from(customerPayments)
      .where(
        and(
          eq(customerPayments.id, paymentId),
          eq(customerPayments.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!payment) {
      return {
        success: false,
        journalEntries: [],
        error: 'Payment not found',
      };
    }

    if (!payment.glTransactionId) {
      // Payment was never posted, nothing to reverse
      return {
        success: true,
        journalEntries: [],
      };
    }

    const paymentAmount = payment.paymentAmount;
    const journalEntries: JournalEntry[] = [];

    // Reverse original posting: CR Cash, DR Unapplied Cash
    journalEntries.push({
      accountId: config.cashAccountId,
      debitAmount: '0.00',
      creditAmount: paymentAmount,
      description: `Void payment ${payment.paymentNumber}: ${reason}`,
      reference: payment.paymentNumber,
    });

    journalEntries.push({
      accountId: config.unappliedCashAccountId,
      debitAmount: paymentAmount,
      creditAmount: '0.00',
      description: `Void payment ${payment.paymentNumber}: ${reason}`,
      reference: payment.paymentNumber,
    });

    // Enrich with account details
    await this.enrichJournalEntries(journalEntries);

    // Generate GL transaction ID
    const glTransactionId = `gl-void-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Emit event
    await this.eventService.emit({
      eventType: 'PaymentVoidPosted',
      eventCategory: 'ACCOUNTING',
      aggregateType: 'CustomerPayment',
      aggregateId: paymentId,
      data: {
        paymentNumber: payment.paymentNumber,
        originalGlTransactionId: payment.glTransactionId,
        reversalGlTransactionId: glTransactionId,
        reason,
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
      postedAt: new Date(),
    };
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * Enrich journal entries with account details
   */
  private async enrichJournalEntries(entries: JournalEntry[]): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    const accountIds = entries.map((e) => e.accountId);

    const accountsData = await db
      .select({
        id: accounts.id,
        accountNumber: accounts.accountNumber,
        accountName: accounts.accountName,
      })
      .from(accounts)
      .where(
        and(
          eq(accounts.organizationId, organizationId)
        )
      );

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

  /**
   * Get default GL configuration for a subsidiary
   */
  async getDefaultGLConfig(subsidiaryId: string): Promise<PaymentGLConfig | null> {
    const organizationId = this.requireOrganizationContext();

    // In production, this would fetch from a subsidiary settings or GL defaults table
    // For now, we'll try to find common account types

    // TODO: When subsidiary support is added, filter by subsidiaryId
    // For now, subsidiaryId parameter is ignored until accounts table has subsidiary column
    void subsidiaryId;

    const [cashAccount] = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.organizationId, organizationId),
          eq(accounts.accountCategory, 'Asset'),
          eq(accounts.isActive, true)
        )
      )
      .limit(1);

    const [arAccount] = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.organizationId, organizationId),
          eq(accounts.accountCategory, 'Asset'),
          eq(accounts.isActive, true)
        )
      )
      .limit(1);

    if (!cashAccount || !arAccount) {
      return null;
    }

    return {
      cashAccountId: cashAccount.id,
      unappliedCashAccountId: cashAccount.id, // Would be different in production
      arAccountId: arAccount.id,
    };
  }

  /**
   * Get posting summary for a payment
   */
  async getPaymentPostingSummary(paymentId: string): Promise<{
    isPosted: boolean;
    glTransactionId?: string;
    postedAt?: Date;
    journalSummary?: {
      totalDebits: string;
      totalCredits: string;
      entryCount: number;
    };
  }> {
    const organizationId = this.requireOrganizationContext();

    const [payment] = await db
      .select({
        glTransactionId: customerPayments.glTransactionId,
        postedAt: customerPayments.postedAt,
      })
      .from(customerPayments)
      .where(
        and(
          eq(customerPayments.id, paymentId),
          eq(customerPayments.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!payment) {
      throw new ServiceError('Payment not found', 'NOT_FOUND', 404);
    }

    return {
      isPosted: !!payment.glTransactionId,
      glTransactionId: payment.glTransactionId || undefined,
      postedAt: payment.postedAt || undefined,
    };
  }
}
