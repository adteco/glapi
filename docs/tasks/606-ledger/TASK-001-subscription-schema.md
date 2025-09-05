# TASK-001: Subscription Database Schema and Repository

## Description
Create the subscription database schema, migration, and repository following TDD principles. This forms the core entity for 606Ledger revenue recognition.

## Acceptance Criteria
- [ ] Subscription table schema created with all required fields
- [ ] Subscription items table schema created for line items
- [ ] Database migration script created and tested
- [ ] Repository class implemented with CRUD operations
- [ ] All database constraints and indexes created
- [ ] Zod validation schemas created
- [ ] Unit tests for repository operations
- [ ] Integration tests with actual database

## Dependencies
- None (foundational task)

## Estimated Effort
2 days

## Technical Implementation

### Database Schema
```sql
-- subscriptions table
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  entity_id UUID NOT NULL REFERENCES entities(id),
  subscription_number VARCHAR(100) NOT NULL,
  status subscription_status NOT NULL DEFAULT 'draft',
  start_date DATE NOT NULL,
  end_date DATE,
  contract_value DECIMAL(12,2),
  billing_frequency billing_frequency,
  auto_renew BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- subscription_items table
CREATE TABLE subscription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id),
  quantity DECIMAL(10,4) NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  discount_percentage DECIMAL(5,4) DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Test Requirements

#### Unit Tests
1. **Repository CRUD Operations**
   - Test subscription creation with valid data
   - Test subscription retrieval by ID
   - Test subscription list with filtering
   - Test subscription updates
   - Test subscription deletion
   - Test subscription items relationship

2. **Validation Tests**
   - Test required field validation
   - Test date range validation
   - Test decimal precision validation
   - Test enum value validation
   - Test foreign key constraints

#### Integration Tests
1. **Database Integration**
   - Test migration up/down
   - Test schema creation
   - Test indexes are created
   - Test constraints work
   - Test cascading deletes

### Files to Create
- `packages/database/src/db/schema/subscriptions.ts`
- `packages/database/src/db/schema/subscription-items.ts`
- `packages/database/src/repositories/subscription-repository.ts`
- `packages/database/src/migrations/YYYY-MM-DD-create-subscriptions.sql`
- `packages/database/src/repositories/__tests__/subscription-repository.test.ts`

### Definition of Done
- [ ] All tests pass
- [ ] Code follows existing patterns
- [ ] Migration tested in development environment
- [ ] Repository methods documented
- [ ] Type safety verified with TypeScript
- [ ] Performance tested with sample data