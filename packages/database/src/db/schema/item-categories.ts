import { pgTable, text, uuid, integer, boolean, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';

export const itemCategories = pgTable('item_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  code: text('code').notNull(),
  name: text('name').notNull(),
  parentCategoryId: uuid('parent_category_id').references(() => itemCategories.id),
  level: integer('level').notNull().default(0),
  path: text('path').notNull(), // Materialized path for hierarchy
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
}, (table) => ({
  orgCodeUnique: uniqueIndex('idx_item_categories_org_code').on(table.organizationId, table.code),
  pathIndex: index('idx_item_categories_path').on(table.path),
  parentIndex: index('idx_item_categories_parent').on(table.parentCategoryId),
}));

export const itemCategoriesRelations = relations(itemCategories, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [itemCategories.organizationId],
    references: [organizations.id],
  }),
  parentCategory: one(itemCategories, {
    fields: [itemCategories.parentCategoryId],
    references: [itemCategories.id],
    relationName: 'categoryHierarchy',
  }),
  childCategories: many(itemCategories, {
    relationName: 'categoryHierarchy',
  }),
}));

export type ItemCategory = typeof itemCategories.$inferSelect;
export type NewItemCategory = typeof itemCategories.$inferInsert;