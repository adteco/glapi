/**
 * Vitest Setup File
 *
 * This file is executed before tests run.
 * It loads environment variables from the monorepo root.
 */

import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from monorepo root first, then package directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

// Ensure DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.warn('WARNING: DATABASE_URL is not set. Integration tests that require a database will fail.');
}
