import { pgTable, text, uuid, decimal, boolean, timestamp, uniqueIndex, index, date } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { locations } from './locations';
import { items } from './items';
import { priceLists } from './pricing';
import { entities } from './entities';

// Warehouses
export const warehouses = pgTable('warehouses', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  warehouseId: text('warehouse_id').notNull(),
  name: text('name').notNull(),
  locationId: uuid('location_id').references(() => locations.id),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  warehouseOrgCodeIdx: uniqueIndex('warehouses_org_warehouse_id_idx').on(table.organizationId, table.warehouseId),
  warehouseOrgNameIdx: uniqueIndex('warehouses_org_name_idx').on(table.organizationId, table.name),
  warehouseActiveIdx: index('warehouses_active_idx').on(table.organizationId, table.isActive),
}));

// Warehouse Pricing - Links warehouses to price lists
export const warehousePriceLists = pgTable('warehouse_price_lists', {
  id: uuid('id').defaultRandom().primaryKey(),
  warehouseId: uuid('warehouse_id').notNull().references(() => warehouses.id),
  priceListId: uuid('price_list_id').notNull().references(() => priceLists.id),
  priority: decimal('priority', { precision: 10, scale: 0 }).default('1'), // Lower number = higher priority
  effectiveDate: date('effective_date'),
  expirationDate: date('expiration_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  warehousePriceUnique: uniqueIndex('warehouse_price_lists_unique_idx').on(table.warehouseId, table.priceListId),
  warehousePriceDatesIndex: index('warehouse_price_lists_dates_idx').on(table.effectiveDate, table.expirationDate),
  warehousePriceLookupIndex: index('warehouse_price_lists_lookup_idx').on(table.warehouseId, table.effectiveDate, table.expirationDate),
}));

// Customer Warehouse Assignments - Assigns customers to specific warehouses for items
export const customerWarehouseAssignments = pgTable('customer_warehouse_assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  customerId: uuid('customer_id').notNull(), // References entities table where entity_type = 'customer'
  itemId: uuid('item_id').notNull().references(() => items.id),
  warehouseId: uuid('warehouse_id').notNull().references(() => warehouses.id),
  isDefault: boolean('is_default').default(false),
  effectiveDate: date('effective_date'),
  expirationDate: date('expiration_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  customerWarehouseUnique: uniqueIndex('customer_warehouse_assignments_unique_idx').on(
    table.organizationId, 
    table.customerId, 
    table.itemId
  ),
  customerWarehouseLookupIndex: index('customer_warehouse_assignments_lookup_idx').on(
    table.organizationId,
    table.customerId,
    table.itemId,
    table.effectiveDate,
    table.expirationDate
  ),
  warehouseIndex: index('customer_warehouse_assignments_warehouse_idx').on(table.warehouseId),
}));

// Relations
export const warehousesRelations = relations(warehouses, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [warehouses.organizationId],
    references: [organizations.id],
  }),
  location: one(locations, {
    fields: [warehouses.locationId],
    references: [locations.id],
  }),
  priceLists: many(warehousePriceLists),
  customerAssignments: many(customerWarehouseAssignments),
}));

export const warehousePriceListsRelations = relations(warehousePriceLists, ({ one }) => ({
  warehouse: one(warehouses, {
    fields: [warehousePriceLists.warehouseId],
    references: [warehouses.id],
  }),
  priceList: one(priceLists, {
    fields: [warehousePriceLists.priceListId],
    references: [priceLists.id],
  }),
}));

export const customerWarehouseAssignmentsRelations = relations(customerWarehouseAssignments, ({ one }) => ({
  organization: one(organizations, {
    fields: [customerWarehouseAssignments.organizationId],
    references: [organizations.id],
  }),
  customer: one(entities, {
    fields: [customerWarehouseAssignments.customerId],
    references: [entities.id],
  }),
  item: one(items, {
    fields: [customerWarehouseAssignments.itemId],
    references: [items.id],
  }),
  warehouse: one(warehouses, {
    fields: [customerWarehouseAssignments.warehouseId],
    references: [warehouses.id],
  }),
}));

// Type exports
export type Warehouse = typeof warehouses.$inferSelect;
export type NewWarehouse = typeof warehouses.$inferInsert;
export type WarehousePriceList = typeof warehousePriceLists.$inferSelect;
export type NewWarehousePriceList = typeof warehousePriceLists.$inferInsert;
export type CustomerWarehouseAssignment = typeof customerWarehouseAssignments.$inferSelect;
export type NewCustomerWarehouseAssignment = typeof customerWarehouseAssignments.$inferInsert;