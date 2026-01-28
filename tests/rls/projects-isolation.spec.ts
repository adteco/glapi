/**
 * RLS Isolation Test - Projects Table
 *
 * Verifies that Row Level Security properly isolates project data
 * between organizations.
 */

import { test, expect } from '@playwright/test';
import {
  createTestTRPCClient,
  testId,
  waitForApi,
  TEST_CONFIG,
} from '../helpers/api-client';

const ORG_B_CONFIG = {
  organizationId: '456c2475-2277-4d90-929b-ae694a2a8577',
  userId: 'api-key-user',
  apiKey: 'glapi_test_sk_orgb_0987654321fedcba',
};

test.describe('Projects Table RLS Isolation', () => {
  let clientOrgA: ReturnType<typeof createTestTRPCClient>;
  let clientOrgB: ReturnType<typeof createTestTRPCClient>;
  let createdProjectId: string | null = null;

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
    if (createdProjectId) {
      try {
        await clientOrgA.projects.delete.mutate({ id: createdProjectId });
      } catch (error) {
        console.log(`Cleanup: Project ${createdProjectId} already deleted or not found`);
      }
    }
  });

  test('Org A can create project and Org B cannot see it', async () => {
    const projectCode = `RLS-${Date.now()}`;
    const projectName = `RLS-Test-Project-${testId()}`;
    const created = await clientOrgA.projects.create.mutate({
      projectCode,
      name: projectName,
    });

    expect(created).toBeDefined();
    expect(created.id).toBeDefined();
    createdProjectId = created.id;

    // Org A can retrieve their own project
    const orgAProject = await clientOrgA.projects.get.query({ id: created.id });
    expect(orgAProject).toBeDefined();
    expect(orgAProject.name).toBe(projectName);

    // Org B cannot see Org A's project
    await expect(
      clientOrgB.projects.get.query({ id: created.id })
    ).rejects.toThrow();
  });

  test('Org B cannot list Org A projects', async () => {
    if (!createdProjectId) {
      const created = await clientOrgA.projects.create.mutate({
        projectCode: `RLS-L-${Date.now()}`,
        name: `RLS-Test-Project-List-${testId()}`,
      });
      createdProjectId = created.id;
    }

    // Org A should see their project in the list (projects returns array directly)
    const orgAList = await clientOrgA.projects.list.query({});
    const orgAProjectInList = orgAList.find(p => p.id === createdProjectId);
    expect(orgAProjectInList).toBeDefined();

    // Org B should NOT see Org A's project in their list
    const orgBList = await clientOrgB.projects.list.query({});
    const orgBProjectInList = orgBList.find(p => p.id === createdProjectId);
    expect(orgBProjectInList).toBeUndefined();
  });

  test('Org B cannot update Org A project', async () => {
    if (!createdProjectId) {
      const created = await clientOrgA.projects.create.mutate({
        projectCode: `RLS-U-${Date.now()}`,
        name: `RLS-Test-Project-Update-${testId()}`,
      });
      createdProjectId = created.id;
    }

    // Org B should NOT be able to update Org A's project
    await expect(
      clientOrgB.projects.update.mutate({
        id: createdProjectId,
        data: { name: 'Hacked Name' },
      })
    ).rejects.toThrow();

    // Verify name was NOT changed
    const orgAProject = await clientOrgA.projects.get.query({ id: createdProjectId });
    expect(orgAProject.name).not.toBe('Hacked Name');
  });

  test('Org B cannot delete Org A project', async () => {
    const created = await clientOrgA.projects.create.mutate({
      projectCode: `RLS-D-${Date.now()}`,
      name: `RLS-Test-Project-Delete-${testId()}`,
    });

    // Org B should NOT be able to delete Org A's project
    await expect(
      clientOrgB.projects.delete.mutate({ id: created.id })
    ).rejects.toThrow();

    // Verify project still exists for Org A
    const orgAProject = await clientOrgA.projects.get.query({ id: created.id });
    expect(orgAProject).toBeDefined();

    // Clean up
    await clientOrgA.projects.delete.mutate({ id: created.id });
  });

  test('Each organization only sees their own projects', async () => {
    const orgAProjectName = `RLS-OrgA-Project-${testId()}`;
    const orgBProjectName = `RLS-OrgB-Project-${testId()}`;

    const orgACreated = await clientOrgA.projects.create.mutate({
      projectCode: `RLS-A-${Date.now()}`,
      name: orgAProjectName,
    });

    const orgBCreated = await clientOrgB.projects.create.mutate({
      projectCode: `RLS-B-${Date.now()}`,
      name: orgBProjectName,
    });

    try {
      // Org A list should contain their project but not Org B's
      const orgAList = await clientOrgA.projects.list.query({});
      expect(orgAList.some(p => p.id === orgACreated.id)).toBe(true);
      expect(orgAList.some(p => p.id === orgBCreated.id)).toBe(false);

      // Org B list should contain their project but not Org A's
      const orgBList = await clientOrgB.projects.list.query({});
      expect(orgBList.some(p => p.id === orgBCreated.id)).toBe(true);
      expect(orgBList.some(p => p.id === orgACreated.id)).toBe(false);
    } finally {
      await clientOrgA.projects.delete.mutate({ id: orgACreated.id });
      await clientOrgB.projects.delete.mutate({ id: orgBCreated.id });
    }
  });
});
