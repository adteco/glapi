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

  Scenario: Mid-term seat add updates schedules
    Given url baseUrl
    And path 'api', 'revenue', 'asc606', 'demo', 'seed'
    And request { forceRecalculate: true }
    When method post
    Then status 201
    * def monthly = response.scenarios.find(x => x.subscriptionNumber == 'DEMO-ASC606-BILLED-MONTHLY-12K')
    * assert monthly != null
    * def seatItemId = response.items.seat.id
    * match seatItemId == '#uuid'
    * print 'seatItemId=', seatItemId, 'subscriptionId=', monthly.subscriptionId

    Given url baseUrl
    And path 'api', 'revenue', 'asc606', 'subscriptions', monthly.subscriptionId, 'plan'
    When method get
    Then status 200
    * def baselinePlan = response
    * def baselineApr = (baselinePlan.waterfall.find(x => x.period == '2026-04') || { scheduled: 0 }).scheduled

    Given url baseUrl
    And path 'api', 'revenue', 'asc606', 'subscriptions', monthly.subscriptionId, 'license-changes', 'apply'
    And request { itemId: '#(seatItemId)', action: 'add', quantity: 10, unitPrice: 120, effectiveDate: '2026-04-01', reason: 'Karate add seats' }
    When method post
    Then status 200

    Given url baseUrl
    And path 'api', 'revenue', 'asc606', 'subscriptions', monthly.subscriptionId, 'plan'
    When method get
    Then status 200
    * def newPlan = response
    * def newApr = (newPlan.waterfall.find(x => x.period == '2026-04') || { scheduled: 0 }).scheduled
    * assert newPlan.summary.totalScheduled > baselinePlan.summary.totalScheduled
    * assert newApr > baselineApr
