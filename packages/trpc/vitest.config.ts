import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@glapi/database': path.resolve(__dirname, '../database/src'),
      '@glapi/api-service': path.resolve(__dirname, '../api-service'),
    },
  },
});
