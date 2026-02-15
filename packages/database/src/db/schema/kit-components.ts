import { pgTable, uuid, timestamp, decimal, boolean } from "drizzle-orm/pg-core";
import { items } from "./items";
import { relations } from "drizzle-orm";

/**
 * kit_components
 *
 * Must match the live RDS schema:
 * - kit_item_id, component_item_id, quantity, is_optional
 * - no organization_id column (RLS enforced via `check_item_org(kit_item_id)`)
 */
export const kitComponents = pgTable("kit_components", {
  id: uuid("id").defaultRandom().primaryKey(),
  kitItemId: uuid("kit_item_id").references(() => items.id).notNull(),
  componentItemId: uuid("component_item_id").references(() => items.id).notNull(),
  quantity: decimal("quantity", { precision: 18, scale: 2 }).notNull(),
  isOptional: boolean("is_optional").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Relations
export const kitComponentsRelations = relations(kitComponents, ({ one }) => ({
  kitItem: one(items, {
    fields: [kitComponents.kitItemId],
    references: [items.id],
    relationName: "kitItem",
  }),
  componentItem: one(items, {
    fields: [kitComponents.componentItemId],
    references: [items.id],
    relationName: "kitComponentItem",
  }),
}));

// Type exports
export type KitComponent = typeof kitComponents.$inferSelect;
export type NewKitComponent = typeof kitComponents.$inferInsert;
export type UpdateKitComponent = Partial<NewKitComponent>;
