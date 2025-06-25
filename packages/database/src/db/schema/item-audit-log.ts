import { pgTable, uuid, text, jsonb, timestamp, index, inet } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { items } from './items';

export const itemAuditLog = pgTable('item_audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  userId: uuid('user_id').notNull(),
  itemId: uuid('item_id').references(() => items.id),
  action: text('action').notNull(), // CREATE, UPDATE, DELETE, VIEW
  changes: jsonb('changes'),
  ipAddress: inet('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  auditItemIndex: index('idx_item_audit_item').on(table.itemId),
  userIndex: index('idx_item_audit_user').on(table.userId),
  actionIndex: index('idx_item_audit_action').on(table.action),
  createdIndex: index('idx_item_audit_created').on(table.createdAt),
}));

export const itemAuditLogRelations = relations(itemAuditLog, ({ one }) => ({
  organization: one(organizations, {
    fields: [itemAuditLog.organizationId],
    references: [organizations.id],
  }),
  item: one(items, {
    fields: [itemAuditLog.itemId],
    references: [items.id],
  }),
}));

export type ItemAuditLog = typeof itemAuditLog.$inferSelect;
export type NewItemAuditLog = typeof itemAuditLog.$inferInsert;