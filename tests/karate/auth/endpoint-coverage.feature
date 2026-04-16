Feature: Cross-domain endpoint auth coverage with Better Auth
  Parameterized test to verify Better Auth session authentication
  works across all major tRPC namespaces.

  Background:
    * def signInUrl = baseUrl + '/api/auth/sign-in/email'
    * def setActiveOrgUrl = baseUrl + '/api/auth/organization/set-active'
    * def trpcUrl = baseUrl + '/api/trpc/'

    # Sign in once and set org for all scenarios
    * def signInResult = call read('classpath:helpers/better-auth-login.feature')
    * def sessionToken = signInResult.sessionToken

  Scenario Outline: <namespace>.list returns 200 with Better Auth cookie
    * configure headers = { 'Content-Type': 'application/json' }
    Given url trpcUrl + '<namespace>.list'
    And cookie better-auth.session_token = sessionToken
    And param batch = 1
    And param input = '{"0":{"json":{}}}'
    When method get
    Then status 200
    And match response[0].result != null

    Examples:
      | namespace      |
      | customers      |
      | vendors        |
      | accounts       |
      | items          |
      | departments    |
      | locations      |
      | subsidiaries   |
      | workflows      |
      | employees      |

  Scenario Outline: <namespace>.list returns 401 without auth
    * configure headers = { 'Content-Type': 'application/json' }
    Given url trpcUrl + '<namespace>.list'
    And param batch = 1
    And param input = '{"0":{"json":{}}}'
    When method get
    Then status 401

    Examples:
      | namespace      |
      | customers      |
      | vendors        |
      | accounts       |
      | invoices       |
