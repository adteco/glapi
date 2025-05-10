import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Attempt to load from monorepo root first, then try the package directory
dotenv.config({ path: '../../.env' });
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set. Please check your .env file.');
}

export default {
  schema: './src/db/schema/*.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
} satisfies Config;