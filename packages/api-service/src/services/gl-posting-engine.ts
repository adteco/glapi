import { BaseService } from './base-service';
import {
  BusinessTransaction,
  BusinessTransactionLine,
  GlTransaction,
  GlTransactionLine,
  GlPostingRule,
  CreateGlTransactionInput,
  CreateGlTransactionLineInput,
  ServiceError,
  // Double-entry and FX types
  DoubleEntryValidationResult,
  DoubleEntryValidationOptions,
  DoubleEntryError,
  DoubleEntryErrorCode,
  FxRateMetadata,
  FxRateSource,
  PostingAuditEntry,
  GlPostingResult,
  AccountBalanceUpdate,
} from '../types';
import { AccountingPeriodService } from './accounting-period-service';

// Re-export for backwards compatibility
export { AccountBalanceUpdate, GlPostingResult as PostingResult };

export interface PostingContext {
  businessTransaction: BusinessTransaction;
  businessTransactionLines: BusinessTransactionLine[];
  postingRules: GlPostingRule[];
  baseCurrencyCode: string;
  periodId: string;
  /** FX metadata for multi-currency transactions */
  fxMetadata?: FxRateMetadata;
  /** Options for double-entry validation */
  validationOptions?: DoubleEntryValidationOptions;
}

export class GlPostingEngine extends BaseService {
  private periodService: AccountingPeriodService;

  /** Default validation options */
  private static readonly DEFAULT_VALIDATION_OPTIONS: DoubleEntryValidationOptions = {
    tolerance: 0.01,
    validateBaseAmounts: true,
    requireBothSides: true,
    allowZeroAmountLines: false,
    validateFxRates: true,
    checkPeriodStatus: true,
  };

  constructor(context = {}) {
    super(context);
    this.periodService = new AccountingPeriodService(context);
  }

  /**
   * Generate GL entries for a business transaction with enhanced validation
   */
  async generateGlEntries(context: PostingContext): Promise<GlPostingResult> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    // Merge validation options with defaults
    const validationOptions = {
      ...GlPostingEngine.DEFAULT_VALIDATION_OPTIONS,
      ...context.validationOptions,
    };

    // Start audit entry
    const auditEntry = this.createAuditEntry(context, userId, organizationId, 'POST');

    try {
      // Validate posting context
      this.validatePostingContext(context);

      // Validate accounting period allows posting
      if (validationOptions.checkPeriodStatus) {
        await this.validatePeriodForPosting(context);
      }

      // Generate GL transaction header
      const glTransaction = await this.createGlTransactionHeader(context);

      // Generate GL lines based on posting rules
      const glLines = await this.generateGlLines(context, glTransaction.id!);

      // Perform strict double-entry validation
      const validationResult = this.validateDoubleEntry(glLines, validationOptions);

      // If validation failed, throw with audit
      if (!validationResult.isBalanced || validationResult.errors.length > 0) {
        auditEntry.success = false;
        auditEntry.validationResult = validationResult;
        await this.logPostingAudit(auditEntry);

        const errorMessages = validationResult.errors.map((e) => e.message).join('; ');
        throw new ServiceError(
          `Double-entry validation failed: ${errorMessages}`,
          'GL_TRANSACTION_NOT_BALANCED',
          400
        );
      }

      // Calculate balance updates
      const balanceUpdates = this.calculateBalanceUpdates(glLines, context);

      // Update totals on GL transaction
      glTransaction.totalDebitAmount = validationResult.totalDebits.toString();
      glTransaction.totalCreditAmount = validationResult.totalCredits.toString();

      // Prepare FX metadata
      const fxMetadata = this.buildFxMetadata(context);

      // Log successful audit
      auditEntry.success = true;
      auditEntry.validationResult = validationResult;
      auditEntry.fxMetadata = fxMetadata;
      auditEntry.glTransactionId = glTransaction.id;
      await this.logPostingAudit(auditEntry);

      return {
        glTransaction,
        glLines,
        balanceUpdates,
        validationResult,
        fxMetadata,
        auditEntryId: auditEntry.id,
      };
    } catch (error) {
      // Log failed audit if not already logged
      if (!auditEntry.success && !auditEntry.validationResult) {
        auditEntry.success = false;
        auditEntry.errorDetails = {
          code: error instanceof ServiceError ? error.code : 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        };
        await this.logPostingAudit(auditEntry);
      }
      throw error;
    }
  }

  /**
   * Validate GL transaction lines for strict double-entry compliance
   */
  validateDoubleEntry(
    glLines: GlTransactionLine[],
    options: DoubleEntryValidationOptions = {}
  ): DoubleEntryValidationResult {
    const opts = { ...GlPostingEngine.DEFAULT_VALIDATION_OPTIONS, ...options };
    const errors: DoubleEntryError[] = [];
    const warnings: string[] = [];

    let totalDebits = 0;
    let totalCredits = 0;
    let baseTotalDebits = 0;
    let baseTotalCredits = 0;
    let hasDebitLine = false;
    let hasCreditLine = false;

    // Validate minimum lines
    if (glLines.length < 2) {
      errors.push({
        code: 'INSUFFICIENT_LINES',
        message: 'GL transaction must have at least 2 lines for double-entry',
        context: { lineCount: glLines.length },
      });
    }

    // Process each line
    for (const line of glLines) {
      const debitAmount = Number(line.debitAmount || 0);
      const creditAmount = Number(line.creditAmount || 0);
      const baseDebitAmount = Number(line.baseDebitAmount || 0);
      const baseCreditAmount = Number(line.baseCreditAmount || 0);
      const exchangeRate = Number(line.exchangeRate || 1);

      // Validate amounts are non-negative
      if (debitAmount < 0) {
        errors.push({
          code: 'NEGATIVE_AMOUNT',
          message: `Line ${line.lineNumber}: Debit amount cannot be negative`,
          affectedLines: [line.lineNumber],
          context: { debitAmount },
        });
      }

      if (creditAmount < 0) {
        errors.push({
          code: 'NEGATIVE_AMOUNT',
          message: `Line ${line.lineNumber}: Credit amount cannot be negative`,
          affectedLines: [line.lineNumber],
          context: { creditAmount },
        });
      }

      // Check for zero-amount lines
      if (!opts.allowZeroAmountLines && debitAmount === 0 && creditAmount === 0) {
        warnings.push(`Line ${line.lineNumber}: Both debit and credit amounts are zero`);
      }

      // Check that line has either debit or credit (not both)
      if (debitAmount > 0 && creditAmount > 0) {
        errors.push({
          code: 'LINE_NOT_BALANCED',
          message: `Line ${line.lineNumber}: Line cannot have both debit and credit amounts`,
          affectedLines: [line.lineNumber],
          context: { debitAmount, creditAmount },
        });
      }

      // Validate exchange rate
      if (opts.validateFxRates && exchangeRate <= 0) {
        errors.push({
          code: 'INVALID_EXCHANGE_RATE',
          message: `Line ${line.lineNumber}: Exchange rate must be positive`,
          affectedLines: [line.lineNumber],
          context: { exchangeRate },
        });
      }

      // Validate base amounts match converted amounts (within tolerance)
      if (opts.validateFxRates && opts.validateBaseAmounts) {
        const expectedBaseDebit = debitAmount * exchangeRate;
        const expectedBaseCredit = creditAmount * exchangeRate;

        if (Math.abs(baseDebitAmount - expectedBaseDebit) > (opts.tolerance || 0.01)) {
          errors.push({
            code: 'FX_RATE_MISMATCH',
            message: `Line ${line.lineNumber}: Base debit amount doesn't match converted amount`,
            affectedLines: [line.lineNumber],
            context: { baseDebitAmount, expectedBaseDebit, exchangeRate },
          });
        }

        if (Math.abs(baseCreditAmount - expectedBaseCredit) > (opts.tolerance || 0.01)) {
          errors.push({
            code: 'FX_RATE_MISMATCH',
            message: `Line ${line.lineNumber}: Base credit amount doesn't match converted amount`,
            affectedLines: [line.lineNumber],
            context: { baseCreditAmount, expectedBaseCredit, exchangeRate },
          });
        }
      }

      // Accumulate totals
      totalDebits += debitAmount;
      totalCredits += creditAmount;
      baseTotalDebits += baseDebitAmount;
      baseTotalCredits += baseCreditAmount;

      if (debitAmount > 0) hasDebitLine = true;
      if (creditAmount > 0) hasCreditLine = true;
    }

    // Validate both sides present
    if (opts.requireBothSides) {
      if (!hasDebitLine) {
        errors.push({
          code: 'MISSING_DEBIT_LINE',
          message: 'GL transaction must have at least one debit line',
        });
      }
      if (!hasCreditLine) {
        errors.push({
          code: 'MISSING_CREDIT_LINE',
          message: 'GL transaction must have at least one credit line',
        });
      }
    }

    // Calculate differences
    const difference = Math.abs(totalDebits - totalCredits);
    const baseDifference = Math.abs(baseTotalDebits - baseTotalCredits);
    const tolerance = opts.tolerance || 0.01;

    // Validate transaction currency balance
    if (difference > tolerance) {
      errors.push({
        code: 'UNBALANCED_TRANSACTION',
        message: `Transaction is not balanced. Debits: ${totalDebits.toFixed(4)}, Credits: ${totalCredits.toFixed(4)}, Difference: ${difference.toFixed(4)}`,
        context: { totalDebits, totalCredits, difference, tolerance },
      });
    }

    // Validate base currency balance
    if (opts.validateBaseAmounts && baseDifference > tolerance) {
      errors.push({
        code: 'UNBALANCED_BASE_AMOUNTS',
        message: `Base currency amounts are not balanced. Debits: ${baseTotalDebits.toFixed(4)}, Credits: ${baseTotalCredits.toFixed(4)}, Difference: ${baseDifference.toFixed(4)}`,
        context: { baseTotalDebits, baseTotalCredits, baseDifference, tolerance },
      });
    }

    const isBalanced = errors.length === 0;

    return {
      isBalanced,
      totalDebits,
      totalCredits,
      difference,
      baseTotalDebits,
      baseTotalCredits,
      baseDifference,
      errors,
      warnings,
    };
  }

  /**
   * Validate that the accounting period allows posting
   */
  private async validatePeriodForPosting(context: PostingContext): Promise<void> {
    const postingDate =
      typeof context.businessTransaction.transactionDate === 'string'
        ? context.businessTransaction.transactionDate
        : context.businessTransaction.transactionDate.toISOString().split('T')[0];

    const result = await this.periodService.checkPostingAllowed({
      subsidiaryId: context.businessTransaction.subsidiaryId,
      postingDate,
      isAdjustment: false,
    });

    if (!result.canPost) {
      const errorCode: DoubleEntryErrorCode =
        result.period?.status === 'LOCKED' ? 'PERIOD_LOCKED' : 'PERIOD_CLOSED';

      throw new ServiceError(
        result.reason || 'Posting not allowed for this date',
        errorCode,
        400
      );
    }
  }

  /**
   * Build FX metadata from posting context
   */
  private buildFxMetadata(context: PostingContext): FxRateMetadata | undefined {
    // If FX metadata already provided, use it
    if (context.fxMetadata) {
      return context.fxMetadata;
    }

    // Build from business transaction if multi-currency
    const txCurrency = context.businessTransaction.currencyCode;
    const baseCurrency = context.baseCurrencyCode;

    if (txCurrency === baseCurrency) {
      return undefined; // Not a multi-currency transaction
    }

    const exchangeRate = Number(context.businessTransaction.exchangeRate || 1);

    return {
      sourceCurrency: txCurrency,
      targetCurrency: baseCurrency,
      exchangeRate: exchangeRate.toString(),
      inverseRate: (1 / exchangeRate).toString(),
      rateSource: 'SYSTEM_DEFAULT' as FxRateSource,
      rateDate: new Date().toISOString().split('T')[0],
      isLockedRate: false,
    };
  }

  /**
   * Create initial audit entry for tracking
   */
  private createAuditEntry(
    context: PostingContext,
    userId: string,
    organizationId: string,
    action: PostingAuditEntry['action']
  ): PostingAuditEntry {
    return {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      userId,
      organizationId,
      subsidiaryId: context.businessTransaction.subsidiaryId,
      sourceTransactionId: context.businessTransaction.id,
      success: false,
      action,
      validationResult: {
        isBalanced: false,
        totalDebits: 0,
        totalCredits: 0,
        difference: 0,
        baseTotalDebits: 0,
        baseTotalCredits: 0,
        baseDifference: 0,
        errors: [],
        warnings: [],
      },
    };
  }

  /**
   * Log posting audit entry
   * TODO: Implement actual audit persistence to gl_audit_trail table
   */
  private async logPostingAudit(entry: PostingAuditEntry): Promise<void> {
    // For now, log to console. In production, this would write to gl_audit_trail
    const logLevel = entry.success ? 'info' : 'warn';
    const logData = {
      auditId: entry.id,
      action: entry.action,
      success: entry.success,
      userId: entry.userId,
      organizationId: entry.organizationId,
      subsidiaryId: entry.subsidiaryId,
      glTransactionId: entry.glTransactionId,
      sourceTransactionId: entry.sourceTransactionId,
      isBalanced: entry.validationResult.isBalanced,
      totalDebits: entry.validationResult.totalDebits,
      totalCredits: entry.validationResult.totalCredits,
      errorCount: entry.validationResult.errors.length,
      warningCount: entry.validationResult.warnings.length,
      hasFxMetadata: !!entry.fxMetadata,
      timestamp: entry.timestamp.toISOString(),
    };

    // eslint-disable-next-line no-console
    console[logLevel]('[GL_POSTING_AUDIT]', JSON.stringify(logData));

    // TODO: Persist to database
    // await this.auditRepository.create(entry);
  }

  /**
   * Validate posting context has all required data
   */
  private validatePostingContext(context: PostingContext): void {
    if (!context.businessTransaction) {
      throw new ServiceError(
        'Business transaction is required for posting',
        'MISSING_BUSINESS_TRANSACTION',
        400
      );
    }

    if (!context.businessTransactionLines?.length) {
      throw new ServiceError(
        'Business transaction must have at least one line',
        'MISSING_TRANSACTION_LINES',
        400
      );
    }

    if (!context.postingRules?.length) {
      throw new ServiceError(
        'No posting rules found for transaction type',
        'MISSING_POSTING_RULES',
        400
      );
    }

    if (!context.periodId) {
      throw new ServiceError(
        'Accounting period is required for posting',
        'MISSING_PERIOD',
        400
      );
    }
  }

  /**
   * Create GL transaction header
   */
  private async createGlTransactionHeader(context: PostingContext): Promise<GlTransaction> {
    const transactionNumber = await this.generateGlTransactionNumber(context.businessTransaction.subsidiaryId);
    
    const glTransaction: CreateGlTransactionInput = {
      subsidiaryId: context.businessTransaction.subsidiaryId,
      transactionDate: context.businessTransaction.transactionDate,
      postingDate: new Date().toISOString().split('T')[0], // Today's date
      periodId: context.periodId,
      transactionType: 'POSTING',
      sourceSystem: 'AUTO',
      sourceTransactionId: context.businessTransaction.id!,
      sourceTransactionType: 'BUSINESS_TRANSACTION',
      description: `Auto-posted from ${context.businessTransaction.transactionNumber}`,
      referenceNumber: context.businessTransaction.externalReference,
      baseCurrencyCode: context.baseCurrencyCode,
      totalDebitAmount: '0', // Will be calculated from lines
      totalCreditAmount: '0', // Will be calculated from lines
      status: 'POSTED',
      autoGenerated: true,
      createdBy: this.requireUserContext(),
      postedBy: this.requireUserContext(),
      postedDate: new Date(),
    };

    // TODO: Replace with actual repository call
    return {
      ...glTransaction,
      id: `gl-${Date.now()}`, // Temporary ID
      transactionNumber, // Add the generated number
      createdDate: new Date(),
      modifiedDate: new Date(),
      versionNumber: 1,
    } as GlTransaction;
  }

  /**
   * Generate GL transaction number
   */
  private async generateGlTransactionNumber(subsidiaryId: string): Promise<string> {
    // TODO: Implement proper numbering sequence
    const year = new Date().getFullYear();
    const timestamp = Date.now().toString().slice(-6);
    return `GL-${year}-${timestamp}`;
  }

  /**
   * Generate GL lines based on posting rules
   */
  private async generateGlLines(context: PostingContext, glTransactionId: string): Promise<GlTransactionLine[]> {
    const glLines: GlTransactionLine[] = [];
    let lineNumber = 1;

    // Sort posting rules by sequence number
    const sortedRules = context.postingRules.sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    for (const rule of sortedRules) {
      const applicableLines = this.getApplicableLines(context.businessTransactionLines, rule);
      
      for (const businessLine of applicableLines) {
        const ruleLines = await this.applyPostingRule(
          rule,
          businessLine,
          context.businessTransaction,
          glTransactionId,
          lineNumber
        );
        
        glLines.push(...ruleLines);
        lineNumber += ruleLines.length;
      }
    }

    return glLines;
  }

  /**
   * Get business transaction lines that match the posting rule criteria
   */
  private getApplicableLines(businessLines: BusinessTransactionLine[], rule: GlPostingRule): BusinessTransactionLine[] {
    return businessLines.filter(line => {
      // If rule specifies line type, filter by it
      if (rule.lineType && line.lineType !== rule.lineType) {
        return false;
      }

      // TODO: Apply conditionSql if specified
      // This would evaluate SQL expressions like "line_amount > 1000"
      
      return true;
    });
  }

  /**
   * Apply a single posting rule to create GL lines
   */
  private async applyPostingRule(
    rule: GlPostingRule,
    businessLine: BusinessTransactionLine,
    businessTransaction: BusinessTransaction,
    glTransactionId: string,
    startingLineNumber: number
  ): Promise<GlTransactionLine[]> {
    const glLines: GlTransactionLine[] = [];
    
    // Calculate amount based on formula
    const amount = this.calculateAmount(rule.amountFormula || 'line_amount', businessLine);
    
    // Apply exchange rate
    const exchangeRate = Number(businessTransaction.exchangeRate || 1);
    const baseAmount = amount * exchangeRate;
    
    // Create debit line if debit account specified
    if (rule.debitAccountId) {
      const debitLine: CreateGlTransactionLineInput = {
        transactionId: glTransactionId,
        lineNumber: startingLineNumber,
        accountId: rule.debitAccountId,
        classId: businessLine.classId,
        departmentId: businessLine.departmentId,
        locationId: businessLine.locationId,
        subsidiaryId: businessTransaction.subsidiaryId,
        debitAmount: amount.toString(),
        creditAmount: '0',
        currencyCode: businessTransaction.currencyCode,
        exchangeRate: exchangeRate.toString(),
        baseDebitAmount: baseAmount.toString(),
        baseCreditAmount: '0',
        description: this.generateLineDescription(rule.descriptionTemplate, businessLine, businessTransaction),
        reference1: businessTransaction.transactionNumber,
        reference2: businessLine.description,
        projectId: businessLine.projectId,
      };

      glLines.push({
        ...debitLine,
        id: `gl-line-${Date.now()}-${startingLineNumber}`,
        createdDate: new Date(),
      } as GlTransactionLine);
    }

    // Create credit line if credit account specified
    if (rule.creditAccountId) {
      const creditLine: CreateGlTransactionLineInput = {
        transactionId: glTransactionId,
        lineNumber: startingLineNumber + 1,
        accountId: rule.creditAccountId,
        classId: businessLine.classId,
        departmentId: businessLine.departmentId,
        locationId: businessLine.locationId,
        subsidiaryId: businessTransaction.subsidiaryId,
        debitAmount: '0',
        creditAmount: amount.toString(),
        currencyCode: businessTransaction.currencyCode,
        exchangeRate: exchangeRate.toString(),
        baseDebitAmount: '0',
        baseCreditAmount: baseAmount.toString(),
        description: this.generateLineDescription(rule.descriptionTemplate, businessLine, businessTransaction),
        reference1: businessTransaction.transactionNumber,
        reference2: businessLine.description,
        projectId: businessLine.projectId,
      };

      glLines.push({
        ...creditLine,
        id: `gl-line-${Date.now()}-${startingLineNumber + 1}`,
        createdDate: new Date(),
      } as GlTransactionLine);
    }

    return glLines;
  }

  /**
   * Calculate amount based on formula
   */
  private calculateAmount(formula: string, businessLine: BusinessTransactionLine): number {
    // Simple formula evaluator - in production, this would be more sophisticated
    switch (formula.toLowerCase()) {
      case 'line_amount':
        return Number(businessLine.lineAmount || 0);
      case 'tax_amount':
        return Number(businessLine.taxAmount || 0);
      case 'cost_amount':
        return Number(businessLine.costAmount || 0);
      case 'discount_amount':
        return Number(businessLine.discountAmount || 0);
      case 'total_line_amount':
      case 'total_amount':
        return Number(businessLine.totalLineAmount || 0);
      default:
        // TODO: Implement expression evaluator for complex formulas
        return Number(businessLine.lineAmount || 0);
    }
  }

  /**
   * Generate GL line description from template
   */
  private generateLineDescription(
    template: string | undefined,
    businessLine: BusinessTransactionLine,
    businessTransaction: BusinessTransaction
  ): string {
    if (!template) {
      return businessLine.description || 'Auto-posted transaction';
    }

    // Simple template replacement - in production, this would be more sophisticated
    return template
      .replace('{line.description}', businessLine.description || '')
      .replace('{transaction.number}', businessTransaction.transactionNumber || '')
      .replace('{transaction.memo}', businessTransaction.memo || '')
      .replace('{line.itemId}', businessLine.itemId || '');
  }

  /**
   * Calculate account balance updates from GL lines
   * Includes both transaction currency and base currency amounts
   */
  private calculateBalanceUpdates(
    glLines: GlTransactionLine[],
    context: PostingContext
  ): AccountBalanceUpdate[] {
    const balanceMap = new Map<string, AccountBalanceUpdate>();

    for (const line of glLines) {
      // Create unique key for account/subsidiary/period/dimensions combination
      const key = [
        line.accountId,
        line.subsidiaryId,
        context.periodId,
        line.classId || '',
        line.departmentId || '',
        line.locationId || '',
        line.currencyCode,
      ].join('|');

      let balance = balanceMap.get(key);
      if (!balance) {
        balance = {
          accountId: line.accountId,
          subsidiaryId: line.subsidiaryId,
          periodId: context.periodId,
          classId: line.classId,
          departmentId: line.departmentId,
          locationId: line.locationId,
          currencyCode: line.currencyCode,
          debitAmount: 0,
          creditAmount: 0,
          baseDebitAmount: 0,
          baseCreditAmount: 0,
        };
        balanceMap.set(key, balance);
      }

      // Transaction currency amounts
      balance.debitAmount += Number(line.debitAmount || 0);
      balance.creditAmount += Number(line.creditAmount || 0);
      // Base currency amounts
      balance.baseDebitAmount += Number(line.baseDebitAmount || 0);
      balance.baseCreditAmount += Number(line.baseCreditAmount || 0);
    }

    return Array.from(balanceMap.values());
  }

  /**
   * Post GL entries and update balances
   */
  async postGlEntries(postingResult: GlPostingResult): Promise<void> {
    this.requireOrganizationContext();

    // TODO: Implement database operations in transaction
    // 1. Create GL transaction
    // 2. Create GL lines
    // 3. Update account balances
    // 4. Update business transaction status

    throw new ServiceError('GL posting not yet implemented', 'NOT_IMPLEMENTED', 501);
  }

  /**
   * Reverse GL entries
   */
  async reverseGlEntries(
    originalGlTransactionId: string,
    reversalReason: string,
    reversalDate: Date = new Date()
  ): Promise<GlPostingResult> {
    this.requireOrganizationContext();
    this.requireUserContext();

    // TODO: Implement GL reversal logic
    // 1. Get original GL transaction and lines
    // 2. Create reversing GL transaction
    // 3. Create reversing GL lines (swap debit/credit)
    // 4. Update account balances
    // 5. Mark original transaction as reversed

    throw new ServiceError('GL reversal not yet implemented', 'NOT_IMPLEMENTED', 501);
  }
}