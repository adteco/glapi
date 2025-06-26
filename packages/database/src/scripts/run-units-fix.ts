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

async function fixUnitsOfMeasure() {
  console.log('Checking units_of_measure table structure...');

  try {
    // Check if columns exist
    const columns = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'units_of_measure' 
      AND column_name IN ('conversion_factor', 'base_conversion_factor', 'decimal_places')
    `);

    console.log('Existing columns:', columns.rows);

    // Check if conversion_factor exists and base_conversion_factor doesn't
    const hasConversionFactor = columns.rows.some((r: any) => r.column_name === 'conversion_factor');
    const hasBaseConversionFactor = columns.rows.some((r: any) => r.column_name === 'base_conversion_factor');
    const hasDecimalPlaces = columns.rows.some((r: any) => r.column_name === 'decimal_places');

    if (hasConversionFactor && !hasBaseConversionFactor) {
      console.log('Renaming conversion_factor to base_conversion_factor...');
      await db.execute(sql`
        ALTER TABLE units_of_measure 
        RENAME COLUMN conversion_factor TO base_conversion_factor
      `);
      console.log('Column renamed successfully');
    }

    if (!hasDecimalPlaces) {
      console.log('Adding decimal_places column...');
      await db.execute(sql`
        ALTER TABLE units_of_measure 
        ADD COLUMN decimal_places integer DEFAULT 2
      `);
      console.log('Column added successfully');
    }

    console.log('Units of measure table structure fixed!');
  } catch (error) {
    console.error('Error fixing units of measure:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

fixUnitsOfMeasure()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });