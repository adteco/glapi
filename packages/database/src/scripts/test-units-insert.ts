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

async function testInsert() {
  try {
    console.log('Testing units_of_measure insert...');

    // First check what's in the table
    const existing = await db.execute(sql`
      SELECT * FROM units_of_measure LIMIT 5
    `);
    console.log('Existing records:', existing.rows);

    // Try a direct insert
    const result = await db.execute(sql`
      INSERT INTO units_of_measure (
        organization_id,
        code,
        name,
        abbreviation,
        base_conversion_factor,
        decimal_places,
        is_active,
        created_by,
        updated_by
      ) VALUES (
        'ba3b8cdf-efc1-4a60-88be-ac203d263fe2',
        'TEST',
        'Test Unit',
        'tst',
        1.0,
        2,
        true,
        'user_development',
        'user_development'
      )
      RETURNING *
    `);
    console.log('Insert successful:', result.rows);

  } catch (error) {
    console.error('Error during insert:', error);
    if (error instanceof Error && 'detail' in error) {
      console.error('Detail:', (error as any).detail);
    }
  } finally {
    await pool.end();
  }
}

testInsert();