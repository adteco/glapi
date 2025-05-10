# Integrations

This document outlines the integration points with external services, specifically Stripe for payments and NetSuite for ERP/accounting synchronization.

## 1. Stripe Payment Module

### Purpose
Process payments for new contracts and potentially recurring subscriptions. Manage payment statuses and provide a seamless checkout experience.

### Data Flow
1.  **Payment Initiation:** User selects a product/service package in the Next.js frontend. The frontend calculates the total amount due, considering any applicable promotions.
2.  **Stripe Checkout:** The user is redirected to Stripe Checkout (or a Stripe Elements powered form within the app) to securely enter payment details.
3.  **Payment Confirmation:** Upon successful payment, Stripe processes the transaction.
4.  **Stripe Webhooks:** Stripe sends a webhook event (e.g., `checkout.session.completed`, `invoice.payment_succeeded`) to a dedicated endpoint handled by a new AWS Lambda function (`payment-processor-lambda`).
5.  **Lambda Processing (`payment-processor-lambda`):**
    *   Verifies the webhook signature to ensure authenticity.
    *   Retrieves relevant transaction details from the webhook payload (e.g., Stripe charge ID, customer ID, amount paid, subscription ID if applicable).
    *   Updates the corresponding contract in the Supabase database:
        *   Sets `payment_status` to 'paid' (or similar).
        *   Stores `stripe_charge_id` and/or `stripe_subscription_id`.
        *   May trigger the contract status to move to 'active' if payment was the final step.
    *   Creates or updates a customer record in the database if necessary, potentially linking to a Stripe Customer ID.
    *   Logs the payment transaction details in a dedicated `payments` table for audit and reconciliation.
    *   Returns a `200 OK` response to Stripe to acknowledge receipt of the webhook.

### Impact on Data Model

*   **`contracts` Table:**
    *   Add `payment_status` (ENUM: 'pending', 'paid', 'failed', 'refunded').
    *   Add `stripe_charge_id` (VARCHAR, nullable).
    *   Add `stripe_subscription_id` (VARCHAR, nullable, for recurring services).
*   **New `payments` Table:**
    ```sql
    CREATE TABLE payments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        contract_id UUID REFERENCES contracts(id),
        stripe_charge_id VARCHAR(255) UNIQUE NOT NULL,
        stripe_event_id VARCHAR(255) UNIQUE, -- To ensure webhook idempotency
        amount_paid DECIMAL(12,2) NOT NULL,
        currency VARCHAR(3) NOT NULL,
        payment_date TIMESTAMP WITH TIME ZONE NOT NULL,
        status VARCHAR(50) NOT NULL, -- e.g., 'succeeded', 'failed'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    ```
*   **`customers` Table:**
    *   Consider adding `stripe_customer_id` (VARCHAR, nullable).

### Key Touchpoints & Considerations
*   **Frontend:** UI for checkout initiation, handling Stripe.js/Elements.
*   **New Lambda:** `payment-processor-lambda` (Node.js/TypeScript).
    *   Needs secure handling of Stripe webhook secrets.
    *   Implement robust error handling and retry mechanisms for webhook processing.
    *   Ensure idempotency for webhook handling (e.g., by checking `stripe_event_id`).
*   **Services:**
    *   Updates to `ContractService` or a new `PaymentService` to handle payment status updates.
*   **Security:** Protect Stripe API keys and webhook secrets.
*   **Recurring Payments:** If maintenance or other services are subscription-based, configure Stripe Subscriptions and handle recurring payment webhooks (`invoice.payment_succeeded`, `customer.subscription.updated`, etc.).

## 2. NetSuite Integration Module

### Purpose
Synchronize financial data (journal entries, recognized revenue, customer data, contract details) from the Revenue Recognition System to NetSuite for consolidated accounting, financial reporting, and ERP operations.

### Data Flow (Likely Batch/Scheduled)
1.  **Scheduled Trigger:** An AWS EventBridge (CloudWatch Events) rule triggers a new Lambda function (`netsuite-sync-lambda`) on a defined schedule (e.g., daily, hourly).
2.  **Data Extraction (`netsuite-sync-lambda`):**
    *   Queries the Supabase database for new or updated financial records since the last successful sync. This typically includes:
        *   `revenue_journal_entries` marked as `is_posted = false` (or a similar flag indicating readiness for export).
        *   Potentially new/updated `customers` or `contracts` data if this needs to be synchronized.
3.  **Data Transformation:**
    *   Formats the extracted data according to NetSuite's API requirements or expected CSV structure. This may involve:
        *   Mapping internal account codes/names to NetSuite's Chart of Accounts.
        *   Transforming date formats.
        *   Aggregating data if necessary.
4.  **Data Loading to NetSuite:**
    *   Utilizes NetSuite's SuiteTalk (SOAP or REST web services) or batch CSV import capabilities to send the transformed data.
    *   Handles authentication securely with NetSuite (e.g., Token-Based Authentication - TBA).
5.  **Logging and Status Updates:**
    *   Logs the outcome of each synchronization attempt (success, failure, records processed).
    *   Upon successful posting to NetSuite, updates the records in the Supabase database (e.g., set `revenue_journal_entries.is_posted = true`, store `netsuite_internal_id`).
    *   Implements error handling for API failures, data validation issues from NetSuite, etc.
    *   Sends notifications for critical failures.

### Impact on Data Model

*   **`revenue_journal_entries` Table:**
    *   `is_posted` (BOOLEAN DEFAULT false) - already present, but its role is critical here.
    *   Add `netsuite_sync_status` (ENUM: 'pending', 'success', 'failed', 'skipped', nullable).
    *   Add `netsuite_internal_id` (VARCHAR, nullable, to store NetSuite's internal ID for the created record).
    *   Add `netsuite_sync_timestamp` (TIMESTAMP WITH TIME ZONE, nullable).
    *   Add `netsuite_error_message` (TEXT, nullable).
*   **`customers` and `contracts` Tables (Optional):**
    *   If customer/contract master data is synced, similar fields for `netsuite_internal_id`, `netsuite_sync_status`, etc., might be needed.
*   **New Configuration Table (Optional but Recommended):**
    ```sql
    CREATE TABLE netsuite_config (
        id SERIAL PRIMARY KEY,
        config_key VARCHAR(100) UNIQUE NOT NULL,
        config_value TEXT,
        description TEXT,
        last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    -- Example rows: NETSUITE_API_ENDPOINT, NETSUITE_ACCOUNT_ID, NETSUITE_TOKEN_ID, NETSUITE_TOKEN_SECRET, LAST_SYNC_TIMESTAMP
    ```
    *   This table could also store G/L account mappings if they are configurable.

### Key Touchpoints & Considerations
*   **New Lambda:** `netsuite-sync-lambda` (Node.js/TypeScript).
    *   Requires a robust HTTP client for SuiteTalk or CSV generation/upload logic.
    *   Secure management of NetSuite credentials (e.g., using AWS Secrets Manager).
*   **Services:** Potential for a `NetSuiteService` within the Lambda to encapsulate API interaction logic.
*   **Error Handling & Reconciliation:**
    *   Implement comprehensive error logging and retry mechanisms.
    *   Provide a mechanism for manual reconciliation or re-syncing failed records.
*   **Data Volume:** For large data volumes, consider batching API calls or using NetSuite's asynchronous processing capabilities.
*   **API Limits:** Be mindful of NetSuite API concurrency and daily usage limits.
*   **Mapping Logic:** The logic for mapping internal data structures and accounts to NetSuite's requirements can be complex and needs careful definition.
*   **Idempotency:** Ensure that if the sync process is re-run, it doesn't create duplicate entries in NetSuite (e.g., by checking if `netsuite_internal_id` already exists for a record). 