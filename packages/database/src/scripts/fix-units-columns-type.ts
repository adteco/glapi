import { config } from 'dotenv';
import { resolve } from 'path';
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from 'drizzle-orm';

// Load environment variables from root .env file
config({ path: resolve(__dirname, '../../../../.env') });

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
});

const db = drizzle({ client: pool });

async function fixColumnTypes() {
  console.log('Fixing units_of_measure column types...');

  try {
    // Change created_by and updated_by from uuid to text
    await db.execute(sql`
      ALTER TABLE units_of_measure 
      ALTER COLUMN created_by TYPE text,
      ALTER COLUMN updated_by TYPE text
    `);
    console.log('Column types updated successfully');

  } catch (error) {
    console.error('Error fixing column types:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

fixColumnTypes()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });