# Next.js + Supabase Warehouse Pricing System

## 1. Database Schema (Supabase SQL)

First, create these tables in your Supabase SQL editor:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Core tables
CREATE TABLE items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    item_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE item_identifiers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    identifier_type VARCHAR(50) NOT NULL CHECK (identifier_type IN ('UPC', 'GTIN', 'BUYER_PART_NUMBER')),
    identifier_value VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE warehouses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    warehouse_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE customers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    customer_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Relationship tables
CREATE TABLE warehouse_pricing (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    price DECIMAL(10, 2) NOT NULL,
    effective_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(item_id, warehouse_id)
);

CREATE TABLE customer_warehouse_assignments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(customer_id, item_id)
);

-- Indexes for performance
CREATE INDEX idx_identifier_value ON item_identifiers(identifier_value);
CREATE INDEX idx_item_id ON item_identifiers(item_id);
CREATE INDEX idx_warehouse_pricing_item ON warehouse_pricing(item_id);
CREATE INDEX idx_customer_assignments ON customer_warehouse_assignments(customer_id, item_id);

-- Create a view for easy price lookup
CREATE OR REPLACE VIEW customer_item_prices AS
SELECT 
    c.id as customer_uuid,
    c.customer_id,
    c.name as customer_name,
    i.id as item_uuid,
    i.item_id,
    i.name as item_name,
    w.id as warehouse_uuid,
    w.warehouse_id,
    w.name as warehouse_name,
    wp.price,
    cwa.created_at as assignment_date
FROM customer_warehouse_assignments cwa
JOIN customers c ON cwa.customer_id = c.id
JOIN items i ON cwa.item_id = i.id
JOIN warehouses w ON cwa.warehouse_id = w.id
JOIN warehouse_pricing wp ON wp.item_id = i.id AND wp.warehouse_id = w.id;

-- Create a function to get price by identifier
CREATE OR REPLACE FUNCTION get_customer_price_by_identifier(
    p_customer_id VARCHAR(50),
    p_identifier_value VARCHAR(100)
)
RETURNS TABLE (
    item_id VARCHAR(50),
    item_name VARCHAR(255),
    warehouse_id VARCHAR(50),
    warehouse_name VARCHAR(255),
    price DECIMAL(10, 2),
    identifier_used VARCHAR(100),
    identifier_type VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.item_id,
        i.name as item_name,
        w.warehouse_id,
        w.name as warehouse_name,
        wp.price,
        ii.identifier_value as identifier_used,
        ii.identifier_type
    FROM item_identifiers ii
    JOIN items i ON ii.item_id = i.id
    JOIN customer_warehouse_assignments cwa ON cwa.item_id = i.id
    JOIN customers c ON cwa.customer_id = c.id
    JOIN warehouses w ON cwa.warehouse_id = w.id
    JOIN warehouse_pricing wp ON wp.item_id = i.id AND wp.warehouse_id = w.id
    WHERE c.customer_id = p_customer_id
    AND ii.identifier_value = p_identifier_value;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security (RLS)
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_identifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_warehouse_assignments ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your auth needs)
CREATE POLICY "Enable read access for all users" ON items FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON item_identifiers FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON warehouses FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON customers FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON warehouse_pricing FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON customer_warehouse_assignments FOR SELECT USING (true);
```

## 2. Next.js Setup

### Install dependencies:

```bash
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
```

### Environment variables (.env.local):

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 3. Supabase Client Setup

### `lib/supabase/client.ts`

```typescript
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

## 4. Type Definitions

### `types/database.ts`

```typescript
export interface Item {
  id: string
  item_id: string
  name: string
  description?: string
  created_at: string
}

export interface ItemIdentifier {
  id: string
  item_id: string
  identifier_type: 'UPC' | 'GTIN' | 'BUYER_PART_NUMBER'
  identifier_value: string
  created_at: string
}

export interface Warehouse {
  id: string
  warehouse_id: string
  name: string
  location?: string
  created_at: string
}

export interface Customer {
  id: string
  customer_id: string
  name: string
  created_at: string
}

export interface WarehousePricing {
  id: string
  item_id: string
  warehouse_id: string
  price: number
  effective_date: string
  created_at: string
}

export interface CustomerWarehouseAssignment {
  id: string
  customer_id: string
  item_id: string
  warehouse_id: string
  created_at: string
}

export interface CustomerItemPrice {
  customer_id: string
  customer_name: string
  item_id: string
  item_name: string
  warehouse_id: string
  warehouse_name: string
  price: number
  identifier_used?: string
  identifier_type?: string
}
```

## 5. API Service Layer

### `lib/services/pricing-service.ts`

```typescript
import { supabase } from '@/lib/supabase/client'
import type { 
  Item, 
  ItemIdentifier, 
  Warehouse, 
  Customer, 
  WarehousePricing,
  CustomerWarehouseAssignment,
  CustomerItemPrice 
} from '@/types/database'

export class PricingService {
  // Items
  static async createItem(item: Omit<Item, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('items')
      .insert(item)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  static async getItemByIdentifier(identifierValue: string) {
    const { data, error } = await supabase
      .from('item_identifiers')
      .select(`
        identifier_value,
        identifier_type,
        items (*)
      `)
      .eq('identifier_value', identifierValue)
      .single()
    
    if (error) throw error
    return data?.items
  }

  // Identifiers
  static async addIdentifier(identifier: Omit<ItemIdentifier, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('item_identifiers')
      .insert(identifier)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  // Warehouses
  static async createWarehouse(warehouse: Omit<Warehouse, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('warehouses')
      .insert(warehouse)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  // Customers
  static async createCustomer(customer: Omit<Customer, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('customers')
      .insert(customer)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  // Pricing
  static async setWarehousePricing(pricing: Omit<WarehousePricing, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('warehouse_pricing')
      .upsert(pricing)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  // Customer Assignments
  static async assignCustomerWarehouse(
    assignment: Omit<CustomerWarehouseAssignment, 'id' | 'created_at'>
  ) {
    const { data, error } = await supabase
      .from('customer_warehouse_assignments')
      .upsert(assignment)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  // Get customer price by identifier
  static async getCustomerPrice(
    customerId: string, 
    identifierValue: string
  ): Promise<CustomerItemPrice | null> {
    const { data, error } = await supabase
      .rpc('get_customer_price_by_identifier', {
        p_customer_id: customerId,
        p_identifier_value: identifierValue
      })
    
    if (error) throw error
    return data?.[0] || null
  }

  // Get all prices for a customer
  static async getCustomerPrices(customerId: string) {
    const { data, error } = await supabase
      .from('customer_item_prices')
      .select('*')
      .eq('customer_id', customerId)
    
    if (error) throw error
    return data
  }

  // Bulk operations
  static async bulkAddIdentifiers(identifiers: Omit<ItemIdentifier, 'id' | 'created_at'>[]) {
    const { data, error } = await supabase
      .from('item_identifiers')
      .insert(identifiers)
      .select()
    
    if (error) throw error
    return data
  }
}
```

## 6. React Hooks

### `hooks/use-pricing.ts`

```typescript
import { useState, useEffect } from 'react'
import { PricingService } from '@/lib/services/pricing-service'
import type { CustomerItemPrice } from '@/types/database'

export function useCustomerPrice(customerId: string, identifierValue: string) {
  const [price, setPrice] = useState<CustomerItemPrice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    async function fetchPrice() {
      try {
        setLoading(true)
        const data = await PricingService.getCustomerPrice(customerId, identifierValue)
        setPrice(data)
      } catch (err) {
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    if (customerId && identifierValue) {
      fetchPrice()
    }
  }, [customerId, identifierValue])

  return { price, loading, error }
}

export function useCustomerPrices(customerId: string) {
  const [prices, setPrices] = useState<CustomerItemPrice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    async function fetchPrices() {
      try {
        setLoading(true)
        const data = await PricingService.getCustomerPrices(customerId)
        setPrices(data || [])
      } catch (err) {
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    if (customerId) {
      fetchPrices()
    }
  }, [customerId])

  return { prices, loading, error }
}
```

## 7. Example Components

### `components/price-lookup.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useCustomerPrice } from '@/hooks/use-pricing'

export function PriceLookup() {
  const [customerId, setCustomerId] = useState('')
  const [identifier, setIdentifier] = useState('')
  const { price, loading, error } = useCustomerPrice(customerId, identifier)

  return (
    <div className="p-4 max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-4">Price Lookup</h2>
      
      <div className="space-y-4">
        <input
          type="text"
          placeholder="Customer ID"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="w-full p-2 border rounded"
        />
        
        <input
          type="text"
          placeholder="UPC, GTIN, or Part Number"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          className="w-full p-2 border rounded"
        />
        
        {loading && <p>Loading...</p>}
        
        {error && (
          <p className="text-red-500">Error: {error.message}</p>
        )}
        
        {price && (
          <div className="bg-gray-100 p-4 rounded">
            <h3 className="font-bold">{price.item_name}</h3>
            <p>Item ID: {price.item_id}</p>
            <p>Warehouse: {price.warehouse_name}</p>
            <p className="text-2xl font-bold">${price.price}</p>
            <p className="text-sm text-gray-600">
              Found by {price.identifier_type}: {price.identifier_used}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
```

### `components/item-management.tsx`

```typescript
'use client'

import { useState } from 'react'
import { PricingService } from '@/lib/services/pricing-service'

export function ItemManagement() {
  const [itemData, setItemData] = useState({
    item_id: '',
    name: '',
    description: ''
  })
  
  const [identifiers, setIdentifiers] = useState([
    { type: 'UPC', value: '' },
    { type: 'GTIN', value: '' },
    { type: 'BUYER_PART_NUMBER', value: '' }
  ])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // Create item
      const item = await PricingService.createItem(itemData)
      
      // Add identifiers
      const identifierPromises = identifiers
        .filter(id => id.value)
        .map(id => PricingService.addIdentifier({
          item_id: item.id,
          identifier_type: id.type as any,
          identifier_value: id.value
        }))
      
      await Promise.all(identifierPromises)
      
      alert('Item created successfully!')
      
      // Reset form
      setItemData({ item_id: '', name: '', description: '' })
      setIdentifiers([
        { type: 'UPC', value: '' },
        { type: 'GTIN', value: '' },
        { type: 'BUYER_PART_NUMBER', value: '' }
      ])
    } catch (error) {
      alert('Error creating item: ' + error.message)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 max-w-md mx-auto space-y-4">
      <h2 className="text-2xl font-bold">Add New Item</h2>
      
      <input
        type="text"
        placeholder="Item ID"
        value={itemData.item_id}
        onChange={(e) => setItemData({ ...itemData, item_id: e.target.value })}
        className="w-full p-2 border rounded"
        required
      />
      
      <input
        type="text"
        placeholder="Item Name"
        value={itemData.name}
        onChange={(e) => setItemData({ ...itemData, name: e.target.value })}
        className="w-full p-2 border rounded"
        required
      />
      
      <textarea
        placeholder="Description"
        value={itemData.description}
        onChange={(e) => setItemData({ ...itemData, description: e.target.value })}
        className="w-full p-2 border rounded"
      />
      
      <div className="space-y-2">
        <h3 className="font-bold">Identifiers</h3>
        {identifiers.map((id, index) => (
          <input
            key={id.type}
            type="text"
            placeholder={id.type}
            value={id.value}
            onChange={(e) => {
              const newIdentifiers = [...identifiers]
              newIdentifiers[index].value = e.target.value
              setIdentifiers(newIdentifiers)
            }}
            className="w-full p-2 border rounded"
          />
        ))}
      </div>
      
      <button
        type="submit"
        className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
      >
        Create Item
      </button>
    </form>
  )
}
```

## 8. Example API Routes (App Router)

### `app/api/pricing/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { PricingService } from '@/lib/services/pricing-service'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const customerId = searchParams.get('customerId')
  const identifier = searchParams.get('identifier')

  if (!customerId || !identifier) {
    return NextResponse.json(
      { error: 'Missing customerId or identifier' },
      { status: 400 }
    )
  }

  try {
    const price = await PricingService.getCustomerPrice(customerId, identifier)
    return NextResponse.json(price)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch price' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Example: Create item with identifiers
    if (body.action === 'createItem') {
      const { item, identifiers } = body
      const createdItem = await PricingService.createItem(item)
      
      if (identifiers && identifiers.length > 0) {
        const identifierData = identifiers.map((id: any) => ({
          ...id,
          item_id: createdItem.id
        }))
        await PricingService.bulkAddIdentifiers(identifierData)
      }
      
      return NextResponse.json(createdItem)
    }
    
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    return NextResponse.json(
      { error: 'Operation failed' },
      { status: 500 }
    )
  }
}
```

## 9. Usage Example Page

### `app/pricing/page.tsx`

```typescript
import { PriceLookup } from '@/components/price-lookup'
import { ItemManagement } from '@/components/item-management'

export default function PricingPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold text-center mb-8">
        Warehouse Pricing System
      </h1>
      
      <div className="grid md:grid-cols-2 gap-8">
        <PriceLookup />
        <ItemManagement />
      </div>
    </div>
  )
}
```

## 10. Sample Data Setup Script

### `scripts/seed-data.ts`

```typescript
import { PricingService } from '@/lib/services/pricing-service'

async function seedData() {
  try {
    // Create warehouses
    const warehouse1 = await PricingService.createWarehouse({
      warehouse_id: 'WH001',
      name: 'East Coast Warehouse',
      location: 'New York'
    })
    
    const warehouse2 = await PricingService.createWarehouse({
      warehouse_id: 'WH002',
      name: 'West Coast Warehouse',
      location: 'California'
    })
    
    // Create items
    const item1 = await PricingService.createItem({
      item_id: 'ITEM001',
      name: 'Widget A',
      description: 'High-quality widget'
    })
    
    // Add identifiers
    await PricingService.bulkAddIdentifiers([
      {
        item_id: item1.id,
        identifier_type: 'UPC',
        identifier_value: '123456789012'
      },
      {
        item_id: item1.id,
        identifier_type: 'GTIN',
        identifier_value: '00123456789012'
      },
      {
        item_id: item1.id,
        identifier_type: 'BUYER_PART_NUMBER',
        identifier_value: 'CUST-001-A'
      }
    ])
    
    // Set pricing
    await PricingService.setWarehousePricing({
      item_id: item1.id,
      warehouse_id: warehouse1.id,
      price: 10.99,
      effective_date: new Date().toISOString()
    })
    
    await PricingService.setWarehousePricing({
      item_id: item1.id,
      warehouse_id: warehouse2.id,
      price: 12.99,
      effective_date: new Date().toISOString()
    })
    
    // Create customer
    const customer1 = await PricingService.createCustomer({
      customer_id: 'CUST001',
      name: 'Acme Corporation'
    })
    
    // Assign customer to warehouse
    await PricingService.assignCustomerWarehouse({
      customer_id: customer1.id,
      item_id: item1.id,
      warehouse_id: warehouse1.id
    })
    
    console.log('Data seeded successfully!')
  } catch (error) {
    console.error('Error seeding data:', error)
  }
}

seedData()
```

This implementation provides:

1. **Complete database schema** with proper relationships and constraints
2. **Type-safe TypeScript interfaces** for all entities
3. **Service layer** with all CRUD operations
4. **React hooks** for easy data fetching
5. **Example components** for price lookup and item management
6. **API routes** for server-side operations
7. **Row Level Security** enabled for production use
8. **Optimized queries** with indexes and views
9. **Flexible identifier system** supporting UPC, GTIN, and custom part numbers
10. **Customer-specific warehouse assignments** determining pricing

The system allows you to:
- Look up items by any identifier type
- Manage customer-specific warehouse assignments
- Track pricing by warehouse
- Handle multiple identifier types per item
- Scale easily with proper indexes and database design