import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { entities } from "./entities";
import { organizations } from "./organizations";

export const customerPortalUserStatusEnum = pgEnum("customer_portal_user_status", [
  "invited",
  "active",
  "suspended",
]);

export const customerPortalRoleEnum = pgEnum("customer_portal_role", [
  "billing_viewer",
  "payer",
  "billing_admin",
]);

export const customerPortalUsers = pgTable(
  "customer_portal_users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    email: varchar("email", { length: 320 }).notNull(),
    fullName: varchar("full_name", { length: 255 }),
    passwordHash: text("password_hash"),
    status: customerPortalUserStatusEnum("status").notNull().default("invited"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgEmailUniqueIdx: uniqueIndex("customer_portal_users_org_email_idx").on(
      table.organizationId,
      table.email
    ),
    orgStatusIdx: index("customer_portal_users_org_status_idx").on(
      table.organizationId,
      table.status
    ),
  })
);

export const customerPortalMemberships = pgTable(
  "customer_portal_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    portalUserId: uuid("portal_user_id")
      .notNull()
      .references(() => customerPortalUsers.id),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    role: customerPortalRoleEnum("role").notNull().default("billing_viewer"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgUserEntityUniqueIdx: uniqueIndex("customer_portal_memberships_org_user_entity_idx").on(
      table.organizationId,
      table.portalUserId,
      table.entityId
    ),
    orgEntityIdx: index("customer_portal_memberships_org_entity_idx").on(
      table.organizationId,
      table.entityId
    ),
  })
);

export const customerPortalInvites = pgTable(
  "customer_portal_invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    email: varchar("email", { length: 320 }).notNull(),
    role: customerPortalRoleEnum("role").notNull().default("billing_viewer"),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    invitedByEntityId: uuid("invited_by_entity_id").references(() => entities.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenHashUniqueIdx: uniqueIndex("customer_portal_invites_token_hash_idx").on(table.tokenHash),
    orgEmailIdx: index("customer_portal_invites_org_email_idx").on(table.organizationId, table.email),
    orgEntityIdx: index("customer_portal_invites_org_entity_idx").on(table.organizationId, table.entityId),
  })
);

export const customerPortalSessions = pgTable(
  "customer_portal_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    portalUserId: uuid("portal_user_id")
      .notNull()
      .references(() => customerPortalUsers.id),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenHashUniqueIdx: uniqueIndex("customer_portal_sessions_token_hash_idx").on(table.tokenHash),
    orgUserIdx: index("customer_portal_sessions_org_user_idx").on(
      table.organizationId,
      table.portalUserId
    ),
  })
);

export const customerPortalPasswordResets = pgTable(
  "customer_portal_password_resets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    portalUserId: uuid("portal_user_id")
      .notNull()
      .references(() => customerPortalUsers.id),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenHashUniqueIdx: uniqueIndex("customer_portal_password_resets_token_hash_idx").on(
      table.tokenHash
    ),
    orgUserIdx: index("customer_portal_password_resets_org_user_idx").on(
      table.organizationId,
      table.portalUserId
    ),
  })
);

export const customerPortalUsersRelations = relations(customerPortalUsers, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [customerPortalUsers.organizationId],
    references: [organizations.id],
  }),
  memberships: many(customerPortalMemberships),
  sessions: many(customerPortalSessions),
  passwordResets: many(customerPortalPasswordResets),
}));

export const customerPortalMembershipsRelations = relations(
  customerPortalMemberships,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [customerPortalMemberships.organizationId],
      references: [organizations.id],
    }),
    portalUser: one(customerPortalUsers, {
      fields: [customerPortalMemberships.portalUserId],
      references: [customerPortalUsers.id],
    }),
    entity: one(entities, {
      fields: [customerPortalMemberships.entityId],
      references: [entities.id],
    }),
  })
);

export const customerPortalInvitesRelations = relations(customerPortalInvites, ({ one }) => ({
  organization: one(organizations, {
    fields: [customerPortalInvites.organizationId],
    references: [organizations.id],
  }),
  entity: one(entities, {
    fields: [customerPortalInvites.entityId],
    references: [entities.id],
  }),
  invitedByEntity: one(entities, {
    fields: [customerPortalInvites.invitedByEntityId],
    references: [entities.id],
  }),
}));

export const customerPortalSessionsRelations = relations(customerPortalSessions, ({ one }) => ({
  organization: one(organizations, {
    fields: [customerPortalSessions.organizationId],
    references: [organizations.id],
  }),
  portalUser: one(customerPortalUsers, {
    fields: [customerPortalSessions.portalUserId],
    references: [customerPortalUsers.id],
  }),
}));

export const customerPortalPasswordResetsRelations = relations(
  customerPortalPasswordResets,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [customerPortalPasswordResets.organizationId],
      references: [organizations.id],
    }),
    portalUser: one(customerPortalUsers, {
      fields: [customerPortalPasswordResets.portalUserId],
      references: [customerPortalUsers.id],
    }),
  })
);

export type CustomerPortalUser = typeof customerPortalUsers.$inferSelect;
export type NewCustomerPortalUser = typeof customerPortalUsers.$inferInsert;
export type UpdateCustomerPortalUser = Partial<NewCustomerPortalUser>;

export type CustomerPortalMembership = typeof customerPortalMemberships.$inferSelect;
export type NewCustomerPortalMembership = typeof customerPortalMemberships.$inferInsert;
export type UpdateCustomerPortalMembership = Partial<NewCustomerPortalMembership>;

export type CustomerPortalInvite = typeof customerPortalInvites.$inferSelect;
export type NewCustomerPortalInvite = typeof customerPortalInvites.$inferInsert;
export type UpdateCustomerPortalInvite = Partial<NewCustomerPortalInvite>;

export type CustomerPortalSession = typeof customerPortalSessions.$inferSelect;
export type NewCustomerPortalSession = typeof customerPortalSessions.$inferInsert;
export type UpdateCustomerPortalSession = Partial<NewCustomerPortalSession>;

export type CustomerPortalPasswordReset = typeof customerPortalPasswordResets.$inferSelect;
export type NewCustomerPortalPasswordReset = typeof customerPortalPasswordResets.$inferInsert;
export type UpdateCustomerPortalPasswordReset = Partial<NewCustomerPortalPasswordReset>;

export type CustomerPortalUserStatus = typeof customerPortalUserStatusEnum.enumValues[number];
export type CustomerPortalRole = typeof customerPortalRoleEnum.enumValues[number];
