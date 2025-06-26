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

async function testPriceListItems() {
  try {
    const result = await db.execute(sql`
      SELECT 
        ip.*,
        i.item_code,
        i.name as item_name,
        i.description as item_description
      FROM item_pricing ip
      LEFT JOIN items i ON ip.item_id = i.id
      WHERE ip.price_list_id = '087ab032-74c8-43b2-a36c-1c7657c61398'
    `);
    
    console.log('Price list items with join:', result.rows);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testPriceListItems();