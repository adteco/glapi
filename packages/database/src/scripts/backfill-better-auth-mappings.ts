import { asc, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { entities } from '../db/schema/entities';
import { organizations } from '../db/schema/organizations';
import {
  member as betterAuthMembers,
  organization as betterAuthOrganizations,
  user as betterAuthUsers,
} from '../db/schema/auth';
import {
  buildBetterAuthMemberId,
  buildBetterAuthOrganizationId,
  buildBetterAuthUserId,
  normalizeBetterAuthMemberRole,
  normalizeEmail,
} from './lib/better-auth-reconciliation';
import { hasSchemaColumn } from '../repositories/schema-compatibility';

type InternalOrganization = {
  id: string;
  name: string;
  slug: string;
  betterAuthOrgId: string | null;
  createdAt: Date | null;
};

type InternalAuthEntity = {
  id: string;
  organizationId: string;
  name: string;
  displayName: string | null;
  email: string | null;
  role: string | null;
  clerkUserId: string | null;
  betterAuthUserId: string | null;
  createdAt: Date;
};

type BetterAuthOrganizationRow = {
  id: string;
  name: string;
  slug: string | null;
};

type BetterAuthUserRow = {
  id: string;
  email: string;
};

type BetterAuthMemberRow = {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
};

type SchemaSupport = {
  betterAuthOrgId: boolean;
  betterAuthUserId: boolean;
  betterAuthOrganizationTable: boolean;
  betterAuthUserTable: boolean;
  betterAuthMemberTable: boolean;
};

type OrganizationPlan =
  | {
      status: 'resolved';
      organization: InternalOrganization;
      betterAuthOrganizationId: string;
      createAuthOrganization: boolean;
      updateInternalMapping: boolean;
    }
  | {
      status: 'conflict';
      organization: InternalOrganization;
      reason: string;
    };

type UserPlan =
  | {
      status: 'resolved';
      entity: InternalAuthEntity;
      betterAuthUserId: string;
      createAuthUser: boolean;
      updateInternalMapping: boolean;
    }
  | {
      status: 'conflict';
      entity: InternalAuthEntity;
      reason: string;
    };

type MembershipPlan = {
  entity: InternalAuthEntity;
  betterAuthOrganizationId: string;
  betterAuthUserId: string;
  role: 'owner' | 'admin' | 'member';
  createMembership: boolean;
  updateRole: boolean;
};

async function loadSchemaSupport(): Promise<SchemaSupport> {
  const columnsResult = await db.execute(sql`
    select table_name, column_name
    from information_schema.columns
    where table_schema = current_schema()
      and (
        (table_name = 'organizations' and column_name in ('better_auth_org_id'))
        or (table_name = 'entities' and column_name in ('better_auth_user_id'))
      )
  `);
  const tablesResult = await db.execute(sql`
    select table_name
    from information_schema.tables
    where table_schema = current_schema()
      and table_name in ('organization', 'user', 'member')
  `);

  const rows = (columnsResult.rows ?? []) as
    | { table_name?: string | null; column_name?: string | null }[]
    | undefined;
  const tableRows = (tablesResult.rows ?? []) as
    | { table_name?: string | null }[]
    | undefined;

  return {
    betterAuthOrgId: hasSchemaColumn(
      rows?.filter((row) => row.table_name === 'organizations'),
      'better_auth_org_id'
    ),
    betterAuthUserId: hasSchemaColumn(
      rows?.filter((row) => row.table_name === 'entities'),
      'better_auth_user_id'
    ),
    betterAuthOrganizationTable: Boolean(
      tableRows?.some((row) => row.table_name === 'organization')
    ),
    betterAuthUserTable: Boolean(tableRows?.some((row) => row.table_name === 'user')),
    betterAuthMemberTable: Boolean(tableRows?.some((row) => row.table_name === 'member')),
  };
}

async function loadOrganizations(schemaSupport: SchemaSupport): Promise<InternalOrganization[]> {
  return db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      betterAuthOrgId: schemaSupport.betterAuthOrgId
        ? organizations.betterAuthOrgId
        : sql<string | null>`null`,
      createdAt: organizations.createdAt,
    })
    .from(organizations)
    .orderBy(asc(organizations.createdAt), asc(organizations.name));
}

async function loadAuthEntities(schemaSupport: SchemaSupport): Promise<InternalAuthEntity[]> {
  return db
    .select({
      id: entities.id,
      organizationId: entities.organizationId,
      name: entities.name,
      displayName: entities.displayName,
      email: entities.email,
      role: entities.role,
      clerkUserId: entities.clerkUserId,
      betterAuthUserId: schemaSupport.betterAuthUserId
        ? entities.betterAuthUserId
        : sql<string | null>`null`,
      createdAt: entities.createdAt,
    })
    .from(entities)
    .where(
      schemaSupport.betterAuthUserId
        ? sql`(${entities.clerkUserId} is not null or ${entities.betterAuthUserId} is not null)`
        : sql`${entities.clerkUserId} is not null`
    )
    .orderBy(asc(entities.organizationId), asc(entities.createdAt), asc(entities.name));
}

async function loadBetterAuthOrganizations(
  schemaSupport: SchemaSupport
): Promise<BetterAuthOrganizationRow[]> {
  if (!schemaSupport.betterAuthOrganizationTable) {
    return [];
  }

  return db
    .select({
      id: betterAuthOrganizations.id,
      name: betterAuthOrganizations.name,
      slug: betterAuthOrganizations.slug,
    })
    .from(betterAuthOrganizations);
}

async function loadBetterAuthUsers(schemaSupport: SchemaSupport): Promise<BetterAuthUserRow[]> {
  if (!schemaSupport.betterAuthUserTable) {
    return [];
  }

  return db
    .select({
      id: betterAuthUsers.id,
      email: betterAuthUsers.email,
    })
    .from(betterAuthUsers);
}

async function loadBetterAuthMembers(
  schemaSupport: SchemaSupport
): Promise<BetterAuthMemberRow[]> {
  if (!schemaSupport.betterAuthMemberTable) {
    return [];
  }

  return db
    .select({
      id: betterAuthMembers.id,
      organizationId: betterAuthMembers.organizationId,
      userId: betterAuthMembers.userId,
      role: betterAuthMembers.role,
    })
    .from(betterAuthMembers);
}

function buildDuplicateEmailSet(authEntities: InternalAuthEntity[]): Set<string> {
  const counts = new Map<string, number>();

  for (const entity of authEntities) {
    const normalizedEmail = normalizeEmail(entity.email);
    if (!normalizedEmail) {
      continue;
    }

    counts.set(normalizedEmail, (counts.get(normalizedEmail) ?? 0) + 1);
  }

  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([email]) => email)
  );
}

function resolveOrganizationPlan(
  organization: InternalOrganization,
  authOrganizationsById: Map<string, BetterAuthOrganizationRow>,
  authOrganizationsBySlug: Map<string, BetterAuthOrganizationRow>,
  canPersistMapping: boolean
): OrganizationPlan {
  const preferredBetterAuthOrganizationId =
    organization.betterAuthOrgId ?? buildBetterAuthOrganizationId(organization.id);

  if (organization.betterAuthOrgId) {
    return {
      status: 'resolved',
      organization,
      betterAuthOrganizationId: preferredBetterAuthOrganizationId,
      createAuthOrganization: !authOrganizationsById.has(preferredBetterAuthOrganizationId),
      updateInternalMapping: false,
    };
  }

  const existingById = authOrganizationsById.get(preferredBetterAuthOrganizationId);
  if (existingById) {
    return {
      status: 'resolved',
      organization,
      betterAuthOrganizationId: existingById.id,
      createAuthOrganization: false,
      updateInternalMapping: canPersistMapping,
    };
  }

  const existingBySlug = authOrganizationsBySlug.get(organization.slug);
  if (existingBySlug) {
    return {
      status: 'conflict',
      organization,
      reason: `slug ${organization.slug} is already used by Better Auth organization ${existingBySlug.id}`,
    };
  }

  return {
    status: 'resolved',
    organization,
    betterAuthOrganizationId: preferredBetterAuthOrganizationId,
    createAuthOrganization: true,
    updateInternalMapping: canPersistMapping,
  };
}

function resolveUserPlan(
  entity: InternalAuthEntity,
  authUsersById: Map<string, BetterAuthUserRow>,
  authUsersByEmail: Map<string, BetterAuthUserRow>,
  duplicateEmails: Set<string>,
  canPersistMapping: boolean
): UserPlan {
  const normalizedEmail = normalizeEmail(entity.email);
  if (!normalizedEmail) {
    return {
      status: 'conflict',
      entity,
      reason: 'email is required to create a Better Auth user',
    };
  }

  if (duplicateEmails.has(normalizedEmail)) {
    return {
      status: 'conflict',
      entity,
      reason: `email ${normalizedEmail} is used by multiple auth-capable entities`,
    };
  }

  const preferredBetterAuthUserId =
    entity.betterAuthUserId ?? buildBetterAuthUserId(entity.id);

  if (entity.betterAuthUserId) {
    const existingByMappedId = authUsersById.get(entity.betterAuthUserId);
    if (
      existingByMappedId &&
      normalizeEmail(existingByMappedId.email) !== normalizedEmail
    ) {
      return {
        status: 'conflict',
        entity,
        reason: `mapped Better Auth user ${entity.betterAuthUserId} has email ${existingByMappedId.email}, expected ${normalizedEmail}`,
      };
    }

    return {
      status: 'resolved',
      entity,
      betterAuthUserId: preferredBetterAuthUserId,
      createAuthUser: !existingByMappedId,
      updateInternalMapping: false,
    };
  }

  const existingById = authUsersById.get(preferredBetterAuthUserId);
  if (existingById) {
    if (normalizeEmail(existingById.email) !== normalizedEmail) {
      return {
        status: 'conflict',
        entity,
        reason: `deterministic Better Auth user ${preferredBetterAuthUserId} already exists with email ${existingById.email}`,
      };
    }

    return {
      status: 'resolved',
      entity,
      betterAuthUserId: existingById.id,
      createAuthUser: false,
      updateInternalMapping: canPersistMapping,
    };
  }

  const existingByEmail = authUsersByEmail.get(normalizedEmail);
  if (existingByEmail) {
    return {
      status: 'conflict',
      entity,
      reason: `email ${normalizedEmail} is already attached to Better Auth user ${existingByEmail.id}`,
    };
  }

  return {
    status: 'resolved',
    entity,
    betterAuthUserId: preferredBetterAuthUserId,
    createAuthUser: true,
    updateInternalMapping: canPersistMapping,
  };
}

async function main() {
  const write = process.argv.slice(2).includes('--write');

  console.log(
    `[better-auth-reconciliation] starting in ${write ? 'write' : 'dry-run'} mode`
  );

  const schemaSupport = await loadSchemaSupport();

  const [
    internalOrganizations,
    authEntities,
    existingBetterAuthOrganizations,
    existingBetterAuthUsers,
    existingBetterAuthMembers,
  ] = await Promise.all([
    loadOrganizations(schemaSupport),
    loadAuthEntities(schemaSupport),
    loadBetterAuthOrganizations(schemaSupport),
    loadBetterAuthUsers(schemaSupport),
    loadBetterAuthMembers(schemaSupport),
  ]);

  const authOrganizationsById = new Map(
    existingBetterAuthOrganizations.map((row) => [row.id, row])
  );
  const authOrganizationsBySlug = new Map(
    existingBetterAuthOrganizations
      .filter((row) => row.slug)
      .map((row) => [row.slug as string, row])
  );
  const authUsersById = new Map(existingBetterAuthUsers.map((row) => [row.id, row]));
  const authUsersByEmail = new Map(
    existingBetterAuthUsers.map((row) => [normalizeEmail(row.email) as string, row])
  );
  const existingMembersByKey = new Map(
    existingBetterAuthMembers.map((row) => [
      `${row.organizationId}:${row.userId}`,
      row,
    ])
  );

  const duplicateEmails = buildDuplicateEmailSet(authEntities);

  const organizationPlans = internalOrganizations.map((organization) =>
    resolveOrganizationPlan(
      organization,
      authOrganizationsById,
      authOrganizationsBySlug,
      schemaSupport.betterAuthOrgId
    )
  );
  const resolvedOrganizationIds = new Map<string, string>();
  const conflicts: string[] = [];

  if (!schemaSupport.betterAuthOrgId) {
    conflicts.push(
      'schema: organizations.better_auth_org_id is missing; run the database migration before persisting org mappings'
    );
  }
  if (!schemaSupport.betterAuthUserId) {
    conflicts.push(
      'schema: entities.better_auth_user_id is missing; run the database migration before persisting user mappings'
    );
  }
  if (!schemaSupport.betterAuthOrganizationTable) {
    conflicts.push(
      'schema: Better Auth table organization is missing; run the auth schema migration before creating org bridges'
    );
  }
  if (!schemaSupport.betterAuthUserTable) {
    conflicts.push(
      'schema: Better Auth table user is missing; run the auth schema migration before creating user bridges'
    );
  }
  if (!schemaSupport.betterAuthMemberTable) {
    conflicts.push(
      'schema: Better Auth table member is missing; run the auth schema migration before creating membership bridges'
    );
  }

  for (const plan of organizationPlans) {
    if (plan.status === 'resolved') {
      resolvedOrganizationIds.set(plan.organization.id, plan.betterAuthOrganizationId);
    } else {
      conflicts.push(
        `organization ${plan.organization.id} (${plan.organization.slug}): ${plan.reason}`
      );
    }
  }

  const userPlans = authEntities.map((entity) =>
    resolveUserPlan(
      entity,
      authUsersById,
      authUsersByEmail,
      duplicateEmails,
      schemaSupport.betterAuthUserId
    )
  );
  const resolvedUserIds = new Map<string, string>();

  for (const plan of userPlans) {
    if (plan.status === 'resolved') {
      resolvedUserIds.set(plan.entity.id, plan.betterAuthUserId);
    } else {
      conflicts.push(
        `entity ${plan.entity.id} (${plan.entity.email ?? 'missing-email'}): ${plan.reason}`
      );
    }
  }

  const membershipPlans: MembershipPlan[] = [];
  for (const entity of authEntities) {
    const betterAuthOrganizationId = resolvedOrganizationIds.get(entity.organizationId);
    const betterAuthUserId = resolvedUserIds.get(entity.id);

    if (!betterAuthOrganizationId || !betterAuthUserId) {
      continue;
    }

    const role = normalizeBetterAuthMemberRole(entity.role);
    const existingMember = existingMembersByKey.get(
      `${betterAuthOrganizationId}:${betterAuthUserId}`
    );

    membershipPlans.push({
      entity,
      betterAuthOrganizationId,
      betterAuthUserId,
      role,
      createMembership: !existingMember,
      updateRole: Boolean(existingMember && existingMember.role !== role),
    });
  }

  console.log(
    `[better-auth-reconciliation] organizations=${internalOrganizations.length} auth-entities=${authEntities.length} conflicts=${conflicts.length}`
  );
  console.log(
    `[better-auth-reconciliation] orgs:create=${
      organizationPlans.filter(
        (plan) => plan.status === 'resolved' && plan.createAuthOrganization
      ).length
    } orgs:map=${
      organizationPlans.filter(
        (plan) => plan.status === 'resolved' && plan.updateInternalMapping
      ).length
    }`
  );
  console.log(
    `[better-auth-reconciliation] users:create=${
      userPlans.filter((plan) => plan.status === 'resolved' && plan.createAuthUser).length
    } users:map=${
      userPlans.filter((plan) => plan.status === 'resolved' && plan.updateInternalMapping).length
    }`
  );
  console.log(
    `[better-auth-reconciliation] memberships:create=${
      membershipPlans.filter((plan) => plan.createMembership).length
    } memberships:update-role=${
      membershipPlans.filter((plan) => plan.updateRole).length
    }`
  );

  if (conflicts.length > 0) {
    console.log('[better-auth-reconciliation] conflicts');
    for (const conflict of conflicts) {
      console.log(`  - ${conflict}`);
    }
  }

  if (write) {
    await db.transaction(async (tx) => {
      for (const plan of organizationPlans) {
        if (plan.status !== 'resolved') {
          continue;
        }

        if (plan.createAuthOrganization && schemaSupport.betterAuthOrganizationTable) {
          await tx.insert(betterAuthOrganizations).values({
            id: plan.betterAuthOrganizationId,
            name: plan.organization.name,
            slug: plan.organization.slug,
            logo: null,
            createdAt: plan.organization.createdAt ?? new Date(),
            metadata: JSON.stringify({
              internalOrganizationId: plan.organization.id,
              migrationSource: 'clerk-to-better-auth',
            }),
          });
        }

        if (plan.updateInternalMapping && schemaSupport.betterAuthOrgId) {
          await tx
            .update(organizations)
            .set({ betterAuthOrgId: plan.betterAuthOrganizationId, updatedAt: new Date() })
            .where(eq(organizations.id, plan.organization.id));
        }
      }

      for (const plan of userPlans) {
        if (plan.status !== 'resolved') {
          continue;
        }

        if (plan.createAuthUser && schemaSupport.betterAuthUserTable) {
          const email = normalizeEmail(plan.entity.email);
          await tx.insert(betterAuthUsers).values({
            id: plan.betterAuthUserId,
            name: plan.entity.displayName || plan.entity.name,
            email: email as string,
            emailVerified: true,
            image: null,
            createdAt: plan.entity.createdAt ?? new Date(),
            updatedAt: new Date(),
          });
        }

        if (plan.updateInternalMapping && schemaSupport.betterAuthUserId) {
          await tx
            .update(entities)
            .set({
              betterAuthUserId: plan.betterAuthUserId,
              updatedAt: new Date(),
            })
            .where(eq(entities.id, plan.entity.id));
        }
      }

      for (const plan of membershipPlans) {
        if (plan.createMembership && schemaSupport.betterAuthMemberTable) {
          await tx.insert(betterAuthMembers).values({
            id: buildBetterAuthMemberId(
              plan.betterAuthOrganizationId,
              plan.betterAuthUserId
            ),
            organizationId: plan.betterAuthOrganizationId,
            userId: plan.betterAuthUserId,
            role: plan.role,
            createdAt: new Date(),
          });
        } else if (plan.updateRole && schemaSupport.betterAuthMemberTable) {
          await tx
            .update(betterAuthMembers)
            .set({ role: plan.role })
            .where(
              sql`${betterAuthMembers.organizationId} = ${plan.betterAuthOrganizationId} and ${betterAuthMembers.userId} = ${plan.betterAuthUserId}`
            );
        }
      }
    });

    console.log('[better-auth-reconciliation] write complete');
  } else {
    console.log('[better-auth-reconciliation] dry-run complete, re-run with --write to apply');
  }

  if (conflicts.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[better-auth-reconciliation] failed', error);
  process.exitCode = 1;
});
