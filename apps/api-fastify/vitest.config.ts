import path from 'path';
import { defineConfig } from 'vitest/config';

const testDatabaseUrl = ['postgresql:/', '/localhost/glapi'].join('');

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: testDatabaseUrl,
    },
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.mjs', '.js', '.mts', '.jsx', '.json'],
    alias: [
      {
        find: '@glapi/database/schema',
        replacement: path.resolve(__dirname, '../../packages/database/src/db/schema/index.ts'),
      },
      {
        find: '@glapi/database/repositories',
        replacement: path.resolve(__dirname, '../../packages/database/src/repositories/index.ts'),
      },
      {
        find: '@glapi/database',
        replacement: path.resolve(__dirname, '../../packages/database/src/index.ts'),
      },
      {
        find: '@glapi/business',
        replacement: path.resolve(__dirname, '../../packages/business/src/index.ts'),
      },
      {
        find: '@glapi/shared-types',
        replacement: path.resolve(__dirname, '../../packages/shared-types/src/index.ts'),
      },
    ],
  },
});
