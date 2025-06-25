import { pgTable, uuid, varchar, timestamp, jsonb, boolean, pgEnum } from "drizzle-orm/pg-core";

export const patternTypeEnum = pgEnum("pattern_type", [
  "straight_line",
  "proportional",
  "milestone",
  "custom"
]);

export const revenueRecognitionPatterns = pgTable("revenue_recognition_patterns", {
  id: uuid("id").defaultRandom().primaryKey(),
  patternName: varchar("pattern_name", { length: 255 }).notNull(),
  patternType: patternTypeEnum("pattern_type").notNull(),
  patternConfig: jsonb("pattern_config"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});