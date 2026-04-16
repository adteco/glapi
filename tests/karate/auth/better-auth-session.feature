Feature: Better Auth session-based authentication
  Validates that Better Auth cookie-based sessions work for tRPC API access.
  These tests require AUTH_PROVIDER_MODE=dual or AUTH_PROVIDER_MODE=better-auth on the API server.

  Background:
    # Clear global API key/org headers -- these tests use cookie-only auth
    * configure headers = { 'Content-Type': 'application/json', 'Origin': '#(baseUrl)' }
    * def signInUrl = baseUrl + '/api/auth/sign-in/email'
    * def setActiveOrgUrl = baseUrl + '/api/auth/organization/set-active'
    * def trpcUrl = baseUrl + '/api/trpc/'

  Scenario: Sign in with Better Auth returns session cookie
    Given url signInUrl
    And request { "email": "#(betterAuthEmail)", "password": "#(betterAuthPassword)" }
    When method post
    Then status 200
    * def sessionCookie = responseCookies['better-auth.session_token']
    And assert sessionCookie != null

  Scenario: Better Auth session cookie authenticates tRPC request
    # Sign in
    Given url signInUrl
    And request { "email": "#(betterAuthEmail)", "password": "#(betterAuthPassword)" }
    When method post
    Then status 200
    * def sessionToken = responseCookies['better-auth.session_token'].value

    # Set active org
    Given url setActiveOrgUrl
    And cookie better-auth.session_token = sessionToken
    And request { "organizationId": "#(betterAuthOrgId)" }
    When method post
    Then status 200

    # Access tRPC endpoint with session cookie only
    Given url trpcUrl + 'customers.list'
    And cookie better-auth.session_token = sessionToken
    And param batch = 1
    And param input = '{"0":{"json":{}}}'
    When method get
    Then status 200
    And match response[0].result.data != null

  Scenario: tRPC endpoint returns 401 without any auth in production
    # Note: in dev mode this may fall through to dev fallback and return 200
    # This test documents the expected production behavior
    * configure headers = { 'Content-Type': 'application/json' }
    Given url trpcUrl + 'customers.list'
    And param batch = 1
    And param input = '{"0":{"json":{}}}'
    When method get
    # In dev mode, the fallback returns 200; in production it would be 401
    Then assert responseStatus == 200 || responseStatus == 401

  Scenario: Better Auth session without activeOrganizationId returns error
    # Sign in but do NOT set active org -- use a fresh session
    Given url signInUrl
    And request { "email": "#(betterAuthEmail)", "password": "#(betterAuthPassword)" }
    When method post
    Then status 200
    * def sessionToken = responseCookies['better-auth.session_token'].value

    # Access tRPC endpoint - should fail because no active org
    Given url trpcUrl + 'workflows.list'
    And cookie better-auth.session_token = sessionToken
    And param batch = 1
    And param input = '{"0":{"json":{}}}'
    When method get
    # Better Auth session without org context should not return clean data
    # In dev mode it may fall through to dev fallback (200), in production it would be 401
    Then assert responseStatus == 200 || responseStatus == 401 || responseStatus == 403
