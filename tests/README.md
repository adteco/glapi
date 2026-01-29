# GLAPI E2E Tests

End-to-end tests using Playwright for the GLAPI application.

## Test Structure

```
tests/
├── api/                    # TRPC API endpoint tests (no browser)
├── lists/                  # Accounting dimensions (Accounts, Classes, etc.)
├── relationships/          # Entities (Customers, Vendors, Leads, Employees, etc.)
├── transactions/           # Business transactions (Invoices, Sales Orders, etc.)
├── rls/                    # Row Level Security isolation tests
├── banking/                # Banking module tests
├── construction/           # Construction module tests
├── projects/               # Project management tests
├── reports/                # Report generation tests
├── admin/                  # Admin functionality tests
├── pages/                  # General page tests
├── ui/                     # UI component tests
├── helpers/                # Test utilities and helpers
├── fixtures/               # Test data fixtures
├── auth.setup.ts           # Authentication setup (runs before authenticated tests)
├── global.setup.ts         # Global setup (Clerk testing tokens)
└── smoke.spec.ts           # Quick verification smoke tests
```

## Running Tests

### Run All Tests
```bash
npx playwright test
```

### Run by Project/Browser

```bash
# Chrome only (recommended for development)
npx playwright test --project=chromium

# Firefox
npx playwright test --project=firefox

# Safari/WebKit
npx playwright test --project=webkit

# Mobile Chrome
npx playwright test --project=mobile-chrome

# Mobile Safari
npx playwright test --project=mobile-safari
```

### Run by Module

```bash
# API tests (TRPC endpoints, no browser)
npx playwright test --project=api

# Lists module (Accounting dimensions)
npx playwright test --project=lists

# Relationships module (Customers, Vendors, Leads, etc.)
npx playwright test --project=relationships

# Transactions module (Invoices, Sales Orders, etc.)
npx playwright test --project=transactions

# RLS isolation tests
npx playwright test --project=rls

# Smoke tests (quick verification)
npx playwright test --project=smoke

# Public/unauthenticated pages
npx playwright test --project=public
```

### Run Specific Test Files

```bash
# Single file
npx playwright test tests/relationships/leads.spec.ts

# Pattern matching
npx playwright test tests/lists/*.spec.ts

# By test name
npx playwright test -g "should create lead"
```

### Run with UI Mode (Interactive)

```bash
npx playwright test --ui
```

### Run with Debug Mode

```bash
npx playwright test --debug
```

## Viewing Results

### HTML Report (Recommended)
```bash
# Run tests with HTML reporter
npx playwright test --reporter=html

# Open the report
npx playwright show-report
```

### List Reporter (Console)
```bash
npx playwright test --reporter=list
```

## Test Configuration

Configuration file: `playwright.config.ts` (monorepo root)

Key settings:
- **Base URL**: `http://localhost:3030` (web app)
- **API URL**: `http://localhost:3031` (API server)
- **Timeout**: 30 seconds per test
- **Retries**: 0 in dev, 2 in CI
- **Parallel**: Enabled in dev, disabled in CI

## Authentication

Tests requiring authentication depend on the `setup` project which:
1. Runs `global.setup.ts` - Sets up Clerk testing tokens
2. Runs `auth.setup.ts` - Authenticates and saves session state

Session state is stored in `playwright/.auth/user.json` and reused by authenticated tests.

## Writing New Tests

1. Place tests in the appropriate directory based on module
2. Use `.spec.ts` extension
3. Import from `@playwright/test`
4. For authenticated tests, they'll automatically use stored auth state

Example:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/path');
    await expect(page.getByText('Expected')).toBeVisible();
  });
});
```

## Environment Variables

Tests load from `apps/web/.env.local`:
- `TEST_USER_EMAIL` - Test user email
- `TEST_USER_PASSWORD` - Test user password
- `PLAYWRIGHT_BASE_URL` - Override base URL (optional)

## API Tests

API tests in `tests/api/` use the TRPC client directly without a browser:

```typescript
import { test, expect } from '@playwright/test';
import { createTestTRPCClient } from '../helpers/api-client';

test('should list items', async () => {
  const client = createTestTRPCClient();
  const result = await client.items.list.query({});
  expect(result.data).toBeDefined();
});
```

API tests use the test API key: `glapi_test_sk_1234567890abcdef`
