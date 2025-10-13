# TASK-004: Kit/Bundle Components Database Schema

## Description
Create database schema and repository for managing kit/bundle items that need to be exploded into separate performance obligations for ASC 606 compliance.

## Acceptance Criteria
- [ ] Kit components table created for parent-child item relationships
- [ ] Proper allocation percentage and pricing logic
- [ ] Repository with kit explosion methods
- [ ] Support for both percentage and SSP-based allocations
- [ ] Unit tests for component allocation logic
- [ ] Integration tests with existing items
- [ ] Migration script tested

## Dependencies
- TASK-001: Subscription schema
- Items system (existing)

## Estimated Effort
1.5 days

## Technical Implementation

### Database Schema
```sql
-- kit_components table
CREATE TABLE kit_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  parent_item_id UUID NOT NULL REFERENCES items(id),
  component_item_id UUID NOT NULL REFERENCES items(id),
  quantity DECIMAL(10,4) DEFAULT 1,
  allocation_percentage DECIMAL(5,4), -- If specified allocation
  is_separately_priced BOOLEAN DEFAULT false,
  fixed_price DECIMAL(10,2), -- If separately priced
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_parent_component UNIQUE (parent_item_id, component_item_id),
  CONSTRAINT no_self_reference CHECK (parent_item_id != component_item_id),
  CONSTRAINT valid_allocation_percentage CHECK (
    allocation_percentage IS NULL OR 
    (allocation_percentage > 0 AND allocation_percentage <= 1)
  )
);

-- Create index for efficient kit lookup
CREATE INDEX idx_kit_components_parent ON kit_components(parent_item_id);
CREATE INDEX idx_kit_components_child ON kit_components(component_item_id);
```

### Repository Methods
```typescript
interface KitComponentRepository {
  // Core CRUD operations
  create(component: CreateKitComponent): Promise<KitComponent>;
  findByParentId(parentItemId: string): Promise<KitComponent[]>;
  findByComponentId(componentItemId: string): Promise<KitComponent[]>;
  
  // Business logic methods
  explodeKit(parentItemId: string, parentPrice: number): Promise<ExplodedComponent[]>;
  validateAllocations(parentItemId: string): Promise<ValidationResult>;
  calculateComponentPricing(components: KitComponent[], totalPrice: number): Promise<ComponentPricing[]>;
  
  // Hierarchy methods
  getKitHierarchy(itemId: string): Promise<KitHierarchy>;
  findCircularReferences(): Promise<CircularReference[]>;
}
```

### Test Requirements

#### Unit Tests
1. **Kit Component CRUD**
   - Test component creation with parent-child relationship
   - Test retrieval of all components for a kit
   - Test update of allocation percentages
   - Test deletion with validation

2. **Kit Explosion Logic**
   - Test percentage-based allocation
   - Test SSP-based allocation
   - Test mixed allocation methods
   - Test fixed price components
   - Test quantity multiplication

3. **Validation Tests**
   - Test allocation percentages sum to 100% (when specified)
   - Test circular reference detection
   - Test self-reference prevention
   - Test orphaned component detection

#### Integration Tests
1. **Item System Integration**
   - Test kit creation with existing items
   - Test component item lookups
   - Test item deletion cascade rules

2. **Subscription Integration**
   - Test subscription with kit items
   - Test performance obligation creation from exploded kits
   - Test revenue allocation calculations

### Business Rules to Test
1. **Allocation Logic**
   - If allocation percentage specified, use percentage
   - If separately priced, use fixed price
   - Otherwise, use SSP-based allocation
   - Handle mixed scenarios within same kit

2. **Validation Rules**
   - No circular references allowed
   - Sum of percentages cannot exceed 100%
   - Parent item cannot be its own component
   - Component must be active items

### Files to Create
- `packages/database/src/db/schema/kit-components.ts`
- `packages/database/src/repositories/kit-component-repository.ts`
- `packages/database/src/migrations/YYYY-MM-DD-create-kit-components.sql`
- `packages/database/src/repositories/__tests__/kit-component-repository.test.ts`
- `packages/business/src/services/kit-explosion-service.ts` (future task reference)

### Sample Test Scenarios
```typescript
describe('Kit Explosion Logic', () => {
  it('should explode kit using percentage allocation', async () => {
    // Given: Kit with $1000 price and components with percentages
    const components = [
      { componentId: 'comp1', allocationPercentage: 0.60 },
      { componentId: 'comp2', allocationPercentage: 0.40 }
    ];
    
    // When: Exploding kit
    const result = await repository.explodeKit('kit1', 1000);
    
    // Then: Components should have allocated prices
    expect(result[0].allocatedPrice).toBe(600);
    expect(result[1].allocatedPrice).toBe(400);
  });
  
  it('should explode kit using SSP allocation when no percentages', async () => {
    // Given: Kit with components having known SSP values
    // When: Exploding kit
    // Then: Should use proportional SSP allocation
  });
});
```

### Definition of Done
- [ ] Migration creates table with proper constraints
- [ ] Repository methods handle all allocation scenarios
- [ ] Circular reference detection works
- [ ] Validation logic prevents invalid configurations
- [ ] Tests cover edge cases (empty kits, single components)
- [ ] Performance tested with nested kits
- [ ] Integration with existing items verified