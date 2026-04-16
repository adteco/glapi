import { defineConfig, devices } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Auth storage file paths
const STORAGE_STATE = path.join(__dirname, 'playwright/.auth/user.json');
const BETTER_AUTH_STORAGE_STATE = path.join(__dirname, 'playwright/.auth/betterauth-user.json');

const webEnvLocal = path.join(__dirname, 'apps/web/.env.local');
if (fs.existsSync(webEnvLocal)) {
  dotenv.config({ path: webEnvLocal });
}

const webEnv = path.join(__dirname, 'apps/web/.env');
if (fs.existsSync(webEnv)) {
  dotenv.config({ path: webEnv });
}

/**
 * GLAPI E2E Test Configuration
 *
 * Projects:
 * - api: API tests (no browser, TRPC endpoint testing)
 * - web: Full UI tests with authentication
 * - smoke: Quick verification tests
 * - mobile: Mobile viewport tests
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI for stability */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter configuration */
  reporter: [
    ['html', { outputFolder: 'test-results/html-report' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  /* Global timeout for tests */
  timeout: 30000,

  /* Expect timeout */
  expect: {
    timeout: 10000,
  },

  /* Shared settings for all the projects below */
  use: {
    /* Base URL for the web app */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3030',

    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video recording on retry */
    video: 'on-first-retry',

    /* Default viewport */
    viewport: { width: 1280, height: 720 },

    /* Timeout for navigation */
    navigationTimeout: 30000,

    /* Timeout for actions */
    actionTimeout: 15000,
  },

  /* Configure output directories */
  outputDir: 'test-results/test-artifacts',

  /* Configure projects */
  projects: [
    // ==========================================
    // SETUP PROJECTS
    // ==========================================

    // Global setup - Clerk testing token setup
    {
      name: 'global-setup',
      testMatch: /global\.setup\.ts/,
    },

    // Auth setup project - authenticates and stores session
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      dependencies: ['global-setup'],
    },

    // ==========================================
    // BETTER AUTH SETUP & TESTS
    // ==========================================

    // Better Auth setup project - authenticates via Better Auth API
    {
      name: 'betterauth-setup',
      testMatch: /auth-betterauth\.setup\.ts/,
    },

    // Better Auth API tests - API-level auth verification (no browser)
    {
      name: 'betterauth-api',
      testMatch: /tests\/auth\/better-auth-api\.spec\.ts/,
      use: {
        headless: true,
      },
    },

    // Better Auth E2E tests - browser-based auth verification
    {
      name: 'betterauth-e2e',
      testMatch: /tests\/auth\/better-auth-e2e\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: BETTER_AUTH_STORAGE_STATE,
      },
      dependencies: ['betterauth-setup'],
    },

    // ==========================================
    // API TESTS (No browser needed)
    // ==========================================

    // API Tests - TRPC endpoint testing
    {
      name: 'api',
      testMatch: /tests\/api\/.*\.spec\.ts/,
      use: {
        // API tests don't need a browser
        headless: true,
      },
    },

    // ==========================================
    // SMOKE TESTS (Quick verification)
    // ==========================================

    // Smoke tests - Critical path verification
    {
      name: 'smoke',
      testMatch: /smoke\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE,
      },
      dependencies: ['setup'],
    },

    // ==========================================
    // WEB UI TESTS (Full browser testing)
    // ==========================================

    // Chromium - Primary browser for testing
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE,
      },
      dependencies: ['setup'],
      testIgnore: [
        /tests\/api\//,
        /smoke\.spec\.ts/,
        /.*\.landing\.spec\.ts/,
        /.*\.public\.spec\.ts/,
      ],
    },

    // Firefox - Secondary browser
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: STORAGE_STATE,
      },
      dependencies: ['setup'],
      testIgnore: [
        /tests\/api\//,
        /smoke\.spec\.ts/,
        /.*\.landing\.spec\.ts/,
        /.*\.public\.spec\.ts/,
      ],
    },

    // WebKit - Safari testing
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        storageState: STORAGE_STATE,
      },
      dependencies: ['setup'],
      testIgnore: [
        /tests\/api\//,
        /smoke\.spec\.ts/,
        /.*\.landing\.spec\.ts/,
        /.*\.public\.spec\.ts/,
      ],
    },

    // ==========================================
    // MOBILE TESTS
    // ==========================================

    // Mobile Chrome (Android)
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: STORAGE_STATE,
      },
      dependencies: ['setup'],
      testMatch: [
        /tests\/lists\/.*\.spec\.ts/,
        /tests\/relationships\/.*\.spec\.ts/,
        /tests\/dashboard\.spec\.ts/,
      ],
    },

    // Mobile Safari (iOS)
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 12'],
        storageState: STORAGE_STATE,
      },
      dependencies: ['setup'],
      testMatch: [
        /tests\/lists\/.*\.spec\.ts/,
        /tests\/relationships\/.*\.spec\.ts/,
        /tests\/dashboard\.spec\.ts/,
      ],
    },

    // ==========================================
    // SPECIALIZED TEST GROUPS
    // ==========================================

    // Lists module tests
    {
      name: 'lists',
      testMatch: /tests\/lists\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE,
      },
      dependencies: ['setup'],
    },

    // Relationships module tests
    {
      name: 'relationships',
      testMatch: /tests\/relationships\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE,
      },
      dependencies: ['setup'],
    },

    // Transactions module tests
    {
      name: 'transactions',
      testMatch: /tests\/transactions\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE,
      },
      dependencies: ['setup'],
    },

    // Reports module tests
    {
      name: 'reports',
      testMatch: /tests\/reports\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE,
      },
      dependencies: ['setup'],
    },

    // Construction module tests
    {
      name: 'construction',
      testMatch: /tests\/construction\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE,
      },
      dependencies: ['setup'],
    },

    // Admin module tests
    {
      name: 'admin',
      testMatch: /tests\/admin\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE,
      },
      dependencies: ['setup'],
    },

    // RLS isolation tests - verify multi-tenant data isolation
    {
      name: 'rls',
      testMatch: /tests\/rls\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE,
      },
      dependencies: ['setup'],
    },

    // ==========================================
    // UNAUTHENTICATED TESTS
    // ==========================================

    // Landing/public page tests (no auth needed)
    {
      name: 'public',
      use: { ...devices['Desktop Chrome'] },
      testMatch: [
        /.*\.landing\.spec\.ts/,
        /.*\.public\.spec\.ts/,
        /tests\/landing\.spec\.ts/,
      ],
    },
  ],

  /* Run local dev server before starting the tests */
  webServer: {
    command: 'pnpm dev',
    url: 'http://127.0.0.1:3030',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    stdout: 'ignore',
    stderr: 'pipe',
  },

  /* Global setup and teardown */
  globalSetup: undefined, // We use project-based setup instead
  globalTeardown: undefined,

  /* Metadata for test reporting */
  metadata: {
    project: 'GLAPI',
    environment: process.env.NODE_ENV || 'test',
  },
});
