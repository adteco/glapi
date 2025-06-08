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

export const userRoles = pgTable('user_roles', {
  userId: uuid('user_id').notNull().references(() => users.id),
  roleId: uuid('role_id').notNull().references(() => roles.id),
  subsidiaryId: uuid('subsidiary_id'), // Optional: null means global role
  grantedBy: uuid('granted_by').references(() => users.id),
  grantedDate: timestamp('granted_date', { withTimezone: true }).defaultNow().notNull(),
  expiresDate: timestamp('expires_date', { withTimezone: true }),
}, (table) => ({
  primaryKey: primaryKey(table.userId, table.roleId, table.subsidiaryId),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
    relationName: 'user',
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
  subsidiary: one(subsidiaries, {
    fields: [userRoles.subsidiaryId],
    references: [subsidiaries.id],
  }),
  grantedByUser: one(users, {
    fields: [userRoles.grantedBy],
    references: [users.id],
    relationName: 'grantedBy',
  }),
}));

export const userSubsidiaryAccess = pgTable('user_subsidiary_access', {
  userId: uuid('user_id').notNull().references(() => users.id),
  subsidiaryId: uuid('subsidiary_id').notNull().references(() => subsidiaries.id),
  accessLevel: text('access_level').default('read').notNull(), // 'read', 'write', 'admin'
  grantedBy: uuid('granted_by').references(() => users.id),
  grantedDate: timestamp('granted_date', { withTimezone: true }).defaultNow().notNull(),
  expiresDate: timestamp('expires_date', { withTimezone: true }),
}, (table) => ({
  primaryKey: primaryKey(table.userId, table.subsidiaryId),
}));

export const userSubsidiaryAccessRelations = relations(userSubsidiaryAccess, ({ one }) => ({
  user: one(users, {
    fields: [userSubsidiaryAccess.userId],
    references: [users.id],
    relationName: 'user',
  }),
  subsidiary: one(subsidiaries, {
    fields: [userSubsidiaryAccess.subsidiaryId],
    references: [subsidiaries.id],
  }),
  grantedByUser: one(users, {
    fields: [userSubsidiaryAccess.grantedBy],
    references: [users.id],
    relationName: 'grantedBy',
  }),
}));

// Import references
import { primaryKey } from 'drizzle-orm/pg-core';
import { users } from './users';
import { subsidiaries } from './subsidiaries';