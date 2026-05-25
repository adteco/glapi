Feature: tRPC auth-context smoke checks
  Production-safe smoke checks that exercise the auth wall.

  Positive scenarios authenticate via Better Auth session cookie (no shared API
  key in CI). Negative scenarios assert that unauthenticated requests are
  rejected. Requires BETTER_AUTH_TEST_EMAIL / BETTER_AUTH_TEST_PASSWORD /
  BETTER_AUTH_TEST_ORG_ID provisioned in the target environment.

  Background:
    * def workflowsUrl = baseUrl + '/api/trpc/workflows.list'
    * def workflowsInput = '{"0":{"json":{}}}'
    * def analyticsUrl = baseUrl + '/api/trpc/projectAnalytics.getBacklogByCustomer,projectAnalytics.getUnbilledTimeByCustomer,projectAnalytics.getUnfulfilledSalesOrdersByCustomer'
    * def analyticsInput = '{"0":{"json":null,"meta":{"values":["undefined"]}},"1":{"json":null,"meta":{"values":["undefined"]}},"2":{"json":null,"meta":{"values":["undefined"]}}}'
    * def signInUrl = baseUrl + '/api/auth/sign-in/email'
    * def setActiveOrgUrl = baseUrl + '/api/auth/organization/set-active'
    * def noAuthHeaders = { 'Content-Type': 'application/json' }
    * def sessionHeaders = { 'Content-Type': 'application/json', 'Origin': '#(baseUrl)' }

  Scenario: workflows.list returns 401 without auth
    * configure headers = noAuthHeaders
    Given url workflowsUrl
    And param batch = 1
    And param input = workflowsInput
    When method get
    Then status 401
    And match response[0].error.json.data.code == 'UNAUTHORIZED'
    And match response[0].error.json.data.path == 'workflows.list'

  Scenario: workflows.list succeeds with Better Auth session
    * configure headers = sessionHeaders
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

    Given url workflowsUrl
    And cookie better-auth.session_token = sessionToken
    And param batch = 1
    And param input = workflowsInput
    When method get
    Then status 200
    And match response[0].result.data.json == '#[]'

  Scenario: project analytics batch returns 401 without auth
    * configure headers = noAuthHeaders
    Given url analyticsUrl
    And param batch = 1
    And param input = analyticsInput
    When method get
    Then status 401
    And match response == '#[3]'
    And match response[0].error.json.data.code == 'UNAUTHORIZED'
    And match response[1].error.json.data.code == 'UNAUTHORIZED'
    And match response[2].error.json.data.code == 'UNAUTHORIZED'

  Scenario: project analytics batch succeeds with Better Auth session
    * configure headers = sessionHeaders
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

    Given url analyticsUrl
    And cookie better-auth.session_token = sessionToken
    And param batch = 1
    And param input = analyticsInput
    When method get
    Then status 200
    And match response == '#[3]'
    * def errorCount = response.filter(x => x.error).length
    And match errorCount == 0
    And match response[0].result.data == '#object'
    And match response[1].result.data == '#object'
    And match response[2].result.data == '#object'
