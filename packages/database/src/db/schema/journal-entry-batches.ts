import { pgTable, text, timestamp, jsonb, integer, boolean, pgEnum, uuid } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { organizations } from './organizations';

// Batch status enum
export const batchStatusEnum = pgEnum('batch_status', [
  'draft',
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled'
]);

// Journal entry batch table
export const journalEntryBatches = pgTable('journal_entry_batches', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Batch details
  batchNumber: text('batch_number').notNull(),
  description: text('description'),
  
  // Processing info
  status: batchStatusEnum('status').notNull().default('draft'),
  totalEntries: integer('total_entries').notNull().default(0),
  processedEntries: integer('processed_entries').notNull().default(0),
  failedEntries: integer('failed_entries').notNull().default(0),
  
  // Timing
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  
  // Error handling
  errors: jsonb('errors'),
  retryCount: integer('retry_count').default(0),
  maxRetries: integer('max_retries').default(3),
  
  // Integration
  externalSystemId: text('external_system_id'),
  externalBatchId: text('external_batch_id'),
  
  // Metadata
  metadata: jsonb('metadata'),
  
  // Audit
  createdBy: text('created_by'),
  approvedBy: text('approved_by'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
});

// Export batch statuses for use in code
export const BatchStatuses = {
  DRAFT: 'draft',
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
} as const;

// Type exports
export type JournalEntryBatch = typeof journalEntryBatches.$inferSelect;
export type NewJournalEntryBatch = typeof journalEntryBatches.$inferInsert;