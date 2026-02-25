import { headers } from "next/headers";
import { verifyToken } from "@clerk/backend";
import { PermissionService } from "@glapi/api-service";
import { OrganizationRepository, AuthEntityRepository } from "@glapi/database";
import type { ResourceType, Action, AccessLevel } from "@glapi/api-service";
import type {
  ClerkUserId,
  ClerkOrgId,
  EntityId,
  OrganizationId,
} from "@glapi/shared-types";
import {
  isValidUuid,
  unsafeClerkUserId,
  unsafeClerkOrgId,
  unsafeEntityId,
  unsafeOrganizationId,
} from "@glapi/shared-types";

export interface OrganizationContext {
  /**
   * Database organization UUID for RLS context.
   */
  organizationId: OrganizationId;

  /**
   * Database entity UUID for audit fields (created_by, modified_by).
   * May be null if user doesn't have an entity record yet.
   */
  entityId: EntityId | null;

  /**
   * Clerk user ID for external reference and logging.
   */
  clerkUserId: ClerkUserId;

  /**
   * Clerk organization ID (original value from header).
   */
  clerkOrganizationId?: ClerkOrgId;

  /**
   * API key name if authenticated via API key.
   */
  apiKeyName?: string;

  /**
   * Organization name for debugging headers.
   */
  organizationName?: string;

  /**
   * @deprecated Use `clerkUserId` instead. Kept for backward compatibility.
   */
  userId: string;
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

// Cache for Clerk org ID to database org ID and name mapping
const orgCache = new Map<string, { id: string; name: string }>();

// Cache for Clerk user ID to entity ID mapping
const entityIdCache = new Map<string, string>();

interface ResolvedOrganization {
  id: OrganizationId;
  name?: string;
}

interface ResolvedRequestIdentity {
  rawUserId: string | null;
  rawOrganizationId: string | null;
  source: "token" | "headers";
}

const AUTH_DEBUG_LOGS = process.env.AUTH_DEBUG_LOGS === "true";

function summarizeValue(value: string | null): string | null {
  if (!value) return null;
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function authDebug(event: string, payload: Record<string, unknown>) {
  if (!AUTH_DEBUG_LOGS) return;
  console.info(`[auth-debug][service-context] ${event}`, payload);
}

/**
 * Resolve caller identity from request metadata.
 *
 * Priority:
 * 1. Verified Clerk bearer token claims (trusted)
 * 2. Explicit x-user-id / x-organization-id headers (fallback)
 */
async function resolveRequestIdentity(
  headersList: Headers,
): Promise<ResolvedRequestIdentity> {
  const headerUserId = headersList.get("x-user-id");
  const headerOrganizationId = headersList.get("x-organization-id");
  const authHeader =
    headersList.get("authorization") ?? headersList.get("Authorization");
  const secretKey = process.env.CLERK_SECRET_KEY;

  if (!authHeader?.startsWith("Bearer ") || !secretKey) {
    authDebug("identity_from_headers", {
      reason: !authHeader?.startsWith("Bearer ")
        ? "missing_authorization_bearer"
        : "missing_clerk_secret",
      hasAuthorization: Boolean(authHeader),
      hasHeaderUserId: Boolean(headerUserId),
      hasHeaderOrganizationId: Boolean(headerOrganizationId),
      headerUserId: summarizeValue(headerUserId),
      headerOrganizationId: summarizeValue(headerOrganizationId),
    });
    return {
      rawUserId: headerUserId,
      rawOrganizationId: headerOrganizationId,
      source: "headers",
    };
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    authDebug("identity_from_headers", {
      reason: "empty_bearer_token",
      hasHeaderUserId: Boolean(headerUserId),
      hasHeaderOrganizationId: Boolean(headerOrganizationId),
    });
    return {
      rawUserId: headerUserId,
      rawOrganizationId: headerOrganizationId,
      source: "headers",
    };
  }

  try {
    const payload = await verifyToken(token, { secretKey });
    const tokenUserId = payload.sub ?? null;
    const tokenOrganizationId = ((payload.org_id ??
      payload.organization_id) as string | undefined) ?? null;

    return {
      // Prefer verified token claims when available.
      rawUserId: tokenUserId ?? headerUserId,
      rawOrganizationId: tokenOrganizationId ?? headerOrganizationId,
      source: "token",
    };
  } catch (error) {
    console.warn(
      "Failed to verify Clerk token while resolving request identity; falling back to headers",
      error,
    );
    authDebug("identity_from_headers", {
      reason: "token_verification_failed",
      hasHeaderUserId: Boolean(headerUserId),
      hasHeaderOrganizationId: Boolean(headerOrganizationId),
      headerUserId: summarizeValue(headerUserId),
      headerOrganizationId: summarizeValue(headerOrganizationId),
    });
    return {
      rawUserId: headerUserId,
      rawOrganizationId: headerOrganizationId,
      source: "headers",
    };
  }
}

/**
 * Resolve organization from user identity when organization header is unavailable
 * or points to a Clerk org ID that has not been provisioned yet.
 */
async function resolveOrganizationFromUser(
  rawUserId: string,
): Promise<ResolvedOrganization | null> {
  try {
    const authEntityRepo = new AuthEntityRepository();
    const entity = isValidUuid(rawUserId)
      ? await authEntityRepo.findById(rawUserId)
      : await authEntityRepo.findByClerkId(rawUserId);

    if (!entity?.organizationId) {
      return null;
    }

    const orgRepo = new OrganizationRepository();
    const org = await orgRepo.findById(entity.organizationId);
    if (org) {
      return { id: unsafeOrganizationId(org.id), name: org.name };
    }

    // Fall back to the entity's organization UUID even if lookup-by-id fails.
    return { id: unsafeOrganizationId(entity.organizationId) };
  } catch (error) {
    console.error("Failed to resolve organization from user context:", error);
    return null;
  }
}

/**
 * Resolve a Clerk org ID (org_xxxxx) to a database organization UUID and name
 */
async function resolveOrganization(
  clerkOrgId: string,
): Promise<ResolvedOrganization | null> {
  // Check cache first
  if (orgCache.has(clerkOrgId)) {
    const cached = orgCache.get(clerkOrgId)!;
    return { id: unsafeOrganizationId(cached.id), name: cached.name };
  }

  // If it's already a UUID format, look up org by ID to get the name
  if (isValidUuid(clerkOrgId)) {
    try {
      const orgRepo = new OrganizationRepository();
      const org = await orgRepo.findById(clerkOrgId);
      if (org) {
        const resolved = { id: org.id, name: org.name };
        orgCache.set(clerkOrgId, resolved);
        return { id: unsafeOrganizationId(org.id), name: org.name };
      }
    } catch (error) {
      console.error("Failed to look up organization by UUID:", error);
    }
    return { id: unsafeOrganizationId(clerkOrgId) };
  }

  // Look up by Clerk org ID
  try {
    const orgRepo = new OrganizationRepository();
    const org = await orgRepo.findByClerkId(clerkOrgId);

    if (org) {
      const resolved = { id: org.id, name: org.name };
      orgCache.set(clerkOrgId, resolved);
      return { id: unsafeOrganizationId(org.id), name: org.name };
    }
  } catch (error) {
    console.error("Failed to resolve organization ID:", error);
  }

  return null;
}

/**
 * Resolve a Clerk user ID (user_xxxxx) to a database entity UUID
 * This supports the consolidated auth model where entities serve as authenticated users
 */
async function resolveEntityId(clerkUserId: string): Promise<EntityId | null> {
  // Check cache first
  if (entityIdCache.has(clerkUserId)) {
    return unsafeEntityId(entityIdCache.get(clerkUserId)!);
  }

  // If it's already a UUID format, return as-is (already an entity ID)
  if (isValidUuid(clerkUserId)) {
    return unsafeEntityId(clerkUserId);
  }

  // Look up by Clerk user ID
  try {
    const authEntityRepo = new AuthEntityRepository();
    const entity = await authEntityRepo.findByClerkId(clerkUserId);

    if (entity) {
      entityIdCache.set(clerkUserId, entity.id);
      return unsafeEntityId(entity.id);
    }
  } catch (error) {
    console.error("Failed to resolve entity ID from Clerk user ID:", error);
  }

  return null;
}

export async function getServiceContext(): Promise<OrganizationContext> {
  const headersList = await headers();

  const { rawOrganizationId, rawUserId, source } =
    await resolveRequestIdentity(headersList);
  const apiKeyName = headersList.get("x-api-key-name");

  const DEV_ORG_ID = "ba3b8cdf-efc1-4a60-88be-ac203d263fe2";
  // Stable UUID used for dev/test contexts (Karate defaults to this value).
  const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";

  const resolvedOrgFromHeader = rawOrganizationId
    ? await resolveOrganization(rawOrganizationId)
    : null;
  const resolvedOrgFromUser =
    !resolvedOrgFromHeader && rawUserId
      ? await resolveOrganizationFromUser(rawUserId)
      : null;
  const resolvedOrg = resolvedOrgFromHeader ?? resolvedOrgFromUser;
  const resolvedEntityId = rawUserId ? await resolveEntityId(rawUserId) : null;

  authDebug("get_service_context_resolved", {
    identitySource: source,
    rawUserId: summarizeValue(rawUserId),
    rawOrganizationId: summarizeValue(rawOrganizationId),
    hasResolvedOrgFromHeader: Boolean(resolvedOrgFromHeader),
    hasResolvedOrgFromUser: Boolean(resolvedOrgFromUser),
    hasResolvedEntityId: Boolean(resolvedEntityId),
    apiKeyName: apiKeyName || null,
    nodeEnv: process.env.NODE_ENV,
  });

  const isProduction = process.env.NODE_ENV === "production";

  // In production, organization + user context MUST be present and resolvable.
  // IMPORTANT: audit fields in many tables are UUIDs; therefore, `x-user-id` must
  // resolve to an entity UUID (or itself be a UUID).
  if (isProduction) {
    if (!rawUserId) {
      throw new AuthenticationError(
        "User context required. Ensure Authorization token or x-user-id header is set.",
      );
    }
    if (!resolvedOrg) {
      throw new AuthenticationError(
        rawOrganizationId
          ? `Could not resolve organization context from x-organization-id: ${rawOrganizationId}`
          : "Could not resolve organization context from user identity",
      );
    }

    const dbUserId =
      resolvedEntityId ??
      (isValidUuid(rawUserId) ? unsafeEntityId(rawUserId) : null);

    if (!dbUserId) {
      throw new AuthenticationError(
        "Invalid user context. x-user-id must be an entity UUID or map to an entity record.",
      );
    }

    return {
      organizationId: resolvedOrg.id,
      organizationName: resolvedOrg.name,
      entityId:
        resolvedEntityId ??
        (isValidUuid(rawUserId) ? unsafeEntityId(rawUserId) : null),
      clerkUserId: unsafeClerkUserId(rawUserId),
      clerkOrganizationId: rawOrganizationId?.startsWith("org_")
        ? unsafeClerkOrgId(rawOrganizationId)
        : undefined,
      apiKeyName: apiKeyName || undefined,
      // Deprecated alias - kept for backward compatibility in service layer.
      // Always a UUID in production.
      userId: dbUserId,
    };
  }

  // Development fallback: allow partial headers, but always produce UUID-safe IDs so
  // writes with UUID audit columns (e.g. sales_orders.created_by) don't explode.
  const devOrgId = unsafeOrganizationId(DEV_ORG_ID);
  const devEntityId = unsafeEntityId(DEV_USER_ID);

  const organizationId = resolvedOrg?.id ?? devOrgId;
  const organizationName = resolvedOrg?.name ?? "Development";

  // If the caller provided a UUID, treat it as an entity ID. Otherwise, use a stable dev UUID.
  const entityId =
    resolvedEntityId ??
    (rawUserId && isValidUuid(rawUserId)
      ? unsafeEntityId(rawUserId)
      : devEntityId);

  const dbUserId = entityId;
  const clerkUserId = unsafeClerkUserId(rawUserId || DEV_USER_ID);

  if (!rawOrganizationId || !rawUserId) {
    console.warn("[DEV ONLY] Using development context - missing auth headers");
  } else if (!resolvedOrg) {
    console.warn(
      `[DEV ONLY] Could not resolve organization ID: ${rawOrganizationId}; falling back to dev org`,
    );
  }

  return {
    organizationId,
    organizationName,
    entityId,
    clerkUserId,
    clerkOrganizationId: undefined,
    // Deprecated alias
    userId: dbUserId,
  };
}

// For routes that might be partially public (like health checks)
export async function getOptionalServiceContext(): Promise<OrganizationContext | null> {
  const headersList = await headers();

  const { rawOrganizationId, rawUserId, source } =
    await resolveRequestIdentity(headersList);
  const apiKeyName = headersList.get("x-api-key-name");

  if (!rawUserId) {
    authDebug("get_optional_context_null", {
      reason: "missing_user_id",
      identitySource: source,
      rawOrganizationId: summarizeValue(rawOrganizationId),
      apiKeyName: apiKeyName || null,
    });
    return null;
  }

  // Resolve organization from header first; fall back to user-to-org mapping.
  const resolvedOrgFromHeader = rawOrganizationId
    ? await resolveOrganization(rawOrganizationId)
    : null;
  const resolvedOrg =
    resolvedOrgFromHeader ?? (await resolveOrganizationFromUser(rawUserId));
  if (!resolvedOrg) {
    authDebug("get_optional_context_null", {
      reason: "unresolved_organization",
      identitySource: source,
      rawUserId: summarizeValue(rawUserId),
      rawOrganizationId: summarizeValue(rawOrganizationId),
      hasResolvedOrgFromHeader: Boolean(resolvedOrgFromHeader),
      apiKeyName: apiKeyName || null,
    });
    return null;
  }

  // Resolve Clerk user ID to entity UUID
  const entityId = await resolveEntityId(rawUserId);
  const clerkUserId = unsafeClerkUserId(rawUserId);

  authDebug("get_optional_context_success", {
    identitySource: source,
    rawUserId: summarizeValue(rawUserId),
    rawOrganizationId: summarizeValue(rawOrganizationId),
    organizationId: summarizeValue(resolvedOrg.id),
    hasEntityId: Boolean(entityId),
    apiKeyName: apiKeyName || null,
  });

  return {
    organizationId: resolvedOrg.id,
    organizationName: resolvedOrg.name,
    entityId: entityId,
    clerkUserId: clerkUserId,
    clerkOrganizationId: rawOrganizationId?.startsWith("org_")
      ? unsafeClerkOrgId(rawOrganizationId)
      : undefined,
    apiKeyName: apiKeyName || undefined,
    // Deprecated alias
    userId: entityId || rawUserId,
  };
}

// ============ RBAC Permission Helpers ============

/**
 * Check if the current user has the specified permission
 * @param resourceType The type of resource (e.g., 'GL_TRANSACTION', 'ACCOUNT')
 * @param action The action to check (e.g., 'CREATE', 'READ', 'UPDATE', 'DELETE')
 * @param subsidiaryId Optional subsidiary ID for subsidiary-scoped permissions
 * @returns true if user has permission, false otherwise
 */
export async function checkPermission(
  resourceType: ResourceType,
  action: Action,
  subsidiaryId?: string,
): Promise<boolean> {
  const context = await getServiceContext();
  const permissionService = new PermissionService({
    organizationId: context.organizationId,
    userId: context.userId,
  });

  return permissionService.checkPermission(resourceType, action, subsidiaryId);
}

/**
 * Require the current user to have the specified permission
 * Throws a 403 error if permission is denied
 * @param resourceType The type of resource (e.g., 'GL_TRANSACTION', 'ACCOUNT')
 * @param action The action to check (e.g., 'CREATE', 'READ', 'UPDATE', 'DELETE')
 * @param subsidiaryId Optional subsidiary ID for subsidiary-scoped permissions
 * @throws ServiceError with code 'PERMISSION_DENIED' if user lacks permission
 */
export async function requirePermission(
  resourceType: ResourceType,
  action: Action,
  subsidiaryId?: string,
): Promise<void> {
  const context = await getServiceContext();
  const permissionService = new PermissionService({
    organizationId: context.organizationId,
    userId: context.userId,
  });

  await permissionService.requirePermission(resourceType, action, subsidiaryId);
}

/**
 * Check if the current user has the specified subsidiary access level
 * @param subsidiaryId The subsidiary ID to check
 * @param requiredLevel The minimum access level required ('read', 'write', 'admin')
 * @returns true if user has required access, false otherwise
 */
export async function checkSubsidiaryAccess(
  subsidiaryId: string,
  requiredLevel: AccessLevel,
): Promise<boolean> {
  const context = await getServiceContext();
  const permissionService = new PermissionService({
    organizationId: context.organizationId,
    userId: context.userId,
  });

  return permissionService.checkSubsidiaryAccess(subsidiaryId, requiredLevel);
}

/**
 * Require the current user to have the specified subsidiary access level
 * Throws a 403 error if access is denied
 * @param subsidiaryId The subsidiary ID to check
 * @param requiredLevel The minimum access level required ('read', 'write', 'admin')
 * @throws ServiceError with code 'SUBSIDIARY_ACCESS_DENIED' if access is insufficient
 */
export async function requireSubsidiaryAccess(
  subsidiaryId: string,
  requiredLevel: AccessLevel,
): Promise<void> {
  const context = await getServiceContext();
  const permissionService = new PermissionService({
    organizationId: context.organizationId,
    userId: context.userId,
  });

  await permissionService.requireSubsidiaryAccess(subsidiaryId, requiredLevel);
}

/**
 * Check if the current user has admin role
 * @returns true if user is admin, false otherwise
 */
export async function isAdmin(): Promise<boolean> {
  const context = await getServiceContext();
  const permissionService = new PermissionService({
    organizationId: context.organizationId,
    userId: context.userId,
  });

  return permissionService.isAdmin();
}

/**
 * Require the current user to have admin role
 * Throws a 403 error if user is not admin
 * @throws ServiceError with code 'ADMIN_REQUIRED' if user is not admin
 */
export async function requireAdmin(): Promise<void> {
  const context = await getServiceContext();
  const permissionService = new PermissionService({
    organizationId: context.organizationId,
    userId: context.userId,
  });

  await permissionService.requireAdmin();
}
