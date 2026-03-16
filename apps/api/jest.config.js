const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'node',
  moduleNameMapping: {
    '^@glapi/(.*)$': '<rootDir>/../../packages/$1/src',
  },
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    'services/**/*.{js,jsx,ts,tsx}',
    '!app/**/*.d.ts',
    '!app/**/route.ts',
    '!lib/db/migrations/**',
  ],
  testMatch: [
    '<rootDir>/app/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/app/**/*.{test,spec}.{js,jsx,ts,tsx}',
    '<rootDir>/lib/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/lib/**/*.{test,spec}.{js,jsx,ts,tsx}',
    '<rootDir>/services/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/services/**/*.{test,spec}.{js,jsx,ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  testTimeout: 30000,
}

module.exports = createJestConfig(customJestConfig)
