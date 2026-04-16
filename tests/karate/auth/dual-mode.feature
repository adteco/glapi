Feature: Dual mode authentication verification
  Validates that both Better Auth and API key auth work simultaneously
  when AUTH_PROVIDER_MODE=dual is set on the API server.

  Background:
    # Clear global headers for clean dual-mode testing
    * configure headers = { 'Content-Type': 'application/json', 'Origin': '#(baseUrl)' }
    * def signInUrl = baseUrl + '/api/auth/sign-in/email'
    * def setActiveOrgUrl = baseUrl + '/api/auth/organization/set-active'
    * def trpcUrl = baseUrl + '/api/trpc/'

  Scenario: Better Auth session works in dual mode
    # Sign in with Better Auth
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

    # Access tRPC endpoint with Better Auth session only
    Given url trpcUrl + 'customers.list'
    And cookie better-auth.session_token = sessionToken
    And param batch = 1
    And param input = '{"0":{"json":{}}}'
    When method get
    Then status 200

  Scenario: API key auth still works in dual mode
    * configure headers = { 'Content-Type': 'application/json', 'x-organization-id': '#(orgId)', 'x-user-id': '#(userId)', 'x-api-key': '#(apiKey)' }
    Given url trpcUrl + 'customers.list'
    And param batch = 1
    And param input = '{"0":{"json":{}}}'
    When method get
    Then status 200

  Scenario: Header-based auth still works in dual mode
    * configure headers = { 'Content-Type': 'application/json', 'x-organization-id': '#(orgId)', 'x-user-id': '#(userId)' }
    Given url trpcUrl + 'workflows.list'
    And param batch = 1
    And param input = '{"0":{"json":{}}}'
    When method get
    Then status 200
