import { pgTable, text, uuid, decimal, boolean, timestamp, uniqueIndex, index, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { items } from './items';
import { unitsOfMeasure } from './units-of-measure';

// Assembly Components (Bill of Materials)
export const assemblyComponents = pgTable('assembly_components', {
  id: uuid('id').defaultRandom().primaryKey(),
  assemblyItemId: uuid('assembly_item_id').notNull().references(() => items.id),
  componentItemId: uuid('component_item_id').notNull().references(() => items.id),
  quantity: decimal('quantity', { precision: 18, scale: 6 }).notNull(),
  unitOfMeasureId: uuid('unit_of_measure_id').references(() => unitsOfMeasure.id),
  sequenceNumber: integer('sequence_number').default(1),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  assemblyComponentUnique: uniqueIndex('idx_assembly_components_unique').on(table.assemblyItemId, table.componentItemId),
  assemblyIndex: index('idx_assembly_components_assembly').on(table.assemblyItemId),
  componentIndex: index('idx_assembly_components_component').on(table.componentItemId),
}));

// Kit Components
export const kitComponents = pgTable('kit_components', {
  id: uuid('id').defaultRandom().primaryKey(),
  kitItemId: uuid('kit_item_id').notNull().references(() => items.id),
  componentItemId: uuid('component_item_id').notNull().references(() => items.id),
  quantity: decimal('quantity', { precision: 18, scale: 2 }).notNull(),
  isOptional: boolean('is_optional').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  kitComponentUnique: uniqueIndex('idx_kit_components_unique').on(table.kitItemId, table.componentItemId),
  kitIndex: index('idx_kit_components_kit').on(table.kitItemId),
}));

// Relations
export const assemblyComponentsRelations = relations(assemblyComponents, ({ one }) => ({
  assemblyItem: one(items, {
    fields: [assemblyComponents.assemblyItemId],
    references: [items.id],
    relationName: 'assemblyItem',
  }),
  componentItem: one(items, {
    fields: [assemblyComponents.componentItemId],
    references: [items.id],
    relationName: 'componentItem',
  }),
  unitOfMeasure: one(unitsOfMeasure, {
    fields: [assemblyComponents.unitOfMeasureId],
    references: [unitsOfMeasure.id],
  }),
}));

export const kitComponentsRelations = relations(kitComponents, ({ one }) => ({
  kitItem: one(items, {
    fields: [kitComponents.kitItemId],
    references: [items.id],
    relationName: 'kitItem',
  }),
  componentItem: one(items, {
    fields: [kitComponents.componentItemId],
    references: [items.id],
    relationName: 'kitComponentItem',
  }),
}));

export type AssemblyComponent = typeof assemblyComponents.$inferSelect;
export type NewAssemblyComponent = typeof assemblyComponents.$inferInsert;
export type KitComponent = typeof kitComponents.$inferSelect;
export type NewKitComponent = typeof kitComponents.$inferInsert;