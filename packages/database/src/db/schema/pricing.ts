import { pgTable, text, uuid, decimal, boolean, timestamp, uniqueIndex, index, date } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { items } from './items';
import { entities } from './entities';

// Price Lists
export const priceLists = pgTable('price_lists', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  code: text('code').notNull(),
  description: text('description'),
  currencyCode: text('currency_code').default('USD'),
  isDefault: boolean('is_default').default(false),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgCodeUnique: uniqueIndex('idx_price_lists_org_code').on(table.organizationId, table.code),
}));

// Item Pricing
export const itemPricing = pgTable('item_pricing', {
  id: uuid('id').defaultRandom().primaryKey(),
  itemId: uuid('item_id').notNull().references(() => items.id),
  priceListId: uuid('price_list_id').notNull().references(() => priceLists.id),
  unitPrice: decimal('unit_price', { precision: 18, scale: 2 }).notNull(),
  minQuantity: decimal('min_quantity', { precision: 18, scale: 2 }).default('1'),
  effectiveDate: date('effective_date').notNull(),
  expirationDate: date('expiration_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniquePricing: uniqueIndex('idx_item_pricing_unique').on(
    table.itemId, 
    table.priceListId, 
    table.minQuantity, 
    table.effectiveDate
  ),
  lookupIndex: index('idx_item_pricing_lookup').on(
    table.itemId,
    table.priceListId,
    table.effectiveDate,
    table.expirationDate
  ),
  datesIndex: index('idx_item_pricing_dates').on(table.effectiveDate, table.expirationDate),
}));

// Customer Price Lists
export const customerPriceLists = pgTable('customer_price_lists', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id').notNull(), // References entities table where entity_type = 'customer'
  priceListId: uuid('price_list_id').notNull().references(() => priceLists.id),
  priority: decimal('priority', { precision: 10, scale: 0 }).default('1'), // Lower number = higher priority
  effectiveDate: date('effective_date'),
  expirationDate: date('expiration_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueAssignment: uniqueIndex('idx_customer_price_lists_unique').on(table.customerId, table.priceListId),
  datesIndex: index('idx_customer_price_lists_dates').on(table.effectiveDate, table.expirationDate),
}));

// Relations
export const priceListsRelations = relations(priceLists, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [priceLists.organizationId],
    references: [organizations.id],
  }),
  itemPricing: many(itemPricing),
  customerAssignments: many(customerPriceLists),
}));

export const itemPricingRelations = relations(itemPricing, ({ one }) => ({
  item: one(items, {
    fields: [itemPricing.itemId],
    references: [items.id],
  }),
  priceList: one(priceLists, {
    fields: [itemPricing.priceListId],
    references: [priceLists.id],
  }),
}));

export const customerPriceListsRelations = relations(customerPriceLists, ({ one }) => ({
  customer: one(entities, {
    fields: [customerPriceLists.customerId],
    references: [entities.id],
  }),
  priceList: one(priceLists, {
    fields: [customerPriceLists.priceListId],
    references: [priceLists.id],
  }),
}));

export type PriceList = typeof priceLists.$inferSelect;
export type NewPriceList = typeof priceLists.$inferInsert;
export type ItemPricing = typeof itemPricing.$inferSelect;
export type NewItemPricing = typeof itemPricing.$inferInsert;
export type CustomerPriceList = typeof customerPriceLists.$inferSelect;
export type NewCustomerPriceList = typeof customerPriceLists.$inferInsert;