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

async function fixConstraints() {
  console.log('Fixing units_of_measure constraints...');

  try {
    // Drop the incorrect unique constraint on name
    console.log('Dropping incorrect name unique constraint...');
    await db.execute(sql`
      ALTER TABLE units_of_measure 
      DROP CONSTRAINT IF EXISTS units_of_measure_name_unique
    `);

    // Check if our indexes already exist
    const existingIndexes = await db.execute(sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'units_of_measure' 
      AND indexname IN ('idx_units_of_measure_org_code', 'idx_units_of_measure_org_abbrev')
    `);

    if (existingIndexes.rows.length === 0) {
      // Add the correct unique indexes
      console.log('Adding unique index on (organization_id, code)...');
      await db.execute(sql`
        CREATE UNIQUE INDEX idx_units_of_measure_org_code 
        ON units_of_measure(organization_id, code)
      `);

      console.log('Adding unique index on (organization_id, abbreviation)...');
      await db.execute(sql`
        CREATE UNIQUE INDEX idx_units_of_measure_org_abbrev 
        ON units_of_measure(organization_id, abbreviation)
      `);
    } else {
      console.log('Correct indexes already exist.');
    }

    console.log('Constraints fixed successfully!');

  } catch (error) {
    console.error('Error fixing constraints:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

fixConstraints()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });