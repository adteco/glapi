import { relations, sql } from 'drizzle-orm';
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

export const projectBillingRequests = pgTable(
  'project_billing_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull(),
    requestHash: varchar('request_hash', { length: 64 }).notNull(),
    status: text('status').default('processing').notNull(),
    response: jsonb('response').$type<Record<string, unknown>>(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    organizationKeyUnique: uniqueIndex(
      'ux_project_billing_requests_org_key',
    ).on(table.organizationId, table.idempotencyKey),
    organizationStatusIdx: index('idx_project_billing_requests_org_status').on(
      table.organizationId,
      table.status,
    ),
    validStatus: check(
      'chk_project_billing_requests_status',
      sql`${table.status} IN ('processing', 'completed')`,
    ),
    completedResponse: check(
      'chk_project_billing_requests_completed_response',
      sql`${table.status} <> 'completed' OR (${table.response} IS NOT NULL AND ${table.completedAt} IS NOT NULL)`,
    ),
  }),
);

export const projectBillingRequestsRelations = relations(
  projectBillingRequests,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [projectBillingRequests.organizationId],
      references: [organizations.id],
    }),
  }),
);

export type ProjectBillingRequest = typeof projectBillingRequests.$inferSelect;
export type NewProjectBillingRequest =
  typeof projectBillingRequests.$inferInsert;
