import type { NextRequest } from 'next/server';
import { AdminAuthError, requireAdminContext } from './admin-auth';

const mockVerifyClerkBearerToken = jest.fn();
const mockGetClerkOrganizationMembership = jest.fn();

jest.mock('./clerk-token', () => ({
  verifyClerkBearerToken: (...args: unknown[]) => mockVerifyClerkBearerToken(...args),
  getClerkOrganizationMembership: (...args: unknown[]) =>
    mockGetClerkOrganizationMembership(...args),
}));

function makeRequest(headersInit: HeadersInit): NextRequest {
  return {
    headers: new Headers(headersInit),
  } as NextRequest;
}

describe('requireAdminContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts an admin token with embedded org context', async () => {
    mockVerifyClerkBearerToken.mockResolvedValue({
      userId: 'user_test_123',
      organizationId: 'org_test_123',
      role: 'org:admin',
    });

    await expect(
      requireAdminContext(
        makeRequest({
          Authorization: 'Bearer valid-token',
        })
      )
    ).resolves.toEqual({
      clerkOrgId: 'org_test_123',
      clerkUserId: 'user_test_123',
      role: 'org:admin',
    });
  });

  it('accepts an admin token without org claim when Clerk verifies membership for the requested org', async () => {
    mockVerifyClerkBearerToken.mockResolvedValue({
      userId: 'user_test_123',
    });
    mockGetClerkOrganizationMembership.mockResolvedValue({
      clerkOrgId: 'org_test_123',
      role: 'org:admin',
    });

    await expect(
      requireAdminContext(
        makeRequest({
          Authorization: 'Bearer valid-token',
          'x-organization-id': 'org_test_123',
        })
      )
    ).resolves.toEqual({
      clerkOrgId: 'org_test_123',
      clerkUserId: 'user_test_123',
      role: 'org:admin',
    });
  });

  it('rejects a requested org when the authenticated user is not a member', async () => {
    mockVerifyClerkBearerToken.mockResolvedValue({
      userId: 'user_test_123',
    });
    mockGetClerkOrganizationMembership.mockResolvedValue(null);

    await expect(
      requireAdminContext(
        makeRequest({
          Authorization: 'Bearer valid-token',
          'x-organization-id': 'org_test_123',
        })
      )
    ).rejects.toThrow(
      new AdminAuthError(
        'Authenticated user is not a member of the requested organization',
        403
      )
    );
  });

  it('rejects non-admin memberships', async () => {
    mockVerifyClerkBearerToken.mockResolvedValue({
      userId: 'user_test_123',
      organizationId: 'org_test_123',
      role: 'org:member',
    });

    await expect(
      requireAdminContext(
        makeRequest({
          Authorization: 'Bearer valid-token',
        })
      )
    ).rejects.toThrow(new AdminAuthError('Admin role required', 403));
  });
});
