import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as schema from '../lib/db/schema';

// Test database configuration
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/glapi_test';

// Global test database connection
let testDb: ReturnType<typeof drizzle>;
let testClient: ReturnType<typeof postgres>;

// Setup test database before all tests
beforeAll(async () => {
  // Create test database connection
  testClient = postgres(TEST_DATABASE_URL, { max: 1 });
  testDb = drizzle(testClient, { schema });

  try {
    // Run migrations on test database
    await migrate(testDb, { migrationsFolder: './lib/db/migrations' });
    console.log('✅ Test database migrations completed');
  } catch (error) {
    console.error('❌ Failed to run test database migrations:', error);
    throw error;
  }
});

// Clean up after all tests
afterAll(async () => {
  if (testClient) {
    await testClient.end();
  }
});

// Clean database before each test
beforeEach(async () => {
  if (!testDb) return;

  try {
    // Truncate all tables in reverse dependency order to avoid foreign key conflicts
    await testDb.transaction(async (tx) => {
      // Order matters due to foreign key constraints
      const tablesToTruncate = [
        // Transaction tables first
        'inventory_transactions',
        'bank_transactions', 
        'journal_entry_lines',
        'journal_entries',
        
        // Detail/line tables
        'purchase_order_lines',
        'item_receipt_lines',
        'sales_order_lines',
        'item_fulfillment_lines',
        'invoice_lines',
        'payment_applications',
        
        // Main transaction tables
        'vendor_payments',
        'customer_payments',
        'vendor_bills',
        'invoices',
        'item_fulfillments',
        'sales_orders',
        'item_receipts',
        'purchase_orders',
        
        // Master data
        'inventory_records',
        'bank_accounts',
        'price_list_items',
        'warehouse_price_lists',
        'price_lists',
        'units_of_measure',
        'item_categories',
        'items',
        'customers',
        'vendors',
        'locations',
        'departments',
        'classes',
        'subsidiaries',
        'warehouses',
        'accounts',
        'organizations',
      ];

      for (const table of tablesToTruncate) {
        try {
          await tx.execute(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
        } catch (error) {
          // Table might not exist yet, that's OK
          if (!error.message.includes('does not exist')) {
            console.warn(`Warning: Could not truncate table ${table}:`, error.message);
          }
        }
      }
    });
  } catch (error) {
    console.error('❌ Failed to clean test database:', error);
    throw error;
  }
});

// Export test database for use in tests
export { testDb };

// Global test utilities
declare global {
  var testDb: typeof testDb;
}

globalThis.testDb = testDb;