import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ItemsService } from '../items-service';
import { ServiceContext, ServiceError } from '../../types';
import * as database from '@glapi/database';

// Mock the database module
jest.mock('@glapi/database', () => ({
  itemsRepository: {
    create: jest.fn(),
    findById: jest.fn(),
    findByCode: jest.fn(),
    findByOrganization: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findVariants: jest.fn(),
    generateVariants: jest.fn(),
    getCountByCategory: jest.fn(),
  },
  unitsOfMeasureRepository: {
    findById: jest.fn(),
  },
  itemCategoriesRepository: {
    findById: jest.fn(),
  },
  accountRepository: {
    findById: jest.fn(),
  },
  assembliesKitsRepository: {
    isItemUsedInBOM: jest.fn(),
  },
}));

describe('ItemsService', () => {
  let service: ItemsService;
  let context: ServiceContext;
  const mockRepos = database as jest.Mocked<typeof database>;

  beforeEach(() => {
    jest.clearAllMocks();
    
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
      mockRepos.itemsRepository.findByCode.mockResolvedValue(null);
      mockRepos.unitsOfMeasureRepository.findById.mockResolvedValue({
        id: 'uom-123',
        code: 'EA',
        name: 'Each',
      });
      mockRepos.itemCategoriesRepository.findById.mockResolvedValue(null);
      mockRepos.accountRepository.findById.mockResolvedValue({ id: 'account-123' });
      mockRepos.itemsRepository.create.mockResolvedValue({
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

      expect(mockRepos.itemsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: context.organizationId,
          itemCode: validItemInput.itemCode,
          createdBy: context.userId,
        })
      );
    });

    it('should throw error if item code already exists', async () => {
      mockRepos.itemsRepository.findByCode.mockResolvedValue({
        id: 'existing-item',
        itemCode: validItemInput.itemCode,
      });

      await expect(service.createItem(validItemInput)).rejects.toThrow(
        new ServiceError('Item with this code already exists', 'DUPLICATE_CODE', 409)
      );
    });

    it('should throw error if unit of measure not found', async () => {
      mockRepos.unitsOfMeasureRepository.findById.mockResolvedValue(null);

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

      mockRepos.itemsRepository.findById.mockResolvedValue(null);

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

      mockRepos.itemsRepository.findById.mockResolvedValue({
        id: 'parent-123',
        isParent: true,
        organizationId: context.organizationId,
      });

      const result = await service.createItem(variantInput);

      expect(result.parentItemId).toBe('parent-123');
      expect(mockRepos.itemsRepository.create).toHaveBeenCalledWith(
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
      mockRepos.itemsRepository.findById.mockResolvedValue(existingItem);
      mockRepos.itemsRepository.findByCode.mockResolvedValue(null);
      mockRepos.unitsOfMeasureRepository.findById.mockResolvedValue({ id: 'uom-123' });
      mockRepos.accountRepository.findById.mockResolvedValue({ id: 'account-123' });
      mockRepos.assembliesKitsRepository.isItemUsedInBOM.mockResolvedValue(false);
      mockRepos.itemsRepository.update.mockResolvedValue({
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
      expect(mockRepos.itemsRepository.update).toHaveBeenCalledWith(
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
      mockRepos.itemsRepository.findById.mockResolvedValue(null);

      await expect(service.updateItem('item-123', { name: 'Updated' })).rejects.toThrow(
        new ServiceError('Item not found', 'ITEM_NOT_FOUND', 404)
      );
    });

    it('should prevent duplicate item codes', async () => {
      mockRepos.itemsRepository.findByCode.mockResolvedValue({
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
      mockRepos.assembliesKitsRepository.isItemUsedInBOM.mockResolvedValue(true);

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
      mockRepos.itemsRepository.delete.mockResolvedValue(undefined);

      await service.deleteItem('item-123');

      expect(mockRepos.itemsRepository.delete).toHaveBeenCalledWith(
        'item-123',
        context.organizationId
      );
    });

    it('should throw error when deleting item with variants', async () => {
      mockRepos.itemsRepository.delete.mockRejectedValue(
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

      mockRepos.itemsRepository.findByOrganization
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

      expect(mockRepos.itemsRepository.findByOrganization).toHaveBeenCalledWith(
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

      mockRepos.itemsRepository.generateVariants.mockResolvedValue(mockVariants);

      const result = await service.generateVariants({
        parentItemId: 'parent-123',
        attributes: {
          size: ['S', 'M'],
          color: ['Red', 'Blue'],
        },
      });

      expect(result).toHaveLength(4);
      expect(mockRepos.itemsRepository.generateVariants).toHaveBeenCalledWith(
        'parent-123',
        context.organizationId,
        {
          size: ['S', 'M'],
          color: ['Red', 'Blue'],
        }
      );
    });

    it('should handle parent not found error', async () => {
      mockRepos.itemsRepository.generateVariants.mockRejectedValue(
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

      mockRepos.itemsRepository.findByOrganization.mockResolvedValue(mockResults);

      const result = await service.searchItems('computer');

      expect(result).toHaveLength(2);
      expect(mockRepos.itemsRepository.findByOrganization).toHaveBeenCalledWith(
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

      mockRepos.itemsRepository.findByOrganization.mockResolvedValue(mockItems);

      const result = await service.getItemsByCategory('cat-123');

      expect(result).toHaveLength(2);
      expect(mockRepos.itemsRepository.findByOrganization).toHaveBeenCalledWith(
        context.organizationId,
        {
          categoryId: 'cat-123',
        }
      );
    });
  });
});