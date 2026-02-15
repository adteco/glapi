Feature: ASC-606 Revenue flow via API

  Background:
    * def unique = java.util.UUID.randomUUID() + ''
    * def startDate = '2026-01-01'
    * def endDate = '2026-12-31'
    * assert subsidiaryId != null && subsidiaryId != ''
    * assert customerId != null && customerId != ''
    * assert itemId != null && itemId != ''

  Scenario: Create sales order, generate plan, and recalculate on license changes
    Given url baseUrl
    And path 'api', 'revenue', 'asc606', 'sales-orders'
    And request
      """
      {
        "order": {
          "subsidiaryId": "#(subsidiaryId)",
          "entityId": "#(customerId)",
          "orderDate": "#(startDate)",
          "currencyCode": "USD",
          "lines": [
            {
              "itemId": "#(itemId)",
              "description": "Software License Seats",
              "quantity": 10,
              "unitPrice": 120,
              "revenueBehavior": "over_time",
              "sspAmount": 130,
              "listPrice": 120,
              "metadata": {
                "serviceStartDate": "#(startDate)",
                "serviceEndDate": "#(endDate)",
                "revenueBehavior": "over_time",
                "sspAmount": 130,
                "listPrice": 120
              }
            }
          ]
        },
        "revenuePlan": {
          "billingFrequency": "monthly",
          "termMonths": 12,
          "autoActivateSubscription": true,
          "recognitionEffectiveDate": "#(startDate)"
        }
      }
      """
    When method post
    Then status 201
    And match response contains deep { order: { id: '#string' }, subscription: { id: '#string' }, plan: { summary: '#object', obligations: '#[]', schedules: '#[]', waterfall: '#[]' } }
    * assert response.plan.obligations.length > 0
    * assert response.plan.schedules.length > 0
    * assert response.plan.waterfall.length > 0
    * def subscriptionId = response.subscription.id

    Given url baseUrl
    And path 'api', 'revenue', 'asc606', 'subscriptions', subscriptionId, 'license-changes', 'preview'
    And request
      """
      {
        "itemId": "#(itemId)",
        "action": "add",
        "quantity": 5,
        "unitPrice": 120,
        "effectiveDate": "2026-04-01",
        "reason": "Upsell 5 seats"
      }
      """
    When method post
    Then status 200
    And match response contains { baseline: '#object', scenario: '#object', delta: { transactionPrice: '#number' } }
    * assert response.delta.transactionPrice > 0

    Given url baseUrl
    And path 'api', 'revenue', 'asc606', 'subscriptions', subscriptionId, 'license-changes', 'apply'
    And request
      """
      {
        "itemId": "#(itemId)",
        "action": "add",
        "quantity": 5,
        "unitPrice": 120,
        "effectiveDate": "2026-04-01",
        "reason": "Upsell 5 seats"
      }
      """
    When method post
    Then status 200
    And match response contains deep { subscription: { id: '#(subscriptionId)' }, calculation: '#object', plan: '#object' }
    * def afterAddScheduled = response.plan.summary.totalScheduled

    Given url baseUrl
    And path 'api', 'revenue', 'asc606', 'subscriptions', subscriptionId, 'license-changes', 'preview'
    And request
      """
      {
        "itemId": "#(itemId)",
        "action": "remove",
        "quantity": 2,
        "effectiveDate": "2026-07-01",
        "reason": "Seat reduction"
      }
      """
    When method post
    Then status 200
    And match response.delta contains { transactionPrice: '#number' }
    * assert response.delta.transactionPrice < 0

    Given url baseUrl
    And path 'api', 'revenue', 'asc606', 'subscriptions', subscriptionId, 'license-changes', 'apply'
    And request
      """
      {
        "itemId": "#(itemId)",
        "action": "remove",
        "quantity": 2,
        "effectiveDate": "2026-07-01",
        "reason": "Seat reduction"
      }
      """
    When method post
    Then status 200
    * def afterRemoveScheduled = response.plan.summary.totalScheduled
    * assert afterAddScheduled >= afterRemoveScheduled

    Given url baseUrl
    And path 'api', 'revenue', 'asc606', 'subscriptions', subscriptionId, 'plan'
    And param startDate = startDate
    And param endDate = endDate
    When method get
    Then status 200
    And match response contains deep { subscription: { id: '#(subscriptionId)' }, summary: '#object', obligations: '#[]', schedules: '#[]', waterfall: '#[]' }
    * assert response.schedules.length > 0
    * assert response.waterfall.length > 0
