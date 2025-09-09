import { pgTable, text, timestamp, jsonb, decimal } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { contractModifications } from './contract-modifications';
import { subscriptionItems } from './subscription-items';

/**
 * Modification Line Items Table
 * Tracks individual line item changes within contract modifications
 */
export const modificationLineItems = pgTable('modification_line_items', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  modificationId: text('modification_id').notNull().references(() => contractModifications.id, { onDelete: 'cascade' }),
  subscriptionItemId: text('subscription_item_id').references(() => subscriptionItems.id, { onDelete: 'restrict' }),
  
  // Change type
  action: text('action').notNull(), // 'add', 'remove', 'modify'
  
  // Original values (for modify/remove)
  originalQuantity: decimal('original_quantity', { precision: 10, scale: 4 }),
  originalUnitPrice: decimal('original_unit_price', { precision: 15, scale: 2 }),
  originalStartDate: timestamp('original_start_date', { withTimezone: true }),
  originalEndDate: timestamp('original_end_date', { withTimezone: true }),
  
  // New values (for add/modify)
  newQuantity: decimal('new_quantity', { precision: 10, scale: 4 }),
  newUnitPrice: decimal('new_unit_price', { precision: 15, scale: 2 }),
  newStartDate: timestamp('new_start_date', { withTimezone: true }),
  newEndDate: timestamp('new_end_date', { withTimezone: true }),
  
  // Financial impact
  adjustmentAmount: decimal('adjustment_amount', { precision: 15, scale: 2 }),
  
  // Metadata
  metadata: jsonb('metadata'),
  
  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
});

export type ModificationLineItem = typeof modificationLineItems.$inferSelect;
export type NewModificationLineItem = typeof modificationLineItems.$inferInsert;