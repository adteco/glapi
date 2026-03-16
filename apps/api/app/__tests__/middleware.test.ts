import { normalizeApiRequestHeaders } from '../../middleware';

describe('normalizeApiRequestHeaders', () => {
  it('preserves requested organization headers for bearer-authenticated requests while stripping user identity headers', () => {
    const { requestHeaders, authSource, invalidApiKey } = normalizeApiRequestHeaders(
      new Headers({
        Authorization: 'Bearer valid-token',
        'x-organization-id': 'org_test_123',
        'x-user-id': 'user_test_123',
        'x-clerk-organization-id': 'org_test_123',
        'x-clerk-user-id': 'user_test_123',
      }),
      { isProduction: true }
    );

    expect(authSource).toBe('bearer_token');
    expect(invalidApiKey).toBe(false);
    expect(requestHeaders.get('x-organization-id')).toBe('org_test_123');
    expect(requestHeaders.get('x-user-id')).toBeNull();
    expect(requestHeaders.get('x-clerk-organization-id')).toBeNull();
    expect(requestHeaders.get('x-clerk-user-id')).toBeNull();
  });

  it('strips browser-supplied org and user headers from unauthenticated production requests', () => {
    const { requestHeaders, authSource, invalidApiKey } = normalizeApiRequestHeaders(
      new Headers({
        'x-organization-id': 'org_test_123',
        'x-user-id': 'user_test_123',
      }),
      { isProduction: true }
    );

    expect(authSource).toBe('none');
    expect(invalidApiKey).toBe(false);
    expect(requestHeaders.get('x-organization-id')).toBeNull();
    expect(requestHeaders.get('x-user-id')).toBeNull();
  });

  it('injects trusted org and user context for valid API keys', () => {
    const { requestHeaders, authSource, invalidApiKey } = normalizeApiRequestHeaders(
      new Headers({
        'x-api-key': 'test-key',
      }),
      {
        isProduction: true,
        validApiKeys: {
          'test-key': {
            organizationId: 'org_uuid',
            actorEntityId: 'entity_uuid',
            name: 'Test Key',
            scopes: ['read'],
          },
        },
      }
    );

    expect(authSource).toBe('api_key');
    expect(invalidApiKey).toBe(false);
    expect(requestHeaders.get('x-organization-id')).toBe('org_uuid');
    expect(requestHeaders.get('x-user-id')).toBe('entity_uuid');
    expect(requestHeaders.get('x-api-key-name')).toBe('Test Key');
  });
});
