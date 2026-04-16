@ignore
Feature: Better Auth Login Helper
  Reusable login feature that creates a Better Auth session and returns the session cookie.
  Called by other features via: * def session = call read('classpath:helpers/better-auth-login.feature')

  Scenario: Sign in with Better Auth and set active organization
    # Clear global API key headers -- use cookie-only auth
    * configure headers = { 'Content-Type': 'application/json', 'Origin': '#(baseUrl)' }

    # Step 1: Sign in to get session cookie
    Given url baseUrl + '/api/auth/sign-in/email'
    And request { "email": "#(betterAuthEmail)", "password": "#(betterAuthPassword)" }
    When method post
    Then status 200
    * def sessionCookie = responseCookies['better-auth.session_token']
    * assert sessionCookie != null
    * def sessionToken = sessionCookie.value

    # Step 2: Set active organization
    Given url baseUrl + '/api/auth/organization/set-active'
    And cookie better-auth.session_token = sessionToken
    And request { "organizationId": "#(betterAuthOrgId)" }
    When method post
    Then status 200
