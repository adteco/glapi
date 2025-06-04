"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exchangeRatesRelations = exports.exchangeRates = exports.accountingPeriodsRelations = exports.accountingPeriods = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
exports.accountingPeriods = (0, pg_core_1.pgTable)('accounting_periods', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    subsidiaryId: (0, pg_core_1.uuid)('subsidiary_id').notNull(),
    periodName: (0, pg_core_1.text)('period_name').notNull(),
    fiscalYear: (0, pg_core_1.text)('fiscal_year').notNull(),
    periodNumber: (0, pg_core_1.integer)('period_number').notNull(),
    startDate: (0, pg_core_1.date)('start_date').notNull(),
    endDate: (0, pg_core_1.date)('end_date').notNull(),
    periodType: (0, pg_core_1.text)('period_type').notNull(), // 'MONTH', 'QUARTER', 'YEAR', 'ADJUSTMENT'
    status: (0, pg_core_1.text)('status').notNull(), // 'OPEN', 'CLOSED', 'LOCKED'
    closedBy: (0, pg_core_1.uuid)('closed_by').references(() => users_1.users.id),
    closedDate: (0, pg_core_1.timestamp)('closed_date', { withTimezone: true }),
    isAdjustmentPeriod: (0, pg_core_1.boolean)('is_adjustment_period').default(false).notNull(),
    createdDate: (0, pg_core_1.timestamp)('created_date', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
    subYearPeriodIdx: (0, pg_core_1.uniqueIndex)('idx_periods_sub_year_period').on(table.subsidiaryId, table.fiscalYear, table.periodNumber),
    statusIdx: (0, pg_core_1.uniqueIndex)('idx_periods_status').on(table.status, table.startDate),
    dateRangeIdx: (0, pg_core_1.uniqueIndex)('idx_periods_date_range').on(table.startDate, table.endDate),
}));
exports.accountingPeriodsRelations = (0, drizzle_orm_1.relations)(exports.accountingPeriods, ({ one, many }) => ({
    subsidiary: one(subsidiaries_1.subsidiaries, {
        fields: [exports.accountingPeriods.subsidiaryId],
        references: [subsidiaries_1.subsidiaries.id],
    }),
    closedByUser: one(users_1.users, {
        fields: [exports.accountingPeriods.closedBy],
        references: [users_1.users.id],
    }),
    glTransactions: many(glTransactions),
    glAccountBalances: many(glAccountBalances),
}));
exports.exchangeRates = (0, pg_core_1.pgTable)('exchange_rates', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    fromCurrency: (0, pg_core_1.text)('from_currency').notNull(),
    toCurrency: (0, pg_core_1.text)('to_currency').notNull(),
    rateDate: (0, pg_core_1.date)('rate_date').notNull(),
    rateType: (0, pg_core_1.text)('rate_type').notNull(), // 'SPOT', 'AVERAGE', 'HISTORICAL'
    exchangeRate: (0, pg_core_2.decimal)('exchange_rate', { precision: 12, scale: 6 }).notNull(),
    createdDate: (0, pg_core_1.timestamp)('created_date', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
    currencyDateIdx: (0, pg_core_1.uniqueIndex)('idx_exchange_rates_currency_date').on(table.fromCurrency, table.toCurrency, table.rateDate, table.rateType),
}));
exports.exchangeRatesRelations = (0, drizzle_orm_1.relations)(exports.exchangeRates, ({}) => ({
// No direct relations
}));
// Import references
const pg_core_2 = require("drizzle-orm/pg-core");
const subsidiaries_1 = require("./subsidiaries");
const users_1 = require("./users");
// These will be defined in gl-transactions.ts
const glTransactions = {};
const glAccountBalances = {};
//# sourceMappingURL=accounting-periods.js.map