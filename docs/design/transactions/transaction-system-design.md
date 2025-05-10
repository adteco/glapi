# Revenue Recognition System: Transaction System Design

## 1. Introduction & Vision

**Goal:** To establish a flexible, robust, and scalable transactional framework at the core of the Revenue Recognition System. This system is inspired by the comprehensive and adaptable nature of transaction handling in ERP systems like NetSuite.

**Core Concept:** The foundation will be a generic `Transaction` header entity and a related `TransactionLine` detail entity. These common structures will be specialized or "decorated" to represent a wide array of business documents and operations, ensuring consistency and reusability across the application.

**Benefits:**
-   **Consistency:** Standardized way to handle all operational documents.
-   **Reusability:** Common logic for creating, updating, and querying transactions can be reused.
-   **Simplified Reporting:** Easier to build consolidated reports and analytics across different transaction types.
-   **Streamlined Integrations:** A predictable structure simplifies integration with payment gateways (e.g., Stripe) and accounting/ERP systems (e.g., NetSuite).
-   **Scalability:** Designed to accommodate new transaction types and business processes as the system evolves.
-   **Auditability:** Centralized transaction data provides a clear audit trail.

## 2. Core Entities & Data Model Considerations

Below are the primary tables envisioned for this system. Detailed SQL schema will be developed using Drizzle ORM. Values like gross profit will be calculated in the business logic layer, not stored directly in these tables.

### 2.1. `Transactions` (Header Table)
This table will store common information applicable to all transaction types.

-   `transaction_id` (UUID, Primary Key)
-   `transaction_type` (ENUM, Not Null): Discriminator column identifying the specific type of transaction (e.g., 'Estimate', 'SalesOrder', 'Invoice', 'ItemReceipt', 'ItemFulfillment', 'Opportunity', 'CreditMemo', 'VendorBill').
-   `document_number` (VARCHAR, Unique per type or globally, Indexed): System-generated or manually entered identifier.
-   `transaction_date` (DATE, Not Null, Indexed): The primary date of the transaction.
-   `entity_id` (UUID, Not Null, Indexed, FK): Links to an `Entities` table (Customer, Vendor, Employee, Partner).
-   `subsidiary_id` (UUID, Not Null, Indexed, FK): Links to the `Subsidiaries` table.
-   `currency_id` (UUID, Not Null, FK): Links to a `Currencies` table (e.g., ISO 4217 codes).
-   `exchange_rate` (DECIMAL, Not Null, Default: 1.0): Exchange rate to base currency if `currency_id` is foreign.
-   `status_id` (UUID, Nullable, FK): Links to a `TransactionStatuses` table, which would be type-specific (e.g., 'Estimate - Open', 'Sales Order - Pending Fulfillment', 'Invoice - Paid').
-   `posting_period_id` (UUID, Nullable, FK): Links to `AccountingPeriods` for financial transactions.
-   `due_date` (DATE, Nullable): For transactions like Invoices or Bills.
-   `total_amount` (DECIMAL, Not Null): Calculated sum of line amounts, potentially including taxes and discounts.
-   `memo` (TEXT, Nullable): General notes or comments for the entire transaction.
-   `created_from_transaction_id` (UUID, Nullable, FK): Link to the source transaction (e.g., Invoice created from Sales Order).
-   `created_by_user_id` (UUID, Nullable, FK to Users table)
-   `created_at` (TIMESTAMP WITH TIME ZONE, Default: NOW())
-   `updated_by_user_id` (UUID, Nullable, FK to Users table)
-   `updated_at` (TIMESTAMP WITH TIME ZONE, Default: NOW())

### 2.2. `TransactionLines` (Detail Table)
This table stores item-level details for each transaction.

-   `transaction_line_id` (UUID, Primary Key)
-   `transaction_id` (UUID, Not Null, Indexed, FK to `Transactions`)
-   `line_number` (INTEGER, Not Null): Sequential line number within the transaction.
-   `item_id` (UUID, Not Null, Indexed, FK to `Items` table): The product or service.
-   `quantity` (DECIMAL, Not Null)
-   `units_id` (UUID, Nullable, FK to `UnitsOfMeasure` table).
-   `rate` (DECIMAL, Not Null): Price per unit in the transaction currency.
-   `amount` (DECIMAL, Not Null): Calculated as `quantity * rate` (before discounts applicable directly to the line).
-   `description` (TEXT, Nullable): Defaults from `Items.description` but overridable per line.
-   `department_id` (UUID, Nullable, Indexed, FK to `Departments` table).
-   `class_id` (UUID, Nullable, Indexed, FK to `Classes` table).
-   `location_id` (UUID, Nullable, Indexed, FK to `Locations` table).
-   `activity_code_id` (UUID, Nullable, Indexed, FK to `ActivityCodes` table).
-   `unit_cost` (DECIMAL, Nullable): The cost per unit for this item on this specific transaction line. Can default from `Items.standard_cost`.
-   `cost_estimate_type` (ENUM, Nullable): Source/method for `unit_cost` (e.g., 'ITEM_STANDARD', 'LAST_PURCHASE', 'AVERAGE_COST', 'MANUAL_OVERRIDE').
    *   Note: `estimated_line_cost` (`unit_cost * quantity`) and `estimated_gross_profit` (`amount - estimated_line_cost`) are calculated in the business logic layer.
-   `ssp` (DECIMAL, Nullable): Standalone Selling Price for this item on this line, used for revenue allocation.
-   `allocated_transaction_price` (DECIMAL, Nullable): Portion of the transaction price allocated to this line for revenue recognition.
-   `performance_obligation_id` (UUID, Nullable, FK to `PerformanceObligations` table): Links line to a specific POB.
-   `is_taxable` (BOOLEAN, Default: true)
-   `tax_code_id` (UUID, Nullable, FK to `TaxCodes` table)
-   `tax_amount` (DECIMAL, Default: 0)
-   `discount_amount` (DECIMAL, Default: 0)
-   `gross_amount` (DECIMAL, Not Null): `amount - discount_amount + tax_amount` (or similar calculation based on rules).
-   `linked_order_line_id` (UUID, Nullable, FK to `TransactionLines`): For linking invoice/fulfillment lines back to sales order lines.
-   `custom_fields` (JSONB, Nullable): For type-specific or user-defined line fields.

### 2.3. `Items` (Products/Services Table)
Represents all sellable products, services, discount types, tax items etc.

-   `item_id` (UUID, Primary Key)
-   `item_name` (VARCHAR, Not Null)
-   `item_code` (VARCHAR, Unique, Not Null, Indexed)
-   `item_type_id` (UUID, Not Null, FK to `ItemTypes` table: e.g., 'Inventory Part', 'NonInventory Part', 'Service', 'Other Charge', 'Discount', 'Tax Item', 'Tax Group').
-   `description` (TEXT, Nullable)
-   `standard_cost` (DECIMAL, Nullable): The standard, default, or item-defined cost for one unit of this item.
-   `costing_method` (ENUM, Nullable): Primary inventory costing method (e.g., 'STANDARD', 'AVERAGE', 'FIFO', 'LIFO').
-   `default_ssp` (DECIMAL, Nullable): Default Standalone Selling Price.
-   `default_recognition_pattern_id` (UUID, Nullable, FK to `RevenueRecognitionPatterns` table).
-   `is_active` (BOOLEAN, Default: true)
-   Standard cost, pricing tiers, etc. can be added.

### 2.4. Organizational Dimension Tables
These tables provide segmentation for reporting and control, inspired by NetSuite's structure.

-   **`Subsidiaries`:**
    *   `subsidiary_id` (UUID, Primary Key)
    *   `name` (VARCHAR, Not Null)
    *   `parent_id` (UUID, Nullable, FK to `Subsidiaries` for hierarchical structure)
    *   `base_currency_id` (UUID, Not Null, FK to `Currencies`)
    *   `country_code` (VARCHAR(2))
    *   `is_active` (BOOLEAN, Default: true)

-   **`Departments`:**
    *   `department_id` (UUID, Primary Key)
    *   `name` (VARCHAR, Not Null)
    *   `subsidiary_id` (UUID, Nullable, FK to `Subsidiaries`): If departments are restricted by subsidiary.
    *   `is_active` (BOOLEAN, Default: true)

-   **`Classes`:**
    *   `class_id` (UUID, Primary Key)
    *   `name` (VARCHAR, Not Null)
    *   `subsidiary_id` (UUID, Nullable, FK to `Subsidiaries`): If classes are restricted by subsidiary.
    *   `is_active` (BOOLEAN, Default: true)

-   **`Locations`:** (e.g., Warehouses, Stores, Offices)
    *   `location_id` (UUID, Primary Key)
    *   `name` (VARCHAR, Not Null)
    *   `address_id` (UUID, Nullable, FK to an `Addresses` table)
    *   `subsidiary_id` (UUID, Nullable, FK to `Subsidiaries`)
    *   `is_active` (BOOLEAN, Default: true)

-   **`ActivityCodes`:** (Custom segments for project accounting, grants, etc.)
    *   `activity_code_id` (UUID, Primary Key)
    *   `name` (VARCHAR, Not Null)
    *   `description` (TEXT, Nullable)
    *   `is_active` (BOOLEAN, Default: true)

### 2.5. `Entities` Table
Represents customers, vendors, employees, partners.

-   `entity_id` (UUID, Primary Key)
-   `entity_type` (ENUM: 'Customer', 'Vendor', 'Employee', 'Partner', Not Null)
-   `company_name` (VARCHAR, Nullable)
-   `first_name` (VARCHAR, Nullable)
-   `last_name` (VARCHAR, Nullable)
-   `email` (VARCHAR, Indexed)
-   `primary_subsidiary_id` (UUID, FK to `Subsidiaries`)
-   `default_currency_id` (UUID, FK to `Currencies`)
-   Detailed fields (address, contacts) can be in related tables or JSONB.

### 2.6. Supporting Tables
-   `Currencies`: `currency_id`, `code` (e.g., USD), `symbol`, `name`.
-   `UnitsOfMeasure`: `units_id`, `name`, `abbreviation`.
-   `TransactionStatuses`: `status_id`, `status_name`, `applies_to_transaction_type` (ENUM).
-   `AccountingPeriods`: `period_id`, `name`, `start_date`, `end_date`, `is_closed`.
-   `TaxCodes`, `TaxGroups`, `TaxRates`.
-   `RevenueRecognitionPatterns` (similar to previous data model).
-   `PerformanceObligations` (similar to previous data model, but now linked to `TransactionLines`).

## 3. Specialization of Transactions

The generic `Transaction` and `TransactionLine` model serves as the base. Specific transaction types will be realized through:

1.  **`transaction_type` Discriminator:** This field in the `Transactions` table is key.
2.  **Type-Specific Extension Tables (Preferred for Normalization):**
    *   For transaction types that have a significant number of unique fields not applicable to others, a separate table can be created with a 1-to-1 relationship to the `Transactions` table.
    *   Example: `SalesOrderDetails` table with `transaction_id` as both PK and FK to `Transactions.transaction_id`. It would hold fields like `requested_delivery_date`, `sales_rep_id`, etc.
    *   Example: `InvoiceDetails` table with `terms_id`, `payment_method_id`.
3.  **Business Logic Layer:** Services (e.g., in AWS Lambdas, MCP Server, or a dedicated `packages/business` layer) will implement the unique validation rules, status transitions, workflows, and side effects for each `transaction_type`.
    *   For instance, creating an Invoice from a Sales Order will involve specific logic to copy lines, check quantities, link documents, and update statuses.
4.  **User Interface (UI):** The frontend will render different forms and views based on the `transaction_type`, showing relevant fields and actions.

## 4. Key Workflows & Interactions (High-Level Examples)

-   **Quote-to-Cash:** Opportunity -> Estimate/Quote -> Sales Order -> Item Fulfillment(s) -> Invoice(s) -> Customer Payment.
    *   Each step is a `Transaction` of a different `transaction_type`.
    *   `created_from_transaction_id` and `linked_order_line_id` fields will trace the lineage.
-   **Procure-to-Pay:** Purchase Requisition -> Purchase Order -> Item Receipt(s) -> Vendor Bill -> Vendor Payment.
-   **Revenue Recognition Trigger:** The creation or update of certain transaction types (e.g., Sales Order, Invoice, Item Fulfillment) will trigger the creation or update of `PerformanceObligations`. Revenue schedules will then be derived from these POBs and the associated `TransactionLine` details (allocated price, recognition pattern from `Items`).

## 5. Integration Points

This transactional model is designed with integration in mind:

-   **Stripe:** Invoices (a `Transaction` type) can be paid via Stripe. Payment status updates from Stripe will update the Invoice status.
-   **NetSuite:** Key financial transactions (Sales Orders, Invoices, Item Fulfillments, Vendor Bills, Journal Entries derived from revenue recognition) will be formatted and synced to NetSuite.
    *   The organizational dimensions (Subsidiary, Department, Class, Location) are designed to map directly or indirectly to NetSuite segments, facilitating cleaner synchronization.

## 6. Open Questions & Areas for Further Definition

-   Detailed field list for each specific transaction type extension table.
-   Specific status transition diagrams for each major transaction type.
-   Exact mapping strategy for organizational dimensions to NetSuite segments.
-   Handling of intercompany transactions if multiple subsidiaries trade with each other.
-   Detailed design for `PerformanceObligations` derivation from `TransactionLines`.
-   Advanced pricing: volume discounts, customer-specific pricing, promotional pricing logic.
-   Taxation engine details.
-   Detailed logic for calculating and sourcing `unit_cost` based on `costing_method` and `cost_estimate_type`. 