import { pgTable, uuid, timestamp, decimal, date, jsonb } from "drizzle-orm/pg-core";
import { subscriptions } from "./subscriptions";
import { items } from "./items";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Subscription items table
export const subscriptionItems = pgTable("subscription_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  subscriptionId: uuid("subscription_id").references(() => subscriptions.id, { onDelete: "cascade" }).notNull(),
  itemId: uuid("item_id").references(() => items.id).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 4 }).notNull().default("1"),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  discountPercentage: decimal("discount_percentage", { precision: 5, scale: 4 }).default("0"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});

// Relations
export const subscriptionItemsRelations = relations(subscriptionItems, ({ one }) => ({
  subscription: one(subscriptions, {
    fields: [subscriptionItems.subscriptionId],
    references: [subscriptions.id]
  }),
  item: one(items, {
    fields: [subscriptionItems.itemId],
    references: [items.id]
  })
}));

// Zod schemas for validation
export const insertSubscriptionItemSchema = createInsertSchema(subscriptionItems, {
  quantity: z.string().regex(/^\d+(\.\d{1,4})?$/, "Quantity must be a valid decimal with up to 4 decimal places"),
  unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, "Unit price must be a valid decimal with up to 2 decimal places"),
  discountPercentage: z.string()
    .regex(/^\d+(\.\d{1,4})?$/, "Discount percentage must be a valid decimal")
    .optional()
    .refine((val) => {
      if (val) {
        const num = parseFloat(val);
        return num >= 0 && num <= 100;
      }
      return true;
    }, "Discount percentage must be between 0 and 100"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
  metadata: z.record(z.any()).optional()
}).refine(
  (data) => {
    if (data.endDate && data.startDate) {
      return new Date(data.endDate) > new Date(data.startDate);
    }
    return true;
  },
  {
    message: "End date must be after start date",
    path: ["endDate"]
  }
);

export const selectSubscriptionItemSchema = createSelectSchema(subscriptionItems);

export const updateSubscriptionItemSchema = insertSubscriptionItemSchema.partial().omit({ 
  id: true, 
  subscriptionId: true,
  createdAt: true,
  updatedAt: true 
});

export type SubscriptionItem = z.infer<typeof selectSubscriptionItemSchema>;
export type NewSubscriptionItem = z.infer<typeof insertSubscriptionItemSchema>;
export type UpdateSubscriptionItem = z.infer<typeof updateSubscriptionItemSchema>;