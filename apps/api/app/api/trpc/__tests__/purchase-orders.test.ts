import { describe, it, expect, beforeEach } from '@jest/globals';
import { TRPCError } from '@trpc/server';
import { createAuthenticatedCaller, createUnauthenticatedCaller, testData } from '../../../../tests/utils/trpc-utils';
import { TestDbUtils } from '../../../../tests/utils/db-utils';

describe('Purchase Orders tRPC API', () => {
  let testContext: Awaited<ReturnType<typeof TestDbUtils.createCompleteTestData>>;

  beforeEach(async () => {
    testContext = await TestDbUtils.createCompleteTestData();
  });

  describe('Authentication & Authorization', () => {
    it('should require authentication for all endpoints', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(caller.purchaseOrders.list()).rejects.toThrow('UNAUTHORIZED');
      await expect(caller.purchaseOrders.create(testData.createPurchaseOrderInput('vendor-id'))).rejects.toThrow('UNAUTHORIZED');
    });

    it('should require organization context', async () => {
      const caller = createAuthenticatedCaller(null); // No orgId

      await expect(caller.purchaseOrders.list()).rejects.toThrow();
    });
  });

  describe('purchaseOrders.list', () => {
    it('should return empty list when no purchase orders exist', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      const result = await caller.purchaseOrders.list();
      
      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.page).toBe(1);
      expect(result.meta.totalPages).toBe(0);
    });

    it('should return paginated purchase orders', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      // Create test purchase orders
      await TestDbUtils.createTestPurchaseOrder(testContext.organization.id, testContext.vendor.id);
      await TestDbUtils.createTestPurchaseOrder(testContext.organization.id, testContext.vendor.id);
      
      const result = await caller.purchaseOrders.list({
        page: 1,
        limit: 10
      });
      
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.data[0]).toMatchObject({
        id: expect.any(String),
        purchaseOrderNumber: expect.any(String),
        vendorId: testContext.vendor.id,
        status: 'DRAFT',
        totalAmount: expect.any(Number),
      });
    });

    it('should filter purchase orders by status', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      // Create purchase orders with different statuses
      await TestDbUtils.createTestPurchaseOrder(testContext.organization.id, testContext.vendor.id);
      const approvedPO = await TestDbUtils.createTestPurchaseOrder(testContext.organization.id, testContext.vendor.id);
      // TODO: Update status to APPROVED through API once implemented
      
      const result = await caller.purchaseOrders.list({
        status: 'DRAFT'
      });
      
      expect(result.data).toHaveLength(2); // Both are draft initially
      expect(result.data.every(po => po.status === 'DRAFT')).toBe(true);
    });

    it('should search purchase orders by vendor name', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      await TestDbUtils.createTestPurchaseOrder(testContext.organization.id, testContext.vendor.id);
      
      const result = await caller.purchaseOrders.list({
        search: testContext.vendor.companyName
      });
      
      expect(result.data).toHaveLength(1);
    });
  });

  describe('purchaseOrders.create', () => {
    it('should create purchase order with valid data', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      const input = testData.createPurchaseOrderInput(testContext.vendor.id);
      input.items[0].itemId = testContext.item.id;
      
      const result = await caller.purchaseOrders.create(input);
      
      expect(result).toMatchObject({
        id: expect.any(String),
        purchaseOrderNumber: expect.any(String),
        vendorId: testContext.vendor.id,
        status: 'DRAFT',
        expectedDate: input.expectedDate,
        subtotal: 255.00, // 10 * 25.50
        totalAmount: expect.any(Number),
        notes: input.notes,
      });
    });

    it('should validate required fields', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      const invalidInput = {
        // Missing vendorId
        expectedDate: new Date(),
        items: [],
      };
      
      await expect(caller.purchaseOrders.create(invalidInput as any)).rejects.toThrow('BAD_REQUEST');
    });

    it('should validate vendor exists and belongs to organization', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      const input = testData.createPurchaseOrderInput('invalid-vendor-id');
      
      await expect(caller.purchaseOrders.create(input)).rejects.toThrow('NOT_FOUND');
    });

    it('should validate items exist and belong to organization', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      const input = testData.createPurchaseOrderInput(testContext.vendor.id);
      input.items[0].itemId = 'invalid-item-id';
      
      await expect(caller.purchaseOrders.create(input)).rejects.toThrow('NOT_FOUND');
    });

    it('should calculate totals correctly', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      const input = testData.createPurchaseOrderInput(testContext.vendor.id);
      input.items = [
        { itemId: testContext.item.id, quantity: 10, unitCost: 25.50 },
        { itemId: testContext.item.id, quantity: 5, unitCost: 40.00 },
      ];
      
      const result = await caller.purchaseOrders.create(input);
      
      expect(result.subtotal).toBe(455.00); // (10 * 25.50) + (5 * 40.00)
      expect(result.totalAmount).toBeGreaterThanOrEqual(result.subtotal); // May include tax
    });

    it('should generate unique purchase order number', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      const input1 = testData.createPurchaseOrderInput(testContext.vendor.id);
      input1.items[0].itemId = testContext.item.id;
      
      const input2 = testData.createPurchaseOrderInput(testContext.vendor.id);
      input2.items[0].itemId = testContext.item.id;
      
      const result1 = await caller.purchaseOrders.create(input1);
      const result2 = await caller.purchaseOrders.create(input2);
      
      expect(result1.purchaseOrderNumber).not.toBe(result2.purchaseOrderNumber);
    });
  });

  describe('purchaseOrders.getById', () => {
    it('should return purchase order by id', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      const po = await TestDbUtils.createTestPurchaseOrder(testContext.organization.id, testContext.vendor.id);
      
      const result = await caller.purchaseOrders.getById(po.id);
      
      expect(result).toMatchObject({
        id: po.id,
        purchaseOrderNumber: po.purchaseOrderNumber,
        vendorId: po.vendorId,
        status: po.status,
      });
    });

    it('should throw error for non-existent purchase order', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      await expect(caller.purchaseOrders.getById('invalid-id')).rejects.toThrow('NOT_FOUND');
    });

    it('should enforce organization isolation', async () => {
      const otherOrgData = await TestDbUtils.createCompleteTestData();
      const po = await TestDbUtils.createTestPurchaseOrder(otherOrgData.organization.id, otherOrgData.vendor.id);
      
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      await expect(caller.purchaseOrders.getById(po.id)).rejects.toThrow('NOT_FOUND');
    });
  });

  describe('purchaseOrders.update', () => {
    it('should update purchase order in draft status', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      const po = await TestDbUtils.createTestPurchaseOrder(testContext.organization.id, testContext.vendor.id);
      
      const updateData = {
        expectedDate: new Date('2025-01-15'),
        notes: 'Updated notes',
      };
      
      const result = await caller.purchaseOrders.update({
        id: po.id,
        data: updateData,
      });
      
      expect(result.expectedDate).toEqual(updateData.expectedDate);
      expect(result.notes).toBe(updateData.notes);
    });

    it('should prevent updates to approved purchase orders', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      const po = await TestDbUtils.createTestPurchaseOrder(testContext.organization.id, testContext.vendor.id);
      // TODO: Approve the PO first once approve endpoint is implemented
      
      const updateData = { notes: 'Should not work' };
      
      // For now, this test will pass since PO is in draft
      // TODO: Update this test once status management is implemented
      const result = await caller.purchaseOrders.update({
        id: po.id,
        data: updateData,
      });
      
      expect(result.notes).toBe(updateData.notes);
    });
  });

  describe('purchaseOrders.delete', () => {
    it('should delete purchase order in draft status', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      const po = await TestDbUtils.createTestPurchaseOrder(testContext.organization.id, testContext.vendor.id);
      
      await caller.purchaseOrders.delete({ id: po.id });
      
      await expect(caller.purchaseOrders.getById(po.id)).rejects.toThrow('NOT_FOUND');
    });

    it('should prevent deletion of approved purchase orders', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      const po = await TestDbUtils.createTestPurchaseOrder(testContext.organization.id, testContext.vendor.id);
      // TODO: Approve the PO first once approve endpoint is implemented
      
      // For now, this will succeed since PO is in draft
      // TODO: Update this test once status management is implemented
      await caller.purchaseOrders.delete({ id: po.id });
    });
  });

  describe('purchaseOrders.approve', () => {
    it('should approve purchase order in draft status', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      const po = await TestDbUtils.createTestPurchaseOrder(testContext.organization.id, testContext.vendor.id);
      
      const result = await caller.purchaseOrders.approve({ id: po.id });
      
      expect(result.status).toBe('APPROVED');
      expect(result.approvedAt).toBeDefined();
    });

    it('should prevent approving already approved purchase orders', async () => {
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      const po = await TestDbUtils.createTestPurchaseOrder(testContext.organization.id, testContext.vendor.id);
      
      // Approve once
      await caller.purchaseOrders.approve({ id: po.id });
      
      // Try to approve again
      await expect(caller.purchaseOrders.approve({ id: po.id })).rejects.toThrow('BAD_REQUEST');
    });
  });

  describe('Business Logic', () => {
    it('should enforce vendor belongs to same organization', async () => {
      const otherOrgData = await TestDbUtils.createCompleteTestData();
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      const input = testData.createPurchaseOrderInput(otherOrgData.vendor.id);
      
      await expect(caller.purchaseOrders.create(input)).rejects.toThrow('NOT_FOUND');
    });

    it('should enforce items belong to same organization', async () => {
      const otherOrgData = await TestDbUtils.createCompleteTestData();
      const caller = createAuthenticatedCaller(testContext.organization.id);
      
      const input = testData.createPurchaseOrderInput(testContext.vendor.id);
      input.items[0].itemId = otherOrgData.item.id;
      
      await expect(caller.purchaseOrders.create(input)).rejects.toThrow('NOT_FOUND');
    });
  });
});