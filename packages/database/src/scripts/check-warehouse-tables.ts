import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../../.env') });

import { db } from '../db';
import { sql } from 'drizzle-orm';

async function checkWarehouseTables() {
  try {
    const result = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('warehouses', 'warehouse_price_lists', 'customer_warehouse_assignments')
      ORDER BY table_name
    `);

    console.log('Existing warehouse tables:', result.rows);
    
    if (result.rows.length === 0) {
      console.log('No warehouse tables found. Running migrations...');
      
      // Try to create just the warehouse tables
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "warehouses" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "organization_id" text NOT NULL,
          "warehouse_id" text NOT NULL,
          "name" text NOT NULL,
          "location_id" uuid,
          "is_active" boolean DEFAULT true,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL,
          "updated_at" timestamp with time zone DEFAULT now() NOT NULL
        );
      `);
      
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "warehouse_price_lists" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "warehouse_id" uuid NOT NULL,
          "price_list_id" uuid NOT NULL,
          "priority" numeric(10, 0) DEFAULT '1',
          "effective_date" date,
          "expiration_date" date,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL,
          "updated_at" timestamp with time zone DEFAULT now() NOT NULL
        );
      `);
      
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "customer_warehouse_assignments" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "organization_id" text NOT NULL,
          "customer_id" uuid NOT NULL,
          "item_id" uuid NOT NULL,
          "warehouse_id" uuid NOT NULL,
          "is_default" boolean DEFAULT false,
          "effective_date" date,
          "expiration_date" date,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL,
          "updated_at" timestamp with time zone DEFAULT now() NOT NULL
        );
      `);
      
      console.log('Warehouse tables created successfully!');
    } else {
      console.log('Warehouse tables already exist.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkWarehouseTables();