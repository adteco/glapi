import { getClient, db } from '../db';
import * as dotenv from 'dotenv';
import { sql } from 'drizzle-orm';

// Load environment variables
dotenv.config({ path: '../../../.env' });
dotenv.config();

async function testConnection() {
  console.log('Testing database connection...');
  console.log(`Database URL: ${process.env.DATABASE_URL?.replace(/:[^:]*@/, ':***@')}`);

  // Test using postgres client (now uses node-postgres Pool)
  console.log('\n1. Testing with postgres client:');
  const client = getClient();

  try {
    const result = await client.query('SELECT current_timestamp as now');
    console.log('✅ Connection successful!');
    console.log('Current timestamp:', result[0].now);
  } catch (error) {
    console.error('❌ Failed to connect to database with postgres client:', error);
    console.error(error);
  }

  // Test using drizzle ORM
  console.log('\n2. Testing with drizzle ORM:');
  try {
    const result = await db.execute(sql`SELECT current_timestamp as now`);
    console.log('✅ Drizzle ORM connection successful!');
    console.log('Result:', result);
    if (result && result.rows && result.rows.length > 0) {
      console.log('Current timestamp:', result.rows[0].now);
    } else {
      console.log('Query successful but no timestamp returned');
    }
  } catch (error) {
    console.error('❌ Failed to connect to database with drizzle ORM:', error);
    console.error(error);
  }

  // Close the connection at the end to avoid prematurely ending the pool
  try {
    await client.end();
  } catch (err) {
    // Ignore errors from closing
  }
}

testConnection()
  .catch(console.error)
  .finally(() => {
    console.log('\nConnection tests completed.');
    // Allow time for connections to properly close
    setTimeout(() => process.exit(0), 500);
  });