import { describe, it, expect, beforeEach } from '@jest/globals';
// import { TRPCError } from '@trpc/server';
import { createAuthenticatedCaller, createUnauthenticatedCaller } from '../../../../tests/utils/trpc-utils';
import { TestDbUtils } from '../../../../tests/utils/db-utils';

describe('Business Transactions tRPC API (Order-to-Cash System)', () => {
  let testContext: Awaited<ReturnType<typeof TestDbUtils.createCompleteTestData>>;

  beforeEach(async () => {
    testContext = await TestDbUtils.createCompleteTestData();
  });

  describe('Authentication & Authorization', () => {
    it('should require authentication for all endpoints', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(caller.businessTransactions.list({})).rejects.toThrow('UNAUTHORIZED');
    });

    it('should require organization context', async () => {
      const caller = createAuthenticatedCaller(null);

      await expect(caller.businessTransactions.list({})).rejects.toThrow();
    });
  });

  describe('businessTransactions.list', () => {
    it('should return empty list when no transactions exist', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      const result = await caller.businessTransactions.list({});
      
      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });

    it('should filter by transaction type', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      // Create different transaction types
      const purchaseOrder = await caller.businessTransactions.create({
        transactionTypeCode: 'PURCHASE_ORDER',
        entityId: testContext.vendor.id,
        entityType: 'VENDOR',
        transactionDate: new Date(),
        lines: [{
          itemId: testContext.item.id,
          description: 'Test item',
          quantity: 10,
          unitPrice: 100,
          lineAmount: 1000,
          totalLineAmount: 1000,
        }]
      });

      const salesOrder = await caller.businessTransactions.create({
        transactionTypeCode: 'SALES_ORDER',
        entityId: testContext.customer.id,
        entityType: 'CUSTOMER',
        transactionDate: new Date(),
        lines: [{
          itemId: testContext.item.id,
          description: 'Test item',
          quantity: 5,
          unitPrice: 200,
          lineAmount: 1000,
          totalLineAmount: 1000,
        }]
      });

      // List purchase orders only
      const purchaseOrdersResult = await caller.businessTransactions.list({
        filter: { transactionTypeCode: 'PURCHASE_ORDER' }
      });
      expect(purchaseOrdersResult.data).toHaveLength(1);
      expect(purchaseOrdersResult.data[0].id).toBe(purchaseOrder.id);

      // List sales orders only
      const salesOrdersResult = await caller.businessTransactions.list({
        filter: { transactionTypeCode: 'SALES_ORDER' }
      });
      expect(salesOrdersResult.data).toHaveLength(1);
      expect(salesOrdersResult.data[0].id).toBe(salesOrder.id);
    });

    it('should filter by entity type', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      // Create transactions for different entity types
      const vendorTransaction = await caller.businessTransactions.create({
        transactionTypeCode: 'PURCHASE_ORDER',
        entityId: testContext.vendor.id,
        entityType: 'VENDOR',
        transactionDate: new Date(),
        lines: [{
          itemId: testContext.item.id,
          description: 'Test item',
          quantity: 10,
          unitPrice: 100,
          lineAmount: 1000,
          totalLineAmount: 1000,
        }]
      });

      const customerTransaction = await caller.businessTransactions.create({
        transactionTypeCode: 'SALES_ORDER',
        entityId: testContext.customer.id,
        entityType: 'CUSTOMER',
        transactionDate: new Date(),
        lines: [{
          itemId: testContext.item.id,
          description: 'Test item',
          quantity: 5,
          unitPrice: 200,
          lineAmount: 1000,
          totalLineAmount: 1000,
        }]
      });

      // Filter by vendor
      const vendorResult = await caller.businessTransactions.list({
        filter: { entityType: 'VENDOR' }
      });
      expect(vendorResult.data).toHaveLength(1);
      expect(vendorResult.data[0].id).toBe(vendorTransaction.id);

      // Filter by customer
      const customerResult = await caller.businessTransactions.list({
        filter: { entityType: 'CUSTOMER' }
      });
      expect(customerResult.data).toHaveLength(1);
      expect(customerResult.data[0].id).toBe(customerTransaction.id);
    });

    it('should support pagination', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      // Create multiple transactions
      for (let i = 0; i < 15; i++) {
        await caller.businessTransactions.create({
          transactionTypeCode: 'PURCHASE_ORDER',
          entityId: testContext.vendor.id,
          entityType: 'VENDOR',
          transactionDate: new Date(),
          lines: [{
            itemId: testContext.item.id,
            description: `Test item ${i}`,
            quantity: 1,
            unitPrice: 100,
            lineAmount: 100,
            totalLineAmount: 100,
          }]
        });
      }

      // Test pagination
      const page1 = await caller.businessTransactions.list({
        pagination: { page: 1, limit: 10 }
      });
      expect(page1.data).toHaveLength(10);
      expect(page1.meta.total).toBe(15);
      expect(page1.meta.page).toBe(1);
      expect(page1.meta.limit).toBe(10);
      expect(page1.meta.totalPages).toBe(2);

      const page2 = await caller.businessTransactions.list({
        pagination: { page: 2, limit: 10 }
      });
      expect(page2.data).toHaveLength(5);
      expect(page2.meta.page).toBe(2);
    });

    it('should support sorting', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      // Create transactions with different dates
      const oldTransaction = await caller.businessTransactions.create({
        transactionTypeCode: 'PURCHASE_ORDER',
        entityId: testContext.vendor.id,
        entityType: 'VENDOR',
        transactionDate: new Date('2023-01-01'),
        lines: [{
          itemId: testContext.item.id,
          description: 'Old transaction',
          quantity: 1,
          unitPrice: 100,
          lineAmount: 100,
          totalLineAmount: 100,
        }]
      });

      const newTransaction = await caller.businessTransactions.create({
        transactionTypeCode: 'PURCHASE_ORDER',
        entityId: testContext.vendor.id,
        entityType: 'VENDOR',
        transactionDate: new Date('2023-12-31'),
        lines: [{
          itemId: testContext.item.id,
          description: 'New transaction',
          quantity: 1,
          unitPrice: 100,
          lineAmount: 100,
          totalLineAmount: 100,
        }]
      });

      // Sort by date ascending
      const ascResult = await caller.businessTransactions.list({
        sort: { field: 'transactionDate', direction: 'asc' }
      });
      expect(ascResult.data[0].id).toBe(oldTransaction.id);
      expect(ascResult.data[1].id).toBe(newTransaction.id);

      // Sort by date descending
      const descResult = await caller.businessTransactions.list({
        sort: { field: 'transactionDate', direction: 'desc' }
      });
      expect(descResult.data[0].id).toBe(newTransaction.id);
      expect(descResult.data[1].id).toBe(oldTransaction.id);
    });

    it('should support search', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      const searchableTransaction = await caller.businessTransactions.create({
        transactionTypeCode: 'PURCHASE_ORDER',
        entityId: testContext.vendor.id,
        entityType: 'VENDOR',
        transactionDate: new Date(),
        memo: 'Special order for urgent delivery',
        lines: [{
          itemId: testContext.item.id,
          description: 'Urgent item',
          quantity: 1,
          unitPrice: 100,
          lineAmount: 100,
          totalLineAmount: 100,
        }]
      });

      const _regularTransaction = await caller.businessTransactions.create({
        transactionTypeCode: 'PURCHASE_ORDER',
        entityId: testContext.vendor.id,
        entityType: 'VENDOR',
        transactionDate: new Date(),
        memo: 'Regular order',
        lines: [{
          itemId: testContext.item.id,
          description: 'Regular item',
          quantity: 1,
          unitPrice: 100,
          lineAmount: 100,
          totalLineAmount: 100,
        }]
      });

      // Search in memo
      const searchResult = await caller.businessTransactions.list({
        search: 'urgent'
      });
      expect(searchResult.data).toHaveLength(1);
      expect(searchResult.data[0].id).toBe(searchableTransaction.id);
    });
  });

  describe('businessTransactions.create', () => {
    it('should create a purchase order', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      const purchaseOrder = await caller.businessTransactions.create({
        transactionTypeCode: 'PURCHASE_ORDER',
        entityId: testContext.vendor.id,
        entityType: 'VENDOR',
        transactionDate: new Date(),
        memo: 'Test purchase order',
        lines: [{
          itemId: testContext.item.id,
          description: 'Test item',
          quantity: 10,
          unitPrice: 100,
          lineAmount: 1000,
          totalLineAmount: 1000,
        }]
      });

      expect(purchaseOrder.id).toBeDefined();
      expect(purchaseOrder.entityId).toBe(testContext.vendor.id);
      expect(purchaseOrder.entityType).toBe('VENDOR');
      expect(purchaseOrder.status).toBe('DRAFT');
      expect(purchaseOrder.lines).toHaveLength(1);
      expect(purchaseOrder.lines[0].quantity).toBe('10');
      expect(purchaseOrder.lines[0].unitPrice).toBe('100');
    });

    it('should create a sales order', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      const salesOrder = await caller.businessTransactions.create({
        transactionTypeCode: 'SALES_ORDER',
        entityId: testContext.customer.id,
        entityType: 'CUSTOMER',
        transactionDate: new Date(),
        memo: 'Test sales order',
        lines: [{
          itemId: testContext.item.id,
          description: 'Test item',
          quantity: 5,
          unitPrice: 200,
          lineAmount: 1000,
          totalLineAmount: 1000,
        }]
      });

      expect(salesOrder.id).toBeDefined();
      expect(salesOrder.entityId).toBe(testContext.customer.id);
      expect(salesOrder.entityType).toBe('CUSTOMER');
      expect(salesOrder.status).toBe('DRAFT');
      expect(salesOrder.lines).toHaveLength(1);
    });

    it('should validate required fields', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      // Missing transaction type
      await expect(caller.businessTransactions.create({
        entityId: testContext.vendor.id,
        entityType: 'VENDOR',
        transactionDate: new Date(),
        lines: []
      } as any)).rejects.toThrow();

      // Missing entity
      await expect(caller.businessTransactions.create({
        transactionTypeCode: 'PURCHASE_ORDER',
        transactionDate: new Date(),
        lines: []
      } as any)).rejects.toThrow();

      // Missing lines
      await expect(caller.businessTransactions.create({
        transactionTypeCode: 'PURCHASE_ORDER',
        entityId: testContext.vendor.id,
        entityType: 'VENDOR',
        transactionDate: new Date(),
        lines: []
      })).rejects.toThrow();
    });

    it('should calculate totals correctly', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      const transaction = await caller.businessTransactions.create({
        transactionTypeCode: 'PURCHASE_ORDER',
        entityId: testContext.vendor.id,
        entityType: 'VENDOR',
        transactionDate: new Date(),
        lines: [
          {
            itemId: testContext.item.id,
            description: 'Item 1',
            quantity: 10,
            unitPrice: 100,
            lineAmount: 1000,
            totalLineAmount: 1000,
          },
          {
            itemId: testContext.item.id,
            description: 'Item 2',
            quantity: 5,
            unitPrice: 200,
            lineAmount: 1000,
            totalLineAmount: 1000,
          }
        ]
      });

      expect(transaction.subtotalAmount).toBe('2000');
      expect(transaction.totalAmount).toBe('2000');
    });

    it('should validate entity type matches transaction type', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      // Purchase order should be with vendor
      await expect(caller.businessTransactions.create({
        transactionTypeCode: 'PURCHASE_ORDER',
        entityId: testContext.customer.id,
        entityType: 'CUSTOMER',
        transactionDate: new Date(),
        lines: [{
          itemId: testContext.item.id,
          description: 'Test item',
          quantity: 1,
          unitPrice: 100,
          lineAmount: 100,
          totalLineAmount: 100,
        }]
      })).rejects.toThrow();

      // Sales order should be with customer
      await expect(caller.businessTransactions.create({
        transactionTypeCode: 'SALES_ORDER',
        entityId: testContext.vendor.id,
        entityType: 'VENDOR',
        transactionDate: new Date(),
        lines: [{
          itemId: testContext.item.id,
          description: 'Test item',
          quantity: 1,
          unitPrice: 100,
          lineAmount: 100,
          totalLineAmount: 100,
        }]
      })).rejects.toThrow();
    });
  });

  describe('businessTransactions.getById', () => {
    it('should return transaction with lines', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      const created = await caller.businessTransactions.create({
        transactionTypeCode: 'PURCHASE_ORDER',
        entityId: testContext.vendor.id,
        entityType: 'VENDOR',
        transactionDate: new Date(),
        lines: [{
          itemId: testContext.item.id,
          description: 'Test item',
          quantity: 10,
          unitPrice: 100,
          lineAmount: 1000,
          totalLineAmount: 1000,
        }]
      });

      const retrieved = await caller.businessTransactions.getById({ id: created.id });
      
      expect(retrieved.id).toBe(created.id);
      expect(retrieved.lines).toHaveLength(1);
      expect(retrieved.lines[0].description).toBe('Test item');
    });

    it('should throw error for non-existent transaction', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      await expect(caller.businessTransactions.getById({ 
        id: '00000000-0000-0000-0000-000000000000' 
      })).rejects.toThrow('NOT_FOUND');
    });

    it('should throw error for transaction in different organization', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      // Create transaction in current org
      const transaction = await caller.businessTransactions.create({
        transactionTypeCode: 'PURCHASE_ORDER',
        entityId: testContext.vendor.id,
        entityType: 'VENDOR',
        transactionDate: new Date(),
        lines: [{
          itemId: testContext.item.id,
          description: 'Test item',
          quantity: 1,
          unitPrice: 100,
          lineAmount: 100,
          totalLineAmount: 100,
        }]
      });

      // Try to access from different org
      const otherOrgData = await TestDbUtils.createTestOrganization();
      const otherCaller = createAuthenticatedCaller(otherOrgData.organization.id);
      
      await expect(otherCaller.businessTransactions.getById({ 
        id: transaction.id 
      })).rejects.toThrow('NOT_FOUND');
    });
  });

  describe('businessTransactions.update', () => {
    it('should update transaction basic fields', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      const created = await caller.businessTransactions.create({
        transactionTypeCode: 'PURCHASE_ORDER',
        entityId: testContext.vendor.id,
        entityType: 'VENDOR',
        transactionDate: new Date(),
        memo: 'Original memo',
        lines: [{
          itemId: testContext.item.id,
          description: 'Test item',
          quantity: 10,
          unitPrice: 100,
          lineAmount: 1000,
          totalLineAmount: 1000,
        }]
      });

      const updated = await caller.businessTransactions.update({
        id: created.id,
        memo: 'Updated memo',
        dueDate: new Date('2024-12-31'),
      });

      expect(updated.memo).toBe('Updated memo');
      expect(updated.dueDate).toBe('2024-12-31');
    });

    it('should not allow updating immutable fields', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      const created = await caller.businessTransactions.create({
        transactionTypeCode: 'PURCHASE_ORDER',
        entityId: testContext.vendor.id,
        entityType: 'VENDOR',
        transactionDate: new Date(),
        lines: [{
          itemId: testContext.item.id,
          description: 'Test item',
          quantity: 1,
          unitPrice: 100,
          lineAmount: 100,
          totalLineAmount: 100,
        }]
      });

      // Should not be able to change transaction type
      await expect(caller.businessTransactions.update({
        id: created.id,
        transactionTypeCode: 'SALES_ORDER',
      } as any)).rejects.toThrow();
    });

    it('should throw error for non-existent transaction', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      await expect(caller.businessTransactions.update({
        id: '00000000-0000-0000-0000-000000000000',
        memo: 'Updated memo',
      })).rejects.toThrow('NOT_FOUND');
    });
  });

  describe('businessTransactions.delete', () => {
    it('should soft delete transaction', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      const created = await caller.businessTransactions.create({
        transactionTypeCode: 'PURCHASE_ORDER',
        entityId: testContext.vendor.id,
        entityType: 'VENDOR',
        transactionDate: new Date(),
        lines: [{
          itemId: testContext.item.id,
          description: 'Test item',
          quantity: 1,
          unitPrice: 100,
          lineAmount: 100,
          totalLineAmount: 100,
        }]
      });

      await caller.businessTransactions.delete({ id: created.id });

      // Should not be found in regular list
      const listResult = await caller.businessTransactions.list({});
      expect(listResult.data.find(t => t.id === created.id)).toBeUndefined();

      // Should not be found by ID
      await expect(caller.businessTransactions.getById({ 
        id: created.id 
      })).rejects.toThrow('NOT_FOUND');
    });

    it('should throw error for non-existent transaction', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      await expect(caller.businessTransactions.delete({
        id: '00000000-0000-0000-0000-000000000000',
      })).rejects.toThrow('NOT_FOUND');
    });
  });

  describe('Order-to-Cash Workflow', () => {
    it('should create invoice from sales order', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      // Create sales order
      const salesOrder = await caller.businessTransactions.create({
        transactionTypeCode: 'SALES_ORDER',
        entityId: testContext.customer.id,
        entityType: 'CUSTOMER',
        transactionDate: new Date(),
        lines: [{
          itemId: testContext.item.id,
          description: 'Test item',
          quantity: 10,
          unitPrice: 100,
          lineAmount: 1000,
          totalLineAmount: 1000,
        }]
      });

      // Create invoice from sales order
      const invoice = await caller.businessTransactions.create({
        transactionTypeCode: 'INVOICE',
        entityId: testContext.customer.id,
        entityType: 'CUSTOMER',
        transactionDate: new Date(),
        parentTransactionId: salesOrder.id,
        lines: [{
          itemId: testContext.item.id,
          description: 'Test item',
          quantity: 10,
          unitPrice: 100,
          lineAmount: 1000,
          totalLineAmount: 1000,
        }]
      });

      expect(invoice.parentTransactionId).toBe(salesOrder.id);
    });

    it('should track transaction relationships', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      // Create estimate
      const estimate = await caller.businessTransactions.create({
        transactionTypeCode: 'ESTIMATE',
        entityId: testContext.customer.id,
        entityType: 'CUSTOMER',
        transactionDate: new Date(),
        lines: [{
          itemId: testContext.item.id,
          description: 'Test item',
          quantity: 10,
          unitPrice: 100,
          lineAmount: 1000,
          totalLineAmount: 1000,
        }]
      });

      // Convert to sales order
      const salesOrder = await caller.businessTransactions.create({
        transactionTypeCode: 'SALES_ORDER',
        entityId: testContext.customer.id,
        entityType: 'CUSTOMER',
        transactionDate: new Date(),
        parentTransactionId: estimate.id,
        lines: [{
          itemId: testContext.item.id,
          description: 'Test item',
          quantity: 10,
          unitPrice: 100,
          lineAmount: 1000,
          totalLineAmount: 1000,
        }]
      });

      // Create invoice from sales order
      const invoice = await caller.businessTransactions.create({
        transactionTypeCode: 'INVOICE',
        entityId: testContext.customer.id,
        entityType: 'CUSTOMER',
        transactionDate: new Date(),
        parentTransactionId: salesOrder.id,
        lines: [{
          itemId: testContext.item.id,
          description: 'Test item',
          quantity: 10,
          unitPrice: 100,
          lineAmount: 1000,
          totalLineAmount: 1000,
        }]
      });

      expect(salesOrder.parentTransactionId).toBe(estimate.id);
      expect(invoice.parentTransactionId).toBe(salesOrder.id);
    });
  });

  describe('Status Management', () => {
    it('should update transaction status', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      const transaction = await caller.businessTransactions.create({
        transactionTypeCode: 'PURCHASE_ORDER',
        entityId: testContext.vendor.id,
        entityType: 'VENDOR',
        transactionDate: new Date(),
        lines: [{
          itemId: testContext.item.id,
          description: 'Test item',
          quantity: 1,
          unitPrice: 100,
          lineAmount: 100,
          totalLineAmount: 100,
        }]
      });

      const updated = await caller.businessTransactions.update({
        id: transaction.id,
        status: 'APPROVED',
      });

      expect(updated.status).toBe('APPROVED');
    });

    it('should validate status transitions', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      const transaction = await caller.businessTransactions.create({
        transactionTypeCode: 'PURCHASE_ORDER',
        entityId: testContext.vendor.id,
        entityType: 'VENDOR',
        transactionDate: new Date(),
        lines: [{
          itemId: testContext.item.id,
          description: 'Test item',
          quantity: 1,
          unitPrice: 100,
          lineAmount: 100,
          totalLineAmount: 100,
        }]
      });

      // Invalid status transition (skip approval)
      await expect(caller.businessTransactions.update({
        id: transaction.id,
        status: 'POSTED',
      })).rejects.toThrow();
    });
  });
});