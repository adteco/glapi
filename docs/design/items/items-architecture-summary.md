# Items System Architecture Summary

## Overview

This document summarizes the key architectural decisions for the GLAPI items system implementation, focusing on multi-tenancy, security, and scalability.

## Multi-Tenant Architecture

### Database Design Principles

1. **Organization Scoping**: All primary entities include `organization_id` for tenant isolation
2. **Row-Level Security (RLS)**: PostgreSQL RLS policies enforce data isolation at the database level
3. **Cross-Organization Protection**: Foreign key constraints prevent cross-tenant references

### Tables with Direct Organization Scoping

- `units_of_measure`
- `item_categories`
- `items`
- `price_lists`
- `lot_numbers`
- `serial_numbers`

### Tables with Indirect Organization Scoping

These tables derive organization context through relationships:

- `item_pricing` → via `items.organization_id`
- `vendor_items` → via `vendors.organization_id`
- `customer_price_lists` → via `customers.organization_id`
- `assembly_components` → via `items.organization_id`
- `kit_components` → via `items.organization_id`

## Security Implementation

### Three-Layer Security Model

1. **Database Layer (RLS)**
   - PostgreSQL RLS policies on all tables
   - Automatic filtering based on organization context
   - No data leakage possible at query level

2. **Service Layer Validation**
   - Double-check organization ownership
   - Business logic enforcement
   - Permission-based access control

3. **API Layer Authentication**
   - Stytch authentication integration
   - JWT tokens with organization claims
   - Request-scoped organization context

### RLS Implementation Strategy

```sql
-- Direct organization check
CREATE POLICY "org_isolation" ON items
  USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Indirect organization check via join
CREATE POLICY "org_isolation" ON vendor_items
  USING (vendor_id IN (
    SELECT id FROM vendors 
    WHERE organization_id = current_setting('app.current_organization_id')::uuid
  ));
```

## Key Design Decisions

### 1. Variant/Matrix Items

**Decision**: Use parent-child relationships with JSONB for variant attributes

**Rationale**:
- Flexible attribute system without fixed schema
- Each variant maintains independent inventory
- Easy to query and filter variants
- Supports unlimited attribute combinations

### 2. Pricing Architecture

**Decision**: Separate price lists with customer assignments and quantity breaks

**Rationale**:
- Supports complex B2B pricing scenarios
- Date-based pricing effectiveness
- Multiple currencies per organization
- Quantity-based discounts

### 3. Lot/Serial Tracking

**Decision**: Separate tables for lots and serials with full lifecycle tracking

**Rationale**:
- Regulatory compliance support
- Complete traceability
- Warranty and expiration tracking
- Status management for recalls

### 4. Assembly vs Kit Items

**Decision**: Two distinct item types with different behaviors

**Rationale**:
- Assemblies consume components (manufacturing)
- Kits bundle items without consumption (sales bundles)
- Different GL impact and inventory tracking

## Performance Optimizations

### Indexing Strategy

1. **Primary Lookups**: `organization_id + code/name`
2. **Search Operations**: Full-text indexes on name/description
3. **Foreign Keys**: All FK columns indexed
4. **Composite Indexes**: For common query patterns

### Query Optimization

1. **Materialized Paths**: For category hierarchies
2. **JSONB Indexes**: For variant attribute searches
3. **Partial Indexes**: For active/inactive filtering

## Integration Points

### With Existing GLAPI Systems

1. **GL Accounts**: Items reference existing GL account structure
2. **Customers/Vendors**: Pricing and vendor items link to existing entities
3. **Transactions**: Items will be referenced in future transaction tables
4. **Authentication**: Leverages existing Stytch integration

### Future Integration Considerations

1. **Inventory Tracking**: Real-time quantity updates
2. **Transaction Processing**: Item selection and pricing
3. **Reporting**: Item-based analytics
4. **Workflow**: Approval processes for item changes

## Migration Strategy

### Phase 1: Core Infrastructure
- Create all tables with RLS
- Basic CRUD operations
- Simple UI for management

### Phase 2: Advanced Features
- Variant generation
- Price list management
- Vendor relationships

### Phase 3: Tracking & Compliance
- Lot/serial implementation
- Assembly/kit processing
- Audit logging

### Phase 4: Optimization
- Performance tuning
- Advanced search
- Bulk operations

## Best Practices

### Development Guidelines

1. **Always Include Organization Context**: Never bypass organization filtering
2. **Use Transactions**: For multi-table operations
3. **Validate Early**: Check permissions before database operations
4. **Log Everything**: Comprehensive audit trail for compliance

### Testing Requirements

1. **Multi-Tenant Isolation**: Test data isolation between organizations
2. **RLS Validation**: Ensure policies work correctly
3. **Performance Testing**: Large dataset handling
4. **Security Testing**: Attempt cross-organization access

## Conclusion

The items system architecture provides a robust, secure, and scalable foundation for inventory management within GLAPI's multi-tenant environment. The combination of PostgreSQL RLS, careful schema design, and layered security ensures data isolation while maintaining performance and flexibility.