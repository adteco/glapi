# Transaction Design: Estimates

This document details the design for the **Estimate** (also known as Quote or Proposal) transaction type within the Revenue Recognition System. It builds upon the foundational concepts outlined in the `transaction-system-design.md` document.

## 1. Purpose and Problem Solved

**Purpose:** An Estimate is a non-binding document provided to a prospective or existing customer, detailing the proposed products, services, quantities, and prices for a potential sale. It serves as a formal offer and a basis for negotiation before a binding sales agreement (like a Sales Order) is established.

**Problems Solved:**
-   Provides customers with a clear understanding of potential costs and offerings.
-   Facilitates sales discussions and negotiations.
-   Acts as a preliminary step in the sales cycle, formalizing interest.
-   Can be used for internal forecasting and tracking sales pipeline health (when combined with probability).
-   Standardizes the quotation process.

## 2. Specific Fields & Data Considerations

Estimates will primarily use the common fields from the `Transactions` and `TransactionLines` tables as defined in `transaction-system-design.md`. The `transaction_type` in the `Transactions` table will be 'Estimate'.

### 2.1. Estimate-Specific Header Fields

These fields might reside in a dedicated `EstimateDetails` extension table (1:1 with `Transactions` where `transaction_type` = 'Estimate') or as nullable fields in the `Transactions` table if the number of specific fields is small.

-   `transaction_id` (PK, FK to `Transactions.transaction_id`)
-   `expiration_date` (DATE, Nullable): Date when the estimate is no longer considered valid by the issuing company.
-   `probability_percent` (INTEGER, Nullable, Min: 0, Max: 100): Sales representative's assessment of the likelihood this estimate will convert into a sale. Useful for sales forecasting.
-   `sales_rep_user_id` (UUID, Nullable, FK to Users/Employees table): The sales representative responsible for this estimate.
-   `terms_and_conditions_id` (UUID, Nullable, FK to a `TermsAndConditionsTemplates` table or a TEXT field directly for custom terms):
    *   If FK, allows selection from predefined templates.
    *   A direct TEXT field allows for custom entry per estimate.
-   `next_follow_up_date` (DATE, Nullable): For sales reps to schedule a follow-up with the customer.

### 2.2. Estimate-Specific Line Fields

Generally, the common fields in `TransactionLines` are sufficient for estimates. Line-level `custom_fields` (JSONB) can be used for any unique, unstructured data if needed.

-   Consideration: `is_optional_item` (BOOLEAN, Default: false) on `TransactionLines` could be useful if quotes often include optional add-ons that don't contribute to the primary total until selected.

## 3. Unique Statuses & Lifecycle

The `status_id` in the `Transactions` table will link to `TransactionStatuses` specific to the 'Estimate' type.

**Example Statuses for Estimates:**
-   `Draft`: Initial creation, not yet sent to customer.
-   `Open` / `Presented`: Sent to the customer, awaiting response.
-   `Negotiating`: Actively being discussed or revised based on customer feedback.
-   `Accepted`: Customer has formally or informally agreed to the terms. This is a trigger to potentially create a Sales Order.
-   `Closed - Lost`: Customer has declined the estimate.
-   `Closed - Converted`: A Sales Order has been created from this estimate.
-   `Expired`: The `expiration_date` has passed, and no action was taken.

**Lifecycle / Workflow:**
1.  **Creation:** A sales user creates an Estimate, adding customer details, items, quantities, and pricing.
2.  **Presentation:** The Estimate is sent to the customer (e.g., via email as a PDF).
3.  **Negotiation (Optional):** Customer may request changes, leading to revisions of the Estimate.
4.  **Customer Decision:**
    *   **Accepted:** The Estimate can be used as a basis to create a Sales Order (often with a "Convert to Sales Order" action).
    *   **Declined:** The Estimate is marked as 'Closed - Lost'.
    *   **No Response:** If the `expiration_date` passes, it may be automatically or manually moved to 'Expired'.
5.  **Financial Impact:** Estimates typically do **not** have any direct general ledger (GL) impact and do not affect inventory stock levels.

## 4. Key Use Cases

-   A new lead requests pricing for a software package and implementation services.
-   An existing customer requests a quote for an add-on service or license renewal.
-   Sales team prepares multiple estimate options for a customer to choose from.
-   Tracking the conversion rate of estimates to sales orders.
-   Sales managers reviewing open estimates and their probabilities for forecasting.

## 5. User Interface (UI) Considerations

-   **Creation/Edit Form:**
    *   Clear selection for `Customer` (`entity_id`).
    *   Editable `transaction_date`, `expiration_date`, `probability_percent`, `sales_rep_user_id`.
    *   Dynamic grid for adding/editing `TransactionLines`:
        *   `Item` selection (searchable product/service catalog).
        *   Input for `quantity`, `rate` (can default from item, but be overridable).
        *   Display of `amount` and line `description`.
        *   Ability to apply line-level discounts or select promotional pricing if applicable at this stage.
        *   Selection of `Department`, `Class`, `Location`, `ActivityCode` per line.
    *   Calculated subtotal, taxes (if estimated), and total amount.
    *   Section for `memo` and `terms_and_conditions`.
-   **View Mode:** Clean, printable/PDF-exportable view of the Estimate details.
-   **Actions Available:** 'Save Draft', 'Present to Customer' (email/PDF), 'Revise', 'Convert to Sales Order', 'Mark as Accepted', 'Mark as Lost', 'Clone Estimate'.
-   **List View:** Searchable and filterable list of all estimates, with columns for document number, customer, date, total amount, status, probability, sales rep, expiration date.

## 6. Relationships to Other Transaction Types

-   **Sales Order:** The primary relationship. An 'Accepted' Estimate is often the direct precursor to a Sales Order. The `SalesOrder.created_from_transaction_id` would reference the `Estimate.transaction_id`.
-   **Opportunity:** If an Opportunity management module exists (another `transaction_type` or separate entity), an Estimate can be linked to an Opportunity, representing a specific proposal made under that opportunity.
-   **Customer (`Entities` table):** An Estimate is always associated with a customer entity.

## 7. Revenue Recognition Impact

-   Estimates **do not** directly trigger revenue recognition.
-   They do not create Performance Obligations (POBs) in the context of ASC 606 / IFRS 15, as they are non-binding offers.
-   However, the item details, quantities, rates, and any identified SSPs on an accepted Estimate will heavily inform the creation of POBs and revenue allocation when a binding Sales Order is subsequently created from it. 