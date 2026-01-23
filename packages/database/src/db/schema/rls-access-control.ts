import { pgTable, text, boolean, timestamp, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const roles = pgTable('roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  roleName: text('role_name').notNull().unique(),
  roleDescription: text('role_description'),
  isSystemRole: boolean('is_system_role').default(false).notNull(),
  createdDate: timestamp('created_date', { withTimezone: true }).defaultNow().notNull(),
});

export const rolesRelations = relations(roles, ({ many }) => ({
  rolePermissions: many(rolePermissions),
  userRoles: many(userRoles),
}));

export const permissions = pgTable('permissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  permissionName: text('permission_name').notNull().unique(),
  resourceType: text('resource_type'), // 'GL_TRANSACTION', 'BUSINESS_TRANSACTION', 'ACCOUNT', etc.
  action: text('action'), // 'CREATE', 'READ', 'UPDATE', 'DELETE', 'POST', 'APPROVE'
  description: text('description'),
  createdDate: timestamp('created_date', { withTimezone: true }).defaultNow().notNull(),
});

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const rolePermissions = pgTable('role_permissions', {
  roleId: uuid('role_id').notNull().references(() => roles.id),
  permissionId: uuid('permission_id').notNull().references(() => permissions.id),
  grantedDate: timestamp('granted_date', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  primaryKey: primaryKey(table.roleId, table.permissionId),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

// Entity roles - assign roles to entities (authenticated users are entities with clerkUserId)
export const entityRoles = pgTable('entity_roles', {
  entityId: uuid('entity_id').notNull().references(() => entities.id),
  roleId: uuid('role_id').notNull().references(() => roles.id),
  subsidiaryId: uuid('subsidiary_id'), // Optional: null means global role
  grantedBy: uuid('granted_by').references(() => entities.id),
  grantedDate: timestamp('granted_date', { withTimezone: true }).defaultNow().notNull(),
  expiresDate: timestamp('expires_date', { withTimezone: true }),
}, (table) => ({
  primaryKey: primaryKey(table.entityId, table.roleId, table.subsidiaryId),
}));

export const entityRolesRelations = relations(entityRoles, ({ one }) => ({
  entity: one(entities, {
    fields: [entityRoles.entityId],
    references: [entities.id],
    relationName: 'entity',
  }),
  role: one(roles, {
    fields: [entityRoles.roleId],
    references: [roles.id],
  }),
  subsidiary: one(subsidiaries, {
    fields: [entityRoles.subsidiaryId],
    references: [subsidiaries.id],
  }),
  grantedByEntity: one(entities, {
    fields: [entityRoles.grantedBy],
    references: [entities.id],
    relationName: 'grantedBy',
  }),
}));

// Entity subsidiary access - control which subsidiaries an entity can access
export const entitySubsidiaryAccess = pgTable('entity_subsidiary_access', {
  entityId: uuid('entity_id').notNull().references(() => entities.id),
  subsidiaryId: uuid('subsidiary_id').notNull().references(() => subsidiaries.id),
  accessLevel: text('access_level').default('read').notNull(), // 'read', 'write', 'admin'
  grantedBy: uuid('granted_by').references(() => entities.id),
  grantedDate: timestamp('granted_date', { withTimezone: true }).defaultNow().notNull(),
  expiresDate: timestamp('expires_date', { withTimezone: true }),
}, (table) => ({
  primaryKey: primaryKey(table.entityId, table.subsidiaryId),
}));

export const entitySubsidiaryAccessRelations = relations(entitySubsidiaryAccess, ({ one }) => ({
  entity: one(entities, {
    fields: [entitySubsidiaryAccess.entityId],
    references: [entities.id],
    relationName: 'entity',
  }),
  subsidiary: one(subsidiaries, {
    fields: [entitySubsidiaryAccess.subsidiaryId],
    references: [subsidiaries.id],
  }),
  grantedByEntity: one(entities, {
    fields: [entitySubsidiaryAccess.grantedBy],
    references: [entities.id],
    relationName: 'grantedBy',
  }),
}));

// Legacy aliases for backward compatibility during transition
// TODO: Remove these after all code has been updated to use entity* versions
export const userRoles = entityRoles;
export const userRolesRelations = entityRolesRelations;
export const userSubsidiaryAccess = entitySubsidiaryAccess;
export const userSubsidiaryAccessRelations = entitySubsidiaryAccessRelations;

// Import references
import { primaryKey } from 'drizzle-orm/pg-core';
import { entities } from './entities';
import { subsidiaries } from './subsidiaries';