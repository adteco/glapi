# RLS Policy Audit Report

**Audit Date:** 2026-01-23
**Audited By:** Automated analysis of schema files
**Scope:** All tables with `organization_id` column in `packages/database/src/db/schema/`

---

## Executive Summary

This audit identifies all database tables that have an `organization_id` column and cross-references them against existing Row-Level Security (RLS) policies. Currently, only the **Items subsystem** has RLS policies implemented.

- **Total Tables with organization_id:** 90+
- **Tables WITH RLS:** 12
- **Tables NEEDING RLS:** 78+

---

## Tables WITH RLS (Already Covered)

The following tables have RLS policies defined in `packages/database/src/scripts/items-rls-policies.sql`:

| Table Name | RLS Type | Notes |
|------------|----------|-------|
| `units_of_measure` | Direct `organization_id` check | Standard CRUD policies |
| `item_categories` | Direct `organization_id` check | Standard CRUD policies |
| `items` | Direct `organization_id` check | Standard CRUD policies |
| `price_lists` | Direct `organization_id` check | Standard CRUD policies |
| `lot_numbers` | Direct `organization_id` check | Standard CRUD policies |
| `serial_numbers` | Direct `organization_id` check | Standard CRUD policies |
| `item_audit_log` | Direct `organization_id` check | SELECT/INSERT only (audit immutability) |
| `item_pricing` | Indirect via item + price_list | Uses helper functions |
| `customer_price_lists` | Indirect via customer + price_list | Uses helper functions |
| `vendor_items` | Indirect via vendor + item | Uses helper functions |
| `assembly_components` | Indirect via parent + component items | Uses helper functions |
| `kit_components` | Indirect via kit + component items | Uses helper functions |

### Helper Functions Defined
- `get_current_organization_id()` - Gets org_id from session or JWT
- `check_item_organization(item_id)` - Validates item ownership
- `check_price_list_organization(price_list_id)` - Validates price list ownership
- `check_vendor_organization(vendor_id)` - Validates vendor entity ownership
- `check_customer_organization(customer_id)` - Validates customer entity ownership

---

## Tables NEEDING RLS (The Gap)

### Priority 1: Core Financial & Revenue (CRITICAL)
These tables contain sensitive financial data and are the highest priority.

| Table Name | Schema File | Notes |
|------------|-------------|-------|
| `contracts` | contracts.ts | Core revenue recognition |
| `contract_line_items` | contract_line_items.ts | Line item details |
| `contract_modifications` | contract-modifications.ts | Amendment tracking |
| `contract_ssp_allocations` | contract-ssp-allocations.ts | SSP allocations |
| `invoices` | invoices.ts | AR invoices |
| `invoice_line_items` | invoice-line-items.ts | Invoice line items |
| `payments` | payments.ts | Payment records |
| `customer_payments` | customer-payments.ts | Customer payment receipts |
| `customer_payment_applications` | customer-payments.ts | Payment-to-invoice applications |
| `bank_deposits` | customer-payments.ts | Bank deposit batches |
| `bank_reconciliation_exceptions` | customer-payments.ts | Reconciliation exceptions |
| `customer_credit_memos` | customer-payments.ts | Credit memos |
| `revenue_schedules` | revenue-schedules.ts | Recognition schedules |
| `revenue_journal_entries` | revenue-journal-entries.ts | Revenue JEs |
| `performance_obligations` | performance-obligations.ts | POBs |
| `ssp_evidence` | ssp-evidence.ts | SSP evidence records |

### Priority 2: Accounting & GL (HIGH)
GL transactions and accounting configuration.

| Table Name | Schema File | Notes |
|------------|-------------|-------|
| `accounts` | accounts.ts | Chart of accounts |
| `gl_account_mappings` | gl-account-mappings.ts | GL mapping rules |
| `gl_period_end_batches` | gl-account-mappings.ts | Period-end JE batches |
| `gl_journal_entries` | gl-journal-entries.ts | GL journal entries |
| `journal_entry_batches` | journal-entry-batches.ts | JE batches |
| `accounting_periods` | accounting-periods.ts | Period management |
| `accounting_lists` | accounting-lists.ts | Payment terms, methods, charge types |

### Priority 3: Procure-to-Pay (HIGH)
Vendor bills and purchase orders.

| Table Name | Schema File | Notes |
|------------|-------------|-------|
| `purchase_orders` | purchase-orders.ts | PO headers |
| `purchase_order_lines` | purchase-orders.ts | PO line items |
| `purchase_order_receipts` | purchase-orders.ts | Receipt headers |
| `purchase_order_receipt_lines` | purchase-orders.ts | Receipt line items |
| `vendor_bills` | vendor-bills.ts | AP invoices |
| `vendor_bill_lines` | vendor-bills.ts | Bill line items |
| `bill_payments` | vendor-bills.ts | Bill payment records |
| `vendor_credit_memos` | vendor-bills.ts | Vendor credits |

### Priority 4: Project Accounting (HIGH)
Project-related financial data.

| Table Name | Schema File | Notes |
|------------|-------------|-------|
| `projects` | projects.ts | Project headers |
| `project_cost_codes` | projects.ts | Cost codes |
| `project_progress_snapshots` | project-progress.ts | Progress tracking |
| `project_schedule_of_values` | schedule-of-values.ts | SOV items |
| `sov_line_items` | schedule-of-values.ts | SOV line details |
| `pay_applications` | pay-applications.ts | Progress billing |
| `pay_application_line_items` | pay-applications.ts | Pay app lines |
| `retainage_releases` | pay-applications.ts | Retainage tracking |

### Priority 5: Time & Expense (MEDIUM)
Employee time and expense tracking.

| Table Name | Schema File | Notes |
|------------|-------------|-------|
| `time_entries` | time-entries.ts | Time records |
| `time_entry_approvals` | time-entries.ts | Approval audit trail |
| `labor_cost_rates` | time-entries.ts | Rate cards |
| `employee_project_assignments` | time-entries.ts | Project assignments |
| `time_entry_batches` | time-entries.ts | Batch submissions |
| `expense_entries` | expense-entries.ts | Expense records |
| `expense_attachments` | expense-entries.ts | Receipt attachments |
| `expense_entry_approvals` | expense-entries.ts | Approval trail |
| `expense_reports` | expense-entries.ts | Expense reports |
| `expense_report_items` | expense-entries.ts | Report line items (no org_id directly, via parent) |
| `expense_policies` | expense-entries.ts | Policy configuration |

### Priority 6: Subscriptions & Billing (MEDIUM)
Subscription and billing management.

| Table Name | Schema File | Notes |
|------------|-------------|-------|
| `subscriptions` | subscriptions.ts | Subscription headers |
| `subscription_items` | subscription-items.ts | Subscription line items |
| `subscription_versions` | subscription-versions.ts | Version history |
| `billing_schedules` | billing-schedules.ts | Billing schedule headers |
| `billing_schedule_lines` | billing-schedules.ts | Schedule line items |

### Priority 7: Project Tasks & Templates (MEDIUM)
Project management features.

| Table Name | Schema File | Notes |
|------------|-------------|-------|
| `project_milestones` | project-tasks.ts | Milestone tracking |
| `project_task_templates` | project-tasks.ts | Task templates |
| `project_tasks` | project-tasks.ts | Task instances |
| `project_templates` | project-tasks.ts | Project templates |

### Priority 8: Analytics & Forecasting (MEDIUM)
Analytical and forecasting data.

| Table Name | Schema File | Notes |
|------------|-------------|-------|
| `ssp_calculation_runs` | ssp-analytics.ts | SSP calc runs |
| `vsoe_evidence` | ssp-analytics.ts | VSOE analysis |
| `ssp_pricing_bands` | ssp-analytics.ts | Pricing bands |
| `ssp_exceptions` | ssp-analytics.ts | SSP exceptions |
| `revenue_forecast_runs` | revenue-forecasting.ts | Forecast runs |
| `revenue_forecast_details` | revenue-forecasting.ts | Forecast details (via parent) |
| `cohort_analysis` | revenue-forecasting.ts | Cohort analysis |
| `scenario_analysis` | revenue-forecasting.ts | Scenario modeling |
| `churn_predictions` | revenue-forecasting.ts | Churn predictions |
| `deferred_rollforward` | revenue-forecasting.ts | Deferred revenue rollforward |

### Priority 9: Audit & Compliance (MEDIUM)
Audit trail and compliance records.

| Table Name | Schema File | Notes |
|------------|-------------|-------|
| `unified_audit_log` | audit-logs.ts | Centralized audit trail |
| `audit_evidence_packages` | audit-logs.ts | Evidence packages |
| `change_requests` | audit-logs.ts | Change management |
| `approval_instances` | approval-workflow.ts | Approval workflow instances |

### Priority 10: Infrastructure & Configuration (LOWER)
System configuration and reference data.

| Table Name | Schema File | Notes |
|------------|-------------|-------|
| `entities` | entities.ts | Customers/vendors/employees |
| `users` | users.ts | User accounts (app-level users) |
| `subsidiaries` | subsidiaries.ts | Subsidiary entities |
| `departments` | departments.ts | Departments |
| `locations` | locations.ts | Locations |
| `classes` | classes.ts | Classes |
| `activity_codes` | activity-codes.ts | Activity codes |
| `tax_codes` | tax-codes.ts | Tax codes |
| `currencies` | currencies.ts | Currency definitions |
| `addresses` | addresses.ts | Address records |
| `warehouses` | warehouses.ts | Warehouse locations |
| `customer_warehouse_assignments` | warehouses.ts | Customer-warehouse links |
| `onboarding_sessions` | onboarding.ts | Onboarding tracking |

### Priority 11: Data Import & Export (LOWER)
Import/export staging and configuration.

| Table Name | Schema File | Notes |
|------------|-------------|-------|
| `import_batches` | import-staging.ts | Import batch tracking |
| `import_field_mappings` | import-staging.ts | Field mapping config |
| `import_templates` | import-staging.ts | Import templates |
| `delivery_queue` | delivery-queue.ts | Outbound delivery queue |
| `delivery_attempts` | delivery-queue.ts | Delivery attempt logs |
| `report_schedules` | report-schedules.ts | Scheduled reports |
| `report_job_executions` | report-schedules.ts | Report execution logs |

### Priority 12: Event Sourcing & Consolidation (LOWER)
Event store and consolidation features.

| Table Name | Schema File | Notes |
|------------|-------------|-------|
| `event_store` | event-store.ts | Event sourcing store |
| `event_outbox` | event-store.ts | Outbox pattern |
| `event_projections` | event-store.ts | Projection state |
| `consolidation_groups` | consolidation.ts | Consolidation groups |
| `consolidation_runs` | consolidation.ts | Consolidation runs |
| `elimination_entries` | consolidation.ts | Elimination entries |
| `workflows` | workflows.ts | Workflow definitions |
| `workflow_instances` | workflows.ts | Workflow instances |

### Priority 13: Metrics & Pricing (LOWER)
Metrics tables and pricing.

| Table Name | Schema File | Notes |
|------------|-------------|-------|
| `saas_metrics_daily` | metrics.ts | Daily SaaS metrics |
| `saas_metrics_monthly` | metrics.ts | Monthly SaaS metrics |
| `customer_health_scores` | metrics.ts | Customer health |
| `pricing` | pricing.ts | Price list configuration |

---

## Tables Requiring Special Handling

### 1. Cross-Organization References
Some tables may need special handling for cross-org scenarios:

| Table | Consideration |
|-------|---------------|
| `consolidation_groups` | May involve multiple orgs in enterprise scenarios |
| `consolidation_group_members` | References subsidiaries from potentially different orgs |
| `intercompany_relationships` | By definition, involves multiple entities |

### 2. System-Wide Tables (No org_id)
These tables intentionally do not have organization_id:

| Table | Reason |
|-------|--------|
| `roles` | System-defined roles (RBAC) |
| `permissions` | System-defined permissions |
| `role_permissions` | System permission assignments |
| `currencies` | Global currency definitions |

### 3. Junction Tables (Indirect RLS)
These tables should use indirect RLS through their parent tables:

| Table | Parent Relationship |
|-------|---------------------|
| `expense_report_items` | Via expense_report_id AND expense_entry_id |
| `revenue_forecast_details` | Via forecast_run_id |
| `consolidation_group_members` | Via group_id |
| `workflow_steps` | Via workflow_id |

### 4. Audit Tables (Append-Only)
Audit tables should only allow INSERT and SELECT, never UPDATE or DELETE:

| Table | Policy Notes |
|-------|--------------|
| `unified_audit_log` | SELECT + INSERT only |
| `item_audit_log` | Already implemented correctly |
| `expense_entry_approvals` | Append-only audit trail |
| `time_entry_approvals` | Append-only audit trail |

---

## Recommendations

### Implementation Strategy

1. **Phase 1 (Immediate):** Core Financial tables (Priority 1)
   - These contain the most sensitive data
   - Implement standard CRUD policies with org_id check
   - Estimated effort: 2-3 days

2. **Phase 2 (Short-term):** Accounting & GL + Procure-to-Pay (Priority 2-3)
   - High business impact
   - Follow same pattern as Phase 1
   - Estimated effort: 2-3 days

3. **Phase 3 (Medium-term):** Project Accounting + Time/Expense (Priority 4-5)
   - Important for construction accounting use cases
   - Estimated effort: 2-3 days

4. **Phase 4 (Ongoing):** Remaining tables (Priority 6-13)
   - Can be implemented incrementally
   - Consider batching by schema file
   - Estimated effort: 4-5 days

### Technical Approach

1. **Reuse Helper Functions**
   - The `get_current_organization_id()` function is already implemented
   - Create additional helpers as needed (e.g., `check_project_organization()`, `check_contract_organization()`)

2. **Standard Policy Template**
   ```sql
   -- For tables with direct organization_id
   CREATE POLICY "policy_name"
     ON table_name FOR [SELECT|INSERT|UPDATE|DELETE]
     USING (organization_id = get_current_organization_id())
     WITH CHECK (organization_id = get_current_organization_id());
   ```

3. **Indirect RLS Pattern**
   ```sql
   -- For junction/child tables
   CREATE POLICY "policy_name"
     ON child_table FOR SELECT
     USING (check_parent_organization(parent_id));
   ```

4. **Testing Considerations**
   - Test with multiple organizations
   - Verify cross-org data isolation
   - Test junction table access patterns
   - Validate audit table restrictions

---

## Appendix: Full Table List by Schema File

### accounts.ts
- accounts (org_id: YES)

### accounting-lists.ts
- accounting_lists (org_id: YES)

### accounting-periods.ts
- accounting_periods (org_id: likely YES - needs verification)

### activity-codes.ts
- activity_codes (org_id: YES)

### addresses.ts
- addresses (org_id: YES)

### approval-workflow.ts
- approval_instances (org_id: YES)

### assemblies-kits.ts
- assembly_components (org_id: COVERED via items RLS)
- kit_components (org_id: COVERED via items RLS)

### audit-logs.ts
- change_requests (org_id: YES)
- unified_audit_log (org_id: YES)
- audit_evidence_packages (org_id: YES)

### billing-schedules.ts
- billing_schedules (org_id: YES)
- billing_schedule_lines (org_id: YES)

### catch-up-adjustments.ts
- catch_up_adjustments (org_id: YES via contract-modifications.ts)

### churn-predictions.ts
- churn_predictions (org_id: YES)

### classes.ts
- classes (org_id: YES)

### close-management.ts
- close_management (org_id: likely YES - needs verification)

### cohort-analysis.ts
- cohort_analysis (org_id: YES)

### consolidation.ts
- consolidation_groups (org_id: YES)
- consolidation_group_members (org_id: NO - uses parent group)
- elimination_rules (org_id: NO - uses parent group)
- consolidation_runs (org_id: YES)
- elimination_entries (org_id: YES)

### contract-modifications.ts
- contract_modifications (org_id: YES)
- catch_up_adjustments (org_id: YES)

### contract-ssp-allocations.ts
- contract_ssp_allocations (org_id: YES)

### contracts.ts
- contracts (org_id: YES)

### contract_line_items.ts
- contract_line_items (org_id: via contract)

### currencies.ts
- currencies (org_id: NO - global)

### customer-payments.ts
- customer_payments (org_id: YES)
- customer_payment_applications (org_id: YES)
- bank_deposits (org_id: YES)
- bank_reconciliation_exceptions (org_id: YES)
- customer_credit_memos (org_id: YES)

### delivery-queue.ts
- delivery_queue (org_id: YES)
- delivery_attempts (org_id: YES)

### departments.ts
- departments (org_id: YES)

### entities.ts
- entities (org_id: YES)

### event-store.ts
- event_store (org_id: YES)
- event_outbox (org_id: YES)
- event_projections (org_id: YES)

### expense-entries.ts
- expense_entries (org_id: YES)
- expense_attachments (org_id: YES)
- expense_entry_approvals (org_id: NO - via expense_entry)
- expense_reports (org_id: YES)
- expense_report_items (org_id: NO - via report)
- expense_policies (org_id: YES)

### gl-account-mappings.ts
- gl_account_mappings (org_id: YES)
- gl_period_end_batches (org_id: YES)

### gl-journal-entries.ts
- gl_journal_entries (org_id: YES)

### gl-transactions.ts
- gl_transactions (org_id: likely YES - needs verification)

### import-staging.ts
- import_batches (org_id: YES)
- import_field_mappings (org_id: YES)
- import_templates (org_id: YES, nullable)

### inventory-tracking.ts
- lot_numbers (org_id: COVERED)
- serial_numbers (org_id: COVERED)

### invoice-line-items.ts
- invoice_line_items (org_id: via invoice)

### invoices.ts
- invoices (org_id: YES)

### item-audit-log.ts
- item_audit_log (org_id: COVERED)

### item-categories.ts
- item_categories (org_id: COVERED)

### items.ts
- items (org_id: COVERED)

### journal-entry-batches.ts
- journal_entry_batches (org_id: YES)

### kit-components.ts
- kit_components (org_id: COVERED)

### locations.ts
- locations (org_id: YES)

### metrics.ts
- saas_metrics_daily (org_id: YES)
- saas_metrics_monthly (org_id: YES)
- customer_health_scores (org_id: YES)

### modification-line-items.ts
- modification_line_items (org_id: via modification)

### onboarding.ts
- onboarding_sessions (org_id: YES)

### organizations.ts
- organizations (org_id: N/A - this IS the org table)

### pay-applications.ts
- pay_applications (org_id: YES)
- pay_application_line_items (org_id: via pay_app)
- retainage_releases (org_id: YES)

### payments.ts
- payments (org_id: YES)

### performance-obligations.ts
- performance_obligations (org_id: YES)

### pricing.ts
- price_lists (org_id: COVERED under items RLS)
- item_pricing (org_id: COVERED under items RLS)

### project-progress.ts
- project_progress_snapshots (org_id: YES)

### project-tasks.ts
- project_milestones (org_id: YES)
- project_task_templates (org_id: YES)
- project_tasks (org_id: YES)
- project_templates (org_id: YES)

### projects.ts
- projects (org_id: YES)
- project_cost_codes (org_id: via project)
- external_references (org_id: YES)

### purchase-orders.ts
- purchase_orders (org_id: YES)
- purchase_order_lines (org_id: via PO)
- purchase_order_receipts (org_id: YES)
- purchase_order_receipt_lines (org_id: via receipt)

### report-schedules.ts
- report_schedules (org_id: YES)
- report_job_executions (org_id: YES)

### revenue-enums.ts
- (no tables, only enums)

### revenue-forecasting.ts
- revenue_forecast_runs (org_id: YES)
- revenue_forecast_details (org_id: via run)
- cohort_analysis (org_id: YES)
- scenario_analysis (org_id: YES)
- churn_predictions (org_id: YES)
- deferred_rollforward (org_id: YES)

### revenue-journal-entries.ts
- revenue_journal_entries (org_id: YES)

### revenue-schedules.ts
- revenue_schedules (org_id: YES)

### rls-access-control.ts
- roles (org_id: NO - system-wide)
- permissions (org_id: NO - system-wide)
- role_permissions (org_id: NO - system-wide)
- entity_roles (org_id: NO - via entity)
- entity_subsidiary_access (org_id: NO - via entity)

### sales-orders.ts
- sales_orders (org_id: YES)
- sales_order_lines (org_id: via SO)

### scenario-analysis.ts
- scenario_analysis (org_id: YES)

### schedule-of-values.ts
- project_schedule_of_values (org_id: YES)
- sov_line_items (org_id: via SOV)

### ssp-analytics.ts
- ssp_calculation_runs (org_id: YES)
- vsoe_evidence (org_id: YES)
- ssp_pricing_bands (org_id: YES)
- ssp_exceptions (org_id: YES)

### ssp-evidence.ts
- ssp_evidence (org_id: YES)

### subscription-items.ts
- subscription_items (org_id: YES)

### subscription-versions.ts
- subscription_versions (org_id: YES)

### subscriptions.ts
- subscriptions (org_id: YES)

### subsidiaries.ts
- subsidiaries (org_id: YES)

### tax-codes.ts
- tax_codes (org_id: likely YES)

### time-entries.ts
- time_entries (org_id: YES)
- time_entry_approvals (org_id: via time_entry)
- labor_cost_rates (org_id: YES)
- employee_project_assignments (org_id: YES)
- time_entry_batches (org_id: YES)

### transaction-types.ts
- transaction_types (org_id: likely)

### units-of-measure.ts
- units_of_measure (org_id: COVERED)

### users.ts
- users (org_id: YES)

### vendor-bills.ts
- vendor_bills (org_id: YES)
- vendor_bill_lines (org_id: via bill)
- bill_payments (org_id: YES)
- vendor_credit_memos (org_id: YES)

### vendor-items.ts
- vendor_items (org_id: COVERED)

### warehouses.ts
- warehouses (org_id: YES)
- customer_warehouse_assignments (org_id: YES)

### workflows.ts
- workflows (org_id: YES, nullable for templates)
- workflow_steps (org_id: via workflow)
- workflow_instances (org_id: via workflow)

---

*End of Audit Report*
