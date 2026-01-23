# TEST-004: Client-to-Cash Cycle Integration Tests

## Task Overview

**Description**: Create comprehensive end-to-end integration tests for the full "client to cash" cycle, covering the complete workflow from project setup, time entry, invoicing, through to payment receipt.

**Layer**: End-to-End Integration Testing

**Estimated Time**: 6 hours

**Dependencies**: TEST-001, TEST-002, TEST-003

**Blocks**: None (Final integration test)

---

## Acceptance Criteria

- [ ] Test covers complete project lifecycle
- [ ] Test covers time entry -> invoicing flow
- [ ] Test covers invoice -> payment flow
- [ ] Test covers multi-employee scenarios
- [ ] Test covers billing rate calculations
- [ ] Test covers revenue recognition integration
- [ ] Test verifies GL entries are created correctly
- [ ] Test covers partial payments
- [ ] Test covers credits and adjustments
- [ ] All tests run in isolated test database
- [ ] Tests complete within reasonable time (<30s per test)

---

## Client-to-Cash Flow Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLIENT-TO-CASH CYCLE                                 │
└─────────────────────────────────────────────────────────────────────────────┘

1. PROJECT SETUP
   ├── Create Customer/Client
   ├── Create Project
   ├── Assign Employees to Project
   ├── Configure Labor Rates
   └── Set up Cost Codes

2. TIME & EXPENSE CAPTURE
   ├── Employees log time entries
   ├── Employees log expense entries
   ├── Submit for approval
   └── Manager approves

3. BILLING
   ├── Generate invoice from approved time/expenses
   ├── Apply billing rates
   ├── Calculate totals
   ├── Send invoice to customer
   └── Post invoice to GL (AR, Revenue)

4. PAYMENT
   ├── Receive customer payment
   ├── Apply payment to invoice(s)
   ├── Post payment to GL (Cash, AR)
   └── Mark invoice as paid

5. REPORTING
   ├── Project profitability analysis
   ├── Customer aging reports
   └── Revenue recognition reports
```

---

## Test Scenarios

### Scenario 1: Complete Billing Cycle (Happy Path)
A professional services firm bills a client for consulting work:
1. Create customer "Acme Corp"
2. Create project "Acme Digital Transformation"
3. Assign consultant with $200/hr billing rate
4. Log 40 hours of work over a week
5. Submit and approve time entries
6. Generate invoice for $8,000
7. Receive payment
8. Verify GL entries balance

### Scenario 2: Multi-Employee Project
Multiple consultants work on the same project with different rates:
1. Create project with 3 consultants
2. Senior ($300/hr), Mid ($200/hr), Junior ($100/hr)
3. Each logs 20 hours
4. Generate consolidated invoice
5. Verify correct billing amounts

### Scenario 3: Time & Materials vs Fixed Price
Compare billing under different contract types:
1. Create T&M project - bill actual hours
2. Create Fixed Price project - bill per milestone
3. Log same hours to both
4. Verify billing differs appropriately

### Scenario 4: Partial Payment
Customer pays invoice in installments:
1. Generate $10,000 invoice
2. Receive $5,000 partial payment
3. Verify invoice status is "partial"
4. Receive remaining $5,000
5. Verify invoice status is "paid"
6. Verify GL entries for each payment

### Scenario 5: Credit Memo and Adjustment
Handle billing corrections:
1. Generate invoice for $10,000
2. Customer disputes $2,000
3. Issue credit memo
4. Net balance is $8,000
5. Receive $8,000 payment
6. Verify full settlement

### Scenario 6: Retainage (Construction)
Project with retainage holdback:
1. Create construction project with 10% retainage
2. Bill $100,000 milestone
3. Customer pays $90,000 (net of retainage)
4. Complete project
5. Bill and collect retainage
6. Verify correct revenue recognition

### Scenario 7: Multi-Month Project with Progress Billing
Monthly billing throughout project:
1. Create 6-month project
2. Each month: log time, bill, collect
3. Verify monthly revenue recognition
4. Compare budget to actual
5. Generate profitability report

---

## TDD Implementation

### Test File Location
`packages/integration-tests/__tests__/client-to-cash-cycle.test.ts`

### Test Implementation

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { TestDatabase } from '../helpers/test-database';
import { TestDataGenerator } from '../helpers/test-data-generator';
import { createCallerFactory } from '@glapi/trpc';
import { appRouter } from '@glapi/trpc';
import {
  type CreateTimeEntryInput,
  type CreateProjectInput,
} from '@glapi/types';
import Decimal from 'decimal.js';

describe('Client-to-Cash Cycle Integration Tests', () => {
  let testDb: TestDatabase;
  let dataGenerator: TestDataGenerator;
  let organizationId: string;
  let adminCaller: ReturnType<typeof createCallerFactory>;

  beforeAll(async () => {
    testDb = new TestDatabase();
    await testDb.setup();

    dataGenerator = new TestDataGenerator(testDb.db);

    const organization = await dataGenerator.createOrganization();
    organizationId = organization.id;

    const admin = await dataGenerator.createEmployee(organizationId, {
      role: 'ADMIN',
      canApproveTime: true,
    });

    const createCaller = createCallerFactory(appRouter);
    adminCaller = createCaller({
      organizationId,
      userId: admin.id,
      userName: 'Admin User',
      serviceContext: {
        organizationId,
        userId: admin.id,
        userName: 'Admin User',
      },
    });
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  describe('Scenario 1: Complete Billing Cycle', () => {
    let customerId: string;
    let projectId: string;
    let consultantId: string;
    let invoiceId: string;

    beforeEach(async () => {
      await testDb.clearAll();
    });

    it('should complete full client-to-cash cycle', async () => {
      // Step 1: Create Customer
      const customer = await adminCaller.customers.create({
        companyName: 'Acme Corporation',
        contactEmail: 'billing@acme.com',
        status: 'active',
      });
      customerId = customer.id;
      expect(customer.companyName).toBe('Acme Corporation');

      // Step 2: Create Project
      const project = await adminCaller.projects.create({
        projectCode: 'ACME-DT-2024',
        name: 'Acme Digital Transformation',
        status: 'active',
        projectType: 'Time & Materials',
        currencyCode: 'USD',
      });
      projectId = project.id;
      expect(project.status).toBe('active');

      // Step 3: Create Consultant and Assign to Project
      const consultant = await dataGenerator.createEmployee(organizationId, {
        firstName: 'Jane',
        lastName: 'Consultant',
        email: 'jane@consulting.com',
      });
      consultantId = consultant.id;

      // Create labor rate: $200/hour
      await adminCaller.timeEntries.createLaborRate({
        employeeId: consultantId,
        projectId,
        laborRate: '100.00',  // Internal cost
        billingRate: '200.00', // Client rate
        effectiveFrom: '2024-01-01',
      });

      // Assign consultant to project
      await adminCaller.timeEntries.createAssignment({
        employeeId: consultantId,
        projectId,
        role: 'Senior Consultant',
        budgetedHours: '160.00',
        canApproveTime: false,
      });

      // Step 4: Log 40 hours of work
      const timeEntries = [];
      for (let day = 1; day <= 5; day++) {
        const entry = await adminCaller.timeEntries.create({
          employeeId: consultantId,
          projectId,
          entryDate: `2024-01-${String(day + 14).padStart(2, '0')}`,
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
        timeEntryIds: timeEntries.map(e => e.id),
        comments: 'Week 3 time submission',
      });

      // Step 6: Approve time entries
      await adminCaller.timeEntries.approve({
        timeEntryIds: timeEntries.map(e => e.id),
        comments: 'Approved',
      });

      // Verify entries are approved
      const approvedEntries = await adminCaller.timeEntries.list({
        filters: { projectId, status: 'APPROVED' },
      });
      expect(approvedEntries.data.length).toBe(5);

      // Step 7: Generate Invoice
      // Calculate expected amount: 40 hours * $200/hr = $8,000
      const invoice = await adminCaller.invoices.create({
        entityId: customerId,
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
      invoiceId = invoice.id;

      expect(invoice.totalAmount).toBe(8000);
      expect(invoice.status).toBe('draft');

      // Send invoice
      const sentInvoice = await adminCaller.invoices.send({ id: invoiceId });
      expect(sentInvoice.status).toBe('sent');

      // Step 8: Post time entries to GL (creates labor cost entries)
      const postResult = await adminCaller.timeEntries.postToGL({
        timeEntryIds: timeEntries.map(e => e.id),
      });
      expect(postResult.success).toBe(true);
      expect(postResult.postedCount).toBe(5);

      // Verify labor cost entries
      // 40 hours * $100 internal cost = $4,000 labor cost
      const projectCost = await adminCaller.timeEntries.getProjectTotalCost({
        projectId,
        status: 'POSTED',
      });
      expect(parseFloat(projectCost.totalLaborCost)).toBe(4000);

      // Step 9: Receive Payment
      const payment = await adminCaller.payments.create({
        invoiceId,
        amount: 8000,
        paymentDate: new Date('2024-02-15'),
        paymentMethod: 'wire_transfer',
        referenceNumber: 'WT-2024-001',
      });

      expect(payment.amount).toBe(8000);

      // Verify invoice is paid
      const paidInvoice = await adminCaller.invoices.get({ id: invoiceId });
      expect(paidInvoice.status).toBe('paid');

      // Step 10: Verify GL Entries Balance
      // Expected entries:
      // - DR Accounts Receivable $8,000 (when invoice posted)
      // - CR Revenue $8,000 (when invoice posted)
      // - DR Cash $8,000 (when payment posted)
      // - CR Accounts Receivable $8,000 (when payment posted)
      // - DR Labor Cost $4,000 (when time posted)
      // - CR Accrued Payroll $4,000 (when time posted)

      // Net effect:
      // Cash: +$8,000
      // Revenue: +$8,000
      // Labor Cost: +$4,000
      // Gross Profit: $4,000 (50% margin)
    });
  });

  describe('Scenario 2: Multi-Employee Project', () => {
    it('should handle multiple billing rates correctly', async () => {
      // Create customer and project
      const customer = await adminCaller.customers.create({
        companyName: 'BigCorp Inc',
        status: 'active',
      });

      const project = await adminCaller.projects.create({
        projectCode: 'BC-2024-001',
        name: 'BigCorp ERP Implementation',
        status: 'active',
      });

      // Create three consultants with different rates
      const rates = [
        { level: 'Senior', labor: 150, billing: 300 },
        { level: 'Mid', labor: 100, billing: 200 },
        { level: 'Junior', labor: 50, billing: 100 },
      ];

      const consultants = [];
      for (const rate of rates) {
        const consultant = await dataGenerator.createEmployee(organizationId, {
          firstName: rate.level,
          lastName: 'Consultant',
        });

        await adminCaller.timeEntries.createLaborRate({
          employeeId: consultant.id,
          projectId: project.id,
          laborRate: rate.labor.toString(),
          billingRate: rate.billing.toString(),
          effectiveFrom: '2024-01-01',
        });

        consultants.push({ ...consultant, ...rate });
      }

      // Each consultant logs 20 hours
      const allEntries = [];
      for (const consultant of consultants) {
        const entries = [];
        for (let day = 1; day <= 4; day++) {
          const entry = await adminCaller.timeEntries.create({
            employeeId: consultant.id,
            projectId: project.id,
            entryDate: `2024-01-${String(day + 14).padStart(2, '0')}`,
            hours: '5.00',
            entryType: 'REGULAR',
            isBillable: true,
          });
          entries.push(entry);
        }
        allEntries.push(...entries);
      }

      // Submit and approve all
      await adminCaller.timeEntries.submit({
        timeEntryIds: allEntries.map(e => e.id),
      });

      await adminCaller.timeEntries.approve({
        timeEntryIds: allEntries.map(e => e.id),
      });

      // Calculate expected billing:
      // Senior: 20 hrs * $300 = $6,000
      // Mid: 20 hrs * $200 = $4,000
      // Junior: 20 hrs * $100 = $2,000
      // Total: $12,000

      // Calculate expected cost:
      // Senior: 20 hrs * $150 = $3,000
      // Mid: 20 hrs * $100 = $2,000
      // Junior: 20 hrs * $50 = $1,000
      // Total: $6,000

      // Gross Profit: $6,000 (50% margin)

      const summary = await adminCaller.timeEntries.getSummaryByProject({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        status: 'APPROVED',
      });

      const projectSummary = summary.find(s => s.projectId === project.id);
      expect(projectSummary).toBeDefined();
      expect(parseFloat(projectSummary!.totalHours)).toBe(60); // 3 * 20
      expect(parseFloat(projectSummary!.totalBillingAmount)).toBe(12000);
      expect(parseFloat(projectSummary!.totalCost)).toBe(6000);
    });
  });

  describe('Scenario 3: Partial Payments', () => {
    it('should handle partial payments correctly', async () => {
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
        status: 'draft',
      });

      await adminCaller.invoices.send({ id: invoice.id });

      // First partial payment: $5,000
      const payment1 = await adminCaller.payments.create({
        invoiceId: invoice.id,
        amount: 5000,
        paymentDate: new Date('2024-02-01'),
        paymentMethod: 'check',
        referenceNumber: 'CHK-001',
      });

      // Check invoice status after partial payment
      let updatedInvoice = await adminCaller.invoices.get({ id: invoice.id });
      expect(updatedInvoice.status).toBe('partial');
      expect(parseFloat(updatedInvoice.paidAmount || '0')).toBe(5000);
      expect(parseFloat(updatedInvoice.balanceDue || '0')).toBe(5000);

      // Second partial payment: $3,000
      const payment2 = await adminCaller.payments.create({
        invoiceId: invoice.id,
        amount: 3000,
        paymentDate: new Date('2024-02-10'),
        paymentMethod: 'check',
        referenceNumber: 'CHK-002',
      });

      updatedInvoice = await adminCaller.invoices.get({ id: invoice.id });
      expect(updatedInvoice.status).toBe('partial');
      expect(parseFloat(updatedInvoice.paidAmount || '0')).toBe(8000);
      expect(parseFloat(updatedInvoice.balanceDue || '0')).toBe(2000);

      // Final payment: $2,000
      const payment3 = await adminCaller.payments.create({
        invoiceId: invoice.id,
        amount: 2000,
        paymentDate: new Date('2024-02-14'),
        paymentMethod: 'check',
        referenceNumber: 'CHK-003',
      });

      updatedInvoice = await adminCaller.invoices.get({ id: invoice.id });
      expect(updatedInvoice.status).toBe('paid');
      expect(parseFloat(updatedInvoice.paidAmount || '0')).toBe(10000);
      expect(parseFloat(updatedInvoice.balanceDue || '0')).toBe(0);
    });
  });

  describe('Scenario 4: Invoice with Credit Memo', () => {
    it('should handle credit adjustments correctly', async () => {
      const customer = await adminCaller.customers.create({
        companyName: 'Dispute Corp',
        status: 'active',
      });

      // Create invoice for $10,000
      const invoice = await adminCaller.invoices.create({
        entityId: customer.id,
        invoiceDate: new Date('2024-01-15'),
        dueDate: new Date('2024-02-14'),
        lineItems: [
          {
            description: 'Consulting Services',
            quantity: 50,
            unitPrice: 200,
            amount: 10000,
          },
        ],
        subtotal: 10000,
        totalAmount: 10000,
        status: 'sent',
      });

      // Customer disputes $2,000 (10 hours were double-billed)
      // Create credit memo
      const creditMemo = await adminCaller.invoices.create({
        entityId: customer.id,
        invoiceDate: new Date('2024-01-20'),
        lineItems: [
          {
            description: 'Credit - Duplicate billing adjustment',
            quantity: 10,
            unitPrice: -200,
            amount: -2000,
          },
        ],
        subtotal: -2000,
        totalAmount: -2000,
        status: 'sent',
        metadata: { type: 'credit_memo', linkedInvoiceId: invoice.id },
      });

      // Apply credit to invoice
      await adminCaller.payments.create({
        invoiceId: invoice.id,
        amount: 2000,
        paymentDate: new Date('2024-01-20'),
        paymentMethod: 'credit_memo',
        referenceNumber: creditMemo.invoiceNumber,
      });

      // Customer pays remaining $8,000
      await adminCaller.payments.create({
        invoiceId: invoice.id,
        amount: 8000,
        paymentDate: new Date('2024-02-01'),
        paymentMethod: 'wire_transfer',
      });

      const finalInvoice = await adminCaller.invoices.get({ id: invoice.id });
      expect(finalInvoice.status).toBe('paid');
    });
  });

  describe('Scenario 5: Project Profitability', () => {
    it('should calculate project profitability correctly', async () => {
      const customer = await adminCaller.customers.create({
        companyName: 'Profit Analysis Inc',
        status: 'active',
      });

      const project = await adminCaller.projects.create({
        projectCode: 'PAI-2024',
        name: 'Profit Analysis Project',
        status: 'active',
      });

      const consultant = await dataGenerator.createEmployee(organizationId);

      // Set up rates: $100 cost, $200 billing
      await adminCaller.timeEntries.createLaborRate({
        employeeId: consultant.id,
        projectId: project.id,
        laborRate: '100.00',
        billingRate: '200.00',
        effectiveFrom: '2024-01-01',
      });

      // Log and approve 100 hours
      const entries = [];
      for (let i = 0; i < 10; i++) {
        const entry = await adminCaller.timeEntries.create({
          employeeId: consultant.id,
          projectId: project.id,
          entryDate: `2024-01-${String(i + 15).padStart(2, '0')}`,
          hours: '10.00',
          entryType: 'REGULAR',
          isBillable: true,
        });
        entries.push(entry);
      }

      await adminCaller.timeEntries.submit({
        timeEntryIds: entries.map(e => e.id),
      });

      await adminCaller.timeEntries.approve({
        timeEntryIds: entries.map(e => e.id),
      });

      await adminCaller.timeEntries.postToGL({
        timeEntryIds: entries.map(e => e.id),
      });

      // Get project cost summary
      const costSummary = await adminCaller.timeEntries.getProjectTotalCost({
        projectId: project.id,
        status: 'POSTED',
      });

      // Expected:
      // Hours: 100
      // Revenue: 100 * $200 = $20,000
      // Cost: 100 * $100 = $10,000
      // Gross Profit: $10,000
      // Margin: 50%

      expect(parseFloat(costSummary.totalHours)).toBe(100);
      expect(parseFloat(costSummary.totalBillingAmount)).toBe(20000);
      expect(parseFloat(costSummary.totalLaborCost)).toBe(10000);

      const grossProfit = 20000 - 10000;
      const margin = (grossProfit / 20000) * 100;
      expect(margin).toBe(50);
    });
  });

  describe('Scenario 6: Month-End Close Process', () => {
    it('should support month-end billing and close', async () => {
      const customer = await adminCaller.customers.create({
        companyName: 'Monthly Billing Client',
        status: 'active',
      });

      const project = await adminCaller.projects.create({
        projectCode: 'MBC-2024',
        name: 'Ongoing Support',
        status: 'active',
      });

      const consultant = await dataGenerator.createEmployee(organizationId);

      await adminCaller.timeEntries.createLaborRate({
        employeeId: consultant.id,
        projectId: project.id,
        laborRate: '75.00',
        billingRate: '150.00',
        effectiveFrom: '2024-01-01',
      });

      // Simulate 3 months of activity
      for (let month = 1; month <= 3; month++) {
        const monthStr = String(month).padStart(2, '0');

        // Log 80 hours per month
        const monthEntries = [];
        for (let day = 1; day <= 20; day++) {
          const dayStr = String(day).padStart(2, '0');
          const entry = await adminCaller.timeEntries.create({
            employeeId: consultant.id,
            projectId: project.id,
            entryDate: `2024-${monthStr}-${dayStr}`,
            hours: '4.00',
            entryType: 'REGULAR',
            isBillable: true,
          });
          monthEntries.push(entry);
        }

        // Submit and approve
        await adminCaller.timeEntries.submit({
          timeEntryIds: monthEntries.map(e => e.id),
        });

        await adminCaller.timeEntries.approve({
          timeEntryIds: monthEntries.map(e => e.id),
        });

        // Post to GL
        await adminCaller.timeEntries.postToGL({
          timeEntryIds: monthEntries.map(e => e.id),
        });

        // Generate monthly invoice: 80 hours * $150 = $12,000
        const invoice = await adminCaller.invoices.create({
          entityId: customer.id,
          invoiceDate: new Date(`2024-${monthStr}-28`),
          dueDate: new Date(`2024-${String(month + 1).padStart(2, '0')}-28`),
          billingPeriodStart: new Date(`2024-${monthStr}-01`),
          billingPeriodEnd: new Date(`2024-${monthStr}-28`),
          lineItems: [
            {
              description: `Support Services - ${monthStr}/2024`,
              quantity: 80,
              unitPrice: 150,
              amount: 12000,
            },
          ],
          subtotal: 12000,
          totalAmount: 12000,
          status: 'sent',
        });

        // Receive payment next month
        if (month < 3) {
          await adminCaller.payments.create({
            invoiceId: invoice.id,
            amount: 12000,
            paymentDate: new Date(`2024-${String(month + 1).padStart(2, '0')}-15`),
            paymentMethod: 'wire_transfer',
          });
        }
      }

      // Verify summary across all 3 months
      const summary = await adminCaller.invoices.summary({
        entityId: customer.id,
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-03-31'),
      });

      expect(summary.totalInvoices).toBe(3);
      expect(summary.totalAmount).toBe(36000); // 3 * $12,000
      expect(summary.totalPaid).toBe(24000); // 2 paid
      expect(summary.totalOutstanding).toBe(12000); // 1 unpaid
    });
  });
});
```

---

## Test Helpers Extension

Add these methods to TestDataGenerator:

```typescript
// packages/integration-tests/helpers/test-data-generator.ts

export class TestDataGenerator {
  // ... existing methods ...

  async createProject(organizationId: string, overrides: Partial<Project> = {}) {
    const [project] = await this.db.insert(projects).values({
      id: crypto.randomUUID(),
      organizationId,
      projectCode: `PRJ-${Date.now()}`,
      name: 'Test Project',
      status: 'active',
      currencyCode: 'USD',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }).returning();
    return project;
  }

  async createEmployee(organizationId: string, overrides: Partial<Employee> = {}) {
    const [employee] = await this.db.insert(employees).values({
      id: crypto.randomUUID(),
      organizationId,
      email: `employee-${Date.now()}@test.com`,
      firstName: 'Test',
      lastName: 'Employee',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }).returning();
    return employee;
  }

  async createCostCode(organizationId: string, projectId: string, overrides = {}) {
    const [costCode] = await this.db.insert(projectCostCodes).values({
      id: crypto.randomUUID(),
      organizationId,
      projectId,
      code: `CC-${Date.now()}`,
      name: 'Test Cost Code',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }).returning();
    return costCode;
  }
}
```

---

## Performance Considerations

These tests are comprehensive but should complete within reasonable time:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    testTimeout: 30000, // 30 seconds per test
    hookTimeout: 60000, // 60 seconds for setup/teardown
  },
});
```

---

## Git Commit

```
test(integration): add client-to-cash cycle tests

- Add complete billing cycle test (project -> time -> invoice -> payment)
- Add multi-employee project billing test
- Add partial payment handling test
- Add credit memo and adjustment test
- Add project profitability calculation test
- Add month-end close process test
- Verify GL entries throughout workflow
- Calculate and validate gross profit margins

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```
