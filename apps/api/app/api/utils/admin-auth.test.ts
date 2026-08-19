import type { NextRequest } from 'next/server';
import { AdminAuthError, requireAdminContext } from './admin-auth';

const mockBetterAuthGetSession = jest.fn();
const mockBetterAuthGetFullOrganization = jest.fn();

jest.mock('@glapi/auth', () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockBetterAuthGetSession(...args),
      getFullOrganization: (...args: unknown[]) => mockBetterAuthGetFullOrganization(...args),
    },
  },
}));

jest.mock('@glapi/database', () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => ({
    findByBetterAuthId: jest.fn().mockResolvedValue({ id: 'org_uuid_123' }),
    findById: jest.fn().mockResolvedValue({ id: 'org_uuid_123' }),
  })),
  PermissionRepository: jest.fn().mockImplementation(() => ({
    findEntityRoles: jest.fn().mockResolvedValue([]),
  })),
  AuthEntityRepository: jest.fn().mockImplementation(() => ({
    findByBetterAuthId: jest.fn().mockResolvedValue({ id: 'entity_uuid_123' }),
  })),
  withOrganizationContext: (...args: unknown[]) => {
      const callback = args[1] as any;
      return callback({});
  },
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
    mockBetterAuthGetSession.mockResolvedValue({
      user: { id: 'user_test_123' },
      session: { activeOrganizationId: 'org_test_123' },
    });
    mockBetterAuthGetFullOrganization.mockResolvedValue({
      members: [
        { userId: 'user_test_123', role: 'admin' }
      ]
    });

    await expect(
      requireAdminContext(
        makeRequest({
          'cookie': 'better-auth.session_token=valid-token',
        })
      )
    ).resolves.toEqual({
      orgId: 'org_uuid_123',
      userId: 'user_test_123',
      role: 'admin',
    });
  });

  it('rejects non-admin memberships', async () => {
    mockBetterAuthGetSession.mockResolvedValue({
      user: { id: 'user_test_123' },
      session: { activeOrganizationId: 'org_test_123' },
    });
    mockBetterAuthGetFullOrganization.mockResolvedValue({
      members: [
        { userId: 'user_test_123', role: 'member' }
      ]
    });

    await expect(
      requireAdminContext(
        makeRequest({
          'cookie': 'better-auth.session_token=valid-token',
        })
      )
    ).rejects.toThrow(new AdminAuthError('Admin role required', 403));
  });

  it('rejects unauthenticated requests', async () => {
    mockBetterAuthGetSession.mockResolvedValue(null);

    await expect(
      requireAdminContext(
        makeRequest({})
      )
    ).rejects.toThrow(new AdminAuthError('No valid Better Auth session found', 401));
  });
});
