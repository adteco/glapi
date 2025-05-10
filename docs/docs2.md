# Architecture Overview

This document provides a high-level overview of the Revenue Recognition System's architecture, including its key components and how they interact.

## Core Components

1.  **PostgreSQL Database on Supabase:**
    *   Serves as the primary data store.
    *   Leverages Supabase for its managed PostgreSQL offering, including features like Row Level Security (RLS).
    *   Tables for: Customer and contract management, Product catalog with SSP tracking, Performance obligations and revenue schedules, SSP evidence and allocation history, Journal entries for accounting integration.

2.  **AWS Lambda Functions:**
    *   Handle backend business logic, data processing, and API endpoints.
    *   Functions for: Contract processing and SSP allocation, Automated revenue recognition, SSP management and recalculation, Report generation, Payment processing (e.g., Stripe webhooks), NetSuite synchronization.

3.  **Next.js Frontend (Vercel):**
    *   Provides the user interface for interacting with the system.
    *   Hosted on Vercel for optimal performance and CI/CD.
    *   Features: Contract management interface, Revenue dashboard, SSP management tools, Comprehensive reporting suite, User authentication flows.
    *   Based on patterns from `stytchauth/stytch-b2b-nextjs-quickstart-example` (https://github.com/stytchauth/stytch-b2b-nextjs-quickstart-example).

4.  **Stytch Authentication:**
    *   Manages user authentication (B2B focus, including organizations and members).
    *   Provides mechanisms for login (OAuth, Email Magic Links, SSO), session management, and user/organization provisioning.
    *   JWTs from Stytch are used to authenticate API requests to Lambdas and the MCP Server, and to enforce RLS in Supabase.

5.  **MCP Server (Model Context Protocol - Cloudflare Workers):**
    *   A backend component, likely hosted on Cloudflare Workers, inspired by `stytchauth/mcp-stytch-b2b-okr-manager` (https://github.com/stytchauth/mcp-stytch-b2b-okr-manager).
    *   Serves as an intermediary or specialized API layer.
    *   Potential uses: Orchestrating complex workflows, serving real-time updates via Server-Sent Events (SSE), providing specialized API interfaces, or encapsulating broader business logic.
    *   Interacts with the frontend, Supabase DB, and potentially AWS Lambda functions.

6.  **External Integrations:**
    *   **Stripe:** For processing payments and managing subscriptions.
    *   **NetSuite:** For synchronizing financial data with an ERP system.

## Key Capabilities
*   Flexible Revenue Recognition
    *   Supports both point-in-time and over-time recognition
    *   Multiple recognition patterns (straight-line, proportional, milestone-based)
    *   Configurable performance obligations
*   SSP Management
    *   Evidence-based SSP tracking
    *   Multiple allocation methods (proportional, residual, specific evidence)
    *   Historical tracking of SSP changes
*   Reporting Features
    *   Revenue waterfall reports
    *   Monthly recognition schedules
    *   Deferred revenue analysis
    *   Custom report builder
*   Accounting Integration
    *   Journal entry generation
    *   Deferred revenue tracking
    *   Contract asset/liability management

## Data Flow Highlights
*   **User Authentication:** Frontend interacts with Stytch; JWTs secure backend API calls.
*   **Contract Lifecycle:** Frontend -> API Gateway -> Lambda (`contract-processor`, `payment-processor`) -> Supabase DB.
*   **Revenue Recognition:** Scheduled Lambda (`revenue-recognizer`) -> Supabase DB.
*   **Reporting:** Frontend -> Lambda (`reporting-service`) or MCP Server -> Supabase DB.
*   **Integrations:** Stripe Webhooks -> Lambda; Scheduled Lambda -> NetSuite.