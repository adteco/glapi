# Jobs/Projects and Time Tracking System Design

## 1. Overview

This document outlines the design for a Jobs/Projects and Time Tracking system. The primary goal is to allow users to manage distinct pieces of work (Jobs/Projects) for customers, track time spent on these jobs, and ultimately use this information for billing and revenue recognition.

This system will integrate with existing entities like Customers and will feed into the Invoicing process.

## 2. Core Entities

### 2.1. Jobs/Projects

Represents a distinct unit of work undertaken for a customer. It serves as a container for related transactions (Estimates, Sales Orders, Invoices) and activities (Time Entries).

*   **Purpose:**
    *   Organize and track work for specific customer engagements.
    *   Group related financial transactions and effort.
    *   Provide a basis for project-based reporting and profitability analysis.
*   **Key Attributes:**
    *   `id`: UUID, Primary Key
    *   `job_number`: VARCHAR, Unique, system-generated or user-defined identifier.
    *   `job_name`: VARCHAR, Descriptive name for the job/project.
    *   `customer_id`: UUID, Foreign Key referencing `entities.id` (where `entity_type` is 'Customer').
    *   `description`: TEXT, Optional, further details about the job.
    *   `status_id`: UUID, Foreign Key referencing a new `job_statuses` table (e.g., Not Started, In Progress, Completed, On Hold, Canceled, Billed).
    *   `start_date`: DATE, Proposed or actual start date of the job.
    *   `end_date`: DATE, Proposed or actual end date of the job.
    *   `estimated_hours`: DECIMAL, Optional, budgeted hours for the job.
    *   `actual_hours`: DECIMAL, Calculated, sum of hours from linked time entries.
    *   `estimated_cost`: DECIMAL, Optional, budgeted cost for the job.
    *   `actual_cost`: DECIMAL, Calculated or tracked, actual cost incurred.
    *   `estimated_revenue`: DECIMAL, Optional, from linked estimates or sales orders.
    *   `actual_revenue`: DECIMAL, Calculated, from linked invoices.
    *   `subsidiary_id`: UUID, Foreign Key referencing `subsidiaries.id` (for organizational context).
    *   `created_at`: TIMESTAMP, Record creation timestamp.
    *   `updated_at`: TIMESTAMP, Record update timestamp.
*   **Relationships:**
    *   `Customer (Entity)`: Many-to-One (One Customer can have many Jobs).
    *   `Transactions` (`transactions` table): One-to-Many (One Job can have multiple Estimates, Sales Orders, Invoices linked, possibly via a `job_id` foreign key on the `transactions` table or a linking table).
    *   `Time Entries` (`time_entries` table): One-to-Many (One Job can have many Time Entries).
    *   `Job Statuses` (`job_statuses` table): Many-to-One.
*   **High-Level Workflow:**
    1.  Job Creation: Associated with a customer, initial details entered.
    2.  Job Active: Transactions (Estimates, SOs) are created and linked. Time is tracked against the job.
    3.  Job Monitoring: Progress, budget vs. actuals are tracked.
    4.  Job Completion: Job is marked as completed.
    5.  Billing: Invoices are generated based on job progress, time entries, or deliverables.
    6.  Closure/Archival: Job is closed out after all financial activities are settled.

### 2.2. Time Entries

Represents a record of time spent by a user/employee on a specific Job/Project or task within that job.

*   **Purpose:**
    *   Track effort spent on jobs/projects.
    *   Provide data for billing customers for services rendered.
    *   Inform project costing and profitability analysis.
    *   Support payroll calculations if applicable.
*   **Key Attributes:**
    *   `id`: UUID, Primary Key
    *   `job_id`: UUID, Foreign Key referencing `jobs.id`.
    *   `user_id`: UUID, Foreign Key referencing a `users` table (system user who performed the work, assuming a `users` table will exist for app users/employees).
    *   `entry_date`: DATE, Date the work was performed.
    *   `hours_worked`: DECIMAL (e.g., precision 5, scale 2), Number of hours spent.
    *   `service_item_id`: UUID, Optional, Foreign Key referencing `items.id` (if time is tracked against specific service items).
    *   `activity_description`: TEXT, Description of the work performed or activity.
    *   `is_billable`: BOOLEAN, Indicates if the time entry should be billed to the customer.
    *   `billing_rate`: DECIMAL, Optional, rate to use for billing this specific entry (could default from job, user, or service item).
    *   `billed_status`: pgEnum('time_entry_billed_status', ['Not Billed', 'Billed', 'Non-Billable']), Tracks if the entry has been included on an invoice.
    *   `invoice_line_id`: UUID, Optional, Foreign Key referencing `transaction_lines.id` (if linked to a specific invoice line).
    *   `notes`: TEXT, Optional, additional comments about the time entry.
    *   `created_at`: TIMESTAMP, Record creation timestamp.
    *   `updated_at`: TIMESTAMP, Record update timestamp.
*   **Relationships:**
    *   `Job/Project`: Many-to-One (Many Time Entries can belong to one Job).
    *   `User/Employee`: Many-to-One (Many Time Entries can be logged by one User).
    *   `Item (Service Item)`: Many-to-One (Optional, if time is tied to specific service items).
    *   `Transaction Line (Invoice Line)`: Many-to-One (Optional, to link a billed time entry to its invoice line).
*   **High-Level Workflow:**
    1.  Time Logging: User selects a job, enters date, hours, description, billable status.
    2.  Approval (Optional): Time entries might go through an approval workflow.
    3.  Invoicing: Billable, unbilled time entries are selected and added to an invoice for the job's customer.
    4.  Reporting: Time data is used for job costing, utilization reports, etc.

### 2.3. Job Statuses (New Supporting Table)

Defines the possible statuses a Job/Project can be in.

*   **Attributes:**
    *   `id`: UUID, Primary Key
    *   `status_name`: VARCHAR, Unique (e.g., "Not Started", "Planning", "In Progress", "On Hold", "Pending Customer", "Completed", "Invoiced", "Closed", "Canceled").
    *   `description`: TEXT, Optional.
    *   `is_active_status`: BOOLEAN (Indicates if jobs in this status are considered open/active).
    *   `is_terminal_status`: BOOLEAN (Indicates if jobs in this status cannot be further progressed, e.g., Canceled, Closed).

## 3. Database Schema Considerations (Additions to `packages/database/src/schema/index.ts`)

New tables to be added:

*   `job_statuses`
*   `jobs` (or `projects`)
*   `time_entries`
*   `time_entry_billed_status` (pgEnum)

Existing tables to be potentially modified:

*   `transactions`: May need a `job_id` foreign key to link transactions like Estimates, Sales Orders, Invoices directly to a job.
*   `transaction_lines`: For invoice lines generated from time entries, may need a link back or a way to signify its origin.

(Detailed Drizzle schema definitions will follow in a subsequent step).

## 4. API Design Considerations (High-Level)

OpenAPI specifications will be needed for managing these entities.

*   **Jobs API Endpoints:**
    *   `POST /jobs` (Create a new job)
    *   `GET /jobs` (List jobs, with filtering/pagination)
    *   `GET /jobs/{jobId}` (Get job details)
    *   `PUT /jobs/{jobId}` (Update job details)
    *   `DELETE /jobs/{jobId}` (Delete a job - consider soft delete)
    *   `GET /jobs/{jobId}/time-entries` (List time entries for a job)
    *   `GET /jobs/{jobId}/transactions` (List linked transactions for a job)
*   **Time Entries API Endpoints:**
    *   `POST /time-entries` (Log a new time entry, typically includes `job_id`)
    *   `GET /time-entries` (List time entries, with filtering by job, user, date range)
    *   `GET /time-entries/{entryId}` (Get time entry details)
    *   `PUT /time-entries/{entryId}` (Update time entry)
    *   `DELETE /time-entries/{entryId}` (Delete time entry)
*   **Job Statuses API Endpoints (Likely for admin/setup):**
    *   `GET /job-statuses`

## 5. User Experience Considerations (High-Level)

*   **Job Management:**
    *   Dashboard/List view of all jobs with key info (name, customer, status, dates, financials summary).
    *   Ability to filter and search jobs.
    *   Dedicated job detail page showing all related info: transactions, time entries, notes, financial summary (budget vs. actual).
*   **Time Tracking:**
    *   Easy-to-use interface for logging time (e.g., daily/weekly timesheet view).
    *   Quick selection of job, input of hours, description.
    *   Summary of tracked time.

## 6. Integration Points

*   **Customers:** Jobs are always linked to customers.
*   **Estimates/Sales Orders:** Can be linked to a job to represent the proposed scope and value.
*   **Invoicing:** Billable time entries and job deliverables will be pulled into invoices.
*   **Revenue Recognition:** Job progress and related financial transactions will be inputs to the revenue recognition engine.

## 7. Open Questions/Future Considerations

*   Granular task management within jobs?
*   Resource allocation/scheduling for jobs?
*   Advanced budgeting and forecasting features for jobs?
*   Specific approval workflows for time entries?
*   How to handle non-billable internal jobs/projects?

This document provides the foundational design. Further details will be elaborated in specific feature/module documents and API specifications. 