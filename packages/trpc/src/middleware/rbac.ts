/**
 * TRPC RBAC Middleware
 *
 * Provides permission-based access control for TRPC procedures.
 * Uses the PermissionService to check user permissions against the RBAC system.
 */

import { TRPCError } from '@trpc/server';
import { middleware } from '../trpc';
import { PermissionService } from '@glapi/api-service';
import type { ResourceType, Action, AccessLevel } from '@glapi/api-service';

/**
 * Create a middleware that requires a specific permission
 *
 * @param resourceType - The resource type to check (e.g., 'GL_TRANSACTION', 'ACCOUNT')
 * @param action - The action to check (e.g., 'CREATE', 'READ', 'UPDATE', 'DELETE')
 * @param options - Optional configuration
 * @returns TRPC middleware function
 *
 * @example
 * ```typescript
 * // In a router
 * export const glRouter = createTRPCRouter({
 *   postTransaction: authenticatedProcedure
 *     .use(requirePermission('GL_TRANSACTION', 'POST'))
 *     .input(postTransactionSchema)
 *     .mutation(async ({ input, ctx }) => {
 *       // User has GL_TRANSACTION:POST permission
 *     }),
 * });
 * ```
 */
export function requirePermission(
  resourceType: ResourceType,
  action: Action,
  options?: {
    /** Custom error message */
    errorMessage?: string;
    /** Subsidiary ID for subsidiary-scoped checks (use requirePermissionForSubsidiary for input-based) */
    subsidiaryId?: string;
  }
) {
  return middleware(async ({ ctx, next }) => {
    // Ensure user is authenticated
    if (!ctx.user?.id || !ctx.serviceContext) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    // Create permission service with user context
    const permissionService = new PermissionService({
      organizationId: ctx.user.organizationId,
      userId: ctx.user.id,
    });

    try {
      // Check permission
      const hasPermission = await permissionService.checkPermission(
        resourceType,
        action,
        options?.subsidiaryId
      );

      if (!hasPermission) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message:
            options?.errorMessage ||
            `Permission denied: ${resourceType}:${action}`,
        });
      }
    } catch (error) {
      // Re-throw TRPC errors
      if (error instanceof TRPCError) {
        throw error;
      }

      // Wrap other errors
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to check permissions',
        cause: error,
      });
    }

    return next({ ctx });
  });
}

/**
 * Create a middleware that requires multiple permissions (all must pass)
 *
 * @param checks - Array of permission checks
 * @returns TRPC middleware function
 *
 * @example
 * ```typescript
 * export const adminRouter = createTRPCRouter({
 *   closeAndLockPeriod: authenticatedProcedure
 *     .use(requireAllPermissions([
 *       { resourceType: 'ACCOUNTING_PERIOD', action: 'CLOSE' },
 *       { resourceType: 'ACCOUNTING_PERIOD', action: 'LOCK' },
 *     ]))
 *     .mutation(async ({ ctx }) => {
 *       // User has both permissions
 *     }),
 * });
 * ```
 */
export function requireAllPermissions(
  checks: Array<{ resourceType: ResourceType; action: Action }>
) {
  return middleware(async ({ ctx, next }) => {
    if (!ctx.user?.id || !ctx.serviceContext) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    const permissionService = new PermissionService({
      organizationId: ctx.user.organizationId,
      userId: ctx.user.id,
    });

    const hasAll = await permissionService.checkAllPermissions(checks);

    if (!hasAll) {
      const permissionNames = checks
        .map((c) => `${c.resourceType}:${c.action}`)
        .join(', ');
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Missing required permissions: ${permissionNames}`,
      });
    }

    return next({ ctx });
  });
}

/**
 * Create a middleware that requires any of the specified permissions (at least one must pass)
 *
 * @param checks - Array of permission checks
 * @returns TRPC middleware function
 *
 * @example
 * ```typescript
 * export const reportRouter = createTRPCRouter({
 *   viewFinancialReport: authenticatedProcedure
 *     .use(requireAnyPermission([
 *       { resourceType: 'GL_TRANSACTION', action: 'READ' },
 *       { resourceType: 'REPORT', action: 'VIEW' },
 *     ]))
 *     .query(async ({ ctx }) => {
 *       // User has at least one of the permissions
 *     }),
 * });
 * ```
 */
export function requireAnyPermission(
  checks: Array<{ resourceType: ResourceType; action: Action }>
) {
  return middleware(async ({ ctx, next }) => {
    if (!ctx.user?.id || !ctx.serviceContext) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    const permissionService = new PermissionService({
      organizationId: ctx.user.organizationId,
      userId: ctx.user.id,
    });

    const hasAny = await permissionService.checkAnyPermission(checks);

    if (!hasAny) {
      const permissionNames = checks
        .map((c) => `${c.resourceType}:${c.action}`)
        .join(' or ');
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Requires one of: ${permissionNames}`,
      });
    }

    return next({ ctx });
  });
}

/**
 * Create a middleware that requires admin role
 *
 * @returns TRPC middleware function
 *
 * @example
 * ```typescript
 * export const adminRouter = createTRPCRouter({
 *   systemSettings: authenticatedProcedure
 *     .use(requireAdmin())
 *     .query(async ({ ctx }) => {
 *       // User is admin
 *     }),
 * });
 * ```
 */
export function requireAdmin() {
  return middleware(async ({ ctx, next }) => {
    if (!ctx.user?.id || !ctx.serviceContext) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    const permissionService = new PermissionService({
      organizationId: ctx.user.organizationId,
      userId: ctx.user.id,
    });

    const isAdmin = await permissionService.isAdmin();

    if (!isAdmin) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Administrator access required',
      });
    }

    return next({ ctx });
  });
}

/**
 * Create a middleware factory that requires specific subsidiary access level.
 * This returns a function that should be called with the subsidiaryId at runtime.
 *
 * For use in procedure implementations where subsidiaryId comes from input.
 *
 * @param requiredLevel - The minimum access level required ('VIEW', 'EDIT', 'ADMIN')
 * @returns A function that checks subsidiary access
 *
 * @example
 * ```typescript
 * // In your service or procedure
 * const checkAccess = createSubsidiaryAccessChecker('ADMIN');
 * await checkAccess(ctx, input.subsidiaryId);
 * ```
 */
export function createSubsidiaryAccessChecker(requiredLevel: AccessLevel) {
  return async (
    ctx: { user?: { id: string; organizationId: string } | null },
    subsidiaryId: string
  ) => {
    if (!ctx.user?.id) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    if (!subsidiaryId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Subsidiary ID is required',
      });
    }

    const permissionService = new PermissionService({
      organizationId: ctx.user.organizationId,
      userId: ctx.user.id,
    });

    const hasAccess = await permissionService.checkSubsidiaryAccess(
      subsidiaryId,
      requiredLevel
    );

    if (!hasAccess) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Insufficient access level for subsidiary. Required: ${requiredLevel}`,
      });
    }
  };
}

/**
 * Create a permission checker function for use within procedures.
 * Use this when you need to check permissions with input-derived values.
 *
 * @param resourceType - The resource type to check
 * @param action - The action to check
 * @returns A function that checks the permission
 *
 * @example
 * ```typescript
 * export const glRouter = createTRPCRouter({
 *   postTransaction: authenticatedProcedure
 *     .input(z.object({ subsidiaryId: z.string() }))
 *     .mutation(async ({ input, ctx }) => {
 *       const checkPermission = createPermissionChecker('GL_TRANSACTION', 'POST');
 *       await checkPermission(ctx, input.subsidiaryId);
 *       // Permission granted for this subsidiary
 *     }),
 * });
 * ```
 */
export function createPermissionChecker(
  resourceType: ResourceType,
  action: Action
) {
  return async (
    ctx: { user?: { id: string; organizationId: string } | null },
    subsidiaryId?: string
  ) => {
    if (!ctx.user?.id) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    const permissionService = new PermissionService({
      organizationId: ctx.user.organizationId,
      userId: ctx.user.id,
    });

    const hasPermission = await permissionService.checkPermission(
      resourceType,
      action,
      subsidiaryId
    );

    if (!hasPermission) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Permission denied: ${resourceType}:${action}`,
      });
    }
  };
}
