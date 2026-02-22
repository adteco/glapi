import {
  pgEnum,
  pgTable,
  uuid,
  numeric,
  bigint,
  timestamp,
  char,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { organizations } from './organizations';
import { invoices } from './invoices';
import { invoiceLineItems } from './invoice-line-items';

export const invoiceSourceTypeEnum = pgEnum('invoice_source_type', [
  'TIME_ENTRY',
  'PROJECT_TASK',
  'SALES_ORDER_LINE',
  'EXPENSE_ENTRY',
  'CREDIT_MEMO',
  'DISCOUNT',
]);

export const invoiceSourceAllocationStatusEnum = pgEnum('invoice_source_allocation_status', [
  'active',
  'released',
  'transferred',
]);

export const invoiceSourceReleaseReasonEnum = pgEnum('invoice_source_release_reason', [
  'void',
  'credit',
  'writeoff',
  'rebill_transfer',
]);

export const invoiceSourceAllocations = pgTable(
  'invoice_source_allocations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    invoiceLineItemId: uuid('invoice_line_item_id')
      .notNull()
      .references(() => invoiceLineItems.id, { onDelete: 'cascade' }),
    sourceType: invoiceSourceTypeEnum('source_type').notNull(),
    sourceId: uuid('source_id').notNull(),
    sourceHours: numeric('source_hours', { precision: 10, scale: 2 }),
    sourceAmountMinor: bigint('source_amount_minor', { mode: 'number' }).notNull(),
    currencyCode: char('currency_code', { length: 3 }).notNull(),
    taxAmountMinor: bigint('tax_amount_minor', { mode: 'number' }),
    allocationStatus: invoiceSourceAllocationStatusEnum('allocation_status').default('active').notNull(),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    releaseReason: invoiceSourceReleaseReasonEnum('release_reason'),
    replacedByAllocationId: uuid('replaced_by_allocation_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    invoiceIdx: index('idx_invoice_source_allocations_invoice').on(table.invoiceId),
    invoiceLineIdx: index('idx_invoice_source_allocations_invoice_line').on(table.invoiceLineItemId),
    sourceIdx: index('idx_invoice_source_allocations_source').on(
      table.organizationId,
      table.sourceType,
      table.sourceId,
    ),
    statusIdx: index('idx_invoice_source_allocations_status').on(table.organizationId, table.allocationStatus),
    activeSourceUnique: uniqueIndex('ux_invoice_source_allocations_active_source')
      .on(table.organizationId, table.sourceType, table.sourceId)
      .where(sql`${table.allocationStatus} = 'active'`),
  }),
);

export const invoiceSourceAllocationsRelations = relations(
  invoiceSourceAllocations,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [invoiceSourceAllocations.organizationId],
      references: [organizations.id],
    }),
    invoice: one(invoices, {
      fields: [invoiceSourceAllocations.invoiceId],
      references: [invoices.id],
    }),
    invoiceLineItem: one(invoiceLineItems, {
      fields: [invoiceSourceAllocations.invoiceLineItemId],
      references: [invoiceLineItems.id],
    }),
    replacedByAllocation: one(invoiceSourceAllocations, {
      fields: [invoiceSourceAllocations.replacedByAllocationId],
      references: [invoiceSourceAllocations.id],
      relationName: 'invoiceSourceAllocationReplacement',
    }),
    priorAllocations: many(invoiceSourceAllocations, {
      relationName: 'invoiceSourceAllocationReplacement',
    }),
  }),
);

export type InvoiceSourceAllocation = typeof invoiceSourceAllocations.$inferSelect;
export type NewInvoiceSourceAllocation = typeof invoiceSourceAllocations.$inferInsert;
