import { pgTable, uuid, varchar, timestamp, decimal, boolean, pgEnum } from "drizzle-orm/pg-core";
import { revenueRecognitionPatterns } from './recognition_patterns';

export const productTypeEnum = pgEnum("product_type", [
  "software_license",
  "saas_subscription",
  "professional_services",
  "support"
]);

export const sspSourceEnum = pgEnum("ssp_source", [
  "internal_analysis",
  "third_party_pricing",
  "observable_evidence"
]);

export const recognitionTypeEnum = pgEnum("recognition_type", [
  "point_in_time",
  "over_time",
  "hybrid"
]);

export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  productCode: varchar("product_code", { length: 100 }).unique().notNull(),
  productName: varchar("product_name", { length: 255 }).notNull(),
  productType: productTypeEnum("product_type").notNull(),
  defaultSsp: decimal("default_ssp", { precision: 12, scale: 2 }),
  sspSource: sspSourceEnum("ssp_source").default("internal_analysis"),
  recognitionType: recognitionTypeEnum("recognition_type").notNull(),
  defaultRecognitionPatternId: uuid("default_recognition_pattern_id").references(() => revenueRecognitionPatterns.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});