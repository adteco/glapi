import { headers } from 'next/headers';
import {
  AuthenticationError,
  getOptionalServiceContext,
  getServiceContext,
  resetAuthCachesForTest,
} from './auth';

const mockFindOrganizationByClerkId = jest.fn();
const mockFindOrganizationById = jest.fn();
const mockFindEntityByClerkId = jest.fn();
const mockCreateUserEntity = jest.fn();
const mockWithOrganizationContext = jest.fn();
const mockVerifyClerkBearerToken = jest.fn();
const mockGetClerkOrganizationMembership = jest.fn();
const mockGetClerkSecretKey = jest.fn();
const mockGetClerkOrganization = jest.fn();

jest.mock('next/headers', () => ({
  headers: jest.fn(),
}));

jest.mock('./clerk-token', () => ({
  verifyClerkBearerToken: (...args: unknown[]) => mockVerifyClerkBearerToken(...args),
  getClerkOrganizationMembership: (...args: unknown[]) =>
    mockGetClerkOrganizationMembership(...args),
  getClerkSecretKey: (...args: unknown[]) => mockGetClerkSecretKey(...args),
  getClerkOrganization: (...args: unknown[]) => mockGetClerkOrganization(...args),
}));

jest.mock('@glapi/api-service', () => ({
  PermissionService: jest.fn(),
}));

jest.mock('@glapi/database', () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => ({
    findByClerkId: mockFindOrganizationByClerkId,
    findById: mockFindOrganizationById,
  })),
  AuthEntityRepository: jest.fn().mockImplementation(() => ({
    findByClerkId: mockFindEntityByClerkId,
    createUserEntity: mockCreateUserEntity,
  })),
  withOrganizationContext: (...args: unknown[]) => mockWithOrganizationContext(...args),
}));

const mockedHeaders = headers as jest.MockedFunction<typeof headers>;

const ORG_UUID = '11111111-1111-1111-1111-111111111111';
const ENTITY_UUID = '22222222-2222-2222-2222-222222222222';
const SERVICE_ACTOR_UUID = '33333333-3333-3333-3333-333333333333';

describe('getServiceContext', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalClerkSecretKey = process.env.CLERK_SECRET_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    resetAuthCachesForTest();
    process.env.NODE_ENV = 'production';
    process.env.CLERK_SECRET_KEY = 'test-secret-key';

    mockFindOrganizationByClerkId.mockReset();
    mockFindOrganizationById.mockReset();
    mockFindEntityByClerkId.mockReset();
    mockCreateUserEntity.mockReset();
    mockWithOrganizationContext.mockReset();
    mockVerifyClerkBearerToken.mockReset();
    mockGetClerkOrganizationMembership.mockReset();
    mockGetClerkSecretKey.mockReset();
    mockGetClerkOrganization.mockReset();

    mockFindOrganizationByClerkId.mockResolvedValue({
      id: ORG_UUID,
      name: 'Adteco',
      clerkOrgId: 'org_test_123',
    });
    mockFindOrganizationById.mockResolvedValue({
      id: ORG_UUID,
      name: 'Adteco',
      clerkOrgId: 'org_test_123',
    });
    mockFindEntityByClerkId.mockResolvedValue({
      id: ENTITY_UUID,
    });
    mockCreateUserEntity.mockResolvedValue({
      id: ENTITY_UUID,
    });
    mockVerifyClerkBearerToken.mockResolvedValue({
      userId: 'user_test_123',
      organizationId: 'org_test_123',
    });
    mockGetClerkOrganizationMembership.mockResolvedValue(null);
    mockGetClerkSecretKey.mockReturnValue('test-secret-key');
    mockGetClerkOrganization.mockResolvedValue(null);
    mockWithOrganizationContext.mockImplementation(
      async (_context: unknown, callback: (db: unknown) => Promise<unknown>) => callback({})
    );
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.CLERK_SECRET_KEY = originalClerkSecretKey;
  });

  it('derives context from a verified Clerk bearer token', async () => {
    mockedHeaders.mockResolvedValue(
      new Headers({
        Authorization: 'Bearer valid-token',
        'x-organization-id': ORG_UUID,
        'x-user-id': 'user_test_123',
      })
    );

    const context = await getServiceContext();

    expect(mockVerifyClerkBearerToken).toHaveBeenCalledWith('valid-token');
    expect(context).toEqual({
      organizationId: ORG_UUID,
      organizationName: 'Adteco',
      entityId: ENTITY_UUID,
      clerkUserId: 'user_test_123',
      clerkOrganizationId: 'org_test_123',
      userId: ENTITY_UUID,
    });
  });

  it('rejects spoofed user headers that do not match the verified token', async () => {
    mockedHeaders.mockResolvedValue(
      new Headers({
        Authorization: 'Bearer valid-token',
        'x-organization-id': ORG_UUID,
        'x-user-id': 'user_attacker_123',
      })
    );
    mockVerifyClerkBearerToken.mockResolvedValue({
      userId: 'user_real_123',
      organizationId: 'org_test_123',
    });

    await expect(getServiceContext()).rejects.toThrow(
      new AuthenticationError('User header does not match authenticated token context.')
    );
  });

  it('rejects spoofed organization headers that do not match the verified token', async () => {
    mockedHeaders.mockResolvedValue(
      new Headers({
        Authorization: 'Bearer valid-token',
        'x-organization-id': '44444444-4444-4444-4444-444444444444',
        'x-user-id': 'user_test_123',
      })
    );
    mockVerifyClerkBearerToken.mockResolvedValue({
      userId: 'user_test_123',
      organizationId: 'org_test_123',
    });
    mockFindOrganizationById.mockResolvedValueOnce({
      id: '44444444-4444-4444-4444-444444444444',
      name: 'Attacker Org',
    });

    await expect(getServiceContext()).rejects.toThrow(
      new AuthenticationError('Organization header does not match authenticated token context.')
    );
  });

  it('preserves trusted API key context without requiring a Clerk bearer token', async () => {
    mockedHeaders.mockResolvedValue(
      new Headers({
        'x-api-key-name': 'Integration Key',
        'x-organization-id': ORG_UUID,
        'x-user-id': SERVICE_ACTOR_UUID,
      })
    );

    const context = await getServiceContext();

    expect(mockVerifyClerkBearerToken).not.toHaveBeenCalled();
    expect(context.organizationId).toBe(ORG_UUID);
    expect(context.userId).toBe(SERVICE_ACTOR_UUID);
    expect(context.apiKeyName).toBe('Integration Key');
  });

  it('rejects unauthenticated production requests', async () => {
    mockedHeaders.mockResolvedValue(new Headers());

    await expect(getServiceContext()).rejects.toThrow(
      new AuthenticationError(
        'Authentication required. Provide a valid Clerk bearer token with organization context.'
      )
    );
  });

  it('accepts a verified token without org claim when the requested header org is verified via Clerk membership', async () => {
    mockedHeaders.mockResolvedValue(
      new Headers({
        Authorization: 'Bearer valid-token',
        'x-organization-id': ORG_UUID,
        'x-user-id': 'user_test_123',
      })
    );
    mockVerifyClerkBearerToken.mockResolvedValue({
      userId: 'user_test_123',
    });
    mockGetClerkOrganizationMembership.mockResolvedValue({
      clerkOrgId: 'org_test_123',
      role: 'org:member',
    });

    const context = await getServiceContext();

    expect(mockGetClerkOrganizationMembership).toHaveBeenCalledWith(
      'user_test_123',
      'org_test_123'
    );
    expect(context.organizationId).toBe(ORG_UUID);
    expect(context.clerkOrganizationId).toBe('org_test_123');
  });

  it('rejects a requested header org when the verified user is not a member', async () => {
    mockedHeaders.mockResolvedValue(
      new Headers({
        Authorization: 'Bearer valid-token',
        'x-organization-id': ORG_UUID,
        'x-user-id': 'user_test_123',
      })
    );
    mockVerifyClerkBearerToken.mockResolvedValue({
      userId: 'user_test_123',
    });
    mockGetClerkOrganizationMembership.mockResolvedValue(null);

    await expect(getServiceContext()).rejects.toThrow(
      new AuthenticationError(
        'Authenticated user is not a member of the requested organization.'
      )
    );
  });

  it('returns null from optional context when the bearer token is invalid', async () => {
    mockedHeaders.mockResolvedValue(
      new Headers({
        Authorization: 'Bearer invalid-token',
      })
    );
    mockVerifyClerkBearerToken.mockRejectedValue(new Error('bad token'));

    await expect(getOptionalServiceContext()).resolves.toBeNull();
  });
});
