import { config } from 'dotenv';
import { resolve } from 'path';
import { Client } from 'pg';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';

// Load environment variables
config({ path: resolve(__dirname, '../../.env') });
config({ path: resolve(__dirname, '../../../../.env') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function fixMigrationTracking() {
  const client = new Client({
    connectionString: DATABASE_URL,
  });
  
  await client.connect();
  
  try {
    console.log('Creating Drizzle migrations table...\n');
    
    // Create the __drizzle_migrations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at timestamp DEFAULT now()
      );
    `);
    
    console.log('✅ Migrations table created\n');
    
    // Mark existing migrations as applied
    const migrations = [
      { file: '0000_omniscient_catseye.sql', tag: '0000_omniscient_catseye' },
      { file: '0001_careful_baron_zemo.sql', tag: '0001_careful_baron_zemo' },
      { file: '0002_crazy_warhawk.sql', tag: '0002_crazy_warhawk' }
    ];
    
    for (const migration of migrations) {
      const filePath = resolve(__dirname, '../../drizzle', migration.file);
      const content = readFileSync(filePath, 'utf-8');
      const hash = createHash('sha256').update(content).digest('hex');
      
      // Check if already exists
      const exists = await client.query(
        'SELECT id FROM __drizzle_migrations WHERE hash = $1',
        [hash]
      );
      
      if (exists.rows.length === 0) {
        await client.query(
          'INSERT INTO __drizzle_migrations (hash) VALUES ($1)',
          [hash]
        );
        console.log(`✅ Marked ${migration.tag} as applied`);
      } else {
        console.log(`⏭️  ${migration.tag} already marked as applied`);
      }
    }
    
    console.log('\n✅ Migration tracking fixed! You can now run pnpm db:migrate to apply the new items migration.');
    
  } catch (error) {
    console.error('Error fixing migration tracking:', error);
  } finally {
    await client.end();
  }
}

fixMigrationTracking();