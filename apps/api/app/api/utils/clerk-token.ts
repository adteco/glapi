import { createClerkClient, verifyToken } from '@clerk/backend';

export interface VerifiedClerkTokenClaims {
  userId: string;
  organizationId?: string;
  role?: string;
}

export interface ClerkOrganizationMembership {
  clerkOrgId: string;
  role?: string;
}

let clerkClient: ReturnType<typeof createClerkClient> | null = null;

export function getClerkSecretKey(): string {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error('CLERK_SECRET_KEY is not configured');
  }

  return secretKey;
}

function getClerkClient() {
  if (!clerkClient) {
    clerkClient = createClerkClient({ secretKey: getClerkSecretKey() });
  }

  return clerkClient;
}

export async function verifyClerkBearerToken(
  token: string
): Promise<VerifiedClerkTokenClaims> {
  const payload = await verifyToken(token, { secretKey: getClerkSecretKey() });

  if (!payload.sub) {
    throw new Error('Invalid token: missing user ID');
  }

  return {
    userId: payload.sub,
    organizationId: (payload.org_id || payload.organization_id) as string | undefined,
    role: (payload.org_role || payload.organization_role) as string | undefined,
  };
}

export async function getClerkOrganizationMembership(
  clerkUserId: string,
  clerkOrgId: string
): Promise<ClerkOrganizationMembership | null> {
  const memberships = await getClerkClient().users.getOrganizationMembershipList({
    userId: clerkUserId,
    limit: 100,
  });

  const membership = memberships.data.find(
    (candidate) => candidate.organization.id === clerkOrgId
  );

  if (!membership) {
    return null;
  }

  return {
    clerkOrgId: membership.organization.id,
    role: membership.role,
  };
}

export async function getClerkOrganization(
  clerkOrgId: string
) {
  try {
    const org = await getClerkClient().organizations.getOrganization({
      organizationId: clerkOrgId,
    });
    return org;
  } catch (error) {
    console.error(`[clerk] Failed to fetch organization ${clerkOrgId}`, error);
    return null;
  }
}
