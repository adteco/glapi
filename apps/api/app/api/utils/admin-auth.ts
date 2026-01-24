import { verifyToken } from '@clerk/backend';
import type { NextRequest } from 'next/server';

const ADMIN_ROLES = new Set(['admin', 'owner', 'org:admin', 'org:owner']);

export class AdminAuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminAuthError';
    this.status = status;
  }
}

export async function requireAdminContext(request: NextRequest): Promise<{
  clerkOrgId: string;
  clerkUserId: string;
  role?: string;
}> {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AdminAuthError('Missing or invalid authorization header', 401);
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new AdminAuthError('CLERK_SECRET_KEY is not configured', 500);
  }

  const token = authHeader.slice('Bearer '.length).trim();
  let payload: Awaited<ReturnType<typeof verifyToken>>;
  try {
    payload = await verifyToken(token, { secretKey });
  } catch (error) {
    console.error('Failed to verify Clerk token:', error);
    throw new AdminAuthError('Invalid or expired token', 401);
  }

  if (!payload.sub) {
    throw new AdminAuthError('Invalid token: missing user ID', 401);
  }

  const clerkOrgId = (payload.org_id || payload.organization_id) as string | undefined;
  if (!clerkOrgId) {
    throw new AdminAuthError('No organization context found in token', 401);
  }

  const tokenRole = (payload.org_role || payload.organization_role) as string | undefined;
  const metadataRole = (payload.public_metadata as { role?: string } | undefined)?.role;
  const role = tokenRole || metadataRole;

  if (!role || !ADMIN_ROLES.has(role)) {
    throw new AdminAuthError('Admin role required', 403);
  }

  return {
    clerkOrgId,
    clerkUserId: payload.sub,
    role,
  };
}
