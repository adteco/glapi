import { db } from '../db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../../../.env' });
dotenv.config();

async function runMigration() {
  try {
    console.log('Running entities table migration...');
    
    // Read the SQL file
    const sqlContent = fs.readFileSync(
      path.join(__dirname, 'create-entities-table.sql'),
      'utf-8'
    );
    
    // Execute the SQL
    await db.execute(sql.raw(sqlContent));
    
    console.log('✅ Entities table created successfully!');
    
    // Verify the table exists
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'entities'
      ) as table_exists
    `);
    
    console.log('Table exists:', result.rows[0].table_exists);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error running migration:', error);
    process.exit(1);
  }
}

runMigration();