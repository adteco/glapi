/**
 * RLS Isolation Test - Workflows Table
 *
 * Verifies that Row Level Security properly isolates workflow data
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

test.describe('Workflows Table RLS Isolation', () => {
  let clientOrgA: ReturnType<typeof createTestTRPCClient>;
  let clientOrgB: ReturnType<typeof createTestTRPCClient>;
  let createdWorkflowId: string | null = null;

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
    if (createdWorkflowId) {
      try {
        await clientOrgA.workflows.delete.mutate({ id: createdWorkflowId });
      } catch (error) {
        console.log(`Cleanup: Workflow ${createdWorkflowId} already deleted or not found`);
      }
    }
  });

  test('Org A can create workflow and Org B cannot see it', async () => {
    const workflowName = `RLS-Test-Workflow-${testId()}`;
    const created = await clientOrgA.workflows.create.mutate({
      name: workflowName,
    });

    expect(created).toBeDefined();
    expect(created.id).toBeDefined();
    createdWorkflowId = created.id;

    // Org A can retrieve their own workflow
    const orgAWorkflow = await clientOrgA.workflows.get.query({ id: created.id });
    expect(orgAWorkflow).toBeDefined();
    expect(orgAWorkflow.name).toBe(workflowName);

    // Org B cannot see Org A's workflow
    await expect(
      clientOrgB.workflows.get.query({ id: created.id })
    ).rejects.toThrow();
  });

  test('Org B cannot list Org A workflows', async () => {
    if (!createdWorkflowId) {
      const created = await clientOrgA.workflows.create.mutate({
        name: `RLS-Test-Workflow-List-${testId()}`,
      });
      createdWorkflowId = created.id;
    }

    // Org A should see their workflow in the list (workflows returns array directly)
    const orgAList = await clientOrgA.workflows.list.query({});
    const orgAWorkflowInList = orgAList.find(w => w.id === createdWorkflowId);
    expect(orgAWorkflowInList).toBeDefined();

    // Org B should NOT see Org A's workflow in their list
    const orgBList = await clientOrgB.workflows.list.query({});
    const orgBWorkflowInList = orgBList.find(w => w.id === createdWorkflowId);
    expect(orgBWorkflowInList).toBeUndefined();
  });

  test('Org B cannot update Org A workflow', async () => {
    if (!createdWorkflowId) {
      const created = await clientOrgA.workflows.create.mutate({
        name: `RLS-Test-Workflow-Update-${testId()}`,
      });
      createdWorkflowId = created.id;
    }

    // Org B should NOT be able to update Org A's workflow
    await expect(
      clientOrgB.workflows.update.mutate({
        id: createdWorkflowId,
        data: { name: 'Hacked Name' },
      })
    ).rejects.toThrow();

    // Verify name was NOT changed
    const orgAWorkflow = await clientOrgA.workflows.get.query({ id: createdWorkflowId });
    expect(orgAWorkflow.name).not.toBe('Hacked Name');
  });

  test('Org B cannot delete Org A workflow', async () => {
    const created = await clientOrgA.workflows.create.mutate({
      name: `RLS-Test-Workflow-Delete-${testId()}`,
    });

    // Org B should NOT be able to delete Org A's workflow
    await expect(
      clientOrgB.workflows.delete.mutate({ id: created.id })
    ).rejects.toThrow();

    // Verify workflow still exists for Org A
    const orgAWorkflow = await clientOrgA.workflows.get.query({ id: created.id });
    expect(orgAWorkflow).toBeDefined();

    // Clean up
    await clientOrgA.workflows.delete.mutate({ id: created.id });
  });

  test('Each organization only sees their own workflows', async () => {
    const orgAWorkflowName = `RLS-OrgA-Workflow-${testId()}`;
    const orgBWorkflowName = `RLS-OrgB-Workflow-${testId()}`;

    const orgACreated = await clientOrgA.workflows.create.mutate({
      name: orgAWorkflowName,
    });

    const orgBCreated = await clientOrgB.workflows.create.mutate({
      name: orgBWorkflowName,
    });

    try {
      // Org A list should contain their workflow but not Org B's
      const orgAList = await clientOrgA.workflows.list.query({});
      expect(orgAList.some(w => w.id === orgACreated.id)).toBe(true);
      expect(orgAList.some(w => w.id === orgBCreated.id)).toBe(false);

      // Org B list should contain their workflow but not Org A's
      const orgBList = await clientOrgB.workflows.list.query({});
      expect(orgBList.some(w => w.id === orgBCreated.id)).toBe(true);
      expect(orgBList.some(w => w.id === orgACreated.id)).toBe(false);
    } finally {
      await clientOrgA.workflows.delete.mutate({ id: orgACreated.id });
      await clientOrgB.workflows.delete.mutate({ id: orgBCreated.id });
    }
  });
});
