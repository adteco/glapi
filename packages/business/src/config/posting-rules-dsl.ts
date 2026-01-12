/**
 * Posting Rules DSL
 *
 * Human-readable domain-specific language for defining GL posting rules.
 * Rules are defined in YAML/JSON format and compiled to database records.
 *
 * @module posting-rules-dsl
 */

// ============================================================================
// DSL Types
// ============================================================================

/**
 * A posting rule set configuration file
 */
export interface PostingRuleSetConfig {
  /** Configuration metadata */
  metadata: {
    /** Name of this rule set */
    name: string;
    /** Version string */
    version: string;
    /** Description */
    description?: string;
    /** Base currency for amount calculations */
    baseCurrency?: string;
    /** Effective date for all rules in this set */
    effectiveDate: string; // ISO date string
    /** Optional expiration date */
    expirationDate?: string;
  };

  /** Default settings applied to all rules */
  defaults?: {
    /** Default subsidiary (null = global) */
    subsidiaryId?: string | null;
    /** Whether rules are active by default */
    isActive?: boolean;
  };

  /** Rule definitions */
  rules: PostingRuleDefinition[];
}

/**
 * A single posting rule definition in DSL format
 */
export interface PostingRuleDefinition {
  /** Rule identifier (unique within rule set) */
  id: string;

  /** Human-readable rule name */
  name: string;

  /** Description of what this rule does */
  description?: string;

  /** Transaction type this rule applies to */
  transactionType: TransactionTypeRef;

  /** Optional subsidiary restriction */
  subsidiary?: string | null;

  /** Sequence number for rule ordering (lower = higher priority) */
  sequence?: number;

  /** When this rule applies */
  when?: PostingRuleCondition;

  /** Posting actions (debit/credit entries to create) */
  post: PostingAction[];

  /** Whether this rule is active */
  active?: boolean;

  /** Rule-specific effective date override */
  effectiveDate?: string;

  /** Rule-specific expiration date override */
  expirationDate?: string;
}

/**
 * Reference to a transaction type
 */
export type TransactionTypeRef =
  | string // Transaction type code (e.g., 'INVOICE', 'PAYMENT')
  | {
      code: string;
      lineType?: string; // Specific line type within transaction
    };

/**
 * Condition for when a posting rule applies
 */
export interface PostingRuleCondition {
  /** Line type must match */
  lineType?: string | string[];

  /** SQL expression for complex conditions */
  expression?: string;

  /** Simple field matching */
  match?: Record<string, string | number | boolean | null>;
}

/**
 * A posting action (creates a GL line)
 */
export interface PostingAction {
  /** Side of the entry */
  side: 'debit' | 'credit';

  /** Account to post to */
  account: AccountRef;

  /** Amount calculation */
  amount: AmountRef;

  /** Description for the GL line */
  description?: string | DescriptionTemplate;

  /** Optional dimension overrides */
  dimensions?: DimensionOverrides;
}

/**
 * Reference to an account (by number, code, or dynamic lookup)
 */
export type AccountRef =
  | string // Account number directly
  | {
      /** Lookup by default account mapping name */
      default: keyof DefaultAccountKeys;
    }
  | {
      /** Lookup from transaction field */
      field: string;
    }
  | {
      /** Lookup from rule configuration */
      config: string;
    };

/**
 * Default account mapping keys
 */
export interface DefaultAccountKeys {
  accountsReceivable: string;
  accountsPayable: string;
  deferredRevenue: string;
  revenue: string;
  unearnedRevenue: string;
  costOfGoodsSold: string;
  costOfServices: string;
  inventory: string;
  cash: string;
  retainedEarnings: string;
  fxGainLoss: string;
  roundingAdjustment: string;
  suspense: string;
  intercompanyReceivable: string;
  intercompanyPayable: string;
}

/**
 * Reference to an amount (fixed, field, or formula)
 */
export type AmountRef =
  | number // Fixed amount
  | {
      /** Get amount from transaction field */
      field: string;
    }
  | {
      /** Calculate amount using formula */
      formula: string;
    }
  | {
      /** Use line amount */
      lineAmount: true;
    };

/**
 * Description template with variable substitution
 */
export interface DescriptionTemplate {
  /** Template string with {{variable}} placeholders */
  template: string;

  /** Fallback if template evaluation fails */
  fallback?: string;
}

/**
 * Dimension overrides for posting
 */
export interface DimensionOverrides {
  class?: string | { field: string };
  department?: string | { field: string };
  location?: string | { field: string };
  project?: string | { field: string };
}

// ============================================================================
// DSL Parser
// ============================================================================

/**
 * Parsed posting rule ready for database insertion
 */
export interface ParsedPostingRule {
  ruleName: string;
  transactionTypeCode: string;
  subsidiaryId: string | null;
  sequenceNumber: number;
  lineType: string | null;
  conditionSql: string | null;
  debitAccountId: string | null;
  creditAccountId: string | null;
  amountFormula: string | null;
  descriptionTemplate: string | null;
  isActive: boolean;
  effectiveDate: Date;
  expirationDate: Date | null;
}

/**
 * Parse a posting rule definition into database-ready format
 */
export function parsePostingRule(
  rule: PostingRuleDefinition,
  defaults: PostingRuleSetConfig['defaults'],
  metadata: PostingRuleSetConfig['metadata']
): ParsedPostingRule[] {
  const parsedRules: ParsedPostingRule[] = [];

  // Extract transaction type
  const transactionTypeCode =
    typeof rule.transactionType === 'string'
      ? rule.transactionType
      : rule.transactionType.code;

  const lineType =
    typeof rule.transactionType === 'object'
      ? rule.transactionType.lineType || null
      : rule.when?.lineType
        ? Array.isArray(rule.when.lineType)
          ? rule.when.lineType[0]
          : rule.when.lineType
        : null;

  // Build condition SQL
  const conditionSql = buildConditionSql(rule.when);

  // Process each posting action
  for (let i = 0; i < rule.post.length; i++) {
    const action = rule.post[i];

    parsedRules.push({
      ruleName: `${rule.name} - ${action.side.toUpperCase()}`,
      transactionTypeCode,
      subsidiaryId: rule.subsidiary ?? defaults?.subsidiaryId ?? null,
      sequenceNumber: (rule.sequence ?? 10) * 10 + i,
      lineType,
      conditionSql,
      debitAccountId: action.side === 'debit' ? resolveAccountRef(action.account) : null,
      creditAccountId: action.side === 'credit' ? resolveAccountRef(action.account) : null,
      amountFormula: resolveAmountRef(action.amount),
      descriptionTemplate: resolveDescriptionTemplate(action.description),
      isActive: rule.active ?? defaults?.isActive ?? true,
      effectiveDate: new Date(rule.effectiveDate ?? metadata.effectiveDate),
      expirationDate: rule.expirationDate
        ? new Date(rule.expirationDate)
        : metadata.expirationDate
          ? new Date(metadata.expirationDate)
          : null,
    });
  }

  return parsedRules;
}

/**
 * Parse an entire rule set configuration
 */
export function parsePostingRuleSet(config: PostingRuleSetConfig): ParsedPostingRule[] {
  const allRules: ParsedPostingRule[] = [];

  for (const rule of config.rules) {
    const parsed = parsePostingRule(rule, config.defaults, config.metadata);
    allRules.push(...parsed);
  }

  return allRules;
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildConditionSql(condition?: PostingRuleCondition): string | null {
  if (!condition) return null;

  const parts: string[] = [];

  if (condition.lineType) {
    const types = Array.isArray(condition.lineType)
      ? condition.lineType
      : [condition.lineType];
    parts.push(`line_type IN (${types.map((t) => `'${t}'`).join(', ')})`);
  }

  if (condition.match) {
    for (const [field, value] of Object.entries(condition.match)) {
      if (value === null) {
        parts.push(`${field} IS NULL`);
      } else if (typeof value === 'string') {
        parts.push(`${field} = '${value}'`);
      } else {
        parts.push(`${field} = ${value}`);
      }
    }
  }

  if (condition.expression) {
    parts.push(`(${condition.expression})`);
  }

  return parts.length > 0 ? parts.join(' AND ') : null;
}

function resolveAccountRef(ref: AccountRef): string | null {
  if (typeof ref === 'string') {
    return ref; // Direct account number/ID
  }

  if ('default' in ref) {
    return `{{default.${ref.default}}}`;
  }

  if ('field' in ref) {
    return `{{field.${ref.field}}}`;
  }

  if ('config' in ref) {
    return `{{config.${ref.config}}}`;
  }

  return null;
}

function resolveAmountRef(ref: AmountRef): string | null {
  if (typeof ref === 'number') {
    return String(ref);
  }

  if ('field' in ref) {
    return `{{field.${ref.field}}}`;
  }

  if ('formula' in ref) {
    return ref.formula;
  }

  if ('lineAmount' in ref && ref.lineAmount) {
    return '{{line.amount}}';
  }

  return null;
}

function resolveDescriptionTemplate(desc?: string | DescriptionTemplate): string | null {
  if (!desc) return null;

  if (typeof desc === 'string') {
    return desc;
  }

  return desc.template;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validation error from rule set parsing
 */
export interface PostingRuleValidationError {
  ruleId: string;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Validate a posting rule set configuration
 */
export function validatePostingRuleSet(
  config: PostingRuleSetConfig
): PostingRuleValidationError[] {
  const errors: PostingRuleValidationError[] = [];

  // Check metadata
  if (!config.metadata.name) {
    errors.push({
      ruleId: 'metadata',
      field: 'name',
      message: 'Rule set name is required',
      severity: 'error',
    });
  }

  if (!config.metadata.effectiveDate) {
    errors.push({
      ruleId: 'metadata',
      field: 'effectiveDate',
      message: 'Effective date is required',
      severity: 'error',
    });
  }

  // Check for duplicate rule IDs
  const ruleIds = new Set<string>();
  for (const rule of config.rules) {
    if (ruleIds.has(rule.id)) {
      errors.push({
        ruleId: rule.id,
        field: 'id',
        message: `Duplicate rule ID: ${rule.id}`,
        severity: 'error',
      });
    }
    ruleIds.add(rule.id);

    // Validate each rule
    errors.push(...validatePostingRule(rule));
  }

  return errors;
}

/**
 * Validate a single posting rule
 */
function validatePostingRule(rule: PostingRuleDefinition): PostingRuleValidationError[] {
  const errors: PostingRuleValidationError[] = [];

  if (!rule.id) {
    errors.push({
      ruleId: rule.id || 'unknown',
      field: 'id',
      message: 'Rule ID is required',
      severity: 'error',
    });
  }

  if (!rule.name) {
    errors.push({
      ruleId: rule.id,
      field: 'name',
      message: 'Rule name is required',
      severity: 'error',
    });
  }

  if (!rule.transactionType) {
    errors.push({
      ruleId: rule.id,
      field: 'transactionType',
      message: 'Transaction type is required',
      severity: 'error',
    });
  }

  if (!rule.post || rule.post.length === 0) {
    errors.push({
      ruleId: rule.id,
      field: 'post',
      message: 'At least one posting action is required',
      severity: 'error',
    });
  }

  // Check for balanced entries (warning only - rules may be partial)
  const debits = rule.post?.filter((p) => p.side === 'debit').length || 0;
  const credits = rule.post?.filter((p) => p.side === 'credit').length || 0;

  if (debits === 0 || credits === 0) {
    errors.push({
      ruleId: rule.id,
      field: 'post',
      message: 'Rule should have both debit and credit entries for double-entry accounting',
      severity: 'warning',
    });
  }

  return errors;
}
