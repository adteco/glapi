const BETTER_AUTH_ORG_PREFIX = 'ba_org_';
const BETTER_AUTH_USER_PREFIX = 'ba_usr_';
const BETTER_AUTH_MEMBER_PREFIX = 'ba_mem_';

export function buildBetterAuthOrganizationId(organizationId: string): string {
  return `${BETTER_AUTH_ORG_PREFIX}${organizationId}`;
}

export function buildBetterAuthUserId(entityId: string): string {
  return `${BETTER_AUTH_USER_PREFIX}${entityId}`;
}

export function buildBetterAuthMemberId(
  betterAuthOrganizationId: string,
  betterAuthUserId: string
): string {
  return `${BETTER_AUTH_MEMBER_PREFIX}${betterAuthOrganizationId}_${betterAuthUserId}`;
}

export function normalizeBetterAuthMemberRole(role: string | null | undefined): 'owner' | 'admin' | 'member' {
  const normalized = role?.trim().toLowerCase();

  switch (normalized) {
    case 'owner':
      return 'owner';
    case 'admin':
      return 'admin';
    default:
      return 'member';
  }
}

export function normalizeEmail(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase();
  return normalized || null;
}
