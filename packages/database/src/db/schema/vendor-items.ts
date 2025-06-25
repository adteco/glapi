import { pgTable, text, uuid, decimal, boolean, timestamp, uniqueIndex, index, integer, date } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { items } from './items';
import { entities } from './entities';

export const vendorItems = pgTable('vendor_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  vendorId: uuid('vendor_id').notNull(), // References entities table where entity_type = 'vendor'
  itemId: uuid('item_id').notNull().references(() => items.id),
  vendorItemCode: text('vendor_item_code'),
  vendorItemName: text('vendor_item_name'),
  vendorUnitCost: decimal('vendor_unit_cost', { precision: 18, scale: 2 }),
  leadTimeDays: integer('lead_time_days').default(0),
  minOrderQuantity: decimal('min_order_quantity', { precision: 18, scale: 2 }).default('1'),
  isPreferred: boolean('is_preferred').default(false),
  lastPurchaseDate: date('last_purchase_date'),
  lastPurchasePrice: decimal('last_purchase_price', { precision: 18, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueVendorItem: uniqueIndex('idx_vendor_items_unique').on(table.vendorId, table.itemId),
  vendorItemIndex: index('idx_vendor_items_item').on(table.itemId),
  preferredIndex: index('idx_vendor_items_preferred').on(table.itemId, table.isPreferred),
}));

export const vendorItemsRelations = relations(vendorItems, ({ one }) => ({
  vendor: one(entities, {
    fields: [vendorItems.vendorId],
    references: [entities.id],
  }),
  item: one(items, {
    fields: [vendorItems.itemId],
    references: [items.id],
  }),
}));

export type VendorItem = typeof vendorItems.$inferSelect;
export type NewVendorItem = typeof vendorItems.$inferInsert;