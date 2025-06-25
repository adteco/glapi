import { pgTable, text, uuid, decimal, boolean, timestamp, uniqueIndex, index, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { itemCategories } from './item-categories';
import { unitsOfMeasure } from './units-of-measure';
import { accounts } from './accounts';

export const itemTypeEnum = pgEnum('item_type', [
  'INVENTORY_ITEM',
  'NON_INVENTORY_ITEM',
  'SERVICE',
  'CHARGE',
  'DISCOUNT',
  'TAX',
  'ASSEMBLY',
  'KIT'
]);

export const items = pgTable('items', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  itemCode: text('item_code').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  
  // Item Type
  itemType: itemTypeEnum('item_type').notNull(),
  
  // Matrix/Variant Support
  isParent: boolean('is_parent').default(false),
  parentItemId: uuid('parent_item_id').references(() => items.id),
  variantAttributes: jsonb('variant_attributes'), // e.g., {"size": "Large", "color": "Blue"}
  
  // Categorization
  categoryId: uuid('category_id').references(() => itemCategories.id),
  
  // Units of Measure
  unitOfMeasureId: uuid('unit_of_measure_id').notNull().references(() => unitsOfMeasure.id),
  
  // Financial Accounts
  incomeAccountId: uuid('income_account_id').references(() => accounts.id),
  expenseAccountId: uuid('expense_account_id').references(() => accounts.id),
  assetAccountId: uuid('asset_account_id').references(() => accounts.id),
  cogsAccountId: uuid('cogs_account_id').references(() => accounts.id),
  
  // Pricing
  defaultPrice: decimal('default_price', { precision: 18, scale: 2 }),
  defaultCost: decimal('default_cost', { precision: 18, scale: 2 }),
  
  // Tax Information
  isTaxable: boolean('is_taxable').default(true),
  taxCode: text('tax_code'),
  
  // Status and Tracking
  isActive: boolean('is_active').default(true),
  isPurchasable: boolean('is_purchasable').default(true),
  isSaleable: boolean('is_saleable').default(true),
  trackQuantity: boolean('track_quantity').default(false),
  trackLotNumbers: boolean('track_lot_numbers').default(false),
  trackSerialNumbers: boolean('track_serial_numbers').default(false),
  
  // Additional Fields
  sku: text('sku'),
  upc: text('upc'),
  manufacturerPartNumber: text('manufacturer_part_number'),
  weight: decimal('weight', { precision: 18, scale: 4 }),
  weightUnit: text('weight_unit'),
  
  // Metadata
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
}, (table) => ({
  orgItemCodeUnique: uniqueIndex('idx_items_org_item_code').on(table.organizationId, table.itemCode),
  categoryIndex: index('idx_items_category').on(table.categoryId),
  typeIndex: index('idx_items_type').on(table.itemType),
  skuIndex: index('idx_items_sku').on(table.sku),
  upcIndex: index('idx_items_upc').on(table.upc),
  parentIndex: index('idx_items_parent').on(table.parentItemId),
}));

export const itemsRelations = relations(items, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [items.organizationId],
    references: [organizations.id],
  }),
  category: one(itemCategories, {
    fields: [items.categoryId],
    references: [itemCategories.id],
  }),
  unitOfMeasure: one(unitsOfMeasure, {
    fields: [items.unitOfMeasureId],
    references: [unitsOfMeasure.id],
  }),
  incomeAccount: one(accounts, {
    fields: [items.incomeAccountId],
    references: [accounts.id],
    relationName: 'itemIncomeAccount',
  }),
  expenseAccount: one(accounts, {
    fields: [items.expenseAccountId],
    references: [accounts.id],
    relationName: 'itemExpenseAccount',
  }),
  assetAccount: one(accounts, {
    fields: [items.assetAccountId],
    references: [accounts.id],
    relationName: 'itemAssetAccount',
  }),
  cogsAccount: one(accounts, {
    fields: [items.cogsAccountId],
    references: [accounts.id],
    relationName: 'itemCogsAccount',
  }),
  parentItem: one(items, {
    fields: [items.parentItemId],
    references: [items.id],
    relationName: 'itemVariants',
  }),
  variants: many(items, {
    relationName: 'itemVariants',
  }),
}));

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;