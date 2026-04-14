import { describe, expect, it } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { hasSchemaColumn, pgTextArray } from './schema-compatibility';

describe('repository schema compatibility helpers', () => {
  it('detects whether an introspected schema column exists', () => {
    expect(hasSchemaColumn([{ column_name: 'better_auth_org_id' }], 'better_auth_org_id')).toBe(
      true
    );
    expect(hasSchemaColumn([{ column_name: 'clerk_org_id' }], 'better_auth_org_id')).toBe(false);
    expect(hasSchemaColumn([], 'better_auth_org_id')).toBe(false);
  });

  it('renders Postgres text arrays for legacy raw SQL fallbacks', () => {
    const query = new PgDialect().sqlToQuery(pgTextArray(['Employee']));

    expect(query.sql).toBe('ARRAY[$1]::text[]');
    expect(query.params).toEqual(['Employee']);
  });
});
