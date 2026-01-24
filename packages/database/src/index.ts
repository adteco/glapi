export { db } from './db';
export { db as Database } from './db';
export type { NodePgDatabase } from 'drizzle-orm/node-postgres';
export * from './db/schema';
export * from './repositories';
export * from './seeds';

// Re-export drizzle-orm functions for consistent usage across packages
export { eq, and, or, gt, gte, lt, lte, ne, sql, desc, asc, isNull, inArray } from 'drizzle-orm';