/**
 * Organization Test Fixtures
 *
 * Provides test data for organizations and related entities
 */

import { testId } from '../helpers/api-client';

export interface OrganizationTestData {
  name: string;
  code?: string;
  email?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  settings?: {
    fiscalYearEnd?: string;
    defaultCurrency?: string;
    taxId?: string;
  };
}

export interface DepartmentTestData {
  name: string;
  code?: string;
  description?: string;
  parentId?: string;
  active?: boolean;
}

export interface LocationTestData {
  name: string;
  code?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  type?: 'warehouse' | 'office' | 'store' | 'factory';
  active?: boolean;
}

export interface SubsidiaryTestData {
  name: string;
  code?: string;
  currency?: string;
  country?: string;
  active?: boolean;
  parentSubsidiaryId?: string;
}

/**
 * Generate test department
 */
export function createTestDepartment(overrides?: Partial<DepartmentTestData>): DepartmentTestData {
  const id = testId('dept');
  return {
    name: `Department ${id}`,
    code: `DEPT-${id}`,
    description: 'Test department for E2E testing',
    active: true,
    ...overrides,
  };
}

/**
 * Generate test location
 */
export function createTestLocation(overrides?: Partial<LocationTestData>): LocationTestData {
  const id = testId('loc');
  return {
    name: `Location ${id}`,
    code: `LOC-${id}`,
    type: 'warehouse',
    address: {
      street: '100 Warehouse Way',
      city: 'Storage City',
      state: 'CA',
      postalCode: '90001',
      country: 'US',
    },
    active: true,
    ...overrides,
  };
}

/**
 * Generate test subsidiary
 */
export function createTestSubsidiary(overrides?: Partial<SubsidiaryTestData>): SubsidiaryTestData {
  const id = testId('sub');
  return {
    name: `Subsidiary ${id}`,
    code: `SUB-${id}`,
    currency: 'USD',
    country: 'US',
    active: true,
    ...overrides,
  };
}

/**
 * Department hierarchy for testing
 */
export function createDepartmentHierarchy(): {
  parent: DepartmentTestData;
  children: DepartmentTestData[];
} {
  const parent = createTestDepartment({ name: 'Engineering' });
  const children = [
    createTestDepartment({ name: 'Frontend Team' }),
    createTestDepartment({ name: 'Backend Team' }),
    createTestDepartment({ name: 'QA Team' }),
  ];
  return { parent, children };
}

/**
 * Location scenarios
 */
export const locationScenarios = {
  warehouse: (): LocationTestData => ({
    name: `Main Warehouse ${testId()}`,
    code: `WH-${testId()}`,
    type: 'warehouse',
    address: {
      street: '500 Industrial Blvd',
      city: 'Logistics City',
      state: 'TX',
      postalCode: '75001',
      country: 'US',
    },
  }),

  office: (): LocationTestData => ({
    name: `Corporate Office ${testId()}`,
    code: `OFF-${testId()}`,
    type: 'office',
    address: {
      street: '1 Corporate Plaza',
      city: 'Business City',
      state: 'NY',
      postalCode: '10001',
      country: 'US',
    },
  }),

  store: (): LocationTestData => ({
    name: `Retail Store ${testId()}`,
    code: `STORE-${testId()}`,
    type: 'store',
    address: {
      street: '123 Shopping Lane',
      city: 'Retail Town',
      state: 'FL',
      postalCode: '33101',
      country: 'US',
    },
  }),

  international: (): LocationTestData => ({
    name: `UK Office ${testId()}`,
    code: `UK-${testId()}`,
    type: 'office',
    address: {
      street: '10 Downing Street',
      city: 'London',
      postalCode: 'SW1A 2AA',
      country: 'GB',
    },
  }),
};

/**
 * Subsidiary scenarios
 */
export const subsidiaryScenarios = {
  domestic: (): SubsidiaryTestData => ({
    name: `US Operations ${testId()}`,
    code: `US-${testId()}`,
    currency: 'USD',
    country: 'US',
  }),

  foreign: (): SubsidiaryTestData => ({
    name: `EU Operations ${testId()}`,
    code: `EU-${testId()}`,
    currency: 'EUR',
    country: 'DE',
  }),

  inactive: (): SubsidiaryTestData => ({
    name: `Inactive Subsidiary ${testId()}`,
    code: `INACT-${testId()}`,
    currency: 'USD',
    country: 'US',
    active: false,
  }),
};
