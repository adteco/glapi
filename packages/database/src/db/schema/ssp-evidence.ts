import { pgTable, uuid, timestamp, decimal, date, varchar, boolean } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { items } from "./items";
import { evidenceTypeEnum, confidenceLevelEnum } from "./revenue-enums";
import { relations } from "drizzle-orm";

// SSP evidence table - tracks standalone selling price evidence for items
export const sspEvidence = pgTable("ssp_evidence", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  itemId: uuid("item_id").references(() => items.id).notNull(),
  evidenceType: evidenceTypeEnum("evidence_type").notNull(),
  evidenceDate: date("evidence_date").notNull(),
  sspAmount: decimal("ssp_amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD"),
  evidenceSource: varchar("evidence_source", { length: 255 }),
  confidenceLevel: confidenceLevelEnum("confidence_level").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

// Relations
export const sspEvidenceRelations = relations(sspEvidence, ({ one }) => ({
  organization: one(organizations, {
    fields: [sspEvidence.organizationId],
    references: [organizations.id]
  }),
  item: one(items, {
    fields: [sspEvidence.itemId],
    references: [items.id]
  })
}));

// Type exports
export type SspEvidence = typeof sspEvidence.$inferSelect;
export type NewSspEvidence = typeof sspEvidence.$inferInsert;
export type UpdateSspEvidence = Partial<NewSspEvidence>;