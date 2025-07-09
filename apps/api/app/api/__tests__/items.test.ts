import { NextRequest } from 'next/server';
import { GET, POST } from '../items/route';
import { GET as GET_BY_ID, PUT, DELETE } from '../items/[id]/route';
import * as auth from '../utils/auth';
import * as apiService from '@glapi/api-service';

// Mock the auth module
jest.mock('../utils/auth', () => ({
  getServiceContext: jest.fn(),
}));

// Mock the api-service module
jest.mock('@glapi/api-service', () => ({
  ItemsService: jest.fn().mockImplementation(() => ({
    listItems: jest.fn(),
    createItem: jest.fn(),
    getItem: jest.fn(),
    updateItem: jest.fn(),
    deleteItem: jest.fn(),
  })),
  ServiceError: class ServiceError extends Error {
    constructor(
      public message: string,
      public code: string,
      public statusCode: number,
      public details?: any
    ) {
      super(message);
    }
  },
}));

describe('Items API Routes', () => {
  let mockContext: any;
  let mockService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockContext = {
      organizationId: 'test-org-123',
      clerkOrganizationId: 'clerk-org-123',
      userId: 'test-user-123',
      clerkUserId: 'clerk-user-123',
    };
    
    (auth.getServiceContext as jest.Mock).mockReturnValue(mockContext);
    
    mockService = new apiService.ItemsService(mockContext);
  });

  describe('GET /api/items', () => {
    it('should list items with default pagination', async () => {
      const mockItems = {
        data: [
          { id: 'item-1', name: 'Item 1' },
          { id: 'item-2', name: 'Item 2' },
        ],
        total: 2,
        page: 1,
        limit: 10,
        pages: 1,
      };

      mockService.listItems.mockResolvedValue(mockItems);

      const request = new NextRequest('http://localhost/api/items');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockItems);
      expect(mockService.listItems).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        search: undefined,
        itemType: undefined,
        categoryId: undefined,
        isActive: undefined,
        isPurchasable: undefined,
        isSaleable: undefined,
        parentItemId: undefined,
        includeVariants: false,
      });
    });

    it('should list items with filters', async () => {
      const mockItems = {
        data: [{ id: 'item-1', itemType: 'SERVICE' }],
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      };

      mockService.listItems.mockResolvedValue(mockItems);

      const request = new NextRequest(
        'http://localhost/api/items?itemType=SERVICE&isActive=true&page=2&limit=20'
      );
      const response = await GET(request);
      const _data = await response.json();

      expect(response.status).toBe(200);
      expect(mockService.listItems).toHaveBeenCalledWith({
        page: 2,
        limit: 20,
        search: undefined,
        itemType: 'SERVICE',
        categoryId: undefined,
        isActive: true,
        isPurchasable: undefined,
        isSaleable: undefined,
        parentItemId: undefined,
        includeVariants: false,
      });
    });

    it('should handle service errors', async () => {
      const error = new apiService.ServiceError('No items found', 'NOT_FOUND', 404);
      mockService.listItems.mockRejectedValue(error);

      const request = new NextRequest('http://localhost/api/items');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({
        message: 'No items found',
        code: 'NOT_FOUND',
        details: undefined,
      });
    });
  });

  describe('POST /api/items', () => {
    it('should create a new item', async () => {
      const newItem = {
        itemCode: 'ITEM-001',
        name: 'New Item',
        itemType: 'INVENTORY_ITEM',
        unitOfMeasureId: 'uom-123',
        incomeAccountId: 'income-123',
        assetAccountId: 'asset-123',
        cogsAccountId: 'cogs-123',
      };

      const createdItem = {
        id: 'item-123',
        ...newItem,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockService.createItem.mockResolvedValue(createdItem);

      const request = new NextRequest('http://localhost/api/items', {
        method: 'POST',
        body: JSON.stringify(newItem),
      });
      
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toEqual(createdItem);
      expect(mockService.createItem).toHaveBeenCalledWith(newItem);
    });

    it('should handle validation errors', async () => {
      const error = new apiService.ServiceError(
        'Item with this code already exists',
        'DUPLICATE_CODE',
        409
      );
      mockService.createItem.mockRejectedValue(error);

      const request = new NextRequest('http://localhost/api/items', {
        method: 'POST',
        body: JSON.stringify({ itemCode: 'EXISTING' }),
      });
      
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.code).toBe('DUPLICATE_CODE');
    });
  });

  describe('GET /api/items/:id', () => {
    it('should get an item by ID', async () => {
      const mockItem = {
        id: 'item-123',
        itemCode: 'ITEM-001',
        name: 'Test Item',
      };

      mockService.getItem.mockResolvedValue(mockItem);

      const request = new NextRequest('http://localhost/api/items/item-123');
      const response = await GET_BY_ID(request, { params: { id: 'item-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockItem);
      expect(mockService.getItem).toHaveBeenCalledWith('item-123');
    });

    it('should handle item not found', async () => {
      const error = new apiService.ServiceError('Item not found', 'ITEM_NOT_FOUND', 404);
      mockService.getItem.mockRejectedValue(error);

      const request = new NextRequest('http://localhost/api/items/invalid-id');
      const response = await GET_BY_ID(request, { params: { id: 'invalid-id' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe('ITEM_NOT_FOUND');
    });
  });

  describe('PUT /api/items/:id', () => {
    it('should update an item', async () => {
      const updateData = {
        name: 'Updated Item Name',
        defaultPrice: 150,
      };

      const updatedItem = {
        id: 'item-123',
        itemCode: 'ITEM-001',
        ...updateData,
        updatedAt: new Date(),
      };

      mockService.updateItem.mockResolvedValue(updatedItem);

      const request = new NextRequest('http://localhost/api/items/item-123', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });
      
      const response = await PUT(request, { params: { id: 'item-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(updatedItem);
      expect(mockService.updateItem).toHaveBeenCalledWith('item-123', updateData);
    });
  });

  describe('DELETE /api/items/:id', () => {
    it('should delete an item', async () => {
      mockService.deleteItem.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost/api/items/item-123', {
        method: 'DELETE',
      });
      
      const response = await DELETE(request, { params: { id: 'item-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ message: 'Item deleted successfully' });
      expect(mockService.deleteItem).toHaveBeenCalledWith('item-123');
    });

    it('should handle delete errors', async () => {
      const error = new apiService.ServiceError(
        'Cannot delete item with variants',
        'HAS_VARIANTS',
        409
      );
      mockService.deleteItem.mockRejectedValue(error);

      const request = new NextRequest('http://localhost/api/items/item-123', {
        method: 'DELETE',
      });
      
      const response = await DELETE(request, { params: { id: 'item-123' } });
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.code).toBe('HAS_VARIANTS');
    });
  });
});