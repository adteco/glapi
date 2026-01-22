import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { schema } from "./db/schema";


if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
}

const DATABASE_URL = process.env.DATABASE_URL;

// Remove sslmode from URL to avoid conflict with programmatic ssl config
const cleanUrl = DATABASE_URL.replace(/[?&]sslmode=[^&]+/g, (match, offset) => {
  // If it was the first param (starts with ?), check if there are more params
  if (match.startsWith('?')) {
    return DATABASE_URL.includes('&', offset) ? '?' : '';
  }
  return '';
});

// Configure SSL for RDS connections
const needsSsl = DATABASE_URL.includes('rds.amazonaws.com') || DATABASE_URL.includes('sslmode=require');
const sslConfig = needsSsl ? { rejectUnauthorized: false } : undefined;

console.log('DB connection:', needsSsl ? 'SSL enabled (rejectUnauthorized: false)' : 'No SSL');

const pool = new Pool({
  connectionString: cleanUrl,
  ssl: sslConfig,
});

export const db = drizzle(pool, { schema });

// Export Database type for dependency injection in repositories
// Using typeof db to maintain full type information
export type Database = typeof db;
