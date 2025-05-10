# Multi-Element Arrangement Example

## Human-Friendly Explanation

### The Problem

A technology company sells a complex solution to a customer that includes multiple elements:

1. Software license ($200,000)
2. Cloud hosting for 3 years ($150,000)
3. Implementation services ($100,000)
4. Professional services hours ($50,000)
5. Training credits ($25,000)

Each element has different delivery timelines and recognition patterns:
- Software license is delivered immediately
- Cloud hosting is provided over 36 months
- Implementation will take 3 months
- Professional services will be used on-demand
- Training credits expire after 12 months

The total contract value is $525,000, but the company offered a 10% bundle discount, making the actual contract value $472,500.

The accounting challenge: How do we properly allocate the transaction price across these different elements and recognize revenue according to their individual patterns?

### The Solution

Our system handles this complex scenario through:

1. **SSP Identification**: Determine standalone selling price for each element
2. **Discount Allocation**: Allocate the discount proportionally across all elements
3. **Performance Obligation Definition**: Create separate performance obligations for each element
4. **Recognition Schedule Creation**: Generate appropriate recognition schedules based on the nature of each obligation
5. **Waterfall Reporting**: Provide transparent reporting of how the contract value flows to recognized revenue

For this example, the system would:
- Calculate the SSP percentage for each element (e.g., software license = 38% of total SSP)
- Allocate the discounted transaction price based on these percentages
- Create individual recognition schedules (point-in-time for license, over-time for cloud hosting, etc.)
- Track fulfillment of each obligation independently

## Technical Implementation

### Data Flow

1. **Contract Creation with Multiple Elements**

```typescript
interface CreateMultiElementContractRequest {
  contractNumber: string;
  customerId: string;
  contractDate: string; // ISO 8601
  effectiveDate: string; // ISO 8601
  expirationDate: string; // ISO 8601
  totalListPrice: number; // $525,000 in our example
  contractValue: number; // $472,500 after discount
  lineItems: {
    productId: string;
    description: string;
    quantity: number;
    listPrice: number;
    totalPrice: number;
    ssp: number; // Standalone Selling Price
  }[];
  sspAllocationMethod: 'proportional';
}
```

2. **SSP Allocation Process**

```typescript
function allocateTransactionPrice(
  contractValue: number, 
  lineItems: LineItem[]
): AllocationResult {
  // Calculate total SSP
  const totalSSP = lineItems.reduce((sum, item) => sum + item.ssp, 0);
  
  // Calculate allocation percentages
  const allocations = lineItems.map(item => {
    const percentage = item.ssp / totalSSP;
    // Apply percentage to contract value
    const allocatedAmount = contractValue * percentage;
    
    return {
      lineItemId: item.id,
      sspPercentage: percentage,
      allocatedAmount,
      // Calculate effective discount
      effectiveDiscount: item.totalPrice - allocatedAmount
    };
  });
  
  return {
    totalAllocated: allocations.reduce((sum, a) => sum + a.allocatedAmount, 0),
    allocations
  };
}
```

3. **Performance Obligation Creation**

```typescript
// Simplified code for creating different types of obligations
function createPerformanceObligations(
  contract: Contract, 
  lineItems: LineItem[], 
  allocations: Allocation[]
): PerformanceObligation[] {
  return lineItems.map((item, index) => {
    const product = getProduct(item.productId);
    const allocation = allocations.find(a => a.lineItemId === item.id);
    
    // Determine obligation type based on product type
    let obligationType, startDate, endDate, recognitionPattern;
    
    switch (product.type) {
      case 'software_license':
        obligationType = 'point_in_time';
        startDate = contract.effectiveDate;
        endDate = contract.effectiveDate; // Same day for point-in-time
        recognitionPattern = 'immediate';
        break;
        
      case 'saas_subscription':
        obligationType = 'over_time';
        startDate = contract.effectiveDate;
        endDate = contract.expirationDate;
        recognitionPattern = 'straight_line';
        break;
        
      case 'professional_services':
        if (product.recognitionType === 'over_time') {
          obligationType = 'over_time';
          startDate = contract.effectiveDate;
          // Implementation estimated to take 3 months
          endDate = addMonths(contract.effectiveDate, 3);
          recognitionPattern = 'input_method'; // Based on hours/effort
        } else {
          obligationType = 'as_delivered';
          startDate = contract.effectiveDate;
          endDate = contract.expirationDate;
          recognitionPattern = 'as_consumed';
        }
        break;
        
      case 'training':
        obligationType = 'over_time';
        startDate = contract.effectiveDate;
        // Training credits valid for 12 months
        endDate = addMonths(contract.effectiveDate, 12);
        recognitionPattern = 'as_consumed';
        break;
    }
    
    return {
      contractId: contract.id,
      description: `${product.name} - ${item.description}`,
      obligationType,
      allocatedPrice: allocation.allocatedAmount,
      startDate,
      endDate,
      recognitionPattern,
      // Other fields omitted for brevity
    };
  });
}
```

4. **Revenue Schedule Generation**

```typescript
// Generate different schedule types based on obligation type
function generateRevenueSchedules(obligations: PerformanceObligation[]): RevenueSchedule[] {
  let schedules = [];
  
  for (const obligation of obligations) {
    switch (obligation.recognitionPattern) {
      case 'immediate':
        // Point-in-time recognition (e.g., license)
        schedules.push({
          performanceObligationId: obligation.id,
          scheduleDate: obligation.startDate,
          scheduledAmount: obligation.allocatedPrice,
          recognitionType: 'point_in_time'
        });
        break;
        
      case 'straight_line':
        // Ratable recognition (e.g., SaaS subscription)
        const months = getMonthsBetween(obligation.startDate, obligation.endDate);
        const monthlyAmount = obligation.allocatedPrice / months;
        
        for (let i = 0; i < months; i++) {
          schedules.push({
            performanceObligationId: obligation.id,
            scheduleDate: addMonths(obligation.startDate, i),
            scheduledAmount: monthlyAmount,
            recognitionType: 'ratable'
          });
        }
        break;
        
      case 'input_method':
        // Based on estimated effort (e.g., implementation)
        // This is simplified - real implementation would include milestones
        const implementationMonths = 3;
        const monthlyImplementation = obligation.allocatedPrice / implementationMonths;
        
        for (let i = 0; i < implementationMonths; i++) {
          schedules.push({
            performanceObligationId: obligation.id,
            scheduleDate: addMonths(obligation.startDate, i),
            scheduledAmount: monthlyImplementation,
            recognitionType: 'effort_based'
          });
        }
        break;
        
      case 'as_consumed':
        // For usage-based items (e.g., training, consulting hours)
        // Initially, no schedules are created - they'll be recognized as used
        // But we create a placeholder for the full amount at expiration
        schedules.push({
          performanceObligationId: obligation.id,
          scheduleDate: obligation.endDate,
          scheduledAmount: obligation.allocatedPrice,
          recognitionType: 'usage_based',
          isPlaceholder: true
        });
        break;
    }
  }
  
  return schedules;
}
```

### Database Operations

```sql
-- For a multi-element contract, we'd perform the following operations:

-- 1. Create the contract
INSERT INTO contracts (
  id, contract_number, customer_id, contract_date, effective_date, 
  expiration_date, contract_value, contract_status, ssp_allocation_method
) VALUES (...);

-- 2. Create line items for each element
INSERT INTO contract_line_items (
  id, contract_id, product_id, line_item_number, description,
  quantity, list_price, total_price, ssp
) VALUES 
  (...), -- Software license
  (...), -- Cloud hosting
  (...), -- Implementation
  (...), -- Professional services
  (...); -- Training

-- 3. Create SSP allocations
INSERT INTO contract_ssp_allocations (
  id, contract_id, line_item_id, allocated_amount, 
  allocation_method, allocation_percentage
) VALUES 
  (...), -- Software license (38% of total)
  (...), -- Cloud hosting (29% of total)
  (...), -- Implementation (19% of total)
  (...), -- Professional services (9% of total)
  (...); -- Training (5% of total)

-- 4. Create performance obligations for each element
INSERT INTO performance_obligations (
  id, contract_id, description, obligation_type, allocated_price,
  satisfaction_method, start_date, end_date
) VALUES 
  (...), -- Software license (point-in-time)
  (...), -- Cloud hosting (over-time)
  (...), -- Implementation (over-time/input method)
  (...), -- Professional services (as-delivered)
  (...); -- Training (over-time/usage-based)

-- 5. Create revenue schedules based on obligation types
-- For the software license (point-in-time):
INSERT INTO revenue_schedules (
  id, performance_obligation_id, schedule_date, scheduled_amount
) VALUES (
  uuid_generate_v4(),
  '{{software_license_obligation_id}}',
  '2023-01-01', -- Effective date
  179550 -- Allocated amount for software license (38% of $472,500)
);

-- For cloud hosting (monthly over 36 months):
-- This would be a loop in application code
INSERT INTO revenue_schedules (
  id, performance_obligation_id, schedule_date, scheduled_amount
) 
SELECT 
  uuid_generate_v4(),
  '{{cloud_hosting_obligation_id}}',
  date_trunc('month', '2023-01-01'::date) + (n || ' months')::interval,
  137025 / 36 -- Allocated amount for hosting ÷ 36 months
FROM generate_series(0, 35) n;

-- Similar patterns for other obligation types
```

### User Interface Representation

When displaying the multi-element contract, the system would show:

1. **Contract Summary View**:
   - Total contract value: $472,500
   - Original list price: $525,000
   - Discount: $52,500 (10%)
   - Term: 36 months
   - Status: Active

2. **Line Items View**:
   - Each line item with original price, SSP, and allocated amount
   - Visual indication of discount allocation across items

3. **Revenue Recognition Schedule**:
   - Month-by-month forecast of revenue to be recognized
   - Ability to filter by product/line item
   - Cumulative recognition shown vs. total contract value

4. **Waterfall Report**:
   - Shows movement from list price → discount → allocated price → recognized/deferred

## Accounting Treatment

This implementation follows ASC 606 / IFRS 15 principles:

1. **Identify contract**: Single contract with multiple performance obligations
2. **Identify performance obligations**: Each element represents a distinct obligation
3. **Determine transaction price**: $472,500 after discount
4. **Allocate transaction price**: Based on relative SSP percentages
5. **Recognize revenue**: As each obligation is satisfied according to its pattern

The system handles complex scenarios like:
- Discounted bundles with proper allocation
- Different recognition patterns for different elements
- Change in estimates for usage-based items
- Proper deferral of revenue until obligations are satisfied