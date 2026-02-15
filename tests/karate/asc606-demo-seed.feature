Feature: Seed ASC-606 demo software scenarios

  Background:
    * assert orgId != null && orgId != ''

  Scenario: Seed and fetch a seeded scenario plan
    Given url baseUrl
    And path 'api', 'revenue', 'asc606', 'demo', 'seed'
    And request { forceRecalculate: true }
    When method post
    Then status 201
    And match response contains { demoTag: '#string', scenarios: '#[]' }
    * assert response.scenarios.length >= 4
    * def bundle = response.scenarios.find(x => x.subscriptionNumber == 'DEMO-ASC606-BUNDLE-DISCOUNT-SSP')
    * assert bundle != null

    Given url baseUrl
    And path 'api', 'revenue', 'asc606', 'subscriptions', bundle.subscriptionId, 'plan'
    When method get
    Then status 200
    And match response contains { allocations: '#[]', invoiceSchedule: '#[]', waterfall: '#[]', schedules: '#[]' }
    * assert response.allocations.length > 0
    * assert response.invoiceSchedule.length > 0

