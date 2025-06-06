# API Access User Journey Design Document

## Overview
This document outlines the complete user journey for accessing the GLAPI system, from initial landing through API key generation and using the API via Postman.

## Goals
1. Provide a seamless onboarding experience for new API users
2. Enable users to quickly get started with API access
3. Provide downloadable Postman collection for easy API testing
4. Ensure secure API key generation and management

## User Journey Flow

### 1. Landing Page
- User arrives at the main website
- Clear call-to-action to "Get Started" or "View Documentation"
- Link to quickstart guide prominently displayed

### 2. Documentation & Quickstart
- User navigates to `/docs/quickstart`
- Guide includes:
  - Overview of GLAPI capabilities
  - Account creation steps
  - Initial setup requirements
  - API key generation instructions
  - Link to download Postman collection

### 3. Account Creation
- User creates account via web app
- Authentication handled by (TBD: Clerk/Stytch/Custom)
- Email verification required
- Initial organization setup

### 4. Initial Data Seeding
- After account creation, provide option to seed default data:
  - Sample accounting dimensions (departments, locations, classes)
  - Example customers and vendors
  - Basic GL account structure
- This helps users understand the data model

### 5. API Key Generation
- Dedicated API keys page in web app dashboard
- Features:
  - Generate new API key
  - Name/label API keys for different environments
  - Set expiration dates (optional)
  - Revoke keys
  - Copy key to clipboard
  - Show key only once (security best practice)

### 6. Postman Collection
- Provide downloadable Postman collection that includes:
  - All API endpoints from OpenAPI specs
  - Pre-configured authentication headers
  - Example requests for each endpoint
  - Environment variables for API URL and API key
  - Documentation within Postman

## Technical Requirements

### Authentication System

#### Current Implementation Analysis
Based on code analysis, the system currently has:

1. **Clerk as Auth Provider**:
   - **Clerk** is the only auth provider used in web app (`@clerk/nextjs`)
   - Legacy Stytch references need to be removed from the codebase
   - `clerk-auth.ts` middleware handles JWT token validation

2. **Current Auth Flow**:
   - Web app uses Clerk for user authentication
   - API validates Clerk JWT tokens via Authorization header
   - Falls back to development defaults when no auth provided

3. **Clerk Limitations for API Access**:
   - Clerk is designed for user authentication, not machine-to-machine
   - Uses short-lived session tokens (JWTs) stored in cookies
   - No built-in API key functionality
   - OAuth2 support is limited to Clerk as an IdP, not for API access

#### Proposed Hybrid Authentication Solution

Since Clerk doesn't provide API keys, we'll implement a custom solution:

1. **Keep Clerk for Web App**:
   - User authentication via Clerk (login, signup, org management)
   - Session-based auth for web UI interactions

2. **Custom API Key System**:
   - Generate long-lived API keys for programmatic access
   - API key format: `glapi_live_xxxxxxxxxxxxx` or `glapi_test_xxxxxxxxxxxxx`
   - Store hashed API keys in database with organization association
   - Keys are tied to Clerk organization IDs

3. **Unified Auth Middleware**:
   - Support both authentication methods:
     - Bearer token with Clerk JWT for web app
     - API key in header for programmatic access
   - Both methods resolve to same organization context

### OpenAPI Consolidation
- Combine individual OpenAPI specs into master spec
- Current specs available:
  - customers.openapi.yaml
  - contacts.openapi.yaml
  - employees.openapi.yaml
  - vendors.openapi.yaml
  - leads.openapi.yaml
  - prospects.openapi.yaml
  - organizations.openapi.yaml
  - departments.openapi.yaml
  - locations.openapi.yaml
  - classes.openapi.yaml
  - subsidiaries.openapi.yaml
  - gl-entries.openapi.yaml
  - transactions.openapi.yaml

### Postman Collection Generation
- Use Postman's OpenAPI import feature
- Add authentication setup
- Include example requests
- Environment configuration
- Host collection file in docs or provide dynamic generation

### Database Schema
- API keys table:
  ```sql
  api_keys (
    id UUID PRIMARY KEY,
    clerk_organization_id VARCHAR(255) NOT NULL,
    clerk_user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    key_hash VARCHAR(255) UNIQUE,
    prefix VARCHAR(20),
    last_four VARCHAR(4),
    created_at TIMESTAMP,
    expires_at TIMESTAMP NULL,
    last_used_at TIMESTAMP NULL,
    revoked_at TIMESTAMP NULL,
    created_by VARCHAR(255),
    UNIQUE(clerk_organization_id, name)
  )
  ```

### API Authentication Flow

1. **Request with API Key**:
   ```bash
   curl https://api.glapi.io/v1/customers \
     -H "X-API-Key: glapi_live_xxxxxxxxxxxxx"
   ```

2. **Request with Clerk JWT** (from web app):
   ```bash
   curl https://api.glapi.io/v1/customers \
     -H "Authorization: Bearer <clerk-jwt-token>"
   ```

3. **Middleware Logic**:
   - Check for API key first (`X-API-Key` header)
   - If no API key, check for Bearer token
   - Validate and extract organization context
   - Proceed with same business logic

## Implementation Tasks

1. **Remove Stytch References** (Priority: High)
   - Remove `auth.ts` middleware (Stytch-based)
   - Update all routes to use `clerk-auth.ts`
   - Remove any Stytch-related types and imports

2. **API Key System** (Priority: High)
   - Database schema for API keys
   - Generation logic
   - Hashing and security
   - Middleware for validation

3. **Web UI for API Keys** (Priority: High)
   - Dashboard page for API key management
   - Generation flow
   - List/revoke functionality

4. **Quickstart Guide** (Priority: High)
   - Step-by-step instructions
   - Screenshots
   - Code examples

5. **OpenAPI Master Spec** (Priority: High)
   - Combine all individual specs
   - Add authentication documentation
   - Validate completeness

6. **Postman Collection** (Priority: High)
   - Generate from OpenAPI
   - Add examples
   - Test all endpoints
   - Host for download

7. **Data Seeding** (Priority: Medium)
   - Create seed scripts
   - UI for triggering seed
   - Sample data sets

## Success Criteria
- User can go from landing page to making first API call in under 10 minutes
- Clear, comprehensive quickstart guide
- Working Postman collection with all endpoints
- Secure API key generation and management
- Positive developer experience

## Security Considerations
- API keys shown only once
- Keys stored as hashes
- Rate limiting per API key
- Key rotation capabilities
- Audit logging for API usage

## Next Steps
1. Analyze current authentication implementation
2. Design API key database schema
3. Begin implementation based on findings