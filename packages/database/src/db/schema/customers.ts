import { pgTable, uuid, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  customerId: varchar("customer_id", { length: 100 }).unique().notNull(),
  billingAddress: jsonb("billing_address"),
  contactEmail: varchar("contact_email", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  status: varchar("status", { length: 50 }).default("active").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});