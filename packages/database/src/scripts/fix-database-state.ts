import { db } from '../db';
import { sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../../../.env' });
dotenv.config();

async function fixDatabaseState() {
  try {
    console.log('Fixing database state for Drizzle migrations...\n');
    
    // 1. Create the drizzle migrations table
    console.log('1. Creating __drizzle_migrations table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at timestamp DEFAULT now()
      )
    `);
    console.log('✅ Migrations table created');
    
    // 2. Fix the account_category enum name
    console.log('\n2. Checking account_category enum...');
    const accountCategoryExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'account_category'
      ) as exists
    `);
    
    if (accountCategoryExists.rows[0].exists) {
      console.log('Found account_category enum, renaming to account_category_enum...');
      await db.execute(sql`ALTER TYPE account_category RENAME TO account_category_enum`);
      console.log('✅ Renamed account_category to account_category_enum');
    } else {
      console.log('account_category enum not found, checking if account_category_enum exists...');
      const accountCategoryEnumExists = await db.execute(sql`
        SELECT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'account_category_enum'
        ) as exists
      `);
      
      if (!accountCategoryEnumExists.rows[0].exists) {
        console.log('Creating account_category_enum...');
        await db.execute(sql`
          CREATE TYPE account_category_enum AS ENUM ('Asset', 'Liability', 'Equity', 'Revenue', 'COGS', 'Expense')
        `);
        console.log('✅ Created account_category_enum');
      }
    }
    
    // 3. Add missing values to entity_type_enum
    console.log('\n3. Adding missing values to entity_type_enum...');
    const entityTypeValues = await db.execute(sql`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'entity_type_enum'
      )
    `);
    
    const existingValues = entityTypeValues.rows.map((r: any) => r.enumlabel);
    const requiredValues = ['Customer', 'Vendor', 'Employee', 'Partner', 'Lead', 'Prospect', 'Contact'];
    const missingValues = requiredValues.filter(v => !existingValues.includes(v));
    
    for (const value of missingValues) {
      try {
        await db.execute(sql.raw(`ALTER TYPE entity_type_enum ADD VALUE '${value}'`));
        console.log(`✅ Added ${value} to entity_type_enum`);
      } catch (error: any) {
        if (error.message.includes('already exists')) {
          console.log(`${value} already exists in entity_type_enum`);
        } else {
          throw error;
        }
      }
    }
    
    // 4. Mark existing migrations as applied (if we know they were applied)
    console.log('\n4. Marking previously applied migrations...');
    // Since the database has tables from migrations 0000, 0001, 0002, and 0003
    // We should mark them as applied
    const migrationsToMark = [
      '0000_nappy_logan',
      '0001_yummy_microbe', 
      '0002_fresh_iron_monger',
      '0003_rich_major_mapleleaf'
    ];
    
    for (const migration of migrationsToMark) {
      const exists = await db.execute(sql`
        SELECT EXISTS (
          SELECT 1 FROM "__drizzle_migrations" WHERE hash = ${migration}
        ) as exists
      `);
      
      if (!exists.rows[0].exists) {
        await db.execute(sql`
          INSERT INTO "__drizzle_migrations" (hash, created_at)
          VALUES (${migration}, NOW())
        `);
        console.log(`✅ Marked ${migration} as applied`);
      }
    }
    
    console.log('\n✅ Database state fixed! You should now be able to run migrations.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing database state:', error);
    process.exit(1);
  }
}

fixDatabaseState();