import { db } from '../db';
import { sql } from 'drizzle-orm';

type Requirement = {
  label: string;
  ok: boolean;
};

async function main() {
  const [columnsResult, tablesResult] = await Promise.all([
    db.execute(sql`
      select table_name, column_name
      from information_schema.columns
      where table_schema = current_schema()
        and (
          (table_name = 'organizations' and column_name = 'better_auth_org_id')
          or (table_name = 'entities' and column_name = 'better_auth_user_id')
          or (table_name = 'users' and column_name = 'better_auth_user_id')
        )
    `),
    db.execute(sql`
      select table_name
      from information_schema.tables
      where table_schema = current_schema()
        and table_name in ('user', 'session', 'account', 'verification', 'organization', 'member', 'invitation')
    `),
  ]);

  const presentColumns = new Set(
    (columnsResult.rows ?? []).map((row) => `${row.table_name}.${row.column_name}`)
  );
  const presentTables = new Set((tablesResult.rows ?? []).map((row) => row.table_name as string));

  const requirements: Requirement[] = [
    {
      label: 'organizations.better_auth_org_id',
      ok: presentColumns.has('organizations.better_auth_org_id'),
    },
    {
      label: 'entities.better_auth_user_id',
      ok: presentColumns.has('entities.better_auth_user_id'),
    },
    {
      label: 'users.better_auth_user_id',
      ok: presentColumns.has('users.better_auth_user_id'),
    },
    { label: 'table user', ok: presentTables.has('user') },
    { label: 'table session', ok: presentTables.has('session') },
    { label: 'table account', ok: presentTables.has('account') },
    { label: 'table verification', ok: presentTables.has('verification') },
    { label: 'table organization', ok: presentTables.has('organization') },
    { label: 'table member', ok: presentTables.has('member') },
    { label: 'table invitation', ok: presentTables.has('invitation') },
  ];

  console.log('[better-auth-schema] requirements');
  for (const requirement of requirements) {
    console.log(`  - ${requirement.ok ? 'OK' : 'MISSING'} ${requirement.label}`);
  }

  const missing = requirements.filter((requirement) => !requirement.ok);
  if (missing.length > 0) {
    console.log(
      '\n[better-auth-schema] apply packages/database/drizzle/0080_better_auth_schema.sql with DATABASE_ADMIN_URL before running the reconciliation writer'
    );
    process.exitCode = 1;
    return;
  }

  console.log('\n[better-auth-schema] ready for reconciliation');
}

main().catch((error) => {
  console.error('[better-auth-schema] failed', error);
  process.exitCode = 1;
});
