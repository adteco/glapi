import { defineConfig } from 'vitest/config';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from monorepo root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Increase timeout for integration tests
    testTimeout: 30000,
    // Run tests sequentially for integration tests to avoid conflicts
    sequence: {
      concurrent: false,
    },
    // Setup file for environment loading
    setupFiles: ['./vitest.setup.ts'],
    // Include TypeScript files
    include: ['src/**/*.test.ts', 'src/**/*.integration.test.ts'],
  },
  resolve: {
    alias: {
      '@glapi/database/schema': path.resolve(__dirname, '../database/src/db/schema/index.ts'),
      '@glapi/database': path.resolve(__dirname, '../database/src/index.ts'),
      '@glapi/api-service': path.resolve(__dirname, '../api-service/index.ts'),
      '@glapi/types': path.resolve(__dirname, '../types/src/index.ts'),
      '@glapi/business': path.resolve(__dirname, '../business/src/index.ts'),
    },
    // Ensure TypeScript extensions are resolved
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
  // Enable esbuild for TypeScript transformation
  esbuild: {
    target: 'node18',
  },
});
