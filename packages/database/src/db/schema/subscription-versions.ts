import { pgTable, uuid, varchar, timestamp, decimal, pgEnum, date, boolean, jsonb, integer, text } from "drizzle-orm/pg-core";
import { subscriptions } from "./subscriptions";
import { organizations } from "./organizations";
import { relations } from "drizzle-orm";

// Enum for version type - what triggered this version
export const subscriptionVersionTypeEnum = pgEnum("subscription_version_type", [
  "creation",           // Initial subscription creation
  "amendment",          // Terms/items changed
  "status_change",      // Status transition
  "renewal",            // Subscription renewed
  "cancellation",       // Subscription cancelled
  "reactivation",       // Subscription reactivated
  "price_change",       // Pricing updated
  "term_extension",     // Extended contract term
  "item_modification"   // Items added/removed/changed
]);

// Enum for the source of the version change
export const subscriptionVersionSourceEnum = pgEnum("subscription_version_source", [
  "user",               // Manual change by user
  "system",             // System-triggered (e.g., auto-renewal)
  "api",                // External API call
  "workflow",           // Workflow automation
  "migration"           // Data migration
]);

// Main subscription versions table - tracks all changes with full snapshot
export const subscriptionVersions = pgTable("subscription_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  subscriptionId: uuid("subscription_id").references(() => subscriptions.id).notNull(),

  // Version tracking
  versionNumber: integer("version_number").notNull(),
  versionType: subscriptionVersionTypeEnum("version_type").notNull(),
  versionSource: subscriptionVersionSourceEnum("version_source").notNull().default("user"),

  // State at this version (snapshot)
  previousStatus: varchar("previous_status", { length: 50 }),
  newStatus: varchar("new_status", { length: 50 }).notNull(),

  // Full snapshot of subscription data at this version
  subscriptionSnapshot: jsonb("subscription_snapshot").notNull(), // Full subscription record
  itemsSnapshot: jsonb("items_snapshot"), // Array of subscription items

  // Change details
  changedFields: jsonb("changed_fields"), // Array of field names that changed
  changeSummary: text("change_summary"), // Human-readable summary
  changeReason: text("change_reason"), // User-provided reason

  // Financial impact
  previousContractValue: decimal("previous_contract_value", { precision: 12, scale: 2 }),
  newContractValue: decimal("new_contract_value", { precision: 12, scale: 2 }),
  contractValueDelta: decimal("contract_value_delta", { precision: 12, scale: 2 }),

  // Effective dates
  effectiveDate: date("effective_date").notNull(),

  // Audit fields
  createdBy: uuid("created_by"), // User ID who made the change
  createdByName: varchar("created_by_name", { length: 255 }), // Cached for audit purposes
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),

  // Additional metadata
  metadata: jsonb("metadata") // Any additional context
});

// Relations
export const subscriptionVersionsRelations = relations(subscriptionVersions, ({ one }) => ({
  organization: one(organizations, {
    fields: [subscriptionVersions.organizationId],
    references: [organizations.id]
  }),
  subscription: one(subscriptions, {
    fields: [subscriptionVersions.subscriptionId],
    references: [subscriptions.id]
  })
}));

// Type exports
export type SubscriptionVersion = typeof subscriptionVersions.$inferSelect;
export type NewSubscriptionVersion = typeof subscriptionVersions.$inferInsert;
export type UpdateSubscriptionVersion = Partial<NewSubscriptionVersion>;

// Type for the subscription snapshot stored in JSONB
export interface SubscriptionSnapshot {
  id: string;
  subscriptionNumber: string;
  status: string;
  entityId: string;
  startDate: string;
  endDate?: string | null;
  contractValue?: string | null;
  billingFrequency?: string | null;
  autoRenew?: boolean | null;
  renewalTermMonths?: number | null;
  metadata?: Record<string, unknown> | null;
}

// Type for item snapshot stored in JSONB
export interface SubscriptionItemSnapshot {
  id: string;
  itemId: string;
  quantity: string;
  unitPrice: string;
  discountPercentage?: string | null;
  startDate: string;
  endDate?: string | null;
}

// Helper type for changed fields tracking
export interface SubscriptionChangedField {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}
