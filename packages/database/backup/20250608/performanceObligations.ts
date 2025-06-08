import { pgTable, uuid, varchar, text, decimal, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { contractLineItems } from './contract_line_items'; // Assuming this is the correct file for contract line items
import { transactionLines } from './transactionLines'; // For relation back from POBs to transaction lines

export const performanceObligationStatusEnum = pgEnum('performance_obligation_status_enum', [
  'Pending',
  'InProcess',
  'Fulfilled',
  'PartiallyFulfilled',
  'Cancelled',
]);

export const performanceObligations = pgTable('performance_obligations', {
  id: uuid('id').primaryKey().defaultRandom(),
  contractLineItemId: uuid('contract_line_item_id').notNull().references(() => contractLineItems.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  ssp: decimal('ssp', { precision: 14, scale: 2 }).notNull(),
  allocatedTransactionPrice: decimal('allocated_transaction_price', { precision: 14, scale: 2 }),
  revenueRecognized: decimal('revenue_recognized', { precision: 14, scale: 2 }).default('0'),
  status: performanceObligationStatusEnum('status').default('Pending'),
  fulfillmentDate: timestamp('fulfillment_date', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const performanceObligationRelations = relations(performanceObligations, ({ one, many }) => ({
  contractLineItem: one(contractLineItems, {
    fields: [performanceObligations.contractLineItemId],
    references: [contractLineItems.id],
  }),
  transactionLines: many(transactionLines), // Each POB can be on many transaction lines (e.g., for billing schedules)
})); 