import { pgTable, text, uuid, decimal, timestamp, uniqueIndex, index, date, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { items } from './items';
import { entities } from './entities';

// Lot Status Enum
export const lotStatusEnum = pgEnum('lot_status', ['ACTIVE', 'EXPIRED', 'RECALLED']);

// Serial Status Enum
export const serialStatusEnum = pgEnum('serial_status', [
  'AVAILABLE',
  'SOLD',
  'IN_TRANSIT',
  'RETURNED',
  'DAMAGED',
  'LOST'
]);

// Lot Numbers
export const lotNumbers = pgTable('lot_numbers', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  itemId: uuid('item_id').notNull().references(() => items.id),
  lotNumber: text('lot_number').notNull(),
  manufactureDate: date('manufacture_date'),
  expirationDate: date('expiration_date'),
  quantityReceived: decimal('quantity_received', { precision: 18, scale: 2 }).notNull(),
  quantityOnHand: decimal('quantity_on_hand', { precision: 18, scale: 2 }).notNull(),
  status: lotStatusEnum('status').default('ACTIVE'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueLot: uniqueIndex('idx_lot_numbers_unique').on(table.organizationId, table.itemId, table.lotNumber),
  lotItemIndex: index('idx_lot_numbers_item').on(table.itemId),
  lotExpirationIndex: index('idx_lot_numbers_dates').on(table.expirationDate),
  lotStatusIndex: index('idx_lot_numbers_status').on(table.status),
}));

// Serial Numbers
export const serialNumbers = pgTable('serial_numbers', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  itemId: uuid('item_id').notNull().references(() => items.id),
  serialNumber: text('serial_number').notNull(),
  lotNumberId: uuid('lot_number_id').references(() => lotNumbers.id),
  status: serialStatusEnum('status').default('AVAILABLE'),
  purchaseDate: date('purchase_date'),
  purchaseVendorId: uuid('purchase_vendor_id'), // References entities table where entity_type = 'vendor'
  saleDate: date('sale_date'),
  saleCustomerId: uuid('sale_customer_id'), // References entities table where entity_type = 'customer'
  warrantyExpirationDate: date('warranty_expiration_date'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueSerial: uniqueIndex('idx_serial_numbers_unique').on(table.organizationId, table.serialNumber),
  serialItemIndex: index('idx_serial_numbers_item').on(table.itemId),
  serialStatusIndex: index('idx_serial_numbers_status').on(table.status),
}));

// Relations
export const lotNumbersRelations = relations(lotNumbers, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [lotNumbers.organizationId],
    references: [organizations.id],
  }),
  item: one(items, {
    fields: [lotNumbers.itemId],
    references: [items.id],
  }),
  serialNumbers: many(serialNumbers),
}));

export const serialNumbersRelations = relations(serialNumbers, ({ one }) => ({
  organization: one(organizations, {
    fields: [serialNumbers.organizationId],
    references: [organizations.id],
  }),
  item: one(items, {
    fields: [serialNumbers.itemId],
    references: [items.id],
  }),
  lotNumber: one(lotNumbers, {
    fields: [serialNumbers.lotNumberId],
    references: [lotNumbers.id],
  }),
  purchaseVendor: one(entities, {
    fields: [serialNumbers.purchaseVendorId],
    references: [entities.id],
    relationName: 'serialPurchaseVendor',
  }),
  saleCustomer: one(entities, {
    fields: [serialNumbers.saleCustomerId],
    references: [entities.id],
    relationName: 'serialSaleCustomer',
  }),
}));

export type LotNumber = typeof lotNumbers.$inferSelect;
export type NewLotNumber = typeof lotNumbers.$inferInsert;
export type SerialNumber = typeof serialNumbers.$inferSelect;
export type NewSerialNumber = typeof serialNumbers.$inferInsert;