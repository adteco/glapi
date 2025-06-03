import { db } from '../db';
import { sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../../../.env' });
dotenv.config();

async function checkMigrations() {
  try {
    console.log('Checking database migrations status...\n');
    
    // Check if drizzle migrations table exists
    const migrationTableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '__drizzle_migrations'
      ) as exists
    `);
    
    console.log('Drizzle migrations table exists:', migrationTableExists.rows[0].exists);
    
    if (migrationTableExists.rows[0].exists) {
      // Get list of applied migrations
      const migrations = await db.execute(sql`
        SELECT hash, created_at 
        FROM "__drizzle_migrations" 
        ORDER BY created_at DESC
        LIMIT 10
      `);
      
      console.log('\nLast applied migrations:');
      migrations.rows.forEach((m: any) => {
        console.log(`- ${m.hash} (${new Date(m.created_at).toLocaleString()})`);
      });
    }
    
    // Check if entities table exists
    const entitiesTableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'entities'
      ) as exists
    `);
    
    console.log('\nEntities table exists:', entitiesTableExists.rows[0].exists);
    
    // Check existing enums
    const enums = await db.execute(sql`
      SELECT typname, typtype 
      FROM pg_type 
      WHERE typtype = 'e' 
      AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      ORDER BY typname
    `);
    
    console.log('\nExisting enums in database:');
    enums.rows.forEach((e: any) => {
      console.log(`- ${e.typname}`);
    });
    
    // Check entity_type_enum specifically
    const entityTypeEnum = await db.execute(sql`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'entity_type_enum'
      )
      ORDER BY enumsortorder
    `);
    
    if (entityTypeEnum.rows.length > 0) {
      console.log('\nValues in entity_type_enum:');
      entityTypeEnum.rows.forEach((v: any) => {
        console.log(`- ${v.enumlabel}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error checking migrations:', error);
    process.exit(1);
  }
}

checkMigrations();