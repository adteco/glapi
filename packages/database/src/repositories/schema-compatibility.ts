import { sql } from 'drizzle-orm';

export type SchemaIntrospectionRow = {
  column_name?: string | null;
};

export function hasSchemaColumn(
  rows: SchemaIntrospectionRow[] | null | undefined,
  columnName: string
): boolean {
  return (rows ?? []).some((row) => row.column_name === columnName);
}

export function pgTextArray(values: string[]) {
  return sql`ARRAY[${sql.join(values.map((value) => sql`${value}`), sql`, `)}]::text[]`;
}
