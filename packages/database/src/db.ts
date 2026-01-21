import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { schema } from "./db/schema";

// Explicit type to avoid TS7056 "inferred type exceeds max length"
// Using 'any' for schema type parameter since the full type is too complex
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = NodePgDatabase<any>;


if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
}

const DATABASE_URL = process.env.DATABASE_URL;
console.log('DATABASE_URL', DATABASE_URL);

const pool = new Pool({
  connectionString: DATABASE_URL,
});

export const db = drizzle(pool, { schema }); 