# Schema Comparison: Introspected vs Custom

## Overview
This document compares the introspected database schema with our custom Drizzle schemas to identify differences and plan the reconciliation strategy.

## Key Differences Found

### 1. Foreign Key Implementation
- **Introspected**: Uses `.foreignKey()` in table configuration
- **Custom**: Uses inline `.references()` on column definitions
- **Impact**: Functional equivalence, but custom approach is cleaner

### 2. Missing Foreign Keys in Introspection
- The introspection missed some foreign key relationships (e.g., `accounts.organizationId` -> `organizations.id`)
- This suggests the database might be missing some foreign key constraints

### 3. Timestamp Modes
- **Introspected**: `{ withTimezone: true, mode: 'string' }`
- **Custom**: `{ withTimezone: true }`
- **Impact**: String mode affects how dates are handled in TypeScript

### 4. Relations (Critical Difference)
- **Introspected**: No relations defined (introspection doesn't capture ORM relations)
- **Custom**: Extensive relations defined for Drizzle ORM queries
- **Impact**: Must preserve custom relations for ORM functionality

### 5. Indexes
- Both schemas have similar indexes, but some are commented out in custom schemas
- Need to verify if these indexes exist in database

### 6. Enum Imports
- **Introspected**: Enums defined in same file
- **Custom**: Enums imported from separate file
- **Impact**: Better organization in custom approach

## Tables Status

### Existing Tables (from introspection)
- ✅ accounts
- ✅ organizations
- ✅ subsidiaries
- ✅ departments
- ✅ classes
- ✅ locations
- ✅ entities
- ✅ addresses
- ✅ users
- ✅ products
- ✅ units_of_measure
- ✅ tax_codes
- ✅ activity_codes
- ✅ currencies
- ✅ accounting_periods
- ✅ exchange_rates
- ✅ payment_terms
- ✅ transaction_types
- ✅ business_transactions
- ✅ business_transaction_lines
- ✅ transaction_relationships
- ✅ gl_transactions
- ✅ gl_transaction_lines
- ✅ gl_account_balances
- ✅ gl_posting_rules
- ✅ gl_audit_trail
- ✅ contracts
- ✅ contract_line_items
- ✅ contract_ssp_allocations
- ✅ performance_obligations
- ✅ revenue_schedules
- ✅ revenue_journal_entries
- ✅ revenue_recognition_patterns
- ✅ ssp_evidence
- ✅ roles
- ✅ permissions
- ✅ role_permissions
- ✅ user_roles
- ✅ user_subsidiary_access
- ✅ test_gl
- ✅ __drizzle_migrations

### New Tables to Add (Items System)
- ❌ items
- ❌ item_categories
- ❌ price_lists
- ❌ item_pricing
- ❌ customer_price_lists
- ❌ vendor_items
- ❌ lot_numbers
- ❌ serial_numbers
- ❌ assembly_components
- ❌ kit_components
- ❌ item_audit_log

## Reconciliation Strategy

### For Existing Tables:
1. Keep introspected table structure as base (it reflects database reality)
2. Copy over all relations from custom schemas
3. Preserve custom type imports and organization
4. Keep inline `.references()` style for foreign keys
5. Maintain existing indexes

### For New Tables:
1. Use custom schemas as-is
2. Ensure foreign keys reference correct existing tables
3. Verify enum types exist or create them
4. Add appropriate indexes based on query patterns

## Action Items
1. Create unified schema files that combine introspected structure with custom relations
2. Ensure all foreign key constraints exist in database
3. Add missing indexes if needed
4. Create migration for new items tables only