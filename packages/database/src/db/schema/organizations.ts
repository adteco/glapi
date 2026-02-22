import { pgTable, uuid, varchar, timestamp, jsonb, index, boolean, pgEnum } from "drizzle-orm/pg-core";

export const stripeConnectStatusEnum = pgEnum("stripe_connect_status", [
  "not_connected",
  "pending",
  "active",
  "restricted",
]);

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  stytchOrgId: varchar("stytch_org_id", { length: 100 }).unique(),
  clerkOrgId: varchar("clerk_org_id", { length: 100 }).unique(), // Clerk organization ID (org_xxxxx format)
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  stripeAccountId: varchar("stripe_account_id", { length: 255 }),
  stripeConnectStatus: stripeConnectStatusEnum("stripe_connect_status").default("not_connected").notNull(),
  stripeChargesEnabled: boolean("stripe_charges_enabled").default(false).notNull(),
  stripePayoutsEnabled: boolean("stripe_payouts_enabled").default(false).notNull(),
  stripeOnboardingCompletedAt: timestamp("stripe_onboarding_completed_at", { withTimezone: true }),
  stripeDefaultPaymentMethodId: varchar("stripe_default_payment_method_id", { length: 255 }),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).unique().notNull(),
  settings: jsonb("settings"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
}, (table) => ({
  clerkOrgIdIdx: index("organizations_clerk_org_id_idx").on(table.clerkOrgId),
  stripeCustomerIdIdx: index("organizations_stripe_customer_id_idx").on(table.stripeCustomerId),
  stripeAccountIdIdx: index("organizations_stripe_account_id_idx").on(table.stripeAccountId),
  stripeConnectStatusIdx: index("organizations_stripe_connect_status_idx").on(table.stripeConnectStatus),
}));
