const { Client } = require('pg');
require('dotenv').config();

async function createEntitiesTable() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Create the entities table
    await client.query(`
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
    
    console.log('✅ Entities table created successfully!');
    
    // Add foreign key constraints (wrap in try-catch in case they already exist)
    try {
      await client.query(`
        ALTER TABLE "entities" ADD CONSTRAINT "entities_parent_entity_id_entities_id_fk" 
        FOREIGN KEY ("parent_entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action
      `);
      console.log('✅ Parent entity foreign key added!');
    } catch (err) {
      console.log('Parent entity FK might already exist:', err.message);
    }
    
    try {
      await client.query(`
        ALTER TABLE "entities" ADD CONSTRAINT "entities_primary_contact_id_entities_id_fk" 
        FOREIGN KEY ("primary_contact_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action
      `);
      console.log('✅ Primary contact foreign key added!');
    } catch (err) {
      console.log('Primary contact FK might already exist:', err.message);
    }
    
    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS "entities_org_id_idx" ON "entities" USING btree ("organization_id")',
      'CREATE INDEX IF NOT EXISTS "entities_types_idx" ON "entities" USING btree ("entity_types")',
      'CREATE INDEX IF NOT EXISTS "entities_parent_idx" ON "entities" USING btree ("parent_entity_id")',
      'CREATE INDEX IF NOT EXISTS "entities_email_idx" ON "entities" USING btree ("email")',
      'CREATE INDEX IF NOT EXISTS "entities_status_idx" ON "entities" USING btree ("status","is_active")'
    ];
    
    for (const index of indexes) {
      await client.query(index);
    }
    console.log('✅ All indexes created!');
    
    // Verify the table exists
    const result = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'entities'
    `);
    
    console.log('✅ Table exists:', result.rows.length > 0);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
    console.log('Disconnected from database');
  }
}

createEntitiesTable();