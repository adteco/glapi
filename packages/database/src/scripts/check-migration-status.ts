import { config } from 'dotenv';
import { resolve } from 'path';
import { Client } from 'pg';

// Load environment variables
config({ path: resolve(__dirname, '../../.env') });
config({ path: resolve(__dirname, '../../../../.env') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function checkMigrationStatus() {
  const client = new Client({
    connectionString: DATABASE_URL,
  });
  
  await client.connect();
  
  try {
    console.log('Checking migration status...\n');
    
    // Check for Drizzle migration table
    const migrationTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '__drizzle_migrations'
      );
    `);
    
    console.log('Drizzle migration table exists:', migrationTableExists.rows[0].exists);
    
    if (migrationTableExists.rows[0].exists) {
      const migrations = await client.query(`
        SELECT * FROM __drizzle_migrations 
        ORDER BY created_at;
      `);
      
      console.log('\nApplied migrations:');
      migrations.rows.forEach(m => {
        console.log(`- ${m.hash} (applied at: ${m.created_at})`);
      });
    }
    
    // Check which tables exist
    const existingTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    
    console.log('\nExisting tables in database:');
    existingTables.rows.forEach(t => {
      console.log(`- ${t.table_name}`);
    });
    
    // Check specifically for our new items-related tables
    const itemsTables = [
      'items',
      'item_categories',
      'price_lists',
      'item_pricing',
      'customer_price_lists',
      'vendor_items',
      'lot_numbers',
      'serial_numbers',
      'assembly_components',
      'kit_components',
      'item_audit_log'
    ];
    
    console.log('\nChecking for items-related tables:');
    for (const tableName of itemsTables) {
      const exists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [tableName]);
      console.log(`- ${tableName}: ${exists.rows[0].exists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
    }
    
  } catch (error) {
    console.error('Error checking migration status:', error);
  } finally {
    await client.end();
  }
}

checkMigrationStatus();