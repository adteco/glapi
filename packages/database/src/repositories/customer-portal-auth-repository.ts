import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { BaseRepository } from "./base-repository";
import {
  customerPortalInvites,
  customerPortalMemberships,
  customerPortalPasswordResets,
  customerPortalSessions,
  customerPortalUsers,
  type CustomerPortalInvite,
  type CustomerPortalMembership,
  type CustomerPortalPasswordReset,
  type CustomerPortalRole,
  type CustomerPortalSession,
  type CustomerPortalUser,
} from "../db/schema/customer-portal-auth";
import { entities } from "../db/schema/entities";
import type { ContextualDatabase } from "../context";

export interface CustomerPortalMembershipWithEntity extends CustomerPortalMembership {
  entity: {
    id: string;
    name: string;
    displayName: string | null;
    email: string | null;
  };
}

export interface CustomerPortalSessionWithUser extends CustomerPortalSession {
  user: CustomerPortalUser;
}

export class CustomerPortalAuthRepository extends BaseRepository {
  constructor(db?: ContextualDatabase) {
    super(db);
  }

  async findUserById(id: string): Promise<CustomerPortalUser | null> {
    const [result] = await this.db
      .select()
      .from(customerPortalUsers)
      .where(eq(customerPortalUsers.id, id))
      .limit(1);

    return result ?? null;
  }

  async findUserByEmail(
    organizationId: string,
    email: string
  ): Promise<CustomerPortalUser | null> {
    const [result] = await this.db
      .select()
      .from(customerPortalUsers)
      .where(
        and(
          eq(customerPortalUsers.organizationId, organizationId),
          eq(customerPortalUsers.email, email.trim().toLowerCase())
        )
      )
      .limit(1);

    return result ?? null;
  }

  async createUser(input: {
    organizationId: string;
    email: string;
    fullName?: string | null;
    passwordHash?: string | null;
    status?: "invited" | "active" | "suspended";
  }): Promise<CustomerPortalUser> {
    const [result] = await this.db
      .insert(customerPortalUsers)
      .values({
        organizationId: input.organizationId,
        email: input.email.trim().toLowerCase(),
        fullName: input.fullName ?? null,
        passwordHash: input.passwordHash ?? null,
        status: input.status ?? "invited",
      })
      .returning();

    return result;
  }

  async updateUser(
    userId: string,
    input: {
      fullName?: string | null;
      passwordHash?: string | null;
      status?: "invited" | "active" | "suspended";
      lastLoginAt?: Date | null;
    }
  ): Promise<CustomerPortalUser | null> {
    const [result] = await this.db
      .update(customerPortalUsers)
      .set({
        fullName: input.fullName,
        passwordHash: input.passwordHash,
        status: input.status,
        lastLoginAt: input.lastLoginAt,
        updatedAt: new Date(),
      })
      .where(eq(customerPortalUsers.id, userId))
      .returning();

    return result ?? null;
  }

  async createInvite(input: {
    organizationId: string;
    entityId: string;
    email: string;
    role: CustomerPortalRole;
    tokenHash: string;
    invitedByEntityId?: string | null;
    expiresAt: Date;
  }): Promise<CustomerPortalInvite> {
    const [result] = await this.db
      .insert(customerPortalInvites)
      .values({
        organizationId: input.organizationId,
        entityId: input.entityId,
        email: input.email.trim().toLowerCase(),
        role: input.role,
        tokenHash: input.tokenHash,
        invitedByEntityId: input.invitedByEntityId ?? null,
        expiresAt: input.expiresAt,
      })
      .returning();

    return result;
  }

  async findInviteByTokenHash(tokenHash: string): Promise<CustomerPortalInvite | null> {
    const [result] = await this.db
      .select()
      .from(customerPortalInvites)
      .where(
        and(
          eq(customerPortalInvites.tokenHash, tokenHash),
          isNull(customerPortalInvites.revokedAt),
          isNull(customerPortalInvites.acceptedAt),
          gt(customerPortalInvites.expiresAt, new Date())
        )
      )
      .limit(1);

    return result ?? null;
  }

  async markInviteAccepted(inviteId: string): Promise<CustomerPortalInvite | null> {
    const [result] = await this.db
      .update(customerPortalInvites)
      .set({
        acceptedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(customerPortalInvites.id, inviteId))
      .returning();

    return result ?? null;
  }

  async revokeInvite(inviteId: string): Promise<CustomerPortalInvite | null> {
    const [result] = await this.db
      .update(customerPortalInvites)
      .set({
        revokedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(customerPortalInvites.id, inviteId))
      .returning();

    return result ?? null;
  }

  async upsertMembership(input: {
    organizationId: string;
    portalUserId: string;
    entityId: string;
    role: CustomerPortalRole;
  }): Promise<CustomerPortalMembership> {
    const existing = await this.findMembership(
      input.organizationId,
      input.portalUserId,
      input.entityId
    );

    if (existing) {
      const [updated] = await this.db
        .update(customerPortalMemberships)
        .set({
          role: input.role,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(customerPortalMemberships.id, existing.id))
        .returning();

      return updated;
    }

    const [created] = await this.db
      .insert(customerPortalMemberships)
      .values({
        organizationId: input.organizationId,
        portalUserId: input.portalUserId,
        entityId: input.entityId,
        role: input.role,
        isActive: true,
      })
      .returning();

    return created;
  }

  async findMembership(
    organizationId: string,
    portalUserId: string,
    entityId: string
  ): Promise<CustomerPortalMembership | null> {
    const [result] = await this.db
      .select()
      .from(customerPortalMemberships)
      .where(
        and(
          eq(customerPortalMemberships.organizationId, organizationId),
          eq(customerPortalMemberships.portalUserId, portalUserId),
          eq(customerPortalMemberships.entityId, entityId)
        )
      )
      .limit(1);

    return result ?? null;
  }

  async listActiveMembershipsForUser(
    organizationId: string,
    portalUserId: string
  ): Promise<CustomerPortalMembershipWithEntity[]> {
    const rows = await this.db
      .select({
        membership: customerPortalMemberships,
        entity: {
          id: entities.id,
          name: entities.name,
          displayName: entities.displayName,
          email: entities.email,
        },
      })
      .from(customerPortalMemberships)
      .innerJoin(entities, eq(customerPortalMemberships.entityId, entities.id))
      .where(
        and(
          eq(customerPortalMemberships.organizationId, organizationId),
          eq(customerPortalMemberships.portalUserId, portalUserId),
          eq(customerPortalMemberships.isActive, true)
        )
      )
      .orderBy(desc(customerPortalMemberships.updatedAt));

    return rows.map((row) => ({
      ...row.membership,
      entity: row.entity,
    }));
  }

  async revokeMembership(
    organizationId: string,
    membershipId: string
  ): Promise<CustomerPortalMembership | null> {
    const [result] = await this.db
      .update(customerPortalMemberships)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(customerPortalMemberships.organizationId, organizationId),
          eq(customerPortalMemberships.id, membershipId)
        )
      )
      .returning();

    return result ?? null;
  }

  async createSession(input: {
    organizationId: string;
    portalUserId: string;
    tokenHash: string;
    expiresAt: Date;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<CustomerPortalSession> {
    const [result] = await this.db
      .insert(customerPortalSessions)
      .values({
        organizationId: input.organizationId,
        portalUserId: input.portalUserId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        lastAccessedAt: new Date(),
      })
      .returning();

    return result;
  }

  async findActiveSessionByTokenHash(
    tokenHash: string
  ): Promise<CustomerPortalSessionWithUser | null> {
    const [row] = await this.db
      .select({
        session: customerPortalSessions,
        user: customerPortalUsers,
      })
      .from(customerPortalSessions)
      .innerJoin(customerPortalUsers, eq(customerPortalUsers.id, customerPortalSessions.portalUserId))
      .where(
        and(
          eq(customerPortalSessions.tokenHash, tokenHash),
          isNull(customerPortalSessions.revokedAt),
          gt(customerPortalSessions.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!row) {
      return null;
    }

    return {
      ...row.session,
      user: row.user,
    };
  }

  async touchSession(sessionId: string): Promise<void> {
    await this.db
      .update(customerPortalSessions)
      .set({
        lastAccessedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(customerPortalSessions.id, sessionId));
  }

  async revokeSession(sessionId: string): Promise<CustomerPortalSession | null> {
    const [result] = await this.db
      .update(customerPortalSessions)
      .set({
        revokedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(customerPortalSessions.id, sessionId))
      .returning();

    return result ?? null;
  }

  async createPasswordReset(input: {
    organizationId: string;
    portalUserId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<CustomerPortalPasswordReset> {
    const [result] = await this.db
      .insert(customerPortalPasswordResets)
      .values(input)
      .returning();

    return result;
  }

  async findActivePasswordResetByTokenHash(
    tokenHash: string
  ): Promise<CustomerPortalPasswordReset | null> {
    const [result] = await this.db
      .select()
      .from(customerPortalPasswordResets)
      .where(
        and(
          eq(customerPortalPasswordResets.tokenHash, tokenHash),
          isNull(customerPortalPasswordResets.usedAt),
          gt(customerPortalPasswordResets.expiresAt, new Date())
        )
      )
      .limit(1);

    return result ?? null;
  }

  async markPasswordResetUsed(resetId: string): Promise<CustomerPortalPasswordReset | null> {
    const [result] = await this.db
      .update(customerPortalPasswordResets)
      .set({
        usedAt: new Date(),
      })
      .where(eq(customerPortalPasswordResets.id, resetId))
      .returning();

    return result ?? null;
  }
}
