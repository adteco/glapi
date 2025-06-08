import { pgTable, uuid, timestamp, decimal, date, pgEnum, text } from "drizzle-orm/pg-core";
import { products } from "./products";

export const evidenceTypeEnum = pgEnum("evidence_type", [
  "customer_pricing",
  "comparable_sales",
  "market_research",
  "cost_plus"
]);

export const confidenceLevelEnum = pgEnum("confidence_level", [
  "high",
  "medium",
  "low"
]);

export const sspEvidence = pgTable("ssp_evidence", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  evidenceType: evidenceTypeEnum("evidence_type").notNull(),
  evidenceDate: date("evidence_date").notNull(),
  sspAmount: decimal("ssp_amount", { precision: 12, scale: 2 }).notNull(),
  confidenceLevel: confidenceLevelEnum("confidence_level").notNull(),
  notes: text("notes"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});