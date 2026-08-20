import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db, pool } from '../db';
import {
  member as betterAuthMembers,
  organization as betterAuthOrganizations,
  user as betterAuthUsers,
} from '../db/schema/auth';
import { entities } from '../db/schema/entities';
import { organizations } from '../db/schema/organizations';
import { entityRoles, roles } from '../db/schema/rls-access-control';
import {
  buildBetterAuthMemberId,
  buildBetterAuthUserId,
  normalizeEmail,
} from './lib/better-auth-reconciliation';

type AccessRole = 'owner' | 'admin' | 'member';

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv
    .slice(2)
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
}

function requestedRole(value: string | undefined): AccessRole {
  if (value === 'owner' || value === 'admin' || value === 'member')
    return value;
  return 'member';
}

async function main() {
  const write = process.argv.slice(2).includes('--write');
  const email = normalizeEmail(argument('email'));
  const organizationId = argument('organization-id');
  const name = argument('name')?.trim();
  const role = requestedRole(argument('role'));

  if (!email || !organizationId || !name) {
    throw new Error(
      'Usage: provision:better-auth-access -- --email=user@example.com --name="User Name" --organization-id=<uuid> [--role=owner|admin|member] [--write]',
    );
  }

  const [internalOrganization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!internalOrganization?.betterAuthOrgId) {
    throw new Error(
      `Organization ${organizationId} has no Better Auth mapping`,
    );
  }

  const [authOrganization] = await db
    .select()
    .from(betterAuthOrganizations)
    .where(eq(betterAuthOrganizations.id, internalOrganization.betterAuthOrgId))
    .limit(1);

  if (!authOrganization) {
    throw new Error(
      `Better Auth organization ${internalOrganization.betterAuthOrgId} does not exist`,
    );
  }

  const [existingAuthUser] = await db
    .select()
    .from(betterAuthUsers)
    .where(eq(betterAuthUsers.email, email))
    .limit(1);
  const [existingTargetEntity] = await db
    .select()
    .from(entities)
    .where(
      and(
        eq(entities.organizationId, organizationId),
        eq(entities.email, email),
      ),
    )
    .limit(1);

  const entityId = existingTargetEntity?.id ?? randomUUID();
  const betterAuthUserId =
    existingAuthUser?.id ?? buildBetterAuthUserId(entityId);

  const [mappedElsewhere] = await db
    .select({ id: entities.id, organizationId: entities.organizationId })
    .from(entities)
    .where(eq(entities.betterAuthUserId, betterAuthUserId))
    .limit(1);

  if (mappedElsewhere && mappedElsewhere.organizationId !== organizationId) {
    throw new Error(
      `Better Auth user ${betterAuthUserId} is already mapped to entity ${mappedElsewhere.id} in organization ${mappedElsewhere.organizationId}`,
    );
  }

  console.log(`[better-auth-access] mode=${write ? 'write' : 'dry-run'}`);
  console.log(`[better-auth-access] email=${email}`);
  console.log(
    `[better-auth-access] internal-organization=${internalOrganization.name} (${organizationId})`,
  );
  console.log(
    `[better-auth-access] better-auth-organization=${internalOrganization.betterAuthOrgId}`,
  );
  console.log(
    `[better-auth-access] entity=${existingTargetEntity ? 'reuse' : 'create'} ${entityId}`,
  );
  console.log(
    `[better-auth-access] auth-user=${existingAuthUser ? 'reuse' : 'create'} ${betterAuthUserId}`,
  );
  console.log(`[better-auth-access] membership-role=${role}`);

  if (!write) {
    console.log(
      '[better-auth-access] dry-run complete; re-run with --write to apply',
    );
    return;
  }

  await db.transaction(async (tx) => {
    if (
      authOrganization.name !== internalOrganization.name ||
      authOrganization.slug !== internalOrganization.slug
    ) {
      await tx
        .update(betterAuthOrganizations)
        .set({
          name: internalOrganization.name,
          slug: internalOrganization.slug,
        })
        .where(eq(betterAuthOrganizations.id, authOrganization.id));
    }

    if (!existingTargetEntity) {
      await tx.insert(entities).values({
        id: entityId,
        organizationId,
        name,
        displayName: name,
        entityTypes: ['Employee'],
        email,
        role,
        betterAuthUserId,
      });
    } else if (existingTargetEntity.betterAuthUserId !== betterAuthUserId) {
      await tx
        .update(entities)
        .set({ betterAuthUserId, role, updatedAt: new Date() })
        .where(eq(entities.id, existingTargetEntity.id));
    }

    if (!existingAuthUser) {
      await tx.insert(betterAuthUsers).values({
        id: betterAuthUserId,
        name,
        email,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const [existingMembership] = await tx
      .select()
      .from(betterAuthMembers)
      .where(
        and(
          eq(
            betterAuthMembers.organizationId,
            internalOrganization.betterAuthOrgId,
          ),
          eq(betterAuthMembers.userId, betterAuthUserId),
        ),
      )
      .limit(1);

    if (existingMembership) {
      await tx
        .update(betterAuthMembers)
        .set({ role })
        .where(eq(betterAuthMembers.id, existingMembership.id));
    } else {
      await tx.insert(betterAuthMembers).values({
        id: buildBetterAuthMemberId(
          internalOrganization.betterAuthOrgId,
          betterAuthUserId,
        ),
        organizationId: internalOrganization.betterAuthOrgId,
        userId: betterAuthUserId,
        role,
        createdAt: new Date(),
      });
    }

    const internalRoleName =
      role === 'owner' ? 'OWNER' : role === 'admin' ? 'ADMIN' : 'USER';
    const [internalRole] = await tx
      .select()
      .from(roles)
      .where(eq(roles.roleName, internalRoleName))
      .limit(1);

    if (internalRole) {
      await tx
        .insert(entityRoles)
        .values({ entityId, roleId: internalRole.id, grantedBy: entityId })
        .onConflictDoNothing();
    }
  });

  console.log('[better-auth-access] write complete');
}

main()
  .catch((error) => {
    console.error('[better-auth-access] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
