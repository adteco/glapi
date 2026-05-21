import type { FastifyReply, FastifyRequest } from 'fastify';
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

export function resolveRequestUser(request: FastifyRequest) {
  const organizationId = getHeader(request, 'x-organization-id');
  const userId = getHeader(request, 'x-user-id');

  if (!organizationId || !userId) {
    throw new AuthenticationError(
      'Organization context required. Send x-organization-id and x-user-id, or authenticate with a configured API key.'
    );
  }

  return {
    id: userId,
    clerkId: userId,
    entityId: userId,
    organizationId,
    email: null,
    role: 'user' as const,
  };
}
