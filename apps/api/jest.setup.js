// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Mock environment variables
process.env.NODE_ENV = 'test'
process.env.CLERK_SECRET_KEY = 'test-secret-key'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to ignore warnings and errors
  // warn: jest.fn(),
  // error: jest.fn(),
  log: jest.fn(),
}

// Mock fetch globally
global.fetch = jest.fn()

// Setup MSW
import { beforeAll, afterEach, afterAll } from '@jest/globals'
import { server } from './mocks/server'

// Establish API mocking before all tests
beforeAll(() => server.listen())

// Reset any request handlers that we may add during the tests,
// so they don't affect other tests
afterEach(() => server.resetHandlers())

// Clean up after the tests are finished
afterAll(() => server.close())