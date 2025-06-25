# Existing Tables in Database

Based on the introspection results, the following tables already exist in the database:

## Core Entity Tables
- `entities` - Unified entity table for customers, vendors, employees, contacts, etc.
- `addresses` - Address information for entities
- `organizations` - Organizations (Stytch integration)
- `users` - User accounts (Stytch integration)

## Accounting Dimension Tables
- `subsidiaries` - Subsidiary companies
- `departments` - Department organizational units
- `classes` - Business classes/divisions
- `locations` - Physical locations
- `accounts` - Chart of accounts

## Transaction Tables
- `business_transactions` - Main business transaction table
- `business_transaction_lines` - Line items for business transactions
- `transaction_relationships` - Relationships between transactions
- `transaction_lines` - Another transaction line table (possibly legacy)
- `transaction_types` - Transaction type definitions

## General Ledger Tables
- `gl_transactions` - GL journal entries
- `gl_transaction_lines` - GL journal entry lines
- `gl_account_balances` - Account balances by period
- `gl_posting_rules` - Rules for posting to GL
- `gl_audit_trail` - Audit trail for GL changes

## Revenue Recognition Tables
- `contracts` - Customer contracts
- `contract_line_items` - Contract line items
- `contract_ssp_allocations` - SSP allocations for contracts
- `performance_obligations` - Performance obligations
- `revenue_schedules` - Revenue recognition schedules
- `revenue_journal_entries` - Revenue journal entries
- `revenue_recognition_patterns` - Recognition pattern definitions
- `ssp_evidence` - Standalone selling price evidence

## Reference/Configuration Tables
- `accounting_periods` - Fiscal periods
- `currencies` - Currency definitions
- `exchange_rates` - Currency exchange rates
- `payment_terms` - Payment term definitions
- `products` - Product catalog
- `activity_codes` - Activity codes for time tracking
- `tax_codes` - Tax code definitions
- `units_of_measure` - Units of measure

## Security/Access Control Tables
- `roles` - User roles
- `permissions` - Permission definitions
- `role_permissions` - Role-permission mappings
- `user_roles` - User-role assignments
- `user_subsidiary_access` - User access to subsidiaries

## Other Tables
- `test_gl` - Test table (should be removed in production)

## Enum Types (PostgreSQL)
- `account_category_enum`
- `allocation_method`
- `confidence_level`
- `contract_status`
- `cost_estimate_type_enum`
- `entity_type_enum`
- `entry_type`
- `evidence_type`
- `job_status_enum`
- `obligation_type`
- `pattern_type`
- `performance_obligation_status_enum`
- `product_type`
- `recognition_source`
- `recognition_type`
- `satisfaction_method`
- `ssp_allocation_method`
- `ssp_source`
- `time_entry_billed_status_enum`

## Tables to Avoid Creating in Migration
All of the above tables already exist in the database and should not be recreated. Any migration should only add new tables or modify existing ones as needed.