import { pgTable, uuid, timestamp, decimal, text } from "drizzle-orm/pg-core";
import { invoices } from "./invoices";
import { subscriptionItems } from "./subscription-items";
import { items } from "./items";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Invoice line items table
export const invoiceLineItems = pgTable("invoice_line_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "cascade" }).notNull(),
  subscriptionItemId: uuid("subscription_item_id").references(() => subscriptionItems.id),
  itemId: uuid("item_id").references(() => items.id),
  description: text("description"),
  quantity: decimal("quantity", { precision: 10, scale: 4 }).notNull().default("1"),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

// Relations
export const invoiceLineItemsRelations = relations(invoiceLineItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceLineItems.invoiceId],
    references: [invoices.id]
  }),
  subscriptionItem: one(subscriptionItems, {
    fields: [invoiceLineItems.subscriptionItemId],
    references: [subscriptionItems.id]
  }),
  item: one(items, {
    fields: [invoiceLineItems.itemId],
    references: [items.id]
  })
}));

// Zod schemas for validation
export const insertInvoiceLineItemSchema = createInsertSchema(invoiceLineItems, {
  description: z.string().max(1000).optional(),
  quantity: z.string().regex(/^\d+(\.\d{1,4})?$/, "Quantity must be a valid decimal with up to 4 decimal places"),
  unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, "Unit price must be a valid decimal with up to 2 decimal places"),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Amount must be a valid decimal with up to 2 decimal places")
}).refine(
  (data) => {
    const quantity = parseFloat(data.quantity);
    const unitPrice = parseFloat(data.unitPrice);
    const amount = parseFloat(data.amount);
    return Math.abs(amount - (quantity * unitPrice)) < 0.01;
  },
  {
    message: "Amount must equal quantity multiplied by unit price",
    path: ["amount"]
  }
);

export const selectInvoiceLineItemSchema = createSelectSchema(invoiceLineItems);

export const updateInvoiceLineItemSchema = insertInvoiceLineItemSchema.partial().omit({ 
  id: true, 
  invoiceId: true,
  createdAt: true
});

export type InvoiceLineItem = z.infer<typeof selectInvoiceLineItemSchema>;
export type NewInvoiceLineItem = z.infer<typeof insertInvoiceLineItemSchema>;
export type UpdateInvoiceLineItem = z.infer<typeof updateInvoiceLineItemSchema>;