import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceContext, ServiceError } from '../../types';

// Use vi.hoisted() to properly hoist mock functions for use in vi.mock factory
const {
  mockItemsCreate,
  mockItemsFindById,
  mockItemsFindByCode,
  mockItemsFindByOrganization,
  mockItemsUpdate,
  mockItemsDelete,
  mockItemsFindVariants,
  mockItemsGenerateVariants,
  mockItemsGetCountByCategory,
  mockUomFindById,
  mockCategoriesFindById,
  mockAccountFindById,
  mockAssembliesIsItemUsedInBOM,
} = vi.hoisted(() => ({
  mockItemsCreate: vi.fn(),
  mockItemsFindById: vi.fn(),
  mockItemsFindByCode: vi.fn(),
  mockItemsFindByOrganization: vi.fn(),
  mockItemsUpdate: vi.fn(),
  mockItemsDelete: vi.fn(),
  mockItemsFindVariants: vi.fn(),
  mockItemsGenerateVariants: vi.fn(),
  mockItemsGetCountByCategory: vi.fn(),
  mockUomFindById: vi.fn(),
  mockCategoriesFindById: vi.fn(),
  mockAccountFindById: vi.fn(),
  mockAssembliesIsItemUsedInBOM: vi.fn(),
}));

// Mock the database module with class constructors
vi.mock('@glapi/database', () => ({
  ItemsRepository: vi.fn().mockImplementation(() => ({
    create: mockItemsCreate,
    findById: mockItemsFindById,
    findByCode: mockItemsFindByCode,
    findByOrganization: mockItemsFindByOrganization,
    update: mockItemsUpdate,
    delete: mockItemsDelete,
    findVariants: mockItemsFindVariants,
    generateVariants: mockItemsGenerateVariants,
    getCountByCategory: mockItemsGetCountByCategory,
  })),
  UnitsOfMeasureRepository: vi.fn().mockImplementation(() => ({
    findById: mockUomFindById,
  })),
  ItemCategoriesRepository: vi.fn().mockImplementation(() => ({
    findById: mockCategoriesFindById,
  })),
  AccountRepository: vi.fn().mockImplementation(() => ({
    findById: mockAccountFindById,
  })),
  AssembliesKitsRepository: vi.fn().mockImplementation(() => ({
    isItemUsedInBOM: mockAssembliesIsItemUsedInBOM,
  })),
}));

// Import after mocking
import { ItemsService } from '../items-service';

describe('ItemsService', () => {
  let service: ItemsService;
  let context: ServiceContext;

  // Test UUIDs - valid format for validation
  const TEST_UUIDS = {
    org: '11111111-1111-1111-1111-111111111111',
    stytchOrg: '22222222-2222-2222-2222-222222222222',
    user: '33333333-3333-3333-3333-333333333333',
    stytchUser: '44444444-4444-4444-4444-444444444444',
    uom: '55555555-5555-5555-5555-555555555555',
    incomeAccount: '66666666-6666-6666-6666-666666666666',
    assetAccount: '77777777-7777-7777-7777-777777777777',
    cogsAccount: '88888888-8888-8888-8888-888888888888',
    item: '99999999-9999-9999-9999-999999999999',
    parentItem: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    category: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    account: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    context = {
      organizationId: TEST_UUIDS.org,
      stytchOrganizationId: TEST_UUIDS.stytchOrg,
      userId: TEST_UUIDS.user,
      stytchUserId: TEST_UUIDS.stytchUser,
    };

    service = new ItemsService(context);
  });

  describe('createItem', () => {
    const validItemInput = {
      itemCode: 'ITEM-001',
      name: 'Test Item',
      itemType: 'INVENTORY_ITEM' as const,
      unitOfMeasureId: TEST_UUIDS.uom,
      incomeAccountId: TEST_UUIDS.incomeAccount,
      assetAccountId: TEST_UUIDS.assetAccount,
      cogsAccountId: TEST_UUIDS.cogsAccount,
      defaultPrice: 100,
      isActive: true,
      isPurchasable: true,
      isSaleable: true,
      trackQuantity: true,
    };

    beforeEach(() => {
      // Setup default mocks for a successful create
      mockItemsFindByCode.mockResolvedValue(null);
      mockUomFindById.mockResolvedValue({
        id: TEST_UUIDS.uom,
        code: 'EA',
        name: 'Each',
      });
      mockCategoriesFindById.mockResolvedValue(null);
      mockAccountFindById.mockResolvedValue({ id: TEST_UUIDS.account });
      mockItemsCreate.mockResolvedValue({
        id: TEST_UUIDS.item,
        ...validItemInput,
        organizationId: context.organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('should create a valid inventory item', async () => {
      const result = await service.createItem(validItemInput);

      expect(result).toMatchObject({
        id: TEST_UUIDS.item,
        itemCode: validItemInput.itemCode,
        name: validItemInput.name,
        itemType: validItemInput.itemType,
      });

      expect(mockItemsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: context.organizationId,
          itemCode: validItemInput.itemCode,
          createdBy: context.userId,
        })
      );
    });

    it('should throw error if item code already exists', async () => {
      mockItemsFindByCode.mockResolvedValue({
        id: 'existing-item',
        itemCode: validItemInput.itemCode,
      });

      await expect(service.createItem(validItemInput)).rejects.toThrow(
        new ServiceError('Item with this code already exists', 'DUPLICATE_CODE', 409)
      );
    });

    it('should throw error if unit of measure not found', async () => {
      mockUomFindById.mockResolvedValue(null);

      await expect(service.createItem(validItemInput)).rejects.toThrow(
        new ServiceError('Unit of measure not found', 'INVALID_UOM', 400)
      );
    });

    it('should validate GL accounts based on item type', async () => {
      const serviceItem = {
        ...validItemInput,
        itemType: 'SERVICE' as const,
        incomeAccountId: undefined,
        assetAccountId: undefined,
        cogsAccountId: undefined,
        isPurchasable: false, // Only isSaleable is true, so only income account is required
      };

      await expect(service.createItem(serviceItem)).rejects.toThrow(
        new ServiceError('Missing required accounts: income account', 'MISSING_GL_ACCOUNTS', 400)
      );
    });

    it('should validate parent item when creating variant', async () => {
      const variantInput = {
        ...validItemInput,
        parentItemId: TEST_UUIDS.parentItem,
      };

      mockItemsFindById.mockResolvedValue(null);

      await expect(service.createItem(variantInput)).rejects.toThrow(
        new ServiceError('Parent item not found', 'INVALID_PARENT', 400)
      );
    });

    it('should create a variant successfully', async () => {
      const variantInput = {
        ...validItemInput,
        parentItemId: TEST_UUIDS.parentItem,
        variantAttributes: { size: 'M', color: 'Blue' },
      };

      mockItemsFindById.mockResolvedValue({
        id: TEST_UUIDS.parentItem,
        isParent: true,
        organizationId: context.organizationId,
      });

      // Mock the create to return the variant with parentItemId
      mockItemsCreate.mockResolvedValue({
        id: TEST_UUIDS.item,
        ...variantInput,
        organizationId: context.organizationId,
        parentItemId: TEST_UUIDS.parentItem,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createItem(variantInput);

      expect(result.parentItemId).toBe(TEST_UUIDS.parentItem);
      expect(mockItemsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          parentItemId: TEST_UUIDS.parentItem,
          variantAttributes: { size: 'M', color: 'Blue' },
        })
      );
    });
  });

  describe('updateItem', () => {
    const existingItem = {
      id: TEST_UUIDS.item,
      organizationId: TEST_UUIDS.org,
      itemCode: 'ITEM-001',
      name: 'Original Item',
      itemType: 'INVENTORY_ITEM',
      unitOfMeasureId: TEST_UUIDS.uom,
      incomeAccountId: TEST_UUIDS.incomeAccount,
      assetAccountId: TEST_UUIDS.assetAccount,
      cogsAccountId: TEST_UUIDS.cogsAccount,
      isActive: true,
    };

    beforeEach(() => {
      mockItemsFindById.mockResolvedValue(existingItem);
      mockItemsFindByCode.mockResolvedValue(null);
      mockUomFindById.mockResolvedValue({ id: TEST_UUIDS.uom });
      mockAccountFindById.mockResolvedValue({ id: TEST_UUIDS.account });
      mockAssembliesIsItemUsedInBOM.mockResolvedValue(false);
      mockItemsUpdate.mockResolvedValue({
        ...existingItem,
        name: 'Updated Item',
        updatedAt: new Date(),
      });
    });

    it('should update an item successfully', async () => {
      const updateData = {
        name: 'Updated Item',
        defaultPrice: 150,
      };

      const result = await service.updateItem(TEST_UUIDS.item, updateData);

      expect(result.name).toBe('Updated Item');
      expect(mockItemsUpdate).toHaveBeenCalledWith(
        TEST_UUIDS.item,
        context.organizationId,
        expect.objectContaining({
          name: 'Updated Item',
          defaultPrice: '150',
          updatedBy: context.userId,
        })
      );
    });

    it('should throw error if item not found', async () => {
      mockItemsFindById.mockResolvedValue(null);

      await expect(service.updateItem(TEST_UUIDS.item, { name: 'Updated' })).rejects.toThrow(
        new ServiceError('Item not found', 'ITEM_NOT_FOUND', 404)
      );
    });

    it('should prevent duplicate item codes', async () => {
      mockItemsFindByCode.mockResolvedValue({
        id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        itemCode: 'NEW-CODE',
      });

      await expect(
        service.updateItem(TEST_UUIDS.item, { itemCode: 'NEW-CODE' })
      ).rejects.toThrow(
        new ServiceError('Item with this code already exists', 'DUPLICATE_CODE', 409)
      );
    });

    // TODO: Enable when AssembliesKitsRepository BOM check is implemented in items-service.ts
    it.skip('should prevent changing item type when used in BOM', async () => {
      mockAssembliesIsItemUsedInBOM.mockResolvedValue(true);

      await expect(
        service.updateItem(TEST_UUIDS.item, { itemType: 'SERVICE' })
      ).rejects.toThrow(
        new ServiceError(
          'Cannot change item type when item is used in assemblies or kits',
          'ITEM_IN_USE',
          409
        )
      );
    });
  });

  describe('deleteItem', () => {
    it('should delete an item successfully', async () => {
      mockItemsDelete.mockResolvedValue(undefined);

      await service.deleteItem(TEST_UUIDS.item);

      expect(mockItemsDelete).toHaveBeenCalledWith(
        TEST_UUIDS.item,
        context.organizationId
      );
    });

    it('should throw error when deleting item with variants', async () => {
      mockItemsDelete.mockRejectedValue(
        new Error('Cannot delete item with variants')
      );

      await expect(service.deleteItem(TEST_UUIDS.item)).rejects.toThrow(
        new ServiceError('Cannot delete item with variants', 'HAS_VARIANTS', 409)
      );
    });
  });

  describe('listItems', () => {
    it('should list items with pagination and filters', async () => {
      const mockItems = [
        { id: 'item-1', name: 'Item 1' },
        { id: 'item-2', name: 'Item 2' },
      ];

      mockItemsFindByOrganization
        .mockResolvedValueOnce(mockItems)
        .mockResolvedValueOnce([...mockItems, { id: 'item-3', name: 'Item 3' }]);

      const result = await service.listItems({
        page: 1,
        limit: 2,
        itemType: 'INVENTORY_ITEM',
        isActive: true,
      });

      expect(result).toMatchObject({
        data: expect.arrayContaining([
          expect.objectContaining({ id: 'item-1' }),
          expect.objectContaining({ id: 'item-2' }),
        ]),
        total: 3,
        page: 1,
        limit: 2,
        totalPages: 2,
      });

      expect(mockItemsFindByOrganization).toHaveBeenCalledWith(
        context.organizationId,
        expect.objectContaining({
          itemType: 'INVENTORY_ITEM',
          isActive: true,
          limit: 2,
          offset: 0,
        })
      );
    });
  });

  describe('generateVariants', () => {
    it('should generate variants for a parent item', async () => {
      const mockVariants = [
        { id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', itemCode: 'ITEM-S-Red' },
        { id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', itemCode: 'ITEM-S-Blue' },
        { id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03', itemCode: 'ITEM-M-Red' },
        { id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee04', itemCode: 'ITEM-M-Blue' },
      ];

      mockItemsGenerateVariants.mockResolvedValue(mockVariants);

      // attributes must be an array of { name, values } objects
      const result = await service.generateVariants({
        parentItemId: TEST_UUIDS.parentItem,
        attributes: [
          { name: 'size', values: ['S', 'M'] },
          { name: 'color', values: ['Red', 'Blue'] },
        ],
      });

      expect(result).toHaveLength(4);
      expect(mockItemsGenerateVariants).toHaveBeenCalledWith(
        TEST_UUIDS.parentItem,
        context.organizationId,
        [
          { name: 'size', values: ['S', 'M'] },
          { name: 'color', values: ['Red', 'Blue'] },
        ]
      );
    });

    it('should handle parent not found error', async () => {
      mockItemsGenerateVariants.mockRejectedValue(
        new Error('Parent item not found')
      );

      await expect(
        service.generateVariants({
          parentItemId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
          attributes: [{ name: 'size', values: ['S'] }],
        })
      ).rejects.toThrow(
        new ServiceError('Parent item not found', 'PARENT_NOT_FOUND', 404)
      );
    });
  });

  describe('searchItems', () => {
    it('should search items by query', async () => {
      const mockResults = [
        { id: 'item-1', name: 'Laptop Computer' },
        { id: 'item-2', name: 'Desktop Computer' },
      ];

      mockItemsFindByOrganization.mockResolvedValue(mockResults);

      const result = await service.searchItems('computer');

      expect(result).toHaveLength(2);
      expect(mockItemsFindByOrganization).toHaveBeenCalledWith(
        context.organizationId,
        {
          query: 'computer',
          limit: 50,
        }
      );
    });
  });

  describe('getItemsByCategory', () => {
    it('should get items by category', async () => {
      const mockItems = [
        { id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', categoryId: TEST_UUIDS.category },
        { id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', categoryId: TEST_UUIDS.category },
      ];

      mockItemsFindByOrganization.mockResolvedValue(mockItems);

      const result = await service.getItemsByCategory(TEST_UUIDS.category);

      expect(result).toHaveLength(2);
      expect(mockItemsFindByOrganization).toHaveBeenCalledWith(
        context.organizationId,
        {
          categoryId: TEST_UUIDS.category,
        }
      );
    });
  });
});
