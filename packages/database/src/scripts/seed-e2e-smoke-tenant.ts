import { db } from '../db';
import { entities } from '../db/schema/entities';
import { organizations } from '../db/schema/organizations';

const TEST_ORGANIZATION_ID = 'ba3b8cdf-efc1-4a60-88be-ac203d263fe2';
const TEST_ACTOR_ENTITY_ID = '00000000-0000-0000-0000-000000000001';

async function main() {
  const betterAuthOrgId = process.env.BETTER_AUTH_TEST_ORG_ID;
  const betterAuthUserId = process.env.BETTER_AUTH_TEST_USER_ID;

  if (!betterAuthOrgId || !betterAuthUserId) {
    throw new Error('BETTER_AUTH_TEST_ORG_ID and BETTER_AUTH_TEST_USER_ID are required');
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(organizations)
      .values({
        id: TEST_ORGANIZATION_ID,
        betterAuthOrgId,
        name: 'Test Organization',
        slug: 'test-org',
      })
      .onConflictDoUpdate({
        target: organizations.id,
        set: {
          betterAuthOrgId,
          name: 'Test Organization',
          slug: 'test-org',
          updatedAt: new Date(),
        },
      });

    await tx
      .insert(entities)
      .values({
        id: TEST_ACTOR_ENTITY_ID,
        organizationId: TEST_ORGANIZATION_ID,
        name: 'Test Admin User',
        entityTypes: ['Employee'],
        email: process.env.BETTER_AUTH_TEST_EMAIL || 'test-admin@glapi-test.local',
        betterAuthUserId,
        role: 'admin',
      })
      .onConflictDoUpdate({
        target: entities.id,
        set: {
          organizationId: TEST_ORGANIZATION_ID,
          name: 'Test Admin User',
          entityTypes: ['Employee'],
          email: process.env.BETTER_AUTH_TEST_EMAIL || 'test-admin@glapi-test.local',
          betterAuthUserId,
          role: 'admin',
          updatedAt: new Date(),
        },
      });
  });

  console.log(`[e2e-smoke-seed] tenant=${TEST_ORGANIZATION_ID} actor=${TEST_ACTOR_ENTITY_ID}`);
}

main()
  .catch((error) => {
    console.error('[e2e-smoke-seed] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$client.end();
  });
