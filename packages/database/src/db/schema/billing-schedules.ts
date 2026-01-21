import {
  pgTable,
  uuid,
  varchar,
  decimal,
  date,
  timestamp,
  text,
  jsonb,
  integer,
  pgEnum,
  boolean,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { subscriptions } from './subscriptions';
import { invoices } from './invoices';

// Billing schedule status enum
export const billingScheduleStatusEnum = pgEnum('billing_schedule_status', [
  'draft',
  'active',
  'paused',
  'completed',
  'cancelled',
]);

// Billing schedule line status enum
export const billingScheduleLineStatusEnum = pgEnum('billing_schedule_line_status', [
  'scheduled',
  'invoiced',
  'paid',
  'overdue',
  'cancelled',
  'skipped',
]);

// Billing schedules table - the overall schedule for a subscription
export const billingSchedules = pgTable('billing_schedules', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id)
    .notNull(),
  subscriptionId: uuid('subscription_id')
    .references(() => subscriptions.id)
    .notNull(),

  // Schedule identifiers
  scheduleNumber: varchar('schedule_number', { length: 50 }).notNull(),

  // Schedule timing
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  frequency: varchar('frequency', { length: 20 }).notNull(), // monthly, quarterly, semi_annual, annual, custom

  // Day of the period to bill (1-31 for monthly, etc.)
  billingDay: integer('billing_day').default(1),

  // Payment terms (days after invoice date)
  paymentTermsDays: integer('payment_terms_days').default(30),

  // Status
  status: billingScheduleStatusEnum('status').default('draft').notNull(),

  // Tracking fields
  nextBillingDate: date('next_billing_date'),
  lastBilledDate: date('last_billed_date'),
  lastBilledAmount: decimal('last_billed_amount', { precision: 12, scale: 2 }),

  // Totals
  totalScheduledAmount: decimal('total_scheduled_amount', { precision: 15, scale: 2 }).default('0'),
  totalInvoicedAmount: decimal('total_invoiced_amount', { precision: 15, scale: 2 }).default('0'),
  totalPaidAmount: decimal('total_paid_amount', { precision: 15, scale: 2 }).default('0'),

  // Line counts
  totalLines: integer('total_lines').default(0),
  invoicedLines: integer('invoiced_lines').default(0),
  paidLines: integer('paid_lines').default(0),

  // Version tracking (links to subscription version this was created from)
  subscriptionVersionNumber: integer('subscription_version_number'),

  // Metadata
  notes: text('notes'),
  metadata: jsonb('metadata'),

  // Audit fields
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Billing schedule lines - individual billing periods
export const billingScheduleLines = pgTable('billing_schedule_lines', {
  id: uuid('id').defaultRandom().primaryKey(),
  billingScheduleId: uuid('billing_schedule_id')
    .references(() => billingSchedules.id, { onDelete: 'cascade' })
    .notNull(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id)
    .notNull(),

  // Sequence for ordering
  sequenceNumber: integer('sequence_number').notNull(),

  // Billing period
  billingPeriodStart: date('billing_period_start').notNull(),
  billingPeriodEnd: date('billing_period_end').notNull(),

  // Expected billing date (when invoice should be created)
  scheduledBillingDate: date('scheduled_billing_date').notNull(),

  // Due date for payment
  dueDate: date('due_date').notNull(),

  // Expected amount (calculated from subscription items)
  expectedAmount: decimal('expected_amount', { precision: 12, scale: 2 }).notNull(),

  // Proration fields
  isProrated: boolean('is_prorated').default(false),
  proratedDays: integer('prorated_days'),
  fullPeriodDays: integer('full_period_days'),

  // Invoice reference (populated when invoice is created)
  invoiceId: uuid('invoice_id').references(() => invoices.id),
  invoicedDate: date('invoiced_date'),
  invoicedAmount: decimal('invoiced_amount', { precision: 12, scale: 2 }),

  // Status
  status: billingScheduleLineStatusEnum('status').default('scheduled').notNull(),

  // Notes and metadata
  notes: text('notes'),
  metadata: jsonb('metadata'),

  // Audit fields
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Relations
export const billingSchedulesRelations = relations(billingSchedules, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [billingSchedules.organizationId],
    references: [organizations.id],
  }),
  subscription: one(subscriptions, {
    fields: [billingSchedules.subscriptionId],
    references: [subscriptions.id],
  }),
  lines: many(billingScheduleLines),
}));

export const billingScheduleLinesRelations = relations(billingScheduleLines, ({ one }) => ({
  billingSchedule: one(billingSchedules, {
    fields: [billingScheduleLines.billingScheduleId],
    references: [billingSchedules.id],
  }),
  organization: one(organizations, {
    fields: [billingScheduleLines.organizationId],
    references: [organizations.id],
  }),
  invoice: one(invoices, {
    fields: [billingScheduleLines.invoiceId],
    references: [invoices.id],
  }),
}));

// Types
export type BillingSchedule = typeof billingSchedules.$inferSelect;
export type NewBillingSchedule = typeof billingSchedules.$inferInsert;
export type UpdateBillingSchedule = Partial<Omit<NewBillingSchedule, 'id' | 'organizationId' | 'createdAt'>>;

export type BillingScheduleLine = typeof billingScheduleLines.$inferSelect;
export type NewBillingScheduleLine = typeof billingScheduleLines.$inferInsert;
export type UpdateBillingScheduleLine = Partial<Omit<NewBillingScheduleLine, 'id' | 'organizationId' | 'billingScheduleId' | 'createdAt'>>;

export type BillingScheduleWithLines = BillingSchedule & {
  lines: BillingScheduleLine[];
};

export type BillingScheduleStatus = 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
export type BillingScheduleLineStatus = 'scheduled' | 'invoiced' | 'paid' | 'overdue' | 'cancelled' | 'skipped';
