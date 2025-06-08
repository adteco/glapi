import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { itemsRepository } from '../items-repository';
import { unitsOfMeasureRepository } from '../units-of-measure-repository';
import { itemCategoriesRepository } from '../item-categories-repository';
import { db } from '../../db';
import { items, unitsOfMeasure, itemCategories } from '../../db/schema';
import { eq } from 'drizzle-orm';

describe('ItemsRepository', () => {
  const testOrganizationId = 'test-org-123';
  const testUserId = 'test-user-123';
  let createdItemIds: string[] = [];
  let testUnitId: string;
  let testCategoryId: string;

  beforeEach(async () => {
    // Clean up any existing test data
    await db.delete(items).where(eq(items.organizationId, testOrganizationId));
    await db.delete(unitsOfMeasure).where(eq(unitsOfMeasure.organizationId, testOrganizationId));
    await db.delete(itemCategories).where(eq(itemCategories.organizationId, testOrganizationId));
    createdItemIds = [];

    // Create test unit of measure
    const unit = await unitsOfMeasureRepository.create({
      organizationId: testOrganizationId,
      code: 'EA',
      name: 'Each',
      abbreviation: 'ea',
      baseConversionFactor: '1',
      decimalPlaces: 0,
      isActive: true,
      createdBy: testUserId,
      updatedBy: testUserId,
    });
    testUnitId = unit.id;

    // Create test category
    const category = await itemCategoriesRepository.create({
      organizationId: testOrganizationId,
      code: 'ELECTRONICS',
      name: 'Electronics',
      isActive: true,
      createdBy: testUserId,
      updatedBy: testUserId,
    });
    testCategoryId = category.id;
  });

  afterEach(async () => {
    // Clean up all test data
    for (const id of createdItemIds) {
      await db.delete(items).where(eq(items.id, id));
    }
    await db.delete(unitsOfMeasure).where(eq(unitsOfMeasure.organizationId, testOrganizationId));
    await db.delete(itemCategories).where(eq(itemCategories.organizationId, testOrganizationId));
  });

  describe('create', () => {
    it('should create a new inventory item', async () => {
      const data = {
        organizationId: testOrganizationId,
        itemCode: 'LAPTOP-001',
        name: 'Laptop Computer',
        description: 'High-performance laptop',
        itemType: 'INVENTORY_ITEM' as const,
        categoryId: testCategoryId,
        unitOfMeasureId: testUnitId,
        incomeAccountId: 'income-account-123',
        assetAccountId: 'asset-account-123',
        cogsAccountId: 'cogs-account-123',
        defaultPrice: '999.99',
        defaultCost: '600.00',
        isTaxable: true,
        isActive: true,
        isPurchasable: true,
        isSaleable: true,
        trackQuantity: true,
        sku: 'SKU-LAPTOP-001',
        weight: '2.5',
        weightUnit: 'KG',
        createdBy: testUserId,
        updatedBy: testUserId,
      };

      const result = await itemsRepository.create(data);
      createdItemIds.push(result.id);

      expect(result).toMatchObject({
        ...data,
        id: expect.any(String),
        isParent: false,
        trackLotNumbers: false,
        trackSerialNumbers: false,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should create a parent item for variants', async () => {
      const data = {
        organizationId: testOrganizationId,
        itemCode: 'TSHIRT',
        name: 'T-Shirt',
        itemType: 'INVENTORY_ITEM' as const,
        isParent: true,
        variantAttributes: { size: ['S', 'M', 'L'], color: ['Red', 'Blue'] },
        unitOfMeasureId: testUnitId,
        incomeAccountId: 'income-account-123',
        assetAccountId: 'asset-account-123',
        cogsAccountId: 'cogs-account-123',
        defaultPrice: '19.99',
        isActive: true,
        isSaleable: true,
        createdBy: testUserId,
        updatedBy: testUserId,
      };

      const result = await itemsRepository.create(data);
      createdItemIds.push(result.id);

      expect(result.isParent).toBe(true);
      expect(result.variantAttributes).toEqual({ size: ['S', 'M', 'L'], color: ['Red', 'Blue'] });
    });

    it('should create a service item', async () => {
      const data = {
        organizationId: testOrganizationId,
        itemCode: 'CONSULT-001',
        name: 'Consulting Service',
        itemType: 'SERVICE' as const,
        unitOfMeasureId: testUnitId,
        incomeAccountId: 'income-account-123',
        defaultPrice: '150.00',
        isActive: true,
        isSaleable: true,
        createdBy: testUserId,
        updatedBy: testUserId,
      };

      const result = await itemsRepository.create(data);
      createdItemIds.push(result.id);

      expect(result.itemType).toBe('SERVICE');
      expect(result.trackQuantity).toBe(false);
    });
  });

  describe('findById', () => {
    it('should find an item by id and organization', async () => {
      const created = await itemsRepository.create({
        organizationId: testOrganizationId,
        itemCode: 'MOUSE-001',
        name: 'Wireless Mouse',
        itemType: 'INVENTORY_ITEM' as const,
        unitOfMeasureId: testUnitId,
        incomeAccountId: 'income-account-123',
        assetAccountId: 'asset-account-123',
        cogsAccountId: 'cogs-account-123',
        isActive: true,
        createdBy: testUserId,
        updatedBy: testUserId,
      });
      createdItemIds.push(created.id);

      const found = await itemsRepository.findById(created.id, testOrganizationId);
      expect(found).toMatchObject(created);
    });

    it('should return null for wrong organization', async () => {
      const created = await itemsRepository.create({
        organizationId: testOrganizationId,
        itemCode: 'KEYBOARD-001',
        name: 'Mechanical Keyboard',
        itemType: 'INVENTORY_ITEM' as const,
        unitOfMeasureId: testUnitId,
        incomeAccountId: 'income-account-123',
        assetAccountId: 'asset-account-123',
        cogsAccountId: 'cogs-account-123',
        isActive: true,
        createdBy: testUserId,
        updatedBy: testUserId,
      });
      createdItemIds.push(created.id);

      const found = await itemsRepository.findById(created.id, 'wrong-org');
      expect(found).toBeNull();
    });
  });

  describe('findByCode', () => {
    it('should find an item by code', async () => {
      const created = await itemsRepository.create({
        organizationId: testOrganizationId,
        itemCode: 'UNIQUE-CODE-123',
        name: 'Unique Item',
        itemType: 'INVENTORY_ITEM' as const,
        unitOfMeasureId: testUnitId,
        incomeAccountId: 'income-account-123',
        assetAccountId: 'asset-account-123',
        cogsAccountId: 'cogs-account-123',
        isActive: true,
        createdBy: testUserId,
        updatedBy: testUserId,
      });
      createdItemIds.push(created.id);

      const found = await itemsRepository.findByCode('UNIQUE-CODE-123', testOrganizationId);
      expect(found).toMatchObject(created);
    });
  });

  describe('findByOrganization', () => {
    beforeEach(async () => {
      // Create multiple items for testing
      const itemsData = [
        {
          organizationId: testOrganizationId,
          itemCode: 'LAPTOP-001',
          name: 'Laptop Pro',
          itemType: 'INVENTORY_ITEM' as const,
          categoryId: testCategoryId,
          unitOfMeasureId: testUnitId,
          incomeAccountId: 'income-account-123',
          assetAccountId: 'asset-account-123',
          cogsAccountId: 'cogs-account-123',
          isActive: true,
          isPurchasable: true,
          isSaleable: true,
          createdBy: testUserId,
          updatedBy: testUserId,
        },
        {
          organizationId: testOrganizationId,
          itemCode: 'SERVICE-001',
          name: 'Support Service',
          itemType: 'SERVICE' as const,
          unitOfMeasureId: testUnitId,
          incomeAccountId: 'income-account-123',
          isActive: true,
          isSaleable: true,
          createdBy: testUserId,
          updatedBy: testUserId,
        },
        {
          organizationId: testOrganizationId,
          itemCode: 'INACTIVE-001',
          name: 'Inactive Item',
          itemType: 'INVENTORY_ITEM' as const,
          unitOfMeasureId: testUnitId,
          incomeAccountId: 'income-account-123',
          assetAccountId: 'asset-account-123',
          cogsAccountId: 'cogs-account-123',
          isActive: false,
          createdBy: testUserId,
          updatedBy: testUserId,
        },
      ];

      for (const data of itemsData) {
        const item = await itemsRepository.create(data);
        createdItemIds.push(item.id);
      }
    });

    it('should find all active items by default', async () => {
      const items = await itemsRepository.findByOrganization(testOrganizationId);
      expect(items).toHaveLength(2);
      expect(items.every(i => i.isActive)).toBe(true);
    });

    it('should filter by item type', async () => {
      const items = await itemsRepository.findByOrganization(testOrganizationId, {
        itemType: 'SERVICE',
      });
      expect(items).toHaveLength(1);
      expect(items[0].itemType).toBe('SERVICE');
    });

    it('should filter by category', async () => {
      const items = await itemsRepository.findByOrganization(testOrganizationId, {
        categoryId: testCategoryId,
      });
      expect(items).toHaveLength(1);
      expect(items[0].categoryId).toBe(testCategoryId);
    });

    it('should search by query', async () => {
      const items = await itemsRepository.findByOrganization(testOrganizationId, {
        query: 'laptop',
      });
      expect(items).toHaveLength(1);
      expect(items[0].name).toContain('Laptop');
    });

    it('should include inactive items when specified', async () => {
      const items = await itemsRepository.findByOrganization(testOrganizationId, {
        isActive: false,
      });
      expect(items).toHaveLength(3);
    });

    it('should filter purchasable items', async () => {
      const items = await itemsRepository.findByOrganization(testOrganizationId, {
        isPurchasable: true,
      });
      expect(items).toHaveLength(1);
      expect(items[0].isPurchasable).toBe(true);
    });

    it('should apply pagination', async () => {
      const items = await itemsRepository.findByOrganization(testOrganizationId, {
        limit: 1,
        offset: 0,
      });
      expect(items).toHaveLength(1);
    });
  });

  describe('generateVariants', () => {
    it('should generate variants for a parent item', async () => {
      const parent = await itemsRepository.create({
        organizationId: testOrganizationId,
        itemCode: 'SHIRT',
        name: 'Shirt',
        itemType: 'INVENTORY_ITEM' as const,
        isParent: true,
        unitOfMeasureId: testUnitId,
        incomeAccountId: 'income-account-123',
        assetAccountId: 'asset-account-123',
        cogsAccountId: 'cogs-account-123',
        defaultPrice: '29.99',
        isActive: true,
        createdBy: testUserId,
        updatedBy: testUserId,
      });
      createdItemIds.push(parent.id);

      const attributes = {
        size: ['S', 'M'],
        color: ['Red', 'Blue'],
      };

      const variants = await itemsRepository.generateVariants(
        parent.id,
        testOrganizationId,
        attributes
      );

      // Should create 4 variants (2 sizes × 2 colors)
      expect(variants).toHaveLength(4);
      variants.forEach(v => createdItemIds.push(v.id));

      // Check variant codes
      const variantCodes = variants.map(v => v.itemCode).sort();
      expect(variantCodes).toEqual([
        'SHIRT-S-Red',
        'SHIRT-S-Blue',
        'SHIRT-M-Red',
        'SHIRT-M-Blue',
      ].sort());

      // Check that all variants reference the parent
      expect(variants.every(v => v.parentItemId === parent.id)).toBe(true);
    });
  });

  describe('update', () => {
    it('should update an item', async () => {
      const created = await itemsRepository.create({
        organizationId: testOrganizationId,
        itemCode: 'UPDATE-001',
        name: 'Original Name',
        itemType: 'INVENTORY_ITEM' as const,
        unitOfMeasureId: testUnitId,
        incomeAccountId: 'income-account-123',
        assetAccountId: 'asset-account-123',
        cogsAccountId: 'cogs-account-123',
        defaultPrice: '100.00',
        isActive: true,
        createdBy: testUserId,
        updatedBy: testUserId,
      });
      createdItemIds.push(created.id);

      const updated = await itemsRepository.update(
        created.id,
        testOrganizationId,
        {
          name: 'Updated Name',
          defaultPrice: '150.00',
          description: 'Now with description',
        }
      );

      expect(updated).toMatchObject({
        ...created,
        name: 'Updated Name',
        defaultPrice: '150.00',
        description: 'Now with description',
        updatedAt: expect.any(Date),
      });
    });
  });

  describe('delete', () => {
    it('should soft delete an item without variants', async () => {
      const created = await itemsRepository.create({
        organizationId: testOrganizationId,
        itemCode: 'DELETE-001',
        name: 'Item to Delete',
        itemType: 'INVENTORY_ITEM' as const,
        unitOfMeasureId: testUnitId,
        incomeAccountId: 'income-account-123',
        assetAccountId: 'asset-account-123',
        cogsAccountId: 'cogs-account-123',
        isActive: true,
        createdBy: testUserId,
        updatedBy: testUserId,
      });

      await itemsRepository.delete(created.id, testOrganizationId);

      const found = await itemsRepository.findById(created.id, testOrganizationId);
      expect(found?.isActive).toBe(false);
    });

    it('should throw error when deleting parent with variants', async () => {
      const parent = await itemsRepository.create({
        organizationId: testOrganizationId,
        itemCode: 'PARENT-DELETE',
        name: 'Parent Item',
        itemType: 'INVENTORY_ITEM' as const,
        isParent: true,
        unitOfMeasureId: testUnitId,
        incomeAccountId: 'income-account-123',
        assetAccountId: 'asset-account-123',
        cogsAccountId: 'cogs-account-123',
        isActive: true,
        createdBy: testUserId,
        updatedBy: testUserId,
      });
      createdItemIds.push(parent.id);

      // Create a variant
      const variant = await itemsRepository.create({
        organizationId: testOrganizationId,
        itemCode: 'PARENT-DELETE-VAR',
        name: 'Variant',
        itemType: 'INVENTORY_ITEM' as const,
        parentItemId: parent.id,
        unitOfMeasureId: testUnitId,
        incomeAccountId: 'income-account-123',
        assetAccountId: 'asset-account-123',
        cogsAccountId: 'cogs-account-123',
        isActive: true,
        createdBy: testUserId,
        updatedBy: testUserId,
      });
      createdItemIds.push(variant.id);

      await expect(
        itemsRepository.delete(parent.id, testOrganizationId)
      ).rejects.toThrow('Cannot delete item with variants');
    });
  });
});