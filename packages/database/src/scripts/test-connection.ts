import { db } from '../db';
import { sql } from 'drizzle-orm';

async function testConnection() {
  try {
    console.log('Testing database connection...');
    await db.execute(sql`SELECT 1`);
    console.log('Database connection successful!');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

testConnection();