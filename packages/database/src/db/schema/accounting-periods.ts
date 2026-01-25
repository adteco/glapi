import { pgTable, text, boolean, timestamp, uniqueIndex, date, uuid, integer, decimal, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { subsidiaries } from './subsidiaries';
import { users } from './users';

/**
 * Period status lifecycle:
 * - OPEN: Period accepts new transactions
 * - SOFT_CLOSED: Period is closed for normal entry, adjustments allowed
 * - CLOSED: Period is closed, no new transactions (except adjustments with override)
 * - LOCKED: Period is fully locked, no changes allowed
 */
export const PERIOD_STATUS = {
  OPEN: 'OPEN',
  SOFT_CLOSED: 'SOFT_CLOSED',
  CLOSED: 'CLOSED',
  LOCKED: 'LOCKED',
} as const;

export type PeriodStatus = typeof PERIOD_STATUS[keyof typeof PERIOD_STATUS];

export const PERIOD_TYPE = {
  MONTH: 'MONTH',
  QUARTER: 'QUARTER',
  YEAR: 'YEAR',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;

export type PeriodType = typeof PERIOD_TYPE[keyof typeof PERIOD_TYPE];

export const accountingPeriods = pgTable('accounting_periods', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  subsidiaryId: uuid('subsidiary_id').notNull(),
  periodName: text('period_name').notNull(),
  fiscalYear: text('fiscal_year').notNull(),
  periodNumber: integer('period_number').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  periodType: text('period_type').notNull(), // 'MONTH', 'QUARTER', 'YEAR', 'ADJUSTMENT'
  status: text('status').notNull().default('OPEN'), // 'OPEN', 'SOFT_CLOSED', 'CLOSED', 'LOCKED'
  isAdjustmentPeriod: boolean('is_adjustment_period').default(false).notNull(),
  // Soft close tracking
  softClosedBy: uuid('soft_closed_by'),
  softClosedDate: timestamp('soft_closed_date', { withTimezone: true }),
  // Hard close tracking
  closedBy: uuid('closed_by'),
  closedDate: timestamp('closed_date', { withTimezone: true }),
  // Lock tracking
  lockedBy: uuid('locked_by'),
  lockedDate: timestamp('locked_date', { withTimezone: true }),
  // Audit fields
  createdBy: uuid('created_by'),
  createdDate: timestamp('created_date', { withTimezone: true }).defaultNow().notNull(),
  modifiedBy: uuid('modified_by'),
  modifiedDate: timestamp('modified_date', { withTimezone: true }),
}, (table) => ({
  orgSubYearPeriodIdx: uniqueIndex('idx_periods_org_sub_year_period').on(table.organizationId, table.subsidiaryId, table.fiscalYear, table.periodNumber),
  statusIdx: index('idx_periods_status').on(table.status, table.startDate),
  dateRangeIdx: index('idx_periods_date_range').on(table.startDate, table.endDate),
  subsidiaryIdx: index('idx_periods_subsidiary').on(table.subsidiaryId),
  organizationIdx: index('idx_periods_organization').on(table.organizationId),
}));

export const exchangeRates = pgTable('exchange_rates', {
  id: uuid('id').defaultRandom().primaryKey(),
  fromCurrency: text('from_currency').notNull(),
  toCurrency: text('to_currency').notNull(),
  rateDate: date('rate_date').notNull(),
  rateType: text('rate_type').notNull(), // 'SPOT', 'AVERAGE', 'HISTORICAL'
  exchangeRate: decimal('exchange_rate', { precision: 12, scale: 6 }).notNull(),
  createdDate: timestamp('created_date', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  currencyDateIdx: uniqueIndex('idx_exchange_rates_currency_date').on(table.fromCurrency, table.toCurrency, table.rateDate, table.rateType),
}));

// Relations will be defined separately to avoid circular dependencies
export const accountingPeriodsRelations = relations(accountingPeriods, ({ one }) => ({
  organization: one(organizations, {
    fields: [accountingPeriods.organizationId],
    references: [organizations.id],
  }),
  subsidiary: one(subsidiaries, {
    fields: [accountingPeriods.subsidiaryId],
    references: [subsidiaries.id],
  }),
  softClosedByUser: one(users, {
    fields: [accountingPeriods.softClosedBy],
    references: [users.id],
    relationName: 'softClosedByUser',
  }),
  closedByUser: one(users, {
    fields: [accountingPeriods.closedBy],
    references: [users.id],
    relationName: 'closedByUser',
  }),
  lockedByUser: one(users, {
    fields: [accountingPeriods.lockedBy],
    references: [users.id],
    relationName: 'lockedByUser',
  }),
  createdByUser: one(users, {
    fields: [accountingPeriods.createdBy],
    references: [users.id],
    relationName: 'periodCreatedByUser',
  }),
  modifiedByUser: one(users, {
    fields: [accountingPeriods.modifiedBy],
    references: [users.id],
    relationName: 'periodModifiedByUser',
  }),
  // glTransactions and glAccountBalances relations should be defined in their respective files
}));

export const exchangeRatesRelations = relations(exchangeRates, ({ }) => ({
  // No direct relations
}));