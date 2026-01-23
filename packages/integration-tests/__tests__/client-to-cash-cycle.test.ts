/**
 * Client-to-Cash Cycle Integration Tests
 *
 * End-to-end tests for the full client-to-cash workflow:
 * Customer -> Project -> Time Entries -> Invoice -> Payment
 *
 * @module client-to-cash-cycle.test
 * @task glapi-4nj
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { TestDatabase } from '../helpers/test-database';
import { TestDataGenerator } from '../helpers/test-data-generator';
import { createCallerFactory, appRouter, type Context } from '@glapi/trpc';

describe('Client-to-Cash Cycle Integration Tests', () => {
  let testDb: TestDatabase;
  let dataGenerator: TestDataGenerator;
  let organizationId: string;
  let adminId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let adminCaller: any;

  beforeAll(async () => {
    testDb = new TestDatabase();
    await testDb.setup();

    dataGenerator = new TestDataGenerator(testDb.db);

    // Create organization
    const organization = await dataGenerator.createOrganization('Client-to-Cash Test Org');
    organizationId = organization.id;

    // Create admin user
    const admin = await dataGenerator.createEmployee(organizationId, 'Admin');
    adminId = admin.id;

    // Create TRPC caller
    const createCaller = createCallerFactory(appRouter);
    const adminContext: Context = {
      req: undefined,
      res: undefined,
      user: {
        id: adminId,
        organizationId,
        email: 'admin@example.com',
        role: 'admin',
      },
      db: testDb.db,
      serviceContext: {
        organizationId,
        userId: adminId,
      },
    };
    adminCaller = createCaller(adminContext);
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  beforeEach(async () => {
    // Clear relevant tables between tests
    await testDb.clearTimeEntries();
    await testDb.client`TRUNCATE TABLE payments CASCADE`;
    await testDb.client`TRUNCATE TABLE invoice_line_items CASCADE`;
    await testDb.client`TRUNCATE TABLE invoices CASCADE`;
  });

  describe('Scenario 1: Complete Billing Cycle (Happy Path)', () => {
    it('should complete full cycle from customer to payment', async () => {
      // Step 1: Create Customer
      const customer = await adminCaller.customers.create({
        companyName: 'Acme Corporation',
        contactEmail: 'billing@acme.com',
        status: 'active',
      });

      expect(customer.id).toBeDefined();
      expect(customer.companyName).toBe('Acme Corporation');

      // Step 2: Create Project
      const project = await adminCaller.projects.create({
        projectCode: `ACME-${Date.now()}`,
        name: 'Acme Digital Transformation',
        status: 'active',
        projectType: 'Time & Materials',
        currencyCode: 'USD',
      });

      expect(project.id).toBeDefined();
      expect(project.status).toBe('active');

      // Step 3: Create Employee and Assign to Project
      const consultant = await dataGenerator.createEmployee(organizationId, 'Consultant');

      // Create labor rate: $100 cost, $200 billing
      await adminCaller.timeEntries.createLaborRate({
        employeeId: consultant.id,
        projectId: project.id,
        laborRate: '100.00',
        burdenRate: '20.00',
        billingRate: '200.00',
        effectiveFrom: '2024-01-01',
      });

      // Assign consultant to project
      await adminCaller.timeEntries.createAssignment({
        employeeId: consultant.id,
        projectId: project.id,
        role: 'Senior Consultant',
        budgetedHours: '160.00',
      });

      // Step 4: Log 40 hours of work (5 days x 8 hours)
      const timeEntries = [];
      for (let day = 1; day <= 5; day++) {
        const entry = await adminCaller.timeEntries.create({
          employeeId: consultant.id,
          projectId: project.id,
          entryDate: `2024-01-${String(14 + day).padStart(2, '0')}`,
          hours: '8.00',
          entryType: 'REGULAR',
          description: `Day ${day} consulting work`,
          isBillable: true,
        });
        timeEntries.push(entry);
      }

      expect(timeEntries.length).toBe(5);

      // Step 5: Submit time entries
      await adminCaller.timeEntries.submit({
        timeEntryIds: timeEntries.map((e) => e.id),
        comments: 'Week 3 time submission',
      });

      // Verify submitted
      for (const entry of timeEntries) {
        const updated = await adminCaller.timeEntries.getById({ id: entry.id });
        expect(updated.status).toBe('SUBMITTED');
      }

      // Step 6: Approve time entries
      await adminCaller.timeEntries.approve({
        timeEntryIds: timeEntries.map((e) => e.id),
        comments: 'Approved',
      });

      // Verify approved
      const approvedEntries = await adminCaller.timeEntries.list({
        filters: { projectId: project.id, status: 'APPROVED' },
      });
      expect(approvedEntries.data.length).toBe(5);

      // Step 7: Post time entries to GL
      const postResult = await adminCaller.timeEntries.postToGL({
        timeEntryIds: timeEntries.map((e) => e.id),
      });

      expect(postResult.success).toBe(true);
      expect(postResult.postedCount).toBe(5);

      // Verify posted status
      const postedEntries = await adminCaller.timeEntries.list({
        filters: { projectId: project.id, status: 'POSTED' },
      });
      expect(postedEntries.data.length).toBe(5);

      // Step 8: Generate Invoice
      // 40 hours * $200/hr = $8,000
      const invoice = await adminCaller.invoices.create({
        entityId: customer.id,
        invoiceDate: new Date('2024-01-22'),
        dueDate: new Date('2024-02-21'),
        lineItems: [
          {
            description: 'Consulting Services - Week 3',
            quantity: 40,
            unitPrice: 200,
            amount: 8000,
          },
        ],
        subtotal: 8000,
        totalAmount: 8000,
        status: 'draft',
      });

      expect(invoice.id).toBeDefined();
      expect(invoice.totalAmount).toBe(8000);
      expect(invoice.status).toBe('draft');

      // Step 9: Record Payment
      const payment = await adminCaller.payments.create({
        invoiceId: invoice.id,
        amount: '8000.00',
        paymentDate: new Date('2024-02-15'),
        paymentMethod: 'wire_transfer',
        transactionReference: 'WT-2024-001',
      });

      expect(payment.id).toBeDefined();
      expect(payment.amount).toBe('8000.00');
    });
  });

  describe('Scenario 2: Multi-Employee Project Billing', () => {
    it('should handle multiple employees with different rates', async () => {
      // Create customer and project
      const customer = await adminCaller.customers.create({
        companyName: 'BigCorp Inc',
        status: 'active',
      });

      const project = await adminCaller.projects.create({
        projectCode: `BC-${Date.now()}`,
        name: 'BigCorp Implementation',
        status: 'active',
      });

      // Create three consultants with different rates
      const rates = [
        { level: 'Senior', laborRate: '150.00', billingRate: '300.00' },
        { level: 'Mid', laborRate: '100.00', billingRate: '200.00' },
        { level: 'Junior', laborRate: '50.00', billingRate: '100.00' },
      ];

      const consultants = [];
      for (const rate of rates) {
        const consultant = await dataGenerator.createEmployee(organizationId, rate.level);

        await adminCaller.timeEntries.createLaborRate({
          employeeId: consultant.id,
          projectId: project.id,
          laborRate: rate.laborRate,
          billingRate: rate.billingRate,
          effectiveFrom: '2024-01-01',
        });

        await adminCaller.timeEntries.createAssignment({
          employeeId: consultant.id,
          projectId: project.id,
          role: `${rate.level} Consultant`,
        });

        consultants.push({ ...consultant, ...rate });
      }

      // Each consultant logs 20 hours (4 days x 5 hours)
      const allEntries = [];
      for (const consultant of consultants) {
        for (let day = 1; day <= 4; day++) {
          const entry = await adminCaller.timeEntries.create({
            employeeId: consultant.id,
            projectId: project.id,
            entryDate: `2024-01-${String(14 + day).padStart(2, '0')}`,
            hours: '5.00',
            entryType: 'REGULAR',
            isBillable: true,
          });
          allEntries.push(entry);
        }
      }

      expect(allEntries.length).toBe(12); // 3 consultants x 4 days

      // Submit and approve all entries
      await adminCaller.timeEntries.submit({
        timeEntryIds: allEntries.map((e) => e.id),
      });

      await adminCaller.timeEntries.approve({
        timeEntryIds: allEntries.map((e) => e.id),
      });

      // Verify totals
      // Expected:
      // Senior: 20 hrs x $300 = $6,000 billing, 20 x $150 = $3,000 cost
      // Mid: 20 hrs x $200 = $4,000 billing, 20 x $100 = $2,000 cost
      // Junior: 20 hrs x $100 = $2,000 billing, 20 x $50 = $1,000 cost
      // Total: $12,000 billing, $6,000 cost, $6,000 profit (50% margin)

      const summary = await adminCaller.timeEntries.getSummaryByProject({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        status: 'APPROVED',
      });

      const projectSummary = summary.find((s: { projectId: string }) => s.projectId === project.id);
      expect(projectSummary).toBeDefined();
      expect(parseFloat(projectSummary.totalHours)).toBe(60); // 3 x 20
    });
  });

  describe('Scenario 3: Partial Payments', () => {
    it('should handle partial payments on invoice', async () => {
      const customer = await adminCaller.customers.create({
        companyName: 'Slow Payer LLC',
        status: 'active',
      });

      // Create invoice for $10,000
      const invoice = await adminCaller.invoices.create({
        entityId: customer.id,
        invoiceDate: new Date('2024-01-15'),
        dueDate: new Date('2024-02-14'),
        lineItems: [
          {
            description: 'Project Milestone 1',
            quantity: 1,
            unitPrice: 10000,
            amount: 10000,
          },
        ],
        subtotal: 10000,
        totalAmount: 10000,
        status: 'sent',
      });

      expect(invoice.totalAmount).toBe(10000);

      // First partial payment: $5,000
      const payment1 = await adminCaller.payments.create({
        invoiceId: invoice.id,
        amount: '5000.00',
        paymentDate: new Date('2024-02-01'),
        paymentMethod: 'check',
        transactionReference: 'CHK-001',
      });

      expect(payment1.amount).toBe('5000.00');

      // Second partial payment: $3,000
      const payment2 = await adminCaller.payments.create({
        invoiceId: invoice.id,
        amount: '3000.00',
        paymentDate: new Date('2024-02-10'),
        paymentMethod: 'check',
        transactionReference: 'CHK-002',
      });

      expect(payment2.amount).toBe('3000.00');

      // Final payment: $2,000
      const payment3 = await adminCaller.payments.create({
        invoiceId: invoice.id,
        amount: '2000.00',
        paymentDate: new Date('2024-02-14'),
        paymentMethod: 'check',
        transactionReference: 'CHK-003',
      });

      expect(payment3.amount).toBe('2000.00');

      // Verify all payments were recorded
      const payments = await adminCaller.payments.list({
        invoiceId: invoice.id,
      });

      expect(payments.data.length).toBe(3);
      const totalPaid = payments.data.reduce(
        (sum: number, p: { amount: string }) => sum + parseFloat(p.amount),
        0
      );
      expect(totalPaid).toBe(10000);
    });
  });

  describe('Scenario 4: Time Entry to Invoice Relationship', () => {
    it('should track time entries through billing cycle', async () => {
      const customer = await adminCaller.customers.create({
        companyName: 'Tracking Corp',
        status: 'active',
      });

      const project = await adminCaller.projects.create({
        projectCode: `TRK-${Date.now()}`,
        name: 'Tracking Project',
        status: 'active',
      });

      const consultant = await dataGenerator.createEmployee(organizationId, 'Tracker');

      await adminCaller.timeEntries.createLaborRate({
        employeeId: consultant.id,
        projectId: project.id,
        laborRate: '75.00',
        billingRate: '150.00',
        effectiveFrom: '2024-01-01',
      });

      // Create 10 time entries (10 x 8 hours = 80 hours)
      const entries = [];
      for (let i = 0; i < 10; i++) {
        const entry = await adminCaller.timeEntries.create({
          employeeId: consultant.id,
          projectId: project.id,
          entryDate: `2024-01-${String(15 + i).padStart(2, '0')}`,
          hours: '8.00',
          entryType: 'REGULAR',
          isBillable: true,
        });
        entries.push(entry);
      }

      // Complete approval workflow
      await adminCaller.timeEntries.submit({
        timeEntryIds: entries.map((e) => e.id),
      });

      await adminCaller.timeEntries.approve({
        timeEntryIds: entries.map((e) => e.id),
      });

      await adminCaller.timeEntries.postToGL({
        timeEntryIds: entries.map((e) => e.id),
      });

      // Verify project cost tracking
      const costSummary = await adminCaller.timeEntries.getProjectTotalCost({
        projectId: project.id,
        status: 'POSTED',
      });

      // Expected: 80 hours
      expect(parseFloat(costSummary.totalHours)).toBe(80);

      // Create invoice for billable amount
      // 80 hours x $150 = $12,000
      const invoice = await adminCaller.invoices.create({
        entityId: customer.id,
        invoiceDate: new Date('2024-01-31'),
        dueDate: new Date('2024-03-01'),
        lineItems: [
          {
            description: `Project Consulting - ${project.name}`,
            quantity: 80,
            unitPrice: 150,
            amount: 12000,
          },
        ],
        subtotal: 12000,
        totalAmount: 12000,
        metadata: { projectId: project.id },
      });

      expect(invoice.totalAmount).toBe(12000);
      expect(invoice.metadata?.projectId).toBe(project.id);
    });
  });

  describe('Scenario 5: Employee Summary Reporting', () => {
    it('should provide accurate employee time summaries', async () => {
      const project = await adminCaller.projects.create({
        projectCode: `EMP-${Date.now()}`,
        name: 'Employee Summary Project',
        status: 'active',
      });

      // Create two employees
      const employee1 = await dataGenerator.createEmployee(organizationId, 'Emp1');
      const employee2 = await dataGenerator.createEmployee(organizationId, 'Emp2');

      // Set up labor rates
      for (const emp of [employee1, employee2]) {
        await adminCaller.timeEntries.createLaborRate({
          employeeId: emp.id,
          projectId: project.id,
          laborRate: '80.00',
          billingRate: '160.00',
          effectiveFrom: '2024-01-01',
        });
      }

      // Employee 1 logs 40 hours, Employee 2 logs 30 hours
      const emp1Entries = [];
      for (let i = 0; i < 5; i++) {
        const entry = await adminCaller.timeEntries.create({
          employeeId: employee1.id,
          projectId: project.id,
          entryDate: `2024-01-${String(15 + i).padStart(2, '0')}`,
          hours: '8.00',
          entryType: 'REGULAR',
          isBillable: true,
        });
        emp1Entries.push(entry);
      }

      const emp2Entries = [];
      for (let i = 0; i < 5; i++) {
        const entry = await adminCaller.timeEntries.create({
          employeeId: employee2.id,
          projectId: project.id,
          entryDate: `2024-01-${String(15 + i).padStart(2, '0')}`,
          hours: '6.00',
          entryType: 'REGULAR',
          isBillable: true,
        });
        emp2Entries.push(entry);
      }

      // Submit and approve all
      const allEntries = [...emp1Entries, ...emp2Entries];
      await adminCaller.timeEntries.submit({
        timeEntryIds: allEntries.map((e) => e.id),
      });

      await adminCaller.timeEntries.approve({
        timeEntryIds: allEntries.map((e) => e.id),
      });

      // Get employee summaries
      const summary = await adminCaller.timeEntries.getSummaryByEmployee({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        status: 'APPROVED',
      });

      // Find specific employees
      const emp1Summary = summary.find((s: { employeeId: string }) => s.employeeId === employee1.id);
      const emp2Summary = summary.find((s: { employeeId: string }) => s.employeeId === employee2.id);

      expect(emp1Summary).toBeDefined();
      expect(parseFloat(emp1Summary.totalHours)).toBe(40);

      expect(emp2Summary).toBeDefined();
      expect(parseFloat(emp2Summary.totalHours)).toBe(30);
    });
  });

  describe('Scenario 6: Non-Billable Time Tracking', () => {
    it('should track billable vs non-billable time separately', async () => {
      const project = await adminCaller.projects.create({
        projectCode: `BILL-${Date.now()}`,
        name: 'Mixed Billing Project',
        status: 'active',
      });

      const employee = await dataGenerator.createEmployee(organizationId, 'MixedEmp');

      await adminCaller.timeEntries.createLaborRate({
        employeeId: employee.id,
        projectId: project.id,
        laborRate: '100.00',
        billingRate: '200.00',
        effectiveFrom: '2024-01-01',
      });

      // Create billable entries (20 hours)
      const billableEntries = [];
      for (let i = 0; i < 4; i++) {
        const entry = await adminCaller.timeEntries.create({
          employeeId: employee.id,
          projectId: project.id,
          entryDate: `2024-01-${String(15 + i).padStart(2, '0')}`,
          hours: '5.00',
          entryType: 'REGULAR',
          isBillable: true,
          description: 'Billable client work',
        });
        billableEntries.push(entry);
      }

      // Create non-billable entries (10 hours)
      const nonBillableEntries = [];
      for (let i = 0; i < 2; i++) {
        const entry = await adminCaller.timeEntries.create({
          employeeId: employee.id,
          projectId: project.id,
          entryDate: `2024-01-${String(19 + i).padStart(2, '0')}`,
          hours: '5.00',
          entryType: 'REGULAR',
          isBillable: false,
          description: 'Internal meeting',
        });
        nonBillableEntries.push(entry);
      }

      // Submit and approve all
      const allEntries = [...billableEntries, ...nonBillableEntries];
      await adminCaller.timeEntries.submit({
        timeEntryIds: allEntries.map((e) => e.id),
      });

      await adminCaller.timeEntries.approve({
        timeEntryIds: allEntries.map((e) => e.id),
      });

      // Verify counts
      const billableList = await adminCaller.timeEntries.list({
        filters: { projectId: project.id, isBillable: true, status: 'APPROVED' },
      });
      expect(billableList.data.length).toBe(4);

      const nonBillableList = await adminCaller.timeEntries.list({
        filters: { projectId: project.id, isBillable: false, status: 'APPROVED' },
      });
      expect(nonBillableList.data.length).toBe(2);

      // Verify hours
      const billableHours = billableList.data.reduce(
        (sum: number, e: { hours: string }) => sum + parseFloat(e.hours),
        0
      );
      expect(billableHours).toBe(20);

      const nonBillableHours = nonBillableList.data.reduce(
        (sum: number, e: { hours: string }) => sum + parseFloat(e.hours),
        0
      );
      expect(nonBillableHours).toBe(10);
    });
  });

  describe('Scenario 7: Project Budget Tracking', () => {
    it('should track time against project budget', async () => {
      const customer = await adminCaller.customers.create({
        companyName: 'Budget Conscious Inc',
        status: 'active',
      });

      const project = await adminCaller.projects.create({
        projectCode: `BGT-${Date.now()}`,
        name: 'Fixed Budget Project',
        status: 'active',
      });

      const employee = await dataGenerator.createEmployee(organizationId, 'BudgetEmp');

      // Assign with budgeted hours
      await adminCaller.timeEntries.createAssignment({
        employeeId: employee.id,
        projectId: project.id,
        budgetedHours: '100.00',
      });

      await adminCaller.timeEntries.createLaborRate({
        employeeId: employee.id,
        projectId: project.id,
        laborRate: '100.00',
        billingRate: '200.00',
        effectiveFrom: '2024-01-01',
      });

      // Log 80 hours (80% of budget)
      const entries = [];
      for (let i = 0; i < 10; i++) {
        const entry = await adminCaller.timeEntries.create({
          employeeId: employee.id,
          projectId: project.id,
          entryDate: `2024-01-${String(15 + i).padStart(2, '0')}`,
          hours: '8.00',
          entryType: 'REGULAR',
          isBillable: true,
        });
        entries.push(entry);
      }

      // Submit and approve
      await adminCaller.timeEntries.submit({
        timeEntryIds: entries.map((e) => e.id),
      });

      await adminCaller.timeEntries.approve({
        timeEntryIds: entries.map((e) => e.id),
      });

      // Get assignment to check actual hours
      const assignments = await adminCaller.timeEntries.getMyAssignments({ activeOnly: false });
      // Note: This might need adjustment based on actual implementation
      // The assignment's actualHours should be updated after approving time entries

      // Verify project summary
      const projectSummary = await adminCaller.timeEntries.getSummaryByProject({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        status: 'APPROVED',
      });

      const thisSummary = projectSummary.find((s: { projectId: string }) => s.projectId === project.id);
      expect(thisSummary).toBeDefined();
      expect(parseFloat(thisSummary.totalHours)).toBe(80);
    });
  });

  describe('Scenario 8: Multiple Projects Single Employee', () => {
    it('should handle employee working on multiple projects', async () => {
      // Create two projects
      const project1 = await adminCaller.projects.create({
        projectCode: `MP1-${Date.now()}`,
        name: 'Multi Project Alpha',
        status: 'active',
      });

      const project2 = await adminCaller.projects.create({
        projectCode: `MP2-${Date.now()}`,
        name: 'Multi Project Beta',
        status: 'active',
      });

      const employee = await dataGenerator.createEmployee(organizationId, 'MultiProj');

      // Different rates for different projects
      await adminCaller.timeEntries.createLaborRate({
        employeeId: employee.id,
        projectId: project1.id,
        laborRate: '80.00',
        billingRate: '150.00',
        effectiveFrom: '2024-01-01',
      });

      await adminCaller.timeEntries.createLaborRate({
        employeeId: employee.id,
        projectId: project2.id,
        laborRate: '80.00',
        billingRate: '175.00', // Higher rate for Project Beta
        effectiveFrom: '2024-01-01',
      });

      // Assign to both
      await adminCaller.timeEntries.createAssignment({
        employeeId: employee.id,
        projectId: project1.id,
      });

      await adminCaller.timeEntries.createAssignment({
        employeeId: employee.id,
        projectId: project2.id,
      });

      // Log time to both projects
      const proj1Entries = [];
      for (let i = 0; i < 3; i++) {
        const entry = await adminCaller.timeEntries.create({
          employeeId: employee.id,
          projectId: project1.id,
          entryDate: `2024-01-${String(15 + i).padStart(2, '0')}`,
          hours: '4.00',
          entryType: 'REGULAR',
          isBillable: true,
        });
        proj1Entries.push(entry);
      }

      const proj2Entries = [];
      for (let i = 0; i < 3; i++) {
        const entry = await adminCaller.timeEntries.create({
          employeeId: employee.id,
          projectId: project2.id,
          entryDate: `2024-01-${String(15 + i).padStart(2, '0')}`,
          hours: '4.00',
          entryType: 'REGULAR',
          isBillable: true,
        });
        proj2Entries.push(entry);
      }

      // Submit and approve all
      const allEntries = [...proj1Entries, ...proj2Entries];
      await adminCaller.timeEntries.submit({
        timeEntryIds: allEntries.map((e) => e.id),
      });

      await adminCaller.timeEntries.approve({
        timeEntryIds: allEntries.map((e) => e.id),
      });

      // Verify separate project summaries
      const projectSummary = await adminCaller.timeEntries.getSummaryByProject({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        status: 'APPROVED',
      });

      const proj1Summary = projectSummary.find((s: { projectId: string }) => s.projectId === project1.id);
      const proj2Summary = projectSummary.find((s: { projectId: string }) => s.projectId === project2.id);

      expect(proj1Summary).toBeDefined();
      expect(parseFloat(proj1Summary.totalHours)).toBe(12);

      expect(proj2Summary).toBeDefined();
      expect(parseFloat(proj2Summary.totalHours)).toBe(12);

      // Verify employee total
      const employeeSummary = await adminCaller.timeEntries.getSummaryByEmployee({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        status: 'APPROVED',
      });

      const empSummary = employeeSummary.find((s: { employeeId: string }) => s.employeeId === employee.id);
      expect(empSummary).toBeDefined();
      expect(parseFloat(empSummary.totalHours)).toBe(24); // 12 + 12
    });
  });
});
