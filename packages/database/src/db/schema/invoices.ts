import { pgTable, uuid, varchar, timestamp, decimal, pgEnum, date, jsonb } from "drizzle-orm/pg-core";
import { entities } from "./entities";
import { organizations } from "./organizations";
import { subscriptions } from "./subscriptions";
import { relations } from "drizzle-orm";

// Enum for invoice status
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "sent",
  "paid",
  "partial",
  "overdue",
  "cancelled",
  "void"
]);

// Invoices table
export const invoices = pgTable("invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  invoiceNumber: varchar("invoice_number", { length: 100 }).notNull(),
  entityId: uuid("entity_id").references(() => entities.id).notNull(),
  subscriptionId: uuid("subscription_id").references(() => subscriptions.id),
  salesOrderId: uuid("sales_order_id"), // Future reference
  invoiceDate: date("invoice_date").notNull(),
  dueDate: date("due_date"),
  billingPeriodStart: date("billing_period_start"),
  billingPeriodEnd: date("billing_period_end"),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  status: invoiceStatusEnum("status").notNull().default("draft"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});

// Import after defining invoices to avoid circular dependency
import { invoiceLineItems } from "./invoice-line-items";
import { payments } from "./payments";

// Relations
export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [invoices.organizationId],
    references: [organizations.id]
  }),
  entity: one(entities, {
    fields: [invoices.entityId],
    references: [entities.id]
  }),
  subscription: one(subscriptions, {
    fields: [invoices.subscriptionId],
    references: [subscriptions.id]
  }),
  lineItems: many(invoiceLineItems),
  payments: many(payments)
}));

// Type exports
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type UpdateInvoice = Partial<NewInvoice>;