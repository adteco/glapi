import { pgTable, uuid, timestamp, decimal, text } from "drizzle-orm/pg-core";
import { invoices } from "./invoices";
import { subscriptionItems } from "./subscription-items";
import { items } from "./items";
import { relations } from "drizzle-orm";
import { projectTasks } from "./project-tasks";

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
  linkedProjectTaskId: uuid("linked_project_task_id").references(() => projectTasks.id),
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
  }),
  linkedProjectTask: one(projectTasks, {
    fields: [invoiceLineItems.linkedProjectTaskId],
    references: [projectTasks.id],
    relationName: 'invoiceLineTask'
  })
}));

// Type exports
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type NewInvoiceLineItem = typeof invoiceLineItems.$inferInsert;
export type UpdateInvoiceLineItem = Partial<NewInvoiceLineItem>;