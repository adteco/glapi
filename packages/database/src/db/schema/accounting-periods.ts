import { pgTable, text, boolean, timestamp, uniqueIndex, date, uuid, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const accountingPeriods = pgTable('accounting_periods', {
  id: uuid('id').defaultRandom().primaryKey(),
  subsidiaryId: uuid('subsidiary_id').notNull(),
  periodName: text('period_name').notNull(),
  fiscalYear: text('fiscal_year').notNull(),
  periodNumber: integer('period_number').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  periodType: text('period_type').notNull(), // 'MONTH', 'QUARTER', 'YEAR', 'ADJUSTMENT'
  status: text('status').notNull(), // 'OPEN', 'CLOSED', 'LOCKED'
  closedBy: uuid('closed_by').references(() => users.id),
  closedDate: timestamp('closed_date', { withTimezone: true }),
  isAdjustmentPeriod: boolean('is_adjustment_period').default(false).notNull(),
  createdDate: timestamp('created_date', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  subYearPeriodIdx: uniqueIndex('idx_periods_sub_year_period').on(table.subsidiaryId, table.fiscalYear, table.periodNumber),
  statusIdx: uniqueIndex('idx_periods_status').on(table.status, table.startDate),
  dateRangeIdx: uniqueIndex('idx_periods_date_range').on(table.startDate, table.endDate),
}));

export const accountingPeriodsRelations = relations(accountingPeriods, ({ one, many }) => ({
  subsidiary: one(subsidiaries, {
    fields: [accountingPeriods.subsidiaryId],
    references: [subsidiaries.id],
  }),
  closedByUser: one(users, {
    fields: [accountingPeriods.closedBy],
    references: [users.id],
  }),
  glTransactions: many(glTransactions),
  glAccountBalances: many(glAccountBalances),
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

export const exchangeRatesRelations = relations(exchangeRates, ({ }) => ({
  // No direct relations
}));

// Import references
import { decimal } from 'drizzle-orm/pg-core';
import { subsidiaries } from './subsidiaries';
import { users } from './users';
// Forward references - will be imported in other files to avoid circular dependencies
export type GlTransactions = typeof glTransactions;
export type GlAccountBalances = typeof glAccountBalances;
// These will be defined in gl-transactions.ts
const glTransactions = {} as any;
const glAccountBalances = {} as any;