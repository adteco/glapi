import { pgTable, uuid, timestamp, pgEnum, jsonb, integer, text, foreignKey } from "drizzle-orm/pg-core";
import { subscriptions } from "./subscriptions";
import { organizations } from "./organizations";
import { users } from "./users";
import { relations } from "drizzle-orm";

// Enum for version type - what triggered this version.
// Keep this aligned with the live Postgres enum `subscription_version_type`.
export const subscriptionVersionTypeEnum = pgEnum("subscription_version_type", [
  "creation",
  "activation",
  "amendment",
  "modification",
  "suspension",
  "resumption",
  "cancellation",
  "renewal",
]);

// Enum for the source of the version change.
// Keep this aligned with the live Postgres enum `subscription_version_source`.
export const subscriptionVersionSourceEnum = pgEnum("subscription_version_source", [
  "system",
  "user",
  "integration",
  "import",
]);

// Main subscription versions table - tracks all changes with full snapshot.
// This mirrors the live RDS table (see `\\d+ subscription_versions`).
export const subscriptionVersions = pgTable("subscription_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  subscriptionId: uuid("subscription_id").references(() => subscriptions.id).notNull(),

  // Version tracking
  versionNumber: integer("version_number").notNull(),
  versionType: subscriptionVersionTypeEnum("version_type").notNull(),
  versionSource: subscriptionVersionSourceEnum("version_source").notNull().default("system"),

  // Change details
  changeSummary: text("change_summary"),
  changeReason: text("change_reason"),

  // When this version took effect
  effectiveDate: timestamp("effective_date", { withTimezone: true }).defaultNow().notNull(),

  // Optional link to a contract modification (used by the 606 engine)
  modificationId: text("modification_id"),

  // Additional metadata
  metadata: jsonb("metadata"),

  // Full snapshot of subscription data at this version
  subscriptionSnapshot: jsonb("subscription_snapshot").notNull(),
  itemsSnapshot: jsonb("items_snapshot").notNull(),

  // Audit fields
  createdBy: uuid("created_by").references(() => users.id),
  // Defined as a self-referencing foreign key in the table config below to avoid TS circular inference issues.
  previousVersionId: uuid("previous_version_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  previousVersionFk: foreignKey({
    columns: [table.previousVersionId],
    foreignColumns: [table.id],
  }),
}));

// Relations
export const subscriptionVersionsRelations = relations(subscriptionVersions, ({ one }) => ({
  organization: one(organizations, {
    fields: [subscriptionVersions.organizationId],
    references: [organizations.id]
  }),
  subscription: one(subscriptions, {
    fields: [subscriptionVersions.subscriptionId],
    references: [subscriptions.id]
  }),
  previousVersion: one(subscriptionVersions, {
    fields: [subscriptionVersions.previousVersionId],
    references: [subscriptionVersions.id],
    relationName: "subscriptionVersionPrevious",
  }),
  createdByUser: one(users, {
    fields: [subscriptionVersions.createdBy],
    references: [users.id],
    relationName: "subscriptionVersionCreatedBy",
  }),
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
