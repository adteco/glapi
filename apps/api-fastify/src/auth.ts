import type { FastifyReply, FastifyRequest } from 'fastify';
import { auth as betterAuth } from '@glapi/auth';
import {
  AuthEntityRepository,
  OrganizationRepository,
  PermissionRepository,
  withOrganizationContext,
} from '@glapi/database';
import {
  isValidUuid,
  unsafeClerkUserId,
  unsafeEntityId,
  unsafeOrganizationId,
  type EntityId,
  type OrganizationId,
} from '@glapi/shared-types';
import { AuthenticationError } from './errors';

type ApiKeyRecord = {
  organizationId: string;
  actorEntityId: string;
  name: string;
  scopes: string[];
};

const developmentApiKeys: Record<string, ApiKeyRecord> = {
  glapi_test_sk_1234567890abcdef: {
    organizationId: 'ba3b8cdf-efc1-4a60-88be-ac203d263fe2',
    actorEntityId: '00000000-0000-0000-0000-000000000001',
    name: 'Development API Key (Adteco)',
    scopes: ['read', 'write'],
  },
  glapi_test_sk_orgb_0987654321fedcba: {
    organizationId: '456c2475-2277-4d90-929b-ae694a2a8577',
    actorEntityId: '00000000-0000-0000-0000-000000000002',
    name: 'Development API Key (CJD-Consulting)',
    scopes: ['read', 'write'],
  },
};

const AUTH_MAPPING_RECONCILIATION_COMMAND =
  'pnpm --filter @glapi/database reconcile:better-auth -- --write';

const orgCache = new Map<string, { id: string; name?: string; betterAuthOrgId?: string }>();
const entityIdCache = new Map<string, string>();

function configuredApiKeys(): Record<string, ApiKeyRecord> {
  const configured = process.env.GLAPI_API_KEYS_JSON;
  if (!configured) return developmentApiKeys;

  try {
    return JSON.parse(configured) as Record<string, ApiKeyRecord>;
  } catch (error) {
    console.error('[api-fastify] GLAPI_API_KEYS_JSON is not valid JSON', error);
    return {};
  }
}

function getHeader(request: FastifyRequest, name: string): string | null {
  const value = request.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function parseBooleanEnvFlag(value: string | undefined): boolean | undefined {
  if (!value) return undefined;

  switch (value.trim().toLowerCase()) {
    case '1':
    case 'true':
    case 'yes':
      return true;
    case '0':
    case 'false':
    case 'no':
      return false;
    default:
      return undefined;
  }
}

function canAutoProvisionExternalAuthRecords(): boolean {
  const explicitOverride = parseBooleanEnvFlag(
    process.env.AUTH_ALLOW_AUTO_PROVISION_MISSING_MAPPINGS
  );

  if (explicitOverride !== undefined) {
    return explicitOverride;
  }

  return process.env.NODE_ENV !== 'production';
}

function createMissingMappingError(kind: 'organization' | 'user', externalId: string) {
  return new AuthenticationError(
    `No internal Better Auth ${kind} mapping exists for ${externalId}. Run \`${AUTH_MAPPING_RECONCILIATION_COMMAND}\` before enabling production authentication.`
  );
}

async function resolveOrganization(orgId: string): Promise<{
  id: OrganizationId;
  name?: string;
  betterAuthOrgId?: string;
} | null> {
  const cached = orgCache.get(orgId);
  if (cached) {
    return {
      id: unsafeOrganizationId(cached.id),
      name: cached.name,
      betterAuthOrgId: cached.betterAuthOrgId,
    };
  }

  const orgRepo = new OrganizationRepository();
  const org = isValidUuid(orgId)
    ? await orgRepo.findById(orgId)
    : await orgRepo.findByBetterAuthId(orgId);

  if (!org) {
    return isValidUuid(orgId) ? { id: unsafeOrganizationId(orgId) } : null;
  }

  const resolved = {
    id: org.id,
    name: org.name,
    betterAuthOrgId: org.betterAuthOrgId || undefined,
  };
  orgCache.set(orgId, resolved);
  orgCache.set(org.id, resolved);
  if (org.betterAuthOrgId) {
    orgCache.set(org.betterAuthOrgId, resolved);
  }

  return {
    id: unsafeOrganizationId(org.id),
    name: org.name,
    betterAuthOrgId: org.betterAuthOrgId || undefined,
  };
}

async function resolveEntityId(
  externalUserId: string,
  organizationId?: OrganizationId
): Promise<EntityId | null> {
  const cacheKey = organizationId ? `${organizationId}:${externalUserId}` : externalUserId;
  const cached = entityIdCache.get(cacheKey) ?? entityIdCache.get(externalUserId);
  if (cached) {
    return unsafeEntityId(cached);
  }

  if (isValidUuid(externalUserId)) {
    return unsafeEntityId(externalUserId);
  }

  const authEntityRepo = new AuthEntityRepository();
  const entity = await authEntityRepo.findByBetterAuthId(externalUserId);
  if (!entity) {
    return null;
  }

  if (organizationId && entity.organizationId !== organizationId) {
    return null;
  }

  entityIdCache.set(cacheKey, entity.id);
  entityIdCache.set(externalUserId, entity.id);
  return unsafeEntityId(entity.id);
}

async function assignDefaultRoleIfMissing(
  entityId: string,
  organizationId: OrganizationId
): Promise<void> {
  await withOrganizationContext({ organizationId }, async (contextDb) => {
    const permRepo = new PermissionRepository(contextDb);
    const existingRoles = await permRepo.findEntityRoles(entityId);
    if (existingRoles.length > 0) return;

    const userRole = await permRepo.findRoleByName('USER');
    if (userRole) {
      await permRepo.assignRoleToEntity(entityId, userRole.id, entityId);
    }
  });
}

async function ensureEntityForBetterAuthUser(
  betterAuthUserId: string,
  organizationId: OrganizationId
): Promise<EntityId | null> {
  const entityId = await withOrganizationContext({ organizationId }, async (contextDb) => {
    const authEntityRepo = new AuthEntityRepository(contextDb);
    const existing = await authEntityRepo.findByBetterAuthId(betterAuthUserId);
    if (existing) return existing.id;

    const created = await authEntityRepo.createUserEntity({
      betterAuthUserId,
      email: `${betterAuthUserId}@placeholder.local`,
      name: `User ${betterAuthUserId.slice(-8)}`,
      organizationId,
      role: 'user',
    });
    return created.id;
  });

  entityIdCache.set(`${organizationId}:${betterAuthUserId}`, entityId);
  entityIdCache.set(betterAuthUserId, entityId);
  await assignDefaultRoleIfMissing(entityId, organizationId);
  return unsafeEntityId(entityId);
}

const ADMIN_ROLE_NAMES = new Set(['ADMIN', 'OWNER', 'SUPER_ADMIN']);

async function resolveEntityRole(
  entityId: string | null,
  organizationId: OrganizationId
): Promise<'user' | 'admin'> {
  if (!entityId) return 'user';

  try {
    return await withOrganizationContext({ organizationId }, async (contextDb) => {
      const permRepo = new PermissionRepository(contextDb);
      const entityRoles = await permRepo.findEntityRoles(entityId);

      for (const entityRole of entityRoles) {
        if (entityRole.role && ADMIN_ROLE_NAMES.has(entityRole.role.roleName)) {
          return 'admin' as const;
        }
      }

      return 'user' as const;
    });
  } catch (error) {
    console.warn('[api-fastify] Failed to resolve entity role', error);
    return 'user';
  }
}

function getRequestHeaders(request: FastifyRequest): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined) headers.append(key, item);
      }
    } else if (value !== undefined) {
      headers.set(key, String(value));
    }
  }
  return headers;
}

export function normalizeApiRequest(request: FastifyRequest): void {
  const apiKey = getHeader(request, 'x-api-key');
  if (!apiKey) return;

  const keyRecord = configuredApiKeys()[apiKey];
  if (!keyRecord) {
    throw new AuthenticationError('Invalid API key');
  }

  request.headers['x-organization-id'] = keyRecord.organizationId;
  request.headers['x-user-id'] = keyRecord.actorEntityId;
  request.headers['x-api-key-name'] = keyRecord.name;
}

export async function authPreHandler(request: FastifyRequest, _reply: FastifyReply) {
  normalizeApiRequest(request);
}

export async function resolveRequestUser(request: FastifyRequest) {
  const apiKeyName = getHeader(request, 'x-api-key-name');
  const headerOrganizationId = getHeader(request, 'x-organization-id');
  const headerUserId = getHeader(request, 'x-user-id');

  if (apiKeyName) {
    if (!headerOrganizationId || !headerUserId) {
      throw new AuthenticationError('Configured API key did not resolve organization context');
    }

    const organizationId = unsafeOrganizationId(headerOrganizationId);
    const entityId = unsafeEntityId(headerUserId);
    const role = await resolveEntityRole(entityId, organizationId);

    return {
      id: entityId,
      clerkId: unsafeClerkUserId(entityId),
      entityId,
      organizationId,
      email: null,
      role,
      authProvider: 'api-key' as const,
      apiKeyName,
    };
  }

  const session = await betterAuth.api.getSession({
    headers: getRequestHeaders(request),
  });

  if (!session) {
    throw new AuthenticationError(
      'Authentication required. Send a Better Auth session cookie or authenticate with a configured API key.'
    );
  }

  const sessionData = session as {
    user?: { id?: string; email?: string | null };
    session?: { activeOrganizationId?: string | null };
  };
  const betterAuthUserId = sessionData.user?.id;
  const betterAuthOrganizationId = sessionData.session?.activeOrganizationId;

  if (!betterAuthUserId || !betterAuthOrganizationId) {
    throw new AuthenticationError(
      'Active organization context required for Better Auth session.'
    );
  }

  const resolvedOrg = await resolveOrganization(betterAuthOrganizationId);
  if (!resolvedOrg) {
    throw createMissingMappingError('organization', betterAuthOrganizationId);
  }

  let entityId = await resolveEntityId(betterAuthUserId, resolvedOrg.id);
  if (!entityId) {
    if (!canAutoProvisionExternalAuthRecords()) {
      throw createMissingMappingError('user', betterAuthUserId);
    }

    entityId = await ensureEntityForBetterAuthUser(betterAuthUserId, resolvedOrg.id);
  }

  if (!entityId) {
    throw new AuthenticationError(
      'Authenticated Better Auth user could not be resolved to an entity record.'
    );
  }

  const role = await resolveEntityRole(entityId, resolvedOrg.id);

  return {
    id: entityId,
    clerkId: unsafeClerkUserId(entityId),
    betterAuthUserId,
    betterAuthOrganizationId,
    authProvider: 'better-auth' as const,
    entityId,
    organizationId: resolvedOrg.id,
    email: sessionData.user?.email ?? null,
    role,
  };
}
