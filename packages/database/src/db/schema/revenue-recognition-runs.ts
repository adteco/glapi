import { relations, sql } from 'drizzle-orm';
import {
  date,
  check,
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { accountingPeriods } from './accounting-periods';
import { organizations } from './organizations';
import { revenueSchedules } from './revenue-schedules';
import { subsidiaries } from './subsidiaries';

/** Immutable receipt for a successfully committed recognition period run. */
export const revenueRecognitionRuns = pgTable(
  'revenue_recognition_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    subsidiaryId: uuid('subsidiary_id')
      .notNull()
      .references(() => subsidiaries.id),
    accountingPeriodId: uuid('accounting_period_id')
      .notNull()
      .references(() => accountingPeriods.id),
    idempotencyKey: text('idempotency_key').notNull(),
    requestHash: text('request_hash').notNull(),
    recognitionDate: date('recognition_date').notNull(),
    scheduleCount: integer('schedule_count').notNull(),
    totalRecognizedAmount: decimal('total_recognized_amount', {
      precision: 14,
      scale: 2,
    }).notNull(),
    status: text('status').default('completed').notNull(),
    selection: jsonb('selection').$type<{ scheduleIds: string[] | null }>().notNull(),
    initiatedBy: text('initiated_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    idempotencyUnique: uniqueIndex('ux_revenue_recognition_runs_org_key').on(
      table.organizationId,
      table.idempotencyKey,
    ),
    periodIdx: index('idx_revenue_recognition_runs_period').on(
      table.organizationId,
      table.accountingPeriodId,
      table.createdAt,
    ),
    completedStatus: check(
      'chk_revenue_recognition_runs_completed',
      sql`${table.status} = 'completed'`,
    ),
    nonnegativeTotals: check(
      'chk_revenue_recognition_runs_nonnegative_totals',
      sql`${table.scheduleCount} >= 0 AND ${table.totalRecognizedAmount} >= 0`,
    ),
    requestHashLength: check(
      'chk_revenue_recognition_runs_request_hash',
      sql`length(${table.requestHash}) = 64`,
    ),
  }),
);

export const revenueRecognitionRunItems = pgTable(
  'revenue_recognition_run_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    recognitionRunId: uuid('recognition_run_id')
      .notNull()
      .references(() => revenueRecognitionRuns.id),
    revenueScheduleId: uuid('revenue_schedule_id')
      .notNull()
      .references(() => revenueSchedules.id),
    recognizedAmount: decimal('recognized_amount', { precision: 14, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    scheduleUnique: uniqueIndex('ux_revenue_recognition_run_items_schedule').on(
      table.revenueScheduleId,
    ),
    runScheduleUnique: uniqueIndex('ux_revenue_recognition_run_items_run_schedule').on(
      table.recognitionRunId,
      table.revenueScheduleId,
    ),
    nonnegativeAmount: check(
      'chk_revenue_recognition_run_items_nonnegative_amount',
      sql`${table.recognizedAmount} >= 0`,
    ),
  }),
);

export const revenueRecognitionRunsRelations = relations(
  revenueRecognitionRuns,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [revenueRecognitionRuns.organizationId],
      references: [organizations.id],
    }),
    subsidiary: one(subsidiaries, {
      fields: [revenueRecognitionRuns.subsidiaryId],
      references: [subsidiaries.id],
    }),
    accountingPeriod: one(accountingPeriods, {
      fields: [revenueRecognitionRuns.accountingPeriodId],
      references: [accountingPeriods.id],
    }),
    items: many(revenueRecognitionRunItems),
  }),
);

export const revenueRecognitionRunItemsRelations = relations(
  revenueRecognitionRunItems,
  ({ one }) => ({
    run: one(revenueRecognitionRuns, {
      fields: [revenueRecognitionRunItems.recognitionRunId],
      references: [revenueRecognitionRuns.id],
    }),
    schedule: one(revenueSchedules, {
      fields: [revenueRecognitionRunItems.revenueScheduleId],
      references: [revenueSchedules.id],
    }),
  }),
);

export type RevenueRecognitionRun = typeof revenueRecognitionRuns.$inferSelect;
export type RevenueRecognitionRunItem = typeof revenueRecognitionRunItems.$inferSelect;
