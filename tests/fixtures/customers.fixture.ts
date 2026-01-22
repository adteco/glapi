/**
 * Customer Test Fixtures
 *
 * Provides test data generators and factories for customer entities
 */

import { testId } from '../helpers/api-client';

export interface CustomerTestData {
  companyName: string;
  customerId?: string;
  contactEmail?: string;
  contactPhone?: string;
  billingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  shippingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  parentCustomerId?: string;
  status?: 'active' | 'inactive' | 'archived';
}

/**
 * Generate a basic test customer
 */
export function createTestCustomer(overrides?: Partial<CustomerTestData>): CustomerTestData {
  const id = testId('cust');
  return {
    companyName: `Test Company ${id}`,
    customerId: `CUST-${id}`,
    contactEmail: `contact-${id}@test.example.com`,
    contactPhone: '555-123-4567',
    billingAddress: {
      street: '123 Test Street',
      city: 'Test City',
      state: 'CA',
      postalCode: '90210',
      country: 'US',
    },
    status: 'active',
    ...overrides,
  };
}

/**
 * Generate multiple test customers
 */
export function createTestCustomers(count: number, overrides?: Partial<CustomerTestData>): CustomerTestData[] {
  return Array.from({ length: count }, () => createTestCustomer(overrides));
}

/**
 * Create a customer hierarchy (parent + children)
 */
export function createCustomerHierarchy(childCount: number = 3): {
  parent: CustomerTestData;
  children: CustomerTestData[];
} {
  const parent = createTestCustomer({ companyName: 'Parent Company Corp' });
  const children = Array.from({ length: childCount }, (_, i) =>
    createTestCustomer({
      companyName: `Child Division ${i + 1}`,
      // parentCustomerId will be set after parent is created
    })
  );
  return { parent, children };
}

/**
 * Sample customer scenarios for testing edge cases
 */
export const customerScenarios = {
  /**
   * Minimal customer with only required fields
   */
  minimal: (): CustomerTestData => ({
    companyName: `Minimal Customer ${testId()}`,
  }),

  /**
   * Customer with all fields populated
   */
  complete: (): CustomerTestData => ({
    companyName: `Complete Customer ${testId()}`,
    customerId: `COMP-${testId()}`,
    contactEmail: `complete-${testId()}@test.example.com`,
    contactPhone: '555-999-8888',
    billingAddress: {
      street: '456 Complete Ave',
      city: 'Full City',
      state: 'NY',
      postalCode: '10001',
      country: 'US',
    },
    shippingAddress: {
      street: '789 Shipping Way',
      city: 'Ship City',
      state: 'TX',
      postalCode: '75001',
      country: 'US',
    },
    status: 'active',
  }),

  /**
   * Inactive customer
   */
  inactive: (): CustomerTestData => ({
    companyName: `Inactive Customer ${testId()}`,
    status: 'inactive',
  }),

  /**
   * Archived customer
   */
  archived: (): CustomerTestData => ({
    companyName: `Archived Customer ${testId()}`,
    status: 'archived',
  }),

  /**
   * International customer
   */
  international: (): CustomerTestData => ({
    companyName: `International Corp ${testId()}`,
    contactEmail: `intl-${testId()}@test.example.com`,
    billingAddress: {
      street: '1 Global Street',
      city: 'London',
      postalCode: 'EC1A 1BB',
      country: 'GB',
    },
  }),

  /**
   * Customer with special characters in name
   */
  specialCharacters: (): CustomerTestData => ({
    companyName: `O'Brien & Associates, LLC (${testId()})`,
    customerId: `SPEC-${testId()}`,
  }),

  /**
   * Customer with unicode characters
   */
  unicode: (): CustomerTestData => ({
    companyName: `日本企業 ${testId()}`,
    customerId: `UNICODE-${testId()}`,
  }),
};

/**
 * Invalid customer data for negative testing
 */
export const invalidCustomers = {
  /**
   * Empty company name (should fail validation)
   */
  emptyName: () => ({ companyName: '' }),

  /**
   * Invalid email format
   */
  invalidEmail: () => ({
    companyName: `Invalid Email Customer ${testId()}`,
    contactEmail: 'not-an-email',
  }),

  /**
   * Invalid status
   */
  invalidStatus: () => ({
    companyName: `Invalid Status Customer ${testId()}`,
    status: 'unknown' as any,
  }),
};
