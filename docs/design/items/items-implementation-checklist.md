# Items System Implementation Checklist

## Phase 1: Foundation (Week 1-2)

### Database Schema Creation

#### 1.1 Create Migration Files
- [ ] Create migration for `units_of_measure` table
- [ ] Create migration for `item_categories` table  
- [ ] Create migration for `items` table (with variant support)
- [ ] Create migration for `price_lists` table
- [ ] Create migration for `item_pricing` table
- [ ] Create migration for `customer_price_lists` table
- [ ] Create migration for `vendor_items` table
- [ ] Create migration for `lot_numbers` table
- [ ] Create migration for `serial_numbers` table
- [ ] Create migration for `assembly_components` table
- [ ] Create migration for `kit_components` table
- [ ] Create migration for `item_audit_log` table

#### 1.2 Create RLS Policies
- [ ] Create RLS policies script for all tables
- [ ] Create helper functions for cross-table security
- [ ] Test RLS policies with multiple organizations

### Drizzle Schema Implementation

#### 1.3 Create Schema Files in packages/database
- [ ] Create `schema/units-of-measure.ts`
  - [ ] Define table schema
  - [ ] Define TypeScript types
  - [ ] Define relations
- [ ] Create `schema/item-categories.ts`
  - [ ] Define table schema with hierarchy support
  - [ ] Define TypeScript types
  - [ ] Define relations
- [ ] Create `schema/items.ts`
  - [ ] Define table schema with variant fields
  - [ ] Define TypeScript types
  - [ ] Define relations to categories, UOM, GL accounts
- [ ] Create `schema/pricing.ts`
  - [ ] Define price_lists schema
  - [ ] Define item_pricing schema
  - [ ] Define customer_price_lists schema
  - [ ] Define relations
- [ ] Create `schema/vendor-items.ts`
  - [ ] Define table schema
  - [ ] Define TypeScript types
  - [ ] Define relations
- [ ] Create `schema/inventory-tracking.ts`
  - [ ] Define lot_numbers schema
  - [ ] Define serial_numbers schema
  - [ ] Define relations
- [ ] Create `schema/assemblies-kits.ts`
  - [ ] Define assembly_components schema
  - [ ] Define kit_components schema
  - [ ] Define relations

### Repository Layer Implementation

#### 1.4 Create Repository Classes in packages/database
- [ ] Create `repositories/units-of-measure.repository.ts`
  - [ ] Implement CRUD operations
  - [ ] Add conversion calculation methods
  - [ ] Add organization filtering
- [ ] Create `repositories/item-categories.repository.ts`
  - [ ] Implement CRUD operations
  - [ ] Add hierarchy management methods
  - [ ] Add path calculation
  - [ ] Add tree retrieval methods
- [ ] Create `repositories/items.repository.ts`
  - [ ] Implement CRUD operations
  - [ ] Add variant management methods
  - [ ] Add search functionality
  - [ ] Add bulk operations
- [ ] Create `repositories/pricing.repository.ts`
  - [ ] Implement price list CRUD
  - [ ] Add price calculation methods
  - [ ] Add customer price resolution
  - [ ] Add bulk price updates
- [ ] Create `repositories/vendor-items.repository.ts`
  - [ ] Implement CRUD operations
  - [ ] Add preferred vendor methods
  - [ ] Add cost tracking
- [ ] Create `repositories/inventory-tracking.repository.ts`
  - [ ] Implement lot/serial CRUD
  - [ ] Add tracking methods
  - [ ] Add status management
- [ ] Create `repositories/assemblies-kits.repository.ts`
  - [ ] Implement component management
  - [ ] Add BOM calculations
  - [ ] Add kit explosion methods

## Phase 2: Service Layer (Week 2-3)

### Service Implementation in packages/api-service

#### 2.1 Create Service Classes
- [ ] Create `services/units-of-measure.service.ts`
  - [ ] Implement business logic
  - [ ] Add validation rules
  - [ ] Add conversion utilities
- [ ] Create `services/item-categories.service.ts`
  - [ ] Implement business logic
  - [ ] Add hierarchy validation
  - [ ] Add move/reorder methods
- [ ] Create `services/items.service.ts`
  - [ ] Implement business logic
  - [ ] Add item type validation
  - [ ] Add GL account validation
  - [ ] Add variant generation logic
  - [ ] Add search and filtering
- [ ] Create `services/pricing.service.ts`
  - [ ] Implement pricing engine
  - [ ] Add quantity break calculations
  - [ ] Add effective date logic
  - [ ] Add customer-specific pricing
- [ ] Create `services/vendor-items.service.ts`
  - [ ] Implement vendor management
  - [ ] Add lead time calculations
  - [ ] Add cost tracking
- [ ] Create `services/inventory-tracking.service.ts`
  - [ ] Implement lot/serial assignment
  - [ ] Add expiration tracking
  - [ ] Add traceability methods
- [ ] Create `services/assemblies-kits.service.ts`
  - [ ] Implement BOM management
  - [ ] Add component validation
  - [ ] Add cost rollup calculations

#### 2.2 Create Validation Schemas (Zod)
- [ ] Create validation schemas for all entities
- [ ] Create request/response DTOs
- [ ] Add custom validation rules

## Phase 3: API Layer (Week 3-4)

### API Implementation in apps/api

#### 3.1 Create Route Handlers
- [ ] Create `/api/units-of-measure` routes
  - [ ] GET / (list with pagination)
  - [ ] POST / (create)
  - [ ] GET /:id (get by id)
  - [ ] PUT /:id (update)
  - [ ] DELETE /:id (soft delete)
  
- [ ] Create `/api/item-categories` routes
  - [ ] GET / (list)
  - [ ] POST / (create)
  - [ ] GET /tree (hierarchical view)
  - [ ] GET /:id (get by id)
  - [ ] PUT /:id (update)
  - [ ] DELETE /:id (delete with validation)
  
- [ ] Create `/api/items` routes
  - [ ] GET / (list with filters)
  - [ ] POST / (create)
  - [ ] GET /search (advanced search)
  - [ ] GET /:id (get by id)
  - [ ] PUT /:id (update)
  - [ ] DELETE /:id (soft delete)
  - [ ] GET /:id/variants (get variants)
  - [ ] POST /:id/variants (create variants)
  - [ ] GET /:id/pricing (get pricing)
  - [ ] GET /:id/vendors (get vendors)
  - [ ] GET /:id/components (get BOM/kit)
  
- [ ] Create `/api/price-lists` routes
  - [ ] GET / (list)
  - [ ] POST / (create)
  - [ ] GET /:id (get by id)
  - [ ] PUT /:id (update)
  - [ ] DELETE /:id (delete)
  - [ ] POST /:id/items (bulk update prices)
  - [ ] GET /:id/items (get items in list)
  
- [ ] Create `/api/vendors/:vendorId/items` routes
  - [ ] GET / (list vendor items)
  - [ ] POST / (add item to vendor)
  - [ ] PUT /:itemId (update vendor item)
  - [ ] DELETE /:itemId (remove from vendor)
  
- [ ] Create `/api/items/:itemId/lots` routes
  - [ ] GET / (list lots)
  - [ ] POST / (create lot)
  - [ ] PUT /:id/status (update status)
  
- [ ] Create `/api/items/:itemId/serials` routes
  - [ ] GET / (list serials)
  - [ ] POST / (create serial)
  - [ ] PUT /:id/status (update status)
  - [ ] GET /search (search by serial number)

#### 3.2 Add Middleware
- [ ] Add organization context middleware
- [ ] Add permission checking middleware
- [ ] Add audit logging middleware

## Phase 4: Testing (Ongoing)

### Unit Tests

#### 4.1 Repository Tests
- [ ] Test units of measure repository
  - [ ] Test CRUD operations
  - [ ] Test conversion calculations
  - [ ] Test organization isolation
  
- [ ] Test item categories repository
  - [ ] Test CRUD operations
  - [ ] Test hierarchy operations
  - [ ] Test path calculations
  
- [ ] Test items repository
  - [ ] Test CRUD operations
  - [ ] Test variant queries
  - [ ] Test search functionality
  - [ ] Test bulk operations
  
- [ ] Test pricing repository
  - [ ] Test price calculations
  - [ ] Test quantity breaks
  - [ ] Test date effectiveness
  
- [ ] Test vendor items repository
  - [ ] Test vendor associations
  - [ ] Test preferred vendor logic
  
- [ ] Test inventory tracking repository
  - [ ] Test lot/serial creation
  - [ ] Test status updates
  - [ ] Test traceability

#### 4.2 Service Tests
- [ ] Test item service
  - [ ] Test item type validation
  - [ ] Test GL account requirements
  - [ ] Test variant generation
  - [ ] Test deactivation rules
  
- [ ] Test pricing service
  - [ ] Test price calculation engine
  - [ ] Test customer pricing resolution
  - [ ] Test bulk updates
  
- [ ] Test assembly/kit service
  - [ ] Test component validation
  - [ ] Test circular reference prevention
  - [ ] Test cost calculations

### Integration Tests

#### 4.3 API Integration Tests
- [ ] Test authentication and organization context
- [ ] Test complete CRUD flows
- [ ] Test pagination and filtering
- [ ] Test validation errors
- [ ] Test RLS enforcement
- [ ] Test cross-organization access (should fail)

#### 4.4 End-to-End Scenarios
- [ ] Test creating item with variants
  - [ ] Create parent item
  - [ ] Generate variants
  - [ ] Verify all variants created
  - [ ] Test pricing inheritance
  
- [ ] Test assembly creation
  - [ ] Create assembly item
  - [ ] Add components
  - [ ] Validate BOM
  - [ ] Calculate costs
  
- [ ] Test pricing scenarios
  - [ ] Create price lists
  - [ ] Assign to customers
  - [ ] Test price resolution
  - [ ] Test quantity breaks
  
- [ ] Test vendor management
  - [ ] Assign items to vendors
  - [ ] Update costs
  - [ ] Track purchase history
  
- [ ] Test lot/serial tracking
  - [ ] Create tracked item
  - [ ] Assign lot numbers
  - [ ] Track through lifecycle
  - [ ] Test expiration

### Performance Tests

#### 4.5 Load Testing
- [ ] Test with 10,000+ items
- [ ] Test with 100,000+ variants
- [ ] Test search performance
- [ ] Test bulk operations
- [ ] Test concurrent access

## Phase 5: UI Implementation (Week 4-5)

### UI Components in apps/web

#### 5.1 List Views
- [ ] Create items list page
  - [ ] Add filters (type, category, status)
  - [ ] Add search
  - [ ] Add sorting
  - [ ] Add pagination
  - [ ] Add bulk actions
  
- [ ] Create categories tree view
  - [ ] Add drag-drop reordering
  - [ ] Add expand/collapse
  - [ ] Add inline editing
  
- [ ] Create price lists page
  - [ ] Add list view
  - [ ] Add assignment UI

#### 5.2 Detail/Edit Forms
- [ ] Create item form
  - [ ] Add all fields with validation
  - [ ] Add GL account selectors
  - [ ] Add variant configuration
  - [ ] Add image upload
  
- [ ] Create category form
  - [ ] Add parent selection
  - [ ] Add code generation
  
- [ ] Create price list form
  - [ ] Add item pricing grid
  - [ ] Add bulk update tools

#### 5.3 Specialized UIs
- [ ] Create variant generator
  - [ ] Add attribute definition
  - [ ] Add preview
  - [ ] Add bulk generation
  
- [ ] Create assembly builder
  - [ ] Add component search
  - [ ] Add quantity editor
  - [ ] Add cost preview
  
- [ ] Create vendor assignment
  - [ ] Add vendor search
  - [ ] Add cost entry
  - [ ] Add preferred flagging

#### 5.4 Transaction Integration
- [ ] Create item selector component
  - [ ] Add search/filter
  - [ ] Add recent items
  - [ ] Add favorites
  
- [ ] Create price resolution display
  - [ ] Show applicable prices
  - [ ] Show discounts
  - [ ] Show quantity breaks

## Phase 6: Documentation (Week 5)

### Technical Documentation

#### 6.1 API Documentation
- [ ] Document all endpoints
- [ ] Add request/response examples
- [ ] Document error codes
- [ ] Add authentication details

#### 6.2 Database Documentation
- [ ] Document table relationships
- [ ] Document RLS policies
- [ ] Document indexes
- [ ] Add ER diagram

### User Documentation

#### 6.3 User Guides
- [ ] Create item management guide
- [ ] Create pricing setup guide
- [ ] Create variant configuration guide
- [ ] Create assembly/kit guide

#### 6.4 Admin Guides
- [ ] Create setup checklist
- [ ] Create permissions guide
- [ ] Create troubleshooting guide

## Phase 7: Deployment (Week 6)

### Deployment Tasks

#### 7.1 Database Deployment
- [ ] Run migrations on staging
- [ ] Verify RLS policies
- [ ] Load test data
- [ ] Run performance tests

#### 7.2 Application Deployment
- [ ] Deploy API changes
- [ ] Deploy UI changes
- [ ] Update environment configs
- [ ] Run smoke tests

#### 7.3 Post-Deployment
- [ ] Monitor performance
- [ ] Check error logs
- [ ] Gather user feedback
- [ ] Plan Phase 2 (Configurables)

## Success Criteria

### Functional Requirements
- [ ] All CRUD operations work correctly
- [ ] Variants generate properly
- [ ] Pricing calculates accurately
- [ ] RLS prevents cross-org access
- [ ] Search returns relevant results
- [ ] Bulk operations complete successfully

### Performance Requirements
- [ ] Page load < 2 seconds
- [ ] Search results < 1 second
- [ ] Bulk operations handle 1000+ items
- [ ] API responses < 500ms average

### Security Requirements
- [ ] RLS policies enforced
- [ ] No data leakage between orgs
- [ ] Audit trail captures all changes
- [ ] Permissions properly enforced

### Quality Requirements
- [ ] 90%+ test coverage
- [ ] All critical paths tested
- [ ] No critical bugs in production
- [ ] Documentation complete

## Notes

- Each checkbox represents approximately 1-4 hours of work
- Run tests after each major component
- Deploy to staging after each phase
- Get feedback early and often
- Keep security in mind throughout