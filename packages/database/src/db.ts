import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import postgres from "postgres";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: '../../.env' });
dotenv.config();

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set. Please check your .env file.');
}

// Prepare connection string
// Use the DATABASE_URL directly for the Pool since it can handle special characters
const connectionString = process.env.DATABASE_URL;

// For drizzle-orm with node-postgres
const pool = new Pool({ connectionString });

export const db = drizzle(pool);

// For postgres client (used in test-connection)
export function getClient() {
  try {
    // The postgres client has different parsing requirements
    // than node-postgres, so we use the Pool for testing as well
    return {
      async query(sql: string, params?: any[]) {
        const result = await pool.query(sql, params);
        return result.rows;
      },
      async end() {
        await pool.end();
      }
    };
  } catch (error) {
    console.error('Error creating postgres client:', error);
    throw error;
  }
}