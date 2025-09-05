import { pgTable, uuid, varchar, timestamp, decimal, pgEnum, date, jsonb } from "drizzle-orm/pg-core";
import { entities } from "./entities";
import { organizations } from "./organizations";
import { subscriptions } from "./subscriptions";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

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

// Zod schemas for validation
export const insertInvoiceSchema = createInsertSchema(invoices, {
  invoiceNumber: z.string().min(1).max(100),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
  billingPeriodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
  billingPeriodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
  subtotal: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid decimal format"),
  taxAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid decimal format").optional(),
  totalAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid decimal format"),
  metadata: z.record(z.any()).optional()
}).refine(
  (data) => {
    if (data.dueDate && data.invoiceDate) {
      return new Date(data.dueDate) >= new Date(data.invoiceDate);
    }
    return true;
  },
  {
    message: "Due date must be on or after invoice date",
    path: ["dueDate"]
  }
).refine(
  (data) => {
    if (data.billingPeriodEnd && data.billingPeriodStart) {
      return new Date(data.billingPeriodEnd) >= new Date(data.billingPeriodStart);
    }
    return true;
  },
  {
    message: "Billing period end must be on or after billing period start",
    path: ["billingPeriodEnd"]
  }
).refine(
  (data) => {
    const subtotal = parseFloat(data.subtotal);
    const taxAmount = data.taxAmount ? parseFloat(data.taxAmount) : 0;
    const totalAmount = parseFloat(data.totalAmount);
    return Math.abs(totalAmount - (subtotal + taxAmount)) < 0.01;
  },
  {
    message: "Total amount must equal subtotal plus tax amount",
    path: ["totalAmount"]
  }
);

export const selectInvoiceSchema = createSelectSchema(invoices);

export const updateInvoiceSchema = insertInvoiceSchema.partial().omit({ 
  id: true, 
  organizationId: true,
  createdAt: true,
  updatedAt: true 
});

export type Invoice = z.infer<typeof selectInvoiceSchema>;
export type NewInvoice = z.infer<typeof insertInvoiceSchema>;
export type UpdateInvoice = z.infer<typeof updateInvoiceSchema>;