import { pgTable, uuid, varchar, timestamp, decimal, pgEnum, date, jsonb } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { invoices } from "./invoices";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Enum for payment status
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "completed",
  "failed",
  "refunded",
  "partial_refund"
]);

// Enum for payment method
export const paymentMethodEnum = pgEnum("payment_method", [
  "credit_card",
  "debit_card",
  "ach",
  "wire",
  "check",
  "cash",
  "other"
]);

// Payments table
export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  invoiceId: uuid("invoice_id").references(() => invoices.id),
  paymentDate: date("payment_date").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum("payment_method"),
  transactionReference: varchar("transaction_reference", { length: 255 }),
  status: paymentStatusEnum("status").notNull().default("pending"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});

// Relations
export const paymentsRelations = relations(payments, ({ one }) => ({
  organization: one(organizations, {
    fields: [payments.organizationId],
    references: [organizations.id]
  }),
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id]
  })
}));

// Zod schemas for validation
export const insertPaymentSchema = createInsertSchema(payments, {
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  amount: z.string()
    .regex(/^\d+(\.\d{1,2})?$/, "Amount must be a valid decimal with up to 2 decimal places")
    .refine((val) => parseFloat(val) > 0, "Amount must be greater than 0"),
  transactionReference: z.string().max(255).optional(),
  metadata: z.record(z.any()).optional()
});

export const selectPaymentSchema = createSelectSchema(payments);

export const updatePaymentSchema = insertPaymentSchema.partial().omit({ 
  id: true, 
  organizationId: true,
  createdAt: true,
  updatedAt: true 
});

export type Payment = z.infer<typeof selectPaymentSchema>;
export type NewPayment = z.infer<typeof insertPaymentSchema>;
export type UpdatePayment = z.infer<typeof updatePaymentSchema>;