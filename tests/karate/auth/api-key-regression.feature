Feature: API key authentication regression guard
  Ensures that existing API key authentication continues to work
  after Better Auth integration changes. These tests should ALWAYS pass.

  Background:
    * def authHeaders =
      """
      {
        "Content-Type": "application/json",
        "x-organization-id": "#(orgId)",
        "x-user-id": "#(userId)",
        "x-api-key": "#(apiKey)"
      }
      """

  Scenario: API key auth succeeds for tRPC customers.list
    * configure headers = authHeaders
    Given url baseUrl + '/api/trpc/customers.list'
    And param batch = 1
    And param input = '{"0":{"json":{}}}'
    When method get
    Then status 200
    And match response[0].result.data.json == '#[]'

  Scenario: API key auth succeeds for tRPC workflows.list
    * configure headers = authHeaders
    Given url baseUrl + '/api/trpc/workflows.list'
    And param batch = 1
    And param input = '{"0":{"json":{}}}'
    When method get
    Then status 200

  Scenario: API key auth succeeds for tRPC accounts.list
    * configure headers = authHeaders
    Given url baseUrl + '/api/trpc/accounts.list'
    And param batch = 1
    And param input = '{"0":{"json":{}}}'
    When method get
    Then status 200

  Scenario: Invalid API key returns 401
    * configure headers = { 'Content-Type': 'application/json', 'x-api-key': 'invalid_key_12345' }
    Given url baseUrl + '/api/trpc/customers.list'
    And param batch = 1
    And param input = '{"0":{"json":{}}}'
    When method get
    Then status 401

  Scenario: No auth at all returns 401
    * configure headers = { 'Content-Type': 'application/json' }
    Given url baseUrl + '/api/trpc/customers.list'
    And param batch = 1
    And param input = '{"0":{"json":{}}}'
    When method get
    Then status 401
