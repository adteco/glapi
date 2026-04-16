Feature: Admin context authentication for billing endpoints
  Validates that Better Auth admin sessions can access billing and admin-only routes.
  The requireAdminContext() function must support Better Auth sessions, not just Clerk.

  Background:
    # Clear global API key/org headers -- these tests use cookie-only auth
    * configure headers = { 'Content-Type': 'application/json', 'Origin': '#(baseUrl)' }
    * def signInUrl = baseUrl + '/api/auth/sign-in/email'
    * def setActiveOrgUrl = baseUrl + '/api/auth/organization/set-active'

  Scenario: Better Auth admin can access billing connect status
    # Sign in as admin
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

    # Access billing endpoint with cookie only
    Given url baseUrl + '/api/billing/connect/status'
    And cookie better-auth.session_token = sessionToken
    When method get
    # This should succeed for an admin user
    # 200 = success, 404 = Stripe not configured, 500/503 = Stripe error -- all acceptable
    Then assert responseStatus != 401 && responseStatus != 403

  Scenario: Better Auth admin can access setup-intent endpoint
    # Sign in as admin
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

    # Access billing setup-intent with cookie only
    Given url baseUrl + '/api/billing/setup-intent'
    And cookie better-auth.session_token = sessionToken
    When method post
    # Should not get 401 (auth failure) -- 400/404/500/503 acceptable if Stripe not configured
    Then assert responseStatus != 401 && responseStatus != 403

  Scenario: API key auth does not work on billing endpoints (admin-only routes require bearer/session auth)
    * configure headers = { 'Content-Type': 'application/json', 'x-organization-id': '#(orgId)', 'x-user-id': '#(userId)', 'x-api-key': '#(apiKey)' }
    Given url baseUrl + '/api/billing/connect/status'
    When method get
    # Billing routes require admin auth (bearer token or session cookie) -- API keys don't provide this
    Then status 401
