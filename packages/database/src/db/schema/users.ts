import { pgTable, uuid, varchar, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  stytchUserId: varchar("stytch_user_id", { length: 100 }).unique().notNull(),
  betterAuthUserId: varchar("better_auth_user_id", { length: 100 }).unique(),
  email: varchar("email", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  role: varchar("role", { length: 50 }).default("user").notNull(),
  settings: jsonb("settings"),
  isActive: boolean("is_active").default(true),
  lastLogin: timestamp("last_login", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});