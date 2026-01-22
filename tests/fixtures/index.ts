/**
 * Test Fixtures Index
 *
 * Re-exports all test fixtures for easy importing
 */

// Auth fixtures
export { test, expect, isAuthenticated, signOut, goToDashboard, switchOrganization, authTest } from './auth.fixture';
export type { AuthFixtures } from './auth.fixture';

// Customers
export {
  createTestCustomer,
  createTestCustomers,
  createCustomerHierarchy,
  customerScenarios,
  invalidCustomers,
} from './customers.fixture';
export type { CustomerTestData } from './customers.fixture';

// Items
export {
  createTestItem,
  createTestItems,
  itemScenarios,
  invalidItems,
} from './items.fixture';
export type { ItemTestData } from './items.fixture';

// Organizations & Dimensions
export {
  createTestDepartment,
  createTestLocation,
  createTestSubsidiary,
  createDepartmentHierarchy,
  locationScenarios,
  subsidiaryScenarios,
} from './organizations.fixture';
export type {
  OrganizationTestData,
  DepartmentTestData,
  LocationTestData,
  SubsidiaryTestData,
} from './organizations.fixture';
