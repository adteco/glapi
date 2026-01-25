import { pgTable, text, timestamp, decimal, date, jsonb, pgEnum, boolean, uuid } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { organizations } from './organizations';
import { revenueSchedules } from './revenue-schedules';
import { accountingPeriods } from './accounting-periods';
import { accounts } from './accounts';
import { subsidiaries } from './subsidiaries';
import { departments } from './departments';
import { locations } from './locations';
import { classes } from './classes';
import { entities } from './entities';
import { items } from './items';
import { journalEntryBatches } from './journal-entry-batches';

// GL Journal entry status enum
export const glJournalStatusEnum = pgEnum('gl_journal_status', [
  'draft',
  'pending',
  'posted',
  'reversed',
  'failed'
]);

// GL Journal entries table - extends revenue journal entries with GL-specific fields
export const glJournalEntries = pgTable('gl_journal_entries', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Batch reference
  batchId: text('batch_id').references(() => journalEntryBatches.id, { onDelete: 'set null' }),
  
  // Revenue recognition reference
  revenueScheduleId: text('revenue_schedule_id').references(() => revenueSchedules.id),
  accountingPeriodId: text('accounting_period_id').references(() => accountingPeriods.id),
  
  // Journal entry details
  entryDate: date('entry_date').notNull(),
  description: text('description'),
  journalEntryReference: text('journal_entry_reference'),
  
  // Accounts
  debitAccount: text('debit_account').references(() => accounts.id),
  creditAccount: text('credit_account').references(() => accounts.id),
  
  // Amounts
  deferredRevenueAmount: decimal('deferred_revenue_amount', { precision: 12, scale: 2 }),
  recognizedRevenueAmount: decimal('recognized_revenue_amount', { precision: 12, scale: 2 }),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  
  // Dimensions
  subsidiaryId: text('subsidiary_id').references(() => subsidiaries.id),
  departmentId: text('department_id').references(() => departments.id),
  locationId: text('location_id').references(() => locations.id),
  classId: text('class_id').references(() => classes.id),
  entityId: text('entity_id').references(() => entities.id),
  itemId: text('item_id').references(() => items.id),
  
  // Status and posting
  status: glJournalStatusEnum('status').notNull().default('draft'),
  posted: boolean('posted').default(false),
  postedAt: timestamp('posted_at', { withTimezone: true }),
  postedBy: text('posted_by'),
  
  // External system tracking
  externalSystemName: text('external_system_name'),
  externalTransactionId: text('external_transaction_id'),
  externalPostStatus: text('external_post_status'),
  externalPostDate: timestamp('external_post_date', { withTimezone: true }),
  
  // Metadata
  metadata: jsonb('metadata'),
  
  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
  updatedBy: text('updated_by')
});

// Type exports
export type GLJournalEntry = typeof glJournalEntries.$inferSelect;
export type NewGLJournalEntry = typeof glJournalEntries.$inferInsert;

// Status constants
export const GLJournalStatus = {
  DRAFT: 'draft',
  PENDING: 'pending',
  POSTED: 'posted',
  REVERSED: 'reversed',
  FAILED: 'failed'
} as const;