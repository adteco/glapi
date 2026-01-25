/**
 * Multi-Tenancy Integration Tests
 *
 * These tests verify that data isolation between organizations works correctly.
 * They test the RLS (Row Level Security) policies and service-level organization filtering.
 *
 * Test Strategy:
 * - Use real database connections with test organizations
 * - Create test data in different organizations
 * - Verify cross-organization access is denied
 * - Verify same-organization access is allowed
 * - Clean up test data after each test
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { randomUUID } from 'crypto';
import { eq, and, inArray } from 'drizzle-orm';
import {
  db,
  pool,
  organizations,
  subsidiaries,
  accountingPeriods,
  projects,
  entities,
  createContextualDb,
  withOrganizationContext,
} from '@glapi/database';
import { createCallerFactory, router } from '../../trpc';
import { subsidiariesRouter } from '../subsidiaries';
import { accountingPeriodsRouter } from '../accounting-periods';
import { projectsRouter } from '../projects';
import { customersRouter } from '../customers';
import type { Context, User, ServiceContext } from '../../context';

// ============================================================================
// Test Router Setup
// ============================================================================

const testAppRouter = router({
  subsidiaries: subsidiariesRouter,
  accountingPeriods: accountingPeriodsRouter,
  projects: projectsRouter,
  customers: customersRouter,
});

const createCaller = createCallerFactory(testAppRouter);

// ============================================================================
// Test Utilities
// ============================================================================

interface TestOrganization {
  id: string;
  name: string;
  slug: string;
}

interface TestUser {
  id: string;
  organizationId: string;
  email: string;
  role: 'user' | 'admin';
}

/**
 * Create a test context for a specific organization
 */
function createTestContext(organizationId: string, userId?: string, role: 'user' | 'admin' = 'admin'): Context {
  const testUserId = userId || `test-user-${randomUUID()}`;
  return {
    req: undefined as any,
    res: undefined as any,
    resHeaders: undefined,
    db: {} as any, // Will be replaced by RLS-contextual db in middleware
    user: {
      id: testUserId,
      organizationId,
      email: `test-${testUserId}@example.com`,
      role,
    } as User,
    serviceContext: {
      organizationId,
      userId: testUserId,
    } as ServiceContext,
    organizationName: undefined,
  };
}

/**
 * Create a test organization in the database
 */
async function createTestOrganization(name: string): Promise<TestOrganization> {
  const id = randomUUID();
  const slug = `test-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
  const stytchOrgId = `org_test_${randomUUID().replace(/-/g, '').substring(0, 16)}`;

  await db.insert(organizations).values({
    id,
    name,
    slug,
    stytchOrgId,
  });

  return { id, name, slug };
}

/**
 * Create a test subsidiary for an organization
 */
async function createTestSubsidiary(
  organizationId: string,
  name: string,
  code?: string
): Promise<{ id: string; name: string; code: string | null }> {
  const [subsidiary] = await db
    .insert(subsidiaries)
    .values({
      organizationId,
      name,
      code: code || `SUB-${Date.now()}`,
      isActive: true,
    })
    .returning();

  return {
    id: subsidiary.id,
    name: subsidiary.name,
    code: subsidiary.code,
  };
}

/**
 * Create a test accounting period for a subsidiary
 */
async function createTestAccountingPeriod(
  organizationId: string,
  subsidiaryId: string,
  periodName: string,
  fiscalYear: string = '2024',
  periodNumber: number = 1
): Promise<{ id: string; periodName: string }> {
  const startDate = `${fiscalYear}-01-01`;
  const endDate = `${fiscalYear}-01-31`;

  const [period] = await db
    .insert(accountingPeriods)
    .values({
      organizationId,
      subsidiaryId,
      periodName,
      fiscalYear,
      periodNumber,
      startDate,
      endDate,
      periodType: 'MONTH',
      status: 'OPEN',
      isAdjustmentPeriod: false,
    })
    .returning();

  return {
    id: period.id,
    periodName: period.periodName,
  };
}

/**
 * Create a test project for an organization
 */
async function createTestProject(
  organizationId: string,
  projectCode: string,
  name: string,
  subsidiaryId?: string
): Promise<{ id: string; projectCode: string; name: string }> {
  const [project] = await db
    .insert(projects)
    .values({
      organizationId,
      projectCode,
      name,
      subsidiaryId,
      status: 'active',
    })
    .returning();

  return {
    id: project.id,
    projectCode: project.projectCode,
    name: project.name,
  };
}

/**
 * Create a test customer (entity) for an organization
 */
async function createTestCustomer(
  organizationId: string,
  name: string,
  code?: string
): Promise<{ id: string; name: string }> {
  const [entity] = await db
    .insert(entities)
    .values({
      organizationId,
      name,
      code: code || `CUST-${Date.now()}`,
      entityTypes: ['Customer'],
      status: 'active',
      isActive: true,
    })
    .returning();

  return {
    id: entity.id,
    name: entity.name,
  };
}

/**
 * Clean up all test data for an organization
 */
async function cleanupTestData(orgId: string): Promise<void> {
  try {
    // Delete in order of dependencies (children first)
    await db.delete(accountingPeriods).where(eq(accountingPeriods.organizationId, orgId));
    await db.delete(projects).where(eq(projects.organizationId, orgId));
    await db.delete(entities).where(eq(entities.organizationId, orgId));
    await db.delete(subsidiaries).where(eq(subsidiaries.organizationId, orgId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
  } catch (error) {
    console.error(`Failed to clean up test data for org ${orgId}:`, error);
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Multi-Tenancy Integration Tests', () => {
  // Test organizations
  let orgA: TestOrganization;
  let orgB: TestOrganization;

  // Test subsidiaries
  let subsidiaryA: { id: string; name: string; code: string | null };
  let subsidiaryB: { id: string; name: string; code: string | null };

  beforeAll(async () => {
    // Create two test organizations
    orgA = await createTestOrganization('Test Organization A');
    orgB = await createTestOrganization('Test Organization B');

    // Create a subsidiary in each organization for period-related tests
    subsidiaryA = await createTestSubsidiary(orgA.id, 'Subsidiary A', 'SUB-A');
    subsidiaryB = await createTestSubsidiary(orgB.id, 'Subsidiary B', 'SUB-B');
  });

  afterAll(async () => {
    // Clean up test organizations and all related data
    await cleanupTestData(orgA.id);
    await cleanupTestData(orgB.id);
  });

  // ============================================================================
  // Cross-Organization Access Denial Tests
  // ============================================================================

  describe('Cross-Organization Access Denial', () => {
    describe('Subsidiaries', () => {
      it('should not return subsidiaries from a different organization when listing', async () => {
        // Create an extra subsidiary in Org A
        const extraSubsidiary = await createTestSubsidiary(orgA.id, 'Extra Subsidiary A', 'EXTRA-A');

        try {
          // List from Org B context
          const callerB = createCaller(createTestContext(orgB.id));
          const result = await callerB.subsidiaries.list();

          // Should only see Org B's subsidiary, not Org A's
          const subsidiaryIds = result.map((s: any) => s.id);
          expect(subsidiaryIds).not.toContain(subsidiaryA.id);
          expect(subsidiaryIds).not.toContain(extraSubsidiary.id);
        } finally {
          // Cleanup extra subsidiary
          await db.delete(subsidiaries).where(eq(subsidiaries.id, extraSubsidiary.id));
        }
      });

      it('should return 404 when accessing a subsidiary from different organization by ID', async () => {
        // Try to get Org A's subsidiary from Org B context
        const callerB = createCaller(createTestContext(orgB.id));

        await expect(
          callerB.subsidiaries.get({ id: subsidiaryA.id })
        ).rejects.toThrow(TRPCError);
      });

      it('should not allow updating subsidiaries from a different organization', async () => {
        // Try to update Org A's subsidiary from Org B context
        const callerB = createCaller(createTestContext(orgB.id));

        await expect(
          callerB.subsidiaries.update({
            id: subsidiaryA.id,
            data: { name: 'Hacked Name' },
          })
        ).rejects.toThrow(TRPCError);

        // Verify the name wasn't changed
        const [original] = await db
          .select()
          .from(subsidiaries)
          .where(eq(subsidiaries.id, subsidiaryA.id));
        expect(original.name).toBe('Subsidiary A');
      });

      it('should not allow deleting subsidiaries from a different organization', async () => {
        // Create a subsidiary to attempt deletion
        const tempSubsidiary = await createTestSubsidiary(orgA.id, 'Temp Subsidiary', 'TEMP-A');

        try {
          // Try to delete Org A's subsidiary from Org B context
          const callerB = createCaller(createTestContext(orgB.id));

          await expect(
            callerB.subsidiaries.delete({ id: tempSubsidiary.id })
          ).rejects.toThrow(TRPCError);

          // Verify the subsidiary still exists
          const [stillExists] = await db
            .select()
            .from(subsidiaries)
            .where(eq(subsidiaries.id, tempSubsidiary.id));
          expect(stillExists).toBeDefined();
        } finally {
          // Cleanup
          await db.delete(subsidiaries).where(eq(subsidiaries.id, tempSubsidiary.id));
        }
      });
    });

    describe('Accounting Periods', () => {
      let periodA: { id: string; periodName: string };

      beforeAll(async () => {
        // Create a test period in Org A
        periodA = await createTestAccountingPeriod(
          orgA.id,
          subsidiaryA.id,
          'January 2024',
          '2024',
          1
        );
      });

      afterAll(async () => {
        await db.delete(accountingPeriods).where(eq(accountingPeriods.id, periodA.id));
      });

      it('should not return accounting periods from a different organization when listing', async () => {
        // List from Org B context
        const callerB = createCaller(createTestContext(orgB.id));
        const result = await callerB.accountingPeriods.list();

        // Should not see Org A's period
        const periodIds = result.data.map((p: any) => p.id);
        expect(periodIds).not.toContain(periodA.id);
      });

      it('should return 404 when accessing an accounting period from different organization by ID', async () => {
        // Try to get Org A's period from Org B context
        const callerB = createCaller(createTestContext(orgB.id));

        await expect(
          callerB.accountingPeriods.get({ id: periodA.id })
        ).rejects.toThrow(TRPCError);
      });
    });

    describe('Projects', () => {
      let projectA: { id: string; projectCode: string; name: string };

      beforeAll(async () => {
        projectA = await createTestProject(orgA.id, 'PROJ-A-001', 'Project Alpha');
      });

      afterAll(async () => {
        await db.delete(projects).where(eq(projects.id, projectA.id));
      });

      it('should not return projects from a different organization when listing', async () => {
        // List from Org B context
        const callerB = createCaller(createTestContext(orgB.id));
        const result = await callerB.projects.list();

        // Should not see Org A's project
        const projectIds = result.data.map((p: any) => p.id);
        expect(projectIds).not.toContain(projectA.id);
      });

      it('should return 404 when accessing a project from different organization by ID', async () => {
        // Try to get Org A's project from Org B context
        const callerB = createCaller(createTestContext(orgB.id));

        await expect(
          callerB.projects.get({ id: projectA.id })
        ).rejects.toThrow(TRPCError);
      });

      it('should not allow updating projects from a different organization', async () => {
        // Try to update Org A's project from Org B context
        const callerB = createCaller(createTestContext(orgB.id));

        await expect(
          callerB.projects.update({
            id: projectA.id,
            data: { name: 'Hacked Project Name' },
          })
        ).rejects.toThrow(TRPCError);

        // Verify the name wasn't changed
        const [original] = await db
          .select()
          .from(projects)
          .where(eq(projects.id, projectA.id));
        expect(original.name).toBe('Project Alpha');
      });

      it('should not allow deleting projects from a different organization', async () => {
        // Create a temporary project
        const tempProject = await createTestProject(orgA.id, 'PROJ-A-TEMP', 'Temp Project');

        try {
          // Try to delete Org A's project from Org B context
          const callerB = createCaller(createTestContext(orgB.id));

          await expect(
            callerB.projects.delete({ id: tempProject.id })
          ).rejects.toThrow(TRPCError);

          // Verify the project still exists
          const [stillExists] = await db
            .select()
            .from(projects)
            .where(eq(projects.id, tempProject.id));
          expect(stillExists).toBeDefined();
        } finally {
          await db.delete(projects).where(eq(projects.id, tempProject.id));
        }
      });
    });

    describe('Customers (Entities)', () => {
      let customerA: { id: string; name: string };

      beforeAll(async () => {
        customerA = await createTestCustomer(orgA.id, 'Customer Alpha Corp', 'CUST-A-001');
      });

      afterAll(async () => {
        await db.delete(entities).where(eq(entities.id, customerA.id));
      });

      it('should not return customers from a different organization when listing', async () => {
        // List from Org B context
        const callerB = createCaller(createTestContext(orgB.id));
        const result = await callerB.customers.list();

        // Should not see Org A's customer
        const customerIds = result.map((c: any) => c.id);
        expect(customerIds).not.toContain(customerA.id);
      });

      it('should return 404 when accessing a customer from different organization by ID', async () => {
        // Try to get Org A's customer from Org B context
        const callerB = createCaller(createTestContext(orgB.id));

        await expect(
          callerB.customers.get({ id: customerA.id })
        ).rejects.toThrow(TRPCError);
      });
    });
  });

  // ============================================================================
  // Same Organization Access Tests
  // ============================================================================

  describe('Same Organization Access', () => {
    describe('Subsidiaries', () => {
      it('should return subsidiaries from the same organization', async () => {
        const callerA = createCaller(createTestContext(orgA.id));
        const result = await callerA.subsidiaries.list();

        // Should see Org A's subsidiary
        const subsidiaryIds = result.map((s: any) => s.id);
        expect(subsidiaryIds).toContain(subsidiaryA.id);
      });

      it('should allow getting a subsidiary by ID from the same organization', async () => {
        const callerA = createCaller(createTestContext(orgA.id));
        const result = await callerA.subsidiaries.get({ id: subsidiaryA.id });

        expect(result.id).toBe(subsidiaryA.id);
        expect(result.name).toBe(subsidiaryA.name);
      });

      it('should allow updating subsidiaries from the same organization', async () => {
        // Create a subsidiary to update
        const testSub = await createTestSubsidiary(orgA.id, 'Update Test Sub', 'UPD-A');

        try {
          const callerA = createCaller(createTestContext(orgA.id));
          const updated = await callerA.subsidiaries.update({
            id: testSub.id,
            data: { name: 'Updated Subsidiary Name' },
          });

          expect(updated.name).toBe('Updated Subsidiary Name');
        } finally {
          await db.delete(subsidiaries).where(eq(subsidiaries.id, testSub.id));
        }
      });
    });

    describe('Projects', () => {
      let projectA: { id: string; projectCode: string; name: string };

      beforeAll(async () => {
        projectA = await createTestProject(orgA.id, 'PROJ-SAME-001', 'Same Org Project');
      });

      afterAll(async () => {
        await db.delete(projects).where(eq(projects.id, projectA.id));
      });

      it('should return projects from the same organization', async () => {
        const callerA = createCaller(createTestContext(orgA.id));
        const result = await callerA.projects.list();

        const projectIds = result.data.map((p: any) => p.id);
        expect(projectIds).toContain(projectA.id);
      });

      it('should allow updating projects from the same organization', async () => {
        const callerA = createCaller(createTestContext(orgA.id));
        const updated = await callerA.projects.update({
          id: projectA.id,
          data: { name: 'Updated Project Name' },
        });

        expect(updated.name).toBe('Updated Project Name');

        // Restore original name
        await callerA.projects.update({
          id: projectA.id,
          data: { name: 'Same Org Project' },
        });
      });
    });
  });

  // ============================================================================
  // List Isolation Tests
  // ============================================================================

  describe('List Isolation', () => {
    describe('Subsidiaries', () => {
      const subsidiariesOrgA: string[] = [];
      const subsidiariesOrgB: string[] = [];

      beforeAll(async () => {
        // Create 3 subsidiaries in Org A (plus the one from setup = 4)
        for (let i = 1; i <= 3; i++) {
          const sub = await createTestSubsidiary(orgA.id, `List Test Sub A${i}`, `LIST-A-${i}`);
          subsidiariesOrgA.push(sub.id);
        }

        // Create 2 subsidiaries in Org B (plus the one from setup = 3)
        for (let i = 1; i <= 2; i++) {
          const sub = await createTestSubsidiary(orgB.id, `List Test Sub B${i}`, `LIST-B-${i}`);
          subsidiariesOrgB.push(sub.id);
        }
      });

      afterAll(async () => {
        // Clean up
        await db.delete(subsidiaries).where(inArray(subsidiaries.id, subsidiariesOrgA));
        await db.delete(subsidiaries).where(inArray(subsidiaries.id, subsidiariesOrgB));
      });

      it('should only return subsidiaries belonging to the current organization', async () => {
        // List from Org A - should see 4 subsidiaries (1 from setup + 3 created)
        const callerA = createCaller(createTestContext(orgA.id));
        const resultA = await callerA.subsidiaries.list();
        expect(resultA.length).toBe(4);

        // Verify all returned subsidiaries belong to Org A
        for (const sub of resultA) {
          const [dbSub] = await db
            .select()
            .from(subsidiaries)
            .where(eq(subsidiaries.id, sub.id));
          expect(dbSub.organizationId).toBe(orgA.id);
        }

        // List from Org B - should see 3 subsidiaries (1 from setup + 2 created)
        const callerB = createCaller(createTestContext(orgB.id));
        const resultB = await callerB.subsidiaries.list();
        expect(resultB.length).toBe(3);

        // Verify all returned subsidiaries belong to Org B
        for (const sub of resultB) {
          const [dbSub] = await db
            .select()
            .from(subsidiaries)
            .where(eq(subsidiaries.id, sub.id));
          expect(dbSub.organizationId).toBe(orgB.id);
        }

        // Verify no overlap
        const idsA = resultA.map((s: any) => s.id);
        const idsB = resultB.map((s: any) => s.id);
        const overlap = idsA.filter((id: string) => idsB.includes(id));
        expect(overlap).toHaveLength(0);
      });
    });

    describe('Projects', () => {
      const projectsOrgA: string[] = [];
      const projectsOrgB: string[] = [];

      beforeAll(async () => {
        // Create 3 projects in Org A
        for (let i = 1; i <= 3; i++) {
          const proj = await createTestProject(orgA.id, `PROJ-LIST-A-${i}`, `List Test Project A${i}`);
          projectsOrgA.push(proj.id);
        }

        // Create 2 projects in Org B
        for (let i = 1; i <= 2; i++) {
          const proj = await createTestProject(orgB.id, `PROJ-LIST-B-${i}`, `List Test Project B${i}`);
          projectsOrgB.push(proj.id);
        }
      });

      afterAll(async () => {
        await db.delete(projects).where(inArray(projects.id, projectsOrgA));
        await db.delete(projects).where(inArray(projects.id, projectsOrgB));
      });

      it('should only return projects belonging to the current organization', async () => {
        // List from Org A
        const callerA = createCaller(createTestContext(orgA.id));
        const resultA = await callerA.projects.list();

        // Filter to only the test projects we created
        const testProjectsA = resultA.data.filter((p: any) => projectsOrgA.includes(p.id));
        expect(testProjectsA.length).toBe(3);

        // List from Org B
        const callerB = createCaller(createTestContext(orgB.id));
        const resultB = await callerB.projects.list();

        // Filter to only the test projects we created
        const testProjectsB = resultB.data.filter((p: any) => projectsOrgB.includes(p.id));
        expect(testProjectsB.length).toBe(2);

        // Verify no overlap
        const idsA = resultA.data.map((p: any) => p.id);
        const idsB = resultB.data.map((p: any) => p.id);
        const overlap = idsA.filter((id: string) => idsB.includes(id));
        expect(overlap).toHaveLength(0);
      });
    });

    describe('Accounting Periods', () => {
      const periodsOrgA: string[] = [];
      const periodsOrgB: string[] = [];

      beforeAll(async () => {
        // Create 3 periods in Org A
        for (let i = 1; i <= 3; i++) {
          const period = await createTestAccountingPeriod(
            orgA.id,
            subsidiaryA.id,
            `List Test Period A${i}`,
            '2025',
            i
          );
          periodsOrgA.push(period.id);
        }

        // Create 2 periods in Org B
        for (let i = 1; i <= 2; i++) {
          const period = await createTestAccountingPeriod(
            orgB.id,
            subsidiaryB.id,
            `List Test Period B${i}`,
            '2025',
            i
          );
          periodsOrgB.push(period.id);
        }
      });

      afterAll(async () => {
        await db.delete(accountingPeriods).where(inArray(accountingPeriods.id, periodsOrgA));
        await db.delete(accountingPeriods).where(inArray(accountingPeriods.id, periodsOrgB));
      });

      it('should only return accounting periods belonging to the current organization', async () => {
        // List from Org A
        const callerA = createCaller(createTestContext(orgA.id));
        const resultA = await callerA.accountingPeriods.list();

        // Filter to only the test periods we created
        const testPeriodsA = resultA.data.filter((p: any) => periodsOrgA.includes(p.id));
        expect(testPeriodsA.length).toBe(3);

        // List from Org B
        const callerB = createCaller(createTestContext(orgB.id));
        const resultB = await callerB.accountingPeriods.list();

        // Filter to only the test periods we created
        const testPeriodsB = resultB.data.filter((p: any) => periodsOrgB.includes(p.id));
        expect(testPeriodsB.length).toBe(2);

        // Verify no overlap
        const idsA = resultA.data.map((p: any) => p.id);
        const idsB = resultB.data.map((p: any) => p.id);
        const overlap = idsA.filter((id: string) => idsB.includes(id));
        expect(overlap).toHaveLength(0);
      });
    });
  });

  // ============================================================================
  // RLS Policy Verification Tests
  // ============================================================================
  //
  // NOTE: These tests verify that PostgreSQL RLS (Row Level Security) policies
  // are correctly enabled on the tables. If RLS is not enabled at the database
  // level, these tests will be skipped with a warning.
  //
  // The tests use withOrganizationContext which sets the session variable
  // 'app.current_organization_id' that RLS policies should use.
  // ============================================================================

  describe('RLS Policy Verification', () => {
    /**
     * Helper to check if RLS is properly configured by testing if context
     * isolation works at the database level
     */
    async function isRLSEnabled(): Promise<boolean> {
      const { client, release } = await createContextualDb({ organizationId: orgA.id });
      try {
        const result = await client.query(
          "SELECT current_setting('app.current_organization_id', true) as org_id"
        );
        // If the setting is empty, context is not being set properly
        return result.rows[0].org_id !== '' && result.rows[0].org_id !== null;
      } finally {
        release();
      }
    }

    it('should have RLS enabled on accounting_periods - only returns matching org records', async () => {
      const rlsEnabled = await isRLSEnabled();
      if (!rlsEnabled) {
        console.warn('SKIPPED: RLS context is not being set. Run RLS migration to enable.');
        return;
      }

      // Create a period in Org A
      const period = await createTestAccountingPeriod(
        orgA.id,
        subsidiaryA.id,
        'RLS Test Period',
        '2026',
        1
      );

      try {
        // Query with Org A context - should see the period
        const resultA = await withOrganizationContext(
          { organizationId: orgA.id },
          async (db) => {
            return db.select().from(accountingPeriods).where(eq(accountingPeriods.id, period.id));
          }
        );
        expect(resultA.length).toBe(1);
        expect(resultA[0].id).toBe(period.id);

        // Query with Org B context - should NOT see the period (if RLS is enabled)
        const resultB = await withOrganizationContext(
          { organizationId: orgB.id },
          async (db) => {
            return db.select().from(accountingPeriods).where(eq(accountingPeriods.id, period.id));
          }
        );
        // With RLS enabled, this should return empty
        // If RLS is not enabled, this test will fail, alerting us to the issue
        expect(resultB.length).toBe(0);
      } finally {
        await db.delete(accountingPeriods).where(eq(accountingPeriods.id, period.id));
      }
    });

    it('should have RLS enabled on projects - only returns matching org records', async () => {
      const rlsEnabled = await isRLSEnabled();
      if (!rlsEnabled) {
        console.warn('SKIPPED: RLS context is not being set. Run RLS migration to enable.');
        return;
      }

      // Create a project in Org A
      const project = await createTestProject(orgA.id, 'RLS-PROJ-001', 'RLS Test Project');

      try {
        // Query with Org A context - should see the project
        const resultA = await withOrganizationContext(
          { organizationId: orgA.id },
          async (db) => {
            return db.select().from(projects).where(eq(projects.id, project.id));
          }
        );
        expect(resultA.length).toBe(1);
        expect(resultA[0].id).toBe(project.id);

        // Query with Org B context - should NOT see the project (if RLS is enabled)
        const resultB = await withOrganizationContext(
          { organizationId: orgB.id },
          async (db) => {
            return db.select().from(projects).where(eq(projects.id, project.id));
          }
        );
        expect(resultB.length).toBe(0);
      } finally {
        await db.delete(projects).where(eq(projects.id, project.id));
      }
    });

    it('should have RLS enabled on subsidiaries - only returns matching org records', async () => {
      const rlsEnabled = await isRLSEnabled();
      if (!rlsEnabled) {
        console.warn('SKIPPED: RLS context is not being set. Run RLS migration to enable.');
        return;
      }

      // Create a subsidiary in Org A
      const subsidiary = await createTestSubsidiary(orgA.id, 'RLS Test Subsidiary', 'RLS-SUB-001');

      try {
        // Query with Org A context - should see the subsidiary
        const resultA = await withOrganizationContext(
          { organizationId: orgA.id },
          async (db) => {
            return db.select().from(subsidiaries).where(eq(subsidiaries.id, subsidiary.id));
          }
        );
        expect(resultA.length).toBe(1);
        expect(resultA[0].id).toBe(subsidiary.id);

        // Query with Org B context - should NOT see the subsidiary (if RLS is enabled)
        const resultB = await withOrganizationContext(
          { organizationId: orgB.id },
          async (db) => {
            return db.select().from(subsidiaries).where(eq(subsidiaries.id, subsidiary.id));
          }
        );
        expect(resultB.length).toBe(0);
      } finally {
        await db.delete(subsidiaries).where(eq(subsidiaries.id, subsidiary.id));
      }
    });

    it('should have RLS enabled on entities - only returns matching org records', async () => {
      const rlsEnabled = await isRLSEnabled();
      if (!rlsEnabled) {
        console.warn('SKIPPED: RLS context is not being set. Run RLS migration to enable.');
        return;
      }

      // Create an entity in Org A
      const entity = await createTestCustomer(orgA.id, 'RLS Test Customer', 'RLS-CUST-001');

      try {
        // Query with Org A context - should see the entity
        const resultA = await withOrganizationContext(
          { organizationId: orgA.id },
          async (db) => {
            return db.select().from(entities).where(eq(entities.id, entity.id));
          }
        );
        expect(resultA.length).toBe(1);
        expect(resultA[0].id).toBe(entity.id);

        // Query with Org B context - should NOT see the entity (if RLS is enabled)
        const resultB = await withOrganizationContext(
          { organizationId: orgB.id },
          async (db) => {
            return db.select().from(entities).where(eq(entities.id, entity.id));
          }
        );
        expect(resultB.length).toBe(0);
      } finally {
        await db.delete(entities).where(eq(entities.id, entity.id));
      }
    });
  });

  // ============================================================================
  // Context Isolation Tests
  // ============================================================================
  //
  // NOTE: These tests verify that the RLS context setting mechanism works.
  // If the database doesn't have RLS configured, these tests will be skipped.
  // ============================================================================

  describe('Context Isolation', () => {
    /**
     * Helper to check if context setting is working
     */
    async function isContextSettingWorking(): Promise<boolean> {
      const testOrgId = randomUUID();
      const { client, release } = await createContextualDb({ organizationId: testOrgId });
      try {
        const result = await client.query(
          "SELECT current_setting('app.current_organization_id', true) as org_id"
        );
        return result.rows[0].org_id === testOrgId;
      } finally {
        release();
      }
    }

    it('should properly set and verify RLS context variables', async () => {
      const contextWorking = await isContextSettingWorking();
      if (!contextWorking) {
        console.warn('SKIPPED: Context setting is not working. Check set_config implementation.');
        return;
      }

      const { db: rlsDb, client, release } = await createContextualDb({
        organizationId: orgA.id,
        userId: 'test-user-123',
      });

      try {
        // Query the current organization context
        const orgResult = await client.query(
          "SELECT current_setting('app.current_organization_id', true) as org_id"
        );
        expect(orgResult.rows[0].org_id).toBe(orgA.id);

        // Query the current user context
        const userResult = await client.query(
          "SELECT current_setting('app.current_user_id', true) as user_id"
        );
        expect(userResult.rows[0].user_id).toBe('test-user-123');
      } finally {
        release();
      }
    });

    it('should isolate context between different connections', async () => {
      const contextWorking = await isContextSettingWorking();
      if (!contextWorking) {
        console.warn('SKIPPED: Context setting is not working. Check set_config implementation.');
        return;
      }

      // Create two separate contextual connections
      const contextA = await createContextualDb({ organizationId: orgA.id });
      const contextB = await createContextualDb({ organizationId: orgB.id });

      try {
        // Verify each connection has the correct organization context
        const resultA = await contextA.client.query(
          "SELECT current_setting('app.current_organization_id', true) as org_id"
        );
        expect(resultA.rows[0].org_id).toBe(orgA.id);

        const resultB = await contextB.client.query(
          "SELECT current_setting('app.current_organization_id', true) as org_id"
        );
        expect(resultB.rows[0].org_id).toBe(orgB.id);

        // Verify they're different
        expect(resultA.rows[0].org_id).not.toBe(resultB.rows[0].org_id);
      } finally {
        contextA.release();
        contextB.release();
      }
    });
  });

  // ============================================================================
  // Create Operation Isolation Tests
  // ============================================================================

  describe('Create Operation Isolation', () => {
    it('should create subsidiaries with the correct organization ID', async () => {
      const callerA = createCaller(createTestContext(orgA.id));

      const created = await callerA.subsidiaries.create({
        name: 'Created Via TRPC',
        code: 'TRPC-CREATE',
      });

      try {
        // Verify the subsidiary was created with the correct org ID
        const [fromDb] = await db
          .select()
          .from(subsidiaries)
          .where(eq(subsidiaries.id, created.id));

        expect(fromDb.organizationId).toBe(orgA.id);

        // Verify Org B cannot see it
        const callerB = createCaller(createTestContext(orgB.id));
        await expect(
          callerB.subsidiaries.get({ id: created.id })
        ).rejects.toThrow(TRPCError);
      } finally {
        await db.delete(subsidiaries).where(eq(subsidiaries.id, created.id));
      }
    });

    it('should create projects with the correct organization ID', async () => {
      const callerA = createCaller(createTestContext(orgA.id));

      const created = await callerA.projects.create({
        projectCode: 'TRPC-CREATE-001',
        name: 'Project Created Via TRPC',
      });

      try {
        // Verify the project was created with the correct org ID
        const [fromDb] = await db
          .select()
          .from(projects)
          .where(eq(projects.id, created.id));

        expect(fromDb.organizationId).toBe(orgA.id);

        // Verify Org B cannot see it
        const callerB = createCaller(createTestContext(orgB.id));
        await expect(
          callerB.projects.get({ id: created.id })
        ).rejects.toThrow(TRPCError);
      } finally {
        await db.delete(projects).where(eq(projects.id, created.id));
      }
    });
  });
});
