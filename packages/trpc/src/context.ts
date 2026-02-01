import type { CreateNextContextOptions } from '@trpc/server/adapters/next';
import type {
  ClerkUserId,
  EntityId,
  OrganizationId,
} from '@glapi/shared-types';

/**
 * User context from authentication.
 *
 * Contains both Clerk IDs (external auth) and Entity IDs (database).
 * The entityId may be null for new users who don't yet have an entity record.
 */
export interface User {
  /**
   * Clerk user ID - external authentication identifier.
   * Format: "user_" followed by alphanumeric characters.
   * Example: "user_2pP7GmO19H0eTgKpX6ehokxVBnM"
   */
  clerkId: ClerkUserId;

  /**
   * Database entity ID - UUID for the entities table.
   * May be null if the user doesn't have an entity record yet.
   * Use this for created_by/modified_by audit fields.
   */
  entityId: EntityId | null;

  /**
   * Database organization ID - UUID for the organizations table.
   * Used for RLS context and multi-tenant isolation.
   */
  organizationId: OrganizationId;

  /**
   * User's email address from Clerk.
   */
  email: string | null;

  /**
   * User's role within the organization.
   */
  role: 'user' | 'admin';

  /**
   * @deprecated Use `clerkId` instead. This alias exists for backward compatibility.
   * Returns the Clerk user ID (NOT an entity UUID).
   */
  id: string;
}

/**
 * Service context for business logic operations.
 * Contains typed IDs for organization isolation and audit trails.
 */
export interface ServiceContext {
  /**
   * Database organization ID for multi-tenant isolation.
   * Used to set RLS context via app.current_organization_id.
   */
  organizationId: OrganizationId;

  /**
   * Database entity ID for audit trails.
   * Use for created_by/modified_by fields.
   * May be null if user doesn't have an entity record.
   */
  entityId: EntityId | null;

  /**
   * Clerk user ID for external reference and logging.
   */
  clerkUserId: ClerkUserId;

  /**
   * @deprecated Use `clerkUserId` instead.
   */
  userId: string;
}

export interface CreateContextOptions {
  req?: CreateNextContextOptions['req'];
  res?: CreateNextContextOptions['res'];
  resHeaders?: Headers; // Response headers for fetch adapter
  user?: User | null;
  db?: any; // We'll type this properly in the API app
  organizationName?: string | null; // Organization name for debugging headers
}

export async function createContext(opts: CreateContextOptions) {
  const { req, res, resHeaders, user, db, organizationName } = opts;

  // Create service context from user info
  const serviceContext: ServiceContext | undefined = user ? {
    organizationId: user.organizationId,
    entityId: user.entityId,
    clerkUserId: user.clerkId,
    // Deprecated alias
    userId: user.clerkId,
  } : undefined;

  return {
    req,
    res,
    resHeaders,
    user,
    db,
    serviceContext,
    organizationName,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
