import { config } from 'dotenv';
import { resolve } from 'path';
import { Client } from 'pg';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

// Load environment variables
config({ path: resolve(__dirname, '../../.env') });
config({ path: resolve(__dirname, '../../../../.env') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function recordManualMigration() {
  const client = new Client({
    connectionString: DATABASE_URL,
  });
  
  await client.connect();
  
  try {
    // Read the migration file to calculate hash
    const migrationPath = resolve(__dirname, '../../drizzle/0003_items_only.sql');
    const migrationContent = readFileSync(migrationPath, 'utf-8');
    const hash = createHash('sha256').update(migrationContent).digest('hex');
    
    console.log('Recording manual migration...');
    console.log('Migration hash:', hash);
    
    // Insert migration record
    const result = await client.query(`
      INSERT INTO __drizzle_migrations (hash, created_at)
      VALUES ($1, NOW())
      RETURNING *;
    `, [hash]);
    
    console.log('Migration recorded successfully:', result.rows[0]);
    
  } catch (error) {
    console.error('Error recording migration:', error);
  } finally {
    await client.end();
  }
}

recordManualMigration();