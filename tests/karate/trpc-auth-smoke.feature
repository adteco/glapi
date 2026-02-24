Feature: tRPC auth-context smoke checks

  Background:
    * def workflowsUrl = baseUrl + '/api/trpc/workflows.list'
    * def workflowsInput = '{"0":{"json":{}}}'
    * def analyticsUrl = baseUrl + '/api/trpc/projectAnalytics.getBacklogByCustomer,projectAnalytics.getUnbilledTimeByCustomer,projectAnalytics.getUnfulfilledSalesOrdersByCustomer'
    * def analyticsInput = '{"0":{"json":null,"meta":{"values":["undefined"]}},"1":{"json":null,"meta":{"values":["undefined"]}},"2":{"json":null,"meta":{"values":["undefined"]}}}'
    * def authHeaders =
      """
      {
        "Content-Type": "application/json",
        "x-organization-id": "#(orgId)",
        "x-user-id": "#(userId)"
      }
      """

  Scenario: workflows.list returns 401 without org/user headers
    * configure headers = { 'Content-Type': 'application/json' }
    Given url workflowsUrl
    And param batch = 1
    And param input = workflowsInput
    When method get
    Then status 401
    And match response[0].error.json.data.code == 'UNAUTHORIZED'
    And match response[0].error.json.data.path == 'workflows.list'

  Scenario: workflows.list succeeds with org/user headers
    * configure headers = authHeaders
    Given url workflowsUrl
    And param batch = 1
    And param input = workflowsInput
    When method get
    Then status 200
    And match response[0].result.data.json == '#[]'

  Scenario: project analytics batch returns 401 without org/user headers
    * configure headers = { 'Content-Type': 'application/json' }
    Given url analyticsUrl
    And param batch = 1
    And param input = analyticsInput
    When method get
    Then status 401
    And match response == '#[3]'
    And match response[0].error.json.data.code == 'UNAUTHORIZED'
    And match response[1].error.json.data.code == 'UNAUTHORIZED'
    And match response[2].error.json.data.code == 'UNAUTHORIZED'

  Scenario: project analytics batch succeeds with org/user headers
    * configure headers = authHeaders
    Given url analyticsUrl
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
