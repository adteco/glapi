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

  // Find or create the default roles
  let userRoleResult = await db.execute(sql`
    SELECT id, role_name FROM roles WHERE role_name = 'USER' LIMIT 1
  `);

  if (!userRoleResult.rows.length) {
    console.log('No roles found in database. Seeding core RBAC roles...');

    await db.execute(sql`
      INSERT INTO roles (role_name, role_description, is_system_role)
      VALUES
        ('USER', 'Default user role with standard read/write permissions', true),
        ('ADMIN', 'Administrator role with full access', true),
        ('OWNER', 'Organization owner with all privileges', true)
      ON CONFLICT (role_name) DO NOTHING
    `);

    // Seed core permissions
    await db.execute(sql`
      INSERT INTO permissions (permission_name, resource_type, action, description)
      VALUES
        ('CUSTOMERS:READ', 'CUSTOMERS', 'READ', 'View customers'),
        ('CUSTOMERS:CREATE', 'CUSTOMERS', 'CREATE', 'Create customers'),
        ('CUSTOMERS:UPDATE', 'CUSTOMERS', 'UPDATE', 'Update customers'),
        ('CUSTOMERS:DELETE', 'CUSTOMERS', 'DELETE', 'Delete customers'),
        ('VENDORS:READ', 'VENDORS', 'READ', 'View vendors'),
        ('VENDORS:CREATE', 'VENDORS', 'CREATE', 'Create vendors'),
        ('VENDORS:UPDATE', 'VENDORS', 'UPDATE', 'Update vendors'),
        ('VENDORS:DELETE', 'VENDORS', 'DELETE', 'Delete vendors'),
        ('ACCOUNTS:READ', 'ACCOUNTS', 'READ', 'View accounts'),
        ('ACCOUNTS:CREATE', 'ACCOUNTS', 'CREATE', 'Create accounts'),
        ('ACCOUNTS:UPDATE', 'ACCOUNTS', 'UPDATE', 'Update accounts'),
        ('GL_TRANSACTION:READ', 'GL_TRANSACTION', 'READ', 'View GL transactions'),
        ('GL_TRANSACTION:CREATE', 'GL_TRANSACTION', 'CREATE', 'Create GL transactions'),
        ('GL_TRANSACTION:POST', 'GL_TRANSACTION', 'POST', 'Post GL transactions'),
        ('INVOICES:READ', 'INVOICES', 'READ', 'View invoices'),
        ('INVOICES:CREATE', 'INVOICES', 'CREATE', 'Create invoices'),
        ('INVOICES:UPDATE', 'INVOICES', 'UPDATE', 'Update invoices'),
        ('INVOICES:DELETE', 'INVOICES', 'DELETE', 'Delete invoices'),
        ('ITEMS:READ', 'ITEMS', 'READ', 'View items'),
        ('ITEMS:CREATE', 'ITEMS', 'CREATE', 'Create items'),
        ('EMPLOYEES:READ', 'EMPLOYEES', 'READ', 'View employees'),
        ('EMPLOYEES:CREATE', 'EMPLOYEES', 'CREATE', 'Create employees'),
        ('DEPARTMENTS:READ', 'DEPARTMENTS', 'READ', 'View departments'),
        ('LOCATIONS:READ', 'LOCATIONS', 'READ', 'View locations'),
        ('SUBSIDIARIES:READ', 'SUBSIDIARIES', 'READ', 'View subsidiaries'),
        ('PROJECTS:READ', 'PROJECTS', 'READ', 'View projects'),
        ('PROJECTS:CREATE', 'PROJECTS', 'CREATE', 'Create projects')
      ON CONFLICT (permission_name) DO NOTHING
    `);

    // Assign all permissions to USER role (basic access)
    await db.execute(sql`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM roles r
      CROSS JOIN permissions p
      WHERE r.role_name = 'USER'
        AND p.action IN ('READ', 'CREATE', 'UPDATE')
      ON CONFLICT DO NOTHING
    `);

    // Assign ALL permissions to ADMIN role
    await db.execute(sql`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM roles r
      CROSS JOIN permissions p
      WHERE r.role_name = 'ADMIN'
      ON CONFLICT DO NOTHING
    `);

    // Assign ALL permissions to OWNER role
    await db.execute(sql`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM roles r
      CROSS JOIN permissions p
      WHERE r.role_name = 'OWNER'
      ON CONFLICT DO NOTHING
    `);

    console.log('  Seeded USER, ADMIN, OWNER roles with permissions');

    userRoleResult = await db.execute(sql`
      SELECT id, role_name FROM roles WHERE role_name = 'USER' LIMIT 1
    `);
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
