/**
 * RLS Isolation Test - Departments Table
 *
 * Verifies that Row Level Security properly isolates department data
 * between organizations.
 *
 * Table: departments
 * Migration: 0054_enable_rls_departments.sql
 */

import { test, expect } from '@playwright/test';
import {
  createTestTRPCClient,
  testId,
  waitForApi,
  TEST_CONFIG,
} from '../helpers/api-client';

// Organization configs with subsidiary IDs
const ORG_A_SUBSIDIARY_ID = 'd90771e4-e372-4089-a567-f2e5684c3427'; // Adteco Default Subsidiary
const ORG_B_SUBSIDIARY_ID = 'e5f2c7a8-1234-5678-90ab-cdef12345678'; // CJD-Consulting Default Subsidiary

const ORG_B_CONFIG = {
  organizationId: '456c2475-2277-4d90-929b-ae694a2a8577',
  userId: 'api-key-user',
  apiKey: 'glapi_test_sk_orgb_0987654321fedcba',
};

test.describe('Departments Table RLS Isolation', () => {
  let clientOrgA: ReturnType<typeof createTestTRPCClient>;
  let clientOrgB: ReturnType<typeof createTestTRPCClient>;
  let createdDepartmentId: string | null = null;

  test.beforeAll(async () => {
    const apiReady = await waitForApi(10, 2000);
    if (!apiReady) {
      console.warn('API not available, tests may fail');
    }

    clientOrgA = createTestTRPCClient();
    clientOrgB = createTestTRPCClient({
      organizationId: ORG_B_CONFIG.organizationId,
      userId: ORG_B_CONFIG.userId,
      apiKey: ORG_B_CONFIG.apiKey,
    });
  });

  test.afterAll(async () => {
    if (createdDepartmentId) {
      try {
        await clientOrgA.departments.delete.mutate({ id: createdDepartmentId });
      } catch (error) {
        console.log(`Cleanup: Department ${createdDepartmentId} already deleted or not found`);
      }
    }
  });

  test('Org A can create department and Org B cannot see it', async () => {
    const departmentName = `RLS-Test-Dept-${testId()}`;
    const created = await clientOrgA.departments.create.mutate({
      name: departmentName,
      code: `RLS-${Date.now()}`,
      subsidiaryId: ORG_A_SUBSIDIARY_ID,
      isActive: true,
    });

    expect(created).toBeDefined();
    expect(created.id).toBeDefined();
    expect(created.organizationId).toBe(TEST_CONFIG.organizationId);
    createdDepartmentId = created.id;

    // Org A can retrieve their own department
    const orgADept = await clientOrgA.departments.get.query({ id: created.id });
    expect(orgADept).toBeDefined();
    expect(orgADept.name).toBe(departmentName);

    // Org B cannot see Org A's department
    await expect(
      clientOrgB.departments.get.query({ id: created.id })
    ).rejects.toThrow();
  });

  test('Org B cannot list Org A departments', async () => {
    if (!createdDepartmentId) {
      const created = await clientOrgA.departments.create.mutate({
        name: `RLS-Test-Dept-List-${testId()}`,
        code: `RLS-L-${Date.now()}`,
        subsidiaryId: ORG_A_SUBSIDIARY_ID,
        isActive: true,
      });
      createdDepartmentId = created.id;
    }

    // Org A should see their department in the list
    const orgAList = await clientOrgA.departments.list.query({});
    const orgADeptInList = orgAList.find(d => d.id === createdDepartmentId);
    expect(orgADeptInList).toBeDefined();

    // Org B should NOT see Org A's department in their list
    const orgBList = await clientOrgB.departments.list.query({});
    const orgBDeptInList = orgBList.find(d => d.id === createdDepartmentId);
    expect(orgBDeptInList).toBeUndefined();
  });

  test('Org B cannot update Org A department', async () => {
    if (!createdDepartmentId) {
      const created = await clientOrgA.departments.create.mutate({
        name: `RLS-Test-Dept-Update-${testId()}`,
        code: `RLS-U-${Date.now()}`,
        subsidiaryId: ORG_A_SUBSIDIARY_ID,
        isActive: true,
      });
      createdDepartmentId = created.id;
    }

    // Org B should NOT be able to update Org A's department
    await expect(
      clientOrgB.departments.update.mutate({
        id: createdDepartmentId,
        data: { name: 'Hacked Name' },
      })
    ).rejects.toThrow();

    // Verify name was NOT changed
    const orgADept = await clientOrgA.departments.get.query({ id: createdDepartmentId });
    expect(orgADept.name).not.toBe('Hacked Name');
  });

  test('Org B cannot delete Org A department', async () => {
    const created = await clientOrgA.departments.create.mutate({
      name: `RLS-Test-Dept-Delete-${testId()}`,
      code: `RLS-D-${Date.now()}`,
      subsidiaryId: ORG_A_SUBSIDIARY_ID,
      isActive: true,
    });

    // Org B should NOT be able to delete Org A's department
    await expect(
      clientOrgB.departments.delete.mutate({ id: created.id })
    ).rejects.toThrow();

    // Verify department still exists for Org A
    const orgADept = await clientOrgA.departments.get.query({ id: created.id });
    expect(orgADept).toBeDefined();

    // Clean up
    await clientOrgA.departments.delete.mutate({ id: created.id });
  });

  test('Each organization only sees their own departments', async () => {
    const orgADeptName = `RLS-OrgA-Dept-${testId()}`;
    const orgBDeptName = `RLS-OrgB-Dept-${testId()}`;

    const orgACreated = await clientOrgA.departments.create.mutate({
      name: orgADeptName,
      code: `RLS-A-${Date.now()}`,
      subsidiaryId: ORG_A_SUBSIDIARY_ID,
      isActive: true,
    });

    const orgBCreated = await clientOrgB.departments.create.mutate({
      name: orgBDeptName,
      code: `RLS-B-${Date.now()}`,
      subsidiaryId: ORG_B_SUBSIDIARY_ID,
      isActive: true,
    });

    try {
      // Org A list should contain their department but not Org B's
      const orgAList = await clientOrgA.departments.list.query({});
      expect(orgAList.some(d => d.id === orgACreated.id)).toBe(true);
      expect(orgAList.some(d => d.id === orgBCreated.id)).toBe(false);

      // Org B list should contain their department but not Org A's
      const orgBList = await clientOrgB.departments.list.query({});
      expect(orgBList.some(d => d.id === orgBCreated.id)).toBe(true);
      expect(orgBList.some(d => d.id === orgACreated.id)).toBe(false);
    } finally {
      await clientOrgA.departments.delete.mutate({ id: orgACreated.id });
      await clientOrgB.departments.delete.mutate({ id: orgBCreated.id });
    }
  });
});
