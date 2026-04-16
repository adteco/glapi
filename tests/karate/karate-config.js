function fn() {
  function get(name) {
    return karate.properties[name] || java.lang.System.getenv(name);
  }

  var config = {
    baseUrl: get('KARATE_BASE_URL') || get('TEST_API_URL') || 'http://localhost:3031',
    orgId: get('KARATE_ORG_ID') || 'ba3b8cdf-efc1-4a60-88be-ac203d263fe2',
    userId: get('KARATE_USER_ID') || '00000000-0000-0000-0000-000000000001',
    apiKey: get('KARATE_API_KEY') || '',
    subsidiaryId: get('KARATE_SUBSIDIARY_ID') || 'd90771e4-e372-4089-a567-f2e5684c3427',
    customerId: get('KARATE_CUSTOMER_ID') || '26af6027-ba92-499f-870b-83ab62b746f6',
    itemId: get('KARATE_ITEM_ID') || '05d8aef8-9ddc-4afb-8a05-bb58f9f20c62',
    // Better Auth configuration
    authMode: get('KARATE_AUTH_MODE') || 'api-key', // 'api-key', 'better-auth', 'clerk'
    betterAuthEmail: get('KARATE_BETTER_AUTH_EMAIL') || get('BETTER_AUTH_TEST_EMAIL') || '',
    betterAuthPassword: get('KARATE_BETTER_AUTH_PASSWORD') || get('BETTER_AUTH_TEST_PASSWORD') || '',
    betterAuthOrgId: get('KARATE_BETTER_AUTH_ORG_ID') || get('BETTER_AUTH_TEST_ORG_ID') || '',
  };

  var headers = {
    'Content-Type': 'application/json',
  };

  // Build headers based on auth mode
  if (config.authMode === 'api-key' || config.authMode === 'header') {
    headers['x-organization-id'] = config.orgId;
    headers['x-user-id'] = config.userId;
    if (config.apiKey) {
      headers['x-api-key'] = config.apiKey;
    }
  }
  // For 'better-auth' mode, headers are set per-request with cookies
  // For 'clerk' mode, bearer token would be set per-request

  karate.configure('headers', headers);

  return config;
}
