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

async function checkConstraints() {
  try {
    // Check unique constraints
    const constraints = await db.execute(sql`
      SELECT conname, pg_get_constraintdef(c.oid) as definition
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'units_of_measure'
      AND contype IN ('u', 'p', 'f')
    `);
    
    console.log('Constraints on units_of_measure:');
    constraints.rows.forEach((c: any) => {
      console.log(`- ${c.conname}: ${c.definition}`);
    });

    // Check if there are any duplicates
    const duplicates = await db.execute(sql`
      SELECT organization_id, code, COUNT(*) as count
      FROM units_of_measure
      GROUP BY organization_id, code
      HAVING COUNT(*) > 1
    `);

    if (duplicates.rows.length > 0) {
      console.log('\nDuplicate codes found:');
      console.log(duplicates.rows);
    } else {
      console.log('\nNo duplicate codes found.');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkConstraints();