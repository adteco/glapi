/**
 * Posting Rule Engine
 *
 * Evaluates posting rules against business transactions to generate
 * balanced GL entries. Ensures all generated entries comply with
 * double-entry accounting principles.
 */

import {
  PostingRule,
  PostingRuleSet,
  PostingCondition,
  SimpleCondition,
  CompositeCondition,
  AmountFormula,
  ConditionOperator,
  PostingEvaluationResult,
  GeneratedGlLine,
  AppliedRuleInfo,
  BalanceValidationResult,
  ValidationError,
  ValidationErrorCode,
  ValidationSettings,
  DimensionInheritanceRule,
} from './types';

// ============================================================================
// Input Types
// ============================================================================

/**
 * Business transaction for posting
 */
export interface BusinessTransactionInput {
  id: string;
  transactionNumber: string;
  transactionType: string;
  transactionDate: string;
  subsidiaryId: string;
  currencyCode: string;
  exchangeRate: number;
  customerId?: string;
  vendorId?: string;
  projectId?: string;
  departmentId?: string;
  locationId?: string;
  classId?: string;
  memo?: string;
  isReversal?: boolean;
  isIntercompany?: boolean;
  totalAmount: number;
  taxTotal?: number;
  discountTotal?: number;
  subtotal?: number;
}

/**
 * Business transaction line for posting
 */
export interface BusinessTransactionLineInput {
  id: string;
  lineNumber: number;
  lineType: string;
  itemId?: string;
  itemType?: string;
  itemCategory?: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxAmount?: number;
  discountAmount?: number;
  costAmount?: number;
  taxCode?: string;
  isBillable?: boolean;
  departmentId?: string;
  locationId?: string;
  classId?: string;
  projectId?: string;
}

// ============================================================================
// Posting Rule Engine
// ============================================================================

/**
 * Engine for evaluating posting rules and generating GL entries
 */
export class PostingRuleEngine {
  private ruleSet: PostingRuleSet;

  constructor(ruleSet: PostingRuleSet) {
    this.ruleSet = ruleSet;
  }

  /**
   * Evaluate posting rules for a business transaction
   */
  evaluate(
    transaction: BusinessTransactionInput,
    lines: BusinessTransactionLineInput[]
  ): PostingEvaluationResult {
    const generatedLines: GeneratedGlLine[] = [];
    const appliedRules: AppliedRuleInfo[] = [];
    const warnings: string[] = [];
    let lineNumber = 1;

    // Get applicable rules for this transaction type
    const applicableRules = this.getApplicableRules(transaction);

    if (applicableRules.length === 0) {
      warnings.push(`No posting rules found for transaction type: ${transaction.transactionType}`);
    }

    // Process each rule in sequence order
    for (const rule of applicableRules) {
      const ruleResult = this.applyRule(rule, transaction, lines, lineNumber);

      if (ruleResult.lines.length > 0) {
        generatedLines.push(...ruleResult.lines);
        lineNumber += ruleResult.lines.length;

        appliedRules.push({
          ruleId: rule.id,
          ruleName: rule.name,
          linesGenerated: ruleResult.lines.length,
          totalAmount: ruleResult.totalAmount,
          conditionsEvaluated: !!rule.condition,
        });
      }

      warnings.push(...ruleResult.warnings);
    }

    // Validate the generated entries
    const validation = this.validateBalance(generatedLines, this.ruleSet.validationSettings);

    return {
      lines: generatedLines,
      appliedRules,
      validation,
      warnings,
    };
  }

  /**
   * Get rules applicable to this transaction
   */
  private getApplicableRules(transaction: BusinessTransactionInput): PostingRule[] {
    const now = new Date().toISOString().split('T')[0];

    return this.ruleSet.rules
      .filter((rule) => {
        // Check if rule is active
        if (!rule.isActive) return false;

        // Check transaction type
        if (rule.transactionType !== transaction.transactionType) return false;

        // Check subsidiary restriction
        if (rule.subsidiaryId && rule.subsidiaryId !== transaction.subsidiaryId) return false;

        // Check effective date
        if (rule.effectiveDate > now) return false;

        // Check expiration date
        if (rule.expirationDate && rule.expirationDate < now) return false;

        return true;
      })
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  }

  /**
   * Apply a single posting rule
   */
  private applyRule(
    rule: PostingRule,
    transaction: BusinessTransactionInput,
    transactionLines: BusinessTransactionLineInput[],
    startingLineNumber: number
  ): { lines: GeneratedGlLine[]; totalAmount: number; warnings: string[] } {
    const generatedLines: GeneratedGlLine[] = [];
    const warnings: string[] = [];
    let totalAmount = 0;
    let lineNumber = startingLineNumber;

    // Get lines that match the rule's line type filter
    const applicableLines = this.getApplicableLines(transactionLines, rule);

    for (const line of applicableLines) {
      // Evaluate condition if present
      if (rule.condition) {
        const conditionMet = this.evaluateCondition(rule.condition, transaction, line);
        if (!conditionMet) continue;
      }

      // Calculate amount
      const amount = this.evaluateFormula(rule.amountFormula, transaction, line);
      if (amount === 0 && !this.ruleSet.validationSettings.allowZeroAmountLines) {
        continue;
      }

      totalAmount += amount;

      // Generate debit line if debit account specified
      if (rule.debitAccountId) {
        generatedLines.push(
          this.createGlLine(
            rule,
            transaction,
            line,
            lineNumber++,
            rule.debitAccountId,
            amount,
            0,
            'debit'
          )
        );
      }

      // Generate credit line if credit account specified
      if (rule.creditAccountId) {
        generatedLines.push(
          this.createGlLine(
            rule,
            transaction,
            line,
            lineNumber++,
            rule.creditAccountId,
            0,
            amount,
            'credit'
          )
        );
      }
    }

    return { lines: generatedLines, totalAmount, warnings };
  }

  /**
   * Get lines that match the rule's line type filter
   */
  private getApplicableLines(
    lines: BusinessTransactionLineInput[],
    rule: PostingRule
  ): BusinessTransactionLineInput[] {
    if (!rule.lineType || rule.lineType === 'ALL') {
      return lines;
    }
    return lines.filter((line) => line.lineType === rule.lineType);
  }

  /**
   * Evaluate a posting condition
   */
  private evaluateCondition(
    condition: PostingCondition,
    transaction: BusinessTransactionInput,
    line: BusinessTransactionLineInput
  ): boolean {
    if (condition.type === 'simple') {
      return this.evaluateSimpleCondition(condition, transaction, line);
    } else {
      return this.evaluateCompositeCondition(condition, transaction, line);
    }
  }

  /**
   * Evaluate a simple condition
   */
  private evaluateSimpleCondition(
    condition: SimpleCondition,
    transaction: BusinessTransactionInput,
    line: BusinessTransactionLineInput
  ): boolean {
    const fieldValue = this.getFieldValue(condition.field, transaction, line);
    const conditionValue = condition.value;

    switch (condition.operator) {
      case ConditionOperator.EQUALS:
        return fieldValue === conditionValue;

      case ConditionOperator.NOT_EQUALS:
        return fieldValue !== conditionValue;

      case ConditionOperator.GREATER_THAN:
        return Number(fieldValue) > Number(conditionValue);

      case ConditionOperator.GREATER_OR_EQUAL:
        return Number(fieldValue) >= Number(conditionValue);

      case ConditionOperator.LESS_THAN:
        return Number(fieldValue) < Number(conditionValue);

      case ConditionOperator.LESS_OR_EQUAL:
        return Number(fieldValue) <= Number(conditionValue);

      case ConditionOperator.IN:
        return Array.isArray(conditionValue) && (conditionValue as unknown[]).includes(fieldValue);

      case ConditionOperator.NOT_IN:
        return Array.isArray(conditionValue) && !(conditionValue as unknown[]).includes(fieldValue);

      case ConditionOperator.IS_NULL:
        return fieldValue === null || fieldValue === undefined;

      case ConditionOperator.IS_NOT_NULL:
        return fieldValue !== null && fieldValue !== undefined;

      case ConditionOperator.CONTAINS:
        return String(fieldValue).includes(String(conditionValue));

      case ConditionOperator.STARTS_WITH:
        return String(fieldValue).startsWith(String(conditionValue));

      case ConditionOperator.ENDS_WITH:
        return String(fieldValue).endsWith(String(conditionValue));

      default:
        return false;
    }
  }

  /**
   * Evaluate a composite condition
   */
  private evaluateCompositeCondition(
    condition: CompositeCondition,
    transaction: BusinessTransactionInput,
    line: BusinessTransactionLineInput
  ): boolean {
    if (condition.operator === 'AND') {
      return condition.conditions.every((c) => this.evaluateCondition(c, transaction, line));
    } else {
      return condition.conditions.some((c) => this.evaluateCondition(c, transaction, line));
    }
  }

  /**
   * Get a field value from transaction or line
   */
  private getFieldValue(
    field: string,
    transaction: BusinessTransactionInput,
    line: BusinessTransactionLineInput
  ): unknown {
    const [source, fieldName] = field.split('.');

    if (source === 'line') {
      return (line as unknown as Record<string, unknown>)[fieldName];
    } else if (source === 'transaction') {
      return (transaction as unknown as Record<string, unknown>)[fieldName];
    }

    return undefined;
  }

  /**
   * Evaluate an amount formula
   */
  private evaluateFormula(
    formula: AmountFormula,
    transaction: BusinessTransactionInput,
    line: BusinessTransactionLineInput
  ): number {
    switch (formula.type) {
      case 'field': {
        const value = this.getFieldValue(formula.field, transaction, line);
        return Number(value) || 0;
      }

      case 'constant':
        return formula.value;

      case 'arithmetic': {
        const left = this.evaluateFormula(formula.left, transaction, line);
        const right = this.evaluateFormula(formula.right, transaction, line);

        switch (formula.operator) {
          case '+':
            return left + right;
          case '-':
            return left - right;
          case '*':
            return left * right;
          case '/':
            return right !== 0 ? left / right : 0;
          default:
            return 0;
        }
      }

      case 'conditional': {
        const conditionMet = this.evaluateCondition(formula.condition, transaction, line);
        return this.evaluateFormula(conditionMet ? formula.ifTrue : formula.ifFalse, transaction, line);
      }

      default:
        return 0;
    }
  }

  /**
   * Create a GL line from a posting rule
   */
  private createGlLine(
    rule: PostingRule,
    transaction: BusinessTransactionInput,
    line: BusinessTransactionLineInput,
    lineNumber: number,
    accountId: string,
    debitAmount: number,
    creditAmount: number,
    side: 'debit' | 'credit'
  ): GeneratedGlLine {
    const baseDebitAmount = debitAmount * transaction.exchangeRate;
    const baseCreditAmount = creditAmount * transaction.exchangeRate;

    // Apply dimension inheritance
    const dimensions = this.resolveDimensions(rule, transaction, line);

    // Generate description
    const description = this.generateDescription(rule, transaction, line);

    return {
      lineNumber,
      accountId,
      debitAmount,
      creditAmount,
      currencyCode: transaction.currencyCode,
      exchangeRate: transaction.exchangeRate,
      baseDebitAmount,
      baseCreditAmount,
      description,
      subsidiaryId: transaction.subsidiaryId,
      ...dimensions,
      sourceLineId: line.id,
      sourceRuleId: rule.id,
    };
  }

  /**
   * Resolve dimensions for a GL line
   */
  private resolveDimensions(
    rule: PostingRule,
    transaction: BusinessTransactionInput,
    line: BusinessTransactionLineInput
  ): Partial<GeneratedGlLine> {
    const dimensions: Partial<GeneratedGlLine> = {};

    // Get dimension rules (rule-specific or defaults)
    const dimensionRules = rule.dimensionRules || this.ruleSet.defaultDimensionRules;

    for (const dimRule of dimensionRules) {
      let value: string | undefined;

      switch (dimRule.source.type) {
        case 'line':
          value = (line as unknown as Record<string, unknown>)[dimRule.source.field] as string;
          break;
        case 'transaction':
          value = (transaction as unknown as Record<string, unknown>)[dimRule.source.field] as string;
          break;
        case 'constant':
          value = dimRule.source.value;
          break;
      }

      // Use default if no value found
      if (!value && dimRule.defaultValue) {
        value = dimRule.defaultValue;
      }

      // Set the dimension if we have a value
      if (value) {
        const targetKey = this.getDimensionKey(dimRule.targetDimension);
        if (targetKey) {
          (dimensions as Record<string, string>)[targetKey] = value;
        }
      }
    }

    return dimensions;
  }

  /**
   * Get the property key for a dimension
   */
  private getDimensionKey(dimension: string): string | null {
    const mapping: Record<string, string> = {
      SUBSIDIARY: 'subsidiaryId',
      DEPARTMENT: 'departmentId',
      LOCATION: 'locationId',
      CLASS: 'classId',
      PROJECT: 'projectId',
      CUSTOMER: 'customerId',
      VENDOR: 'vendorId',
      ITEM: 'itemId',
    };
    return mapping[dimension] || null;
  }

  /**
   * Generate description for a GL line
   */
  private generateDescription(
    rule: PostingRule,
    transaction: BusinessTransactionInput,
    line: BusinessTransactionLineInput
  ): string {
    if (!rule.descriptionTemplate) {
      return line.description || `Auto-posted from ${transaction.transactionNumber}`;
    }

    // Simple template replacement
    return rule.descriptionTemplate
      .replace('{line.description}', line.description || '')
      .replace('{line.itemId}', line.itemId || '')
      .replace('{transaction.number}', transaction.transactionNumber)
      .replace('{transaction.memo}', transaction.memo || '')
      .replace('{transaction.date}', transaction.transactionDate);
  }

  /**
   * Validate that generated lines are balanced
   */
  validateBalance(
    lines: GeneratedGlLine[],
    settings: ValidationSettings
  ): BalanceValidationResult {
    const errors: ValidationError[] = [];

    let totalDebits = 0;
    let totalCredits = 0;
    let baseTotalDebits = 0;
    let baseTotalCredits = 0;
    let hasDebitLine = false;
    let hasCreditLine = false;

    // Check minimum lines
    if (lines.length < 2) {
      errors.push({
        code: ValidationErrorCode.INSUFFICIENT_LINES,
        message: 'GL transaction must have at least 2 lines for double-entry',
        context: { lineCount: lines.length },
      });
    }

    // Check maximum lines
    if (settings.maxLinesPerTransaction && lines.length > settings.maxLinesPerTransaction) {
      errors.push({
        code: ValidationErrorCode.TOO_MANY_LINES,
        message: `GL transaction exceeds maximum of ${settings.maxLinesPerTransaction} lines`,
        context: { lineCount: lines.length, max: settings.maxLinesPerTransaction },
      });
    }

    // Process each line
    for (const line of lines) {
      // Validate non-negative amounts
      if (line.debitAmount < 0) {
        errors.push({
          code: ValidationErrorCode.NEGATIVE_AMOUNT,
          message: `Line ${line.lineNumber}: Debit amount cannot be negative`,
          affectedLines: [line.lineNumber],
          context: { debitAmount: line.debitAmount },
        });
      }

      if (line.creditAmount < 0) {
        errors.push({
          code: ValidationErrorCode.NEGATIVE_AMOUNT,
          message: `Line ${line.lineNumber}: Credit amount cannot be negative`,
          affectedLines: [line.lineNumber],
          context: { creditAmount: line.creditAmount },
        });
      }

      // Check for zero-amount lines
      if (!settings.allowZeroAmountLines && line.debitAmount === 0 && line.creditAmount === 0) {
        errors.push({
          code: ValidationErrorCode.ZERO_AMOUNT_LINE,
          message: `Line ${line.lineNumber}: Both debit and credit amounts are zero`,
          affectedLines: [line.lineNumber],
        });
      }

      // Check that line has either debit or credit (not both)
      if (line.debitAmount > 0 && line.creditAmount > 0) {
        errors.push({
          code: ValidationErrorCode.LINE_NOT_BALANCED,
          message: `Line ${line.lineNumber}: Line cannot have both debit and credit amounts`,
          affectedLines: [line.lineNumber],
          context: { debitAmount: line.debitAmount, creditAmount: line.creditAmount },
        });
      }

      // Validate exchange rate
      if (settings.validateFxRates && line.exchangeRate <= 0) {
        errors.push({
          code: ValidationErrorCode.INVALID_EXCHANGE_RATE,
          message: `Line ${line.lineNumber}: Exchange rate must be positive`,
          affectedLines: [line.lineNumber],
          context: { exchangeRate: line.exchangeRate },
        });
      }

      // Validate base amounts match converted amounts
      if (settings.validateFxRates && settings.validateBaseAmounts) {
        const expectedBaseDebit = line.debitAmount * line.exchangeRate;
        const expectedBaseCredit = line.creditAmount * line.exchangeRate;

        if (Math.abs(line.baseDebitAmount - expectedBaseDebit) > settings.balanceTolerance) {
          errors.push({
            code: ValidationErrorCode.FX_RATE_MISMATCH,
            message: `Line ${line.lineNumber}: Base debit doesn't match converted amount`,
            affectedLines: [line.lineNumber],
            context: {
              baseDebitAmount: line.baseDebitAmount,
              expectedBaseDebit,
              exchangeRate: line.exchangeRate,
            },
          });
        }

        if (Math.abs(line.baseCreditAmount - expectedBaseCredit) > settings.balanceTolerance) {
          errors.push({
            code: ValidationErrorCode.FX_RATE_MISMATCH,
            message: `Line ${line.lineNumber}: Base credit doesn't match converted amount`,
            affectedLines: [line.lineNumber],
            context: {
              baseCreditAmount: line.baseCreditAmount,
              expectedBaseCredit,
              exchangeRate: line.exchangeRate,
            },
          });
        }
      }

      // Accumulate totals
      totalDebits += line.debitAmount;
      totalCredits += line.creditAmount;
      baseTotalDebits += line.baseDebitAmount;
      baseTotalCredits += line.baseCreditAmount;

      if (line.debitAmount > 0) hasDebitLine = true;
      if (line.creditAmount > 0) hasCreditLine = true;
    }

    // Validate both sides present
    if (settings.requireBothSides) {
      if (!hasDebitLine) {
        errors.push({
          code: ValidationErrorCode.MISSING_DEBIT_LINE,
          message: 'GL transaction must have at least one debit line',
        });
      }
      if (!hasCreditLine) {
        errors.push({
          code: ValidationErrorCode.MISSING_CREDIT_LINE,
          message: 'GL transaction must have at least one credit line',
        });
      }
    }

    // Calculate differences
    const difference = Math.abs(totalDebits - totalCredits);
    const baseDifference = Math.abs(baseTotalDebits - baseTotalCredits);

    // Validate transaction currency balance
    if (difference > settings.balanceTolerance) {
      errors.push({
        code: ValidationErrorCode.UNBALANCED_TRANSACTION,
        message: `Transaction not balanced. Debits: ${totalDebits.toFixed(4)}, Credits: ${totalCredits.toFixed(4)}, Difference: ${difference.toFixed(4)}`,
        context: { totalDebits, totalCredits, difference, tolerance: settings.balanceTolerance },
      });
    }

    // Validate base currency balance
    if (settings.validateBaseAmounts && baseDifference > settings.balanceTolerance) {
      errors.push({
        code: ValidationErrorCode.UNBALANCED_BASE_AMOUNTS,
        message: `Base amounts not balanced. Debits: ${baseTotalDebits.toFixed(4)}, Credits: ${baseTotalCredits.toFixed(4)}`,
        context: {
          baseTotalDebits,
          baseTotalCredits,
          baseDifference,
          tolerance: settings.balanceTolerance,
        },
      });
    }

    return {
      isBalanced: errors.length === 0,
      totalDebits,
      totalCredits,
      difference,
      baseTotalDebits,
      baseTotalCredits,
      baseDifference,
      errors,
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a posting rule engine with the given rule set
 */
export function createPostingRuleEngine(ruleSet: PostingRuleSet): PostingRuleEngine {
  return new PostingRuleEngine(ruleSet);
}

/**
 * Create default validation settings
 */
export function createDefaultValidationSettings(): ValidationSettings {
  return {
    balanceTolerance: 0.01,
    validateBaseAmounts: true,
    requireBothSides: true,
    allowZeroAmountLines: false,
    validateFxRates: true,
    checkPeriodStatus: true,
  };
}
