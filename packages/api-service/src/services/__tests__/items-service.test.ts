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

  beforeEach(() => {
    vi.clearAllMocks();

    context = {
      organizationId: 'test-org-123',
      stytchOrganizationId: 'stytch-org-123',
      userId: 'test-user-123',
      stytchUserId: 'stytch-user-123',
    };

    service = new ItemsService(context);
  });

  describe('createItem', () => {
    const validItemInput = {
      itemCode: 'ITEM-001',
      name: 'Test Item',
      itemType: 'INVENTORY_ITEM' as const,
      unitOfMeasureId: 'uom-123',
      incomeAccountId: 'income-123',
      assetAccountId: 'asset-123',
      cogsAccountId: 'cogs-123',
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
        id: 'uom-123',
        code: 'EA',
        name: 'Each',
      });
      mockCategoriesFindById.mockResolvedValue(null);
      mockAccountFindById.mockResolvedValue({ id: 'account-123' });
      mockItemsCreate.mockResolvedValue({
        id: 'item-123',
        ...validItemInput,
        organizationId: context.organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('should create a valid inventory item', async () => {
      const result = await service.createItem(validItemInput);

      expect(result).toMatchObject({
        id: 'item-123',
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
      };

      await expect(service.createItem(serviceItem)).rejects.toThrow(
        new ServiceError('Missing required accounts: income account', 'MISSING_GL_ACCOUNTS', 400)
      );
    });

    it('should validate parent item when creating variant', async () => {
      const variantInput = {
        ...validItemInput,
        parentItemId: 'parent-123',
      };

      mockItemsFindById.mockResolvedValue(null);

      await expect(service.createItem(variantInput)).rejects.toThrow(
        new ServiceError('Parent item not found', 'INVALID_PARENT', 400)
      );
    });

    it('should create a variant successfully', async () => {
      const variantInput = {
        ...validItemInput,
        parentItemId: 'parent-123',
        variantAttributes: { size: 'M', color: 'Blue' },
      };

      mockItemsFindById.mockResolvedValue({
        id: 'parent-123',
        isParent: true,
        organizationId: context.organizationId,
      });

      const result = await service.createItem(variantInput);

      expect(result.parentItemId).toBe('parent-123');
      expect(mockItemsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          parentItemId: 'parent-123',
          variantAttributes: { size: 'M', color: 'Blue' },
        })
      );
    });
  });

  describe('updateItem', () => {
    const existingItem = {
      id: 'item-123',
      organizationId: 'test-org-123',
      itemCode: 'ITEM-001',
      name: 'Original Item',
      itemType: 'INVENTORY_ITEM',
      unitOfMeasureId: 'uom-123',
      incomeAccountId: 'income-123',
      assetAccountId: 'asset-123',
      cogsAccountId: 'cogs-123',
      isActive: true,
    };

    beforeEach(() => {
      mockItemsFindById.mockResolvedValue(existingItem);
      mockItemsFindByCode.mockResolvedValue(null);
      mockUomFindById.mockResolvedValue({ id: 'uom-123' });
      mockAccountFindById.mockResolvedValue({ id: 'account-123' });
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

      const result = await service.updateItem('item-123', updateData);

      expect(result.name).toBe('Updated Item');
      expect(mockItemsUpdate).toHaveBeenCalledWith(
        'item-123',
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

      await expect(service.updateItem('item-123', { name: 'Updated' })).rejects.toThrow(
        new ServiceError('Item not found', 'ITEM_NOT_FOUND', 404)
      );
    });

    it('should prevent duplicate item codes', async () => {
      mockItemsFindByCode.mockResolvedValue({
        id: 'other-item',
        itemCode: 'NEW-CODE',
      });

      await expect(
        service.updateItem('item-123', { itemCode: 'NEW-CODE' })
      ).rejects.toThrow(
        new ServiceError('Item with this code already exists', 'DUPLICATE_CODE', 409)
      );
    });

    it('should prevent changing item type when used in BOM', async () => {
      mockAssembliesIsItemUsedInBOM.mockResolvedValue(true);

      await expect(
        service.updateItem('item-123', { itemType: 'SERVICE' })
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

      await service.deleteItem('item-123');

      expect(mockItemsDelete).toHaveBeenCalledWith(
        'item-123',
        context.organizationId
      );
    });

    it('should throw error when deleting item with variants', async () => {
      mockItemsDelete.mockRejectedValue(
        new Error('Cannot delete item with variants')
      );

      await expect(service.deleteItem('item-123')).rejects.toThrow(
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
        pages: 2,
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
        { id: 'variant-1', itemCode: 'ITEM-S-Red' },
        { id: 'variant-2', itemCode: 'ITEM-S-Blue' },
        { id: 'variant-3', itemCode: 'ITEM-M-Red' },
        { id: 'variant-4', itemCode: 'ITEM-M-Blue' },
      ];

      mockItemsGenerateVariants.mockResolvedValue(mockVariants);

      const result = await service.generateVariants({
        parentItemId: 'parent-123',
        attributes: {
          size: ['S', 'M'],
          color: ['Red', 'Blue'],
        },
      });

      expect(result).toHaveLength(4);
      expect(mockItemsGenerateVariants).toHaveBeenCalledWith(
        'parent-123',
        context.organizationId,
        {
          size: ['S', 'M'],
          color: ['Red', 'Blue'],
        }
      );
    });

    it('should handle parent not found error', async () => {
      mockItemsGenerateVariants.mockRejectedValue(
        new Error('Parent item not found')
      );

      await expect(
        service.generateVariants({
          parentItemId: 'invalid-parent',
          attributes: { size: ['S'] },
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
        { id: 'item-1', categoryId: 'cat-123' },
        { id: 'item-2', categoryId: 'cat-123' },
      ];

      mockItemsFindByOrganization.mockResolvedValue(mockItems);

      const result = await service.getItemsByCategory('cat-123');

      expect(result).toHaveLength(2);
      expect(mockItemsFindByOrganization).toHaveBeenCalledWith(
        context.organizationId,
        {
          categoryId: 'cat-123',
        }
      );
    });
  });
});
