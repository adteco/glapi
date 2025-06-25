# Items System Design Document

## Overview

This document outlines the design for implementing an items system in GLAPI that will be used on transactions such as sales orders, invoices, and other financial documents. The system includes items management, units of measure, and item categorization.

## Database Schema Design

### 1. Units of Measure Table

```sql
CREATE TABLE units_of_measure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  code VARCHAR(10) NOT NULL,
  name VARCHAR(100) NOT NULL,
  abbreviation VARCHAR(10) NOT NULL,
  base_unit_id UUID REFERENCES units_of_measure(id),
  conversion_factor DECIMAL(18,6) DEFAULT 1.0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  UNIQUE(organization_id, code),
  UNIQUE(organization_id, abbreviation)
);

-- Example data:
-- Base unit: Each (EA)
-- Derived: Box (BX) = 12 EA, Case (CS) = 144 EA
-- Base unit: Kilogram (KG)
-- Derived: Gram (G) = 0.001 KG, Metric Ton (MT) = 1000 KG
```

### 2. Item Categories Table

```sql
CREATE TABLE item_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  parent_category_id UUID REFERENCES item_categories(id),
  level INTEGER NOT NULL DEFAULT 0,
  path TEXT NOT NULL, -- Materialized path for hierarchy
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  UNIQUE(organization_id, code),
  INDEX idx_item_categories_path (path),
  INDEX idx_item_categories_parent (parent_category_id)
);
```

### 3. Items Table

```sql
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  item_code VARCHAR(100) NOT NULL,
  name VARCHAR(500) NOT NULL,
  description TEXT,
  
  -- Item Type
  item_type VARCHAR(50) NOT NULL CHECK (item_type IN (
    'INVENTORY_ITEM',
    'NON_INVENTORY_ITEM',
    'SERVICE',
    'CHARGE',
    'DISCOUNT',
    'TAX',
    'ASSEMBLY',
    'KIT'
  )),
  
  -- Matrix/Variant Support
  is_parent BOOLEAN DEFAULT false,
  parent_item_id UUID REFERENCES items(id),
  variant_attributes JSONB, -- e.g., {"size": "Large", "color": "Blue"}
  
  -- Categorization
  category_id UUID REFERENCES item_categories(id),
  
  -- Units of Measure
  unit_of_measure_id UUID NOT NULL REFERENCES units_of_measure(id),
  
  -- Financial Accounts
  income_account_id UUID REFERENCES gl_accounts(id),
  expense_account_id UUID REFERENCES gl_accounts(id),
  asset_account_id UUID REFERENCES gl_accounts(id), -- For inventory items
  cogs_account_id UUID REFERENCES gl_accounts(id), -- Cost of Goods Sold
  
  -- Pricing
  default_price DECIMAL(18,2),
  default_cost DECIMAL(18,2),
  
  -- Tax Information
  is_taxable BOOLEAN DEFAULT true,
  tax_code VARCHAR(50),
  
  -- Status and Tracking
  is_active BOOLEAN DEFAULT true,
  is_purchasable BOOLEAN DEFAULT true,
  is_saleable BOOLEAN DEFAULT true,
  track_quantity BOOLEAN DEFAULT false, -- Only for inventory items
  track_lot_numbers BOOLEAN DEFAULT false,
  track_serial_numbers BOOLEAN DEFAULT false,
  
  -- Additional Fields
  sku VARCHAR(100),
  upc VARCHAR(50),
  manufacturer_part_number VARCHAR(100),
  weight DECIMAL(18,4),
  weight_unit VARCHAR(10),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  
  UNIQUE(organization_id, item_code),
  INDEX idx_items_category (category_id),
  INDEX idx_items_type (item_type),
  INDEX idx_items_sku (sku),
  INDEX idx_items_upc (upc),
  INDEX idx_items_parent (parent_item_id)
);
```

### 4. Price Lists Table

```sql
CREATE TABLE price_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR(200) NOT NULL,
  code VARCHAR(50) NOT NULL,
  description TEXT,
  currency_code VARCHAR(3) DEFAULT 'USD',
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, code)
);
```

### 5. Item Pricing Table (Enhanced)

```sql
CREATE TABLE item_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id),
  price_list_id UUID NOT NULL REFERENCES price_lists(id),
  unit_price DECIMAL(18,2) NOT NULL,
  min_quantity DECIMAL(18,2) DEFAULT 1,
  effective_date DATE NOT NULL,
  expiration_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(item_id, price_list_id, min_quantity, effective_date),
  INDEX idx_item_pricing_lookup (item_id, price_list_id, effective_date, expiration_date),
  INDEX idx_item_pricing_dates (effective_date, expiration_date)
);
```

### 6. Customer Price Lists (Join Table)

```sql
CREATE TABLE customer_price_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  price_list_id UUID NOT NULL REFERENCES price_lists(id),
  priority INTEGER DEFAULT 1, -- Lower number = higher priority
  effective_date DATE,
  expiration_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(customer_id, price_list_id),
  INDEX idx_customer_price_lists_dates (effective_date, expiration_date)
);
```

### 7. Vendor Items Table

```sql
CREATE TABLE vendor_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  item_id UUID NOT NULL REFERENCES items(id),
  vendor_item_code VARCHAR(100),
  vendor_item_name VARCHAR(500),
  vendor_unit_cost DECIMAL(18,2),
  lead_time_days INTEGER DEFAULT 0,
  min_order_quantity DECIMAL(18,2) DEFAULT 1,
  is_preferred BOOLEAN DEFAULT false,
  last_purchase_date DATE,
  last_purchase_price DECIMAL(18,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(vendor_id, item_id),
  INDEX idx_vendor_items_item (item_id),
  INDEX idx_vendor_items_preferred (item_id, is_preferred)
);
```

### 8. Lot Numbers Table

```sql
CREATE TABLE lot_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  item_id UUID NOT NULL REFERENCES items(id),
  lot_number VARCHAR(100) NOT NULL,
  manufacture_date DATE,
  expiration_date DATE,
  quantity_received DECIMAL(18,2) NOT NULL,
  quantity_on_hand DECIMAL(18,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'RECALLED')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, item_id, lot_number),
  INDEX idx_lot_numbers_item (item_id),
  INDEX idx_lot_numbers_dates (expiration_date),
  INDEX idx_lot_numbers_status (status)
);
```

### 9. Serial Numbers Table

```sql
CREATE TABLE serial_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  item_id UUID NOT NULL REFERENCES items(id),
  serial_number VARCHAR(200) NOT NULL,
  lot_number_id UUID REFERENCES lot_numbers(id),
  status VARCHAR(50) DEFAULT 'AVAILABLE' CHECK (status IN (
    'AVAILABLE', 'SOLD', 'IN_TRANSIT', 'RETURNED', 'DAMAGED', 'LOST'
  )),
  purchase_date DATE,
  purchase_vendor_id UUID REFERENCES vendors(id),
  sale_date DATE,
  sale_customer_id UUID REFERENCES customers(id),
  warranty_expiration_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, serial_number),
  INDEX idx_serial_numbers_item (item_id),
  INDEX idx_serial_numbers_status (status)
);
```

### 10. Assembly Components Table (Bill of Materials)

```sql
CREATE TABLE assembly_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_item_id UUID NOT NULL REFERENCES items(id),
  component_item_id UUID NOT NULL REFERENCES items(id),
  quantity DECIMAL(18,6) NOT NULL,
  unit_of_measure_id UUID REFERENCES units_of_measure(id),
  sequence_number INTEGER DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(assembly_item_id, component_item_id),
  INDEX idx_assembly_components_assembly (assembly_item_id),
  INDEX idx_assembly_components_component (component_item_id)
);
```

### 11. Kit Components Table

```sql
CREATE TABLE kit_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_item_id UUID NOT NULL REFERENCES items(id),
  component_item_id UUID NOT NULL REFERENCES items(id),
  quantity DECIMAL(18,2) NOT NULL,
  is_optional BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(kit_item_id, component_item_id),
  INDEX idx_kit_components_kit (kit_item_id)
);
```

## Business Rules and Validations

### Item Type Requirements

1. **Inventory Item**
   - MUST have asset_account_id and cogs_account_id
   - MUST have track_quantity = true
   - Should have default_cost
   - Can enable lot/serial tracking

2. **Non-Inventory Item**
   - asset_account_id is optional
   - track_quantity = false
   - May have expense_account_id
   - Cannot track lot/serial numbers

3. **Service**
   - No asset_account_id required
   - track_quantity = false
   - Usually only has income_account_id
   - Cannot be part of assemblies or kits

4. **Charge/Discount/Tax**
   - Special item types for transaction adjustments
   - May have specific account mappings
   - Cannot be purchasable if type is DISCOUNT

5. **Assembly**
   - MUST have at least one component in assembly_components
   - Inherits tracking settings from inventory items
   - Requires asset_account_id and cogs_account_id
   - Components are consumed during assembly build

6. **Kit**
   - Bundle of items sold together
   - Components remain as separate inventory items
   - Price can be different from sum of components
   - Can have optional components

### Account Assignment Rules

- All items MUST have at least one account (income OR expense)
- Saleable items MUST have income_account_id
- Purchasable items MUST have expense_account_id
- Inventory items MUST have asset_account_id

### Units of Measure Rules

- Each organization can define their own units
- Units can have conversion relationships (base unit concept)
- Items must reference a valid unit of measure
- Transaction lines will inherit the item's default unit but can override

## API Endpoints

### Units of Measure

```
GET    /api/units-of-measure
POST   /api/units-of-measure
GET    /api/units-of-measure/:id
PUT    /api/units-of-measure/:id
DELETE /api/units-of-measure/:id
```

### Item Categories

```
GET    /api/item-categories
POST   /api/item-categories
GET    /api/item-categories/:id
PUT    /api/item-categories/:id
DELETE /api/item-categories/:id
GET    /api/item-categories/tree  # Hierarchical view
```

### Items

```
GET    /api/items
POST   /api/items
GET    /api/items/:id
PUT    /api/items/:id
DELETE /api/items/:id
GET    /api/items/search         # Advanced search
GET    /api/items/:id/pricing    # Get pricing information
GET    /api/items/:id/variants    # Get item variants (for parent items)
POST   /api/items/:id/variants    # Create variants for parent item
GET    /api/items/:id/vendors     # Get vendor information
GET    /api/items/:id/components  # Get assembly/kit components
```

### Price Lists

```
GET    /api/price-lists
POST   /api/price-lists
GET    /api/price-lists/:id
PUT    /api/price-lists/:id
DELETE /api/price-lists/:id
POST   /api/price-lists/:id/items        # Bulk update item prices
GET    /api/price-lists/:id/items        # Get all items in price list
```

### Vendor Items

```
GET    /api/vendors/:vendorId/items
POST   /api/vendors/:vendorId/items
PUT    /api/vendors/:vendorId/items/:itemId
DELETE /api/vendors/:vendorId/items/:itemId
GET    /api/items/:itemId/preferred-vendor
```

### Lot/Serial Numbers

```
GET    /api/items/:itemId/lots
POST   /api/items/:itemId/lots
GET    /api/lots/:id
PUT    /api/lots/:id/status

GET    /api/items/:itemId/serials
POST   /api/items/:itemId/serials
GET    /api/serials/:id
PUT    /api/serials/:id/status
GET    /api/serials/search?number=:serialNumber
```

## Data Types and Interfaces

### TypeScript Interfaces

```typescript
// Units of Measure
interface UnitOfMeasure {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  abbreviation: string;
  baseUnitId?: string;
  conversionFactor: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Item Category
interface ItemCategory {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  parentCategoryId?: string;
  level: number;
  path: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Item Type Enum
enum ItemType {
  INVENTORY_ITEM = 'INVENTORY_ITEM',
  NON_INVENTORY_ITEM = 'NON_INVENTORY_ITEM',
  SERVICE = 'SERVICE',
  CHARGE = 'CHARGE',
  DISCOUNT = 'DISCOUNT',
  TAX = 'TAX',
  ASSEMBLY = 'ASSEMBLY',
  KIT = 'KIT'
}

// Item
interface Item {
  id: string;
  organizationId: string;
  itemCode: string;
  name: string;
  description?: string;
  itemType: ItemType;
  
  // Matrix/Variant Support
  isParent: boolean;
  parentItemId?: string;
  variantAttributes?: Record<string, string>;
  
  categoryId?: string;
  unitOfMeasureId: string;
  
  // GL Accounts
  incomeAccountId?: string;
  expenseAccountId?: string;
  assetAccountId?: string;
  cogsAccountId?: string;
  
  // Pricing
  defaultPrice?: number;
  defaultCost?: number;
  
  // Tax
  isTaxable: boolean;
  taxCode?: string;
  
  // Status and Tracking
  isActive: boolean;
  isPurchasable: boolean;
  isSaleable: boolean;
  trackQuantity: boolean;
  trackLotNumbers: boolean;
  trackSerialNumbers: boolean;
  
  // Additional Fields
  sku?: string;
  upc?: string;
  manufacturerPartNumber?: string;
  weight?: number;
  weightUnit?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

// Price List
interface PriceList {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  description?: string;
  currencyCode: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Item Pricing
interface ItemPricing {
  id: string;
  itemId: string;
  priceListId: string;
  unitPrice: number;
  minQuantity: number;
  effectiveDate: Date;
  expirationDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Customer Price List Assignment
interface CustomerPriceList {
  id: string;
  customerId: string;
  priceListId: string;
  priority: number;
  effectiveDate?: Date;
  expirationDate?: Date;
  createdAt: Date;
}

// Vendor Item
interface VendorItem {
  id: string;
  vendorId: string;
  itemId: string;
  vendorItemCode?: string;
  vendorItemName?: string;
  vendorUnitCost?: number;
  leadTimeDays: number;
  minOrderQuantity: number;
  isPreferred: boolean;
  lastPurchaseDate?: Date;
  lastPurchasePrice?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Lot Number
interface LotNumber {
  id: string;
  organizationId: string;
  itemId: string;
  lotNumber: string;
  manufactureDate?: Date;
  expirationDate?: Date;
  quantityReceived: number;
  quantityOnHand: number;
  status: 'ACTIVE' | 'EXPIRED' | 'RECALLED';
  notes?: string;
  createdAt: Date;
}

// Serial Number
interface SerialNumber {
  id: string;
  organizationId: string;
  itemId: string;
  serialNumber: string;
  lotNumberId?: string;
  status: 'AVAILABLE' | 'SOLD' | 'IN_TRANSIT' | 'RETURNED' | 'DAMAGED' | 'LOST';
  purchaseDate?: Date;
  purchaseVendorId?: string;
  saleDate?: Date;
  saleCustomerId?: string;
  warrantyExpirationDate?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Assembly Component (BOM)
interface AssemblyComponent {
  id: string;
  assemblyItemId: string;
  componentItemId: string;
  quantity: number;
  unitOfMeasureId?: string;
  sequenceNumber: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Kit Component
interface KitComponent {
  id: string;
  kitItemId: string;
  componentItemId: string;
  quantity: number;
  isOptional: boolean;
  createdAt: Date;
}
```

## Integration with Transactions

### Transaction Line Items

When items are used on transactions (sales orders, invoices, etc.), the transaction line should:

1. Reference the item_id
2. Copy relevant fields at time of transaction (price, description, accounts)
3. Allow override of default values
4. Track the unit of measure used
5. Calculate extended amounts based on quantity and unit price

### Example Transaction Line Structure

```typescript
interface TransactionLine {
  id: string;
  transactionId: string;
  lineNumber: number;
  itemId?: string;
  description: string;
  quantity: number;
  unitOfMeasureId: string;
  unitPrice: number;
  amount: number;
  accountId: string; // Resolved from item's income/expense account
  taxAmount?: number;
  // ... other fields
}
```

## Implementation Tasks

### Phase 1: Core Tables and CRUD Operations

1. Create database migrations for all tables:
   - units_of_measure
   - item_categories  
   - items (with variant support)
   - price_lists
   - item_pricing
   - customer_price_lists
   - vendor_items
   - lot_numbers
   - serial_numbers
   - assembly_components
   - kit_components

2. Implement Drizzle schemas in packages/database

3. Create repository classes:
   - UnitsOfMeasureRepository
   - ItemCategoriesRepository
   - ItemsRepository
   - PriceListsRepository
   - VendorItemsRepository
   - LotSerialRepository
   - AssemblyKitRepository

4. Implement service layer in packages/api-service:
   - UnitsOfMeasureService
   - ItemCategoriesService
   - ItemsService (with variant generation)
   - PricingService
   - VendorItemService
   - InventoryTrackingService

5. Create API endpoints in apps/api

### Phase 2: Business Logic and Validations

1. Implement item type validation rules
2. Add account assignment validations
3. Create unit conversion utilities
4. Implement category hierarchy management
5. Build variant generation logic
6. Create pricing calculation engine
7. Implement lot/serial validation rules
8. Add assembly/kit component validation

### Phase 3: UI Components

1. Create item management pages in apps/web:
   - Item list with filters
   - Item detail/edit form
   - Variant configuration UI
   - Assembly/kit builder

2. Build supporting UIs:
   - Price list management
   - Vendor item assignments
   - Lot/serial tracking interface
   - Category tree manager

3. Transaction integration components:
   - Item search/selection widget
   - Price list selector
   - Lot/serial assignment UI

### Phase 4: Integration

1. Update transaction schemas to reference items
2. Modify transaction services to:
   - Resolve pricing from price lists
   - Track lot/serial numbers
   - Handle kit explosions
   - Calculate assembly costs
3. Update inventory tracking on transactions
4. Add item-based reporting capabilities

## Security Considerations

### Row-Level Security (RLS) Implementation

All tables must implement RLS policies to ensure proper multi-tenant isolation. Each policy should check that the user's organization_id matches the record's organization_id.

#### RLS Policies

```sql
-- Enable RLS on all tables
ALTER TABLE units_of_measure ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE lot_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE serial_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE assembly_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE kit_components ENABLE ROW LEVEL SECURITY;

-- Units of Measure RLS
CREATE POLICY "Users can view their organization's units of measure"
  ON units_of_measure FOR SELECT
  USING (organization_id = auth.jwt()->>'organization_id');

CREATE POLICY "Users can create units of measure for their organization"
  ON units_of_measure FOR INSERT
  WITH CHECK (organization_id = auth.jwt()->>'organization_id');

CREATE POLICY "Users can update their organization's units of measure"
  ON units_of_measure FOR UPDATE
  USING (organization_id = auth.jwt()->>'organization_id')
  WITH CHECK (organization_id = auth.jwt()->>'organization_id');

-- Items RLS
CREATE POLICY "Users can view their organization's items"
  ON items FOR SELECT
  USING (organization_id = auth.jwt()->>'organization_id');

CREATE POLICY "Users can create items for their organization"
  ON items FOR INSERT
  WITH CHECK (organization_id = auth.jwt()->>'organization_id');

CREATE POLICY "Users can update their organization's items"
  ON items FOR UPDATE
  USING (organization_id = auth.jwt()->>'organization_id')
  WITH CHECK (organization_id = auth.jwt()->>'organization_id');

-- Vendor Items RLS (joins through vendors table)
CREATE POLICY "Users can view vendor items for their organization's vendors"
  ON vendor_items FOR SELECT
  USING (
    vendor_id IN (
      SELECT id FROM vendors 
      WHERE organization_id = auth.jwt()->>'organization_id'
    )
  );

-- Customer Price Lists RLS (joins through customers table)
CREATE POLICY "Users can view customer price lists for their organization's customers"
  ON customer_price_lists FOR SELECT
  USING (
    customer_id IN (
      SELECT id FROM customers 
      WHERE organization_id = auth.jwt()->>'organization_id'
    )
  );

-- Assembly/Kit Components RLS (through items table)
CREATE POLICY "Users can view assembly components for their organization's items"
  ON assembly_components FOR SELECT
  USING (
    assembly_item_id IN (
      SELECT id FROM items 
      WHERE organization_id = auth.jwt()->>'organization_id'
    )
  );

-- Similar patterns for INSERT, UPDATE, DELETE on all tables
```

#### Service Layer Security

In addition to RLS, implement organization validation in the service layer:

```typescript
// Example service method with organization check
async getItem(itemId: string, organizationId: string): Promise<Item> {
  const item = await this.itemsRepository.findById(itemId);
  
  if (!item || item.organizationId !== organizationId) {
    throw new ForbiddenError('Item not found or access denied');
  }
  
  return item;
}
```

#### Integration with Existing Auth System

Since GLAPI uses Stytch for authentication, we need to ensure the organization_id is properly passed to the database:

```typescript
// Middleware to set database context
async function setDatabaseContext(req: Request, res: Response, next: NextFunction) {
  const organizationId = req.user?.organizationId;
  
  if (organizationId) {
    // Set the organization context for RLS
    await db.query('SET LOCAL app.current_organization_id = $1', [organizationId]);
  }
  
  next();
}

// Update RLS policies to use the session variable
CREATE POLICY "Users can view their organization's items"
  ON items FOR SELECT
  USING (
    organization_id = current_setting('app.current_organization_id')::uuid
    OR organization_id = (auth.jwt()->>'organization_id')::uuid
  );
```

#### Cross-Table Security Considerations

For tables that don't directly have organization_id (like vendor_items, assembly_components), ensure security through joins:

```sql
-- Function to check item organization ownership
CREATE OR REPLACE FUNCTION check_item_organization(item_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM items 
    WHERE id = item_id 
    AND organization_id = current_setting('app.current_organization_id')::uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Use in RLS policies
CREATE POLICY "Users can manage assembly components for their items"
  ON assembly_components FOR ALL
  USING (check_item_organization(assembly_item_id))
  WITH CHECK (check_item_organization(assembly_item_id));
```

### Permission Model

Implement role-based permissions for different item operations:

```typescript
enum ItemPermission {
  // Basic permissions
  VIEW_ITEMS = 'items.view',
  CREATE_ITEMS = 'items.create',
  EDIT_ITEMS = 'items.edit',
  DELETE_ITEMS = 'items.delete',
  
  // Advanced permissions
  MANAGE_ITEM_CATEGORIES = 'items.categories.manage',
  MANAGE_UNITS_OF_MEASURE = 'items.units.manage',
  MANAGE_PRICE_LISTS = 'items.pricing.manage',
  VIEW_ITEM_COSTS = 'items.costs.view',
  MANAGE_VENDOR_ITEMS = 'items.vendors.manage',
  
  // Inventory permissions
  VIEW_LOT_SERIAL = 'inventory.tracking.view',
  MANAGE_LOT_SERIAL = 'inventory.tracking.manage',
  
  // Assembly/Kit permissions
  VIEW_ASSEMBLIES = 'items.assemblies.view',
  MANAGE_ASSEMBLIES = 'items.assemblies.manage'
}
```

### Data Access Patterns

1. **Always filter by organization_id** in queries
2. **Validate organization ownership** before updates
3. **Prevent cross-organization references** in foreign keys
4. **Log all access attempts** for audit purposes

### Audit Trail

Implement comprehensive audit logging:

```sql
CREATE TABLE item_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  item_id UUID,
  action VARCHAR(50) NOT NULL, -- CREATE, UPDATE, DELETE, VIEW
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_item (item_id),
  INDEX idx_audit_user (user_id),
  INDEX idx_audit_action (action),
  INDEX idx_audit_created (created_at)
);
```

## Performance Considerations

1. **Indexing**: Proper indexes on frequently searched fields
2. **Caching**: Consider caching frequently accessed items
3. **Pagination**: Implement efficient pagination for large item lists
4. **Search**: Implement full-text search for item lookup

## Future Enhancements

1. **~~Item Variants~~**: ✅ Included in current design with matrix items
2. **Inventory Tracking**: Real-time quantity tracking across locations
3. **~~Multi-Currency Pricing~~**: ✅ Included via price lists
4. **~~Vendor Items~~**: ✅ Included in current design
5. **Item Images**: Support for product images and galleries
6. **Custom Fields**: Allow custom attributes per organization
7. **Barcode Generation**: Auto-generate barcodes for items
8. **~~Bundle Items~~**: ✅ Included via kit items
9. **Configurable Items**: Advanced rules-based product configurator (see configurable-items-design.md)
10. **Warehouse Management**: Bin locations, picking strategies
11. **Demand Planning**: Forecasting and auto-replenishment
12. **Quality Control**: Inspection workflows for received items

## Matrix/Variant Item Handling

### Variant Generation Strategy

When creating a parent item with variants:

1. **Define variant attributes** (e.g., Size, Color)
2. **Create parent item** with is_parent = true
3. **Generate child items** for each combination:
   - Auto-generate item codes (e.g., "SHIRT-L-BLUE")
   - Inherit most properties from parent
   - Store variant attributes in JSONB field
   - Each variant gets its own inventory tracking

### Example Variant Structure

```javascript
// Parent Item
{
  itemCode: "SHIRT",
  name: "Basic T-Shirt",
  isParent: true,
  variantAttributes: {
    size: ["S", "M", "L", "XL"],
    color: ["Red", "Blue", "Green"]
  }
}

// Generated Variants
{
  itemCode: "SHIRT-L-BLUE",
  name: "Basic T-Shirt - Large Blue",
  parentItemId: "parent-uuid",
  variantAttributes: {
    size: "L",
    color: "Blue"
  }
}
```

## Matrix Items vs Configurable Items

### When to Use Matrix Items
- Simple attribute variations (size, color, style)
- Each variant maintains separate inventory
- Fixed combinations (S/M/L × Red/Blue/Green)
- Price varies by variant
- Example: T-shirts, shoes, simple products

### When to Use Configurable Items
- Complex products with interdependencies
- Rules govern valid combinations
- Dynamic pricing based on selections
- Generate custom assemblies or kits
- Example: Computers, machinery, complex equipment

### Hybrid Approach
Some products may use both:
1. Base product uses matrix items (size/color)
2. Each variant can be made configurable (add-ons, options)

## Questions to Resolve

1. ~~Should we support item variants in the initial implementation?~~ **Yes - included in design**
2. Do we need approval workflows for item creation/changes?
3. Should items support multiple units of measure for selling vs purchasing?
4. How should we handle item deactivation when items are used in open transactions?
5. ~~Do we need to support item-specific tax rules beyond the simple taxable flag?~~ **Start simple, enhance later**
6. ~~Should we implement quantity break pricing in phase 1?~~ **Yes - included via min_quantity field**
7. How should we handle GL account validation (ensure accounts exist and are active)?
8. Should variant attributes be predefined or allow custom attributes per item?
9. How should we handle preferred vendor changes when multiple vendors exist?
10. Should we track inventory by location in phase 1 or add later?
11. Should configurable items be included in Phase 1 or Phase 2?
12. How should we handle version control for configuration rules?

## Next Steps

1. Review and approve this design document
2. Create detailed technical specifications for each component
3. Set up development environment for items module
4. Begin implementation with database schema creation
5. Develop API endpoints following existing patterns
6. Create UI components for item management