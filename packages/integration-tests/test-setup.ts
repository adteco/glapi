import { config } from 'dotenv';
import { beforeAll, afterAll } from 'vitest';

// Load environment variables
config({ path: '../../.env.test' });

// Set test environment variables if not already set
process.env.NODE_ENV = 'test';
process.env.DATABASE_HOST = process.env.DATABASE_HOST || 'localhost';
process.env.DATABASE_PORT = process.env.DATABASE_PORT || '5432';
process.env.DATABASE_USER = process.env.DATABASE_USER || 'postgres';
process.env.DATABASE_PASSWORD = process.env.DATABASE_PASSWORD || 'postgres';

// Global setup
beforeAll(() => {
  console.log('Starting integration tests...');
});

// Global teardown
afterAll(() => {
  console.log('Integration tests completed.');
});