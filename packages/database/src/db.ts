import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { schema } from "./db/schema";


if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
}

const DATABASE_URL = process.env.DATABASE_URL;
console.log('DATABASE_URL', DATABASE_URL);

const pool = new Pool({
  connectionString: DATABASE_URL,
});

export const db = drizzle(pool, { schema }); 