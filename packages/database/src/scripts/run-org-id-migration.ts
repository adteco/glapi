import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables
dotenv.config({ path: '../../.env' });
dotenv.config();

async function runMigration() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('Running organization ID migration...');
    
    // Read the SQL file
    const migrationSQL = readFileSync(
      join(__dirname, 'change-items-org-id-to-text.sql'),
      'utf-8'
    );

    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration().catch(console.error);