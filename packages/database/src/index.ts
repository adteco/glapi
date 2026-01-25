export { db, pool } from './db';
export { db as Database } from './db';
export type { NodePgDatabase } from 'drizzle-orm/node-postgres';
export * from './db/schema';
export * from './repositories';
export * from './seeds';

// RLS Context Handler for multi-tenancy isolation
export {
  withOrganizationContext,
  withOrganizationContextTransaction,
  createContextualDb,
  verifyRLSContext,
} from './context';
export type { OrganizationContext, ContextualDatabase } from './context';

// Re-export drizzle-orm functions for consistent usage across packages
export { eq, and, or, gt, gte, lt, lte, ne, sql, desc, asc, isNull, inArray, ilike, like } from 'drizzle-orm';