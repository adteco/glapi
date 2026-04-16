/**
 * Backfill entity_roles for entities that have no role assignments.
 *
 * After the Better Auth migration, auto-provisioned entities may lack
 * RBAC role assignments, causing 403 errors on every permission-protected endpoint.
 *
 * This script finds all entities without any entry in entity_roles and assigns
 * the default 'USER' role to each.
 *
 * Usage:
 *   pnpm --filter @glapi/database backfill:entity-roles          # Dry run
 *   pnpm --filter @glapi/database backfill:entity-roles -- --write  # Apply changes
 */

import { sql } from 'drizzle-orm';
import { db } from '../db';

const WRITE_MODE = process.argv.includes('--write');

async function main() {
  console.log('=== Entity Roles Backfill ===');
  console.log(`Mode: ${WRITE_MODE ? 'WRITE' : 'DRY RUN'}`);
  console.log('');

  // Find the default USER role
  const userRoleResult = await db.execute(sql`
    SELECT id, role_name FROM roles WHERE role_name = 'USER' LIMIT 1
  `);

  if (!userRoleResult.rows.length) {
    console.error('ERROR: No "USER" role found in the roles table.');
    console.log('Available roles:');
    const allRoles = await db.execute(sql`SELECT id, role_name FROM roles ORDER BY role_name`);
    for (const role of allRoles.rows) {
      console.log(`  - ${(role as any).role_name} (${(role as any).id})`);
    }
    process.exit(1);
  }

  const userRole = userRoleResult.rows[0] as { id: string; role_name: string };
  console.log(`Found USER role: ${userRole.id} (${userRole.role_name})`);

  // Find entities with auth credentials but no entity_roles entries
  const entitiesWithoutRoles = await db.execute(sql`
    SELECT e.id, e.name, e.email, e.clerk_user_id, e.organization_id
    FROM entities e
    LEFT JOIN entity_roles er ON er.entity_id = e.id
    WHERE er.entity_id IS NULL
      AND (e.clerk_user_id IS NOT NULL OR e.email IS NOT NULL)
    ORDER BY e.name
  `);

  const entities = entitiesWithoutRoles.rows as {
    id: string;
    name: string;
    email: string | null;
    clerk_user_id: string | null;
    organization_id: string;
  }[];

  console.log(`\nFound ${entities.length} entities without role assignments:\n`);

  if (entities.length === 0) {
    console.log('Nothing to do -- all entities have role assignments.');
    process.exit(0);
  }

  for (const entity of entities) {
    console.log(`  ${entity.name} (${entity.id})`);
    console.log(`    Email: ${entity.email || 'N/A'}`);
    console.log(`    Clerk ID: ${entity.clerk_user_id || 'N/A'}`);
    console.log(`    Org: ${entity.organization_id}`);
  }

  if (!WRITE_MODE) {
    console.log(`\nDry run complete. Run with --write to assign USER role to ${entities.length} entities.`);
    process.exit(0);
  }

  console.log(`\nAssigning USER role to ${entities.length} entities...`);

  let successCount = 0;
  let errorCount = 0;

  for (const entity of entities) {
    try {
      await db.execute(sql`
        INSERT INTO entity_roles (entity_id, role_id, granted_by)
        VALUES (${entity.id}, ${userRole.id}, ${entity.id})
        ON CONFLICT DO NOTHING
      `);
      successCount++;
      console.log(`  Assigned to ${entity.name} (${entity.id})`);
    } catch (error) {
      errorCount++;
      console.error(`  FAILED for ${entity.name} (${entity.id}):`, error);
    }
  }

  console.log(`\nBackfill complete: ${successCount} assigned, ${errorCount} failed.`);
}

main().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
