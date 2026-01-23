import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { schema, timeEntries, eq } from '@glapi/database';
import { v4 as uuidv4 } from 'uuid';

export class TestDatabase {
  private client!: postgres.Sql;
  public db!: ReturnType<typeof drizzle>;
  private testDbName: string;
  private isSetup = false;

  constructor() {
    this.testDbName = `test_db_${uuidv4().replace(/-/g, '_')}`;
  }

  async setup(): Promise<void> {
    if (this.isSetup) return;

    // Connect to default postgres database to create test database
    const adminClient = postgres({
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      user: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      database: 'postgres',
      max: 1
    });

    // Create test database
    await adminClient`CREATE DATABASE ${adminClient(this.testDbName)}`;
    await adminClient.end();

    // Connect to test database
    this.client = postgres({
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      user: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      database: this.testDbName,
      max: 10
    });

    this.db = drizzle(this.client, { schema });

    // Run migrations
    await migrate(this.db, { migrationsFolder: './packages/database/migrations' });

    this.isSetup = true;
  }

  async cleanup(): Promise<void> {
    if (!this.isSetup) return;

    // Close connection
    if (this.client) {
      await this.client.end();
    }

    // Drop test database
    const adminClient = postgres({
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      user: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      database: 'postgres',
      max: 1
    });

    await adminClient`DROP DATABASE IF EXISTS ${adminClient(this.testDbName)}`;
    await adminClient.end();

    this.isSetup = false;
  }

  async transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    return await this.db.transaction(fn);
  }

  async truncateAll(): Promise<void> {
    // Truncate all tables in reverse dependency order
    const tables = [
      'revenue_journal_entries',
      'revenue_schedules',
      'performance_obligation_allocations',
      'performance_obligations',
      'contract_modifications',
      'subscription_items',
      'subscriptions',
      'invoice_line_items',
      'invoices',
      'payments',
      'kit_components',
      'items',
      'entities',
      'organizations'
    ];

    for (const table of tables) {
      await this.client`TRUNCATE TABLE ${this.client(table)} CASCADE`;
    }
  }

  async seed(seedData?: any): Promise<void> {
    // Optional: Add seed data for tests
    if (seedData) {
      // Implement seeding logic based on provided data
    }
  }

  /**
   * Clear all time entries from the database
   */
  async clearTimeEntries(): Promise<void> {
    // First clear related tables
    await this.client`TRUNCATE TABLE time_entry_approvals CASCADE`;
    await this.client`TRUNCATE TABLE time_entries CASCADE`;
  }

  /**
   * Get a time entry by ID directly from the database
   */
  async getTimeEntryById(id: string): Promise<any> {
    const [entry] = await this.db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.id, id));
    return entry;
  }

  /**
   * Clear users (employees) from the database
   */
  async clearUsers(): Promise<void> {
    await this.client`TRUNCATE TABLE users CASCADE`;
  }

  /**
   * Clear projects and related cost codes
   */
  async clearProjects(): Promise<void> {
    await this.client`TRUNCATE TABLE project_cost_codes CASCADE`;
    await this.client`TRUNCATE TABLE projects CASCADE`;
  }
}