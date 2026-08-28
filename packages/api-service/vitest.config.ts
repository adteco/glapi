import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@glapi/business': path.resolve(__dirname, '../business/src'),
      '@glapi/database': path.resolve(__dirname, '../database/src'),
    },
  },
});
