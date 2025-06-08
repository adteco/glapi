import { pgTable, text, uuid, decimal, boolean, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';

export const unitsOfMeasure = pgTable('units_of_measure', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  code: text('code').notNull(),
  name: text('name').notNull(),
  abbreviation: text('abbreviation').notNull(),
  baseUnitId: uuid('base_unit_id').references(() => unitsOfMeasure.id),
  conversionFactor: decimal('conversion_factor', { precision: 18, scale: 6 }).default('1.0'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
}, (table) => ({
  orgCodeUnique: uniqueIndex('idx_units_of_measure_org_code').on(table.organizationId, table.code),
  orgAbbrevUnique: uniqueIndex('idx_units_of_measure_org_abbrev').on(table.organizationId, table.abbreviation),
}));

export const unitsOfMeasureRelations = relations(unitsOfMeasure, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [unitsOfMeasure.organizationId],
    references: [organizations.id],
  }),
  baseUnit: one(unitsOfMeasure, {
    fields: [unitsOfMeasure.baseUnitId],
    references: [unitsOfMeasure.id],
    relationName: 'baseUnitRelation',
  }),
  derivedUnits: many(unitsOfMeasure, {
    relationName: 'baseUnitRelation',
  }),
}));

export type UnitsOfMeasure = typeof unitsOfMeasure.$inferSelect;
export type NewUnitsOfMeasure = typeof unitsOfMeasure.$inferInsert;