import { pgTable, uuid, varchar, timestamp, decimal, integer, text } from "drizzle-orm/pg-core";
import { contracts } from "./contracts";
import { products } from "./products";
import { performanceObligations } from "./performance_obligations";

export const contractLineItems = pgTable("contract_line_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  contractId: uuid("contract_id").references(() => contracts.id).notNull(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  lineItemNumber: integer("line_item_number").notNull(),
  description: text("description"),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  listPrice: decimal("list_price", { precision: 12, scale: 2 }).notNull(),
  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }).default("0"),
  totalPrice: decimal("total_price", { precision: 12, scale: 2 }).notNull(),
  ssp: decimal("ssp", { precision: 12, scale: 2 }),
  allocatedTransactionPrice: decimal("allocated_transaction_price", { precision: 12, scale: 2 }),
  performanceObligationId: uuid("performance_obligation_id").references(() => performanceObligations.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});