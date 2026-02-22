import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const externalEventProcessingStatusEnum = pgEnum("external_event_processing_status", [
  "received",
  "processed",
  "ignored",
  "failed",
]);

export const externalEventReceipts = pgTable(
  "external_event_receipts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: varchar("provider", { length: 64 }).notNull(),
    externalEventId: varchar("external_event_id", { length: 255 }).notNull(),
    organizationId: uuid("organization_id").references(() => organizations.id),
    eventType: varchar("event_type", { length: 255 }).notNull(),
    livemode: boolean("livemode").notNull().default(false),
    signatureVerified: boolean("signature_verified").notNull().default(false),
    processingStatus: externalEventProcessingStatusEnum("processing_status")
      .notNull()
      .default("received"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    processingError: text("processing_error"),
    payload: jsonb("payload"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    providerEventIdUniqueIdx: uniqueIndex("external_event_receipts_provider_event_id_idx").on(
      table.provider,
      table.externalEventId
    ),
    organizationIdIdx: index("external_event_receipts_organization_id_idx").on(table.organizationId),
    processingStatusIdx: index("external_event_receipts_processing_status_idx").on(
      table.processingStatus
    ),
    receivedAtIdx: index("external_event_receipts_received_at_idx").on(table.receivedAt),
  })
);

export const externalEventReceiptsRelations = relations(
  externalEventReceipts,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [externalEventReceipts.organizationId],
      references: [organizations.id],
    }),
  })
);

export type ExternalEventReceipt = typeof externalEventReceipts.$inferSelect;
export type NewExternalEventReceipt = typeof externalEventReceipts.$inferInsert;
export type UpdateExternalEventReceipt = Partial<NewExternalEventReceipt>;
export type ExternalEventProcessingStatus =
  typeof externalEventProcessingStatusEnum.enumValues[number];
