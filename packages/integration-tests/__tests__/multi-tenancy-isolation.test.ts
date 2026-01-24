/**
 * Multi-Tenancy Isolation Tests
 *
 * Validates that data from one organization cannot be accessed or modified
 * by another organization. This is a critical security test suite that covers:
 * - Workflows and workflow components
 * - Projects and project participants
 * - Invoices and payments
 * - Items and pricing
 * - Contacts, vendors, employees
 *
 * @module multi-tenancy-isolation.test
 * @task glapi-aeym
 * @epic glapi-d5wq
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { TestDatabase } from '../helpers/test-database';
import { TestDataGenerator } from '../helpers/test-data-generator';
import { createCallerFactory, appRouter, type Context } from '@glapi/trpc';
import { workflows } from '@glapi/database';

describe('Multi-Tenancy Isolation Tests', () => {
  let testDb: TestDatabase;
  let dataGenerator: TestDataGenerator;

  // Organization A context
  let orgAId: string;
  let orgAUserId: string;
  let orgACaller: any;

  // Organization B context
  let orgBId: string;
  let orgBUserId: string;
  let orgBCaller: any;

  // Test data IDs (created by Org A)
  let orgAProjectId: string;
  let orgACustomerId: string;
  let orgAWorkflowId: string;
  let orgAInvoiceId: string;
  let orgAItemId: string;

  beforeAll(async () => {
    testDb = new TestDatabase();
    await testDb.setup();
    dataGenerator = new TestDataGenerator(testDb.db);

    // Create Organization A
    const orgA = await dataGenerator.createOrganization('Organization A');
    orgAId = orgA.id;
    const userA = await dataGenerator.createEmployee(orgAId, 'User A');
    orgAUserId = userA.id;

    // Create Organization B
    const orgB = await dataGenerator.createOrganization('Organization B');
    orgBId = orgB.id;
    const userB = await dataGenerator.createEmployee(orgBId, 'User B');
    orgBUserId = userB.id;

    // Create TRPC callers for each organization
    const createCaller = createCallerFactory(appRouter);

    const contextA: Context = {
      req: undefined,
      res: undefined,
      user: {
        id: orgAUserId,
        organizationId: orgAId,
        email: 'user-a@test.com',
        role: 'admin',
      },
      db: testDb.db,
      serviceContext: {
        organizationId: orgAId,
        userId: orgAUserId,
      },
    };
    orgACaller = createCaller(contextA);

    const contextB: Context = {
      req: undefined,
      res: undefined,
      user: {
        id: orgBUserId,
        organizationId: orgBId,
        email: 'user-b@test.com',
        role: 'admin',
      },
      db: testDb.db,
      serviceContext: {
        organizationId: orgBId,
        userId: orgBUserId,
      },
    };
    orgBCaller = createCaller(contextB);

    // Create test data for Organization A
    const customer = await dataGenerator.createCustomer(orgAId, 'Org A Customer');
    orgACustomerId = customer.id;

    const project = await dataGenerator.createProject(orgAId, 'Org A Project');
    orgAProjectId = project.id;

    orgAItemId = await dataGenerator.createSoftwareLicenseItem(orgAId);

    // Create invoice for Org A
    const subscription = await dataGenerator.createSubscription(orgAId, orgACustomerId, [
      { itemId: orgAItemId, quantity: 1, unitPrice: 10000 },
    ]);
    const invoice = await dataGenerator.createInvoice(
      subscription.id,
      orgAId,
      orgACustomerId,
      10000
    );
    orgAInvoiceId = invoice.id;

    // Create workflow for Org A
    const [workflow] = await testDb.db
      .insert(workflows)
      .values({
        organizationId: orgAId,
        name: 'Org A Workflow',
        isTemplate: false,
        isActive: true,
      })
      .returning();
    orgAWorkflowId = workflow.id;
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  describe('Workflow Isolation', () => {
    it('should not allow Org B to see Org A workflows in list', async () => {
      // Org A should see their workflow
      const orgAWorkflows = await orgACaller.workflows.list();
      expect(orgAWorkflows.data.some((w: any) => w.id === orgAWorkflowId)).toBe(true);

      // Org B should NOT see Org A's workflow
      const orgBWorkflows = await orgBCaller.workflows.list();
      expect(orgBWorkflows.data.some((w: any) => w.id === orgAWorkflowId)).toBe(false);
    });

    it('should not allow Org B to get Org A workflow by ID', async () => {
      // Org A can get their workflow
      const orgAResult = await orgACaller.workflows.get({ id: orgAWorkflowId });
      expect(orgAResult).toBeDefined();
      expect(orgAResult.id).toBe(orgAWorkflowId);

      // Org B should get null or throw NOT_FOUND
      const orgBResult = await orgBCaller.workflows.get({ id: orgAWorkflowId });
      expect(orgBResult).toBeNull();
    });

    it('should not allow Org B to update Org A workflow', async () => {
      // Attempt to update Org A's workflow from Org B context should fail or do nothing
      try {
        await orgBCaller.workflows.update({
          id: orgAWorkflowId,
          name: 'Hacked by Org B',
        });
        // If no error, verify the workflow wasn't actually updated
        const workflow = await orgACaller.workflows.get({ id: orgAWorkflowId });
        expect(workflow.name).toBe('Org A Workflow'); // Should be unchanged
      } catch (error: any) {
        // Expected: Should throw NOT_FOUND or similar
        expect(['NOT_FOUND', 'FORBIDDEN']).toContain(error.code);
      }
    });

    it('should not allow Org B to delete Org A workflow', async () => {
      try {
        await orgBCaller.workflows.delete({ id: orgAWorkflowId });
        // If no error, verify the workflow still exists for Org A
        const workflow = await orgACaller.workflows.get({ id: orgAWorkflowId });
        expect(workflow).toBeDefined();
      } catch (error: any) {
        expect(['NOT_FOUND', 'FORBIDDEN']).toContain(error.code);
      }
    });
  });

  describe('Project Isolation', () => {
    it('should not allow Org B to see Org A projects in list', async () => {
      const orgAProjects = await orgACaller.projects.list({});
      expect(orgAProjects.data.some((p: any) => p.id === orgAProjectId)).toBe(true);

      const orgBProjects = await orgBCaller.projects.list({});
      expect(orgBProjects.data.some((p: any) => p.id === orgAProjectId)).toBe(false);
    });

    it('should not allow Org B to get Org A project by ID', async () => {
      const orgAResult = await orgACaller.projects.getById({ id: orgAProjectId });
      expect(orgAResult).toBeDefined();

      try {
        const orgBResult = await orgBCaller.projects.getById({ id: orgAProjectId });
        expect(orgBResult).toBeNull();
      } catch (error: any) {
        expect(['NOT_FOUND', 'FORBIDDEN']).toContain(error.code);
      }
    });

    it('should not allow Org B to add participants to Org A project', async () => {
      try {
        await orgBCaller.projects.addParticipant({
          projectId: orgAProjectId,
          participantRole: 'contractor',
          displayName: 'Malicious Participant',
        });
        // Should not succeed - verify participant was not added
        const participants = await orgACaller.projects.listParticipants({
          projectId: orgAProjectId,
        });
        expect(
          participants.some((p: any) => p.displayName === 'Malicious Participant')
        ).toBe(false);
      } catch (error: any) {
        expect(['NOT_FOUND', 'FORBIDDEN']).toContain(error.code);
      }
    });
  });

  describe('Invoice Isolation', () => {
    it('should not allow Org B to see Org A invoices in list', async () => {
      const orgAInvoices = await orgACaller.invoices.list({});
      expect(orgAInvoices.data.some((i: any) => i.id === orgAInvoiceId)).toBe(true);

      const orgBInvoices = await orgBCaller.invoices.list({});
      expect(orgBInvoices.data.some((i: any) => i.id === orgAInvoiceId)).toBe(false);
    });

    it('should not allow Org B to get Org A invoice by ID', async () => {
      const orgAResult = await orgACaller.invoices.get({ id: orgAInvoiceId });
      expect(orgAResult).toBeDefined();

      try {
        const orgBResult = await orgBCaller.invoices.get({ id: orgAInvoiceId });
        expect(orgBResult).toBeNull();
      } catch (error: any) {
        expect(['NOT_FOUND', 'FORBIDDEN']).toContain(error.code);
      }
    });

    it('should not allow Org B to void Org A invoice', async () => {
      try {
        await orgBCaller.invoices.void({
          id: orgAInvoiceId,
          reason: 'Malicious void attempt',
        });
        // Verify invoice status is unchanged
        const invoice = await orgACaller.invoices.get({ id: orgAInvoiceId });
        expect(invoice.status).not.toBe('void');
      } catch (error: any) {
        expect(['NOT_FOUND', 'FORBIDDEN']).toContain(error.code);
      }
    });
  });

  describe('Payment Isolation', () => {
    let orgAPaymentId: string;

    beforeAll(async () => {
      // Create a payment for Org A
      const payment = await dataGenerator.createPayment(orgAInvoiceId, orgAId, 5000);
      orgAPaymentId = payment.id;
    });

    it('should not allow Org B to see Org A payments in list', async () => {
      const orgAPayments = await orgACaller.payments.list({});
      expect(orgAPayments.data.some((p: any) => p.id === orgAPaymentId)).toBe(true);

      const orgBPayments = await orgBCaller.payments.list({});
      expect(orgBPayments.data.some((p: any) => p.id === orgAPaymentId)).toBe(false);
    });

    it('should not allow Org B to get Org A payment by ID', async () => {
      const orgAResult = await orgACaller.payments.get({ id: orgAPaymentId });
      expect(orgAResult).toBeDefined();

      try {
        const orgBResult = await orgBCaller.payments.get({ id: orgAPaymentId });
        expect(orgBResult).toBeNull();
      } catch (error: any) {
        expect(['NOT_FOUND', 'FORBIDDEN']).toContain(error.code);
      }
    });

    it('should not allow Org B to refund Org A payment', async () => {
      try {
        await orgBCaller.payments.refund({
          id: orgAPaymentId,
          amount: '1000',
          reason: 'Malicious refund',
        });
        // If no error, verify refund was not processed
        const payment = await orgACaller.payments.get({ id: orgAPaymentId });
        expect(payment.status).not.toBe('refunded');
      } catch (error: any) {
        expect(['NOT_FOUND', 'FORBIDDEN']).toContain(error.code);
      }
    });
  });

  describe('Item Isolation', () => {
    it('should not allow Org B to see Org A items in list', async () => {
      const orgAItems = await orgACaller.items.list({});
      expect(orgAItems.some((i: any) => i.id === orgAItemId)).toBe(true);

      const orgBItems = await orgBCaller.items.list({});
      expect(orgBItems.some((i: any) => i.id === orgAItemId)).toBe(false);
    });

    it('should not allow Org B to get Org A item by ID', async () => {
      const orgAResult = await orgACaller.items.get({ id: orgAItemId });
      expect(orgAResult).toBeDefined();

      try {
        const orgBResult = await orgBCaller.items.get({ id: orgAItemId });
        expect(orgBResult).toBeNull();
      } catch (error: any) {
        expect(['NOT_FOUND', 'FORBIDDEN']).toContain(error.code);
      }
    });

    it('should not allow Org B to update Org A item', async () => {
      try {
        await orgBCaller.items.update({
          id: orgAItemId,
          data: { name: 'Hacked Item Name' },
        });
        // Verify item was not updated
        const item = await orgACaller.items.get({ id: orgAItemId });
        expect(item.name).not.toBe('Hacked Item Name');
      } catch (error: any) {
        expect(['NOT_FOUND', 'FORBIDDEN']).toContain(error.code);
      }
    });
  });

  describe('Customer Isolation', () => {
    it('should not allow Org B to see Org A customers in list', async () => {
      const orgACustomers = await orgACaller.customers.list({});
      expect(orgACustomers.data.some((c: any) => c.id === orgACustomerId)).toBe(true);

      const orgBCustomers = await orgBCaller.customers.list({});
      expect(orgBCustomers.data.some((c: any) => c.id === orgACustomerId)).toBe(false);
    });

    it('should not allow Org B to get Org A customer by ID', async () => {
      const orgAResult = await orgACaller.customers.getById({ id: orgACustomerId });
      expect(orgAResult).toBeDefined();

      try {
        const orgBResult = await orgBCaller.customers.getById({ id: orgACustomerId });
        expect(orgBResult).toBeNull();
      } catch (error: any) {
        expect(['NOT_FOUND', 'FORBIDDEN']).toContain(error.code);
      }
    });

    it('should not allow Org B to delete Org A customer', async () => {
      try {
        await orgBCaller.customers.delete({ id: orgACustomerId });
        // Verify customer still exists for Org A
        const customer = await orgACaller.customers.getById({ id: orgACustomerId });
        expect(customer).toBeDefined();
      } catch (error: any) {
        expect(['NOT_FOUND', 'FORBIDDEN']).toContain(error.code);
      }
    });
  });

  describe('Cross-Organization Data Creation Prevention', () => {
    it('should not allow Org B to create invoice for Org A customer', async () => {
      try {
        await orgBCaller.invoices.create({
          entityId: orgACustomerId, // Org A's customer
          invoiceDate: new Date(),
          lineItems: [
            {
              description: 'Malicious invoice',
              quantity: 1,
              unitPrice: 1000,
              amount: 1000,
            },
          ],
        });
        // If no error, verify invoice was not created with Org A's customer
        const orgBInvoices = await orgBCaller.invoices.list({});
        expect(
          orgBInvoices.data.some((i: any) => i.entityId === orgACustomerId)
        ).toBe(false);
      } catch (error: any) {
        // Expected: Should fail because customer doesn't belong to Org B
        expect(['NOT_FOUND', 'FORBIDDEN', 'BAD_REQUEST']).toContain(error.code);
      }
    });

    it('should not allow Org B to create payment for Org A invoice', async () => {
      try {
        await orgBCaller.payments.create({
          invoiceId: orgAInvoiceId, // Org A's invoice
          paymentDate: new Date(),
          amount: '500',
          paymentMethod: 'bank_transfer',
        });
        // If no error, verify payment was not created
        const orgBPayments = await orgBCaller.payments.list({});
        expect(
          orgBPayments.data.some((p: any) => p.invoiceId === orgAInvoiceId)
        ).toBe(false);
      } catch (error: any) {
        expect(['NOT_FOUND', 'FORBIDDEN', 'INVOICE_NOT_FOUND']).toContain(error.code);
      }
    });
  });

  describe('Bulk Operation Isolation', () => {
    it('should only process Org A data when Org A runs bulk operations', async () => {
      // Create additional data for both orgs
      const orgBItemId = await dataGenerator.createSoftwareLicenseItem(orgBId);
      const orgBCustomer = await dataGenerator.createCustomer(orgBId, 'Org B Customer');

      // Verify Org A bulk list doesn't include Org B data
      const orgAItems = await orgACaller.items.list({});
      expect(orgAItems.some((i: any) => i.id === orgBItemId)).toBe(false);

      // Verify Org B bulk list doesn't include Org A data
      const orgBItems = await orgBCaller.items.list({});
      expect(orgBItems.some((i: any) => i.id === orgAItemId)).toBe(false);
    });
  });
});
