import { pgTable, uuid, timestamp, decimal, boolean } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { items } from "./items";
import { relations } from "drizzle-orm";

// Kit components table - defines parent-child relationships for kit/bundle items
export const kitComponents = pgTable("kit_components", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  parentItemId: uuid("parent_item_id").references(() => items.id).notNull(),
  componentItemId: uuid("component_item_id").references(() => items.id).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 4 }).default("1"),
  allocationPercentage: decimal("allocation_percentage", { precision: 5, scale: 4 }),
  isSeparatelyPriced: boolean("is_separately_priced").default(false),
  fixedPrice: decimal("fixed_price", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});

// Relations
export const kitComponentsRelations = relations(kitComponents, ({ one }) => ({
  organization: one(organizations, {
    fields: [kitComponents.organizationId],
    references: [organizations.id]
  }),
  parentItem: one(items, {
    fields: [kitComponents.parentItemId],
    references: [items.id]
  }),
  componentItem: one(items, {
    fields: [kitComponents.componentItemId],
    references: [items.id]
  })
}));

// Type exports
export type KitComponent = typeof kitComponents.$inferSelect;
export type NewKitComponent = typeof kitComponents.$inferInsert;
export type UpdateKitComponent = Partial<NewKitComponent>;

// Interface for exploded components with calculated pricing
export interface ExplodedComponent {
  componentId: string;
  componentItemId: string;
  quantity: number;
  allocatedPrice: number;
  allocationMethod: 'percentage' | 'fixed' | 'ssp';
}

// Interface for component pricing calculation
export interface ComponentPricing {
  componentId: string;
  basePrice: number;
  quantity: number;
  totalPrice: number;
}

// Interface for kit hierarchy
export interface KitHierarchy {
  itemId: string;
  components: Array<{
    component: KitComponent;
    subComponents?: KitHierarchy;
  }>;
  hasCircularReference: boolean;
}