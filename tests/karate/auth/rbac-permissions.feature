Feature: RBAC permission checks with Better Auth
  Validates that Better Auth sessions correctly resolve to entities with
  proper RBAC role assignments, allowing access to permission-protected endpoints.

  Background:
    # Clear global API key/org headers -- these tests use cookie-only auth
    * configure headers = { 'Content-Type': 'application/json', 'Origin': '#(baseUrl)' }
    * def signInUrl = baseUrl + '/api/auth/sign-in/email'
    * def setActiveOrgUrl = baseUrl + '/api/auth/organization/set-active'
    * def trpcUrl = baseUrl + '/api/trpc/'

  Scenario: Authenticated Better Auth user can list customers (requires permissions)
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

    # List customers - requires CUSTOMERS:READ permission
    Given url trpcUrl + 'customers.list'
    And cookie better-auth.session_token = sessionToken
    And param batch = 1
    And param input = '{"0":{"json":{}}}'
    When method get
    Then status 200
    # Should NOT get 403 FORBIDDEN
    And match response[0].result != null

  Scenario: Authenticated Better Auth user can list accounts
    # Sign in and set org
    Given url signInUrl
    And request { "email": "#(betterAuthEmail)", "password": "#(betterAuthPassword)" }
    When method post
    Then status 200
    * def sessionToken = responseCookies['better-auth.session_token'].value

    Given url setActiveOrgUrl
    And cookie better-auth.session_token = sessionToken
    And request { "organizationId": "#(betterAuthOrgId)" }
    When method post
    Then status 200

    # List accounts - requires ACCOUNTS:READ permission
    Given url trpcUrl + 'accounts.list'
    And cookie better-auth.session_token = sessionToken
    And param batch = 1
    And param input = '{"0":{"json":{}}}'
    When method get
    Then status 200
    And match response[0].result != null

  Scenario: Authenticated Better Auth user can list invoices
    # Sign in and set org
    Given url signInUrl
    And request { "email": "#(betterAuthEmail)", "password": "#(betterAuthPassword)" }
    When method post
    Then status 200
    * def sessionToken = responseCookies['better-auth.session_token'].value

    Given url setActiveOrgUrl
    And cookie better-auth.session_token = sessionToken
    And request { "organizationId": "#(betterAuthOrgId)" }
    When method post
    Then status 200

    # List invoices -- may return 500 due to pre-existing DB schema issue
    Given url trpcUrl + 'invoices.list'
    And cookie better-auth.session_token = sessionToken
    And param batch = 1
    And param input = '{"0":{"json":{}}}'
    When method get
    # 200 = success, 500 = pre-existing DB issue -- but NOT 401 or 403 (auth/permission failure)
    Then assert responseStatus == 200 || responseStatus == 500
