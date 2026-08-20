import { headers } from 'next/headers';
import {
  AuthenticationError,
  getOptionalServiceContext,
  getServiceContext,
  resetAuthCachesForTest,
} from './auth';

const mockFindOrganizationById = jest.fn();
const mockFindOrganizationByBetterAuthId = jest.fn();
const mockFindEntityByBetterAuthId = jest.fn();
const mockCreateUserEntity = jest.fn();
const mockWithOrganizationContext = jest.fn();
const mockBetterAuthGetSession = jest.fn();

jest.mock('next/headers', () => ({
  headers: jest.fn(),
}));

jest.mock('@glapi/api-service', () => ({
  PermissionService: jest.fn(),
}));

jest.mock('@glapi/auth', () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockBetterAuthGetSession(...args),
    },
  },
}));

jest.mock('@glapi/database', () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => ({
    findById: mockFindOrganizationById,
    findByBetterAuthId: mockFindOrganizationByBetterAuthId,
  })),
  AuthEntityRepository: jest.fn().mockImplementation(() => ({
    findByBetterAuthId: mockFindEntityByBetterAuthId,
    createUserEntity: mockCreateUserEntity,
  })),
  withOrganizationContext: (...args: unknown[]) => mockWithOrganizationContext(...args),
  PermissionRepository: jest.fn().mockImplementation(() => ({
    findEntityRoles: jest.fn().mockResolvedValue([]),
    findRoleByName: jest.fn().mockResolvedValue(null),
    assignRoleToEntity: jest.fn(),
  })),
}));

const mockedHeaders = headers as jest.MockedFunction<typeof headers>;

const ORG_UUID = '11111111-1111-1111-1111-111111111111';
const ENTITY_UUID = '22222222-2222-2222-2222-222222222222';
const SERVICE_ACTOR_UUID = '33333333-3333-3333-3333-333333333333';

describe('getServiceContext', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    resetAuthCachesForTest();
    process.env.NODE_ENV = 'production';
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    mockFindOrganizationById.mockReset();
    mockFindOrganizationByBetterAuthId.mockReset();
    mockFindEntityByBetterAuthId.mockReset();
    mockCreateUserEntity.mockReset();
    mockWithOrganizationContext.mockReset();
    mockBetterAuthGetSession.mockReset();

    mockFindOrganizationByBetterAuthId.mockResolvedValue(null);
    mockFindOrganizationById.mockResolvedValue({
      id: ORG_UUID,
      name: 'Adteco',
      betterAuthOrgId: 'ba_org_123',
    });
    mockFindEntityByBetterAuthId.mockResolvedValue({
      id: ENTITY_UUID,
    });
    mockCreateUserEntity.mockResolvedValue({
      id: ENTITY_UUID,
    });
    mockBetterAuthGetSession.mockResolvedValue({
      user: { id: 'ba_user_123' },
      session: { activeOrganizationId: 'ba_org_123' }
    });
    mockWithOrganizationContext.mockImplementation(
      async (_context: unknown, callback: (db: unknown) => Promise<unknown>) => callback({})
    );
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it('derives context from a verified Better Auth session', async () => {
    mockedHeaders.mockResolvedValue(
      new Headers({
        'cookie': 'better-auth.session_token=valid-token',
        'x-organization-id': ORG_UUID,
        'x-user-id': ENTITY_UUID,
      })
    );
    mockFindOrganizationByBetterAuthId.mockResolvedValue({
      id: ORG_UUID,
      name: 'Adteco',
      betterAuthOrgId: 'ba_org_123',
    });

    const context = await getServiceContext();

    expect(mockBetterAuthGetSession).toHaveBeenCalled();
    expect(context).toEqual({
      organizationId: ORG_UUID,
      organizationName: 'Adteco',
      entityId: ENTITY_UUID,
      betterAuthUserId: 'ba_user_123',
      betterAuthOrganizationId: 'ba_org_123',
      userId: ENTITY_UUID,
      role: 'user',
    });
  });

  it('rejects spoofed user headers that do not match the verified token', async () => {
    mockedHeaders.mockResolvedValue(
      new Headers({
        'cookie': 'better-auth.session_token=valid-token',
        'x-organization-id': ORG_UUID,
        'x-user-id': 'user_attacker_123',
      })
    );
    mockFindOrganizationByBetterAuthId.mockResolvedValue({
      id: ORG_UUID,
      name: 'Adteco',
      betterAuthOrgId: 'ba_org_123',
    });

    await expect(getServiceContext()).rejects.toThrow(
      new AuthenticationError('User header does not match authenticated token context.')
    );
  });

  it('preserves trusted API key context', async () => {
    mockedHeaders.mockResolvedValue(
      new Headers({
        'x-api-key-name': 'Integration Key',
        'x-organization-id': ORG_UUID,
        'x-user-id': SERVICE_ACTOR_UUID,
      })
    );

    const context = await getServiceContext();

    expect(mockBetterAuthGetSession).not.toHaveBeenCalled();
    expect(context.organizationId).toBe(ORG_UUID);
    expect(context.userId).toBe(SERVICE_ACTOR_UUID);
    expect(context.apiKeyName).toBe('Integration Key');
  });

  it('rejects unauthenticated production requests', async () => {
    mockedHeaders.mockResolvedValue(new Headers());
    mockBetterAuthGetSession.mockResolvedValue(null);

    await expect(getServiceContext()).rejects.toThrow(
      new AuthenticationError(
        'Authentication required. Provide a valid session or bearer token.'
      )
    );
  });

  it('returns null from optional context when session is missing', async () => {
    mockedHeaders.mockResolvedValue(new Headers());
    mockBetterAuthGetSession.mockResolvedValue(null);

    await expect(getOptionalServiceContext()).resolves.toBeNull();
  });

  it('fails closed in production when a verified user has no entity mapping', async () => {
    mockedHeaders.mockResolvedValue(
      new Headers({
        'cookie': 'better-auth.session_token=valid-token',
      })
    );
    mockFindOrganizationByBetterAuthId.mockResolvedValue({
      id: ORG_UUID,
      name: 'Adteco',
      betterAuthOrgId: 'ba_org_123',
    });
    mockFindEntityByBetterAuthId.mockResolvedValue(null);

    await expect(getServiceContext()).rejects.toThrow(
      new AuthenticationError(
        'No internal entity mapping exists for Better Auth user ba_user_123. Run `pnpm --filter @glapi/database reconcile:better-auth -- --write` before enabling production authentication.'
      )
    );
    expect(mockCreateUserEntity).not.toHaveBeenCalled();
  });

  it('still auto-provisions missing mappings outside production', async () => {
    process.env.NODE_ENV = 'development';
    mockedHeaders.mockResolvedValue(
      new Headers({
        'cookie': 'better-auth.session_token=valid-token',
      })
    );
    mockFindOrganizationByBetterAuthId.mockResolvedValue({
      id: ORG_UUID,
      name: 'Adteco',
      betterAuthOrgId: 'ba_org_123',
    });
    mockFindEntityByBetterAuthId.mockResolvedValue(null);
    mockCreateUserEntity.mockResolvedValueOnce({
      id: ENTITY_UUID,
    });

    const context = await getServiceContext();

    expect(mockCreateUserEntity).toHaveBeenCalledWith({
      betterAuthUserId: 'ba_user_123',
      email: 'ba_user_123@placeholder.local',
      name: 'User user_123',
      organizationId: ORG_UUID,
      role: 'user',
    });
    expect(context.entityId).toBe(ENTITY_UUID);
  });
});
