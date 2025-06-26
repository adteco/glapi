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

async function checkAllUnits() {
  try {
    const units = await db.execute(sql`
      SELECT organization_id, code, name, abbreviation
      FROM units_of_measure
      WHERE name IN ('Kilogram', 'Liter')
      ORDER BY organization_id, name
    `);
    
    console.log('Units with name Kilogram or Liter:');
    units.rows.forEach((u: any) => {
      console.log(`- Org: ${u.organization_id}, Code: ${u.code}, Name: ${u.name}, Abbrev: ${u.abbreviation}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkAllUnits();