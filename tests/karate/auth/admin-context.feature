Feature: Admin context authentication for billing endpoints
  Validates that Better Auth admin sessions can access billing and admin-only routes.
  The requireAdminContext() function must support Better Auth sessions, not just Clerk.

  Background:
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

    # Access billing endpoint
    * configure headers = { 'Content-Type': 'application/json' }
    Given url baseUrl + '/api/billing/connect/status'
    And cookie better-auth.session_token = sessionToken
    And header x-organization-id = orgId
    When method get
    # This should succeed for an admin user
    Then assert responseStatus == 200 || responseStatus == 404
    # 404 is acceptable if Stripe is not configured, but NOT 401 or 403

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

    # Access billing setup-intent
    * configure headers = { 'Content-Type': 'application/json' }
    Given url baseUrl + '/api/billing/setup-intent'
    And cookie better-auth.session_token = sessionToken
    And header x-organization-id = orgId
    When method post
    # Should not get 401 (auth failure) -- 400/404/500 acceptable if Stripe not configured
    Then assert responseStatus != 401 && responseStatus != 403

  Scenario: API key auth still works on billing endpoints (regression guard)
    * def authHeaders =
      """
      {
        "Content-Type": "application/json",
        "x-organization-id": "#(orgId)",
        "x-user-id": "#(userId)",
        "x-api-key": "#(apiKey)"
      }
      """
    * configure headers = authHeaders
    Given url baseUrl + '/api/billing/connect/status'
    When method get
    # API key auth should still work -- 200 or 404 (no Stripe) but NOT 401
    Then assert responseStatus != 401
