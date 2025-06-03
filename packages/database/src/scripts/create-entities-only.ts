import { db } from '../db';
import { sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../../../.env' });
dotenv.config();

async function createEntitiesTable() {
  try {
    console.log('Creating entities table using Drizzle...\n');
    
    // Create the entities table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "entities" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "organization_id" text NOT NULL,
        "name" text NOT NULL,
        "display_name" text,
        "code" text,
        "entity_types" text[] NOT NULL,
        "email" text,
        "phone" text,
        "website" text,
        "address_line_1" text,
        "address_line_2" text,
        "city" text,
        "state_province" text,
        "postal_code" text,
        "country_code" text,
        "parent_entity_id" uuid,
        "primary_contact_id" uuid,
        "tax_id" text,
        "description" text,
        "notes" text,
        "custom_fields" jsonb,
        "metadata" jsonb,
        "status" text DEFAULT 'active' NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "entities_org_code_unique" UNIQUE("organization_id","code")
      )
    `);
    console.log('✅ Entities table created');
    
    // Add foreign key constraints
    try {
      await db.execute(sql`
        ALTER TABLE "entities" ADD CONSTRAINT "entities_parent_entity_id_entities_id_fk" 
        FOREIGN KEY ("parent_entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action
      `);
      console.log('✅ Parent entity foreign key added');
    } catch (err) {
      console.log('Parent FK might already exist');
    }
    
    try {
      await db.execute(sql`
        ALTER TABLE "entities" ADD CONSTRAINT "entities_primary_contact_id_entities_id_fk" 
        FOREIGN KEY ("primary_contact_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action
      `);
      console.log('✅ Primary contact foreign key added');
    } catch (err) {
      console.log('Primary contact FK might already exist');
    }
    
    // Create indexes
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "entities_org_id_idx" ON "entities" USING btree ("organization_id")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "entities_types_idx" ON "entities" USING btree ("entity_types")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "entities_parent_idx" ON "entities" USING btree ("parent_entity_id")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "entities_email_idx" ON "entities" USING btree ("email")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "entities_status_idx" ON "entities" USING btree ("status","is_active")`);
    console.log('✅ All indexes created');
    
    // Mark the migration as applied
    await db.execute(sql`
      INSERT INTO "__drizzle_migrations" (hash, created_at)
      VALUES ('0004_living_puck', NOW())
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ Migration marked as applied');
    
    // Verify
    const result = await db.execute(sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'entities'
    `);
    
    console.log('\n✅ Success! Entities table exists:', result.rows.length > 0);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating entities table:', error);
    process.exit(1);
  }
}

createEntitiesTable();