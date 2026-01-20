import { pgTable, uuid, text, boolean, timestamp, decimal, date, integer, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { subsidiaries } from './subsidiaries';
import { accounts } from './accounts';
import { accountingPeriods } from './accounting-periods';
import { users } from './users';
import { currencies } from './currencies';

// Enums for consolidation
export const consolidationMethodEnum = pgEnum('consolidation_method', [
  'FULL',           // 100% consolidation (wholly owned)
  'PROPORTIONAL',   // Proportional consolidation based on ownership %
  'EQUITY',         // Equity method for associates
]);

export const eliminationTypeEnum = pgEnum('elimination_type', [
  'INTERCOMPANY_RECEIVABLE',   // AR/AP between subsidiaries
  'INTERCOMPANY_REVENUE',      // Revenue/expense between subsidiaries
  'INTERCOMPANY_INVESTMENT',   // Investment in subsidiary
  'INTERCOMPANY_DIVIDEND',     // Dividend eliminations
  'UNREALIZED_PROFIT',         // Unrealized profit on intercompany inventory
  'CUSTOM',                    // Custom elimination rule
]);

export const translationMethodEnum = pgEnum('translation_method', [
  'CURRENT_RATE',     // All at period-end rate (most common)
  'TEMPORAL',         // Historical vs current based on account type
  'MONETARY_NONMONETARY', // Monetary at current, non-monetary at historical
]);

export const consolidationRunStatusEnum = pgEnum('consolidation_run_status', [
  'DRAFT',
  'IN_PROGRESS',
  'COMPLETED',
  'FAILED',
  'REVERSED',
]);

// ==========================================
// Consolidation Groups
// ==========================================
export const consolidationGroups = pgTable('consolidation_groups', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: text('organization_id').notNull(),
  name: text('name').notNull(),
  code: text('code').notNull(),
  description: text('description'),
  parentSubsidiaryId: uuid('parent_subsidiary_id').notNull().references(() => subsidiaries.id),
  consolidationCurrencyId: uuid('consolidation_currency_id').notNull().references(() => currencies.id),
  translationMethod: translationMethodEnum('translation_method').default('CURRENT_RATE').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  effectiveDate: date('effective_date').notNull(),
  endDate: date('end_date'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgCodeIdx: uniqueIndex('idx_consol_group_org_code').on(table.organizationId, table.code),
}));

export const consolidationGroupsRelations = relations(consolidationGroups, ({ one, many }) => ({
  parentSubsidiary: one(subsidiaries, {
    fields: [consolidationGroups.parentSubsidiaryId],
    references: [subsidiaries.id],
  }),
  consolidationCurrency: one(currencies, {
    fields: [consolidationGroups.consolidationCurrencyId],
    references: [currencies.id],
  }),
  createdByUser: one(users, {
    fields: [consolidationGroups.createdBy],
    references: [users.id],
  }),
  members: many(consolidationGroupMembers),
  eliminationRules: many(eliminationRules),
  runs: many(consolidationRuns),
}));

// ==========================================
// Consolidation Group Members (Subsidiaries)
// ==========================================
export const consolidationGroupMembers = pgTable('consolidation_group_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  groupId: uuid('group_id').notNull().references(() => consolidationGroups.id, { onDelete: 'cascade' }),
  subsidiaryId: uuid('subsidiary_id').notNull().references(() => subsidiaries.id),
  ownershipPercent: decimal('ownership_percent', { precision: 5, scale: 2 }).notNull(), // 0.00 to 100.00
  votingPercent: decimal('voting_percent', { precision: 5, scale: 2 }), // Can differ from ownership
  consolidationMethod: consolidationMethodEnum('consolidation_method').default('FULL').notNull(),
  minorityInterestAccountId: uuid('minority_interest_account_id').references(() => accounts.id),
  effectiveDate: date('effective_date').notNull(),
  endDate: date('end_date'),
  sequenceNumber: integer('sequence_number').default(1).notNull(), // Order of consolidation
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  groupSubIdx: uniqueIndex('idx_consol_member_group_sub').on(table.groupId, table.subsidiaryId),
}));

export const consolidationGroupMembersRelations = relations(consolidationGroupMembers, ({ one }) => ({
  group: one(consolidationGroups, {
    fields: [consolidationGroupMembers.groupId],
    references: [consolidationGroups.id],
  }),
  subsidiary: one(subsidiaries, {
    fields: [consolidationGroupMembers.subsidiaryId],
    references: [subsidiaries.id],
  }),
  minorityInterestAccount: one(accounts, {
    fields: [consolidationGroupMembers.minorityInterestAccountId],
    references: [accounts.id],
  }),
}));

// ==========================================
// Elimination Rules
// ==========================================
export const eliminationRules = pgTable('elimination_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  groupId: uuid('group_id').notNull().references(() => consolidationGroups.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  eliminationType: eliminationTypeEnum('elimination_type').notNull(),
  sequenceNumber: integer('sequence_number').default(10).notNull(),

  // Source side (to be eliminated)
  sourceSubsidiaryId: uuid('source_subsidiary_id').references(() => subsidiaries.id), // null = any subsidiary in group
  sourceAccountId: uuid('source_account_id').references(() => accounts.id),
  sourceAccountPattern: text('source_account_pattern'), // e.g., '1200%' for account prefix matching

  // Target side (counterparty)
  targetSubsidiaryId: uuid('target_subsidiary_id').references(() => subsidiaries.id),
  targetAccountId: uuid('target_account_id').references(() => accounts.id),
  targetAccountPattern: text('target_account_pattern'),

  // Elimination posting accounts
  eliminationDebitAccountId: uuid('elimination_debit_account_id').references(() => accounts.id),
  eliminationCreditAccountId: uuid('elimination_credit_account_id').references(() => accounts.id),

  isAutomatic: boolean('is_automatic').default(true).notNull(), // Auto-apply during consolidation
  isActive: boolean('is_active').default(true).notNull(),
  effectiveDate: date('effective_date').notNull(),
  endDate: date('end_date'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  groupTypeIdx: uniqueIndex('idx_elim_rule_group_type').on(table.groupId, table.eliminationType),
}));

export const eliminationRulesRelations = relations(eliminationRules, ({ one }) => ({
  group: one(consolidationGroups, {
    fields: [eliminationRules.groupId],
    references: [consolidationGroups.id],
  }),
  sourceSubsidiary: one(subsidiaries, {
    fields: [eliminationRules.sourceSubsidiaryId],
    references: [subsidiaries.id],
    relationName: 'sourceSubsidiary',
  }),
  targetSubsidiary: one(subsidiaries, {
    fields: [eliminationRules.targetSubsidiaryId],
    references: [subsidiaries.id],
    relationName: 'targetSubsidiary',
  }),
  sourceAccount: one(accounts, {
    fields: [eliminationRules.sourceAccountId],
    references: [accounts.id],
    relationName: 'sourceAccount',
  }),
  targetAccount: one(accounts, {
    fields: [eliminationRules.targetAccountId],
    references: [accounts.id],
    relationName: 'targetAccount',
  }),
  eliminationDebitAccount: one(accounts, {
    fields: [eliminationRules.eliminationDebitAccountId],
    references: [accounts.id],
    relationName: 'eliminationDebitAccount',
  }),
  eliminationCreditAccount: one(accounts, {
    fields: [eliminationRules.eliminationCreditAccountId],
    references: [accounts.id],
    relationName: 'eliminationCreditAccount',
  }),
  createdByUser: one(users, {
    fields: [eliminationRules.createdBy],
    references: [users.id],
  }),
}));

// ==========================================
// FX Translation Rules (per account type)
// ==========================================
export const fxTranslationRules = pgTable('fx_translation_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  groupId: uuid('group_id').notNull().references(() => consolidationGroups.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  accountType: text('account_type').notNull(), // ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
  accountSubType: text('account_sub_type'), // More specific matching
  accountPattern: text('account_pattern'), // Pattern matching for account codes
  rateType: text('rate_type').notNull(), // 'CURRENT', 'HISTORICAL', 'AVERAGE'
  ctaAccountId: uuid('cta_account_id').references(() => accounts.id), // Cumulative Translation Adjustment
  sequenceNumber: integer('sequence_number').default(10).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  groupAcctTypeIdx: uniqueIndex('idx_fx_rule_group_acct').on(table.groupId, table.accountType),
}));

export const fxTranslationRulesRelations = relations(fxTranslationRules, ({ one }) => ({
  group: one(consolidationGroups, {
    fields: [fxTranslationRules.groupId],
    references: [consolidationGroups.id],
  }),
  ctaAccount: one(accounts, {
    fields: [fxTranslationRules.ctaAccountId],
    references: [accounts.id],
  }),
}));

// ==========================================
// Exchange Rates for Consolidation
// ==========================================
export const consolidationExchangeRates = pgTable('consolidation_exchange_rates', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: text('organization_id').notNull(),
  fromCurrencyId: uuid('from_currency_id').notNull().references(() => currencies.id),
  toCurrencyId: uuid('to_currency_id').notNull().references(() => currencies.id),
  periodId: uuid('period_id').notNull().references(() => accountingPeriods.id),
  rateType: text('rate_type').notNull(), // 'CURRENT', 'HISTORICAL', 'AVERAGE'
  rate: decimal('rate', { precision: 18, scale: 8 }).notNull(),
  rateDate: date('rate_date').notNull(),
  source: text('source'), // 'MANUAL', 'IMPORTED', 'API'
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  currencyPeriodIdx: uniqueIndex('idx_consol_rate_currency_period').on(
    table.fromCurrencyId,
    table.toCurrencyId,
    table.periodId,
    table.rateType
  ),
}));

export const consolidationExchangeRatesRelations = relations(consolidationExchangeRates, ({ one }) => ({
  fromCurrency: one(currencies, {
    fields: [consolidationExchangeRates.fromCurrencyId],
    references: [currencies.id],
    relationName: 'fromCurrency',
  }),
  toCurrency: one(currencies, {
    fields: [consolidationExchangeRates.toCurrencyId],
    references: [currencies.id],
    relationName: 'toCurrency',
  }),
  period: one(accountingPeriods, {
    fields: [consolidationExchangeRates.periodId],
    references: [accountingPeriods.id],
  }),
  createdByUser: one(users, {
    fields: [consolidationExchangeRates.createdBy],
    references: [users.id],
  }),
}));

// ==========================================
// Consolidation Runs
// ==========================================
export const consolidationRuns = pgTable('consolidation_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  groupId: uuid('group_id').notNull().references(() => consolidationGroups.id),
  periodId: uuid('period_id').notNull().references(() => accountingPeriods.id),
  runNumber: integer('run_number').notNull(),
  status: consolidationRunStatusEnum('status').default('DRAFT').notNull(),
  runType: text('run_type').notNull(), // 'PRELIMINARY', 'FINAL'
  description: text('description'),

  // Statistics
  subsidiariesProcessed: integer('subsidiaries_processed').default(0).notNull(),
  eliminationsGenerated: integer('eliminations_generated').default(0).notNull(),
  translationAdjustments: integer('translation_adjustments').default(0).notNull(),
  totalDebitAmount: decimal('total_debit_amount', { precision: 18, scale: 4 }).default('0').notNull(),
  totalCreditAmount: decimal('total_credit_amount', { precision: 18, scale: 4 }).default('0').notNull(),

  // Timestamps
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  reversedAt: timestamp('reversed_at', { withTimezone: true }),
  reversedByRunId: uuid('reversed_by_run_id'),

  // Audit
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  groupPeriodIdx: uniqueIndex('idx_consol_run_group_period').on(table.groupId, table.periodId, table.runNumber),
}));

export const consolidationRunsRelations = relations(consolidationRuns, ({ one, many }) => ({
  group: one(consolidationGroups, {
    fields: [consolidationRuns.groupId],
    references: [consolidationGroups.id],
  }),
  period: one(accountingPeriods, {
    fields: [consolidationRuns.periodId],
    references: [accountingPeriods.id],
  }),
  createdByUser: one(users, {
    fields: [consolidationRuns.createdBy],
    references: [users.id],
  }),
  adjustments: many(consolidationAdjustments),
}));

// ==========================================
// Consolidation Adjustments (Eliminations & Translations)
// ==========================================
export const consolidationAdjustments = pgTable('consolidation_adjustments', {
  id: uuid('id').defaultRandom().primaryKey(),
  runId: uuid('run_id').notNull().references(() => consolidationRuns.id, { onDelete: 'cascade' }),
  adjustmentType: text('adjustment_type').notNull(), // 'ELIMINATION', 'TRANSLATION', 'MINORITY_INTEREST', 'MANUAL'

  // Source information
  eliminationRuleId: uuid('elimination_rule_id').references(() => eliminationRules.id),
  sourceSubsidiaryId: uuid('source_subsidiary_id').references(() => subsidiaries.id),
  targetSubsidiaryId: uuid('target_subsidiary_id').references(() => subsidiaries.id),

  // Journal entry details
  lineNumber: integer('line_number').notNull(),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  description: text('description'),
  debitAmount: decimal('debit_amount', { precision: 18, scale: 4 }).default('0').notNull(),
  creditAmount: decimal('credit_amount', { precision: 18, scale: 4 }).default('0').notNull(),

  // FX Translation details
  originalCurrencyCode: text('original_currency_code'),
  originalAmount: decimal('original_amount', { precision: 18, scale: 4 }),
  exchangeRate: decimal('exchange_rate', { precision: 18, scale: 8 }),
  translatedAmount: decimal('translated_amount', { precision: 18, scale: 4 }),
  ctaAmount: decimal('cta_amount', { precision: 18, scale: 4 }), // Cumulative Translation Adjustment

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  runLineIdx: uniqueIndex('idx_consol_adj_run_line').on(table.runId, table.lineNumber),
}));

export const consolidationAdjustmentsRelations = relations(consolidationAdjustments, ({ one }) => ({
  run: one(consolidationRuns, {
    fields: [consolidationAdjustments.runId],
    references: [consolidationRuns.id],
  }),
  eliminationRule: one(eliminationRules, {
    fields: [consolidationAdjustments.eliminationRuleId],
    references: [eliminationRules.id],
  }),
  sourceSubsidiary: one(subsidiaries, {
    fields: [consolidationAdjustments.sourceSubsidiaryId],
    references: [subsidiaries.id],
    relationName: 'sourceSubsidiary',
  }),
  targetSubsidiary: one(subsidiaries, {
    fields: [consolidationAdjustments.targetSubsidiaryId],
    references: [subsidiaries.id],
    relationName: 'targetSubsidiary',
  }),
  account: one(accounts, {
    fields: [consolidationAdjustments.accountId],
    references: [accounts.id],
  }),
}));

// ==========================================
// Intercompany Accounts Mapping
// ==========================================
export const intercompanyAccountMappings = pgTable('intercompany_account_mappings', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: text('organization_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),

  // Mapping: when one subsidiary uses this account...
  sourceAccountId: uuid('source_account_id').notNull().references(() => accounts.id),
  // ...it should eliminate against this counterparty account
  targetAccountId: uuid('target_account_id').notNull().references(() => accounts.id),

  // The elimination entry uses these accounts
  eliminationDebitAccountId: uuid('elimination_debit_account_id').references(() => accounts.id),
  eliminationCreditAccountId: uuid('elimination_credit_account_id').references(() => accounts.id),

  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgSourceTargetIdx: uniqueIndex('idx_ic_mapping_org_source_target').on(
    table.organizationId,
    table.sourceAccountId,
    table.targetAccountId
  ),
}));

export const intercompanyAccountMappingsRelations = relations(intercompanyAccountMappings, ({ one }) => ({
  sourceAccount: one(accounts, {
    fields: [intercompanyAccountMappings.sourceAccountId],
    references: [accounts.id],
    relationName: 'sourceAccount',
  }),
  targetAccount: one(accounts, {
    fields: [intercompanyAccountMappings.targetAccountId],
    references: [accounts.id],
    relationName: 'targetAccount',
  }),
  eliminationDebitAccount: one(accounts, {
    fields: [intercompanyAccountMappings.eliminationDebitAccountId],
    references: [accounts.id],
    relationName: 'eliminationDebitAccount',
  }),
  eliminationCreditAccount: one(accounts, {
    fields: [intercompanyAccountMappings.eliminationCreditAccountId],
    references: [accounts.id],
    relationName: 'eliminationCreditAccount',
  }),
}));
