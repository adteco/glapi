# Database Package - Drizzle ORM Guide

This package manages all database operations for the GLAPI project using Drizzle ORM with PostgreSQL.

## Table of Contents
- [Architecture Overview](#architecture-overview)
- [Schema Design Principles](#schema-design-principles)
- [Row-Level Security (RLS)](#row-level-security-rls)
- [Working with Drizzle](#working-with-drizzle)
- [Common Patterns](#common-patterns)
- [Migration Guide](#migration-guide)
- [Troubleshooting](#troubleshooting)

## Architecture Overview

```
packages/database/
├── src/
│   ├── db/
│   │   ├── client.ts          # Database connection
│   │   └── schema/            # Drizzle schema definitions
│   ├── repositories/          # Data access layer
│   └── scripts/              # Utility scripts
├── drizzle/                  # Generated migrations
├── drizzle.config.ts        # Drizzle configuration
└── index.ts                 # Package exports
```

## Schema Design Principles

### 1. Use `text` Type for String Fields

We use PostgreSQL's `text` type instead of `varchar` for all string fields:

```typescript
// ✅ CORRECT
export const accounts = pgTable('accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: text('organization_id').notNull(),
  accountName: text('account_name').notNull(),
  // ...
});

// ❌ INCORRECT - Don't use varchar
export const accounts = pgTable('accounts', {
  organizationId: varchar('organization_id', { length: 255 }).notNull(),
  // ...
});
```

**Why?** 
- PostgreSQL treats `text` and `varchar` the same internally
- `text` is simpler and doesn't require length specifications
- Avoids migration issues when field lengths need to change

### 2. Organization ID Pattern

All tables that need organization-level isolation include an `organizationId` field:

```typescript
export const customers = pgTable('customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: text('organization_id').notNull(), // Clerk org ID format: org_xxx
  // ... other fields
});
```

**Important:** We store Clerk organization IDs directly (format: `org_xxx`) without foreign key constraints to an organizations table. This simplifies RLS implementation and improves performance.

### 3. File Naming Convention

**Important:** Drizzle introspection generates files based on database table names. To avoid manual renaming after each introspection, we follow this naming pattern:

- **Database table**: `units_of_measure` (snake_case)
- **Generated file**: `units-of-measure.ts` (kebab-case)
- **Exported const**: `unitsOfMeasure` (camelCase)
- **Import statement**: `import { unitsOfMeasure } from './units-of-measure';`

Example:
```typescript
// File: src/db/schema/units-of-measure.ts
export const unitsOfMeasure = pgTable('units_of_measure', {
  id: uuid('id').defaultRandom().primaryKey(),
  // ... fields
});

// Import in another file:
import { unitsOfMeasure } from './units-of-measure';
```

This ensures compatibility with Drizzle's introspection while maintaining consistent imports.

### 4. Consistent Field Patterns

All tables should follow these patterns:

```typescript
export const tableName = pgTable('table_name', {
  // Primary key
  id: uuid('id').defaultRandom().primaryKey(),
  
  // Organization context (if needed)
  organizationId: text('organization_id').notNull(),
  
  // Core fields
  name: text('name').notNull(),
  code: text('code'),
  description: text('description'),
  
  // Status
  isActive: boolean('is_active').default(true).notNull(),
  
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

### 5. Indexes

Add indexes for commonly queried fields:

```typescript
export const accounts = pgTable('accounts', {
  // ... fields
}, (table) => ({
  orgNumberIdx: index('accounts_org_number_idx').on(table.organizationId, table.accountNumber),
}));
```

## Row-Level Security (RLS)

We implement RLS at the application level, not the database level. Every repository method must filter by `organizationId`:

### Repository Pattern

```typescript
export class CustomerRepository extends BaseRepository {
  async findById(id: string, organizationId: string) {
    const result = await this.db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.id, id),
          eq(customers.organizationId, organizationId) // Always filter by org
        )
      )
      .limit(1);
    
    return result[0];
  }

  async findAll(organizationId: string) {
    return await this.db
      .select()
      .from(customers)
      .where(eq(customers.organizationId, organizationId)); // Always filter by org
  }
}
```

### Service Layer Pattern

The service layer receives organization context from the authenticated request:

```typescript
export class CustomerService {
  constructor(private context: { organizationId: string; userId: string }) {}

  async getCustomer(id: string) {
    return await this.repository.findById(id, this.context.organizationId);
  }
}
```

## Working with Drizzle

### Commands

```bash
# Generate TypeScript types from schema
pnpm db:generate

# Create migration files
pnpm db:migrate

# Push schema changes directly to database (development only)
pnpm db:push

# Test database connection
pnpm test:connection
```

### Creating a New Schema

1. Create the schema file in `src/db/schema/`:

```typescript
// src/db/schema/products.ts
import { pgTable, uuid, text, boolean, timestamp, decimal } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: text('organization_id').notNull(),
  productCode: text('product_code').notNull(),
  productName: text('product_name').notNull(),
  price: decimal('price', { precision: 10, scale: 2 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Define relations if needed
export const productRelations = relations(products, ({ one, many }) => ({
  // Define relationships here
}));
```

2. Export from `src/db/schema/index.ts`:

```typescript
export * from './products';
```

3. Create the repository in `src/repositories/`:

```typescript
// src/repositories/product-repository.ts
import { BaseRepository } from './base-repository';
import { products } from '../db/schema';
import { eq, and } from 'drizzle-orm';

export class ProductRepository extends BaseRepository {
  async findById(id: string, organizationId: string) {
    const result = await this.db
      .select()
      .from(products)
      .where(
        and(
          eq(products.id, id),
          eq(products.organizationId, organizationId)
        )
      )
      .limit(1);
    
    return result[0];
  }

  async create(data: NewProduct) {
    const result = await this.db
      .insert(products)
      .values(data)
      .returning();
    
    return result[0];
  }
}

export const productRepository = new ProductRepository();
```

4. Generate and run migrations:

```bash
pnpm db:generate
pnpm db:migrate
```

## Common Patterns

### 1. Unique Constraints

For fields that should be unique within an organization:

```typescript
export const accounts = pgTable('accounts', {
  // ... fields
}, (table) => ({
  uniqueOrgNumber: unique('accounts_org_number_unique')
    .on(table.organizationId, table.accountNumber),
}));
```

### 2. Enum Types

Define enums in `src/db/schema/enums.ts`:

```typescript
export const statusEnum = pgEnum('status_enum', ['active', 'inactive', 'pending']);

// Use in schema
export const orders = pgTable('orders', {
  status: statusEnum('status').default('pending').notNull(),
});
```

### 3. Self-Referencing Tables

```typescript
export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  parentId: uuid('parent_id').references((): AnyPgColumn => categories.id),
  // ... other fields
});
```

### 4. JSON Fields

```typescript
export const products = pgTable('products', {
  metadata: jsonb('metadata'), // Store arbitrary JSON data
});
```

## Migration Guide

### Manual Migration Example

When you need to change schema design patterns (like the org ID migration):

```sql
-- 1. Drop foreign key constraints
ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_organization_id_organizations_id_fk;

-- 2. Change column types
ALTER TABLE classes ALTER COLUMN organization_id TYPE TEXT USING organization_id::TEXT;

-- 3. Update existing data
UPDATE classes SET organization_id = 'org_development' 
WHERE organization_id = 'organization-default-dev';
```

### Migration Best Practices

1. **Always backup before migrations**
2. **Test migrations on a copy of production data**
3. **Use transactions for data updates**
4. **Keep migrations idempotent when possible**

## Troubleshooting

### Common Issues

#### 1. "text is not defined" Error

**Problem:** Forgot to import `text` from drizzle-orm
```typescript
// ❌ Missing import
import { pgTable, uuid, boolean, timestamp } from 'drizzle-orm/pg-core';

// ✅ Correct import
import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';
```

#### 2. Foreign Key Conflicts

**Problem:** Trying to reference a table that uses different ID types
```typescript
// ❌ Mismatched types
organizationId: uuid('organization_id').references(() => organizations.id),
// But organizations.id is text, not uuid!

// ✅ No foreign key, just store the ID
organizationId: text('organization_id').notNull(),
```

#### 3. Migration Failures

**Problem:** Generated migration doesn't match database state

**Solution:** 
1. Check current database state: `pnpm db:push --dry-run`
2. Manually adjust migration if needed
3. Mark migration as applied if already executed manually

### Development Tips

1. **Use `db:push` during development** for rapid iteration
2. **Generate migrations for production** to track schema changes
3. **Always test with realistic data volumes**
4. **Monitor query performance** with EXPLAIN ANALYZE

## Security Considerations

1. **Never trust client-provided organizationId** - Always use the authenticated context
2. **Validate organization ownership** when accessing related entities
3. **Use parameterized queries** - Drizzle handles this automatically
4. **Audit sensitive operations** - Log who changed what and when

## Future Improvements

- [ ] Add database-level RLS policies as defense in depth
- [ ] Implement soft deletes pattern
- [ ] Add audit trail functionality
- [ ] Create data archival strategy