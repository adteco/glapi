import { pgTable, uuid, varchar, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  stytchOrgId: varchar("stytch_org_id", { length: 100 }).unique(),
  clerkOrgId: varchar("clerk_org_id", { length: 100 }).unique(), // Clerk organization ID (org_xxxxx format)
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  stripeDefaultPaymentMethodId: varchar("stripe_default_payment_method_id", { length: 255 }),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).unique().notNull(),
  settings: jsonb("settings"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
}, (table) => ({
  clerkOrgIdIdx: index("organizations_clerk_org_id_idx").on(table.clerkOrgId),
  stripeCustomerIdIdx: index("organizations_stripe_customer_id_idx").on(table.stripeCustomerId),
}));
